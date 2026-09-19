'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),postcss=require('postcss'),{flatten}=require('../../src/flatten-css-nesting.cjs'),{transform}=require('../../src/picture-stylesheet.cjs');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
const html='<main id="main"><section class="frame" id="frame"><input id="draft"><img id="a" class="art"><img id="b" class="art"><button id="tail">Tail</button></section><p id="caption" class="caption">Caption</p></main>'.replaceAll('<img','<img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22130%22 height=%2260%22/%3E"');
const css=`body{margin:0} & { --root-scope: root } .frame{display:flex;gap:9px;align-items:center} input{width:60px}img{height:60px}
.frame,#unmatched { > img { width:120px; &:hover {opacity:.6} } }
.frame > img {width:90px;height:50px;& {height:60px} height:70px; @media(max-width:600px){height:80px;&{height:90px}height:100px; & + img{margin-left:4px}} padding:2px;}
.frame,#unused { --specific:initial; @media(min-width:1px){--specific:nested} } .frame {--specific:later}
.frame { @supports(display:flex){ > img + button{margin-left:11px} } @layer low{ > img{width:30px} } &:focus-within { > img {opacity:.8} } }
main {container-type:inline-size; @container(min-width:600px){ .frame > img{border:3px solid blue} } }
.caption,.caption::before {content:"X";color:red;@media(min-width:1px){color:blue} &:hover{color:green} } .caption:hover{color:orange}
.art { &:nth-of-type(2){padding-right:7px} & + & {border-bottom:4px solid green} :where(&) {--low-specific:yes} }
@keyframes untouched{from{opacity:0}to{opacity:1}}`;
(async()=>{const browser=await browserType.launch();try{const page=await browser.newPage({viewport:{width:1000,height:800}}),flat=flatten(postcss.parse(css)).toString(),adapted=transform(css),snapshot=()=>page.evaluate(()=>[...document.querySelectorAll('[id]')].map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node),p=getComputedStyle(node,'::before');return [node.id,r.x,r.y,r.width,r.height,s.color,s.opacity,s.paddingRight,s.marginLeft,s.borderBottomWidth,s.getPropertyValue('--specific'),s.getPropertyValue('--root-scope'),s.getPropertyValue('--low-specific'),p.color,p.content];}));
 for(const width of [1000,390])for(const state of ['normal','image hover','focus','caption hover']){
  await page.setViewportSize({width,height:800});await page.setContent('<style>'+css+'</style>'+html);await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));await page.mouse.move(width-1,799);if(state==='image hover')await page.locator('#a').hover();if(state==='focus')await page.locator('#draft').focus();if(state==='caption hover')await page.locator('#caption').hover();const before=await snapshot();
  await page.locator('style').evaluate((node,text)=>node.textContent=text,flat);assert.deepEqual(await snapshot(),before,'Native versus flattened CSS at '+width+' '+state);
  await page.evaluate(text=>{for(const image of document.querySelectorAll('.frame > img')){const picture=document.createElement('picture');picture.setAttribute('data-rt-picture','');picture.style.display='contents';image.before(picture);const source=document.createElement('source');source.style.display='none';picture.append(source,image);}document.querySelector('style').textContent=text;},adapted);if(state==='image hover')await page.locator('#a').hover();assert.deepEqual(await snapshot(),before,'Picture adaptation at '+width+' '+state);
 }
 console.log('NATIVE CSS NESTING, PARENT-LIST SPECIFICITY, INTERLEAVED DECLARATIONS, PSEUDO-ELEMENTS, MEDIA/CONTAINER/LAYER/SUPPORTS, HOVER/FOCUS AND PICTURE GEOMETRY PASS',engine);
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
