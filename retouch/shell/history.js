(function(root) {
  'use strict';
  function createHistory({apply,onChange=()=>{}}) {
    const undo=[],redo=[];let busy=false;
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
        } else undo.push({...entry});
        if(undo.length>100)undo.shift();
        redo.length=0;onChange(controller);
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
        if(result?.ok){from.pop();to.push(entry);}
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
