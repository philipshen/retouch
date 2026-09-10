'use strict';
// Adapters plan source edits; this shared layer owns containment, stale-file
// checks, atomic replacement, rollback, and the exact snapshots used by undo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const refuse = reason => ({ok:false,refused:true,reason});

function current(file) {
  return fs.existsSync(file) ? fs.readFileSync(file,'utf8') : null;
}
function replace(edit) {
  if (edit.after === null) { fs.unlinkSync(edit.file); return; }
  if (edit.before === null) { fs.writeFileSync(edit.file,edit.after,{flag:'wx'}); return; }
  const tmp = path.join(path.dirname(edit.file),'.retouch-'+crypto.randomBytes(12).toString('hex')+'.tmp');
  try { fs.writeFileSync(tmp,edit.after,{flag:'wx'}); fs.renameSync(tmp,edit.file); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
function applyPlan(root, plan) {
  if (!plan?.ok) return plan;
  const done = [];
  try {
    const realRoot = fs.realpathSync(root);
    const seen = new Set();
    for (const edit of plan.edits) {
      const parent = fs.realpathSync(path.dirname(edit.file));
      const file = path.join(parent,path.basename(edit.file));
      if (!file.startsWith(realRoot+path.sep) || (fs.existsSync(file) && fs.realpathSync(file)!==file)) throw new Error('The source edit is outside the project or follows a symbolic link.');
      if (seen.has(file)) throw new Error('The operation contains conflicting edits to one file.');
      seen.add(file);
      if (![edit.before,edit.after].every(v=>v===null||typeof v==='string')) throw new Error('Invalid source edit.');
      if (current(edit.file)!==edit.before) throw new Error('The source changed. Re-select the element before saving.');
    }
    for (const edit of plan.edits) {
      if (edit.before===edit.after) continue;
      replace(edit); done.push(edit);
    }
    return {...plan,edits:done};
  } catch(err) {
    const failures=[];
    for (const edit of done.reverse()) {
      try { replace({file:edit.file,before:edit.after,after:edit.before}); }
      catch(rollback) { failures.push(rollback.message); }
    }
    return {...refuse(err.message+(failures.length?' Rollback failed: '+failures.join('; '):'')),...(failures.length?{rollbackFailed:true}:{})};
  }
}
module.exports = {applyPlan};
