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
function stamp(source, filePath, appRoot, {groupScaleRuntime=null,redirectGroupScaleRuntime=true}={}) {
  if (!/\.(tsx|jsx)$/.test(filePath)) return null;
  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return null;
  if (!source.includes('<')) return null;

  const relPath = toPosixRel(appRoot, filePath);
  const { ast, elements, fragments } = collectElements(source, relPath);
  if (elements.length === 0) return null;

  const ms = new MagicString(source),revision=contentHash(source),clientModule=ast.program.directives.some(d=>d.value.value==='use client');
  for (const el of elements) {
    ms.appendLeft(el.node.openingElement.end-(el.node.openingElement.selfClosing?2:1),` ${el.kind==='host'?'data-rt-revision':'data-rt-i-revision'}="${revision}"`);
    const attr = el.kind === 'host' ? HOST_ATTR : INSTANCE_ATTR;
    const opening=el.node.openingElement;
    const insertAt = (opening.typeParameters||opening.typeArguments||opening.name).end;
    if(el.kind==='host'){
      // A callback ref runs at client commit, unlike server-rendered attributes.
      // Do not replace authored refs or refs potentially supplied by a spread.
      if(clientModule&&!opening.attributes.some(a=>a.type==='JSXSpreadAttribute'||['ref','data-rt-client-revision','data-rt-client-mounted'].includes(a.name?.name))){
        ms.appendLeft(opening.end-(opening.selfClosing?2:1),` data-rt-client-revision="${revision}" ref={(__rtMountedNode)=>{if(__rtMountedNode)__rtMountedNode.setAttribute("data-rt-client-mounted","${revision}");}}`);
      }
      const name=require('./jsx-layer-name.cjs').describe({source,relPath,element:el,ast}).layerName;
      if(name){
        for(const attr of opening.attributes)if(attr.name?.name==='data-rt-layer-name')ms.remove(attr.start,attr.end);
        ms.appendLeft(opening.end-(opening.selfClosing?2:1),' data-rt-layer-name={'+JSON.stringify(name)+'}');
      }
    }
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
  if(groupScaleRuntime){
    const imports=ast.program.body.filter(n=>n.type==='ImportDeclaration'&&n.source.value==='./.retouch-group-scale.jsx');
    for(const imported of redirectGroupScaleRuntime?imports:[])ms.overwrite(imported.source.start,imported.source.end,JSON.stringify(groupScaleRuntime));
    const groups=elements.filter(e=>e.kind==='host'&&e.node.closingElement&&e.node.openingElement.attributes.some(a=>a.name?.name==='data-rt-group'));
    let name='RetouchDevelopmentScaleRuntime',suffix=0;while(source.includes(name))name='RetouchDevelopmentScaleRuntime'+(++suffix);
    const root=elements.find(e=>e.kind==='host'&&e.node.closingElement&&['main','body','div','section','article','aside','header','footer','nav'].includes(e.node.openingElement.name.name));
    let injected=false;
    if(root&&!groups.includes(root)){ms.appendLeft(root.node.closingElement.start,'<'+name+' warm />');injected=true;}
    for(const group of groups){
      const registered=group.node.children.some(n=>n.type==='JSXElement'&&imports.some(i=>i.specifiers.some(s=>s.type==='ImportDefaultSpecifier'&&s.local.name===n.openingElement.name.name)));
      if(!registered){ms.appendLeft(group.node.closingElement.start,'<'+name+' />');injected=true;}
    }
    if(injected)ms.append('\nimport '+name+' from '+JSON.stringify(groupScaleRuntime)+';\n');
  }
  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true, source: filePath }),
  };
}

module.exports = { stamp, HOST_ATTR, INSTANCE_ATTR };
