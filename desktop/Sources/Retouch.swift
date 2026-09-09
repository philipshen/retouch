import AppKit
import WebKit

// The editor remains the same shell as /rt. No Node or native command bridge is
// exposed to a page. Native project startup delegates to the bundled CLI.
final class Studio: NSObject, NSApplicationDelegate, WKNavigationDelegate {
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

    static func shellQuote(_ value: String) -> String { "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'" }
    static var bundledCLI: String { Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/retouch/bin/retouch.cjs").path }
    static func launchArguments(_ command: String, cli: String? = nil) -> [String] {
        ["-l", "-c", "exec " + shellQuote(cli ?? bundledCLI) + " -- /bin/zsh -l -c " + shellQuote(command)]
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
        picker.message = "Choose the project folder for your usual startup command."
        guard picker.runModal() == .OK, let folder = picker.url else { return }
        let alert = NSAlert(); alert.messageText = "Start " + folder.lastPathComponent
        alert.informativeText = "Enter your usual startup command. The bundled Retouch CLI wraps it and output appears in Project logs."
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 480, height: 26))
        let key = "projectCommand:" + folder.path
        input.stringValue = UserDefaults.standard.string(forKey: key) ?? ""
        input.placeholderString = "npm run dev, make internal, or ./start.sh"
        input.setAccessibilityLabel("Project startup command")
        alert.accessoryView = input; alert.addButton(withTitle: "Start project"); alert.addButton(withTitle: "Cancel")
        alert.window.initialFirstResponder = input
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        let command = input.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !command.isEmpty else { status.stringValue = "Enter a startup command to start the project."; return }
        showLogs(); logText?.string = ""
        appendLog("Project: " + folder.path + "\nCommand: retouch -- " + command + "\n\n")
        let process = Process(), pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh"); process.arguments = Self.launchArguments(command)
        process.currentDirectoryURL = folder; process.standardOutput = pipe; process.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            let text = String(decoding: data, as: UTF8.self)
            DispatchQueue.main.async { self?.appendLog(text) }
        }
        process.terminationHandler = { [weak self] finished in
            DispatchQueue.main.async {
                guard let self = self, self.projectProcess === finished else { return }
                self.appendLog("\nProject exited (" + String(finished.terminationStatus) + ").\n")
                self.status.stringValue = finished.terminationStatus == 127 ? "Startup executable not found. Check Project logs and ensure Node and your command are available." : "Project stopped. See Project logs for details."
                self.projectProcess = nil; self.projectPipe = nil
                self.projectButton.isEnabled = true; self.stopButton.isEnabled = false
            }
        }
        do {
            try process.run(); projectProcess = process; projectPipe = pipe
            UserDefaults.standard.set(command, forKey: key)
            projectButton.isEnabled = false; stopButton.isEnabled = true
            status.stringValue = "Project starting · enter its local /rt URL when ready."
        } catch {
            pipe.fileHandleForReading.readabilityHandler = nil
            appendLog("Could not start: " + error.localizedDescription + "\n")
            status.stringValue = "Could not start the project. See Project logs."
        }
    }
    @objc private func stopProject() {
        guard let process = projectProcess, process.isRunning else { return }
        process.terminate(); stopButton.isEnabled = false; status.stringValue = "Stopping project…"
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 960),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Retouch"
        window.minSize = NSSize(width: 800, height: 600)
        window.center()
        let root = NSView()
        window.contentView = root
        let configuration = WKWebViewConfiguration()
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.allowsBackForwardNavigationGestures = true
        address = NSTextField(string: UserDefaults.standard.string(forKey: "editorURL") ?? "http://localhost:3000/rt")
        address.placeholderString = "Your running Retouch URL"
        address.setAccessibilityLabel("Retouch editor URL")
        address.target = self
        address.action = #selector(connect)
        let connectButton = NSButton(title: "Open editor", target: self, action: #selector(connect))
        status = NSTextField(labelWithString: "Start your project with retouch -- <your usual command>, then open its /rt URL.")
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
        web.loadHTMLString("""
        <!doctype html><meta name="viewport" content="width=device-width"><style>
        body{background:#17181b;color:#e8e9eb;font:16px -apple-system;padding:12vh 10vw;line-height:1.6}
        h1{font-size:40px;letter-spacing:-1px}p{color:#aaa;max-width:600px}code{color:#87c8ff;background:#252830;padding:8px 12px;border-radius:6px}
        </style><h1>Your site. Your design canvas.</h1>
        <p>Run your project with Retouch, then enter its editor URL above. Your site stays connected to its source files.</p>
        <p><code>retouch -- npm run dev</code></p>
        <p>Already using Make or a shell script? Keep that command after <code>retouch --</code>.</p>
        """, baseURL: nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
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

    @objc private func connect() {
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
            let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
            let ok = error == nil && (response as? HTTPURLResponse)?.statusCode == 200 && json?["ok"] as? Bool == true
            DispatchQueue.main.async {
                guard let self = self, self.requestID == id else { return }
                if ok {
                    self.address.stringValue = url.absoluteString
                    UserDefaults.standard.set(url.absoluteString, forKey: "editorURL")
                    self.status.stringValue = "Connected · edits save to your project's source"
                    self.web.load(URLRequest(url: url))
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
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { pending?.cancel(); if projectProcess?.isRunning == true { projectProcess?.terminate() } }
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
    print("PASS desktop URL boundaries and startup command literal round trip")
} else {
    let app = NSApplication.shared
    let delegate = Studio()
    app.setActivationPolicy(.regular)
    app.delegate = delegate
    app.run()
}
