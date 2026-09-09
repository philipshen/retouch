'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
const original='<html><head><style>.title{color:red}</style></head><body><h1 class="title">First</h1><h1 class="title">Second</h1></body></html>';
function resolve(source){return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='h1')};}
function edit(source,width,value,property='width'){return css.plan(resolve(source),{width,value,property});}
test('HTML CSS stores isolated rules in ascending breakpoint order and resets individual properties',()=>{
 let source=edit(original,768,'320px').edits[0].after;
 source=edit(source,0,'240px').edits[0].after;
 assert.ok(source.indexOf('data-rt-width="0"')<source.indexOf('data-rt-width="768"'));
 assert.ok(source.includes('<style>.title{color:red}</style>'));
 assert.ok(source.includes('<h1 class="title">Second</h1>'));
 assert.equal((source.match(/data-rt-style="[a-f0-9]+" class=/g)||[]).length,1);
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{width:'240px'},768:{width:'320px'}});
 source=edit(source,768,'red','color').edits[0].after;
 source=edit(source,768,null).edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{width:'240px'},768:{color:'red'}});
 source=edit(source,768,null,'color').edits[0].after;
 assert.ok(!source.includes('data-rt-width="768"'));
 assert.deepEqual(html.collect(source,'index.html').elements.map(e=>e.id),html.collect(original,'index.html').elements.map(e=>e.id));
});
test('HTML CSS refuses injection, stale writes, conflicting identities and modified managed CSS',()=>{
 for(const value of ['2px;color:red','</style>','url(https://example.com)','var(--x)'])assert.equal(edit(original,0,value).refused,true);
 assert.equal(css.plan(resolve(original),{width:0,value:'2px',property:'width',fileHash:'stale'}).refused,true);
 assert.equal(edit(original.replace('class="title"','style="width: 3px !important"'),0,'4px').refused,true);
 const source=edit(original,0,'240px').edits[0].after;
 assert.equal(edit(source.replace('width:240px','width:250px'),0,'260px').refused,true);
 const marker=/data-rt-style="[a-f0-9]+"/.exec(source)[0];
 assert.equal(edit(source.replace('<h1 class=',`<h1 ${marker} class=`),0,'260px').refused,true);
});

test('HTML CSS reset without an override is inert and allocates a fresh identity when the old path is occupied',()=>{
 assert.deepEqual(edit(original,0,null).edits,[]);
 const id=resolve(original).element.id;
 const changed=edit(original.replace('<h1 class="title">Second',`<h1 data-rt-style="${id}" class="title">Second`),0,'200px');
 assert.equal(changed.ok,true);assert.notEqual(/<h1 data-rt-style="([^"]+)"/.exec(changed.edits[0].after)[1],id);
});

test('CSS spacing supports shorthand and signed margins but refuses malformed or invalid lengths',()=>{
 for(const [property,value] of [['padding','8px 12px 16px 20px'],['gap','1rem 2rem'],['margin','-8px auto'],['letter-spacing','-0.02em'],['line-height','1.5'],['max-height','none']])assert.equal(css.valid(property,value),true,property+' '+value);
 for(const [property,value] of [['padding','8'],['padding','-8px'],['gap','1px 2px 3px'],['width','normal'],['letter-spacing','5%'],['border-width','2%'],['color','#12345'],['margin','1px;display:none']])assert.equal(css.valid(property,value),false,property+' '+value);
});
test('CSS shorthand replaces prior edge overrides and later edges win in the rendered declaration order',()=>{
 let source=edit(original,0,'8px 12px','padding').edits[0].after;
 source=edit(source,0,'20px','padding-left').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[0],{padding:'8px 12px','padding-left':'20px'});
 source=edit(source,0,'4px','padding').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[0],{padding:'4px'});
 source=edit(source,0,'8px','gap').edits[0].after;
 source=edit(source,0,'20px','column-gap').edits[0].after;
 assert.ok(source.indexOf('gap:8px')<source.indexOf('column-gap:20px'));
 const id=resolve(source).element.id,values=css.describe(resolve(source)).cssRules[0];
 const legacy=source.replace(css.rule(id,0,values),css.rule(id,0,values,true));
 assert.deepEqual(css.describe(resolve(legacy)).cssRules[0],values);
 assert.equal(edit(legacy,0,'30px','column-gap').ok,true);

});
test('CSS important shorthand conflicts are refused while reset remains available',()=>{
 for(const [inline,prop]of [['padding:1px !important','padding-left'],['padding-left:1px !important','padding'],['border-top:1px solid red !important','border-width'],['all:initial !important','width'],['font:12px serif !important','font-size']])assert.equal(edit(original.replace('class="title"',`style="${inline}"`),0,'2px',prop).refused,true,inline);
 let source=edit(original,0,'240px').edits[0].after;
 source=source.replace('class="title"','class="title" style="width:200px !important"');
 const reset=edit(source,0,null);assert.equal(reset.ok,true);assert.ok(!reset.edits[0].after.includes('data-rt-css='));assert.ok(reset.edits[0].after.includes('width:200px !important'));
});

test('HTML image framing accepts fit modes and bounded focal points',()=>{
 for(const mode of ['cover','contain','fill','none','scale-down'])assert.equal(css.valid('object-fit',mode),true);
 for(const value of ['0% 100%','25.5% 50%'])assert.equal(css.valid('object-position',value),true);
 for(const value of ['101% 0%','-1% 0%','0%','0% 0%;color:red','left top'])assert.equal(css.valid('object-position',value),false);
 let source=edit(original,768,'cover','object-fit').edits[0].after;
 source=edit(source,768,'25% 75%','object-position').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[768],{'object-fit':'cover','object-position':'25% 75%'});
 source=edit(source,768,null,'object-position').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[768],{'object-fit':'cover'});
});

test('HTML opacity and rotation persist without replacing authored transforms',()=>{
 for(const [property,value]of [['opacity','0.25'],['opacity','1'],['rotate','-45deg']])assert.equal(css.valid(property,value),true);
 for(const [property,value]of [['opacity','1.5'],['opacity','-1'],['rotate','361deg'],['rotate','45deg;display:none']])assert.equal(css.valid(property,value),false);
 const input=original.replace('class="title"','class="title" style="transform:translateX(10px)"');
 let source=edit(input,0,'0.25','opacity').edits[0].after;
 source=edit(source,768,'45deg','rotate').edits[0].after;
 assert.ok(source.includes('style="transform:translateX(10px)"'));
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{opacity:'0.25'},768:{rotate:'45deg'}});
 source=edit(source,768,null,'rotate').edits[0].after;assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{opacity:'0.25'}});
});

test('HTML typography accepts font stacks and weights, preserves source text, and checks shorthand conflicts',()=>{
 for(const value of ['sans-serif','"Times New Roman", serif','"思源黑体", sans-serif'])assert.equal(css.valid('font-family',value),true);
 for(const value of ['Arial; color:red','url(test)','"Unclosed','Arial,'])assert.equal(css.valid('font-family',value),false);
 for(const value of ['400','625.5','bold'])assert.equal(css.valid('font-weight',value),true);
 for(const value of ['0','1001','NaN'])assert.equal(css.valid('font-weight',value),false);
 let source=edit(original,768,'"Times New Roman", serif','font-family').edits[0].after;
 source=edit(source,768,'italic','font-style').edits[0].after;
 assert.ok(source.includes('First</h1>'));assert.deepEqual(css.describe(resolve(source)).cssRules[768],{'font-family':'"Times New Roman", serif','font-style':'italic'});
 assert.equal(edit(original.replace('class="title"','style="font:12px serif !important"'),0,'600','font-weight').refused,true);
});

test('Moving a styled HTML layer keeps its styling and permits independent edits at its old source position',()=>{
 let source=edit(original,0,'240px').edits[0].after;
 const resolved=resolve(source);resolved.elements=html.collect(source,'index.html').elements;resolved.element=resolved.elements.find(e=>e.tag==='h1');
 source=html.planOp(resolved,{type:'moveElement',direction:'after'}).edits[0].after;
 const elements=html.collect(source,'index.html').elements.filter(e=>e.tag==='h1');
 assert.deepEqual(css.describe({...resolve(source),element:elements[0]}).cssRules,{});
 assert.deepEqual(css.describe({...resolve(source),element:elements[1]}).cssRules,{0:{width:'240px'}});
 const next=css.plan({...resolve(source),element:elements[0]},{property:'width',value:'120px',width:0});assert.equal(next.ok,true);
 const updated=html.collect(next.edits[0].after,'index.html').elements.filter(e=>e.tag==='h1');
 assert.notEqual(updated[0].node.attrs.find(a=>a.name==='data-rt-style').value,updated[1].node.attrs.find(a=>a.name==='data-rt-style').value);
});

test('Duplicating styled HTML subtrees copies responsive rules to independent identities',()=>{
 let source='<html><head></head><body><section><h1>Title</h1></section></body></html>';
 source=edit(source,0,'240px').edits[0].after;source=edit(source,768,'320px').edits[0].after;
 const elements=html.collect(source,'index.html').elements,element=elements.find(e=>e.tag==='section');
 const duplicated=html.planOp({...resolve(source),elements,element},{type:'duplicateElement'});assert.equal(duplicated.ok,true);
 source=duplicated.edits[0].after;
 const titles=html.collect(source,'index.html').elements.filter(e=>e.tag==='h1');
 const markers=titles.map(e=>e.node.attrs.find(a=>a.name==='data-rt-style').value);assert.notEqual(...markers);
 for(const title of titles)assert.deepEqual(css.describe({...resolve(source),element:title}).cssRules,{0:{width:'240px'},768:{width:'320px'}});
 const edited=css.plan({...resolve(source),element:titles[1]},{property:'width',value:'160px',width:0});assert.equal(edited.ok,true);
 const fresh=html.collect(edited.edits[0].after,'index.html').elements.filter(e=>e.tag==='h1');
 assert.equal(css.describe({...resolve(edited.edits[0].after),element:fresh[0]}).cssRules[0].width,'240px');
 assert.equal(css.describe({...resolve(edited.edits[0].after),element:fresh[1]}).cssRules[0].width,'160px');
});

test('HTML grid tracks and child spans are bounded and reset independently',()=>{
 for(const [property,value]of [['grid-template-columns','repeat(3, minmax(0, 1fr))'],['grid-row','span 2 / span 2']])assert.equal(css.valid(property,value),true);
 for(const [property,value]of [['grid-template-columns','repeat(999, minmax(0, 1fr))'],['grid-column','span 2 / span 3'],['grid-row','span 0 / span 0'],['grid-template-columns','repeat(2, url(x))']])assert.equal(css.valid(property,value),false);
 let source=edit(original,768,'repeat(3, minmax(0, 1fr))','grid-template-columns').edits[0].after;
 source=edit(source,768,'span 2 / span 2','grid-row').edits[0].after;
 source=edit(source,768,null,'grid-row').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[768],{'grid-template-columns':'repeat(3, minmax(0, 1fr))'});
});

test('HTML compound flex sizing validates every change before producing one source edit',()=>{
 const changes={'flex-grow':'1','flex-shrink':'1','flex-basis':'0%',width:'auto','min-width':'0px'};
 const result=css.plan(resolve(original),{width:768,changes});assert.equal(result.ok,true);assert.equal(result.edits.length,1);
 assert.deepEqual(css.describe(resolve(result.edits[0].after)).cssRules[768],changes);
 assert.equal(css.plan(resolve(original),{width:0,changes:{...changes,color:'red;display:none'}}).refused,true);
 assert.equal(css.plan(resolve(original.replace('class="title"','style="flex:0 1 auto !important"')),{width:0,changes}).refused,true);
 for(const changes of [[],null,{},'bad'])assert.equal(css.plan(resolve(original),{width:0,changes}).refused,true);
});

test('HTML shadows parse computed color-first values and persist independent responsive stacks',()=>{
 const {parseShadows,serializeShadows}=require('../shell/html-css-values.js');
 const value='rgba(0, 0, 0, 0.25) 0px 4px 8px 0px, inset -2px 0px 3px -1px #1234';
 const shadows=parseShadows(value);assert.equal(shadows.length,2);assert.equal(shadows[1].inset,true);assert.equal(shadows[1].spread,-1);
 assert.deepEqual(parseShadows(serializeShadows(shadows)),shadows);
 assert.deepEqual(parseShadows('none'),[]);assert.equal(parseShadows('0 0')[0].color,'currentColor');
 for(const invalid of ['0px 0px -1px red','0 0;display:none','url(x) 0 0','1px','0px 1px 2px 3px 4px','inset inset 0 0 red','0px 10001px red','0 0 red,','var(--shadow)','0 0 red</style>',Array(17).fill('0 0 red').join(',')])assert.equal(css.valid('box-shadow',invalid),false,invalid);
 let source=edit(original,0,value,'box-shadow').edits[0].after;
 source=edit(source,768,'none','box-shadow').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{'box-shadow':value},768:{'box-shadow':'none'}});
 source=edit(source,768,null,'box-shadow').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{'box-shadow':value}});
 assert.equal(edit(original.replace('class="title"','style="box-shadow:0 0 red !important"'),0,value,'box-shadow').refused,true);
});

test('HTML blur preserves filter order and validates supported filter stacks',()=>{
 const {parseFilters,withBlur}=require('../shell/html-css-values.js');
 const stack='contrast(0.8) blur(2px) drop-shadow(rgba(0, 0, 0, 0.5) 1px 2px 3px) saturate(120%)';
 assert.equal(parseFilters(stack).length,4);
 assert.equal(withBlur(stack,8),stack.replace('blur(2px)','blur(8px)'));
 assert.equal(withBlur(stack,0),stack.replace('blur(2px) ',''));
 assert.equal(withBlur('none',3),'blur(3px)');assert.equal(withBlur('blur(3px)',0),'none');
 assert.equal(withBlur('blur(2px) blur(3px)',4),null);
 for(const invalid of ['blur(-1px)','blur(2%)','blur(1001px)','url(https://example.com)','blur(1px);display:none','contrast(NaN)','drop-shadow(inset 0 0 red)','drop-shadow(0 0 1px 2px red)','brightness(2','var(--filter)','blur(2px)</style>'])assert.equal(css.valid('filter',invalid),false,invalid);
 let source=edit(original,0,stack,'filter').edits[0].after;
 source=edit(source,768,'blur(4px)','backdrop-filter').edits[0].after;
 source=edit(source,768,'multiply','mix-blend-mode').edits[0].after;
 source=edit(source,0,'isolate','isolation').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{filter:stack,isolation:'isolate'},768:{'backdrop-filter':'blur(4px)','mix-blend-mode':'multiply'}});
 source=edit(source,768,null,'backdrop-filter').edits[0].after;assert.equal(css.describe(resolve(source)).cssRules[768]['backdrop-filter'],undefined);
 assert.equal(edit(original.replace('class="title"','style="filter:contrast(2) !important"'),0,'blur(4px)','filter').refused,true);
 assert.equal(edit(original.replace('class="title"','style="-webkit-backdrop-filter:blur(2px) !important"'),0,'blur(4px)','backdrop-filter').refused,true);
 assert.equal(css.valid('mix-blend-mode','multiply;display:none'),false);assert.equal(css.valid('isolation','normal'),false);
});

test('HTML gradient stacks preserve stops and responsive scopes and refuse malformed source',()=>{
 const {parseGradients,serializeGradients}=require('../shell/html-css-values.js');
 const value='linear-gradient(90deg, rgba(255, 0, 0, 0.5) 0%, #fff 50%, blue 100%), radial-gradient(ellipse at 25% 75%, red 0%, transparent 100%)';
 const fills=parseGradients(value);assert.equal(fills.length,2);assert.equal(fills[0].stops.length,3);assert.equal(fills[1].x,25);
 assert.deepEqual(parseGradients(serializeGradients(fills)),fills);
 assert.equal(parseGradients('linear-gradient(to right, red, blue)')[0].angle,90);
 assert.equal(parseGradients('radial-gradient(at 25% 75%, red 0%, blue 100%)')[0].x,25);
 for(const invalid of ['url(https://example.com)','linear-gradient(90deg,red 0%)','linear-gradient(90deg,red 100%,blue 0%)','linear-gradient(90deg,red 0%,blue 101%)','linear-gradient(90deg,red 0%,blue 100%);display:none','linear-gradient(to top right, red, blue)','radial-gradient(ellipse at 101% 50%,red,blue)','linear-gradient(90deg,var(--x),blue)','linear-gradient(90deg,red</style>,blue)',Array(9).fill('linear-gradient(red, blue)').join(',')])assert.equal(css.valid('background-image',invalid),false,invalid);
 let source=edit(original,0,value,'background-image').edits[0].after;
 source=edit(source,768,'none','background-image').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{'background-image':value},768:{'background-image':'none'}});
 source=edit(source,768,null,'background-image').edits[0].after;assert.equal(css.describe(resolve(source)).cssRules[768],undefined);
 for(const property of ['background-image','background-color'])assert.equal(edit(original.replace('class="title"','style="background:red !important"'),0,property==='background-color'?'blue':value,property).refused,true);
});

test('Independent and elliptical corners preserve border styles and reset to uniform rounding',()=>{
 let source=edit(original.replace('class="title"','class="title" style="border:2px solid black !important"'),0,'8px','border-radius').edits[0].after;
 source=edit(source,0,'16px','gap').edits[0].after;
 assert.ok(source.indexOf('gap:16px !important')<source.indexOf('border-radius:8px !important'),'preserve historical family order');
 source=edit(source,0,'40px 10px','border-top-left-radius').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules[0],{'border-radius':'8px',gap:'16px','border-top-left-radius':'40px 10px'});
 assert.ok(source.indexOf('border-radius:8px !important')<source.indexOf('border-top-left-radius:40px 10px !important'));
 source=edit(source,0,null,'border-top-left-radius').edits[0].after;assert.equal(css.describe(resolve(source)).cssRules[0]['border-top-left-radius'],undefined);
 source=edit(source,0,'40px','border-bottom-right-radius').edits[0].after;source=edit(source,0,'20px','border-radius').edits[0].after;assert.deepEqual(css.describe(resolve(source)).cssRules[0],{'border-radius':'20px',gap:'16px'});
 for(const property of ['border-radius','border-top-left-radius'])assert.equal(edit(original.replace('class="title"','style="border-top-left-radius:4px !important"'),0,'20px',property).refused,true);
 assert.equal(css.valid('border-top-left-radius','-1px'),false);assert.equal(css.valid('border-top-left-radius','10px 20px 30px'),false);
});

test('Elliptical radius shorthand round-trips both axes and rejects malformed separators',()=>{
 for(const value of ['30px 10px / 15px 5px','50%/25%','1px 2px 3px 4px / 5px 6px 7px 8px']){const result=edit(original,768,value,'border-radius');assert.equal(result.ok,true,result.reason);assert.equal(css.describe(resolve(result.edits[0].after)).cssRules[768]['border-radius'],value);}
 for(const value of ['/10px','10px/','10px//20px','1px 2px 3px 4px 5px / 2px','2px / -1px','2px / calc(1px)','2px/1px;display:none'])assert.equal(css.valid('border-radius',value),false,value);
});

test('optical sizing respects important font shorthand and keeps scoped resets isolated',()=>{
 const important=original.replace('class="title"','class="title" style="font: 12px serif !important"');
 assert.equal(edit(important,768,'none','font-optical-sizing').refused,true);
 for(const value of ['auto','none'])assert.equal(css.valid('font-optical-sizing',value),true);
 for(const value of ['normal','12','auto;color:red'])assert.equal(css.valid('font-optical-sizing',value),false);
 let source=edit(original,0,'none','font-optical-sizing').edits[0].after;
 source=edit(source,768,'auto','font-optical-sizing').edits[0].after;
 source=edit(source,768,null,'font-optical-sizing').edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{'font-optical-sizing':'none'}});
});
