(function(root){
 'use strict';
 root.RetouchRadialGradient=function(group,gradient,label,update){
  if(gradient.type!=='radial')return;
  const I=root.RetouchInspector,V=root.RetouchHTMLCSSValues,d=group.ownerDocument,keywords=['closest-side','closest-corner','farthest-side','farthest-corner'],custom=gradient.size&&!keywords.includes(gradient.size);
  I.select(group,label+' shape',[['ellipse','Ellipse'],['circle','Circle']],gradient.shape,shape=>update({...gradient,shape,size:custom?(shape==='circle'?(gradient.size.split(' ')[0].endsWith('%')?'100px':gradient.size.split(' ')[0]):gradient.size+' '+gradient.size):gradient.size}));
  I.select(group,label+' Size',[['','Automatic'],['closest-side','Nearest edge'],['closest-corner','Nearest corner'],['farthest-side','Farthest edge'],['farthest-corner','Farthest corner'],['custom','Custom radii']],custom?'custom':gradient.size||'',size=>update({...gradient,size:size==='custom'?(gradient.shape==='circle'?'100px':'50% 50%'):size}));
  if(!custom)return;
  const radii=gradient.size.split(' ');
  radii.forEach((radius,index)=>{
   const input=d.createElement('input');input.value=radius;I.field(group,label+(gradient.shape==='circle'?' Radius':' Radius '+(index?'Y':'X')),input);
   input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{
    const next=[...radii];next[index]=input.value.trim();const value={...gradient,size:next.join(' ')};
    if(!V.parseGradients(V.serializeGradients([value]))||!d.defaultView.CSS.supports('background-image',V.serializeGradients([value]))){input.setCustomValidity(gradient.shape==='circle'?'Enter a nonnegative radius in px.':'Enter a nonnegative radius in px or %.');input.reportValidity();return;}update(value);
   };
  });
 };
})(window);
