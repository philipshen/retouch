'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{valid,patch}=require('../src/list-inset.cjs'),rich=require('../src/rich-text.cjs'),source=require('../src/rich-text-source.cjs');
test('list inset preserves CSS declarations and honors padding shorthand priority',()=>{
 const raw='<ol id="kept" style="color:red;padding:2em !important;--data: {a:b;c:d};"><li>Text</li></ol>';
 const result=patch(raw,'ol',96);assert.ok(result.includes('color:red;padding:2em !important;--data: {a:b;c:d};'));assert.match(result,/padding-inline-start: 96px !important;/);assert.equal(patch(result,'ol',96),result);const next=patch(result,'ol',0);assert.equal((next.match(/padding-inline-start/g)||[]).length,1);assert.match(next,/padding-inline-start: 0px !important;/);
 for(const value of [-1,NaN,Infinity,10001,null,'4']){assert.equal(valid(value),false);assert.throws(()=>patch(raw,'ol',value));assert.ok(rich.validateChildrenTree([{t:'block',tag:'ol',listInset:value,children:[]}],0));}
 assert.throws(()=>patch('<li>Text</li>','li',12));assert.throws(()=>patch('<ol style="{{ settings.style }}"></ol>','ol',12));
});
test('list inset JSX patches retain expressions once and do not remove marker overrides',()=>{
 for(const raw of ['<ol style={appearance}></ol>','<ol style={{paddingInlineStart:12,...appearance}}></ol>','<ol style={{paddingInlineStart:12,padding:48,color:appearance}}></ol>']){const result=patch(raw,'ol',24,true);assert.equal((result.match(/appearance/g)||[]).length,1);assert.ok(result.includes('paddingInlineStart:"24px"'));require('@babel/parser').parseExpression(result,{plugins:['jsx']});assert.equal(patch(result,'ol',24,true),result);}
 assert.throws(()=>patch('<ol style={{color:"red"}} {...props}></ol>','ol',24,true));
 const html=patch('<ol style="list-style-type: decimal;"></ol>','ol',48);assert.ok(html.includes('list-style-type: decimal;'));assert.ok(html.includes('padding-inline-start: 48px;'));
});
test('new and preserved list inset serializes through source with placement validation',()=>{
 const raw='<ol class="kept"><li>Text</li></ol>',list=source.describe(raw,'inset').descriptor.children[0];
 const result=source.rewrite(raw,'inset',[{t:'keep',id:list.id,listInset:120}],{parentTag:'div'});assert.match(result,/class="kept" style="padding-inline-start: 120px;"/);
 const node={t:'block',tag:'ul',listInset:12.5,children:[{t:'block',tag:'li',children:[{t:'text',value:'New'}]}]};assert.equal(rich.validateChildrenTree([node],0),null);assert.match(source.rewrite('Text','inset',[node],{parentTag:'div'}),/padding-inline-start: 12.5px;/);
 assert.ok(rich.validateChildrenTree([{t:'keep',id:list.id,listInset:10}],0,false,0,()=> 'li'));
});
