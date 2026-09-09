'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),geometry=require('../src/svg-geometry.cjs');
const source='<html><head></head><body><svg viewBox="0 0 200 100"><g><rect x="5" width="40" height="20"/><circle cx="100" cy="50" r="10"/><ellipse rx="10" ry="5"/><line x1="0" y1="0" x2="10" y2="20"/></g><defs><circle id="definition" r="3"/></defs></svg><p>After</p></body></html>';
function resolve(text=source,tag='rect'){const elements=html.collect(text,'index.html').elements;return {source:text,elements,element:elements.find(e=>e.tag===tag),hash:html.contentHash(text),file:'/tmp/index.html',relPath:'index.html'};}
test('Inline SVG shapes receive stable source identities and served stamps without indexing definitions',()=>{
 const r=resolve();assert.deepEqual(r.elements.filter(e=>e.node.namespaceURI==='http://www.w3.org/2000/svg').map(e=>e.tag),['svg','g','rect','circle','ellipse','line']);
 const stamped=html.stamp(source,'/tmp/index.html','/tmp').code;assert.match(stamped,/<rect data-rt="[a-f0-9]{10}"/);assert.ok(stamped.includes('<circle id="definition" r="3"/>'));assert.equal(html.describe(r).textDynamic,true);
 const without=resolve(source.replace(/<svg[\s\S]*<\/svg>/,'<svg></svg>'));assert.equal(r.elements.find(e=>e.tag==='p').id,without.elements.find(e=>e.tag==='p').id);
});
test('SVG geometry edits and resets preserve the rest of the document and source IDs',()=>{
 for(const [tag,property,value]of [['rect','width','75'],['circle','r','20%'],['ellipse','rx','12px'],['line','x1','-10']]){
  const r=resolve(source,tag),result=geometry.plan(r,{property,value,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);const fresh=resolve(result.edits[0].after,tag);assert.deepEqual(fresh.elements.map(e=>e.id),r.elements.map(e=>e.id));assert.equal(geometry.describe(fresh.element).fields.find(f=>f.name===property).value,value);assert.ok(fresh.source.includes('<p>After</p>'));
  const reset=geometry.plan(fresh,{property,value:null,fileHash:fresh.hash});assert.equal(reset.ok,true);assert.equal(geometry.describe(resolve(reset.edits[0].after,tag).element).fields.find(f=>f.name===property).value,null);
 }
});
test('SVG geometry refuses stale, unsupported, negative sizes and injected values atomically',()=>{
 const r=resolve();for(const op of [{property:'width',value:'-1'},{property:'onclick',value:'1'},{property:'width',value:'1" onload="x'},{property:'width',value:'calc(1)'},{property:'width',value:'100001'},{property:'width',value:'10',fileHash:'stale'}]){const result=geometry.plan(r,{fileHash:r.hash,...op});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
});

test('SVG paint uses isolated responsive CSS, preserving original attributes and reset inheritance',()=>{
 const css=require('../src/html-css.cjs');let r=resolve(source.replace('x="5"','fill="red" x="5"'));
 const change=(width,changes)=>{const result=css.plan(r,{fileHash:r.hash,width,changes});assert.equal(result.ok,true,result.reason);r=resolve(result.edits[0].after);};
 change(0,{fill:'#112233',stroke:'blue','stroke-width':'4','stroke-linecap':'round','stroke-linejoin':'bevel','stroke-dasharray':'4 2'});
 change(768,{fill:'none','stroke-width':'8px'});
 assert.equal(r.element.node.attrs.find(a=>a.name==='fill').value,'red');
 assert.equal(css.describe(r).cssRules[0].fill,'#112233');assert.equal(css.describe(r).cssRules[768].fill,'none');
 change(768,{fill:null});assert.deepEqual(css.describe(r).cssRules[768],{'stroke-width':'8px'});
 assert.deepEqual(r.elements.map(e=>e.id),resolve().elements.map(e=>e.id));
 const important=resolve(source.replace('x="5"','style="stroke: black !important" x="5"'));
 assert.equal(css.plan(important,{width:0,property:'stroke',value:'red'}).refused,true);
 assert.equal(css.plan(important,{width:0,property:'fill',value:'red'}).ok,true);
});
test('SVG paint rejects invalid lengths, line styles, references and declaration injection',()=>{
 const {valid}=require('../src/html-css.cjs');
 for(const [p,v]of [['fill','none'],['fill','#1234'],['stroke','currentColor'],['stroke-width','0'],['stroke-width','2.5%'],['stroke-dasharray','2, 4px, 6%'],['stroke-linecap','square'],['stroke-linejoin','bevel']])assert.equal(valid(p,v),true,p+' '+v);
 for(const [p,v]of [['stroke','url(https://example.com/a.svg)'],['fill','red;stroke:blue'],['stroke-width','-1'],['stroke-width','100001'],['stroke-width','1 2'],['stroke-dasharray','1,,2'],['stroke-dasharray','1,'],['stroke-dasharray','-2 4'],['stroke-linecap','triangle'],['stroke-linejoin','curve']])assert.equal(valid(p,v),false,p+' '+v);
});
