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
 // Whole shapes preserve their own fill rule and transform before boolean work.
 function combineShapes(operands,operation){
  const fail=reason=>({ok:false,reason}),methods={union:'unite',subtract:'subtract',intersect:'intersect',exclude:'exclude'},affine=root.RetouchSVGAffine||(typeof require==='function'?require('./svg-affine.js'):null);
  if(!Array.isArray(operands)||operands.length<2||operands.length>100||!Object.hasOwn(methods,operation))return fail('Choose between two and 100 shapes and a boolean operation.');
  const prepared=[];let points=0,contours=0;
  for(const operand of operands){
   if(!operand?.document||!Array.isArray(operand.document.subpaths)||operand.document.subpaths.length&&!geometry.serializeCompound(operand.document)||!['nonzero','evenodd'].includes(operand.fillRule??'nonzero')||operand.document.subpaths.some(part=>!part.closed))return fail('Choose closed shapes with supported fill rules.');
   const matrix=operand.matrix??[1,0,0,1,0,0];if(!affine.valid(matrix))return fail('A shape transform is invalid.');
   const [a,b,c,d]=matrix,det=a*d-b*c,sum=a*a+b*b+c*c+d*d,norm=Math.sqrt((sum+Math.sqrt(Math.max(0,sum*sum-4*det*det)))/2);if(Math.abs(det)<1e-12||!Number.isFinite(norm))return fail('A shape transform collapses its filled area.');
   let document=operand.document;const tolerance=.01/Math.max(1,norm);
   for(let index=0;index<document.subpaths.length;index++)if(document.subpaths[index].nodes.some(node=>node.arc)){document=geometry.contourToCubics(document,index,tolerance);if(!document)return fail('Transformed arcs exceed the precision or point limits.');}
   points+=document.subpaths.reduce((sum,part)=>sum+part.nodes.length,0);contours+=document.subpaths.length;if(points>512||contours>128)return fail('Selected shapes exceed the contour or point limits.');
   prepared.push({document,matrix,fillRule:operand.fillRule??'nonzero'});
  }
  const paper=root.paper||(typeof require==='function'?require('paper'):null);if(!paper)return fail('The vector boolean engine could not load.');let scope;
  try{
   scope=new paper.PaperScope();scope.setup(new scope.Size(1,1));
   const items=prepared.map(operand=>{const item=new scope.CompoundPath({pathData:operand.document.subpaths.length?geometry.serializeCompound(operand.document):'',fillRule:operand.fillRule,insert:false});item.transform(new scope.Matrix(...operand.matrix));return item;});
   let result=items[0];for(const item of items.slice(1)){result=result[methods[operation]](item,{insert:false});result.fillRule='nonzero';}
   result.reorient(true,true);const text=result.pathData,document=text?geometry.parseCompound(text):{subpaths:[]};
   if(!document||document.subpaths.some(part=>!part.closed)||document.subpaths.length&&!geometry.serializeCompound(document))return fail('The boolean result exceeds editable geometry limits.');
   return {ok:true,document,fillRule:'nonzero',empty:!document.subpaths.length};
  }catch{return fail('These shapes could not be combined. The original geometry is unchanged.');}
  finally{scope?.remove();}
 }
 const api={combine,combineShapes};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGBoolean=api;
})(typeof window==='object'?window:globalThis);
