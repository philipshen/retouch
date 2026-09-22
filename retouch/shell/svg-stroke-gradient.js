(function(root){
 'use strict';
 const A=root.RetouchSVGAffine||(typeof require==='function'?require('./svg-affine.js'):null),V=root.RetouchHTMLCSSValues||(typeof require==='function'?require('./html-css-values.js'):null);
 const coordinates={linearGradient:['x1','y1','x2','y2'],radialGradient:['cx','cy','r','fx','fy','fr']},names=[...coordinates.linearGradient,...coordinates.radialGradient,'gradientUnits','spreadMethod','gradientTransform','color-interpolation'];
 const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 const contextual=new Set('currentcolor inherit initial unset revert revert-layer context-fill context-stroke accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext activeborder activecaption appworkspace background buttonhighlight buttonshadow captiontext inactiveborder inactivecaptiontext infobackground infotext menu menutext scrollbar threeddarkshadow threedface threedhighlight threedlightshadow threedshadow window windowframe windowtext'.split(' '));
 function color(value){if(typeof value!=='string'||!V.valid('color',value)||contextual.has(value.trim().toLowerCase())||/\b(?:url|var|env|light-dark)\s*\(/i.test(value))throw Error('Choose a literal gradient stop color.');return value;}
 function fraction(value,fallback){if(value===null||value===undefined)return fallback;if(!['string','number'].includes(typeof value))throw Error('Use a literal gradient stop value.');const match=/^((?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)(%)?$/.exec(String(value).trim());const number=match?Number(match[1])/(match[2]?100:1):NaN;if(!Number.isFinite(number)||number<0||number>1)throw Error('Keep gradient stop positions and opacity between zero and one.');return number;}
 function normalize(input){
  if(!input||!coordinates[input.type])throw Error('Choose a linear or radial gradient.');
  if(!input.fields||Array.isArray(input.fields)||typeof input.fields!=='object'||Object.keys(input.fields).some(name=>!names.includes(name)))throw Error('Choose supported gradient coordinates.');
  const fields={};
  for(const name of names){const value=input.fields[name];if(value===null||value===undefined)continue;if(typeof value!=='string')throw Error('Use literal gradient coordinates.');
   if(name==='gradientTransform'){const matrix=A.parse(value);if(!matrix||Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2])<1e-12)throw Error('Choose a measurable gradient transform.');fields[name]=A.format(matrix);continue;}
   if(name==='color-interpolation'){if(!['sRGB','linearRGB','srgb','linearrgb'].includes(value))throw Error('Choose supported gradient color interpolation.');fields[name]=value.toLowerCase()==='srgb'?'sRGB':'linearRGB';continue;}
   if(name==='gradientUnits'){if(!['objectBoundingBox','userSpaceOnUse'].includes(value))throw Error('Choose supported gradient units.');}
   else if(name==='spreadMethod'){if(!['pad','reflect','repeat'].includes(value))throw Error('Choose a supported gradient spread.');}
   else{const match=/^([-+]?(?:\d+\.?\d*|\.\d+))(px|%)?$/.exec(value);if(!match||!Number.isFinite(Number(match[1]))||Math.abs(Number(match[1]))>100000||['r','fr'].includes(name)&&Number(match[1])<0)throw Error('Keep gradient coordinates within supported bounds.');}
   fields[name]=value;
  }
  if(!Array.isArray(input.stops)||input.stops.length<2||input.stops.length>64)throw Error('Keep between two and 64 gradient stops.');
  let previous=0;const stops=input.stops.map(stop=>{if(!stop||typeof stop!=='object')throw Error('Provide gradient stops.');return {offset:String(previous=Math.max(previous,fraction(stop.offset,0))),color:color(stop.color??'#000000'),opacity:String(fraction(stop.opacity,1))};});
  return {type:input.type,fields,stops};
 }
 function render(input,id){const g=normalize(input);if(!/^rt-stroke-[a-f0-9]{16}-(fill|stroke)$/.test(id))throw Error('Choose a private stroke gradient identity.');return '<'+g.type+' id="'+id+'"'+Object.entries(g.fields).map(([key,value])=>' '+key+'="'+escape(value)+'"').join('')+'>'+g.stops.map(stop=>'<stop offset="'+stop.offset+'" stop-color="'+escape(stop.color)+'" stop-opacity="'+stop.opacity+'"/>').join('')+'</'+g.type+'>';}
 function describe(input,id,paint){const g=normalize(input);return {paint,id,type:g.type,reason:null,fields:[...coordinates[g.type],'gradientUnits','spreadMethod'].map(name=>({name,value:g.fields[name]??null})),stops:g.stops.map(stop=>({...stop}))};}
 function edit(input,op){
  if(op.action==='create'){if(input||op.changes!==undefined||op.stop!==undefined||!coordinates[op.value?.type])throw Error('Choose a new linear or radial gradient.');return normalize({type:op.value.type,fields:{},stops:[{offset:'0',color:color(op.value.color),opacity:'1'},{offset:'1',color:op.value.color,opacity:'0'}]});}
  const g=normalize(input),index=op.stop;
  if(op.action){
   if(op.changes!==undefined)throw Error('Choose one gradient edit at a time.');
   if(op.action==='setType'){if(index!==undefined||!coordinates[op.value])throw Error('Choose a linear or radial gradient.');g.type=op.value;}
   else if(op.action==='reverse'){if(index!==undefined)throw Error('Reverse the complete gradient.');g.stops=g.stops.reverse().map(stop=>({...stop,offset:String(1-Number(stop.offset))}));}
   else if(['insertStop','removeStop','moveStop'].includes(op.action)){
    if(!Number.isInteger(index)||index<0||index>(op.action==='insertStop'?g.stops.length:g.stops.length-1))throw Error('Choose an existing gradient stop.');
    if(op.action==='insertStop')g.stops.splice(index,0,op.value);
    else if(op.action==='removeStop')g.stops.splice(index,1);
    else{g.stops[index].offset=String(fraction(op.value,0));g.stops.sort((a,b)=>Number(a.offset)-Number(b.offset));}
   }else throw Error('Choose a supported gradient edit.');
  }else{
   if(!op.changes||typeof op.changes!=='object'||Array.isArray(op.changes)||!Object.keys(op.changes).length)throw Error('Provide gradient changes.');
   if(index!==undefined&&(!Number.isInteger(index)||index<0||index>=g.stops.length))throw Error('Choose an existing gradient stop.');
   for(const [name,value]of Object.entries(op.changes)){
    if(index!==undefined){const key={offset:'offset','stop-color':'color','stop-opacity':'opacity'}[name];if(!key)throw Error('Choose a gradient stop property.');g.stops[index][key]=value;}
    else{if(![...coordinates[g.type],'gradientUnits','spreadMethod'].includes(name))throw Error('Choose a gradient coordinate.');if(value===null)delete g.fields[name];else g.fields[name]=value;}
   }
  }
  return normalize(g);
 }
 const api={normalize,render,describe,edit};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeGradient=api;
})(typeof window==='object'?window:globalThis);
