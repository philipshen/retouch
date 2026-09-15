'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,box,read,wait,settled})=>{
 const source=read(),screen=page.getByLabel('Screen size',{exact:true}),originalScreen=await screen.inputValue();
 const bounds=()=>box.evaluate(el=>{const css=getComputedStyle(el);return {x:parseFloat(css.left),y:parseFloat(css.top),width:parseFloat(css.width),height:parseFloat(css.height),right:parseFloat(css.right),bottom:parseFloat(css.bottom),parentWidth:el.offsetParent.clientWidth,parentHeight:el.offsetParent.clientHeight};});
 const close=(a,b,label)=>assert.ok(Math.abs(a-b)<.7,label+': '+a+' vs '+b);
 try{
  for(const mode of ['end','center','stretch','scale']){
   await screen.selectOption('768x1024');await settled();const before=await bounds(),states=[source];
   for(const label of ['Horizontal anchor','Vertical anchor']){const field=page.getByLabel(label,{exact:true});if(await field.inputValue()===mode)continue;await field.selectOption(mode);await settled();await wait(()=>read()!==states.at(-1)).catch(async error=>{throw Error(mode+' '+label+': '+error.message+' '+await page.locator('#panelBody').innerText());});states.push(read());}
   const anchored=await bounds();for(const key of ['x','y','width','height'])close(anchored[key],before[key],mode+' preserves '+key);
   await screen.selectOption('1440x900');await settled();const resized=await bounds();assert.notEqual(resized.parentWidth,anchored.parentWidth);assert.notEqual(resized.parentHeight,anchored.parentHeight);
   for(const [axis,size,parent,end]of [['x','width','parentWidth','right'],['y','height','parentHeight','bottom']]){
    const delta=resized[parent]-anchored[parent];
    if(mode==='end'){close(resized[end],anchored[end],'edge distance');close(resized[axis],anchored[axis]+delta,'edge position');close(resized[size],anchored[size],'edge size');}
    if(mode==='center'){close(resized[axis],anchored[axis]+delta/2,'center offset');close(resized[size],anchored[size],'center size');}
    if(mode==='stretch'){close(resized[axis],anchored[axis],'stretch start');close(resized[end],anchored[end],'stretch end');close(resized[size],anchored[size]+delta,'stretch size');}
    if(mode==='scale'){close(resized[axis],anchored[axis]*resized[parent]/anchored[parent],'scaled position');close(resized[size],anchored[size]*resized[parent]/anchored[parent],'scaled size');}
   }
   assert.equal(read(),states.at(-1),'screen preview does not rewrite source');
   for(const state of states.slice(0,-1).reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===state);}
  }
 }finally{await screen.selectOption(originalScreen);await settled();}
};
