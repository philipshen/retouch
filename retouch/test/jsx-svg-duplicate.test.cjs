'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs'),react=require('../src/adapters/react.cjs');
function resolve(source,tag='rect'){const elements=ids.collectElements(source,'app/page.jsx').elements;return {source,elements,element:elements.find(e=>ids.jsxElementName(e.node)===tag),hash:ids.contentHash(source),relPath:'app/page.jsx',file:'/tmp/page.jsx'};}
test('React SVG duplication copies exact literal subtrees with distinct source identities',()=>{
 const source='export default()=> <main><svg viewBox="0 0 100 100"><g>{/* shape */}<rect x={-5} width={20} className="[fill:red] md:[fill:blue]"/></g><circle r={10}/></svg></main>';
 for(const tag of ['rect','g','svg']){const r=resolve(source,tag),result=react.planOp(r,{type:'duplicateElement',fileHash:r.hash});assert.equal(result.ok,true,result.reason);const {start,end}=r.element.node;assert.equal(result.edits[0].after,source.slice(0,end)+source.slice(start,end)+source.slice(end));const fresh=ids.collectElements(result.edits[0].after,r.relPath).elements;assert.notEqual(result.createdId,r.element.id);assert.equal(ids.jsxElementName(fresh.find(e=>e.id===result.createdId).node),tag);assert.equal(new Set(fresh.map(e=>e.id)).size,fresh.length);assert.equal(react.describe(r).structure.canCopy,false);}
});
test('React SVG duplication protects authored identity, dynamic expressions and unsupported descendants',()=>{
 for(const child of ['<rect id="a"/>','<rect key="a"/>','<rect ref={ref}/>','<rect {...props}/>','<rect width={size}/>','<rect className={classes}/>','<Icon/>','{shown && <rect/>}']){const r=resolve('export default()=> <svg><g>'+child+'</g></svg>','g');assert.equal(react.describe(r).structure.canDuplicate,false);assert.equal(react.planOp(r,{type:'duplicateElement',fileHash:r.hash}).refused,true);}
 const r=resolve('export default()=> <svg><rect/></svg>');for(const fileHash of [undefined,'stale'])assert.equal(react.planOp(r,{type:'duplicateElement',fileHash}).refused,true);
});

test('Existing generic literal SVG duplication remains available outside the specialized subtree vocabulary',()=>{
 const r=resolve('export default()=> <main><svg><foreignObject><div>Hello</div></foreignObject></svg></main>','svg');assert.equal(react.describe(r).svgDuplication,null);assert.equal(react.describe(r).structure.canDuplicate,true);assert.equal(react.describe(r).structure.canCopy,true);assert.equal(react.planOp(r,{type:'duplicateElement',fileHash:r.hash}).ok,true);
});

test('SVG duplication maps originals without assigning their identities to copies',()=>{
 const markup='<main><svg><rect/><g><circle/><ellipse/></g><line/></svg><p>After</p></main>',source='export default()=>'+markup;
 for(const tag of ['rect','g','svg']){
  const r=resolve(source,tag),result=react.planOp(r,{type:'duplicateElement',fileHash:r.hash});assert.equal(result.ok,true,result.reason);
  const fresh=ids.collectElements(result.edits[0].after,r.relPath).elements,mapping=new Map(result.sourceIdMap),originalIds=r.elements.map(e=>mapping.get(e.id)||e.id);assert.equal(new Set(originalIds).size,r.elements.length);assert.ok(!originalIds.includes(result.createdId));
  for(const element of r.elements){const next=fresh.find(e=>e.id===(mapping.get(element.id)||element.id));assert.ok(next);assert.equal(ids.jsxElementName(next.node),ids.jsxElementName(element.node));}
 }
});
