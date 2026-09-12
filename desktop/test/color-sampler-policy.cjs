'use strict';
// Execute only the extracted pure policy/color helpers through the Swift toolchain.
// This does not construct NSApplication, WKWebView or NSColorSampler, or launch Retouch.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const source=fs.readFileSync(path.resolve(__dirname,'../Sources/Retouch.swift'),'utf8');
const helper=(start,end)=>{const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert.ok(from>=0&&to>from);return source.slice(from,to);};
const helpers=helper('    static func acceptsColorSampling(', '    func userContentController(')+helper('    static func editorURL(', '    func controlTextDidBeginEditing(');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-sampler-policy-'));
try{
 const file=path.join(directory,'policy.swift');
 fs.writeFileSync(file,'import AppKit\nimport Foundation\nenum Studio {\n'+helpers+'\n}\n'+String.raw`
let editor=URL(string:"http://localhost:3000/rt")!
func accepts(_ frame: String?, editorURL: URL? = editor, main: Bool = true) -> Bool {
    Studio.acceptsColorSampling(frameURL: frame.flatMap(URL.init(string:)), editorURL: editorURL, mainFrame: main)
}
precondition(accepts("http://localhost:3000/rt"))
precondition(accepts("http://localhost:3000/rt/?screen=mobile"))
for frame in [nil,"http://localhost:3001/rt","https://localhost:3000/rt","http://127.0.0.1:3000/rt","http://localhost:3000/rt/site","http://localhost:3000/rt/__api/health","http://localhost:3000/","https://example.com/rt","http://user@localhost:3000/rt","file:///rt"] as [String?] {
    precondition(!accepts(frame),frame ?? "nil frame")
}
precondition(!accepts(editor.absoluteString,main:false))
precondition(!accepts(editor.absoluteString,editorURL:nil))
precondition(accepts("http://localhost:80/rt",editorURL:URL(string:"http://localhost/rt")))
precondition(accepts("https://localhost:443/rt",editorURL:URL(string:"https://localhost/rt")))
precondition(Studio.sampledHex(NSColor(srgbRed:0.2,green:0.4,blue:0.6,alpha:0.25)) == "#336699")
precondition(Studio.sampledHex(NSColor(srgbRed:0.5,green:0,blue:1,alpha:1)) == "#8000ff")
precondition(Studio.sampledHex(NSColor(displayP3Red:1,green:0,blue:0,alpha:1)) == "#ff0000")
print("PASS extracted native sampler origin/frame policy and sRGB conversion; no app launch")
`);
 execFileSync('xcrun',['swift','-module-cache-path',path.join(directory,'module-cache'),file],{stdio:'inherit',timeout:120000});
}finally{fs.rmSync(directory,{recursive:true,force:true});}
