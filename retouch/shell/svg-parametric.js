(function(root){
 'use strict';
 const pointsAPI=()=>typeof module==='object'&&module.exports?require('./svg-points.js'):root.RetouchSVGPoints;
 const round=value=>Math.round(value*1000000)/1000000;
 function arrow({x1,y1,x2,y2,headLength,headWidth}){
  if(![x1,y1,x2,y2,headLength,headWidth].every(Number.isFinite))return null;
  const length=Math.hypot(x2-x1,y2-y1);if(!length||headLength<0||headLength>length+.00001||headWidth<0||headWidth>100000)return null;
  const ux=(x2-x1)/length,uy=(y2-y1)/length,tip={x:x2,y:y2};
  const wing=side=>({x:x2-ux*headLength-uy*headWidth*.5*side,y:y2-uy*headLength+ux*headWidth*.5*side});
  const points=[{x:x1,y:y1},tip,wing(1),tip,wing(-1)].map(p=>({x:round(p.x),y:round(p.y)}));
  return points.some(p=>Math.abs(p.x)>100000||Math.abs(p.y)>100000)?null:pointsAPI().format(points);
 }
 function generate(spec){
  const {kind,count,ratio=1,x,y,width,height}=spec;
  if(kind==='arrow')return arrow(spec);
  if(!['polygon','star'].includes(kind)||!Number.isInteger(count)||count<3||count>(kind==='star'?256:512)||!Number.isFinite(ratio)||ratio<0||ratio>1||![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
  const length=kind==='star'?count*2:count,raw=Array.from({length},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/length,r=kind==='star'&&i%2?ratio:1;return {x:Math.cos(a)*r,y:Math.sin(a)*r};}),xs=raw.map(p=>p.x),ys=raw.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;
  const points=raw.map(p=>({x:round(x+(p.x-left)*width/w),y:round(y+(p.y-top)*height/h)}));
  return points.some(p=>Math.abs(p.x)>100000||Math.abs(p.y)>100000)?null:pointsAPI().format(points);
 }
 function describe(value,kind){
  if(kind==='arrow'){
   const points=pointsAPI().parse(value);if(!points||points.length!==5)return null;
   const [a,b,left,,right]=points,length=Math.hypot(b.x-a.x,b.y-a.y);if(!length)return null;
   const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length;
   const spec={kind,x1:a.x,y1:a.y,x2:b.x,y2:b.y,headLength:((b.x-left.x)+(b.x-right.x))*ux/2+((b.y-left.y)+(b.y-right.y))*uy/2,headWidth:(left.y-right.y)*ux-(left.x-right.x)*uy};
   if(spec.headLength<-.00001||spec.headLength>length+.00001||spec.headWidth<-.00001||spec.headWidth>100000.00001)return null;
   spec.headLength=Math.max(0,Math.min(length,spec.headLength));spec.headWidth=Math.max(0,Math.min(100000,spec.headWidth));
   const generated=generate(spec);if(!generated)return null;
   const expected=pointsAPI().parse(generated);return points.every((p,i)=>Math.abs(p.x-expected[i].x)<.00001&&Math.abs(p.y-expected[i].y)<.00001)?spec:null;
  }
  if(!['polygon','star'].includes(kind))return null;
  const points=pointsAPI().parse(value);if(!points)return null;
  const count=points.length/(kind==='star'?2:1);if(!Number.isInteger(count)||count<3)return null;
  const outer=kind==='star'?points.filter((_,i)=>i%2===0):points,cx=outer.reduce((s,p)=>s+p.x,0)/count,cy=outer.reduce((s,p)=>s+p.y,0)/count;
  let nx=0,dx=0,ny=0,dy=0;for(let i=0;i<count;i++){const a=-Math.PI/2+i*2*Math.PI/count,c=Math.cos(a),s=Math.sin(a);nx+=(outer[i].x-cx)*c;dx+=c*c;ny+=(outer[i].y-cy)*s;dy+=s*s;}
  const rx=nx/dx,ry=ny/dy;if(rx<=0||ry<=0)return null;
  let ratio=1;if(kind==='star'){ratio=0;for(let i=0;i<count;i++){const p=points[i*2+1],a=-Math.PI/2+(i*2+1)*Math.PI/count;ratio+=((p.x-cx)/rx*Math.cos(a)+(p.y-cy)/ry*Math.sin(a))/count;}if(ratio<-.00001||ratio>1.00001)return null;ratio=Math.max(0,Math.min(1,ratio));}
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),model={kind,count,ratio,x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y},generated=generate(model);
  if(!generated)return null;const expected=pointsAPI().parse(generated);if(points.some((p,i)=>Math.abs(p.x-expected[i].x)>0.00001||Math.abs(p.y-expected[i].y)>0.00001))return null;
  return model;
 }
 function reverseArrow(value){
  if(!describe(value,'arrow'))return null;
  const [a,b,left,,right]=pointsAPI().parse(value),reflect=p=>({x:round(a.x+b.x-p.x),y:round(a.y+b.y-p.y)});
  const points=[b,a,reflect(left),a,reflect(right)];
  return points.some(p=>Math.abs(p.x)>100000||Math.abs(p.y)>100000)?null:pointsAPI().format(points);
 }
 const api={generate,describe,reverseArrow};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGParametric=api;
})(typeof window==='object'?window:globalThis);
