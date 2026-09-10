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
  const { ast, elements, fragments } = collectElements(source, relPath);
  if (elements.length === 0) return null;

  const ms = new MagicString(source),revision=contentHash(source);
  for (const el of elements) {
    ms.appendLeft(el.node.openingElement.end-(el.node.openingElement.selfClosing?2:1),` ${el.kind==='host'?'data-rt-revision':'data-rt-i-revision'}="${revision}"`);
    const attr = el.kind === 'host' ? HOST_ATTR : INSTANCE_ATTR;
    const insertAt = el.node.openingElement.name.end;
    ms.appendLeft(insertAt, ` ${attr}="${el.id}"`);
  }
  // Discoverable exported functions and explicitly created components forward
  // their instance marker without adding editor attributes to production source.
  const componentFunctions=new Set(require('./component-definitions.cjs').definitions(source,relPath,{ast,elements}).map(definition=>definition.fn.start));
  function forward(p){
    const exported=p.parentPath.isExportNamedDeclaration()||p.parentPath.isExportDefaultDeclaration();
    if(!componentFunctions.has(p.node.start)&&![...(p.node.leadingComments||[]),...(exported?p.parentPath.node.leadingComments||[]:[])].some(comment=>comment.value.trim()==='* @retouch-component'))return;
    const roots=require('./component-render-roots.cjs')(p.node,fragments).filter(node=>node.type==='JSXElement'&&elements.some(el=>el.node===node&&el.kind==='host')&&!node.openingElement.attributes.some(attr=>attr.name?.name===INSTANCE_ATTR));
    if(!roots.length)return;
    const marker=p.isArrowFunctionExpression()?require('./arrow-instance-marker.cjs')(p,source,ms):{identity:'arguments[0]?.["data-rt-i"]',revision:'arguments[0]?.["data-rt-i-revision"]'};
    if(!marker)return;
    for(const node of roots){
      ms.appendLeft(node.openingElement.end-(node.openingElement.selfClosing?2:1),` data-rt-i={${marker.identity}}`+(node.openingElement.attributes.some(attr=>attr.name?.name==='data-rt-i-revision')?'':` data-rt-i-revision={${marker.revision}}`));
    }
  }
  require('@babel/traverse').default(ast,{FunctionDeclaration:forward,FunctionExpression:forward,ArrowFunctionExpression:forward});
  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true, source: filePath }),
  };
}

module.exports = { stamp, HOST_ATTR, INSTANCE_ATTR };
