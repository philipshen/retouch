'use strict';
const crypto=require('node:crypto'),MagicString=require('magic-string'),P=require('./prototype-interactions.cjs'),V=require('../shell/prototype-values.js');
const refuse=reason=>({ok:false,refused:true,reason});
function plan(source,target,op,adapter){try{
 if(!target||source.hash!==op.fileHash||target.hash!==op.targetHash)throw Error('The source or destination changed. Pick the destination again.');
 if(Object.keys(op).some(key=>!['type','id','fileHash','context','index','targetId','targetHash','targetContext','creation','actionPath'].includes(key))||!Number.isInteger(op.index))throw Error('Invalid prototype connection.');
 const items=P.metadata(source,adapter).interactions,creating=op.creation!==undefined;let selected=items[op.index];if(op.actionPath!==undefined){if(creating)throw Error('Choose an existing action.');selected=require('../shell/prototype-action-list.js').locate(selected?.actions,op.actionPath);}if(creating){if(op.index!==items.length||!op.creation||typeof op.creation!=='object'||Array.isArray(op.creation)||Object.keys(op.creation).some(key=>!['trigger','delay','shortcut'].includes(key)))throw Error('Choose a new interaction trigger.');V.validate([...items,{...op.creation,action:'scroll',destination:'pending'}]);}else if(selected?.action!=='scroll')throw Error('Choose a Scroll to interaction.');
 const meta=P.metadata(target,adapter,'id');let anchor=meta.old?.value;
 if(meta.old&&(!anchor||anchor.length>256||/[\u0000-\u0020\u007f]/.test(anchor)))throw Error('This layer has an unsupported destination ID.');
 const targetBefore=target.source;let targetAfter=targetBefore;
 if(!anchor){anchor='rt-'+crypto.randomBytes(12).toString('hex');const out=new MagicString(target.source);out.appendLeft(meta.insert,' id="'+anchor+'"');targetAfter=out.toString();}
 const elements=adapter.collect(targetAfter,target.relPath).elements;
 if(JSON.stringify(elements.map(e=>e.id))!==JSON.stringify(target.elements.map(e=>e.id)))throw Error('The anchor would change source identities.');
 if(source.file===target.file)source={...source,source:targetAfter,hash:adapter.contentHash(targetAfter),elements,element:elements.find(e=>e.id===source.element.id)};
 const next=structuredClone(items);if(creating)next.push({...op.creation,action:'scroll',destination:anchor});else if(op.actionPath!==undefined)require('../shell/prototype-action-list.js').locate(next[op.index].actions,op.actionPath).destination=anchor;else next[op.index].destination=anchor;const update=P.plan(source,{type:'setPrototypeInteractions',id:source.element.id,fileHash:source.hash,context:source.context,interactions:next},adapter);
 if(!update.ok)return update;
 const after=update.edits[0]?.after??source.source,edits=source.file===target.file?[{file:source.file,before:targetBefore,after}]:[{file:target.file,before:targetBefore,after:targetAfter},...update.edits];
 return {ok:true,edits:edits.filter(edit=>edit.before!==edit.after),anchor};
 }catch(error){return refuse(error.message);}}
module.exports={plan};
