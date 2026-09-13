// DOM -> op children tree (RFC-0001 DR-0014). Kept separate from shell.js
// so it can be unit-tested in Node with a tiny fake DOM. Loaded as a plain
// browser script (defines window.RetouchSerialize) and require()-d in tests.
(function (root) {
  var rangeStyles = typeof module !== 'undefined' && module.exports ? require('./range-style-values.js') : root.RetouchRangeStyles;
  var FMT = { SUP: 'sup', SUB: 'sub', STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u', S: 's', STRIKE: 's', DEL: 's' };

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
      if (id && snapshot && snapshot.has(id) && !n.__rtReplaceRangeStyle) {
        var before = snapshot.get(id);
        var unchanged = typeof before === 'string' ? n.textContent === before : n.innerHTML === before.html;
        if (unchanged) out.push({ t: 'keep', id: id });
        else out.push({ t: 'keep', id: id, children: serializeChildren(n, snapshot) });
        continue;
      }
      // Only validated range styles can create new styled spans.
      // Existing attributed nodes still use the source-preserving keep path above.
      if (n.tagName === 'SPAN' && n.style) {
        var properties={},styleNames=n.style.length?Array.from({length:n.style.length},function(_,index){return n.style[index];}):n.__rtRangeStyle?[n.__rtRangeStyle]:[];
        for(var property of styleNames){
          var value=n.style.getPropertyValue(property),authored=n.__rtRangeStyleValues&&n.__rtRangeStyleValues[property];
          if(snapshot&&authored&&authored.css===value)value=authored.value;
          else if(snapshot&&property===n.__rtRangeStyle&&n.__rtRangeStyleCSS===value&&n.__rtRangeStyleValue)value=n.__rtRangeStyleValue;
          properties[property]=value;
        }
        if(rangeStyles.validProperties(properties)){
          properties=Object.fromEntries(rangeStyles.names.filter(function(name){return Object.prototype.hasOwnProperty.call(properties,name);}).map(function(name){return [name,properties[name]];}));
          var entries=Object.entries(properties),children=serializeChildren(n,snapshot);
          out.push(entries.length===1?{t:'style',property:entries[0][0],value:entries[0][1],children:children}:{t:'styles',properties:properties,children:children});
          continue;
        }
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
