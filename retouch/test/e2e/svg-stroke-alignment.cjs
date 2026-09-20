'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),G=require('../../shell/svg-path.js'),S=require('../../shell/svg-stroke-alignment.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium',sharp=require(process.env.RT_E2E_SHARP_ROOT||path.join(fixture,'node_modules/sharp'));
const sourceKind=process.env.RT_STROKE_SOURCE;
async function retainedMarkup(model){
 const adapter=require('../../src/adapters/'+sourceKind+'.cjs'),sourceModule=require('../../src/svg-stroke-source.cjs'),{view}=require('../../src/svg-boolean-group.cjs'),A=require('../../shell/svg-affine.js');
 const relPath='art.'+(sourceKind==='react'?'jsx':sourceKind==='liquid'?'liquid':'html');
 const original='<svg><path d="'+G.serializeCompound(model.document)+'" transform="'+A.format(model.matrix)+'" fill="#ff0000" stroke="#0000ff"/></svg>';
 const source=sourceKind==='react'?'export default function Art(){return '+original+'}':original;
 const r={source,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(source),elements:adapter.collect(source,relPath).elements};
 const v=view(r,sourceKind);r.element=r.elements.find(e=>v.tag(e)==='path');
 const planned=sourceModule.plan(r,{type:'createSVGStrokeSource',fileHash:r.hash,model:{...model,position:model.position==='center'?'inside':'center'}},sourceKind);assert.ok(planned.ok,planned.reason);
 const created=planned.edits[0].after,elements=adapter.collect(created,relPath).elements,retained={...r,source:created,hash:adapter.contentHash(created),elements,element:elements.find(e=>e.id===planned.selectionIds[0])};
 const changed=sourceModule.plan(retained,{type:'setSVGStrokeSourcePosition',fileHash:retained.hash,position:model.position},sourceKind);assert.ok(changed.ok,changed.reason);
 let rendered=changed.edits[0].after;
 const finalElements=adapter.collect(rendered,relPath).elements,final={...r,source:rendered,hash:adapter.contentHash(rendered),elements:finalElements,element:finalElements.find(e=>e.id===changed.selectionIds[0])};
 const restored=sourceModule.plan(final,{type:'restoreSVGStrokeSource',fileHash:final.hash},sourceKind);assert.ok(restored.ok,restored.reason);assert.equal(restored.edits[0].after,source);
 if(sourceKind==='react'){
  const root=process.env.RT_STROKE_REACT_FIXTURE||fixture,React=require(path.join(root,'node_modules/react')),server=require(path.join(root,'node_modules/react-dom/server'));
  const code=require(path.join(root,'node_modules/esbuild')).transformSync(rendered,{loader:'jsx',format:'cjs',jsx:'transform'}).code,module={exports:{}};
  new Function('module','exports','React',code)(module,module.exports,React);
  const errors=[],previous=console.error;console.error=(...args)=>errors.push(args.join(' '));
  try{rendered=server.renderToStaticMarkup(React.createElement(module.exports.default));}finally{console.error=previous;}
  assert.deepEqual(errors,[],'React must render retained stroke markup without invalid attribute warnings');
 }else if(sourceKind==='liquid')rendered=await new(require('liquidjs').Liquid)().parseAndRender(rendered);
 if(model.position==='outside')assert.ok(rendered.includes('mask-type="luminance"'));
 assert.ok(rendered.startsWith('<svg>')&&rendered.endsWith('</svg>'));return rendered.slice(5,-6);
}
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();let checks=0;try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shapes=[['rectangle','M20 20H80V80H20Z','nonzero'],['circle','M20 50A30 30 0 1 1 80 50A30 30 0 1 1 20 50Z','nonzero'],['rounded','M30 20H70Q80 20 80 30V70Q80 80 70 80H30Q20 80 20 70V30Q20 20 30 20Z','nonzero'],['hole','M20 20H80V80H20Z M40 40H60V60H40Z','evenodd'],['winding-hole','M20 20H80V80H20Z M40 40V60H60V40Z','nonzero']];
 const colors={white:[255,255,255],red:[255,0,0],blue:[0,0,255]},samples={inside:[[10,'white'],[14,'white'],[18,'white'],[22,'blue'],[26,'blue'],[30,'red']],center:[[10,'white'],[14,'white'],[18,'blue'],[22,'blue'],[26,'red'],[30,'red']],outside:[[10,'white'],[14,'blue'],[18,'blue'],[22,'red'],[26,'red'],[30,'red']]};
 for(const [name,data,fillRule]of shapes)for(const position of ['inside','center','outside'])for(const matrix of [[1,0,0,1,0,0],[.75,0,0,1.1,10,-5],[.8,.2,-.2,.8,20,0]])for(const scale of [2,3]){
  const model={document:G.parseCompound(data),width:8,position,fillRule,matrix,fill:'#ff0000',stroke:'#0000ff'},before=JSON.stringify(model),markup=sourceKind?await retainedMarkup(model):S.render(model,'rt-stroke-0123456789abcdef');assert.equal(JSON.stringify(model),before);
  await page.setContent('<style>body{margin:0;background:white}svg{display:block}</style><svg xmlns="http://www.w3.org/2000/svg" width="'+100*scale+'" height="'+100*scale+'" viewBox="0 0 100 100">'+markup+'</svg>');
  const {data:pixels,info}=await sharp(await page.locator('svg').screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const check=(x,y,color)=>{const px=Math.floor((matrix[0]*x+matrix[2]*y+matrix[4])*scale),py=Math.floor((matrix[1]*x+matrix[3]*y+matrix[5])*scale),actual=[...pixels.subarray((py*info.width+px)*3,(py*info.width+px)*3+3)],expected=colors[color];checks++;assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<=6),JSON.stringify({name,position,matrix,scale,x,y,actual,expected}));};
  for(const [x,color]of samples[position])check(x,50,color);
  if(name.includes('hole'))for(const [x,color]of position==='inside'?[[38,'blue'],[42,'white'],[46,'white'],[50,'white']]:position==='center'?[[38,'blue'],[42,'blue'],[46,'white'],[50,'white']]:[[38,'red'],[42,'blue'],[46,'blue'],[50,'white']])check(x,50,color);
 }
 assert.deepEqual(errors,[]);console.log(engine+(sourceKind?' '+sourceKind+' retained source':'')+': PASS '+checks+' stroke alignment pixel checks across rectangles, arcs, rounded curves, evenodd/nonzero holes, affine transforms and viewBox scales');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
