'use strict';
function payload(snapshot, sequence, epoch) {
 return { revision:snapshot.revision, signature:require('./svelte-source.cjs').contentHash(snapshot.signature), sequence, epoch, texts:snapshot.texts, componentProps:snapshot.componentProps||{}, attributes:snapshot.styling?.attributes||{}, styleIds:snapshot.styling?.ids||{}, css:snapshot.styling?.css||null };
}
function runtime(){return `import {writable} from 'svelte/store';
export function literalProp(value){return JSON.parse(value);}
export const componentState=(${require('./svelte-component-state.cjs').createRegistry.toString()})();
const states=new Map(),styles=new Map();let requestId=0;
function applyCSS(file,css){
 if(!css){styles.get(file)?.remove();styles.delete(file);return;}
 if(typeof document==='undefined')return;
 let element=document.querySelector('style[data-rt-svelte-css="'+css.id+'"]');
 if(!element){element=document.createElement('style');element.setAttribute('data-rt-svelte-css',css.id);document.head.append(element);}
 styles.set(file,element);
 if(element.textContent!==css.text)element.textContent=css.text;
}
function request(file,record){
 if(!import.meta.hot||record.pending&&Date.now()-record.pending.at<1000)return;
 const id=++requestId;record.pending={id,at:Date.now()};
 import.meta.hot.send('retouch:svelte-sync',{file,request:id});
}
function apply(file,record,data){
 if(record.epoch!==null&&record.epoch!==data.epoch){import.meta.hot?.invalidate('Retouch source server changed.');return;}
 if(data.sequence<=record.sequence)return;
 record.epoch=data.epoch;record.sequence=data.sequence;
 if(data.signature!==record.signature){
  if(!record.invalidated){record.invalidated=true;import.meta.hot?.invalidate('Svelte component structure changed while its preview was unavailable.');}
  return;
 }
 record.ready=true;
 if(record.revision===data.revision)return;
 record.revision=data.revision;applyCSS(file,data.css);record.store.set(data);
}
export function sourceState(file,initial){
 let record=states.get(file);
 if(!record||record.signature!==initial.signature){
  const store=record?.store||writable(initial);
  if(record)store.set(initial);
  record={store,signature:initial.signature,revision:initial.revision,epoch:null,sequence:-1,ready:false,pending:null,queued:null};
  states.set(file,record);applyCSS(file,initial.css);
 }
 request(file,record);return record.store;
}
function receive(data,snapshot=false){
 const dictionary=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(item=>typeof item==='string');
 const props=value=>value===undefined||dictionary(value)&&Object.values(value).every(item=>{try{const parsed=JSON.parse(item);return ['string','boolean'].includes(typeof parsed)||typeof parsed==='number'&&Number.isFinite(parsed);}catch{return false;}});
 if(!data||!props(data.componentProps)||typeof data.file!=='string'||!Number.isSafeInteger(data.sequence)||data.sequence<0||typeof data.epoch!=='string'||!data.epoch||![data.signature,data.revision].every(value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value))||!dictionary(data.texts)||!dictionary(data.styleIds)||!dictionary(data.attributes)||data.css!==null&&(!data.css||!/^[a-f0-9]{10}$/.test(data.css.id)||typeof data.css.text!=='string'))return;
 const record=states.get(data.file);if(!record)return;
 if(snapshot){
  if(record.pending?.id!==data.request)return;
  record.pending=null;
  const queued=record.queued;record.queued=null;
  apply(data.file,record,queued&&queued.epoch===data.epoch&&queued.sequence>data.sequence?queued:data);
 }else if(!record.ready){
  if(!record.queued||record.queued.epoch!==data.epoch||record.queued.sequence<data.sequence)record.queued=data;
  request(data.file,record);
 }else apply(data.file,record,data);
}
function synchronize(){for(const [file,record]of states)request(file,record);}
function visible(){if(document.visibilityState==='visible')synchronize();}
if(import.meta.hot){
 import.meta.hot.on('retouch:svelte-source',data=>receive(data));
 import.meta.hot.on('retouch:svelte-snapshot',data=>receive(data,true));
 if(typeof window!=='undefined'){
  for(const event of ['focus','pageshow','retouch:source-sync'])window.addEventListener(event,synchronize);
  document.addEventListener('visibilitychange',visible);
  import.meta.hot.dispose(()=>{for(const event of ['focus','pageshow','retouch:source-sync'])window.removeEventListener(event,synchronize);document.removeEventListener('visibilitychange',visible);});
 }
}
`;}
module.exports={runtime,payload};
