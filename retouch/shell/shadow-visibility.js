(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues,P=typeof module==='object'&&module.exports?require('./palette-values.js'):root.RetouchPaletteValues;
 const property='--rt-hidden-shadows',keys=['x','y','blur','spread','color','inset'],fail=()=>{throw Error('The hidden shadow settings changed outside Retouch. Restore or update their source first.');};
 function normalize(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)&&key!=='hidden')||keys.some(key=>!Object.hasOwn(value,key))||typeof value.inset!=='boolean'||value.hidden!==undefined&&typeof value.hidden!=='boolean')fail();
  for(const key of ['x','y','blur','spread'])if(!Number.isFinite(value[key]))fail();
  const color=P.fromComputed(value.color),shadow=Object.fromEntries(keys.map(key=>[key,key==='color'?color:value[key]]));
  if(V.parseShadows(V.serializeShadows([shadow]))?.length!==1)fail();return {...shadow,hidden:value.hidden??false};
 }
 function transparent(color){const paint=P.parse(color);return paint.space==='display-p3'?P.p3(paint.channels,0):P.srgb(paint.channels,0);}
 function decode(value){
  if(value==='none')return [];
  if(typeof value!=='string'||value.length>65536||!/^rtsh1-(?:[a-f\d]{2})+$/.test(value))fail();
  let data;try{const bytes=Uint8Array.from(value.slice(6).match(/../g),hex=>parseInt(hex,16));data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail();}
  if(!data||Object.keys(data).sort().join(',')!=='hidden,version'||data.version!==1||!Array.isArray(data.hidden)||data.hidden.length>16)fail();
  const seen=new Set();return data.hidden.map(entry=>{if(!entry||Object.keys(entry).sort().join(',')!=='index,shadow'||!Number.isInteger(entry.index)||entry.index<0||entry.index>=16||seen.has(entry.index)||!entry.shadow||Object.keys(entry.shadow).some(key=>!keys.includes(key)))fail();seen.add(entry.index);return {index:entry.index,shadow:normalize(entry.shadow)};});
 }
 function read(css,metadata='none'){
  const parsed=V.parseShadows(css);if(parsed===null)fail();const shadows=parsed.map(normalize);
  for(const {index,shadow}of decode(metadata)){
   const current=shadows[index];if(!current||['x','y','blur','spread','inset'].some(key=>current[key]!==shadow[key]))fail();
   const actual=P.parse(current.color),expected=P.parse(shadow.color);if(actual.alpha!==0||actual.space!==expected.space||actual.channels.some((channel,i)=>Math.abs(channel-expected.channels[i])>1e-6))fail();
   shadows[index]={...shadow,hidden:true};
  }
  return shadows;
 }
 function write(input){
  if(!Array.isArray(input)||input.length>16)fail();const shadows=input.map(normalize),hidden=shadows.flatMap((shadow,index)=>shadow.hidden?[{index,shadow:Object.fromEntries(keys.map(key=>[key,shadow[key]]))}]:[]);
  const metadata=hidden.length?'rtsh1-'+Array.from(new TextEncoder().encode(JSON.stringify({version:1,hidden})),byte=>byte.toString(16).padStart(2,'0')).join(''):'none';decode(metadata);
  const css=V.serializeShadows(shadows.map(shadow=>({...shadow,color:shadow.hidden?transparent(shadow.color):shadow.color})));if(V.parseShadows(css)===null)fail();return {'box-shadow':css,[property]:metadata};
 }
 function update(css,metadata,index,changes){
  const shadows=read(css,metadata);if(!Number.isInteger(index)||index<0||index>=shadows.length||!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(key=>!keys.includes(key)&&key!=='hidden'))fail();
  const next=normalize({...shadows[index],...changes});if(JSON.stringify(next)===JSON.stringify(shadows[index]))return {};shadows[index]=next;return write(shadows);
 }
 function classes(source,scope,changes){
  if(!changes||Object.keys(changes).sort().join(',')!==[property,'box-shadow'].sort().join(','))fail();
  const css=changes['box-shadow'],metadata=changes[property];if(css===null||metadata===null){if(css!==null||metadata!==null)fail();}else read(css,metadata);
  const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector,R=typeof module==='object'&&module.exports?require('./responsive.js'):root.RetouchResponsive;
  const projected=R.project(source,scope),paint=I.shadowClasses(projected,css),next=I.replace(paint,token=>token.startsWith('['+property+':'),metadata===null?'':'!['+property+':'+metadata+']');return R.replaceScope(source,next,scope);
 }
 const api={property,read,write,update,classes,metadata:decode};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchShadowVisibility=api;
})(typeof window==='object'?window:globalThis);
