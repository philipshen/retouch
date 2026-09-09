'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs'),react=require('../src/adapters/react.cjs');
function resolve(source,tag='rect'){const elements=ids.collectElements(source,'app/page.jsx').elements;return {source,elements,element:elements.find(e=>ids.jsxElementName(e.node)===tag),hash:ids.contentHash(source),relPath:'app/page.jsx',file:'/tmp/page.jsx'};}
test('React SVG geometry edits literal JSX values and preserves surrounding source and IDs',()=>{
 for(const [tag,attr,value]of [['rect','x','-10'],['circle','r','20'],['ellipse','rx','25%'],['line','x2','80px']]){
  const source='export default()=> <svg viewBox="0 0 200 100"><'+tag+' '+attr+'={-5} fill="red" /></svg>;',r=resolve(source,tag),op={type:'setSVGGeometry',property:attr,value,fileHash:r.hash};assert.ok(react.describe(r).svgGeometry.fields.find(f=>f.name===attr).editable);const result=react.planOp(r,op);assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,source.replace(attr+'={-5}',attr+'="'+value+'"'));
  const reset=react.planOp(r,{...op,value:null});assert.equal(reset.ok,true);assert.equal(reset.edits[0].after,source.replace(attr+'={-5}',''));
 }
});
test('React SVG geometry refuses dynamic expressions, spreads, foreignObject and stale or unsafe values',()=>{
 for(const attrs of ['x={position}','x={getX()}','{...props}','x="1" x="2"']){const r=resolve('export default()=> <svg><rect '+attrs+'/></svg>');const result=react.planOp(r,{type:'setSVGGeometry',property:'x',value:'10',fileHash:r.hash});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 for(const source of ['export default()=> <rect/>','export default()=> <svg><foreignObject><rect/></foreignObject></svg>']){assert.equal(react.describe(resolve(source)).svgGeometry,null);}
 const r=resolve('export default()=> <svg><rect width={20}/></svg>');for(const op of [{value:'-1',fileHash:r.hash},{value:'" onload="x',fileHash:r.hash},{value:'20'},{value:'20',fileHash:'stale'}])assert.equal(react.planOp(r,{type:'setSVGGeometry',property:'width',...op}).refused,true);
 const ok=react.planOp(r,{type:'setSVGGeometry',property:'height',value:'40',fileHash:r.hash});assert.equal(ok.ok,true);assert.match(ok.edits[0].after,/<rect height="40" width=\{20\}/);
});
