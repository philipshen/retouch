'use strict';
const R=require('../shell/responsive.js'),keys=['--rt-scale-factor','--rt-scale-move-x','--rt-scale-move-y'];
function snapshot(classes){
 const rules=new Map();
 for(const token of classes.split(/\s+/).filter(Boolean)){
  if(!token.includes('--rt-scale-'))continue;
  const {prefix,value}=R.split(token),match=/^!?\[(--rt-scale-(?:factor|move-[xy])):([^\]]+)\]!?$/.exec(value),screen=prefix?/^min-\[(0|[1-9][0-9]*)px\]:$/.exec(prefix):null;
  if(!match||prefix&&!screen||screen&&Number(screen[1])>7680)throw Error('Resolve literal scale-member classes in pixel screen ranges.');
  const width=screen?Number(screen[1]):0,key=match[1],raw=match[2],number=Number(key===keys[0]?raw:raw.replace(/px$/,''));
  if(!Number.isFinite(number)||(key===keys[0]?number<.01||number>100:!/^[-+]?(?:\d*\.)?\d+px$/.test(raw)||Math.abs(number)>100000))throw Error('Resolve bounded scale-member classes.');
  if(!rules.has(width))rules.set(width,{});const range=rules.get(width);
  if(Object.hasOwn(range,key)&&range[key]!==number)throw Error('Resolve conflicting scale-member classes.');range[key]=number;
 }
 const result={},values={[keys[0]]:1,[keys[1]]:0,[keys[2]]:0};
 for(const [width,range]of [...rules].sort(([a],[b])=>a-b)){Object.assign(values,range);result[width]={factor:values[keys[0]],move:[values[keys[1]],values[keys[2]]]};}
 return result;
}
function write(classes,scope,changes){
 if(Object.keys(changes).some(key=>!keys.includes(key)))throw Error('Choose scale-member movement or factor.');
 const active=R.project(classes,scope).split(/\s+/).filter(Boolean).filter(token=>!Object.keys(changes).some(key=>token.replace(/^!|!$/g,'').startsWith('['+key+':')));
 for(const [key,value]of Object.entries(changes))active.push('!['+key+':'+value+']');
 const next=R.replaceScope(classes,active.join(' '),scope);snapshot(next);return next;
}
module.exports={snapshot,write};
