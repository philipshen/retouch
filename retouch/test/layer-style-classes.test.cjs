'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{compose,properties}=require('../src/layer-style-classes.cjs');
test('resolved class paste composes all clipboard groups while retaining other screens and custom classes',()=>{
 const changes={opacity:'.6','background-color':'rgb(20, 30, 40)','background-image':'none','border-color':'red','border-width':'1px 2px','border-style':'solid','border-radius':'10px 20px / 30px','box-shadow':'none',filter:'blur(2px)','backdrop-filter':'none','mix-blend-mode':'multiply',isolation:'isolate',color:'blue','font-family':'Arial, sans-serif','font-size':'24px','font-weight':'700','font-style':'italic','line-height':'32px','letter-spacing':'normal','text-align':'center','text-decoration-line':'underline','text-transform':'uppercase',display:'flex','flex-direction':'row-reverse','flex-wrap':'wrap','justify-content':'space-between','align-items':'center',gap:'10px 20px',padding:'12px 18px',width:'300px',height:'auto'};
 assert.deepEqual(Object.keys(changes).sort(),[...properties].sort());
 const source='custom-card p-4 text-red-500 md:text-blue-500 min-[1440px]:text-sm/6 hover:opacity-50';
 const result=compose(source,changes,'min-[1440px]:');assert.ok(result.includes('custom-card p-4 text-red-500 md:text-blue-500'));assert.ok(result.includes('hover:opacity-50'));assert.ok(!result.includes('min-[1440px]:text-sm/6'));assert.ok(result.includes('min-[1440px]:![padding:12px_18px]'));assert.ok(result.includes('min-[1440px]:![border-radius:10px_20px_/_30px]'));assert.equal(compose(result,changes,'min-[1440px]:'),result);
});
test('partial typography paste preserves the other half of combined leading utilities',()=>{
 const result=compose('text-lg/8 md:text-xl/10 keep',{ 'font-size':'24px'});assert.ok(result.includes('leading-8'));assert.ok(!result.split(' ').includes('text-lg/8'));assert.ok(result.includes('md:text-xl/10'));assert.ok(result.includes('![font-size:24px]'));
});
test('class paste refuses ambiguous important ownership and unrepresentable source values',()=>{
 for(const [classes,changes]of [['!p-4',{padding:'20px'}],['![flex-flow:row_wrap]',{'flex-direction':'column'}],['!size-20',{width:'300px'}],['![all:unset]',{color:'red'}],['!ring-2',{'box-shadow':'none'}],['![font:italic_12px_serif]',{'font-size':'24px'}],['',{position:'fixed'}],['',{opacity:'.5;display:none'}],['',{'background-image':'url(https://example.com/my_image.png)'}]])assert.throws(()=>compose(classes,changes));
 assert.ok(compose('md:!p-4',{padding:'20px'}).includes('md:!p-4'));assert.ok(compose('![padding:10px]',{padding:'20px'}).includes('![padding:20px]'));
});
test('replacing effects clears hidden effect metadata without disturbing unselected styles',()=>{
 const result=compose('![--rt-hidden-shadows:0_2px_4px_black] ![box-shadow:none] keep',{'box-shadow':'0px 1px 2px black'});assert.ok(!result.includes('--rt-hidden-shadows:0'));assert.ok(result.includes('![--rt-hidden-shadows:none]'));assert.ok(result.includes('keep'));assert.ok(result.includes('![box-shadow:0px_1px_2px_black]'));
});
test('pasted resolved fill replaces hidden target paint instead of remaining invisible',()=>{
 const key=require('../shell/html-css-values.js').hiddenBackgroundProperty,result=compose('!['+key+':#ff0000] ![background-color:#ff000000]',{'background-color':'blue'});assert.ok(result.includes('!['+key+':none]'));assert.ok(result.includes('![background-color:blue]'));assert.ok(!result.includes('#ff0000'));
});
