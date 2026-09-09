'use strict';
// The Liquid language adapter (RFC-0001 DR-0015). Parses Shopify `.liquid`
// theme files with a tolerant HTML+Liquid tokenizer, stamps HTML elements with
// structural IDs, and rewrites classes / literal text / tags deterministically.
// Traceable strings write to their backing values; unsupported expressions
// remain opaque (R-6, DR-0017).

const fs = require('node:fs');
const structure = require('../structure.cjs');
const path = require('node:path');
const crypto = require('node:crypto');
const MagicString = require('magic-string');
const { twMerge } = require('tailwind-merge');
const sources = require('../liquid-sources.cjs');
const render = require('../liquid-context.cjs');
const classes = require('../liquid-classes.cjs');
const components = require('../liquid-components.cjs');
const images = require('../liquid-images.cjs');
const theme = require('../liquid-theme.cjs');
const {validateChildrenTree}=require('../rich-text.cjs');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_LIQUID = new Set(['comment', 'doc', 'raw', 'schema', 'javascript', 'stylesheet']);
const RAW_HTML = new Set(['script', 'style']);
const SKIP_TAGS = new Set(['script', 'style', 'svg', 'path', 'template']);
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'blockquote', 'label', 'a', 'li']);
const CLASS_TOKEN_RE = {test:require('../class-tokens.cjs').liquid};

function contentHash(source) {
  return crypto.createHash('sha1').update(source).digest('hex');
}
function hashId(relPath, pathLoc) {
  return crypto.createHash('sha1').update(relPath + '|' + pathLoc).digest('hex').slice(0, 10);
}
function matches(filePath) {
  return /\.liquid$/.test(filePath)||theme.matches(filePath);
}

// --- tolerant tokenizer + tree builder -------------------------------------

function parse(source) {
  const roots = [];
  const stack = [];
  const all = [];
  const N = source.length;
  let i = 0;

  const pushChild = (node) => {
    const parent = stack[stack.length - 1];
    node.parent = parent || null;
    const sibs = parent ? parent.children : roots;
    node.childIndex = sibs.length;
    node.pathLoc = (parent ? parent.pathLoc + '/' : '') + node.childIndex;
    sibs.push(node);
    all.push(node);
  };

  while (i < N) {
    if (source.startsWith('{%', i)) {
      const end = source.indexOf('%}', i);
      if (end === -1) break;
      const name = source.slice(i + 2, end).replace(/^-/, '').trim().split(/\s+/)[0];
      if (RAW_LIQUID.has(name)) {
        const re = new RegExp('\\{%-?\\s*end' + name + '\\s*-?%\\}');
        const m = re.exec(source.slice(end + 2));
        i = m ? end + 2 + m.index + m[0].length : N;
      } else {
        i = end + 2;
      }
      continue;
    }
    if (source.startsWith('{{', i)) {
      const end = source.indexOf('}}', i);
      if(end>=0){const image=images.read(source,i,end+2);if(image)pushChild(image);}
      i = end === -1 ? N : end + 2;
      continue;
    }
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i);
      i = end === -1 ? N : end + 3;
      continue;
    }
    const ch = source[i];
    if (ch === '<' && (/[a-zA-Z]/.test(source[i + 1] || '') || source.startsWith('{{', i + 1))) {
      const tag = readOpenTag(source, i);
      pushChild(tag);
      if (RAW_HTML.has(tag.tag)) {
        const re = new RegExp('</' + tag.tag + '\\s*>', 'i');
        const m = re.exec(source.slice(tag.openEnd));
        tag.childrenEnd = tag.closeStart = tag.openEnd + (m ? m.index : 0);
        tag.closeEnd = m ? tag.openEnd + m.index + m[0].length : N;
        i = tag.closeEnd;
      } else if (tag.selfClosing || VOID.has(tag.tag)) {
        tag.childrenEnd = tag.closeStart = tag.closeEnd = tag.openEnd;
        i = tag.openEnd;
      } else {
        stack.push(tag);
        i = tag.openEnd;
      }
      continue;
    }
    if (ch === '<' && source[i + 1] === '/') {
      const end = source.indexOf('>', i);
      const closeEnd = end === -1 ? N : end + 1;
      const name = source.slice(i + 2, end === -1 ? N : end).trim().toLowerCase();
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].tag === name) {
          const node = stack[s];
          node.childrenEnd = node.closeStart = i;
          node.closeStart = i;
          node.closeEnd = closeEnd;
          node.closeNameStart = i + 2;
          node.closeNameEnd = end === -1 ? N : end;
          stack.length = s;
          break;
        }
      }
      i = closeEnd;
      continue;
    }
    i++;
  }
  return { roots, all };
}

function readOpenTag(source, start) {
  const N = source.length;
  let j = start + 1;
  const dynamicTag = source.startsWith('{{', j);
  if (dynamicTag) {
    const end = source.indexOf('}}', j);
    j = end < 0 ? N : end + 2;
  } else while (j < N && /[a-zA-Z0-9:-]/.test(source[j])) j++;
  const tag = dynamicTag ? source.slice(start + 1, j) : source.slice(start + 1, j).toLowerCase();
  const nameEnd = j;
  let k = j;
  let classAttr = null;
  let srcAttr = null;
  let srcSet = false;
  let textBinding = false;
  let selfClosing = false;
  let openEnd = N;
  while (k < N) {
    if (source.startsWith('{%', k)) { const e = source.indexOf('%}', k); k = e === -1 ? N : e + 2; continue; }
    if (source.startsWith('{{', k)) { const e = source.indexOf('}}', k); k = e === -1 ? N : e + 2; continue; }
    const c = source[k];
    if (c === '>') { openEnd = k + 1; break; }
    if (c === '/' && source[k + 1] === '>') { selfClosing = true; openEnd = k + 2; break; }
    if (/\s/.test(c)) { k++; continue; }
    const attrStart = k;
    while (k < N && !/[\s=/>]/.test(source[k])) k++;
    const attrNameEnd=k;
    const attrName = source.slice(attrStart, k).toLowerCase();
    while (k < N && /\s/.test(source[k])) k++;
    let value = null, valueStart = -1, valueEnd = -1;
    if (source[k] === '=') {
      k++;
      while (k < N && /\s/.test(source[k])) k++;
      const q = source[k];
      if (q === '"' || q === "'") {
        valueStart = k + 1;
        let e = k+1;
        while (e<N) {
          if (source.startsWith('{{',e)||source.startsWith('{%',e)) {
            if(source.startsWith('{% comment %}',e)){const end=source.indexOf('{% endcomment %}',e+13);e=end<0?N:end+16;continue;}
            const close=source.startsWith('{{',e)?'}}':'%}';
            const end=source.indexOf(close,e+2); e=end<0?N:end+2; continue;
          }
          if (source[e]===q) break;
          e++;
        }
        valueEnd = e;
        value = source.slice(valueStart, valueEnd);
        k = e >= N ? N : e + 1;
      } else {
        valueStart = k;
        while (k < N && !/[\s>]/.test(source[k])) k++;
        valueEnd = k;
        value = source.slice(valueStart, valueEnd);
      }
    }
    if (['x-text', 'x-html', 'v-text', 'v-html'].includes(attrName)) textBinding = true;
    if (attrName === 'class') {
      const cleaned=classes.clean(value||''),dynamic=/\{[%{]/.test(cleaned);
      classAttr = { attrStart, attrEnd:valueStart<0?attrNameEnd:k, valueStart, valueEnd, value:dynamic?value:classes.decode(cleaned), dynamic };
    }
    if (attrName === 'src') srcAttr = { valueStart, valueEnd, value };
    if (attrName === 'srcset') srcSet = true;
  }
  return {
    tag, dynamicTag, kind: 'host', tagStart: start, nameEnd, openEnd, selfClosing,
    classAttr, srcAttr, srcSet, textBinding, childrenStart: openEnd, children: [],
  };
}

// --- adapter interface ------------------------------------------------------

function collect(source, relPath) {
  if(theme.matches(relPath))return theme.collect(source,relPath);
  const { all } = parse(source);
  const elements = [];
  for (const node of all) {
    if (SKIP_TAGS.has(node.tag)) continue;
    node.id = hashId(relPath, node.pathLoc);
    node.node = node; // the "node" the resolved bundle carries is the parse node
    elements.push(node);
  }
  elements.push(...components.calls(source,relPath));
  return { elements };
}

function stamp(source, filePath, appRoot) {
  if (!/\.liquid$/.test(filePath)) return null;
  // The ID must be computed from the SAME relative path the writer's index
  // uses, or the stamped DOM and the index disagree.
  const relPath = appRoot ? path.relative(appRoot, filePath).split(path.sep).join('/') : filePath;
  const { elements } = collect(source, relPath);
  const plan = sources.plan(source, relPath);
  if (elements.length === 0 && plan.injections.length === 0) return null;
  const ms = new MagicString(source);
  if(elements.some(el=>el.generatedImage))ms.prepend('{% capture __rt_template %}{{ template.name }}{% if template.suffix %}.{{ template.suffix }}{% endif %}{% endcapture %}');
  for (const injection of plan.injections) ms.appendLeft(injection.at, injection.text);
  for (const el of elements) {
    if (el.kind==='instance') {
      ms.appendLeft(el.insert,`, __rt_instance: '${el.id}' `);
      continue;
    }
    if(el.generatedImage){images.stamp(ms,el,relPath.startsWith('snippets/')&&!el.parent);continue;}
    const instance=relPath.startsWith('snippets/')&&!el.parent?' data-rt-i="{{ __rt_instance }}"':'';
    const binding = sources.textBinding(source, el, plan);
    const tagBinding=dynamicTagBinding(source,el,relPath);
    const tagOrigin=tagBinding?` data-rt-tag-origin="{{ ${tagBinding.code} | escape }}"`:'';
    const origin = binding ? ` data-rt-origin="{{ ${binding.code} | escape }}"` : '';
    ms.appendLeft(el.nameEnd, ` data-rt="${el.id}"${instance} data-rt-section="{{ section.id | escape }}" data-rt-block="{{ block.id | escape }}" data-rt-block-type="{{ block.type | escape }}" data-rt-template="{{ template.name | escape }}{% if template.suffix %}.{{ template.suffix | escape }}{% endif %}" data-rt-locale="{{ request.locale.iso_code | escape }}"${origin}${tagOrigin}`);
  }
  return { code: ms.toString(), map: ms.generateMap({ hires: true, source: filePath }) };
}

function dynamicTagBinding(source,node,file) {
  if (!node.dynamicTag) return null;
  const expr=node.tag.replace(/^\{\{-?\s*|\s*-?\}\}$/g,'');
  return sources.expression(expr,file,'tag:'+node.pathLoc,node.tagStart+1+node.tag.indexOf(expr));
}
function tagResolution(resolved) {
  const binding=dynamicTagBinding(resolved.source,resolved.element,resolved.relPath);
  if (!binding) return null;
  const context={...render.context(resolved.context),origin:resolved.context?.attributes?.['data-rt-tag-origin']||resolved.context?.tagOrigin};
  const target={...resolved,context};
  return {binding,resolved:target,result:sources.resolve(target,binding)};
}

function literalText(node, source) {
  if (node.closeStart == null || node.textBinding) return null;
  const inner = source.slice(node.childrenStart, node.childrenEnd);
  if (/[<]|\{[%{]/.test(inner)) return null; // nested tag or liquid → not literal
  const text = inner.trim();
  return text === '' ? null : text;
}

function describeElement(resolved) {
  const node = resolved.element;
  const source = resolved.source;
  if (node.kind==='instance') return {id:node.id,kind:'instance',tag:node.snippet||node.moduleName,file:resolved.relPath,hash:resolved.hash,context:resolved.context||null,renderScope:node.theme?theme.scope(node,resolved.context):null,
    className:null,classNameDynamic:false,src:null,srcDynamic:false,canSetSrc:false,canSetTag:false,text:null,textDynamic:false,canSetChildren:false,mixedText:false};
  if(node.generatedImage){
    const info=images.describe(source,node,render.context(resolved.context));
    const picture=resolved.elements.some(e=>e.tag==='picture'&&e.tagStart<node.tagStart&&e.closeStart>=node.openEnd);
    return {id:node.id,kind:'host',tag:'img',file:resolved.relPath,hash:resolved.hash,context:resolved.context||null,...info,canSetSrc:info.canSetSrc&&!picture,srcReason:picture?'This image has authored responsive sources. Editing those choices is deferred.':info.srcReason||null};
  }
  let text = literalText(node, source);
  const traced = text === null && !node.textBinding ? sources.resolve(resolved) : null;
  if (traced?.target) text = traced.target.value;
  const inner = node.closeStart != null ? source.slice(node.childrenStart, node.childrenEnd) : '';
  const hasLiquid = /\{[%{]/.test(inner);
  const canSetChildren=node.closeStart!=null&&!node.textBinding&&!hasLiquid&&inner.trim()!=='';
  const asset = node.srcAttr?.value?.match(/^\s*\{\{\s*['"]([\w.\/-]+)['"]\s*\|\s*asset_url\s*\}\}\s*$/);
  const imageUrl=!!node.srcAttr&&/^\s*\{\{[\s\S]*\|\s*image_url\s*:[\s\S]*\}\}\s*$/.test(node.srcAttr.value||'');
  const srcDynamic = !!node.srcAttr && /\{[%{]/.test(node.srcAttr.value || '') && !asset && !imageUrl;
  const tagSource=node.dynamicTag?tagResolution(resolved):null;
  const classSnapshot=render.context(resolved.context).className;
  const classEditable=!node.classAttr?.dynamic||typeof classSnapshot==='string';
  const className=node.classAttr?.dynamic&&classEditable?classes.effective(node.classAttr.value,node.id,classSnapshot):node.classAttr?.value||'';
  const picture = resolved.elements?.some(e => e.tag === 'picture' && e.tagStart < node.tagStart && e.closeStart >= node.openEnd);
  return {
    id: node.id,
    kind: 'host',
    tag: node.dynamicTag ? (render.context(resolved.context).tag || node.tag) : node.tag,
    file: resolved.relPath,
    hash: resolved.hash,
    className: classEditable ? className : null,
    classNameDynamic: !classEditable,
    classNameReason: !classEditable ? 'Reload the preview to read this element’s rendered classes.' : null,
    src: asset ? '/assets/' + asset[1] : imageUrl ? render.context(resolved.context).src||null : srcDynamic ? null : node.srcAttr?.value ?? null,
    srcMatch:asset?{pathnameSuffix:'/'+asset[1]}:null,
    srcDynamic,
    canSetSrc: !!node.srcAttr && !node.srcSet && !picture && !srcDynamic && ['img','source','image'].includes(node.tag),
    srcReason: node.srcSet || picture ? 'This image has authored responsive sources. Editing those choices is deferred.' : null,
    canSetTag: node.closeStart != null && (TEXT_TAGS.has(node.tag) || !!tagSource?.result.target && TEXT_TAGS.has(tagSource.result.target.value)),
    tagSource:tagSource?.result.descriptor||null,
    text,
    textDynamic: text === null && (hasLiquid || node.textBinding),
    textSource: traced?.descriptor || null,
    textReason: traced?.reason || null,
    context: resolved.context || null,
    renderScope: render.scope(traced?.descriptor,resolved.context),
    richText:traced?.richText||null,
    canSetChildren:canSetChildren||!!traced?.richText,
    mixedText:canSetChildren&&node.children.length>0||!!traced?.richText&&traced.descriptor.format!=='text',
  };
}

function describe(resolved) {
  return {...describeElement(resolved),components:theme.ancestry(resolved),structure:structure.describe(resolved,'liquid')};
}

function refuse(reason) { return { ok: false, refused: true, reason }; }
function escapeText(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

function planOp(resolved, op) {
  if(structure.types.has(op.type)) return structure.planOp(resolved,op,'liquid');
  if (op.fileHash && op.fileHash !== resolved.hash) {
    return refuse('The file changed since it was last read. Re-select the element and retry.');
  }
  if (op.type==='detachComponent') return resolved.element.theme?theme.planDetach(resolved,op):components.planDetach(resolved,op);
  const node = resolved.element;
  if (node.kind==='instance') return refuse('Edit the component definition or detach this instance first.');
  const ms = new MagicString(resolved.source);

  if (op.type === 'setClasses') {
    if (typeof op.classes !== 'string') return refuse('setClasses needs a string.');
    const tokens = op.classes.split(/\s+/).filter(Boolean);
    for (const t of tokens) if (!CLASS_TOKEN_RE.test(t)) return refuse(`Class token not allowed: ${JSON.stringify(t)}`);
    const merged = twMerge(tokens.join(' '));
    if(node.generatedImage) {
      try{images.setClasses(ms,resolved,merged);}catch(err){return refuse(err.message);}
    } else if (node.classAttr) {
      let value=classes.literal(merged);
      if (node.classAttr.dynamic) {
        try { value=classes.edit(node.classAttr.value,node.id,render.context(resolved.context).className,merged,resolved.source); }
        catch(err) { return refuse(err.message); }
      }
      const attr=node.classAttr,quoted=attr.valueStart>0&&['"',"'"].includes(resolved.source[attr.valueStart-1]);
      if(attr.valueStart<0)ms.overwrite(attr.attrStart,attr.attrEnd,`class="${value}"`);
      else ms.overwrite(attr.valueStart,attr.valueEnd,quoted?value:`"${value}"`);
    } else if (merged !== '') {
      ms.appendLeft(node.nameEnd, ` class="${classes.literal(merged)}"`);
    }
  } else if (op.type === 'setSrc') {
    const info = describe(resolved);
    if (!info.canSetSrc) return refuse(info.srcReason || 'This image source has no editable project image mapping.');
    if (typeof op.src !== 'string' || op.src.length > 500 || !/^\/[A-Za-z0-9_\-./]+$/.test(op.src) || op.src.startsWith('//') || op.src.split('/').includes('..')) return refuse('Image paths must be root-relative project paths.');
    const value = op.src.startsWith('/assets/') ? `{{ '${op.src.slice(8)}' | asset_url }}` : op.src;
    if(node.generatedImage) images.setSrc(ms,resolved,op.src);
    else ms.overwrite(node.srcAttr.valueStart, node.srcAttr.valueEnd, value);
  } else if (op.type === 'setText') {
    if (typeof op.text !== 'string') return refuse('setText needs a string.');
    const text = literalText(node, resolved.source);
    if (text === null) return sources.planWrite(resolved, op);
    ms.overwrite(node.childrenStart, node.childrenEnd, escapeText(op.text));
  } else if (op.type === 'setChildren') {
    const err=validateChildrenTree(op.children,0); if (err) return refuse(err);
    if (describe(resolved).richText) return sources.planWriteChildren(resolved,op);
    if (!describe(resolved).canSetChildren) return refuse('The children contain expressions that cannot be rewritten as rich text.');
    const descendants=new Map(resolved.elements.filter(e=>e.tagStart>=node.openEnd&&e.closeEnd<=node.closeStart).map(e=>[e.id,e]));
    const seen=new Set();
    const build=items=>items.map(c=>{
      if (c.t==='text') return escapeText(c.value);
      if (c.t==='wrap') return `<${c.tag}>${build(c.children)}</${c.tag}>`;
      const kept=descendants.get(c.id);
      if (!kept||seen.has(c.id)) throw new Error('A kept element is not a unique descendant of this source.');
      seen.add(c.id);
      if (!c.children) return resolved.source.slice(kept.tagStart,kept.closeEnd);
      if (kept.closeStart==null||kept.textBinding||/\{[%{]/.test(resolved.source.slice(kept.childrenStart,kept.childrenEnd))) throw new Error('A kept child contains expressions.');
      return resolved.source.slice(kept.tagStart,kept.openEnd)+build(c.children)+resolved.source.slice(kept.closeStart,kept.closeEnd);
    }).join('');
    let value;try{value=build(op.children);}catch(err){return refuse(err.message);}
    if (!value.trim()||value.length>50000) return refuse('The rich text is empty or too large.');
    ms.overwrite(node.childrenStart,node.childrenEnd,value);
  } else if (op.type === 'setTag') {
    if (!TEXT_TAGS.has(op.tag)) return refuse('Unsupported target tag.');
    if (node.dynamicTag) {
      const tag=tagResolution(resolved);
      if (!tag?.result.target) return refuse(tag?.result.reason||'The tag has no editable source.');
      return sources.planWrite(tag.resolved,{...op,text:op.tag},tag.binding);
    }
    if (node.closeStart == null) return refuse('This element has no closing tag and cannot change tag.');
    ms.overwrite(node.tagStart + 1, node.nameEnd, op.tag);
    if (node.closeNameStart != null) ms.overwrite(node.closeNameStart, node.closeNameEnd, op.tag);
  } else {
    return refuse(`This op is not supported by the Liquid adapter yet: ${op.type}`);
  }

  const next = ms.toString();
  // R-11(b): the result must still parse before anything is written.
  try { collect(next, resolved.relPath); } catch (err) {
    return refuse(`The edit produced malformed markup and was not written: ${err.message}`);
  }
  return { ok: true, hash: contentHash(next), edits: [{file:resolved.file,before:resolved.source,after:next}] };
}
function applyOp(resolved,op) {
  return require('../transactions.cjs').applyPlan(resolved.appRoot || path.dirname(resolved.file),planOp(resolved,op));
}

module.exports = {
  name: 'liquid',
  matches,
  stamp,
  collect,
  contentHash,
  describe,
  applyOp,
  planOp,
  describeComponent: resolved=>resolved.element.theme?theme.describe(resolved):components.describe(resolved),
  hasReference: components.hasReference,
  assets: { directory: 'assets', urlPrefix: '/assets/', uploadDirectory: '' },
  capabilities: { classAttr: 'class', ops: ['setClasses', 'setText', 'setChildren', 'setTag', 'setSrc', ...structure.types] },
  _parse: parse, // exported for tests
};
