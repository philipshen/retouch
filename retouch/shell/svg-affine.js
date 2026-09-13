(function(root){
 'use strict';
 const identity=()=>[1,0,0,1,0,0];
 const valid=m=>Array.isArray(m)&&m.length===6&&m.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000);
 function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
 function parse(value){
  if(value==null)return identity();if(typeof value!=='string'||value.length>4000)return null;if(value.trim()===''||value==='none')return identity();
  const number='[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?',tokens=/([a-zA-Z]+)\s*\(([^()]*)\)/g;let out=identity(),end=0,count=0,match;
  while((match=tokens.exec(value))){if(!(count?/^\s*,?\s*$/:/^\s*$/).test(value.slice(end,match.index))||++count>32)return null;end=tokens.lastIndex;const raw=match[2].trim();if(/,\s*,|^,|,$/.test(raw))return null;if(!new RegExp('^'+number+'(?:[\\s,]+'+number+')*$','i').test(raw))return null;const p=raw.split(/[\s,]+/).map(Number);if(p.some(n=>!Number.isFinite(n)||Math.abs(n)>100000))return null;let m;const angle=p[0]*Math.PI/180;
   switch(match[1]){case 'matrix':if(p.length===6)m=p;break;case 'translate':if(p.length===1||p.length===2)m=[1,0,0,1,p[0],p[1]??0];break;case 'scale':if(p.length===1||p.length===2)m=[p[0],0,0,p[1]??p[0],0,0];break;case 'rotate':if(p.length===1||p.length===3){m=[Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0];if(p.length===3)m=multiply(multiply([1,0,0,1,p[1],p[2]],m),[1,0,0,1,-p[1],-p[2]]);}break;case 'skewX':if(p.length===1)m=[1,0,Math.tan(angle),1,0,0];break;case 'skewY':if(p.length===1)m=[1,Math.tan(angle),0,1,0,0];break;}
   if(!m)return null;out=multiply(out,m);if(!valid(out))return null;
  }
  return count&&/^\s*$/.test(value.slice(end))?out:null;
 }
 const format=m=>valid(m)?'matrix('+m.map(n=>Number(n.toFixed(10))).join(' ')+')':null;
 const equivalent=(a,b)=>!!a&&!!b&&a.every((n,i)=>Math.abs(n-b[i])<=1e-5*Math.max(1,Math.abs(n),Math.abs(b[i])));
 function resize(matrix,before,after){
  if(!valid(matrix)||before.width<0||before.height<0||!before.width&&!before.height||after.width<0||after.height<0)return null;
  let local;if(!before.height){const sx=after.width/before.width,sy=after.height/before.width;local=[sx,sy,0,1,after.x-sx*before.x,after.y-before.y-sy*before.x];}
  else if(!before.width){const sx=after.width/before.height,sy=after.height/before.height;local=[1,0,sx,sy,after.x-before.x-sx*before.y,after.y-sy*before.y];}
  else{const sx=after.width/before.width,sy=after.height/before.height;local=[sx,0,0,sy,after.x-sx*before.x,after.y-sy*before.y];}
  const result=multiply(matrix,local);return valid(result)?result:null;
 }

 function dimensions(matrix,g){if(!valid(matrix)||!g)return null;const sx=Math.hypot(matrix[0],matrix[1]),sy=Math.hypot(matrix[2],matrix[3]);return sx>1e-9&&sy>1e-9?{width:g.width*sx,height:g.height*sy,sx,sy}:null;}
 function resizeDimension(matrix,g,axis,value,locked=false){const size=dimensions(matrix,g);if(!size||!['width','height'].includes(axis)||!Number.isFinite(value)||value<=0||value>100000)return null;const other=axis==='width'?'height':'width',after={...g,[axis]:value/size[axis==='width'?'sx':'sy']};if(locked){if(!size[axis]||!size[other])return null;after[other]=g[other]*value/size[axis];}return resize(matrix,g,after);}

 function pose(matrix,g){if(!dimensions(matrix,g))return null;return {x:matrix[0]*g.x+matrix[2]*g.y+matrix[4],y:matrix[1]*g.x+matrix[3]*g.y+matrix[5],rotation:Math.atan2(matrix[1],matrix[0])*180/Math.PI};}
 function setPose(matrix,g,axis,value){const before=pose(matrix,g);if(!before||!['x','y','rotation'].includes(axis)||!Number.isFinite(value)||Math.abs(value)>(axis==='rotation'?360:100000))return null;let result;
  if(axis==='rotation'){const x=g.x+g.width/2,y=g.y+g.height/2,cx=matrix[0]*x+matrix[2]*y+matrix[4],cy=matrix[1]*x+matrix[3]*y+matrix[5],angle=(value-before.rotation)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);result=multiply([c,s,-s,c,cx-c*cx+s*cy,cy-s*cx-c*cy],matrix);}
  else{result=matrix.slice();result[axis==='x'?4:5]+=value-before[axis];}return valid(result)?result:null;
 }

 const api={identity,valid,multiply,parse,format,equivalent,resize,dimensions,resizeDimension,pose,setPose};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGAffine=api;
})(typeof window==='object'?window:globalThis);
