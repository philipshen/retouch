(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues,P=typeof module==='object'&&module.exports?require('./palette-values.js'):root.RetouchPaletteValues;
 const properties={'filter':'--rt-hidden-filter','backdrop-filter':'--rt-hidden-backdrop-filter'},fail=()=>{throw Error('The saved filter visibility does not match this filter stack.');};
 function normalize(item){
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['raw','hidden'].includes(key))||typeof item.raw!=='string'||item.hidden!==undefined&&typeof item.hidden!=='boolean')fail();
  const filters=V.parseFilters(item.raw);if(filters?.length!==1)fail();return {raw:filters[0].raw,hidden:item.hidden??false};
 }
 function render(stack){return stack.filter(item=>!item.hidden).map(item=>item.raw).join(' ')||'none';}
 function metadata(value){
  if(value==='none')return null;
  if(typeof value!=='string'||value.length>65536||!/^rtfx1-(?:[a-f\d]{2})+$/.test(value))fail();
  let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(value.slice(6).match(/../g),hex=>parseInt(hex,16))));}catch{fail();}
  if(!data||Object.keys(data).sort().join(',')!=='stack,version'||data.version!==1||!Array.isArray(data.stack)||data.stack.length>16)fail();
  const stack=data.stack.map(normalize);if(!stack.some(item=>item.hidden)||V.parseFilters(stack.map(item=>item.raw).join(' '))===null)fail();return stack;
 }
 function signature(css){
  const filters=V.parseFilters(css);if(filters===null)fail();const number=n=>Number(n.toPrecision(6));
  return JSON.stringify(filters.map(filter=>{
   if(filter.name==='drop-shadow'){const shadow=V.parseShadows(filter.arg)[0];let color;try{const paint=P.parse(P.fromComputed(shadow.color));color=[paint.space,...paint.channels.map(number),number(paint.alpha)];}catch{color=shadow.color.toLowerCase().replace(/\s+/g,' ');}return [filter.name,shadow.x,shadow.y,shadow.blur,color];}
   let amount=parseFloat(filter.arg);if(filter.name==='hue-rotate')amount*=filter.arg.endsWith('turn')?360:filter.arg.endsWith('rad')?180/Math.PI:1;else if(filter.name!=='blur'&&filter.arg.endsWith('%'))amount/=100;
   return [filter.name,number(amount)];
  }));
 }
 function read(css,value='none'){
  const stack=metadata(value);if(!stack){const parsed=V.parseFilters(css);if(parsed===null)fail();return parsed.map(filter=>({raw:filter.raw,hidden:false}));}
  if(signature(render(stack))!==signature(css))fail();return stack;
 }
 function write(property,input){
  if(!Object.hasOwn(properties,property)||!Array.isArray(input)||input.length>16)fail();const stack=input.map(normalize),all=stack.map(item=>item.raw).join(' ')||'none';if(V.parseFilters(all)===null)fail();
  const value=stack.some(item=>item.hidden)?'rtfx1-'+Array.from(new TextEncoder().encode(JSON.stringify({version:1,stack})),byte=>byte.toString(16).padStart(2,'0')).join(''):'none';if(value!=='none')metadata(value);
  return {[property]:render(stack),[properties[property]]:value};
 }
 function withBlur(input,amount){
  if(!Array.isArray(input))fail();const stack=input.map(normalize),filters=stack.map(item=>V.parseFilters(item.raw)[0]);if(filters.filter(item=>item.name==='blur').length>1||!Number.isFinite(amount)||amount<0||amount>1000)fail();
  let found=false;const next=[];for(let i=0;i<stack.length;i++){if(filters[i].name==='blur'){found=true;if(amount)next.push({...stack[i],raw:'blur('+amount+'px)'});}else next.push(stack[i]);}if(!found&&amount)next.push({raw:'blur('+amount+'px)',hidden:false});return next;
 }
 function classes(source,scope,property,changes){
  const key=properties[property];if(!key||!changes||Object.keys(changes).sort().join(',')!==[property,key].sort().join(','))fail();
  const css=changes[property],value=changes[key];if(css===null||value===null){if(css!==null||value!==null)fail();}else read(css,value);
  const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector,R=typeof module==='object'&&module.exports?require('./responsive.js'):root.RetouchResponsive;
  const next=I.replace(I.filterClasses(R.project(source,scope),property,css),token=>token.startsWith('['+key+':'),value===null?'':'!['+key+':'+value+']');return R.replaceScope(source,next,scope);
 }
 const api={properties,read,write,classes,metadata,withBlur};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchFilterVisibility=api;
})(typeof window==='object'?window:globalThis);
