'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),G=require('../../shell/svg-path.js'),S=require('../../shell/svg-stroke-alignment.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium',id='rt-stroke-0123456789abcdef';
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();let checks=0;try{
 const page=await browser.newPage();await page.setContent('<style>svg,path,g{fill:lime;stroke:purple;opacity:.2;transform:scale(3)}</style><iframe style="width:400px;height:400px;border:0"></iframe>');
 for(const script of ['svg-path.js','svg-affine.js','palette-values.js','html-css-values.js'])await page.addScriptTag({path:path.resolve(__dirname,'../../shell',script)});
 await page.addScriptTag({path:require.resolve('paper/dist/paper-core.min.js')});
 for(const script of ['svg-stroke-gradient.js','svg-stroke-alignment.js','svg-stroke-fidelity.js'])await page.addScriptTag({path:path.resolve(__dirname,'../../shell',script)});
 const frame=page.frames().find(f=>f.parentFrame());
 const snapshot=async()=>page.screenshot({clip:await frame.locator('svg').boundingBox()});
 const run=async(model,expected)=>{
  const result=await page.evaluate(({model,id})=>{
   const d=document.querySelector('iframe').contentDocument,group=d.querySelector('[data-rt-stroke-alignment]'),original=d.documentElement.innerHTML,retained=group.firstElementChild,scopes=Object.keys(paper.PaperScope._scopes).length,observer=new MutationObserver(()=>{});observer.observe(d.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
   let error;try{RetouchSVGStrokeFidelity.check(group,model,id);}catch(e){error=e.message;}
   const unchanged=original===d.documentElement.innerHTML&&retained===group.firstElementChild,mutations=observer.takeRecords().length;observer.disconnect();
   return {error,unchanged,mutations,references:document.querySelectorAll('[data-rt-stroke-reference]').length,scopes:Object.keys(paper.PaperScope._scopes).length-scopes};
  },{model,id});checks++;assert.equal(result.unchanged,true);assert.equal(result.mutations,0);assert.equal(result.references,0);assert.equal(result.scopes,0);
  if(expected)assert.match(result.error||'',expected);else assert.equal(result.error,undefined);return result;
 };
 for(const placement of [undefined,[.9,.1,-.1,.9,5,2],[-1,0,0,1,100,0]])for(const position of ['inside','center','outside'])for(const matrix of [[1,0,0,1,0,0],[.8,.2,-.2,.8,20,0],[.75,0,0,1.1,10,-5]]){
  const input={document:G.parseCompound('M20 20H80V80H20Z'),position,width:8,fill:'#ff0000',stroke:'#0000ff',matrix,...(placement?{placement}:{})},model=S.normalize(input),rendered=S.render(input,id);
  await frame.setContent('<style>body{margin:0}</style><svg width="300" height="300" viewBox="0 0 100 100"><g transform="translate(2 1)"><g '+(placement?'transform="matrix('+placement.join(' ')+')" ':'')+'data-rt-stroke-alignment="1" data-rt-stroke-id="'+id+'"><g data-rt-stroke-original="" display="none"><rect x="20" y="20" width="60" height="60"/></g>'+rendered+'</g></g></svg>');await run(model);
  const beforePreview=await frame.locator('[data-rt-stroke-alignment]').innerHTML();
  await page.evaluate(({model,id})=>{const group=document.querySelector('iframe').contentDocument.querySelector('[data-rt-stroke-alignment]');window.strokePreview=RetouchSVGStrokeFidelity.previewWeight(group,model,id);window.strokePreviewNodes=[...group.querySelectorAll('*')];},{model,id});
  for(const width of [0,.125,12.5]){await page.evaluate(width=>strokePreview.update(width),width);await run({...model,width});assert.equal(await page.evaluate(()=>strokePreview.current()),true);}
  await page.evaluate(()=>strokePreview.restore());assert.equal(await frame.locator('[data-rt-stroke-alignment]').innerHTML(),beforePreview);assert.equal(await page.evaluate(()=>{const nodes=[...document.querySelector('iframe').contentDocument.querySelector('[data-rt-stroke-alignment]').querySelectorAll('*')];return nodes.every((el,i)=>el===strokePreviewNodes[i]);}),true);await run(model);
  // A concurrent external attribute change survives cancellation.
  await page.evaluate(({model,id})=>{const group=document.querySelector('iframe').contentDocument.querySelector('[data-rt-stroke-alignment]');window.strokePreview=RetouchSVGStrokeFidelity.previewWeight(group,model,id);strokePreview.update(12);const path=[...group.children[1].children].filter(el=>el.localName==='path').at(-1);path.setAttribute('stroke-width','999');},{model,id});assert.equal(await page.evaluate(()=>strokePreview.current()),false);await page.evaluate(()=>strokePreview.restore());assert.equal(await frame.locator('[data-rt-stroke-alignment] > g:last-child > path').last().getAttribute('stroke-width'),'999');await frame.locator('[data-rt-stroke-alignment]').evaluate((el,html)=>el.innerHTML=html,beforePreview);await run(model);
  for(const [property,values]of [['miterlimit',[1,2.5,8]],['dashoffset',[-12.5,0,12.5]],['fill',['none','#12345678','color(display-p3 1 0.2 0.1 / 0.8)']],['stroke',['none','lime','#12345678']]]){
   await page.evaluate(({model,id,property})=>{const group=document.querySelector('iframe').contentDocument.querySelector('[data-rt-stroke-alignment]');window.strokePreview=RetouchSVGStrokeFidelity.previewProperty(group,model,id,property);},{model,id,property});
   for(const value of values){await page.evaluate(value=>strokePreview.update(value),value);await run({...model,[property]:value,...(['fill','stroke'].includes(property)?{[property+'Opacity']:1}:{})});}
   await page.evaluate(()=>strokePreview.restore());assert.equal(await frame.locator('[data-rt-stroke-alignment]').innerHTML(),beforePreview);await run(model);
  }
  const image=await snapshot();
  const harmless=await frame.addStyleTag({content:'body{font-family:serif;color:orange} clipPath path{fill:lime;stroke:orange;stroke-width:100}'});await run(model);assert.deepEqual(await snapshot(),image);await harmless.evaluate(el=>el.remove());
  const cases=[
   ['[data-rt-stroke-original]{display:inline!important}',/reveals/],
   ['[data-rt-stroke-alignment]{opacity:.5}',/opacity/],
   ['[data-rt-stroke-alignment] > g:last-child > path{fill:lime!important}',/fill/],
   ['[data-rt-stroke-alignment] > g:last-child > path{stroke:purple!important}',/stroke/],
   ['[data-rt-stroke-alignment] > g:last-child > path{stroke-width:33!important}',/stroke-width/],
   ['[data-rt-stroke-alignment] > g:last-child > path{translate:3px 4px}',/translate|coordinate|transform/],
   ['[data-rt-stroke-alignment]{transform:translate(5px,6px)}',/coordinate/],
   ['[data-rt-stroke-alignment] > g:last-child{filter:blur(2px)}',/filter/],
   ['[data-rt-stroke-alignment] > g:last-child > path{marker-start:url(#foreign)}',/marker-start/]
  ];
  if(position==='inside')cases.push(['clipPath path{clip-rule:evenodd}',/clip-rule/]);
  if(position==='outside')cases.push(['mask{mask-type:alpha}',/mask-type/],['mask rect{rx:40px}',/rx/],['mask path{fill:white}',/fill/]);
  if(matrix[1])cases.push(['[data-rt-stroke-alignment] > g:last-child{transform-origin:50px 50px}',/coordinate/]);
  for(const [css,error]of cases){const style=await frame.addStyleTag({content:css});await run(model,error);await style.evaluate(el=>el.remove());await run(model);}
  await frame.locator('[data-rt-stroke-alignment]').evaluate(group=>{const duplicate=group.cloneNode(true);duplicate.setAttribute('data-test-duplicate-group','');group.parentElement.append(duplicate);});await run(model,/rendered once/);await frame.locator('[data-test-duplicate-group]').evaluate(el=>el.remove());
  await frame.locator('[data-rt-stroke-alignment]').evaluate(group=>{group.strokeTestAnimation=group.animate([{opacity:1},{opacity:.5}],{duration:100000});group.strokeTestAnimation.pause();});await run(model,/animation/);await frame.locator('[data-rt-stroke-alignment]').evaluate(group=>{group.strokeTestAnimation.cancel();delete group.strokeTestAnimation;});await run(model);
  await frame.locator('[data-rt-stroke-alignment] > g:last-child > path').last().evaluate(el=>el.setAttribute('pathLength','1'));await run(model,/pathLength/);await frame.locator('[pathLength]').evaluate(el=>el.removeAttribute('pathLength'));
  const original=await frame.locator('[data-rt-stroke-alignment]').innerHTML();
  await frame.locator('[data-rt-stroke-alignment] > g:last-child > path').last().evaluate(el=>el.setAttribute('d','M0 0H10V10H0Z'));await run(model,/attribute/);await frame.locator('[data-rt-stroke-alignment]').evaluate((el,html)=>el.innerHTML=html,original);
  await frame.locator('svg').evaluate((svg,id)=>{const node=svg.ownerDocument.createElementNS(svg.namespaceURI,'path');node.id=id;node.setAttribute('data-test-duplicate','');svg.append(node);},id);await run(model,/identity/);await frame.locator('[data-test-duplicate]').evaluate(el=>el.remove());await run(model);
 }
 console.log(engine+': PASS '+checks+' generated-stroke CSS/identity/transform checks; no authored DOM mutations, reference-node leaks or Paper scopes; benign clip paint verified with unchanged pixels');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
