(function(root){
 const containers=new Set(['DIV','SECTION','ARTICLE','ASIDE','NAV','MAIN','HEADER','FOOTER','BLOCKQUOTE','LI','TD','TH','FORM','FIELDSET','FIGURE','FIGCAPTION','DETAILS','DIALOG','BODY']);
 function supported(el){return !!el&&containers.has(el.tagName);}
 function state(el){const lists=[...el.querySelectorAll('ul,ol')];if(!lists.length)return 'none';return lists.every(node=>node.tagName===lists[0].tagName)?lists[0].tagName.toLowerCase():'mixed';}
 function rename(node,tag){
  if(node.tagName.toLowerCase()===tag)return node;
  const next=node.ownerDocument.createElement(tag);
  for(const attr of node.attributes)next.setAttribute(attr.name,attr.value);
  for(const key of Object.keys(node))if(key.startsWith('__rt'))next[key]=node[key];
  next.__rtBlockTag=tag;if(tag==='p'&&!node.hasAttribute('data-rt')&&!node.hasAttribute('data-rt-keep'))next.style.margin='0';next.append(...node.childNodes);node.replaceWith(next);return next;
 }
 function selectionOffsets(el){const d=el.ownerDocument,selection=d.getSelection();if(!selection.rangeCount)return null;const range=selection.getRangeAt(0);if(!el.contains(range.startContainer)||!el.contains(range.endContainer))return null;const measure=(node,offset)=>{const r=d.createRange();r.selectNodeContents(el);r.setEnd(node,offset);return r.toString().length;};return [measure(range.startContainer,range.startOffset),measure(range.endContainer,range.endOffset)];}
 function restoreSelection(el,offsets){if(!offsets)return;const d=el.ownerDocument,walker=d.createTreeWalker(el,4),range=d.createRange();let at=0,start=false;for(let node;node=walker.nextNode();){const end=at+node.length;if(!start&&offsets[0]<=end){range.setStart(node,offsets[0]-at);start=true;}if(start&&offsets[1]<=end){range.setEnd(node,offsets[1]-at);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(range);return;}at=end;}range.selectNodeContents(el);range.collapse(false);d.getSelection().removeAllRanges();d.getSelection().addRange(range);}
 function apply(el,kind){
  if(!supported(el)||!['none','ul','ol'].includes(kind))return false;
  const offsets=selectionOffsets(el),d=el.ownerDocument;
  if(kind==='none'){
   for(const list of [...el.querySelectorAll('ul,ol')].reverse())rename(list,'div');
   for(const item of [...el.querySelectorAll('li')].reverse())rename(item,'div');
  }else{
   // Retain source-owned list containers instead of merging away attributes.
   for(const list of [...el.querySelectorAll('ul,ol')].reverse())rename(list,kind);
   let list=null,item=null;
   const addList=before=>{list=d.createElement(kind);list.style.cssText='list-style: revert; margin: 0; padding-inline-start: 1.5em;';el.insertBefore(list,before);item=null;};
   for(const node of [...el.childNodes]){
    if(node.nodeType===1&&/^(UL|OL)$/.test(node.tagName)){list=null;item=null;continue;}
    if(node.nodeType===1&&node.tagName==='DIV'&&[...node.children].length&&[...node.childNodes].every(child=>child.nodeType===3&&!child.textContent.trim()||child.nodeType===1&&/^(P|DIV)$/.test(child.tagName))){
     const group=rename(node,kind);for(const paragraph of [...group.children])rename(paragraph,'li');list=null;item=null;continue;
    }
    if(node.nodeType===3&&!node.textContent.trim()&&!list)continue;
    if(!list)addList(node);
    if(node.nodeType===1&&/^(P|DIV)$/.test(node.tagName)){
     const next=rename(node,'li');list.append(next);item=null;
    }else if(node.nodeType===1&&node.tagName==='BR'){
     if(!item){item=d.createElement('li');list.append(item);}item.append(node);item=null;
    }else{
     if(!item){item=d.createElement('li');list.append(item);}item.append(node);
    }
   }
  }
  restoreSelection(el,offsets);return true;
 }
 const api={supported,state,apply};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.RetouchListEditing=api;
})(typeof window!=='undefined'?window:null);
