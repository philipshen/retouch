(function(root){
 'use strict';
 const G=root.RetouchSVGPath||(typeof require==='function'?require('./svg-path.js'):null),A=root.RetouchSVGAffine||(typeof require==='function'?require('./svg-affine.js'):null),V=root.RetouchHTMLCSSValues||(typeof require==='function'?require('./html-css-values.js'):null);
 const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 function boundaries(document,path,fillRule){
  if(document.subpaths.length>128||document.subpaths.reduce((n,p)=>n+p.nodes.length,0)>512)throw Error('The aligned stroke exceeds the contour or point limit.');
  const paper=root.paper||(typeof require==='function'?require('paper'):null);if(!paper)throw Error('The vector geometry engine could not load.');
  let scope;
  try{
   scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));
   const shape=new scope.CompoundPath({pathData:path,insert:false}),contours=shape.children;
   for(let i=0;i<contours.length;i++){
    const contour=contours[i];if(Math.abs(contour.area)<1e-10||contour.getIntersections().length)throw Error('Resolve crossing or collapsed contours before aligning the stroke.');
    for(let j=0;j<i;j++)if(contour.getIntersections(contours[j]).length)throw Error('Resolve touching or crossing contours before aligning the stroke.');
    if(fillRule==='nonzero'){
     const point=contour.getPointAt(contour.length/2),winding=contours.reduce((sum,other)=>sum+(other!==contour&&other.contains(point)?(other.clockwise?1:-1):0),0);
     if(winding&&winding+(contour.clockwise?1:-1))throw Error('Resolve redundant nonzero contours before aligning the stroke.');
    }
   }
  }finally{scope?.remove();}
 }
 function normalize(input){
  const path=G.serializeCompound(input?.document);
  if(!path||!input.document.subpaths.length)throw Error('Choose a supported nonempty vector path.');
  const position=input.position??'center',width=input.width??1,fillRule=input.fillRule??'nonzero',matrix=input.matrix??[1,0,0,1,0,0];
  if(!['inside','center','outside'].includes(position))throw Error('Choose Inside, Center or Outside.');
  if(position!=='center'&&input.document.subpaths.some(part=>!part.closed))throw Error('Inside and outside strokes require closed contours.');
  if(!Number.isFinite(width)||width<0||width>10000)throw Error('Choose a stroke width between 0 and 10,000 source units.');
  if(!['nonzero','evenodd'].includes(fillRule))throw Error('Choose a supported fill rule.');
  if(position!=='center')boundaries(input.document,path,fillRule);
  if(!A.valid(matrix)||Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2])<1e-12)throw Error('The transform must preserve a measurable shape.');
  const paints={fill:input.fill??'none',stroke:input.stroke??'#000000'};
  for(const [property,value]of Object.entries(paints))if(typeof value!=='string'||!V.valid(property,value)||/\b(?:url|var)\s*\(/i.test(value))throw Error('Resolve the stroke and fill to literal colors before rendering alignment.');
  const linecap=input.linecap??'butt',linejoin=input.linejoin??'miter',miterlimit=input.miterlimit??4;
  if(!['butt','round','square'].includes(linecap)||!['miter','round','bevel'].includes(linejoin)||!Number.isFinite(miterlimit)||miterlimit<1||miterlimit>1000)throw Error('Choose supported stroke caps, joins and miter limit.');
  const dasharray=input.dasharray??'none',dashoffset=input.dashoffset??0;
  if(!V.valid('stroke-dasharray',dasharray)||typeof dasharray!=='string'||dasharray!=='none'&&!dasharray.trim().split(/[\s,]+/).every(value=>/^(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(value))||!Number.isFinite(dashoffset)||Math.abs(dashoffset)>100000)throw Error('Choose literal source-unit dashes and offset.');
  const opacity=input.opacity??1,fillOpacity=input.fillOpacity??1,strokeOpacity=input.strokeOpacity??1;
  if(![opacity,fillOpacity,strokeOpacity].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('Choose opacity between zero and one.');
  const boxes=input.document.subpaths.map(part=>G.bounds(part.nodes,part.closed));if(boxes.some(box=>!box))throw Error('The path bounds could not be measured.');
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.width)),bottom=Math.max(...boxes.map(b=>b.y+b.height));
  const padding=width*Math.max(1,miterlimit)+1,bounds={x:x-padding,y:y-padding,width:right-x+padding*2,height:bottom-y+padding*2};
  if(Object.values(bounds).some(n=>!Number.isFinite(n)||Math.abs(n)>1e8))throw Error('The stroke extends beyond supported geometry bounds.');
  return {path,position,width,fillRule,matrix:[...matrix],...paints,linecap,linejoin,miterlimit,dasharray,dashoffset,opacity,fillOpacity,strokeOpacity,bounds};
 }
 function render(input,id){
  if(typeof id!=='string'||!/^rt-stroke-[a-f0-9]{16}$/.test(id))throw Error('Provide a unique stroke definition identity.');
  const m=normalize(input),shape='d="'+escape(m.path)+'"',fillRule='fill-rule="'+m.fillRule+'"',bounds=Object.entries(m.bounds).map(([key,value])=>key+'="'+value+'"').join(' ');
  let definitions='',constraint='';
  if(m.position==='inside'){
   definitions='<defs><clipPath id="'+id+'" clipPathUnits="userSpaceOnUse"><path '+shape+' clip-rule="'+m.fillRule+'"/></clipPath></defs>';
   constraint=' clip-path="url(#'+id+')"';
  }else if(m.position==='outside'){
   definitions='<defs><mask id="'+id+'" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance" '+bounds+'><rect '+bounds+' fill="white"/><path '+shape+' '+fillRule+' fill="black" stroke="none"/></mask></defs>';
   constraint=' mask="url(#'+id+')"';
  }
  // Fill is separate so the outside mask never removes the original interior.
  const fill='<path '+shape+' '+fillRule+' fill="'+escape(m.fill)+'" fill-opacity="'+m.fillOpacity+'" stroke="none"/>';
  const stroke='<path '+shape+' fill="none" stroke="'+escape(m.stroke)+'" stroke-opacity="'+m.strokeOpacity+'" stroke-width="'+m.width*(m.position==='center'?1:2)+'" stroke-linecap="'+m.linecap+'" stroke-linejoin="'+m.linejoin+'" stroke-miterlimit="'+m.miterlimit+'" stroke-dasharray="'+escape(m.dasharray)+'" stroke-dashoffset="'+m.dashoffset+'"'+constraint+'/>';
  return '<g transform="'+A.format(m.matrix)+'" opacity="'+m.opacity+'">'+definitions+fill+stroke+'</g>';
 }
 const api={normalize,render};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeAlignment=api;
})(typeof window==='object'?window:globalThis);
