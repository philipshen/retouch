'use strict';
// Compile and execute pure URL/argv helpers without constructing NSApplication.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../Sources/Retouch.swift'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-capture-policy-'));
try{
 const file=path.join(directory,'capture.swift');
 fs.writeFileSync(file,'import Foundation\nenum Studio {\n'+section('    static func shellQuote(', '    static func launchArguments(')+section('    static func captureURL(', '    @objc private func openWebsite(')+'\n}\n'+String.raw`
for raw in ["file:///etc/passwd", "javascript:alert(1)", "https://name:pass@example.com", "https://", "example.com", ""] { precondition(Studio.captureURL(raw) == nil, raw) }
let address = Studio.captureURL(" https://example.com/page?q=';$HOME&x=1 ")!
let folder = URL(fileURLWithPath:"/tmp/Website's $HOME; copy")
let arguments = Studio.captureLaunchArguments(address, folder:folder, width:390, height:844, cli:"/tmp/retouch ' cli")
precondition(Studio.captureLaunchArguments(address, folder:folder, width:390, height:844, responsive:true).last!.hasSuffix(" --open --responsive"))
precondition(arguments.count == 3 && arguments[0] == "-l" && arguments[1] == "-c")
// Replace only the trusted executable prefix, then use the shell to print argv.
let executable = "exec " + Studio.shellQuote(Studio.bundledLauncher)
precondition(arguments[2].hasPrefix(executable))
let command = "printf '%s\\n'" + String(arguments[2].dropFirst(executable.count))
let task = Process(), output = Pipe(); task.executableURL = URL(fileURLWithPath:"/bin/zsh"); task.arguments = ["-c",command]; task.standardOutput = output
try task.run(); let text = String(decoding:output.fileHandleForReading.readDataToEndOfFile(),as:UTF8.self); task.waitUntilExit()
precondition(task.terminationStatus == 0)
precondition(text.components(separatedBy:"\n") == ["/tmp/retouch ' cli", "capture", address.absoluteString, "--out", folder.path, "--width=390", "--height=844", "--open", ""])
print("CAPTURE URL BOUNDARIES AND LITERAL SHELL ARGUMENTS PASS")
`);
 process.stdout.write(execFileSync('xcrun',['swift','-module-cache-path',path.join(directory,'cache'),file],{encoding:'utf8',timeout:120000}));
}finally{fs.rmSync(directory,{recursive:true,force:true});}
