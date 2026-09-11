'use strict';
const crypto = require('node:crypto');
const {applyPlan} = require('./transactions.cjs');

// Groups are explicit interaction identities, never a timing heuristic. Entries
// retain the first before-image and the last after-image for every touched file.
class SourceHistory {
  constructor(limit = 100) { this.limit=limit; this.undo=[]; this.redo=[]; this.group=null; }
  record(edits, group) {
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
      return last.id;
    }
    const entry={id:crypto.randomBytes(16).toString('hex'),edits:edits.map(e=>({...e}))};
    this.undo.push(entry); this.group=group || null;
    if(this.undo.length>this.limit)this.undo.shift();
    return entry.id;
  }
  apply(root, type, id, adapter) {
    const from=type==='undo'?this.undo:this.redo;
    const to=type==='undo'?this.redo:this.undo;
    const entry=from.at(-1);
    if(!entry || entry.id!==id)return {ok:false,reason:`This ${type} is no longer available. Undo and redo must follow edit order.`};
    const edits=type==='undo'?[...entry.edits].reverse().map(e=>({file:e.file,before:e.after,after:e.before})):entry.edits;
    const excluded=edits.map(e=>e.file);
    for(const edit of edits) {
      if(edit.after===null && edit.before!==null && adapter.hasReference?.(root,edit.file,excluded))return {ok:false,reason:'Another file now refers to the detached module. Undo was not applied.'};
    }
    const result=applyPlan(root,{ok:true,edits});
    if(!result.ok)return result;
    from.pop();to.push(entry);this.group=null;
    return {...result,undoId:entry.id};
  }
}
module.exports={SourceHistory};
