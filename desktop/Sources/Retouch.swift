import AppKit
import WebKit

// The editor remains the same shell as /rt. The only page bridge samples a
// user-selected screen color. Project startup stays in the native UI and CLI.
final class Studio: NSObject, NSApplicationDelegate, WKNavigationDelegate, NSTextFieldDelegate, WKScriptMessageHandlerWithReply {
    private var window: NSWindow!
    private var web: WKWebView!
    private var address: NSTextField!
    private var status: NSTextField!
    private var pending: URLSessionDataTask?
    private var requestID = UUID()
    private var projectProcess: Process?
    private var projectPipe: Pipe?
    private var logWindow: NSWindow?
    private var logText: NSTextView?
    private var projectButton: NSButton!
    private var stopButton: NSButton!
    private var discoveryTimer: Timer?
    private var discoveryTask: URLSessionDataTask?
    private var discoveryID = UUID()
    private var outputLines = StartupLines()
    private var candidateURLs: [URL] = []
    private var connectedEditor: URL?
    private var editorDocument = UUID()
    private var colorSampler: NSColorSampler?

    // Native sampling has no programmatic cancel API. JavaScript abort discards
    // the result; Escape dismisses the system sampler. Keep one sampler at a time.
    static let colorSamplerScript = #"""
    (()=>{
      if(window!==window.top||!['/rt','/rt/'].includes(location.pathname))return;
      const handler=window.webkit?.messageHandlers?.retouchColorSampler;if(!handler)return;
      class NativeEyeDropper {
        open({signal}={}) {
          if(signal?.aborted)return Promise.reject(new DOMException('Sampling cancelled','AbortError'));
          if(navigator.userActivation&&!navigator.userActivation.isActive)return Promise.reject(new DOMException('Click the eyedropper to sample a color','NotAllowedError'));
          return new Promise((resolve,reject)=>{
            let done=false;
            const finish=(error,result)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);error?reject(error):resolve(result);};
            const abort=()=>finish(new DOMException('Sampling cancelled','AbortError'));
            signal?.addEventListener('abort',abort,{once:true});
            try{Promise.resolve(handler.postMessage({action:'sample'})).then(result=>{
              if(result?.error)finish(new DOMException('Screen sampling did not finish',result.error));
              else if(/^#[a-f\d]{6}$/i.test(result?.sRGBHex))finish(null,{sRGBHex:result.sRGBHex});
              else finish(new DOMException('Invalid screen color','OperationError'));
            },()=>finish(new DOMException('Screen sampling unavailable','OperationError')));}catch{finish(new DOMException('Screen sampling unavailable','OperationError'));}
          });
        }
      }
      Object.defineProperty(window,'RetouchNativeEyeDropper',{value:NativeEyeDropper});
    })();
    """#

    static func acceptsColorSampling(frameURL: URL?, editorURL: URL?, mainFrame: Bool) -> Bool {
        guard mainFrame, let frame = frameURL, let editor = editorURL,
              Self.editorURL(frame.absoluteString) != nil,
              ["/rt", "/rt/"].contains(frame.path),
              frame.scheme?.lowercased() == editor.scheme?.lowercased(),
              frame.host?.lowercased() == editor.host?.lowercased() else { return false }
        let defaultPort = frame.scheme?.lowercased() == "https" ? 443 : 80
        return (frame.port ?? defaultPort) == (editor.port ?? defaultPort)
    }
    static func sampledHex(_ color: NSColor) -> String? {
        guard let rgb = color.usingColorSpace(.sRGB) else { return nil }
        let channels = [rgb.redComponent, rgb.greenComponent, rgb.blueComponent]
        guard channels.allSatisfy({ $0.isFinite }) else { return nil }
        return "#" + channels.map { String(format: "%02x", Int((min(1, max(0, $0)) * 255).rounded())) }.joined()
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.name == "retouchColorSampler", message.webView === web,
              let body = message.body as? [String: String], body == ["action": "sample"],
              Self.acceptsColorSampling(frameURL: message.frameInfo.request.url, editorURL: connectedEditor, mainFrame: message.frameInfo.isMainFrame),
              Self.acceptsColorSampling(frameURL: web.url, editorURL: connectedEditor, mainFrame: true),
              NSApp.isActive, window.isKeyWindow else { replyHandler(["error": "NotAllowedError"], nil); return }
        guard colorSampler == nil else { replyHandler(["error": "InvalidStateError"], nil); return }
        let document = editorDocument, sampler = NSColorSampler()
        colorSampler = sampler
        sampler.show { [weak self] color in
            guard let self = self else { replyHandler(["error": "AbortError"], nil); return }
            self.colorSampler = nil
            guard self.editorDocument == document, let color = color else { replyHandler(["error": "AbortError"], nil); return }
            guard let hex = Self.sampledHex(color) else { replyHandler(["error": "OperationError"], nil); return }
            replyHandler(["sRGBHex": hex], nil)
        }
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        editorDocument = UUID()
    }


    struct StartupLines {
        var pending = ""
        mutating func append(_ text: String) -> [URL] {
            pending += text
            let lines = pending.components(separatedBy: "\n")
            pending = String((lines.last ?? "").suffix(16384))
            return lines.dropLast().flatMap { Studio.localEditorURLs($0) }
        }
    }
    static func localEditorURLs(_ text: String) -> [URL] {
        let clean = text.replacingOccurrences(of: "\u{001B}\\[[0-9;]*[A-Za-z]", with: "", options: .regularExpression)
        let regex = try! NSRegularExpression(pattern: "https?://[^\\s<>\"']+")
        return regex.matches(in: clean, range: NSRange(clean.startIndex..., in: clean)).compactMap { match in
            guard let range = Range(match.range, in: clean) else { return nil }
            return editorURL(String(clean[range]))
        }
    }
    static func isRetouchHealth(_ data: Data?, _ response: URLResponse?, _ error: Error?) -> Bool {
        let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
        return error == nil && (response as? HTTPURLResponse)?.statusCode == 200 && json?["ok"] as? Bool == true && json?["service"] as? String == "retouch"
    }
    private func stopDiscovery() {
        discoveryID = UUID(); discoveryTimer?.invalidate(); discoveryTimer = nil
        discoveryTask?.cancel(); discoveryTask = nil
    }
    private func startDiscovery() {
        stopDiscovery(); outputLines = StartupLines(); candidateURLs = []
        let id = discoveryID, deadline = Date().addingTimeInterval(90)
        var index = 0
        discoveryTimer = Timer.scheduledTimer(withTimeInterval: 0.75, repeats: true) { [weak self] _ in
            guard let self = self, self.discoveryID == id else { return }
            guard Date() < deadline else { self.stopDiscovery(); self.status.stringValue = "No ready editor found. Check Project logs or enter its local /rt URL."; return }
            guard self.projectProcess?.isRunning == true else { self.stopDiscovery(); return }
            guard self.discoveryTask == nil, !self.candidateURLs.isEmpty else { return }
            let url = self.candidateURLs[index % self.candidateURLs.count]; index += 1
            var health = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            health.path = "/rt/__api/health"; health.query = nil; health.fragment = nil
            var request = URLRequest(url: health.url!); request.timeoutInterval = 2
            self.discoveryTask = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
                let ready = Self.isRetouchHealth(data, response, error)
                DispatchQueue.main.async {
                    guard let self = self, self.discoveryID == id else { return }
                    self.discoveryTask = nil
                    if ready { self.address.stringValue = url.absoluteString; self.connect() }
                }
            }
            self.discoveryTask?.resume()
        }
    }

    static func shellQuote(_ value: String) -> String { "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'" }
    static var bundledCLI: String { Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/retouch/bin/retouch.cjs").path }
    static func launchArguments(_ command: String, cli: String? = nil) -> [String] {
        ["-l", "-c", "exec " + shellQuote(cli ?? bundledCLI) + " -- /bin/zsh -l -c " + shellQuote(command)]
    }
    static func htmlLaunchArguments(_ folder: URL, cli: String? = nil) -> [String] {
        ["-l", "-c", "exec " + shellQuote(cli ?? bundledCLI) + " html " + shellQuote(folder.path) + " --port=0"]
    }
    static func prefersHTML(_ folder: URL) -> Bool {
        let fm = FileManager.default
        return !fm.fileExists(atPath: folder.appendingPathComponent("package.json").path)
            && ["index.html", "index.htm"].contains { fm.fileExists(atPath: folder.appendingPathComponent($0).path) }
    }
    @objc private func projectModeChanged(_ sender: NSPopUpButton) {
        if let input = sender.superview?.subviews.first(where: { $0 is NSTextField }) as? NSTextField {
            input.isEnabled = sender.indexOfSelectedItem == 0
        }
    }
    private func appendLog(_ text: String) {
        guard let log = logText else { return }
        log.textStorage?.append(NSAttributedString(string: text, attributes: [.font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)]))
        if let storage = log.textStorage, storage.length > 100000 { storage.deleteCharacters(in: NSRange(location: 0, length: storage.length - 100000)) }
        log.scrollToEndOfDocument(nil)
    }
    @objc private func showLogs() {
        if logWindow == nil {
            let panel = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 850, height: 500), styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
            panel.title = "Retouch project output"; panel.isReleasedWhenClosed = false
            let scroll = NSScrollView(frame: panel.contentView!.bounds); scroll.autoresizingMask = [.width, .height]; scroll.hasVerticalScroller = true
            let text = NSTextView(frame: scroll.bounds); text.isEditable = false; text.isVerticallyResizable = true; text.autoresizingMask = [.width]
            scroll.documentView = text; panel.contentView?.addSubview(scroll)
            logWindow = panel; logText = text; panel.center()
        }
        logWindow?.makeKeyAndOrderFront(nil)
    }
    @objc private func openProject() {
        guard projectProcess == nil else { showLogs(); return }
        let picker = NSOpenPanel(); picker.canChooseFiles = false; picker.canChooseDirectories = true; picker.allowsMultipleSelection = false
        picker.message = "Choose a web project or a folder containing HTML files."
        guard picker.runModal() == .OK, let folder = picker.url else { return }
        let alert = NSAlert(); alert.messageText = "Start " + folder.lastPathComponent
        alert.informativeText = "Choose HTML files to edit a static web folder, or enter your usual startup command for an app. The editor opens automatically."
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 480, height: 26))
        let key = "projectCommand:" + folder.path
        input.stringValue = UserDefaults.standard.string(forKey: key) ?? ""
        input.placeholderString = "npm run dev, make internal, or ./start.sh"
        input.setAccessibilityLabel("Project startup command")
        let mode = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: 480, height: 28))
        mode.addItems(withTitles: ["Run startup command", "Edit HTML files"])
        mode.setAccessibilityLabel("Project type")
        mode.selectItem(at: Self.prefersHTML(folder) ? 1 : 0)
        mode.target = self; mode.action = #selector(projectModeChanged(_:))
        input.isEnabled = mode.indexOfSelectedItem == 0
        let controls = NSStackView(views: [mode, input]); controls.orientation = .vertical
        controls.alignment = .leading; controls.spacing = 8
        alert.accessoryView = controls; alert.addButton(withTitle: "Start project"); alert.addButton(withTitle: "Cancel")
        alert.window.initialFirstResponder = input.isEnabled ? input : mode
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        let command = input.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let isHTML = mode.indexOfSelectedItem == 1
        guard isHTML || !command.isEmpty else { status.stringValue = "Enter a startup command to start the project."; return }
        showLogs(); logText?.string = ""
        appendLog("Project: " + folder.path + "\n" + (isHTML ? "Mode: HTML files" : "Command: retouch -- " + command) + "\n\n")
        let process = Process(), pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh"); process.arguments = isHTML ? Self.htmlLaunchArguments(folder) : Self.launchArguments(command)
        process.currentDirectoryURL = folder; process.standardOutput = pipe; process.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            let text = String(decoding: data, as: UTF8.self)
            DispatchQueue.main.async {
                guard let self = self, self.projectProcess === process else { return }
                self.appendLog(text)
                for url in self.outputLines.append(text) where !self.candidateURLs.contains(url) {
                    if self.candidateURLs.count < 16 { self.candidateURLs.append(url) }
                }
            }
        }
        process.terminationHandler = { [weak self] finished in
            DispatchQueue.main.async {
                guard let self = self, self.projectProcess === finished else { return }
                self.appendLog("\nProject exited (" + String(finished.terminationStatus) + ").\n")
                self.status.stringValue = finished.terminationStatus == 127 ? "Startup executable not found. Check Project logs and ensure Node and your command are available." : "Project stopped. See Project logs for details."
                self.stopDiscovery()
                // Only retire the editor owned by this process; a manually connected
                // editor on another origin can remain open when the project exits.
                let owns: (URL?) -> Bool = { url in
                    guard let url = url else { return false }
                    return self.candidateURLs.contains { candidate in
                        candidate.scheme == url.scheme && candidate.host == url.host && candidate.port == url.port
                    }
                }
                if owns(Self.editorURL(self.address.stringValue)) { self.pending?.cancel(); self.pending = nil; self.requestID = UUID() }
                if owns(self.connectedEditor) {
                    self.connectedEditor = nil; self.editorDocument = UUID()
                    self.web.stopLoading(); self.showWelcome(stopped: true)
                }
                self.projectProcess = nil; self.projectPipe = nil
                self.projectButton.isEnabled = true; self.stopButton.isEnabled = false
            }
        }
        do {
            try process.run(); projectProcess = process; projectPipe = pipe; startDiscovery()
            if !isHTML { UserDefaults.standard.set(command, forKey: key) }
            projectButton.isEnabled = false; stopButton.isEnabled = true
            status.stringValue = "Project starting · looking for its local editor URL…"
        } catch {
            pipe.fileHandleForReading.readabilityHandler = nil
            appendLog("Could not start: " + error.localizedDescription + "\n")
            status.stringValue = "Could not start the project. See Project logs."
        }
    }
    @objc private func stopProject() {
        guard let process = projectProcess, process.isRunning else { return }
        stopDiscovery(); process.terminate(); stopButton.isEnabled = false; status.stringValue = "Stopping project…"
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 960),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Retouch"
        window.appearance = NSAppearance(named: .aqua)
        window.minSize = NSSize(width: 800, height: 600)
        window.center()
        let root = NSView()
        window.contentView = root
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "retouchColorSampler")
        configuration.userContentController.addUserScript(WKUserScript(source: Self.colorSamplerScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.allowsBackForwardNavigationGestures = true
        address = NSTextField(string: UserDefaults.standard.string(forKey: "editorURL") ?? "http://localhost:3000/rt")
        address.placeholderString = "Your running Retouch URL"
        address.setAccessibilityLabel("Retouch editor URL")
        address.delegate = self
        address.target = self
        address.action = #selector(connect)
        let connectButton = NSButton(title: "Open editor", target: self, action: #selector(connect))
        status = NSTextField(labelWithString: "Open a project to start your usual command, or connect to a running editor.")
        status.textColor = .secondaryLabelColor
        status.font = .systemFont(ofSize: 12)
        projectButton = NSButton(title: "Open project…", target: self, action: #selector(openProject))
        stopButton = NSButton(title: "Stop", target: self, action: #selector(stopProject)); stopButton.isEnabled = false
        let logsButton = NSButton(title: "Project logs", target: self, action: #selector(showLogs))
        let bar = NSStackView(views: [projectButton!, stopButton!, logsButton, address, connectButton])
        bar.spacing = 8
        for view in [bar, status!, web!] { view.translatesAutoresizingMaskIntoConstraints = false; root.addSubview(view) }
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: root.topAnchor, constant: 10),
            bar.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            bar.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -12),
            address.widthAnchor.constraint(greaterThanOrEqualToConstant: 300),
            status.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 7),
            status.leadingAnchor.constraint(equalTo: bar.leadingAnchor),
            status.trailingAnchor.constraint(equalTo: bar.trailingAnchor),
            web.topAnchor.constraint(equalTo: status.bottomAnchor, constant: 10),
            web.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])
        showWelcome()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func showWelcome(stopped: Bool = false) {
        web.loadHTMLString("""
        <!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><style>
        *{box-sizing:border-box}body{margin:0;background:#f5f5f5;color:#1e1e1e;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased}
        main{max-width:800px;margin:0 auto;padding:clamp(28px,7vh,72px) 32px}header{margin-bottom:28px}.brand{font-size:12px;font-weight:600;color:#757575}h1{font-size:32px;line-height:1.2;letter-spacing:-1px;margin:12px 0}p{margin:8px 0;color:#757575}
        .paths{display:grid;grid-template-columns:1fr 1fr;gap:16px}article{background:white;border:1px solid #e6e6e6;border-radius:12px;padding:24px;min-width:0}h2{font-size:14px;font-weight:600;margin:0 0 12px}strong{color:#1e1e1e;font-weight:600}code{display:block;margin-top:18px;background:#f5f5f5;border-radius:5px;padding:8px 12px;color:#1e1e1e;font:12px/1.6 "SF Mono",Menlo,monospace;overflow-wrap:anywhere}.note{margin-top:20px;font-size:12px}
        @media(max-width:600px){main{padding:24px}.paths{grid-template-columns:1fr}h1{font-size:28px}}
        </style><main><header><div class="brand">Retouch</div><h1>\(stopped ? "Project stopped" : "Open your design canvas")</h1><p>\(stopped ? "Saved edits remain in your project. Open a project to continue editing." : "Use your existing site as the starting point.")</p></header>
        <section class="paths" aria-label="Ways to open your site"><article><h2>Open a project</h2><p>Choose <strong>Open project…</strong> above and select your project folder.</p><p>Open HTML files directly, or enter the command you already use to start your site.</p><code>npm run dev</code></article>
        <article><h2>Connect to an editor</h2><p>Already running Retouch? Paste its editor URL into the address field above, then choose <strong>Open editor</strong>.</p><p>Use the <strong>/rt</strong> URL shown in your terminal.</p></article></section>
        <p class="note">Make, shell scripts, and other startup commands work too. Keep using your project's existing command.</p></main></html>
        """, baseURL: nil)
    }

    func reportWindowState() {
        let state: [String: Any] = [
            "windowCreated": window != nil,
            "windowVisible": window?.isVisible ?? false,
            "windowMiniaturized": window?.isMiniaturized ?? false,
            "windowOcclusionVisible": window?.occlusionState.contains(.visible) ?? false,
            "windowNumber": window?.windowNumber ?? -1,
            "windowFrame": NSStringFromRect(window?.frame ?? .zero),
            "screenFrame": NSStringFromRect(window?.screen?.frame ?? .zero),
            "webFrame": NSStringFromRect(web?.frame ?? .zero),
            "webLoading": web?.isLoading ?? false,
            "applicationActive": NSApp.isActive,
            "applicationHidden": NSApp.isHidden,
            "screenCount": NSScreen.screens.count
        ]
        if let data = try? JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted, .sortedKeys]) {
            FileHandle.standardOutput.write(data)
            FileHandle.standardOutput.write(Data("\n".utf8))
        }
    }

    static func editorURL(_ raw: String) -> URL? {
        guard var parts = URLComponents(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              ["http", "https"].contains(parts.scheme?.lowercased() ?? ""),
              ["localhost", "127.0.0.1"].contains(parts.host?.lowercased() ?? ""),
              parts.user == nil, parts.password == nil,
              parts.port == nil || (1...65535).contains(parts.port!) else { return nil }
        if parts.path.isEmpty || parts.path == "/" { parts.path = "/rt" }
        guard parts.path == "/rt" || parts.path.hasPrefix("/rt/") else { return nil }
        return parts.url
    }

    func controlTextDidBeginEditing(_ notification: Notification) {
        if let field = notification.object as? NSTextField, field === address { stopDiscovery() }
    }
    @objc private func connect() {
        stopDiscovery()
        pending?.cancel()
        requestID = UUID()
        guard let url = Self.editorURL(address.stringValue) else {
            status.stringValue = "Enter a local Retouch URL, such as http://localhost:3000/rt."
            return
        }
        let id = requestID
        var health = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        health.path = "/rt/__api/health"; health.query = nil; health.fragment = nil
        var request = URLRequest(url: health.url!)
        request.timeoutInterval = 8
        status.stringValue = "Connecting…"
        pending = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            let ok = Self.isRetouchHealth(data, response, error)
            DispatchQueue.main.async {
                guard let self = self, self.requestID == id else { return }
                if ok {
                    self.address.stringValue = url.absoluteString
                    UserDefaults.standard.set(url.absoluteString, forKey: "editorURL")
                    self.status.stringValue = "Connected · edits save to your project's source"
                    self.connectedEditor = url
                    self.editorDocument = UUID()
                    self.web.load(URLRequest(url: url))
                    self.window.makeKeyAndOrderFront(nil)
                } else {
                    self.status.stringValue = "Could not connect. Check that Retouch is running and the port is correct."
                }
            }
        }
        pending?.resume()
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { status.stringValue = "Could not load editor: \(error.localizedDescription)" }
    }
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        editorDocument = UUID()
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { stopDiscovery(); pending?.cancel(); if projectProcess?.isRunning == true { projectProcess?.terminate() } }
    @objc private func reloadEditor() { web.reload() }
    @objc private func focusAddress() { window.makeFirstResponder(address); address.selectText(nil) }
    private func buildMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About Retouch", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Retouch", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); menu.addItem(editItem)
        let edit = NSMenu(title: "Edit"); editItem.submenu = edit
        for (title, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        let viewItem = NSMenuItem(); menu.addItem(viewItem)
        let view = NSMenu(title: "View"); viewItem.submenu = view
        view.addItem(withTitle: "Reload Editor", action: #selector(reloadEditor), keyEquivalent: "r").target = self
        view.addItem(withTitle: "Open Editor URL", action: #selector(focusAddress), keyEquivalent: "l").target = self
        NSApp.mainMenu = menu
    }
}

if CommandLine.arguments.contains("--self-test") {
    precondition(Studio.editorURL("http://localhost:3000")?.path == "/rt")
    precondition(Studio.editorURL("https://127.0.0.1:9000/rt/products?q=1")?.query == "q=1")
    for invalid in ["https://example.com/rt", "file:///tmp/x", "javascript:alert(1)", "http://localhost.evil/rt", "http://user@localhost/rt", "http://localhost:0/rt", "http://localhost/admin"] {
        precondition(Studio.editorURL(invalid) == nil, invalid)
    }
    precondition(Studio.localEditorURLs("Local: http://localhost:3496").first?.absoluteString == "http://localhost:3496/rt")
    precondition(Studio.localEditorURLs("Network: http://192.168.1.2:3000 http://localhost.evil/rt").isEmpty)
    precondition(Studio.localEditorURLs("\u{001B}[32mhttps://127.0.0.1:9000/rt\u{001B}[0m").count == 1)
    let response = HTTPURLResponse(url: URL(string: "http://localhost:3000")!, statusCode: 200, httpVersion: nil, headerFields: nil)
    precondition(!Studio.isRetouchHealth(Data("{\"ok\":true}".utf8), response, nil))
    precondition(Studio.isRetouchHealth(Data("{\"ok\":true,\"service\":\"retouch\"}".utf8), response, nil))
    if let index = CommandLine.arguments.firstIndex(of: "--probe-editor"), CommandLine.arguments.count > index + 1 {
        let editor = Studio.editorURL(CommandLine.arguments[index + 1])!
        var health = URLComponents(url: editor, resolvingAgainstBaseURL: false)!
        health.path = "/rt/__api/health"; health.query = nil; health.fragment = nil
        let done = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: health.url!) { data, response, error in
            precondition(Studio.isRetouchHealth(data, response, error)); done.signal()
        }.resume()
        precondition(done.wait(timeout: .now() + 10) == .success)
        print("PASS native discovery health probe against running editor")
    }
    var lines = Studio.StartupLines()
    precondition(lines.append("Local: http://local").isEmpty)
    precondition(lines.append("host:3496\n").first?.port == 3496)
    let command = "printf '%s' \"literal $HOME and `ticks`\""
    precondition(Studio.launchArguments(command).last == "exec " + Studio.shellQuote(Studio.bundledCLI) + " -- /bin/zsh -l -c " + Studio.shellQuote(command))
    let quotingTest = Process(), output = Pipe()
    quotingTest.executableURL = URL(fileURLWithPath: "/bin/zsh")
    quotingTest.arguments = ["-c", "printf '%s' " + Studio.shellQuote(command)]
    quotingTest.standardOutput = output
    try! quotingTest.run(); quotingTest.waitUntilExit()
    precondition(String(decoding: output.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self) == command)
    precondition(quotingTest.terminationStatus == 0)
    let cliIndex = CommandLine.arguments.firstIndex(of: "--launch-cli")
    let testCLI = cliIndex.flatMap { CommandLine.arguments.count > $0 + 1 ? CommandLine.arguments[$0 + 1] : nil }
    if testCLI != nil || CommandLine.arguments.contains("--launch-bundled") {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("retouch-native-launch-" + UUID().uuidString)
        try! FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let launch = Process(), capture = Pipe()
        launch.executableURL = URL(fileURLWithPath: "/bin/zsh")
        launch.arguments = Studio.launchArguments("printf '%s' \"$PWD\"; exit 7", cli: testCLI)
        launch.currentDirectoryURL = folder; launch.standardOutput = capture
        try! launch.run(); launch.waitUntilExit()
        let cwd = String(decoding: capture.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
        precondition(URL(fileURLWithPath: cwd).resolvingSymlinksInPath().path == folder.resolvingSymlinksInPath().path)
        precondition(launch.terminationStatus == 7)
        print("PASS native launcher delegates to real CLI, preserves working directory and propagates exit status")
    }
    let htmlFolder = FileManager.default.temporaryDirectory.appendingPathComponent("retouch HTML ' literal-$-" + UUID().uuidString)
    try! FileManager.default.createDirectory(at: htmlFolder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: htmlFolder) }
    try! "<html><body><h1>Native HTML</h1></body></html>".write(to: htmlFolder.appendingPathComponent("index.html"), atomically: true, encoding: .utf8)
    precondition(Studio.prefersHTML(htmlFolder))
    try! "{}".write(to: htmlFolder.appendingPathComponent("package.json"), atomically: true, encoding: .utf8)
    precondition(!Studio.prefersHTML(htmlFolder))
    try! FileManager.default.removeItem(at: htmlFolder.appendingPathComponent("package.json"))
    if testCLI != nil || CommandLine.arguments.contains("--launch-bundled") {
        let server = Process(), output = Pipe(), ready = DispatchSemaphore(value: 0)
        server.executableURL = URL(fileURLWithPath: "/bin/zsh")
        server.arguments = Studio.htmlLaunchArguments(htmlFolder, cli: testCLI)
        server.standardOutput = output; server.standardError = output
        var startup = Studio.StartupLines(), editor: URL?
        output.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; ready.signal(); return }
            if let url = startup.append(String(decoding: data, as: UTF8.self)).first { editor = url; ready.signal() }
        }
        try! server.run()
        precondition(ready.wait(timeout: .now() + 15) == .success)
        guard let editor = editor else { fatalError("HTML launcher produced no editor URL") }
        var health = URLComponents(url: editor, resolvingAgainstBaseURL: false)!
        health.path = "/rt/__api/health"
        let checked = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: health.url!) { data, response, error in
            precondition(Studio.isRetouchHealth(data, response, error)); checked.signal()
        }.resume()
        precondition(checked.wait(timeout: .now() + 10) == .success)
        server.terminate(); server.waitUntilExit(); output.fileHandleForReading.readabilityHandler = nil
        print("PASS native HTML folder launch, literal path, dynamic port, editor health and stop")
    }
    print("PASS desktop URL boundaries, startup URL discovery and command literal round trip")
} else {
    let app = NSApplication.shared
    let delegate = Studio()
    app.setActivationPolicy(.regular)
    app.delegate = delegate
    // Opt-in diagnostic uses the actual GUI startup, without opening a project.
    // Report local geometry only, then quit so command-line checks stay bounded.
    if CommandLine.arguments.contains("--diagnose-window") {
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            delegate.reportWindowState()
            app.terminate(nil)
        }
    }
    // NSApplication.delegate is weak; keep Studio alive throughout the event loop.
    withExtendedLifetime(delegate) { app.run() }
}
