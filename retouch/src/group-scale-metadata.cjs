'use strict';
const {parse}=require('../runtime/group-scale-bootstrap.js');
function compose(prior,op,readSnapshot=()=>({})){
 const ranges=prior?parse(JSON.stringify(prior)):[];let current=1;
 for(const [width,value]of ranges)if(width<=op.width)current=value;
 for(const step of prior?.steps||[])if(!step.styles&&op.width>=step.min&&(step.max===undefined||op.width<step.max))current*=step.factor;
 const shift=op.offset??[0,0],move=op.move??[0,0];
 const offsets={...prior?.offsets};let currentOffset=[0,0];for(const [width]of ranges)if(width<=op.width)currentOffset=offsets[width]||[0,0];
 const nextOffset=currentOffset.map((n,i)=>n+current*shift[i]);if(nextOffset.some(n=>n!==0))offsets[op.width]=nextOffset;else delete offsets[op.width];
 const pixels={...prior?.pixels};let currentPixels=[0,0];for(const [width]of ranges)if(width<=op.width)currentPixels=pixels[width]||[0,0];const nextPixels=currentPixels.map((n,i)=>n+move[i]);if(nextPixels.some(n=>n!==0))pixels[op.width]=nextPixels;else delete pixels[op.width];
 const values=Object.fromEntries(ranges);values[op.width]=current*op.factor;
 let metadata=JSON.stringify({version:1,ranges:values,...(Object.keys(offsets).length?{offsets}:{}),...(Object.keys(pixels).length?{pixels}:{})});parse(metadata);
 if(prior){
  const snapshot=readSnapshot();
  if(prior.steps?.length||Object.keys(snapshot).length){
   const steps=[...(prior.steps||[])],last=steps.filter(step=>step.styles).at(-1)?.styles||{};
   if(JSON.stringify(snapshot)!==JSON.stringify(last))steps.push({styles:snapshot});
   const max=Math.min(...[...ranges.map(([width])=>width),...steps.filter(step=>!step.styles).map(step=>step.min)].filter(width=>width>op.width));
   const next={factor:op.factor,min:op.width,...(Number.isFinite(max)?{max}:{}),offset:shift,move},previous=steps.at(-1);
   // Consecutive operations in the same range share their moving top-left
   // anchor. The second fractional offset uses the first operation's size.
   if(previous&&!previous.styles&&previous.min===next.min&&previous.max===next.max){
    const merged={...next,factor:previous.factor*next.factor,offset:previous.offset.map((n,i)=>n+previous.factor*next.offset[i]),move:previous.move.map((n,i)=>n+next.move[i])};
    if(merged.factor>=.01&&merged.factor<=100&&[...merged.offset,...merged.move].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))steps[steps.length-1]=merged;else steps.push(next);
   }else steps.push(next);
   metadata=JSON.stringify({...prior,steps});parse(metadata);
  }
 }

 return metadata;
}
module.exports={compose};
