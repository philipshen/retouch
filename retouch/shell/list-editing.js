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
 function listContext(el){
  const selection=el?.ownerDocument.getSelection();if(!selection?.rangeCount)return null;const range=selection.getRangeAt(0);
  const item=node=>(node.nodeType===1?node:node.parentElement)?.closest('li');
  const first=item(range.startContainer),last=item(range.endContainer);
  if(!first||!last||first===el||last===el||!el.contains(first)||!el.contains(last)||first.parentElement!==last.parentElement)return null;
  const list=first.parentElement;if(!/^(UL|OL)$/.test(list.tagName)||!el.contains(list))return null;
  const siblings=[...list.children],from=siblings.indexOf(first),to=siblings.indexOf(last),items=siblings.slice(from,to+1);
  if(from<0||to<from||items.some(node=>node.tagName!=='LI'))return null;
  return {items,list,range};
 }
 function listDepth(list,el){let depth=0;for(let node=list;node&&node!==el;node=node.parentElement)if(/^(UL|OL)$/.test(node.tagName))depth++;return depth;}
 function canIndent(el,outdent=false){
  const context=listContext(el);if(!context)return false;const {items,list}=context;
  if(outdent){const parent=list.parentElement;return parent!==el&&parent?.tagName==='LI'&&el.contains(parent.parentElement)&&/^(UL|OL)$/.test(parent.parentElement.tagName);}
  if(items[0].previousElementSibling?.tagName!=='LI')return false;
  return Math.max(listDepth(list,el),...items.flatMap(item=>[...item.querySelectorAll('ul,ol')].map(nested=>listDepth(nested,el))))<5;
 }
 function copiedList(source){
  const list=source.ownerDocument.createElement(source.tagName);
  for(const name of ['class','style'])if(source.hasAttribute(name))list.setAttribute(name,source.getAttribute(name));
  if(!list.hasAttribute('style'))list.style.cssText='list-style: revert; margin: 0; padding-inline-start: 1.5em;';
  const id=source.__rtListTemplate||source.getAttribute('data-rt-keep')||source.getAttribute('data-rt');if(id)list.__rtListTemplate=id;
  return list;
 }
 function indent(el,outdent=false){
  if(!canIndent(el,outdent))return false;
  const {items,list,range}=listContext(el),d=el.ownerDocument,caret={start:range.startContainer,from:range.startOffset,end:range.endContainer,to:range.endOffset},offsets=selectionOffsets(el);
  if(outdent){
   const parent=list.parentElement,outer=parent.parentElement,anchor=parent.nextSibling,last=items.at(-1),following=[];
   for(let next=last.nextSibling;next;next=next.nextSibling)following.push(next);
   if(following.some(node=>node.nodeType===1)){const tail=copiedList(list);tail.append(...following);last.append(tail);}
   for(const item of items)outer.insertBefore(item,anchor);
   if([...list.childNodes].every(node=>node.nodeType===3&&!node.textContent.trim()))list.remove();
  }else{
   const previous=items[0].previousElementSibling;let nested=previous.lastElementChild;
   if(nested?.tagName!==list.tagName||nested.nextSibling&&[...previous.childNodes].slice([...previous.childNodes].indexOf(nested)+1).some(node=>node.textContent.trim())){nested=copiedList(list);previous.append(nested);}
   nested.append(...items);
  }
  if(el.contains(caret.start)&&el.contains(caret.end)){const restored=d.createRange();restored.setStart(caret.start,caret.from);restored.setEnd(caret.end,caret.to);d.getSelection().removeAllRanges();d.getSelection().addRange(restored);}else restoreSelection(el,offsets);
  return true;
 }
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
 const api={supported,state,apply,listContext,canIndent,indent};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.RetouchListEditing=api;
})(typeof window!=='undefined'?window:null);
