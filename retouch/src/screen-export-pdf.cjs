'use strict';
const {PDFDocument}=require('pdf-lib');
async function renderPDF(page,body,clip){
 const bounds=clip||{x:body.rootScroll.x,y:body.rootScroll.y,width:body.width,height:body.height};
 if(bounds.x<0||bounds.y<0)throw Error('PDF export requires a non-negative page position.');
 await page.emulateMedia({media:'screen'});
 const extent=await page.evaluate(bounds=>{
  const html=document.documentElement;
  // Printing resets root scrolling and uses the paper height as the viewport.
  // Freeze viewport-fixed and sticky placement while the captured scroll is live.
  const positioned=[...document.querySelectorAll('*')].filter(el=>['fixed','sticky'].includes(getComputedStyle(el).position));
  for(const el of positioned){
   const css=getComputedStyle(el),before=el.getBoundingClientRect();
   if(css.position==='fixed'){
    let parent=el.parentElement,contained=false;
    while(parent){const style=getComputedStyle(parent);if(style.transform!=='none'||style.perspective!=='none'||style.filter!=='none'||style.backdropFilter!=='none'||['translate','rotate','scale'].some(name=>style[name]&&style[name]!=='none')||/(transform|perspective|filter)/.test(style.willChange)||style.contentVisibility==='auto'||/(paint|layout|strict|content)/.test(style.contain)){contained=true;break;}parent=parent.parentElement;}
    if(!contained){const top=parseFloat(css.top),left=parseFloat(css.left);el.style.setProperty('top',((Number.isFinite(top)?top:el.offsetTop-parseFloat(css.marginTop||0))+scrollY)+'px','important');el.style.setProperty('left',((Number.isFinite(left)?left:el.offsetLeft-parseFloat(css.marginLeft||0))+scrollX)+'px','important');el.style.setProperty('bottom','auto','important');el.style.setProperty('right','auto','important');}
   }else{
    el.style.setProperty('position','relative','important');for(const side of ['top','left','bottom','right'])el.style.setProperty(side,'auto','important');
    const after=el.getBoundingClientRect();let matrix=new DOMMatrix();
    for(let parent=el.parentElement;parent;parent=parent.parentElement){
     const style=getComputedStyle(parent),transform=new DOMMatrix(style.transform==='none'?undefined:style.transform),zoom=parseFloat(style.zoom)||1;let individual=new DOMMatrix();
     if(style.rotate&&style.rotate!=='none'){
      const match=/^(?:z\s+)?(-?[\d.]+)(deg|rad|turn|grad)$/.exec(style.rotate);
      if(!match)throw Error('PDF export cannot yet freeze sticky layers inside 3D rotations.');
      const degrees=Number(match[1])*({deg:1,rad:180/Math.PI,turn:360,grad:0.9}[match[2]]);individual=individual.rotate(degrees);
     }
     if(style.scale&&style.scale!=='none'){const values=style.scale.split(/\s+/).map(Number);individual=individual.scale(values[0],values[1]??values[0],values[2]??1);}
     matrix=individual.multiply(transform).scale(zoom).multiply(matrix);
    }
    if(!matrix.is2D)throw Error('PDF export cannot yet freeze sticky layers inside perspective transforms.');
    const delta=new DOMPoint(before.left-after.left,before.top-after.top,0,0).matrixTransform(matrix.inverse());
    if(!Number.isFinite(delta.x)||!Number.isFinite(delta.y))throw Error('A sticky layer has a singular transform.');
    el.style.setProperty('top',delta.y+'px','important');el.style.setProperty('left',delta.x+'px','important');
   }
  }
  const width=Math.max(innerWidth,bounds.x+bounds.width),height=Math.max(innerHeight,html.scrollHeight,document.body.scrollHeight,bounds.y+bounds.height);
  const style=document.createElement('style');style.textContent='@page{size:'+width+'px '+height+'px;margin:0}*{break-before:auto!important;break-after:auto!important;break-inside:auto!important;page-break-before:auto!important;page-break-after:auto!important;page-break-inside:auto!important}html{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}';document.head.append(style);
  scrollTo(0,0);return {width,height};
 },bounds);
 if(extent.width>32768||extent.height>32768)throw Error('This PDF exceeds the 32,768-pixel page limit. Export a shorter page.');
 const bytes=await page.pdf({width:extent.width+'px',height:extent.height+'px',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,margin:{top:0,right:0,bottom:0,left:0},timeout:15000});
 const input=await PDFDocument.load(bytes);if(input.getPageCount()!==1)throw Error('This screen could not be kept on one PDF page. Try a smaller selection.');
 const output=await PDFDocument.create(),source=input.getPage(0),factor=72/96;
 const artwork=await output.embedPage(source,{left:bounds.x*factor,bottom:source.getHeight()-(bounds.y+bounds.height)*factor,right:(bounds.x+bounds.width)*factor,top:source.getHeight()-bounds.y*factor});
 const width=bounds.width*factor*body.scale,height=bounds.height*factor*body.scale;
 output.addPage([width,height]).drawPage(artwork,{x:0,y:0,width,height});
 output.setTitle(body.title||'Retouch export');output.setCreator('Retouch');return Buffer.from(await output.save());
}
module.exports={renderPDF};
