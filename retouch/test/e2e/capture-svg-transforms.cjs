'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const engine=process.env.RT_E2E_BROWSER||'chromium',playwright=require(path.join(process.env.RT_INSPECTOR_FIXTURE,'node_modules/playwright'));
(async()=>{let source,target;try{
 source=await playwright[engine].launch();
 const page=await source.newPage({viewport:{width:600,height:600}});
 await page.setContent('<style>body{margin:0}.reset{transform:none}.css{transform:translate(4px,8px) rotate(12deg);transform-origin:10px 20px}</style><svg width="400" height="400" viewBox="0 0 200 200"><g transform="translate(12 7)">'+['','class="reset"','class="css"','style="scale: .8; rotate: 8deg"'].map((attrs,i)=>'<rect id="r'+i+'" '+attrs+' x="20" y="20" width="40" height="30" transform="matrix(.75 .1 .2 1.1 10 '+(i*35)+')"/>').join('')+'</g><svg x="20" y="20" width="100" height="100" viewBox="0 0 50 50"><path id="nested" transform="translate(2 3) scale(.8)" d="M10 10H30V30H10Z"/></svg></svg>');
 const measure=()=>[...document.querySelectorAll('[id]')].map(el=>({id:el.id,box:[el.getBoundingClientRect().x,el.getBoundingClientRect().y,el.getBoundingClientRect().width,el.getBoundingClientRect().height],matrix:[el.getScreenCTM().a,el.getScreenCTM().b,el.getScreenCTM().c,el.getScreenCTM().d,el.getScreenCTM().e,el.getScreenCTM().f]}));
 const before=await page.evaluate(measure),markup=await page.content(),snapshot=await page.evaluate(require('../../src/capture-document.cjs'),{exportState:true});
 // Export always uses Chromium, including snapshots captured by WebKit.
 delete process.env.PLAYWRIGHT_BROWSERS_PATH;
 target=await require('playwright').chromium.launch(require('../../src/capture-browser.cjs').launchOptions());const exportPage=await target.newPage({viewport:{width:600,height:600}});await exportPage.setContent(snapshot.html);
 const after=await exportPage.evaluate(measure);assert.equal(after.length,before.length);
 for(let i=0;i<before.length;i++)for(const field of ['box','matrix'])for(let j=0;j<before[i][field].length;j++)assert.ok(Math.abs(before[i][field][j]-after[i][field][j])<.01,JSON.stringify({engine,before:before[i],after:after[i]}));
 assert.equal(await page.content(),markup);console.log(engine+': PASS captured SVG transforms, CSS overrides, individual transforms, nested viewports and unchanged source');
}finally{await source?.close();await target?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
