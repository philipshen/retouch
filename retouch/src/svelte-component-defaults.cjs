'use strict';
const compiler=require('svelte/compiler'),MagicString=require('magic-string'),source=require('./svelte-source.cjs'),props=require('./svelte-component-props.cjs');
function read(text){
 const ast=compiler.parse(text,{modern:true}),defaults=new Map();
 const add=(name,expression)=>{const value=props.literal({type:'Attribute',value:{type:'ExpressionTag',expression}});if(value&&typeof name==='string')defaults.set(name,value);};
 for(const statement of ast.instance?.content.body||[]){
  if(statement.type==='ExportNamedDeclaration'&&statement.declaration?.type==='VariableDeclaration'&&statement.declaration.kind==='let')for(const item of statement.declaration.declarations)if(item.id.type==='Identifier'&&item.init)add(item.id.name,item.init);
  if(statement.type==='VariableDeclaration')for(const item of statement.declarations)if(item.id.type==='ObjectPattern'&&item.init?.type==='CallExpression'&&item.init.callee.name==='$props')for(const property of item.id.properties)if(property.type==='Property'&&!property.computed&&property.value.type==='AssignmentPattern'&&property.value.left.type==='Identifier')add(property.key.name||property.key.value,property.value.right);
 }
 return defaults;
}
function plan(r,op,def){try{
 if(op.fileHash!==r.hash)throw Error('The component usage changed. Re-select it.');
 const defaults=read(def.text),fallback=defaults.get(op.name),hash=source.contentHash(def.text),info=props.describe(r),existing=info.props.find(p=>p.name===op.name);
 const contracts=require('./svelte-component-choices.cjs').read(def.text),contract=contracts.get(op.name),remove=op.reset===true||op.clear===true;
 if(op.reset&&op.clear)throw Error('Choose reset or unset, not both.');
 if(op.definitionHash!==hash||!fallback&&!contract?.supported)throw Error('The component default or type changed. Re-select the instance.');
 if(op.reset&&!fallback)throw Error('This property has no editable literal default.');
 if(op.clear&&(!contract?.optional||contracts.hasDefault(op.name)))throw Error('Only an optional property without a default can be unset.');
 if(!remove&&!fallback&&contracts.hasDefault(op.name))throw Error('This property uses a computed default.');
 if(existing&&!existing.editable||info.element.node.attributes.some(a=>a.type==='SpreadAttribute'))throw Error('This property is controlled by a binding or spread.');
 if(!/^[A-Za-z_$][\w$-]*$/.test(op.name)||/^(?:data-rt|__retouch)/.test(op.name)||['children','slot','this'].includes(op.name))throw Error('This property has special component behavior.');
 const type=contract?.supported?contract.type:fallback?.type;
 if(!remove&&(typeof op.value!==type||type==='number'&&!Number.isFinite(op.value)||type==='string'&&(op.value.length>100000||op.value.includes('\0'))))throw Error('Use a valid '+type+' property value.');
 const out=new MagicString(r.source),attribute=info.element.node.attributes.find(a=>a.name===op.name);
 if(remove){if(attribute){let start=attribute.start;while(start>info.element.start+1+info.element.tag.length&&/\s/.test(r.source[start-1]))start--;out.remove(start,attribute.end);}}
 else{if(attribute)throw Error('Edit the existing property through its literal editor.');const value=Object.is(op.value,-0)?'-0':JSON.stringify(op.value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');out.appendLeft(info.element.start+1+info.element.tag.length,' '+op.name+'={'+value+'}');}
 const after=out.toString(),next=source.collect(after,r.relPath);for(const key of ['elements','components'])if(info.parsed[key].length!==next[key].length||info.parsed[key].some((e,i)=>e.id!==next[key][i].id||e.tag!==next[key][i].tag))throw Error('The default edit would change source identities.');compiler.compile(after,{filename:r.relPath,generate:false});
 const saved=props.describe({...r,source:after},next).props.find(p=>p.name===op.name);if(remove?saved!==undefined:!Object.is(saved?.value,op.value))throw Error('The component property was not preserved.');
 const parent=info.parsed.elements.filter(e=>e.start<info.element.start&&e.end>=info.element.end).sort((a,b)=>b.start-a.start)[0];
 return {ok:true,hash:source.contentHash(after),componentProp:{instanceId:r.element.id,parentId:parent?.id||null},edits:after===r.source?[]:[{file:r.file,before:r.source,after},...(def.file!==r.file?[{file:def.file,before:def.text,after:def.text}]:[])]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
// Legacy Svelte intentionally does not restore a fallback after a runtime prop
// becomes undefined. Only an editor source revision removing a previously
// present key resets that fallback; runtime changes and local writes stay native.
function legacyProp(access,props,key,fallback){
 let revision=props['data-rt-i-revision'],present=Object.hasOwn(props,key),reset=false;
 return function(...args){
  const next=props['data-rt-i-revision'],has=Object.hasOwn(props,key);
  if(next!==revision&&next&&revision){if(present&&!has)reset=true;else if(has)reset=false;}
  revision=next;present=has;
  if(args.length){reset=false;return access(...args);}
  const value=access();return reset?fallback:value;
 };
}
module.exports={read,plan,legacyProp};
