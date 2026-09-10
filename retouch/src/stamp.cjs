'use strict';
// The stamper: compile-time transform that adds data-rt / data-rt-i
// attributes to JSX elements in the *compiled* output. Source files on
// disk are never modified (RFC-0001, "stamp").

const path = require('node:path');
const MagicString = require('magic-string');
const { collectElements, contentHash } = require('./id.cjs');

const HOST_ATTR = 'data-rt';
const INSTANCE_ATTR = 'data-rt-i';

function toPosixRel(appRoot, filePath) {
  return path.relative(appRoot, filePath).split(path.sep).join('/');
}

// Returns { code, map } or null when there is nothing to stamp.
// Throws on parse errors; callers treat any throw as "serve unstamped"
// (fault isolation, OQ-B1 residual d).
function stamp(source, filePath, appRoot) {
  if (!/\.(tsx|jsx)$/.test(filePath)) return null;
  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return null;
  if (!source.includes('<')) return null;

  const relPath = toPosixRel(appRoot, filePath);
  const { ast, elements } = collectElements(source, relPath);
  if (elements.length === 0) return null;

  const ms = new MagicString(source),revision=contentHash(source);
  for (const el of elements) {
    if(el.kind==='host')ms.appendLeft(el.node.openingElement.end-(el.node.openingElement.selfClosing?2:1),` data-rt-revision="${revision}"`);
    const attr = el.kind === 'host' ? HOST_ATTR : INSTANCE_ATTR;
    const insertAt = el.node.openingElement.name.end;
    ms.appendLeft(insertAt, ` ${attr}="${el.id}"`);
  }
  // Explicitly created components keep their instance marker on the root host
  // without adding editor props or attributes to production source.
  require('@babel/traverse').default(ast,{FunctionDeclaration(p){
    if(!p.node.leadingComments?.some(comment=>comment.value.trim()==='* @retouch-component'))return;
    for(const statement of p.node.body.body){
      const node=statement.type==='ReturnStatement'?statement.argument:null;
      if(node?.type!=='JSXElement'||!elements.some(el=>el.node===node&&el.kind==='host'))continue;
      if(node.openingElement.attributes.some(attr=>attr.name?.name===INSTANCE_ATTR))continue;
      ms.appendLeft(node.openingElement.end-(node.openingElement.selfClosing?2:1),` data-rt-i={arguments[0]?.["data-rt-i"]}`);
    }
  }});
  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true, source: filePath }),
  };
}

module.exports = { stamp, HOST_ATTR, INSTANCE_ATTR };
