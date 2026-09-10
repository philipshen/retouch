(function(root) {
  'use strict';
  function createHistory({apply,onChange=()=>{},capture=()=>({}),storage,scope,initialState}) {
    const undo=[],redo=[];let busy=false;
    const validScope=scope&&/^[a-f0-9]{64}$/.test(scope.project)&&/^[a-f0-9]{64}$/.test(scope.session),key=validScope?'retouch.history.v1:'+scope.project:null,maxBytes=2*1024*1024;
    const validStack=stack=>Array.isArray(stack)&&stack.length<=100&&stack.every(entry=>entry&&typeof entry==='object'&&!Array.isArray(entry)&&typeof entry.undoId==='string'&&entry.undoId.length>0&&entry.undoId.length<=200&&typeof entry.type==='string'&&entry.type.length<=80&&(entry.route===undefined||entry.route===null||typeof entry.route==='string'&&entry.route.length<=4096));
    if(key&&storage)try{
      const raw=storage.getItem(key);if(raw&&(raw.length>maxBytes||new TextEncoder().encode(raw).length>maxBytes))throw Error('Saved history is too large');const saved=raw?JSON.parse(raw):null;
      if(saved?.version===1&&saved.session===scope.session&&validStack(saved.undo)&&validStack(saved.redo)){undo.push(...saved.undo);redo.push(...saved.redo);}
      else if(raw)storage.removeItem(key);
    }catch{try{storage.removeItem(key);}catch{}}
    function remember(){
      if(!key||!storage)return;
      try{const raw=JSON.stringify({version:1,session:scope.session,undo,redo});if((raw.length>maxBytes||new TextEncoder().encode(raw).length>maxBytes))throw Error('History is too large to persist');storage.setItem(key,raw);}
      catch{try{storage.removeItem(key);}catch{}}
    }

    if(initialState&&validStack(initialState.undo)&&validStack(initialState.redo)){
      const sourceIds=stack=>stack.filter(entry=>entry.type!=='layerLock').map(entry=>entry.undoId);
      if(JSON.stringify([sourceIds(undo),sourceIds(redo)])!==JSON.stringify([sourceIds(initialState.undo),sourceIds(initialState.redo)])){undo.splice(0,undo.length,...initialState.undo);redo.splice(0,redo.length,...initialState.redo);}
      remember();
    }
    const controller={
      get canUndo(){return undo.length>0;}, get canRedo(){return redo.length>0;}, get busy(){return busy;},
      record(entry) {
        if(!entry?.undoId)return;
        if(busy)throw new Error('Cannot record an edit while history is being restored.');
        // Same gesture keeps its initial before-image, but redo needs the last
        // after-image and renderer descriptor, not an intermediate preview.
        const previous=undo.at(-1);
        if(previous?.undoId===entry.undoId) {
          if(Object.hasOwn(entry,'after'))previous.after=entry.after;
          if(Object.hasOwn(entry,'syncInfo'))previous.syncInfo=entry.syncInfo;
        } else undo.push({...capture(entry),...entry});
        if(undo.length>100)undo.shift();
        redo.length=0;remember();onChange(controller);
      },
      async undo(){return restore('undo',undo,redo);},
      async redo(){return restore('redo',redo,undo);},
    };
    async function restore(type,from,to) {
      if(busy)return {ok:false,busy:true};
      const entry=from.at(-1);
      if(!entry)return {ok:false,empty:true};
      busy=true;onChange(controller);
      try {
        const result=await apply(type,entry);
        // Refusals and network failures retain the entry for a safe retry.
        if(result?.ok){from.pop();to.push(entry);remember();}
        return result;
      } finally {busy=false;onChange(controller);}
    }
    return controller;
  }
  function createGestureGroups() {
    let sequence=0,active=null;
    const prefix=globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    return {
      begin(kind,key) {
        if(active?.kind===kind && active.key===key)return active.id;
        active={kind,key,id:prefix+':'+(++sequence)};return active.id;
      },
      current(key) {return active && (key===undefined || active.key===key)?active.id:undefined;},
      end(kind) {if(!kind || active?.kind===kind)active=null;},
    };
  }
  const api={createHistory,createGestureGroups};
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.RetouchHistory=api;
})(globalThis);
