'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs');
for(const kind of ['html','react','liquid']){
 const adapter=require('../src/adapters/'+kind+'.cjs'),wrap=s=>kind==='react'?'export default()=>('+s+');':s,original=wrap('<svg><rect fill="red" width="40"/><circle r="10"/></svg>');
 const resolve=source=>{const relPath=kind==='react'?'page.jsx':kind==='html'?'index.html':'main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(el=>(kind==='react'?ids.jsxElementName(el.node):el.tag)==='rect'),file:'/tmp/'+relPath,hash:ids.contentHash(source)};};
 const create=(source,extra={})=>{const r=resolve(source);return adapter.planOp(r,{type:'setSVGGradient',paint:'fill',fileHash:r.hash,action:'create',value:{type:'linearGradient',color:'#ff0000'},...extra});};
 test(kind+' creates fill/stroke gradients from solid paint without changing existing identities',()=>{
  for(const paint of ['fill','stroke'])for(const type of ['linearGradient','radialGradient']){const result=create(original,{paint,value:{type,color:'rgb(255, 0, 0)'}});assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,r=resolve(after),g=adapter.describe(r).svgGradients[0];assert.equal(g.type,type);assert.equal(g.paint,paint);assert.deepEqual(g.stops,[{offset:'0',color:'rgb(255, 0, 0)',opacity:null},{offset:'1',color:'rgb(255, 0, 0)',opacity:'0'}]);assert.equal(r.element.id,resolve(original).element.id);assert.ok(after.includes('<circle r="10"/>'));assert.equal(create(after,{paint}).refused,true);}
 });
 test(kind+' creation rejects stale, dynamic, styled and invalid values',()=>{
  for(const extra of [{fileHash:'stale'},{paint:'color'},{stop:0},{changes:{x1:'0'}},{value:{type:'conicGradient',color:'red'}},{value:{type:'linearGradient',color:'red" onclick="x'}}])assert.equal(create(original,extra).refused,true);
  assert.equal(create(original.replace('fill="red"','style="fill:red"')).refused,true);assert.equal(create(original.replace('fill="red"','class="fill-red"')).refused,true);
 });
 test(kind+' creation preserves unrelated classes and distinguishes fill from stroke utilities',()=>{
  const name=kind==='react'?'className':'class',source=original.replace('<rect ','<rect '+name+'="layout-marker opacity-50 stroke-2" '),result=create(source);assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(name+'="layout-marker opacity-50 stroke-2"'));
  for(const token of ['fill-red-500','md:fill-red-500','hover:!fill-current','[&:hover]:[fill:blue]']){const source=original.replace('<rect ','<rect '+name+'="'+token+'" ');assert.equal(create(source).refused,true);const stroke=create(source,{paint:'stroke'});assert.equal(stroke.ok,true,stroke.reason);}
 });
 test(kind+' creation appends into the nearest nested SVG and preserves siblings',()=>{const source=wrap('<svg><svg><rect/></svg><circle r="10"/></svg>'),result=create(source);assert.equal(result.ok,true,result.reason);assert.match(result.edits[0].after,/<\/defs><\/svg><circle/);});
 test(kind+' creation preserves unrelated inline styles and guards paint ownership independently',()=>{
  const styles=kind==='react'?['style={{opacity:0.8,strokeWidth:3}}','style={{fill:null,stroke:"",opacity:0.5}}','style={null}']:['style="opacity:.8;stroke-width:3px"',`style="--note:'fill:red;stroke:blue';opacity:calc(1 - .2)"`,'style="/* fill:red */ opacity:.8;--tokens:{fill:red;stroke:blue}"'];
  for(const style of styles)for(const paint of ['fill','stroke']){const result=create(original.replace('<rect ','<rect '+style+' '),{paint});assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(style));}
  for(const paint of ['fill','stroke'])for(const style of kind==='react'?['style={{'+paint+':"red",opacity:.8}}']:['style="'+paint+':red;opacity:.8"','style="'+(paint==='fill'?'\\66 ill':'\\73 troke')+':red"']){
   const source=original.replace('<rect ','<rect '+style+' '),description=adapter.describe(resolve(source)).svgGradientCreation;assert.equal(description.reason,null);assert.match(description.paintReasons[paint],/Inline styles/);assert.equal(create(source,{paint}).refused,true);const other=paint==='fill'?'stroke':'fill',result=create(source,{paint:other});assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(style));
  }
  const all=kind==='react'?'style={{all:"inherit"}}':'style="all:inherit"';for(const paint of ['fill','stroke'])assert.equal(create(original.replace('<rect ','<rect '+all+' '),{paint}).refused,true);
 });
 test(kind+' creation refuses dynamic or malformed inline styles',()=>{
  const styles=kind==='react'?['style={styles}','style={{...styles}}','style={{[key]:"red"}}','style={{get fill(){return "red"}}}']:['style="opacity:calc(1"','style="opacity:.5;fill"','style="opacity:.5;/*"'];
  for(const style of styles)assert.equal(create(original.replace('<rect ','<rect '+style+' ')).refused,true,style);
 });
 if(kind==='react'){
  test('react creation preserves event handlers and dynamic non-paint attributes',()=>{
   for(const attributes of ['onClick={() => onSelect(id)}','width={size} x={position.x} aria-label={label}','ref={shapeRef} tabIndex={active ? 0 : -1}']){
    const source=original.replace('width="40"',attributes),result=create(source);assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(attributes));assert.equal(resolve(result.edits[0].after).element.id,resolve(source).element.id);
   }
  });
  test('react dynamic paint protects its own property while allowing independent paint',()=>{
   for(const paint of ['fill','stroke']){const source=original.replace('fill="red"',paint+'={paintColor}'),r=resolve(source),description=adapter.describe(r).svgGradientCreation;assert.equal(description.reason,null);assert.match(description.paintReasons[paint],/dynamic expression/);assert.equal(create(source,{paint}).refused,true);const other=paint==='fill'?'stroke':'fill',result=create(source,{paint:other});assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(paint+'={paintColor}'));}
  });
  test('react creation preserves dynamic unrelated styles and guards dynamic paint by property',()=>{
   for(const style of ['style={{opacity:active?.8:.5,strokeWidth:weight}}','style={{transform:position(),filter:filters.join(" ")}}']){
    const source=original.replace('<rect ','<rect '+style+' '),result=create(source);assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(style));
   }
   for(const paint of ['fill','stroke']){
    const style='style={{'+paint+':paintColor,opacity:active?.8:.5}}',source=original.replace('<rect ','<rect '+style+' '),description=adapter.describe(resolve(source)).svgGradientCreation;
    assert.equal(description.reason,null);assert.match(description.paintReasons[paint],/Inline styles/);assert.equal(create(source,{paint}).refused,true);
    const result=create(source,{paint:paint==='fill'?'stroke':'fill'});assert.equal(result.ok,true,result.reason);assert.ok(result.edits[0].after.includes(style));
   }
   assert.equal(create(original.replace('<rect ','<rect style={{all:reset}} ')).refused,true);
  });
  test('react creation still refuses unresolved classes, spreads and dynamic markup',()=>{
   for(const attributes of ['className={classes}','class={classes}','{...props}','dangerouslySetInnerHTML={{__html:markup}}'])assert.equal(create(original.replace('<rect ','<rect '+attributes+' ')).refused,true,attributes);
  });
 }
}
