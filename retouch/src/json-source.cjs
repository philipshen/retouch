'use strict';
// JSON with comments, retaining exact spans so one value can be replaced
// without reformatting Shopify's generated templates or locale files.
function parse(source) {
  let i = 0;
  function space() {
    for (;;) {
      while (/\s/.test(source[i] || '') && i < source.length) i++;
      if (source.startsWith('/*', i)) {
        const end = source.indexOf('*/', i + 2);
        if (end < 0) throw new Error('Unclosed JSON comment');
        i = end + 2;
      } else if (source.startsWith('//', i)) {
        const end = source.indexOf('\n', i + 2);
        i = end < 0 ? source.length : end + 1;
      } else return;
    }
  }
  function string() {
    const start = i++;
    while (i < source.length) {
      if (source[i] === '\\') { i += 2; continue; }
      if (source[i++] === '"') return { start, end: i, value: JSON.parse(source.slice(start, i)) };
    }
    throw new Error('Unclosed JSON string');
  }
  function value() {
    space();
    const start = i;
    if (source[i] === '"') return string();
    if (source[i] === '{' || source[i] === '[') {
      const array = source[i++] === '[';
      const endChar = array ? ']' : '}';
      const children = new Map();
      const result = array ? [] : Object.create(null);
      space();
      while (source[i] !== endChar) {
        let key;
        if (array) key = String(children.size);
        else {
          if (source[i] !== '"') throw new Error('Expected JSON key');
          key = string().value;
          space();
          if (source[i++] !== ':') throw new Error('Expected JSON colon');
        }
        if (children.has(key)) throw new Error('Duplicate JSON key: ' + key);
        const child = value();
        children.set(key, child);
        result[key] = child.value;
        space();
        if (source[i] === endChar) break;
        if (source[i++] !== ',') throw new Error('Expected JSON comma');
        space();
        if (source[i] === endChar) throw new Error('Trailing JSON comma');
      }
      i++;
      return { start, end: i, value: result, children };
    }
    const m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(i));
    if (!m) throw new Error('Invalid JSON value');
    i += m[0].length;
    return { start, end: i, value: JSON.parse(m[0]) };
  }
  const root = value();
  space();
  if (i !== source.length) throw new Error('Trailing JSON content');
  return root;
}
function at(root, keys) {
  return keys.reduce((node, key) => node?.children?.get(String(key)), root);
}
module.exports = { parse, at };
