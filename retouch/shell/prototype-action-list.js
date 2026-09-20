(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./prototype-values.js'),require('./prototype-expressions.js'));else root.RetouchPrototypeActionList=factory(root.RetouchPrototypeValues,root.RetouchPrototypeExpressions);})(typeof globalThis!=='undefined'?globalThis:this,function(V,E){
 'use strict';
 const cancelled=Symbol('cancelled');
 function validate(input){
  let count=0;
  function list(items,depth){
   if(!Array.isArray(items)||depth>16)throw Error('Use an action list with at most 16 conditional levels.');
   return items.map(item=>{
    if(++count>128)throw Error('Use at most 128 actions per interaction.');
    if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Choose a prototype action.');
    if(item.action==='conditional'){
     if(Object.keys(item).some(key=>!['action','condition','then','else'].includes(key)))throw Error('Invalid conditional action.');
     const checked=E.analyze(item.condition);if(checked.type!=='boolean')throw Error('A condition must return true or false.');
     return {action:'conditional',condition:checked.expression,then:list(item.then,depth+1),else:list(item.else,depth+1)};
    }
    if(['trigger','shortcut','delay'].some(key=>Object.hasOwn(item,key)))throw Error('Actions share their interaction’s trigger.');
    const {trigger,...action}=V.validate([{trigger:'click',...item}])[0];return action;
   });
  }
  const result=list(input,0);if(!result.length)throw Error('Add at least one action.');
  if(JSON.stringify(result).length>131072)throw Error('Prototype actions exceed the source size limit.');return result;
 }
 // Stop waiting immediately on cancellation. A callback receives the signal so
 // it can also cancel its own in-flight side effects. Rejections are observed.
 function pending(work,signal){
  if(signal.aborted)return Promise.resolve(cancelled);
  return new Promise((resolve,reject)=>{
   const abort=()=>{cleanup();resolve(cancelled);},cleanup=()=>signal.removeEventListener('abort',abort);
   signal.addEventListener('abort',abort,{once:true});
   Promise.resolve().then(()=>signal.aborted?cancelled:work()).then(value=>{cleanup();resolve(signal.aborted?cancelled:value);},error=>{cleanup();if(signal.aborted)resolve(cancelled);else reject(error);});
  });
 }
 function create({perform,evaluate}){
  if(typeof perform!=='function'||typeof evaluate!=='function')throw Error('Provide action and condition handlers.');
  let generation=new AbortController(),queue=Promise.resolve();
  function run(input,{signal:external}={}){
   // Validate and snapshot at trigger time, before joining another action run.
   const actions=validate(input),controller=new AbortController(),signal=controller.signal,current=generation.signal;
   const abort=()=>controller.abort();current.addEventListener('abort',abort,{once:true});external?.addEventListener('abort',abort,{once:true});if(current.aborted||external?.aborted)abort();
   let completed=0;
   async function execute(items){
    for(const item of items){
     if(signal.aborted)return false;
     if(item.action==='conditional'){
      const result=await pending(()=>evaluate(item.condition,{signal}),signal);if(result===cancelled)return false;
      if(!result||result.type!=='boolean'||typeof result.value!=='boolean')throw Error('A prototype condition did not return true or false.');
      completed++;if(!await execute(result.value?item.then:item.else))return false;
     }else{
      const result=await pending(()=>perform(item,{signal}),signal);if(result===cancelled)return false;
      if(result===false||result?.ok===false)throw Error(result?.reason||'The prototype action could not complete.');completed++;
     }
    }
    return true;
   }
   const task=queue.then(()=>execute(actions));queue=task.catch(()=>{});
   return pending(()=>task,signal).then(done=>({completed:done!==cancelled&&done,actions:completed})).finally(()=>{current.removeEventListener('abort',abort);external?.removeEventListener('abort',abort);});
  }
  return {run,reset(){generation.abort();generation=new AbortController();queue=Promise.resolve();}};
 }
 return {validate,create};
});
