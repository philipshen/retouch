'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
const {compile}=require('node:module').createRequire(path.join(fixture,'package.json'))('@tailwindcss/node');
const {compose}=require('../../src/text-style-classes.cjs');
const properties={'font-family':'"标题_Font", sans-serif','font-size':'32px','font-weight':'537.5','font-style':'oblique','font-optical-sizing':'none','font-variation-settings':'"wght" 537.5, "GRAD" -30','font-variant-numeric':'tabular-nums slashed-zero','line-height':'1.4','letter-spacing':'-0.02em','text-align':'center','text-decoration-line':'underline line-through','text-transform':'uppercase'};
(async()=>{
 const tokens=compose('p-4 hover:text-red-500 min-[768px]:font-black min-[768px]:text-lg/7',properties,'min-[768px]:').split(' '),compiler=await compile('@import "tailwindcss";',{base:fixture,onDependency(){}}),partial=['text-lg/7',compose('text-lg/7',{'font-size':'40px'}),compose('text-lg/7',{'line-height':'50px'}),'text-(length:--sample-size)/9',compose('text-(length:--sample-size)/9',{'font-size':'40px'})],css=compiler.build([...tokens,...partial.flatMap(value=>value.split(' '))]);
 assert.ok(tokens.includes('p-4'));assert.ok(tokens.includes('hover:text-red-500'));assert.ok(!tokens.includes('min-[768px]:font-black'));assert.ok(!tokens.includes('min-[768px]:text-lg/7'));
 const browser=await browserType.launch();try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>'+css+'</style><style>.baseline{font:16px sans-serif;}</style><p id="actual" class="baseline">Typography 0123</p><p id="expected" class="baseline">Typography 0123</p>');
  await page.evaluate(({tokens,properties})=>{document.getElementById('actual').classList.add(...tokens);const expected=document.getElementById('expected');for(const [key,value]of Object.entries(properties))expected.style.setProperty(key,value,'important');},{tokens,properties});
  const read=id=>page.locator('#'+id).evaluate((el,keys)=>Object.fromEntries(keys.map(key=>[key,getComputedStyle(el).getPropertyValue(key)])),Object.keys(properties));
  const mobile=await read('actual');assert.equal(mobile['font-size'],'16px');assert.equal(mobile['font-weight'],'400');
  await page.setViewportSize({width:900,height:900});assert.deepEqual(await read('actual'),await read('expected'));assert.equal((await read('actual'))['font-size'],'32px');
  await page.setViewportSize({width:390,height:844});assert.deepEqual(await read('actual'),mobile);await page.evaluate(values=>{document.documentElement.style.setProperty('--sample-size','22px');values.forEach((value,index)=>{const p=document.createElement('p');p.id='partial-'+index;p.className=value;p.textContent='Partial style';document.body.append(p);});},partial);const before=await read('partial-0'),size=await read('partial-1'),leading=await read('partial-2');assert.equal(size['font-size'],'40px');assert.equal(size['line-height'],before['line-height']);assert.equal(leading['line-height'],'50px');assert.equal(leading['font-size'],before['font-size']);const variable=await read('partial-3'),variableEdit=await read('partial-4');assert.equal(variable['font-size'],'22px');assert.equal(variableEdit['font-size'],'40px');assert.equal(variable['line-height'],'36px');assert.equal(variableEdit['line-height'],variable['line-height']);assert.deepEqual(errors,[]);console.log('TEXT STYLE CLASS RENDER PASS',engine);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
