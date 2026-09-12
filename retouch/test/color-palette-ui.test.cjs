'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const window={RetouchPaletteValues:require('../shell/palette-values.js')};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../shell/color-styles.js'),'utf8'),{window});const {normalize}=window.RetouchColorStyles;
test('palette color entry expands shorthand and retains explicit alpha exactly',()=>{
 for(const [input,expected]of [['#abc','#aabbccff'],['#AbC8','#aabbcc88'],['#ABCDEF','#abcdefff'],['#12345600','#12345600'],['#0000','#00000000']])assert.equal(normalize(input),expected);
 for(const input of ['',null,42,'red','#12','#12345','#123456789','var(--color)','#123;bad'])assert.throws(()=>normalize(input),/hex color/);
});

test('inherited palette links follow the nearest narrower scope per paint property',()=>{
 const {inheritedLink}=window.RetouchColorStyles,base={id:'base'},tablet={id:'tablet'},text={id:'text'};
 const links={0:{'background-color':base},768:{'background-color':tablet},1024:{color:text}};
 assert.equal(inheritedLink(links,1440,'background-color').link,tablet);
 assert.equal(inheritedLink(links,1440,'background-color').label,'768px and larger');
 assert.equal(inheritedLink(links,390,'background-color').label,'All sizes');
 assert.equal(inheritedLink(links,1440,'color').link,text);
 for(const [width,property]of [[0,'background-color'],[768,'background-color'],[390,'color'],[1440,'border-color'],[NaN,'color'],[-1,'color']])assert.equal(inheritedLink(links,width,property),null);
 assert.equal(inheritedLink({},1440,'color'),null);
});

test('capturing computed sRGB paint retains alpha and refuses non-solid or unsupported color spaces',()=>{
 const {fromComputed}=window.RetouchColorStyles;
 for(const [input,expected]of [['rgb(51, 102, 153)','#336699ff'],['rgba(51, 102, 153, 0.533333)','#33669988'],['rgb(100% 0% 50% / 50%)','#ff008080'],['color(srgb 0.2 0.4 0.6 / 0.5)','#33669980'],['transparent','#00000000'],['#1234','#11223344']])assert.equal(fromComputed(input),expected);
 for(const input of ['none','url(#gradient)','oklch(50% 0.2 30)','rgb(300 0 0)','rgb(1 2 3 / 2)','rgb(1 2)','rgb(1,2,3/0.5)',null])assert.throws(()=>fromComputed(input),/solid color/);
});


test('shared palette context requires the same explicit link on every selected layer',()=>{
 const {selectionState}=window.RetouchColorStyles,a={id:'a'},b={id:'b'},layer=(link,overrides=[])=>({colorStyleLinks:{768:{color:link},0:{color:b}},colorStyleOverrides:{768:overrides}});
 const same=selectionState([layer(a),layer(a,['color'])],768,'color');assert.equal(same.link,a);assert.equal(same.linked,2);assert.equal(same.overrides,1);
 for(const selection of [[layer(a),layer(b)],[layer(a),layer(null)]]){const state=selectionState(selection,768,'color');assert.equal(state.link,null);assert.equal(state.total,2);}
 assert.equal(selectionState([layer(a),layer(a)],1024,'color').linked,0,'inherited links are not reported as explicit links in this range');assert.equal(selectionState([],0,'color').link,null);assert.equal(selectionState([layer(a,['background-color'])],768,'color').overrides,0);
});


test('shared inherited paint context follows each layer and preserves mixed sources',()=>{
 const {selectionState}=window.RetouchColorStyles,a={id:'a'},b={id:'b'},base={colorStyleLinks:{0:{color:a}}},tablet={colorStyleLinks:{768:{color:a}}};
 assert.equal(selectionState([base,base],1024,'color').inherited.label,'All sizes');assert.equal(selectionState([base,tablet],1024,'color').inherited.label,'Multiple ranges');
 const mixed=selectionState([base,{colorStyleLinks:{0:{color:b}}}],1024,'color');assert.equal(mixed.inherited,null);assert.equal(mixed.inheritedCount,2);
 const own=selectionState([base,{colorStyleLinks:{1024:{color:a}}}],1024,'color');assert.equal(own.inherited,null);assert.equal(own.inheritedCount,1);assert.equal(own.linked,1);
 const custom=selectionState([base,base],'md:','color',()=>({link:a,label:'All sizes'}));assert.equal(custom.inherited.link,a);assert.equal(custom.inheritedCount,2);
});
