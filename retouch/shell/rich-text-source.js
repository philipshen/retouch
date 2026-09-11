(function(root){
  // Match a source descriptor against the already-rendered DOM. No source
  // HTML is injected; any renderer transformation we cannot match fails
  // before the editable DOM is changed.
  function prepare(el,descriptor) {
    var actions=[],d=el.ownerDocument;
    // Liquid surrounds plain output with template indentation. There is no
    // markup or interpolation to protect in this case; keep the DOM intact.
    var item=descriptor.children[0];
    if(descriptor.children.length===1 && item.t==='text' &&
      (item.parts||[]).every(function(part){return part.t==='text';}) &&
      el.childNodes.length===1 && el.childNodes[0].nodeType===3 &&
      el.childNodes[0].textContent.trim()===item.value.trim())return;

    function walk(nodes,items) {
      if(nodes.length!==items.length)throw new Error('The rendered text structure changed. Reload before editing it.');
      items.forEach(function(item,i){
        var node=nodes[i];
        if(item.t==='element') {
          if(node.nodeType!==1||node.tagName.toLowerCase()!==item.tag)throw new Error('The renderer changed the stored markup. Edit its source text instead.');
          actions.push(function(){node.setAttribute('data-rt-keep',item.id);if(item.opaque)node.setAttribute('contenteditable','false');});
          if(!item.opaque)walk(Array.from(node.childNodes),item.children);
        } else if(item.t==='comment') {
          if(node.nodeType!==8)throw new Error('The rendered text structure changed.');
          actions.push(function(){node.__rtKeep=item.id;});
        } else {
          if(node.nodeType!==3)throw new Error('The renderer changed the stored text.');
          var parts=item.parts||[{t:'text',value:item.value}];
          var escaped=function(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');};
          var pattern='^'+parts.map(function(part){return part.t==='token'?'([\\s\\S]*?)':escaped(part.value);}).join('')+'$';
          var match=new RegExp(pattern).exec(node.textContent);
          if(!match)throw new Error('The rendered text differs from its source. Reload before editing it.');
          if(parts.some(function(part){return part.t==='token';}))actions.push(function(){
            var fragment=d.createDocumentFragment(),group=1;
            parts.forEach(function(part){
              if(part.t==='text')fragment.appendChild(d.createTextNode(part.value));
              else {var token=d.createElement('span');token.setAttribute('data-rt-keep',part.id);token.setAttribute('data-rt-token','');token.setAttribute('contenteditable','false');token.textContent=match[group++];fragment.appendChild(token);}
            });
            node.replaceWith(fragment);
          });
        }
      });
    }
    walk(Array.from(el.childNodes),descriptor.children);
    actions.forEach(function(action){action();});
  }
  function storedText(text,original,source) {
    var index=original.indexOf(source);
    if(!source || index<0)return text;
    var prefix=original.slice(0,index),suffix=original.slice(index+source.length);
    if(prefix.trim() || suffix.trim())return text;
    if(prefix && text.startsWith(prefix))text=text.slice(prefix.length);
    if(suffix && text.endsWith(suffix))text=text.slice(0,-suffix.length);
    return text;
  }
  var api={prepare:prepare,storedText:storedText};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.RetouchRichTextSource=api;
})(typeof window!=='undefined'?window:null);
