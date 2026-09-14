'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{patch,css}=require('../src/list-markers.cjs'),{validateChildrenTree}=require('../src/rich-text.cjs');
test('marker patches preserve author HTML and CSS while overriding shorthand and priority',()=>{
 const raw='<UL id="keep" title="a > b" style="color: red; background: url(&quot;a;b&quot;); list-style: square !important;"><li>A</li></UL>';
 const result=patch(raw,'ul','disc');
 assert.ok(result.includes('id="keep" title="a > b"'));assert.ok(result.includes('color: red; background: url(&quot;a;b&quot;); list-style: square !important; list-style-type: disc !important;'));
 assert.equal(patch(result,'ul','disc'),result);
 assert.equal(css('--x: list-style-type: disc;','decimal'),'--x: list-style-type: disc; list-style-type: decimal;');
 assert.ok(css('list-style: square !important;','disc').endsWith('disc !important;'));
 assert.equal(css('--x: {a:1;b:2}; /* ; */ color: red','disc'),'--x: {a:1;b:2}; /* ; */ color: red; list-style-type: disc;');
 for(const raw of ['<ul style="color:red" style="margin:0"></ul>','<ul style="{{ settings.style }}"></ul>','<ul style="color: red; /*"></ul>'])assert.throws(()=>patch(raw,'ul','disc'));
});
test('JSX marker patches retain expressions once and override object spreads',()=>{
 for(const source of ['<ol id="x" style={styles.list}><li>A</li></ol>','<ol style={{listStyleType:"decimal",...appearance}}></ol>','<ol style={{color:"red",...appearance}} />','<ol style={{...appearance, /*keep*/}}></ol>']){
  // Explicit closing tags are the supported rich-text source form.
  const raw=source.replace(' />','></ol>'),out=patch(raw,'ol','lower-alpha',true);
  require('@babel/parser').parseExpression(out,{plugins:['jsx']});assert.ok(out.includes('listStyleType:"lower-alpha"'));assert.equal(patch(out,'ol','lower-alpha',true),out);
  assert.equal((out.match(/appearance|styles.list/g)||[]).length,1);
 }
 assert.throws(()=>patch('<ol {...props}></ol>','ol','decimal',true));
 assert.throws(()=>patch('<ol style="color:red"></ol>','ol','decimal',true));
});
test('marker protocol rejects non-list sources and unbounded CSS',()=>{
 const keep={t:'keep',id:'0123456789',marker:'disc'};
 assert.match(validateChildrenTree([keep],0,false,0,()=> 'span'),/marker/);
 assert.equal(validateChildrenTree([keep],0,false,0,()=> 'ul'),null);
 assert.match(validateChildrenTree([{...keep,marker:'url(x)'}],0,false,0,()=> 'ul'),/marker/);
 assert.throws(()=>patch('<div></div>','div','disc'));
});
