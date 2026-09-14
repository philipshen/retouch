'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),F=require('../shell/image-fill.js'),V=require('../shell/html-css-values.js');
test('tile size uses original dimensions and keeps image/color classes intact',()=>{
 const changes=F.framing('tile',400,200,25);assert.deepEqual(changes,{'background-size':'100px 50px','background-repeat':'repeat','background-position':'0% 0%'});
 const result=F.classes('bg-cover bg-no-repeat bg-center bg-red-500 bg-[url(/pattern.svg)] hover:bg-contain',changes);
 assert.equal(result,'bg-red-500 bg-[url(/pattern.svg)] hover:bg-contain bg-[length:100px_50px] bg-repeat bg-[position:0%_0%]');
 assert.equal(F.scale('100px 50px',400,200),25);assert.equal(F.scale('100px auto',400,200),25);assert.equal(F.scale('100px 30px',400,200),null);assert.equal(F.scale('cover',400,200),null);
 for(const percent of [0,1001,NaN])assert.throws(()=>F.framing('tile',400,200,percent));
});
test('image framing validates bounded CSS while retaining existing image source',()=>{
 for(const mode of ['fill','fit','tile'])for(const [property,value]of Object.entries(F.framing(mode,400,200,25)))assert.equal(V.valid(property,value),true);
 for(const [property,value]of [['background-size','1px;display:none'],['background-size','-1px 10px'],['background-position','101% 0%'],['background-repeat','repeat; color:red']])assert.equal(V.valid(property,value),false);
 assert.equal(F.source('url("https://example.com/image.svg")'),'https://example.com/image.svg');assert.equal(F.source('url("one.svg"), url("two.svg")'),null);
});

test('image source encoding cannot escape its CSS URL or select an executable scheme',()=>{
 assert.equal(F.paint('/images/a b(1).png?x=1&y=2'),'url("/images/a%20b%281%29.png?x=1&y=2")');
 for(const url of ['javascript:alert(1)','file:///etc/passwd','data:text/html;base64,abc','/x\n.png'])assert.throws(()=>F.paint(url));
 assert.equal(V.valid('background-image','url("/image.svg");color:red'),false);assert.equal(V.valid('background-image','url("</style><script>")'),false);
 const classes=F.classes('bg-[url(/old.png)] bg-blue-500 md:bg-none',{'background-image':F.paint('/new.png')});assert.equal(classes,'bg-blue-500 md:bg-none !bg-[url(/new.png)]');
});

test('removing and resetting an image fill preserves other paint and screen variants',()=>{
 const before='text-red-500 bg-blue-500 shadow-lg bg-cover bg-repeat bg-[position:20%_30%] !bg-[image:var(--rt-image-fill-demo)] md:bg-contain';
 const removed=F.classes(before,{'background-image':'none'});assert.ok(removed.endsWith('!bg-none'));assert.ok(removed.includes('bg-blue-500'));assert.ok(removed.includes('md:bg-contain'));assert.ok(!removed.includes('var('));
 assert.equal(F.classes(removed,F.reset()),'text-red-500 bg-blue-500 shadow-lg md:bg-contain');
});

test('crop preview uses the CSS background positioning area and preserves source framing for tiles',()=>{
 const css={width:'240px',height:'160px',boxSizing:'border-box',paddingLeft:'10px',paddingRight:'10px',paddingTop:'20px',paddingBottom:'20px',borderLeftWidth:'2px',borderRightWidth:'2px',borderTopWidth:'3px',borderBottomWidth:'3px',backgroundSize:'cover',backgroundRepeat:'no-repeat',backgroundPosition:'25% 75%'};
 assert.deepEqual(F.cropFrame(css,400,200),{width:236,height:154,objectFit:'cover',objectPosition:'25% 75%'});
 assert.equal(F.cropFrame({...css,backgroundOrigin:'content-box'},400,200).width,216);
 assert.equal(F.cropFrame({...css,backgroundOrigin:'border-box'},400,200).height,160);
 assert.equal(F.cropFrame({...css,boxSizing:'content-box'},400,200).width,260);
 assert.deepEqual(F.cropFrame({...css,backgroundRepeat:'repeat'},400,200),{width:400,height:200,objectFit:'contain',objectPosition:'50% 50%'});
});
