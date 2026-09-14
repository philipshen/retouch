'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0}svg{display:block}</style><svg id="outer" width="400" height="240"><g transform="translate(3 7)"><rect id="box" x="10%" y="15%" width="40%" height="60%" rx="5%" ry="8%"/><circle id="circle" cx="50%" cy="45%" r="20%"/><ellipse id="ellipse" cx="65%" cy="40%" rx="20%" ry="10%"/><rect id="calculated" style="x:calc(10% + 3px);y:calc(5% + 2px);width:calc(45% - 7px);height:calc(60% - 5px);rx:calc(3% + 2px);ry:calc(5% + 1px)"/><rect id="sharp" x="5%" y="5%" width="30%" height="40%" rx="0" ry="10%"/></g><svg x="30" y="20" width="60%" height="70%" viewBox="-10 -20 200 100"><g transform="scale(.8 1.1)"><circle id="nested-circle" cx="45%" cy="50%" r="20%"/><ellipse id="auto-radius" cx="60%" cy="45%" rx="15%"/><rect id="auto-corner" x="0" y="0" width="60%" height="50%" ry="8%"/></g></svg></svg>');
 for(const file of [require.resolve('paper/dist/paper-core.min.js'),...['svg-affine.js','svg-path.js','svg-boolean.js','svg-resize.js','svg-boolean-selection.js'].map(f=>path.resolve(__dirname,'../../shell',f))])await page.addScriptTag({path:file});
 const result=await page.evaluate(()=>{
  const fields={rect:['x','y','width','height','rx','ry'],circle:['cx','cy','r'],ellipse:['cx','cy','rx','ry']},info=el=>({id:el.id,file:'test.html',hash:'same',svgGeometry:{fields:fields[el.localName].map(name=>({name,value:el.getAttribute(name)}))},svgTransform:{editable:true,value:el.getAttribute('transform'),matrix:RetouchSVGAffine.parse(el.getAttribute('transform'))}}),svg=document.querySelector('#outer'),failures=[];let checks=0;
  const output=document.createElementNS(svg.namespaceURI,'path');
  for(const [width,height]of [[400,240],[700,330],[240,500]]){
   svg.setAttribute('width',width);svg.setAttribute('height',height);
   for(const el of svg.querySelectorAll('rect,circle,ellipse')){
    const before=svg.innerHTML,document=RetouchSVGBooleanSelection.renderedPath(el,info(el));if(!document)throw Error('No geometry: '+el.id);if(svg.innerHTML!==before)throw Error('Measurement changed source DOM');output.setAttribute('d',RetouchSVGPath.serializeCompound(document));svg.append(output);
    const a=el.getBBox(),b=output.getBBox();for(const key of ['x','y','width','height'])if(Math.abs(a[key]-b[key])>.002)failures.push({id:el.id,width,height,key,expected:a[key],actual:b[key]});
    for(let x=0;x<21;x++)for(let y=0;y<21;y++){const p=new DOMPoint(a.x+(x+.31)*a.width/21,a.y+(y+.27)*a.height/21);checks++;if(el.isPointInFill(p)!==output.isPointInFill(p))failures.push({id:el.id,width,height,x,y});}output.remove();
   }
   const members=[document.querySelector('#box'),document.querySelector('#circle')],infos=members.map(info),base=members[0].getScreenCTM();
   for(const [operation,expected]of Object.entries({union:(a,b)=>a||b,subtract:(a,b)=>a&&!b,intersect:(a,b)=>a&&b,exclude:(a,b)=>a!==b})){
    const before=svg.innerHTML,d=RetouchSVGBooleanSelection.prepare(infos,members,operation);if(svg.innerHTML!==before)throw Error('Boolean capture changed original DOM');output.setAttribute('d',d);svg.append(output);
    for(let x=0;x<17;x++)for(let y=0;y<17;y++){const p=new DOMPoint((x+.37)*width/17,(y+.19)*height/17),screen=p.matrixTransform(base),a=members[0].isPointInFill(screen.matrixTransform(members[0].getScreenCTM().inverse())),b=members[1].isPointInFill(screen.matrixTransform(members[1].getScreenCTM().inverse()));checks++;if(output.isPointInFill(p)!==expected(a,b))failures.push({operation,width,height,x,y});}output.remove();
   }
  }
  const override=document.createElement('style');override.textContent='path{d:path("M0 0L1 0L0 1Z")}';document.head.append(override);const members=[document.querySelector('#box'),document.querySelector('#circle')],before=svg.innerHTML;let refused=false;
  try{RetouchSVGBooleanSelection.prepare(members.map(info),members,'union');}catch(error){refused=/CSS overrides/.test(error.message);}finally{override.remove();}if(refused!==CSS.supports('d','path("M0 0L1 0L0 1Z")'))throw Error('CSS path override handling disagrees with browser support');if(svg.innerHTML!==before)throw Error('Refusal changed original DOM');
  return {checks,failures};
 });assert.deepEqual(result.failures,[]);assert.ok(result.checks>10000);assert.deepEqual(errors,[]);console.log(engine+': PASS '+result.checks+' responsive SVG fill checks, nested viewports, percentage radii, calculated geometry, auto/zero corners, all four booleans and original DOM preservation');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
