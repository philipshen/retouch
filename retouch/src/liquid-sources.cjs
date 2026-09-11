'use strict';
// Build-time provenance for Liquid strings. The renderer selects an origin
// marker as it executes assignments; the writer re-derives all possible
// origins from local source and never accepts a destination path from the DOM.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const json = require('./json-source.cjs');
const hash = value => crypto.createHash('sha1').update(value).digest('hex');
const marker = (file, key) => hash(file + '|' + key).slice(0, 16);
const variable = name => '__rt_origin_' + name;
const IDENT = /^[a-zA-Z_][\w]*$/;
const RAW = new Set(['comment', 'doc', 'raw', 'schema', 'javascript', 'stylesheet']);

function split(expr, separator = '|') {
  const parts = [];
  let quote = null, start = 0;
  for (let i = 0; i < expr.length; i++) {
    if (quote) { if (expr[i] === quote) quote = null; }
    else if (expr[i] === '"' || expr[i] === "'") quote = expr[i];
    else if (expr[i] === separator) { parts.push(expr.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(expr.slice(start).trim());
  return parts;
}
function literal(expr) {
  const m = /^(['"])([\s\S]*)\1$/.exec(expr);
  return m && !m[2].includes(m[1]) ? m[2] : null;
}
function expression(expr, file, key, start) {
  const [base, ...filters] = split(expr);
  const value = literal(base);
  const translation = /^(?:t|translate)(?:\s*:|$)/.test(filters[0] || '');
  if (filters.some((f, i) => f !== 'escape' && !(i === 0 && translation))) return null;
  let origin;
  if (translation) {
    if (value === null || !/^[\w.-]+$/.test(value)) return null;
    origin = { kind: 'locale', key: value };
  } else if (/^(block|section)\.settings\.[\w-]+$/.test(base)) {
    const [scope, , setting] = base.split('.');
    origin = { kind: 'setting', scope, key: setting };
  } else if (/^settings\.[\w-]+$/.test(base)) {
    origin = { kind: 'setting', scope: 'theme', key: base.slice(9) };
  } else if (value !== null) {
    origin = { kind: 'literal', value, start, end: start + base.length };
  } else if (IDENT.test(base)) return { alias: base, code: variable(base), escaped:filters.includes('escape') };
  else return null;
  const id = marker(file, key);
  return { ...origin, id, file, code: `'${id}'`, escaped:filters.includes('escape') };
}

function plan(source, file) {
  const origins = new Map(), assignments = [], injections = [], renders = [];
  let ordinal = 0;
  function assignment(name, expr, start, insert, multiline, trimRight = false) {
    const binding = expression(expr, file, 'assign:' + ordinal++, start);
    if (binding?.id) origins.set(binding.id, binding);
    assignments.push({ name, binding, start });
    const line = `assign ${variable(name)} = ${binding?.code || "''"}`;
    injections.push({ at: insert, text: multiline ? '\n  ' + line : `{% ${line} ${trimRight ? '-' : ''}%}` });
  }
  const tags = /\{%-?([\s\S]*?)-?%\}/g;
  let m;
  while ((m = tags.exec(source))) {
    const body = m[1].trim();
    const name = body.split(/\s/)[0];
    if (RAW.has(name)) {
      const end = new RegExp('\\{%-?\\s*end' + name + '\\s*-?%\\}', 'g');
      end.lastIndex = tags.lastIndex;
      const close = end.exec(source);
      tags.lastIndex = close ? end.lastIndex : source.length;
      continue;
    }
    if (name === 'assign') {
      const a = /^assign\s+(\w+)\s*=\s*([\s\S]+)$/.exec(body);
      if (a) assignment(a[1], a[2], m.index + m[0].indexOf(a[2]), tags.lastIndex, false, m[0].endsWith('-%}'));
    } else if (name === 'liquid') {
      const lines = /(?:^|\n)([^\n]*)/g;
      let line;
      while ((line = lines.exec(m[0]))) {
        const a = /^\s*assign\s+(\w+)\s*=\s*(.+?)\s*$/.exec(line[1]);
        if (a) assignment(a[1], a[2], m.index + line.index + line[0].indexOf(a[2]), m.index + line.index + line[0].length, true);
      }
    } else if (name === 'for' || name === 'tablerow') {
      const loop = /^(?:for|tablerow)\s+(\w+)\s+in\b/.exec(body);
      if (loop) injections.push({ at: tags.lastIndex, text: `{% assign ${variable(loop[1])} = '' %}` });
    } else if (name === 'increment' || name === 'decrement') {
      const counter = body.split(/\s+/)[1];
      if (IDENT.test(counter || '')) injections.push({ at: tags.lastIndex, text: `{% assign ${variable(counter)} = '' %}` });
    } else if (name === 'capture') {
      const a = /^capture\s+(\w+)$/.exec(body);
      const end = /\{%-?\s*endcapture\s*-?%\}/g;
      end.lastIndex = tags.lastIndex;
      const close = end.exec(source);
      if (a && close) {
        const value = source.slice(tags.lastIndex, close.index);
        // Only captures without any executable Liquid have one literal origin.
        if (!/\{[%{]/.test(value)) {
          const binding = { kind: 'capture', id: marker(file, 'capture:' + ordinal++), file, value, start: tags.lastIndex, end: close.index };
          binding.code = `'${binding.id}'`;
          origins.set(binding.id, binding);
          assignments.push({ name: a[1], binding, start: m.index });
          injections.push({ at: end.lastIndex, text: `{% assign ${variable(a[1])} = ${binding.code} %}` });
        } else injections.push({ at: end.lastIndex, text: `{% assign ${variable(a[1])} = '' %}` });
      }
    } else if (name === 'render') {
      const call = /^render\s+(['"])([\w-]+)\1([\s\S]*)$/.exec(body);
      if (!call) continue;
      const params = [];
      for (const arg of split(call[3], ',').filter(Boolean)) {
        const a = /^(\w+)\s*:\s*([\s\S]+)$/.exec(arg);
        if (!a) continue;
        const binding = expression(a[2], file, 'param:' + ordinal++, m.index + m[0].indexOf(call[3]) + call[3].indexOf(arg) + arg.indexOf(a[2], arg.indexOf(':') + 1));
        if (binding?.id) origins.set(binding.id, binding);
        renders.push({ snippet: call[2], name: a[1], binding, start: m.index });
        params.push(`${variable(a[1])}: ${binding?.code || "''"}`);
      }
      if (params.length) injections.push({ at: tags.lastIndex - (m[0].endsWith('-%}') ? 3 : 2), text: ', ' + params.join(', ') + ' ' });
    }
  }
  for (const injection of injections) {
    if (source.slice(injection.at - 3, injection.at) === '-%}' && injection.text.startsWith('{%')) {
      injection.text = injection.text.replace(/ %\}$/, ' -%}');
    }
  }
  return { source, file, origins, assignments, injections, renders };
}
function textBinding(source, el, p) {
  if (el.textBinding || el.childrenEnd == null) return null;
  const inner = source.slice(el.childrenStart, el.childrenEnd);
  const m = /^\s*\{\{-?\s*([\s\S]*?)\s*-?\}\}\s*$/.exec(inner);
  if (!m) return null;
  const expr = m[1].trim();
  return expression(expr, p.file, 'text:' + el.pathLoc, el.childrenStart + inner.indexOf(expr));
}
function safeFile(root, rel) {
  if (!root || !rel || path.isAbsolute(rel)) throw new Error('Source is outside the theme');
  const file = path.resolve(root, rel);
  const realRoot = fs.realpathSync(root);
  const real = fs.realpathSync(file);
  if (!real.startsWith(realRoot + path.sep)) throw new Error('Source is outside the theme');
  return file;
}
function readJSON(root, rel) {
  const file = safeFile(root, rel);
  const source = fs.readFileSync(file, 'utf8');
  return { file, rel, source, tree: json.parse(source) };
}
function jsonTarget(doc, keys) {
  const node = json.at(doc.tree, keys);
  if (!node || typeof node.value !== 'string') throw new Error('The stored value is not a string');
  return { ...doc, node, keys, value: node.value, kind: 'json', start: node.start, end: node.end };
}
function suffixMatches(runtime, key) { return runtime === key || runtime?.endsWith('__' + key); }
function settingTarget(root, origin, context) {
  if (origin.scope === 'theme') return jsonTarget(readJSON(root, 'config/settings_data.json'), ['current', origin.key]);
  if (!context.section) throw new Error('The rendered section is missing; reload the preview');
  const documents = [];
  if (/^[\w-]+(?:\.[\w-]+)?$/.test(context.template || '')) {
    const rel = 'templates/' + context.template + '.json';
    if (fs.existsSync(path.join(root, rel))) documents.push(readJSON(root, rel));
  }
  for (const name of fs.readdirSync(path.join(root, 'sections'))) {
    if (name.endsWith('.json')) documents.push(readJSON(root, 'sections/' + name));
  }
  const candidates = [];
  for (const doc of documents) {
    const sections = json.at(doc.tree, ['sections']);
    for (const [key, section] of sections?.children || []) {
      if (!suffixMatches(context.section, key)) continue;
      const sectionPath = ['sections', key];
      if (origin.scope === 'section') { candidates.push({ doc, keys: [...sectionPath, 'settings', origin.key] }); continue; }
      function walk(node, keys, ancestors) {
        for (const [id, block] of node.children?.get('blocks')?.children || []) {
          const next = [...keys, 'blocks', id];
          const chain = [...ancestors, id];
          if (suffixMatches(context.block, id)) {
            const hints = context.blocks || [];
            // Rendered ancestors may omit tag:null blocks. Require every hint
            // in order, and refuse if more than one source path remains.
            let at = 0, matched = 0;
            for (const hint of hints) {
              while (at < chain.length && !suffixMatches(hint, chain[at])) at++;
              if (at === chain.length) break;
              at++; matched++;
            }
            if (matched === hints.length) {
              candidates.push({ doc, keys: [...next, 'settings', origin.key] });
            }
          }
          walk(block, next, chain);
        }
      }
      walk(section, sectionPath, []);
    }
  }
  if (candidates.length !== 1) throw new Error(candidates.length ? 'Several blocks match this instance; the source is ambiguous' : 'This setting has no unique local template value');
  return jsonTarget(candidates[0].doc, candidates[0].keys);
}
function localeTarget(root, origin, context) {
  const files = fs.readdirSync(path.join(root, 'locales')).filter(f => f.endsWith('.json') && !f.endsWith('.schema.json'));
  let locale = context.locale || '';
  if (locale && !/^[\w-]+$/.test(locale)) throw new Error('Invalid locale');
  let filename = files.find(f => f.toLowerCase() === locale.toLowerCase() + '.json') || files.find(f => f.toLowerCase() === locale.toLowerCase() + '.default.json');
  if (!filename && !locale) {
    const defaults = files.filter(f => f.endsWith('.default.json'));
    if (defaults.length === 1) filename = defaults[0];
  }
  if (!filename) throw new Error('The active locale has no local translation file');
  return jsonTarget(readJSON(root, 'locales/' + filename), origin.key.split('.'));
}
function readPlans(root) {
  const plans = [];
  for (const dir of ['blocks', 'snippets', 'sections', 'layout', 'templates']) {
    const folder = path.join(root, dir);
    if (!fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder)) {
      if (!name.endsWith('.liquid')) continue;
      const file = dir + '/' + name;
      plans.push(plan(fs.readFileSync(safeFile(root, file), 'utf8'), file));
    }
  }
  return plans;
}
function reachable(binding, p, before, all, visited = new Set()) {
  if (!binding) return [];
  if (binding.id) return [binding];
  const key = p.file + ':' + binding.alias + ':' + before;
  if (visited.has(key)) return [];
  visited = new Set([...visited, key]);
  const definitions = p.assignments.filter(a => a.name === binding.alias && a.start < before);
  const found = definitions.flatMap(a => reachable(a.binding, p, a.start, all, visited));
  // Snippet parameters have their own Liquid render scope.
  if (p.file.startsWith('snippets/')) {
    const snippet = path.basename(p.file, '.liquid');
    for (const caller of all) for (const r of caller.renders) {
      if (r.snippet === snippet && r.name === binding.alias) found.push(...reachable(r.binding, caller, r.start, all, visited));
    }
  }
  return found;
}
function resolve(resolved, bindingOverride) {
  const p = plan(resolved.source, resolved.relPath);
  const binding = bindingOverride || textBinding(resolved.source, resolved.element, p);
  if (!binding) return { reason: 'The text is computed or contains mixed markup, rather than one traceable string.' };
  const context = require('./liquid-context.cjs').context(resolved.context);
  try {
    let origin = binding;
    if (binding.alias) {
      if (!/^[a-f0-9]{16}$/.test(context.origin || '')) throw new Error('Reload the preview to trace the selected variable assignment');
      let possibilities = reachable(binding, p, resolved.element.tagStart, [p]);
      if (!possibilities.some(o => o.id === context.origin) && resolved.appRoot) {
        possibilities = reachable(binding, p, resolved.element.tagStart, readPlans(resolved.appRoot));
      }
      origin = possibilities.find(o => o.id === context.origin);
      if (!origin) throw new Error('The executed expression has no supported local string source');
    }
    let target;
    if (origin.kind === 'setting') target = settingTarget(resolved.appRoot, origin, context);
    else if (origin.kind === 'locale') target = localeTarget(resolved.appRoot, origin, context);
    else {
      const file = safeFile(resolved.appRoot, origin.file);
      const source = fs.readFileSync(file, 'utf8');
      target = { ...origin, file, rel: origin.file, source };
    }
    if (origin.kind === 'setting' && /\{[%{]/.test(target.value)) throw new Error('This setting is connected to a Shopify dynamic source, rather than a stored local string.');
    const id = hash(target.rel + '|' + (target.keys ? JSON.stringify(target.keys) : origin.id)).slice(0, 16);
    const format = /<[^>]+>/.test(target.value) ? 'html' : /\{[%{]/.test(target.value) ? 'template' : 'text';
    let richText=null;
    if(!binding.escaped&&!origin.escaped&&!/\{%/.test(target.value)) {
      try { richText=require('./rich-text-source.cjs').describe(target.value,id,richOptions(target.value)).descriptor; } catch {}
    }
    return { target, origin, richText, descriptor: { id, file: target.rel, path: target.keys?.join('.') || origin.kind, hash: hash(target.source), kind: origin.kind, scope: origin.scope || 'shared', format } };
  } catch (err) { return { reason: err.message }; }
}
function planWrite(resolved, op, bindingOverride) {
  if (op.fileHash !== resolved.hash) return { ok: false, refused: true, reason: 'The markup changed. Re-select the element before saving.' };
  const result = resolve(resolved, bindingOverride);
  if (!result.target) return { ok: false, refused: true, reason: result.reason };
  const { target, descriptor } = result;
  if (op.sourceId !== descriptor.id || op.sourceHash !== descriptor.hash) return { ok: false, refused: true, reason: 'The string source changed. Re-select the element before saving.' };
  if (typeof op.text !== 'string') return { ok: false, refused: true, reason: 'setText needs a string.' };
  const placeholders = value => (value.match(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g) || []).sort();
  if (JSON.stringify(placeholders(target.value)) !== JSON.stringify(placeholders(op.text))) return { ok: false, refused: true, reason: 'Keep the existing translation placeholders unchanged.' };
  let replacement;
  if (target.kind === 'json') replacement = JSON.stringify(op.text);
  else if (target.kind === 'capture') replacement = op.text;
  else {
    const quote = !op.text.includes("'") ? "'" : !op.text.includes('"') ? '"' : null;
    if (!quote || /[\r\n]|\{%|%\}|\{\{|\}\}/.test(op.text)) return { ok: false, refused: true, reason: 'This Liquid literal needs a single line with an available quote delimiter.' };
    replacement = quote + op.text + quote;
  }
  const next = target.source.slice(0, target.start) + replacement + target.source.slice(target.end);
  if (target.kind === 'json') json.parse(next);
  return { ok: true, hash: target.file === resolved.file ? hash(next) : resolved.hash, sourceHash: hash(next), sourceId: descriptor.id,
    edits: [{file:target.file,before:target.source,after:next}] };
}
function write(resolved,op) {
  return require('./transactions.cjs').applyPlan(resolved.appRoot,planWrite(resolved,op));
}

function richOptions(value) {return {tokens:[...new Set(value.match(/\{\{[\s\S]*?\}\}/g)||[])]};}
function planWriteChildren(resolved,op) {
  const result=resolve(resolved);
  if(!result.richText)return {ok:false,refused:true,reason:'This source cannot preserve inline formatting.'};
  try {
    const text=require('./rich-text-source.cjs').rewrite(result.target.value,result.descriptor.id,op.children,richOptions(result.target.value));
    return planWrite(resolved,{...op,text});
  } catch(err) {return {ok:false,refused:true,reason:err.message};}
}

module.exports = { plan, textBinding, resolve, write, planWrite, planWriteChildren, expression, variable, marker };
