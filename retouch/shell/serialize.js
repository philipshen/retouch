// DOM -> op children tree (RFC-0001 DR-0014). Kept separate from shell.js
// so it can be unit-tested in Node with a tiny fake DOM. Loaded as a plain
// browser script (defines window.RetouchSerialize) and require()-d in tests.
(function (root) {
  var FMT = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u', S: 's', STRIKE: 's', DEL: 's' };

  // root: a DOM element being edited. snapshot: Map(id -> original textContent)
  // of stamped descendants captured when editing began. Produces the
  // constrained tree: text runs, kept stamped elements (recursing only when
  // their text changed), the fixed formatting vocabulary, and nothing else —
  // unknown wrappers (paste artifacts) flatten to their content.
  function serializeChildren(el, snapshot) {
    var out = [];
    var nodes = el.childNodes || [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.__rtKeep) { out.push({ t: 'keep', id: n.__rtKeep }); continue; }
      if (n.nodeType === 3) {
        if (n.textContent) out.push({ t: 'text', value: n.textContent });
        continue;
      }
      if (n.nodeType !== 1) continue;
      var id = (n.getAttribute && (n.getAttribute('data-rt-keep') || n.getAttribute('data-rt') || n.getAttribute('data-rt-i'))) || null;
      if (id && snapshot && snapshot.has(id)) {
        var before = snapshot.get(id);
        var unchanged = typeof before === 'string' ? n.textContent === before : n.innerHTML === before.html;
        if (unchanged) out.push({ t: 'keep', id: id });
        else out.push({ t: 'keep', id: id, children: serializeChildren(n, snapshot) });
        continue;
      }
      var tag = FMT[n.tagName];
      if (tag) {
        out.push({ t: 'wrap', tag: tag, children: serializeChildren(n, snapshot) });
        continue;
      }
      if (n.tagName === 'BR') {
        out.push({ t: 'text', value: ' ' });
        continue;
      }
      // Unknown element: flatten to its content.
      var inner = serializeChildren(n, snapshot);
      for (var j = 0; j < inner.length; j++) out.push(inner[j]);
    }
    return out;
  }

  var api = { serializeChildren: serializeChildren };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RetouchSerialize = api;
})(typeof window !== 'undefined' ? window : null);
