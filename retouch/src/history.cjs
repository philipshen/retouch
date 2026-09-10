'use strict';
const crypto = require('node:crypto');
const {applyPlan} = require('./transactions.cjs');

// Groups are explicit interaction identities, never a timing heuristic. Entries
// retain the first before-image and the last after-image for every touched file.
class SourceHistory {
  constructor(limit = 100, {store} = {}) { this.limit=limit; this.store=store;const saved=store?.load?.();this.undo=saved?.undo||[];this.redo=saved?.redo||[];this.group=null;this.persistenceError=null; }
  get recoveryRequired(){return !!this.pending||!!this.recoveryError;}
  persist(){try{this.store?.save({undo:this.undo,redo:this.redo,...(this.pending?{pending:this.pending}:{})});this.persistenceError=null;}catch(error){this.persistenceError=error.message;}}
  snapshot(){const entries=stack=>stack.map(entry=>({type:'sourceHistory',undoId:entry.id,route:entry.route}));return {undo:entries(this.undo),redo:entries(this.redo)};}
  record(edits, group, route) {
    if (!edits.length) return null;
    const last=this.undo.at(-1);
    const canMerge=group && group===this.group && last && edits.every(edit=> {
      const previous=last.edits.find(e=>e.file===edit.file);
      return !previous || previous.after===edit.before;
    });
    this.redo=[];
    if (canMerge) {
      for(const edit of edits) {
        const previous=last.edits.find(e=>e.file===edit.file);
        if(previous) previous.after=edit.after;
        else last.edits.push({...edit});
      }
      this.persist();return last.id;
    }
    const entry={id:crypto.randomBytes(16).toString('hex'),edits:edits.map(e=>({...e})),...(typeof route==='string'&&route.startsWith('/')&&!route.startsWith('//')&&route.length<=4096?{route}:{})};
    this.undo.push(entry); this.group=group || null;
    if(this.undo.length>this.limit)this.undo.shift();
    this.persist();return entry.id;
  }
  commit(root,plan,{group,route}={}){
    if(!plan?.ok)return plan;
    if(this.recoveryRequired)return {ok:false,refused:true,reason:'An incomplete source operation requires recovery before more edits can be applied.'};
    const edits=plan.edits.filter(edit=>edit.before!==edit.after);
    if(!edits.length)return applyPlan(root,plan);
    const entry={id:crypto.randomBytes(16).toString('hex'),edits:edits.map(edit=>({...edit})),...(typeof route==='string'&&route.startsWith('/')&&!route.startsWith('//')&&route.length<=4096?{route}:{})};
    this.pending={type:'record',entry,owner:process.pid};this.persist();
    const result=applyPlan(root,plan);if(!result.rollbackFailed)this.pending=null;
    if(!result.ok){this.persist();if(result.rollbackFailed)this.persistenceError='An incomplete source operation requires recovery.';return result;}
    const undoId=this.record(result.edits,group,route);return {...result,undoId};
  }
  apply(root, type, id, adapter) {
    if(this.recoveryRequired)return {ok:false,reason:'An incomplete source restore requires recovery before more history can be applied.'};
    const from=type==='undo'?this.undo:this.redo;
    const to=type==='undo'?this.redo:this.undo;
    const entry=from.at(-1);
    if(!entry || entry.id!==id)return {ok:false,reason:`This ${type} is no longer available. Undo and redo must follow edit order.`};
    const edits=type==='undo'?[...entry.edits].reverse().map(e=>({file:e.file,before:e.after,after:e.before})):entry.edits;
    const excluded=edits.map(e=>e.file);
    for(const edit of edits) {
      if(edit.after===null && edit.before!==null && adapter.hasReference?.(root,edit.file,excluded))return {ok:false,reason:'Another file now refers to the detached module. Undo was not applied.'};
    }
    this.pending={type,id,owner:process.pid};this.persist();
    const result=applyPlan(root,{ok:true,edits});
    if(!result.rollbackFailed)this.pending=null;
    if(!result.ok){this.persist();if(result.rollbackFailed)this.persistenceError='An incomplete source restore requires recovery.';return result;}
    from.pop();to.push(entry);this.group=null;this.persist();
    return {...result,undoId:entry.id};
  }
}
module.exports={SourceHistory};
