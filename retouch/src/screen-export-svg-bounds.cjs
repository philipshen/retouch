'use strict';
// Runs only in the disposable export document, with the trusted Paper runtime.
module.exports=function svgStrokeBounds(node){
 const ns='http://www.w3.org/2000/svg';
 if(node.namespaceURI!==ns||node.localName==='svg')return [];
 const paper=globalThis.RetouchExportPaper,scope=new paper.PaperScope(),result=[];
 const definitions='defs,clipPath,mask,marker,pattern,symbol,filter';
 const data=(el,css)=>{const value=css.getPropertyValue('d');if(value?.startsWith('path(')){try{return JSON.parse(value.slice(5,-1));}catch{}}return el.getAttribute('d');};
 const length=(value,el,axis)=>{if(value.endsWith('%')){const svg=el.ownerSVGElement,box=svg.viewBox.baseVal,w=box.width||svg.width.baseVal.value,h=box.height||svg.height.baseVal.value;return parseFloat(value)*(axis==='x'?w:axis==='y'?h:Math.hypot(w,h)/Math.SQRT2)/100;}return parseFloat(value);};
 // A same-geometry user-space clip implements an inside stroke. Its stroke
 // cannot extend past the geometry bounds already measured by the caller.
 const inside=(el,css)=>{try{const match=/url\(\s*["']?([^"')]+)["']?\s*\)/.exec(css.clipPath);if(!match)return false;const url=new URL(match[1],document.baseURI);if(!match[1].startsWith('#')&&url.href.split('#')[0]!==document.URL.split('#')[0]&&url.href.split('#')[0]!==document.baseURI.split('#')[0])return false;const clip=document.getElementById(decodeURIComponent(url.hash.slice(1))),path=clip?.firstElementChild;if(clip?.localName!=='clipPath'||clip.getAttribute('clipPathUnits')!=='userSpaceOnUse'||clip.children.length!==1||path?.localName!=='path')return false;const a=getComputedStyle(clip),b=getComputedStyle(path);return a.transform==='none'&&b.transform==='none'&&data(path,b)===data(el,css);}catch{return false;}};
 try{
  scope.setup(new scope.Size(1,1));
  for(const el of [node,...node.querySelectorAll('*')]){
   if(el.namespaceURI!==ns||el.closest(definitions)||!el.getScreenCTM||!el.getBBox||!el.getClientRects().length)continue;
   const css=getComputedStyle(el),width=length(css.strokeWidth,el);
   if(css.display==='none'||css.visibility!=='visible'||css.stroke==='none'||!(width>0)||Number(css.strokeOpacity)===0||!['path','rect','circle','ellipse','line','polyline','polygon','text','use'].includes(el.localName)||inside(el,css))continue;
   const matrix=el.getScreenCTM();if(!matrix)continue;
   let path;
   try{
    const box=el.getBBox();
    if(el.localName==='path')path=new scope.CompoundPath({pathData:data(el,css),insert:false});
    else if(el.localName==='circle'||el.localName==='ellipse')path=new scope.Path.Ellipse({rectangle:new scope.Rectangle(box.x,box.y,box.width,box.height),insert:false});
    else if(el.localName==='rect'){let rx=length(css.rx,el,'x'),ry=length(css.ry,el,'y');if(!Number.isFinite(rx))rx=Number.isFinite(ry)?ry:0;if(!Number.isFinite(ry))ry=rx;path=new scope.Path.Rectangle({rectangle:new scope.Rectangle(box.x,box.y,box.width,box.height),radius:new scope.Size(Math.min(rx,box.width/2),Math.min(ry,box.height/2)),insert:false});}
    else if(el.localName==='polygon'||el.localName==='polyline')path=new scope.Path({segments:[...el.points].map(p=>[p.x,p.y]),closed:el.localName==='polygon',insert:false});
    else if(el.localName==='line')path=new scope.Path({segments:[[el.x1.baseVal.value,el.y1.baseVal.value],[el.x2.baseVal.value,el.y2.baseVal.value]],insert:false});
    if(path){path.applyMatrix=css.vectorEffect==='non-scaling-stroke';path.transform(new scope.Matrix(matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f));path.strokeColor='black';path.strokeWidth=width;// Paper tests transformed miter lengths against a local-space limit and
     // rotates transformed cap normals. Construct these corners locally instead.
     path.strokeCap=css.strokeLinecap==='square'?'butt':css.strokeLinecap;
     path.strokeJoin=css.strokeLinejoin==='miter'?'bevel':css.strokeLinejoin;
     path.miterLimit=Number(css.strokeMiterlimit);
     let bounds=path.strokeBounds;
     for(const contour of path.children||[path]){
      const transform=contour.getGlobalMatrix(),segments=contour.segments,radius=width/2;
      const include=point=>{bounds=bounds.include(point.transform(transform));};
      if(css.strokeLinejoin==='miter')for(let i=contour.closed?0:1;i<segments.length-(contour.closed?0:1);i++){
       const segment=segments[i],outgoing=segment.getCurve(),incoming=outgoing?.getPrevious();
       if(!incoming||segment.isSmooth())continue;
       const point=segment.point;
       let a=incoming.getNormalAtTime(1).multiply(radius),b=outgoing.getNormalAtTime(0).multiply(radius);
       const angle=a.getDirectedAngle(b);if(angle<0||angle>=180){a=a.negate();b=b.negate();}
       const corner=new scope.Line(point.add(a),a.rotate(90),true).intersect(new scope.Line(point.add(b),b.rotate(90),true),true);
       if(corner&&point.getDistance(corner)<=path.miterLimit*radius)include(corner);
      }
      if(css.strokeLinecap==='square'&&!contour.closed&&segments.length>1)for(const segment of [segments[0],segments[segments.length-1]]){
       const location=segment.getLocation(),normal=location.getNormal().multiply(location.getTime()===0?radius:-radius),point=segment.point.add(normal.rotate(-90));
       include(point.add(normal));include(point.subtract(normal));
      }
     }
     if([bounds.left,bounds.top,bounds.right,bounds.bottom].every(Number.isFinite)){result.push({left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom,width:bounds.width,height:bounds.height});continue;}}
   }catch{}finally{path?.remove();}
   // Text/use and otherwise unsupported geometry get conservative padding.
   const box=el.getBoundingClientRect(),radius=width*Math.max(1,Number(css.strokeMiterlimit)||4)/2,fixed=css.vectorEffect==='non-scaling-stroke',x=radius*(fixed?1:Math.hypot(matrix.a,matrix.c)),y=radius*(fixed?1:Math.hypot(matrix.b,matrix.d));result.push({left:box.left-x,top:box.top-y,right:box.right+x,bottom:box.bottom+y,width:box.width+x*2,height:box.height+y*2});
  }
  return result;
 }finally{scope.remove();}
};
