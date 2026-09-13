'use strict';
const rangeStyles=require('../shell/range-style-values.js');
const WRAP_TAGS = new Set(['strong', 'em', 'u', 's', 'sup', 'sub']);

function validateChildrenTree(children, depth) {
  if (!Array.isArray(children)) return 'setChildren needs a children array.';
  if (depth > 8) return 'Nesting too deep.';
  for (const c of children) {
    if (!c || typeof c !== 'object') return 'Bad node.';
    if (c.t === 'text') {
      if (typeof c.value !== 'string' || c.value.length > 10000) return 'Bad text node.';
    } else if (c.t === 'wrap') {
      if (!WRAP_TAGS.has(c.tag)) return `Formatting tag not allowed: ${String(c.tag)}`;
      const err = validateChildrenTree(c.children, depth + 1);
      if (err) return err;
    } else if (c.t === 'style') {
      if (!rangeStyles.valid(c.property,c.value)) return 'Unsupported text range style.';
      const err = validateChildrenTree(c.children, depth + 1);
      if (err) return err;
    } else if (c.t === 'keep') {
      if (!/^[0-9a-f]{10}$/.test(c.id || '')) return 'Bad keep id.';
      if (c.children) {
        const err = validateChildrenTree(c.children, depth + 1);
        if (err) return err;
      }
    } else {
      return 'Unknown node type.';
    }
  }
  return null;
}


function styleMarkup(node,content,jsx=false) {
  if(!rangeStyles.valid(node.property,node.value))throw new Error('Unsupported text range style.');
  const attribute=jsx?'style={{'+rangeStyles.camel(node.property)+':'+JSON.stringify(node.value)+'}}':'style="'+node.property+': '+node.value+';"';
  return '<span '+attribute+'>'+content+'</span>';
}
module.exports={validateChildrenTree,styleMarkup};
