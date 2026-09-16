'use strict';
// The writer (RFC-0001 R-2, R-9, R-11): applies typed ops to source via
// surgical edits, validates before writing, writes atomically, and
// refuses anything it cannot do deterministically (R-6).

const fs = require('node:fs');
const path = require('node:path');
const MagicString = require('magic-string');
const { twMerge } = require('tailwind-merge');
const { parseSource, contentHash } = require('./id.cjs');
const traverse = require('@babel/traverse').default;

function imageSource(attr, source) {
  if (!attr?.value) return null;
  if (attr.value.type === 'StringLiteral') return { value: attr.value.value };
  if (attr.value.type === 'JSXExpressionContainer' && attr.value.expression.type === 'StringLiteral') return { value: attr.value.expression.value };
  if (attr.value.type === 'JSXExpressionContainer' && attr.value.expression.type === 'Identifier') {
    const name = attr.value.expression.name;
    let imported;
    traverse(parseSource(source), { JSXAttribute(p) {
      if (p.node.start !== attr.start) return;
      const binding = p.scope.getBinding(name);
      if (binding?.kind === 'module') imported = binding.path.parentPath.node;
      p.stop();
    } });
    if (imported && /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(imported.source.value)) return { value: imported.source.value, imported: true };
  }
  return null;
}

// Font-family arbitrary properties need quoted names and Tailwind's literal
// underscore escape. Keep that grammar narrow; serialize as a JSX attribute,
// whose backslashes are literal. Preserve raw selector ampersands for Tailwind
// scanning; escape only entity-like sequences and the attribute delimiter.
const {valid:classToken}=require('./class-tokens.cjs');
function jsxClassLiteral(value){const quote=value.includes('"')&&!value.includes("'")?"'":'"';return quote+value.replace(/&(?=(?:#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);)/g,'&amp;').replace(new RegExp(quote,'g'),quote==='"'?'&quot;':'&#39;')+quote;}

function refuse(reason) {
  return { ok: false, refused: true, reason };
}

function escapeJsxText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function findAttr(node, name) {
  return node.openingElement.attributes.find(
    (a) => a.type === 'JSXAttribute' && a.name && a.name.name === name
  );
}

// Extract editable info about an element for the shell's panel.
function describeElement(resolved) {
  const { element, source } = resolved;
  const node = element.node;
  const classAttr = findAttr(node, 'className');
  let className = null;
  let classNameDynamic = false;
  if (classAttr) {
    if (classAttr.value && classAttr.value.type === 'StringLiteral') {
      className = classAttr.value.value;
    } else {
      classNameDynamic = true;
    }
  }

  const canSetTag =
    node.openingElement.name.type === 'JSXIdentifier' &&
    /^[a-z]/.test(node.openingElement.name.name) &&
    !!node.closingElement;

  const srcAttr = findAttr(node, 'src');
  const image = imageSource(srcAttr, source);
  const authoredSrcSet = findAttr(node, 'srcSet');
  const picture = resolved.elements?.some(e => tagOf(e.node) === 'picture' && e.node.start < node.start && e.node.end > node.end);
  let src = null;
  let srcDynamic = false;
  if (srcAttr) {
    if (image) src = image.value;
    else srcDynamic = true;
  }

  // Rendered text alone cannot prove that replacing a wrapper preserves JSX.
  const plainFormatting = candidate => candidate.type === 'JSXText' ||
    candidate.type === 'JSXElement' && tagOf(candidate)==='a' && candidate.openingElement.attributes.length===1 && candidate.openingElement.attributes[0].name?.name==='href' && require('../shell/link-values.js').valid(candidate.openingElement.attributes[0].value?.type==='StringLiteral'?candidate.openingElement.attributes[0].value.value:candidate.openingElement.attributes[0].value?.expression?.type==='StringLiteral'?candidate.openingElement.attributes[0].value.expression.value:null) && candidate.children.every(plainFormatting) ||
    candidate.type === 'JSXElement' && tagOf(candidate)==='br' && candidate.openingElement.attributes.length===0 && !candidate.children.length ||
    candidate.type === 'JSXElement' && tagOf(candidate)==='span' && !!require('./range-style-source.cjs').style({node:candidate},source,'react') ||
    candidate.type === 'JSXElement' && /^(strong|b|em|i|u|s|sup|sub)$/.test(tagOf(candidate)) &&
    candidate.openingElement.attributes.length === 0 && !!candidate.closingElement &&
    candidate.children.every(plainFormatting);
  const plainFormattingIds = (resolved.elements || []).filter(item =>
    item.node.start > node.start && item.node.end < node.end && plainFormatting(item.node)).map(item => item.id);
  const literalDescendant = child => child.type === 'JSXText' ? child.value.trim() !== '' : child.type === 'JSXElement' && /^[a-z]/.test(tagOf(child)) && child.children.some(literalDescendant);
  const textInfo = literalTextRange(node, source);
  return {
    svgPaint: {reason:node.openingElement.attributes.some(a=>a.type==='JSXSpreadAttribute')?'Spread props may control this layer’s classes.':null},
    svgInsertion: require('./jsx-svg-insert.cjs').describe(resolved),
    svgGradientCreation:require('./svg-gradient-create.cjs').describe(resolved,'react'),svgGradients: require('./source-svg-gradient.cjs').describe(resolved,'react'),
    svgGeometry: require('./jsx-svg-geometry.cjs').describe(resolved),
    svgTransform: require('./svg-transform.cjs').describe(resolved,'react'),
    svgConversion: require('./svg-convert.cjs').describe(resolved),
    renderRevisionAttribute:element.kind==='host'?'data-rt-revision':'data-rt-i-revision',
    id: element.id,
    kind: element.kind,
    tag: tagOf(node),
    file: resolved.relPath,
    hash: resolved.hash,
    className,
    classNameDynamic,
    src,
    srcDynamic,
    srcImported: !!image?.imported,
    canSetSrc: !!image && !authoredSrcSet && !picture && (/^(img|source|video|image)$/i.test(tagOf(node)) || /Image$/.test(tagOf(node))),
    srcReason: authoredSrcSet || picture ? 'This image has authored responsive sources. Editing those choices is deferred.' : null,
    canSetTag,
    ...require('./range-style-source.cjs').describe(resolved,'react'),
    plainFormattingIds,
    ...require('./link-source.cjs').describe(resolved,'react'),
    text: textInfo ? textInfo.text : null,
    textDynamic: textInfo ? false : hasChildren(node),
    mixedText:
      !textInfo &&
      childrenAreMappable(node) &&
      (node.children || []).some(literalDescendant),
  };
}

function tagOf(node) {
  const n = node.openingElement.name;
  return n.type === 'JSXIdentifier' ? n.name : 'element';
}

function hasChildren(node) {
  return (node.children || []).some(
    (c) => !(c.type === 'JSXText' && c.value.trim() === '')
  );
}

// If the element's significant children are text only, return the source
// range covering all children plus the decoded text. Otherwise null.
function literalTextRange(node, source) {
  const emptyTextAllowed=['h1','h2','h3','h4','h5','h6','p','span','div','blockquote','label','a','button'].includes(tagOf(node))&&!node.openingElement.attributes.some(attr=>attr.type==='JSXSpreadAttribute'||['children','dangerouslySetInnerHTML'].includes(attr.name?.name));
  if (!node.closingElement) return node.openingElement.selfClosing&&emptyTextAllowed?{start:node.openingElement.end-2,end:node.openingElement.end,text:'',selfClosing:true}:null;
  const children = node.children || [];
  const significant = children.filter(
    (c) => !(c.type === 'JSXText' && c.value.trim() === '')
  );
  if (significant.length === 0 && !emptyTextAllowed) return null;
  if (!significant.every((c) => c.type === 'JSXText')) return null;
  const start = node.openingElement.end;
  const end = node.closingElement.start;
  // Babel decodes character references once. Fold only JSX formatting
  // whitespace; preserve inline spaces and nonbreaking spaces as React does.
  const text = children.map(child=>{
    const lines=child.value.split(/\r\n|\n|\r/);
    let last=0;for(let i=0;i<lines.length;i++)if(/[^ \t]/.test(lines[i]))last=i;
    return lines.map((line,i)=>{
      let value=line.replace(/\t/g,' ');
      if(i>0)value=value.replace(/^ +/,'');
      if(i<lines.length-1)value=value.replace(/ +$/,'');
      return value+(value&&i<last?' ':'');
    }).join('');
  }).join('');
  return { start, end, text };
}

const {validateChildrenTree,styleMarkup,linkMarkup,hasLink}=require('./rich-text.cjs');

// True when every significant child is JSXText or JSXElement — the shape
// rich editing can map back to source. Expressions refuse (R-6).
function childrenAreMappable(node) {
  if (!node.closingElement) return false;
  const significant = (node.children || []).filter(
    (c) => !(c.type === 'JSXText' && c.value.trim() === '')
  );
  if (significant.length === 0) return false;
  return significant.every((c) => c.type === 'JSXText' || c.type === 'JSXElement');
}

function refuseError(msg) {
  const e = new Error(msg);
  e.refusal = msg;
  return e;
}

// op: { type, id, fileHash, ... }. `resolved` comes from Index.resolve(id).
function planOp(resolved, op) {
  if(op.type==='setClassesSelection')return require('./jsx-class-selection.cjs').plan(resolved,op);
  if(op.type==='insertSVG')return require('./jsx-svg-insert.cjs').plan(resolved,op);
  if(['convertSVGToPath','convertSVGToArrow'].includes(op.type))return require('./svg-convert.cjs').plan(resolved,op);
  if(op.type==='setSVGTransforms')return require('./svg-transform.cjs').planSelection(resolved,op,'react');
  if(op.type==='setSVGTransform')return require('./svg-transform.cjs').plan(resolved,op,'react');
  if(op.type==='setSVGGradient')return require('./source-svg-gradient.cjs').plan(resolved,op,'react');
  if(op.type==='setSVGGeometry')return require('./jsx-svg-geometry.cjs').plan(resolved,op);
  if (op.fileHash && op.fileHash !== resolved.hash) {
    return refuse('The file changed since it was last read. Re-select the element and retry.');
  }
  const node = resolved.element.node;
  const ms = new MagicString(resolved.source);

  if (op.type === 'setClasses') {
    if (typeof op.classes !== 'string') return refuse('setClasses needs a string.');
    const tokens = op.classes.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (!classToken(t)) return refuse(`Class token not allowed: ${JSON.stringify(t)}`);
    }
    const merged = twMerge(tokens.join(' '));
    const attr = findAttr(node, 'className');
    if (attr) {
      if (!attr.value || attr.value.type !== 'StringLiteral') {
        return refuse(
          `className here is a dynamic expression (${resolved.relPath}); Retouch only edits literal class strings.`
        );
      }
      if (merged === '') {
        ms.remove(attr.start - 1, attr.end); // include the preceding space
      } else {
        ms.overwrite(attr.value.start, attr.value.end, jsxClassLiteral(merged));
      }
    } else {
      if (merged !== '') {
        ms.appendLeft(node.openingElement.name.end, ` className=${jsxClassLiteral(merged)}`);
      }
    }
  } else if (op.type === 'setText') {
    if (typeof op.text !== 'string') return refuse('setText needs a string.');
    if (op.text.length > 10000) return refuse('Text too long.');
    const range = literalTextRange(node, resolved.source);
    if (!range) {
      return refuse(
        `The text of this element is dynamic or mixed with other elements (${resolved.relPath}); it cannot be edited deterministically here.`
      );
    }
    if(op.text!==range.text){
      if(range.selfClosing)ms.overwrite(range.start,range.end,'>'+escapeJsxText(op.text)+'</'+tagOf(node)+'>');
      else if(range.start===range.end)ms.appendLeft(range.start,escapeJsxText(op.text));else ms.overwrite(range.start, range.end, escapeJsxText(op.text));
    }
  } else if (op.type === 'setChildren') {
    // Rich in-place editing (DR-0014). The tree is constrained: escaped
    // text, kept stamped descendants written as verbatim source slices,
    // fixed formatting tags, and enumerated range styles. No arbitrary
    // attributes or expressions can be introduced by these nodes.
    const treeErr = validateChildrenTree(op.children, 0,false,0,id=>{const kept=resolved.elements.find(element=>element.id===id);return kept?tagOf(kept.node):null;});
    if (treeErr) return refuse(treeErr);
    if(tagOf(node)==='a'&&hasLink(op.children))return refuse('Text links cannot be nested.');
    if (!childrenAreMappable(node)) {
      return refuse(
        `The children of this element include expressions (${resolved.relPath}); they cannot be edited deterministically.`
      );
    }
    const descendants = new Map();
    for (const el of resolved.elements) {
      if (el.node.start >= node.openingElement.end && el.node.end <= node.closingElement.start) {
        descendants.set(el.id, el.node);
      }
    }
    const blocks=require('./rich-text-blocks.cjs');
    const inlineNode=element=>blocks.inlineTag(tagOf(element))&&(element.children||[]).every(child=>child.type==='JSXText'||child.type==='JSXElement'&&inlineNode(child));
    if(blocks.contains(op.children)){const error=blocks.placement(op.children,tagOf(node),id=>{const kept=descendants.get(id);return kept?{tag:tagOf(kept),inline:inlineNode(kept),inlineChildren:(kept.children||[]).every(child=>child.type==='JSXText'||child.type==='JSXElement'&&inlineNode(child))}:null;});if(error)return refuse(error);}
    const listTemplate=id=>{const element=descendants.get(id);if(!element||!['ul','ol'].includes(tagOf(element))||element.openingElement.attributes.some(attr=>attr.type==='JSXSpreadAttribute'))return null;return {tag:tagOf(element),attributes:element.openingElement.attributes.filter(attr=>attr.type==='JSXAttribute'&&['class','className','style'].includes(attr.name?.name)).map(attr=>({name:attr.name.name,raw:resolved.source.slice(attr.start,attr.end)}))};};
    const source = resolved.source,seen=new Set();
    const build = (children) =>
      children
        .map((c) => {
          if (c.t === 'text') return escapeJsxText(c.value);
          if(c.t==='link')return linkMarkup(c,build(c.children),true);
          if (c.t === 'break') return '<br />';
          if(c.t==='paragraph')return require('./text-paragraphs.cjs').markup(build(c.children),true,c.spacing);
          if (c.t === 'block') return blocks.markup(c,build(c.children),true,c.template?listTemplate(c.template):null);
          if (c.t === 'style' || c.t === 'styles') return styleMarkup(c,build(c.children),true);
          if(c.t==='copy'){const original=descendants.get(c.id);if(!original)throw refuseError('Unknown split text source.');return require('./rich-text-copy.cjs').markup(source.slice(original.start,original.end),build(c.children),true,c);}
          if (c.t === 'wrap') return `<${c.tag}>${build(c.children)}</${c.tag}>`;
          const kept = descendants.get(c.id);
          if (!kept||seen.has(c.id)) {
            throw refuseError('A kept element is not a descendant of the target in source; the edit cannot be mapped.');
          }
          seen.add(c.id);
          const hrefEdit=Object.hasOwn(c,'href'),keptElement={node:kept},patchBlock=raw=>{if(Object.hasOwn(c,'tag'))raw=blocks.patchTag(raw,tagOf(kept),c.tag);if(Object.hasOwn(c,'listInset'))raw=require('./list-inset.cjs').patch(raw,c.tag||tagOf(kept),c.listInset,true);if(Object.hasOwn(c,'listSpacing'))raw=require('./list-spacing.cjs').patch(raw,c.listSpacing,true);if(Object.hasOwn(c,'start'))raw=require('./list-start.cjs').patch(raw,c.start,true);if(Object.hasOwn(c,'spacing'))raw=require('./text-paragraphs.cjs').patchSpacing(raw,c.spacing,true);if(c.paragraph==='inline')raw=require('./text-paragraphs.cjs').inline(raw,true);return c.marker?require('./list-markers.cjs').patch(raw,c.tag||tagOf(kept),c.marker,true):raw;};
          if(hrefEdit&&!require('./link-source.cjs').literalHref(resolved,keptElement,'react'))throw refuseError('This link URL is controlled by its source.');
          if (!c.children) return patchBlock(hrefEdit?require('./link-source.cjs').patch(resolved,keptElement,'react',c.href):source.slice(kept.start, kept.end));
          if(tagOf(kept)==='a'&&hasLink(c.children))throw refuseError('Text links cannot be nested.');
          if (!childrenAreMappable(kept)) {
            throw refuseError('A styled child whose text was edited contains expressions; it cannot be edited deterministically.');
          }
          return patchBlock(
            (hrefEdit?require('./link-source.cjs').patch(resolved,keptElement,'react',c.href,true):source.slice(kept.start, kept.openingElement.end)) +
            build(c.children) +
            source.slice(kept.closingElement.start, kept.end)
          );
        })
        .join('');
    let builtStr;
    try {
      builtStr = build(op.children);
    } catch (e) {
      if (e.refusal) return refuse(e.refusal);
      if (blocks.contains(op.children)) return refuse(e.message);
      throw e;
    }
    if (builtStr.trim() === '') return refuse('The edit removed all content; delete the element instead.');
    if (builtStr.length > 50000) return refuse('The edit is too large.');
    ms.overwrite(node.openingElement.end, node.closingElement.start, builtStr);
  } else if (op.type === 'setTag') {
    // Typography: change a text element's tag (h1..h4, p, span). Deterministic
    // tag rewrite of the opening and closing names. Host (lowercase) text tags
    // only — never a component or a self-closing element.
    const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'blockquote', 'label']);
    if (typeof op.tag !== 'string' || !TEXT_TAGS.has(op.tag)) {
      return refuse('Unsupported target tag.');
    }
    const open = node.openingElement.name;
    if (open.type !== 'JSXIdentifier' || !/^[a-z]/.test(open.name)) {
      return refuse('Only plain HTML text elements can change tag; this is a component.');
    }
    if (!node.closingElement) {
      return refuse('This element has no closing tag and cannot change tag.');
    }
    ms.overwrite(open.start, open.end, op.tag);
    const close = node.closingElement.name;
    ms.overwrite(close.start, close.end, op.tag);
  } else if (op.type === 'setSrc') {
    if (findAttr(node, 'srcSet') || resolved.elements?.some(e => tagOf(e.node) === 'picture' && e.node.start < node.start && e.node.end > node.end)) return refuse('This image has authored responsive sources; editing them is deferred.');
    // Image swap (R-9 amendment, rev 17): src is settable ONLY as a
    // root-relative project path — no scheme, no host, no traversal — which
    // preserves the injection-safety intent of the src exclusion.
    if (typeof op.src !== 'string') return refuse('setSrc needs a string.');
    if (
      op.src.length > 500 ||
      !/^\/[A-Za-z0-9_\-./]+$/.test(op.src) ||
      op.src.startsWith('//') ||
      op.src.split('/').includes('..')
    ) {
      return refuse('Image paths must be root-relative project paths (e.g. /rt-assets/x.png).');
    }
    const tag = tagOf(node);
    if (!/^(img|source|video|image)$/i.test(tag) && !/Image$/.test(tag)) {
      return refuse('setSrc applies to image elements only.');
    }
    const attr = findAttr(node, 'src');
    const priorImage = imageSource(attr, resolved.source);
    if (!priorImage) {
      return refuse(
        `src here is not a literal or a static image import; it cannot be swapped deterministically (${resolved.relPath}).`
      );
    }
    if (priorImage.imported && /Image$/.test(tag) && !findAttr(node, 'fill')) {
      for (const dimension of ['width', 'height']) if (!findAttr(node, dimension)) {
        const value = op.dimensions?.[dimension];
        if (!Number.isFinite(value) || value <= 0 || value > 100000) return refuse('This imported image needs its rendered width and height to preserve its layout.');
        ms.appendLeft(node.openingElement.name.end, ` ${dimension}={${Math.round(value)}}`);
      }
    }
    ms.overwrite(attr.value.start, attr.value.end, JSON.stringify(op.src));
  } else {
    return refuse(`Unknown op type: ${op.type}`);
  }

  const nextSource = ms.toString();

  // R-11(b): the result must parse before anything is written.
  try {
    parseSource(nextSource);
  } catch (err) {
    return refuse(`The edit produced unparseable code and was not written: ${err.message}`);
  }

  return { ok: true, hash: contentHash(nextSource), edits: [{ file: resolved.file, before: resolved.source, after: nextSource }] };
}

function applyOp(resolved, op) {
  return require('./transactions.cjs').applyPlan(resolved.appRoot || path.dirname(resolved.file), planOp(resolved, op));
}

module.exports = { applyOp, planOp, describeElement };
