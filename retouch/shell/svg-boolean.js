(function(root){
 'use strict';
 const geometry=root.RetouchSVGPath||(typeof require==='function'?require('./svg-path.js'):null);
 function combine(document,from,to,operation){
  const fail=reason=>({ok:false,reason}),methods={union:'unite',subtract:'subtract',intersect:'intersect',exclude:'exclude'};
  if(!geometry.serializeCompound(document)||!Number.isInteger(from)||!Number.isInteger(to)||from===to||!document.subpaths[from]||!document.subpaths[to]||!Object.hasOwn(methods,operation))return fail('Choose two different contours and a boolean operation.');
  if(!document.subpaths[from].closed||!document.subpaths[to].closed)return fail('Close both contours before combining their filled areas.');
  let working=document;
  for(const index of [from,to])if(working.subpaths[index].nodes.some(node=>node.arc)){working=geometry.contourToCubics(working,index);if(!working)return fail('Arc conversion exceeds the precision or point limits.');}
  const paper=root.paper||(typeof require==='function'?require('paper'):null);if(!paper)return fail('The vector boolean engine could not load.');
  let scope;
  try{
   scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));
   const a=new scope.Path({pathData:geometry.serialize(working.subpaths[from].nodes,true),insert:false}),b=new scope.Path({pathData:geometry.serialize(working.subpaths[to].nodes,true),insert:false});
   const result=a[methods[operation]](b,{insert:false});result.reorient(true,a.clockwise);
   const text=result.pathData,parsed=text?geometry.parseCompound(text):{subpaths:[]};if(!parsed||parsed.subpaths.some(part=>!part.closed))return fail('The boolean result cannot be represented as editable closed contours.');
   const subpaths=[],copy=part=>({closed:part.closed,nodes:part.nodes.map(node=>geometry.translate(node,0,0))});let selected=0;
   document.subpaths.forEach((part,index)=>{if(index===from){selected=subpaths.length;subpaths.push(...parsed.subpaths.map(copy));}else if(index!==to)subpaths.push(copy(part));});
   if(!subpaths.length)return fail('This operation removes the entire path. Delete the layer to remove it.');
   if(!geometry.serializeCompound({subpaths}))return fail('The boolean result exceeds the contour or point limits.');
   return {ok:true,subpaths,selected:Math.min(selected,subpaths.length-1)};
  }catch{return fail('These contours could not be combined. The original path is unchanged.');}
  finally{scope?.remove();}
 }
 const api={combine};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGBoolean=api;
})(typeof window==='object'?window:globalThis);
