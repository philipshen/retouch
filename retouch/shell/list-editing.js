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
  const first=item(range.startContainer);let last=item(range.endContainer);
  // DOM ranges exclude their end boundary. Selecting through the start of the
  // next item must not indent that untouched item (including nested text runs).
  if(!range.collapsed&&last&&last!==first){
   const before=el.ownerDocument.createRange();before.selectNodeContents(last);before.setEnd(range.endContainer,range.endOffset);
   const fragment=before.cloneContents();
   if(!fragment.textContent&&!fragment.querySelector('br,img,input,svg,video,audio,canvas,iframe,ul,ol,[contenteditable="false"]'))last=last.previousElementSibling;
  }
  if(!first||!last||first===el||last===el||!el.contains(first)||!el.contains(last)||first.parentElement!==last.parentElement)return null;
  const list=first.parentElement;if(!/^(UL|OL)$/.test(list.tagName)||!el.contains(list))return null;
  const siblings=[...list.children],from=siblings.indexOf(first),to=siblings.indexOf(last),items=siblings.slice(from,to+1);
  if(from<0||to<from||items.some(node=>node.tagName!=='LI'))return null;
  return {items,list,range};
 }
 function startNumber(list){const value=list.getAttribute('start');return value!==null?value:list.hasAttribute('reversed')?String([...list.children].filter(child=>child.tagName==='LI').length):'1';}
 function setStart(el,value){
  const context=listContext(el);if(!context||context.list.tagName!=='OL'||value!==null&&(!Number.isInteger(value)||value<1||value>1000000))return false;
  const {list}=context,next=value===null?null:String(value);if(list.getAttribute('start')===next)return false;
  if(next===null)list.removeAttribute('start');else list.setAttribute('start',next);list.__rtListStart=value;return true;
 }
 function prefixContext(el,withSpace=false){
  if(!supported(el))return null;
  const d=el.ownerDocument,selection=d.getSelection();if(!selection.rangeCount)return null;
  const range=selection.getRangeAt(0);if(!range.collapsed||!el.contains(range.startContainer)||listContext(el))return null;
  let top=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
  while(top&&top!==el&&top.parentElement!==el)top=top.parentElement;
  const block=top!==el&&top?.matches('p,div,span[data-retouch-paragraph]')?top:el;
  if(block===el&&[...el.children].some(node=>!['SPAN','A','STRONG','B','EM','I','U','S','SUP','SUB','CODE','MARK','SMALL','ABBR'].includes(node.tagName)||node.hasAttribute('data-retouch-paragraph')))return null;
  if(block!==el&&block.querySelector('p,div,ul,ol'))return null;
  const prefix=d.createRange();prefix.selectNodeContents(block);prefix.setEnd(range.startContainer,range.startOffset);
  const value=prefix.toString(),match=(withSpace?/^(-|\*|1[.)]) $/:/^(-|\*|1[.)])$/).exec(value);
  if(!match||prefix.cloneContents().querySelector('br,img,input,svg,button,select,textarea,ul,ol,[contenteditable="false"]'))return null;
  return {block,prefix,kind:match[1]==='-'||match[1]==='*'?'ul':'ol'};
 }
 function prefix(el){
  const context=prefixContext(el,true);if(!context)return false;
  const {block,prefix,kind}=context,d=el.ownerDocument;
  prefix.deleteContents();
  const list=d.createElement(kind);list.style.cssText='list-style: revert; margin: 0; padding-inline-start: 1.5em;';
  if(block===el){const item=d.createElement('li');item.append(...el.childNodes);list.append(item);el.append(list);placeholder(item);syncMarkers(el);caret(item);return true;}
  block.before(list);
  let item;if(block.matches('span[data-retouch-paragraph]')){item=d.createElement('li');item.append(block);}else item=rename(block,'li');
  list.append(item);placeholder(block.matches('span[data-retouch-paragraph]')?block:item);syncMarkers(el);caret(item);return true;
 }
 function listDepth(list,el){let depth=0;for(let node=list;node&&node!==el;node=node.parentElement)if(/^(UL|OL)$/.test(node.tagName))depth++;return depth;}
 function syncMarkers(el){
  for(const list of el.querySelectorAll('ul,ol')){
   const marker=list.tagName==='UL'?'disc':['decimal','lower-alpha','lower-roman'][(listDepth(list,el)-1)%3];
   list.style.setProperty('list-style-type',marker,list.style.getPropertyPriority('list-style-type'));
   list.__rtListMarker=marker;
  }
 }
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
  const sourceSpacing=authoredListSpacing(list),spacingChanges=new Map([[list,sourceSpacing]]);
  if(outdent){
   const parent=list.parentElement,outer=parent.parentElement,anchor=parent.nextSibling,last=items.at(-1),following=[];
   for(let next=last.nextSibling;next;next=next.nextSibling)following.push(next);
   spacingChanges.set(outer,destinationListSpacing(outer,sourceSpacing));
   if(following.some(node=>node.nodeType===1)){const tail=copiedList(list);tail.append(...following);last.append(tail);spacingChanges.set(tail,sourceSpacing);}
   for(const item of items)outer.insertBefore(item,anchor);
   if([...list.childNodes].every(node=>node.nodeType===3&&!node.textContent.trim()))list.remove();
  }else{
   const previous=items[0].previousElementSibling;let nested=previous.lastElementChild;
   if(nested?.tagName!==list.tagName||nested.nextSibling&&[...previous.childNodes].slice([...previous.childNodes].indexOf(nested)+1).some(node=>node.textContent.trim())){nested=copiedList(list);previous.append(nested);}
   spacingChanges.set(nested,destinationListSpacing(nested,sourceSpacing));
   nested.append(...items);
  }
  for(const [changedList,value]of spacingChanges)if(value!==null&&el.contains(changedList))setBlockSpacing(el,listSpacingNodes(changedList,1),value);
  syncMarkers(el);
  if(el.contains(caret.start)&&el.contains(caret.end)){const restored=d.createRange();restored.setStart(caret.start,caret.from);restored.setEnd(caret.end,caret.to);d.getSelection().removeAllRanges();d.getSelection().addRange(restored);}else restoreSelection(el,offsets);
  return true;
 }
 function markerItem(el){
  const context=listContext(el);if(!context||!context.range.collapsed)return false;
  const item=context.items[0],d=el.ownerDocument,prefix=d.createRange();prefix.selectNodeContents(item);prefix.setEnd(context.range.startContainer,context.range.startOffset);
  if(prefix.toString().length||prefix.cloneContents().querySelector('br,img,input,ul,ol')||d.defaultView.getComputedStyle(item).listStyleType==='none')return false;
  return item;
 }
 function canRemoveMarker(el){return !!markerItem(el);}
 function removeMarker(el){
  const item=markerItem(el);if(!item)return false;
  item.style.setProperty('list-style-type','none',item.style.getPropertyPriority('list-style-type'));item.__rtListMarker='none';return true;
 }
 function copyTextShell(node){
  const copy=node.cloneNode(false),source=node.__rtSourceCopy||node.getAttribute('data-rt-keep')||node.getAttribute('data-rt')||node.getAttribute('data-rt-i');
  for(const key of Object.keys(node))if(key.startsWith('__rt'))copy[key]=node[key];
  if(source&&!node.__rtReplaceRangeStyle)copy.__rtSourceCopy=source;else delete copy.__rtSourceCopy;
  for(const attr of [...copy.attributes])if(['id','key','ref','value'].includes(attr.name)||/^on/i.test(attr.name)||/^data-rt(?:-|$)/.test(attr.name))copy.removeAttribute(attr.name);
  return copy;
 }
 function caret(node){const d=node.ownerDocument;while(node.firstChild&&(node.firstChild.nodeType===3||node.firstChild.nodeType===1&&/^(SPAN|A|STRONG|B|EM|I|U|S|SUP|SUB|CODE|MARK|SMALL|ABBR)$/.test(node.firstChild.tagName)&&node.firstChild.getAttribute('contenteditable')!=='false'&&!node.firstChild.__rtKeep))node=node.firstChild;const r=d.createRange();r.setStart(node,0);r.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(r);}
 function placeholder(node){const d=node.ownerDocument;if(!node.textContent&&!node.querySelector('img,input,ul,ol')){if(!node.querySelector('br'))node.append(d.createElement('br'));}}
 function splitRange(items,range){
  const first=items[0],last=items.at(-1),d=first.ownerDocument;
  const start=range.startContainer,offset=range.startOffset;
  range.deleteContents();
  if(items.length>1){first.append(...last.childNodes);for(const item of items.slice(1))item.remove();range.setStart(start,Math.min(offset,start.nodeType===3?start.length:start.childNodes.length));range.collapse(true);}
  let parent=range.startContainer,after;
  if(parent.nodeType===3){after=parent.splitText(range.startOffset);parent=parent.parentNode;}
  else after=parent.childNodes[range.startOffset]||null;
  let fragment=d.createDocumentFragment();while(after){const next=after.nextSibling;fragment.append(after);after=next;}
  while(parent!==first){
   const copy=copyTextShell(parent);copy.append(fragment);const next=d.createDocumentFragment();next.append(copy);
   let sibling=parent.nextSibling;while(sibling){const following=sibling.nextSibling;next.append(sibling);sibling=following;}
   fragment=next;parent=parent.parentNode;
  }
  const next=copyTextShell(first);next.append(fragment);first.after(next);
  placeholder(first);placeholder(next);caret(next);return next;
 }
 function listJoinContext(el,backward=true){
  const context=listContext(el);if(!context||!context.range.collapsed)return null;
  const current=context.items[0],d=el.ownerDocument,edge=d.createRange();edge.selectNodeContents(current);
  if(backward)edge.setEnd(context.range.startContainer,context.range.startOffset);else edge.setStart(context.range.startContainer,context.range.startOffset);
  const fragment=edge.cloneContents();if(fragment.textContent.length||fragment.querySelector('img,input,svg,canvas,video,audio,iframe,object,embed,hr,button,select,textarea,ul,ol')||fragment.querySelectorAll('br').length>(backward?0:1))return null;
  const other=backward?current.previousElementSibling:current.nextElementSibling;if(other?.tagName!=='LI')return null;
  const left=backward?other:current,right=backward?current:other;
  // A nested list is a separate sequence of text lines. Do not jump over it.
  if(left.querySelector('ul,ol')||right.querySelector('ul,ol'))return null;
  return {left,right,gap:[],listItem:true};
 }
 function joinContext(el,backward=true){
  const d=el.ownerDocument,selection=d.getSelection();if(!selection.rangeCount)return null;
  const range=selection.getRangeAt(0);if(!range.collapsed||!el.contains(range.startContainer))return null;
  const node=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
  const current=node.closest('p,div,span[data-retouch-paragraph]');if(!current||current===el||!el.contains(current))return listJoinContext(el,backward);
  const native=current.tagName!=='SPAN',plain=node=>node?.nodeType===1&&node.matches('p,div,span[data-retouch-paragraph]')&&!node.querySelector('p,div,ul,ol,table,section,article,span[data-retouch-paragraph]')&&d.defaultView.getComputedStyle(node).display==='block'&&[...node.querySelectorAll('*')].every(child=>!/^(?:block|flow-root|flex|grid|table|list-item)/.test(d.defaultView.getComputedStyle(child).display));
  if(native&&current.parentElement!==el)return listJoinContext(el,backward);
  if(native&&(!plain(current)||/flex|grid/.test(d.defaultView.getComputedStyle(el).display)))return null;
  const edge=d.createRange();edge.selectNodeContents(current);if(backward)edge.setEnd(range.startContainer,range.startOffset);else edge.setStart(range.startContainer,range.startOffset);
  const fragment=edge.cloneContents();if(fragment.textContent.length||fragment.querySelector('img,input,svg,canvas,video,audio,iframe,object,embed,hr,button,select,textarea,ul,ol')||fragment.querySelectorAll('br').length>(backward?0:1))return null;
  const gap=[];let other=backward?current.previousSibling:current.nextSibling;
  while(other?.nodeType===3&&!other.textContent.trim()){gap.push(other);other=backward?other.previousSibling:other.nextSibling;}
  if(other?.nodeType!==1||!other.matches('p,div,span[data-retouch-paragraph]'))return listJoinContext(el,backward);
  if((native||other.tagName!=='SPAN')&&(!plain(other)||!plain(current)||current.parentElement!==el||/flex|grid/.test(d.defaultView.getComputedStyle(el).display)))return null;
  return {left:backward?other:current,right:backward?current:other,gap};
 }
 function join(el,backward=true){
  const context=joinContext(el,backward);if(!context)return false;
  const {left,gap}=context,d=el.ownerDocument;let right=context.right;
  // The merged paragraph ends where the right paragraph ended. Preserve its
  // authored gap, including zero when it was the final paragraph.
  const ending=left.style.marginBlockStart==='0px'&&right.style.marginBlockStart==='0px'&&/^\d+(?:\.\d+)?px$/.test(left.style.marginBlockEnd)&&/^\d+(?:\.\d+)?px$/.test(right.style.marginBlockEnd)?right.style.marginBlockEnd:null;
  if(context.listItem){
   for(const [item,first]of [[left,false],[right,true]]){
    const children=[...item.childNodes].filter(node=>node.nodeType!==3||node.textContent.trim()),edge=first?children[0]:children.at(-1);
    if(edge?.nodeType===1&&edge.matches('span[data-retouch-paragraph]')){edge.removeAttribute('data-retouch-paragraph');edge.style.setProperty('display','inline',edge.style.getPropertyPriority('display'));edge.__rtParagraphInline=true;}
   }
  }
  const content=d.createTreeWalker(left,5);let finalContent=null;while(content.nextNode()){const node=content.currentNode;if(node.nodeType===3&&node.data.length||node.nodeType===1&&/^(BR|IMG|INPUT|SVG|CANVAS|VIDEO|AUDIO|IFRAME|OBJECT|EMBED|HR)$/.test(node.tagName))finalContent=node;}
  if(finalContent?.nodeType===1&&finalContent.tagName==='BR')finalContent.remove();
  const walker=d.createTreeWalker(left,4);let last=null;while(walker.nextNode())last=walker.currentNode;
  const caretNode=last||left,offset=last?last.length:left.childNodes.length;
  const source=node=>node.__rtSourceCopy||node.getAttribute('data-rt-keep')||node.getAttribute('data-rt')||node.getAttribute('data-rt-i');
  const appearance=node=>JSON.stringify([...node.attributes].filter(attr=>attr.name!=='id'&&!/^on/i.test(attr.name)&&!/^data-rt(?:-|$)/.test(attr.name)).map(attr=>[attr.name,attr.value]).sort(([a],[b])=>a.localeCompare(b)));
  const sameOrigin=source(left)?right.__rtSourceCopy===source(left):!source(right);
  const flatten=sameOrigin&&appearance(left)===appearance(right);
  if(right.tagName!=='SPAN'&&!flatten){const span=d.createElement('span');for(const attr of right.attributes)span.setAttribute(attr.name,attr.value);for(const key of Object.keys(right))if(key.startsWith('__rt'))span[key]=right[key];span.append(...right.childNodes);right.replaceWith(span);right=span;delete right.__rtBlockTag;delete right.__rtListMarker;}
  for(const node of gap)node.remove();
  if(flatten){left.append(...right.childNodes);right.remove();}
  else {right.removeAttribute('data-retouch-paragraph');right.style.setProperty('display','inline',right.style.getPropertyPriority('display'));right.__rtParagraphInline=true;left.append(right);}
  if(ending!==null&&left.style.marginBlockEnd!==ending){left.style.marginBlockEnd=ending;left.__rtParagraphSpacing=parseFloat(ending);}
  const range=d.createRange();range.setStart(caretNode,offset);range.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(range);return true;
 }
 function spacingParagraphs(el){
  if(!el)return [];
  const nodes=[...el.childNodes].filter(node=>node.nodeType!==8&&!(node.nodeType===3&&!node.textContent.trim()));
  if(nodes.length<2||nodes.some(node=>node.nodeType!==1||!node.matches('p,div,span[data-retouch-paragraph]')||node.querySelector('p,div,ul,ol,table,span[data-retouch-paragraph]')))return [];
  const view=el.ownerDocument.defaultView;if(/flex|grid/.test(view.getComputedStyle(el).display))return [];
  if(nodes.some(node=>view.getComputedStyle(node).display!=='block'||[...node.style].some(name=>(name==='all'||name==='margin'||name.startsWith('margin-'))&&node.style.getPropertyPriority(name)==='important')))return [];
  return nodes;
 }
 function listSpacingNodes(list,minimum=2){
  if(!list)return [];
  const nodes=[...list.children],view=list.ownerDocument.defaultView;
  if(nodes.length<minimum||/flex|grid/.test(view.getComputedStyle(list).display)||nodes.some(node=>node.tagName!=='LI'||view.getComputedStyle(node).display!=='list-item'||[...node.style].some(name=>(name==='all'||name==='margin'||name.startsWith('margin-'))&&node.style.getPropertyPriority(name)==='important')))return [];
  return nodes;
 }
 function authoredListSpacing(list){
  const nodes=listSpacingNodes(list),values=nodes.slice(0,-1).map(node=>node.style.marginBlockStart==='0px'?node.style.marginBlockEnd:'');
  return values.length&&values.every(value=>value===values[0]&&/^\d+(?:\.\d+)?px$/.test(value))?parseFloat(values[0]):null;
 }
 function destinationListSpacing(list,fallback){const value=authoredListSpacing(list);return value!==null?value:list.children.length<2?fallback:null;}
 function spacingListItems(el){return listSpacingNodes(listContext(el)?.list);}
 function setParagraphSpacing(el,value){return setBlockSpacing(el,spacingParagraphs(el),value);}
 function setListSpacing(el,value){return setBlockSpacing(el,spacingListItems(el),value);}
 function setBlockSpacing(el,nodes,value){
  if(!Number.isFinite(value)||value<0||value>10000||!nodes.length)return false;
  const original=nodes.map(node=>node.getAttribute('style')),ends=nodes.map((_,index)=>index===nodes.length-1?0:value);
  nodes.forEach((node,index)=>{node.style.setProperty('margin-block-start','0px');node.style.setProperty('margin-block-end',ends[index]+'px');});
  if(nodes.some((node,index)=>{const css=el.ownerDocument.defaultView.getComputedStyle(node);return Math.abs(parseFloat(css.marginBlockStart))>0.01||Math.abs(parseFloat(css.marginBlockEnd)-ends[index])>0.01;})){
   nodes.forEach((node,index)=>{if(original[index]===null)node.removeAttribute('style');else node.setAttribute('style',original[index]);});return false;
  }
  let changed=false;nodes.forEach((node,index)=>{if(node.getAttribute('style')!==original[index]){node.__rtParagraphSpacing=ends[index];changed=true;}});return changed;
 }
 function paragraph(el){
  const spaced=spacingParagraphs(el),values=spaced.slice(0,-1).map(node=>node.style.marginBlockStart==='0px'?node.style.marginBlockEnd:''),spacing=values.length&&values.every(value=>value===values[0]&&/^\d+(?:\.\d+)?px$/.test(value))?parseFloat(values[0]):null;
  const d=el.ownerDocument,selection=d.getSelection();if(!selection.rangeCount)return false;
  let range=selection.getRangeAt(0);if(!el.contains(range.startContainer)||!el.contains(range.endContainer))return false;
  const element=node=>node.nodeType===1?node:node.parentElement;
  if(element(range.startContainer)?.closest('li')&&el.contains(element(range.startContainer).closest('li')))return false;
  if(!el.childNodes.length)el.append(d.createTextNode(''));
  const point=(node,offset)=>{if(node!==el)return [node,offset];const child=el.childNodes[offset];if(child)return [child,0];const last=el.lastChild;return [last,last.nodeType===3?last.length:last.childNodes.length];};
  const start=point(range.startContainer,range.startOffset),end=point(range.endContainer,range.endOffset);
  const isParagraph=node=>node.nodeType===1&&(node.matches('span[data-retouch-paragraph]')||/^(P|DIV)$/.test(node.tagName));
  let group=null;
  for(const node of [...el.childNodes]){
   if(isParagraph(node)||node.nodeType===1&&/^(block|flex|grid|list-item|table)$/.test(d.defaultView.getComputedStyle(node).display)){group=null;continue;}
   if(!group){group=d.createElement('span');group.setAttribute('data-retouch-paragraph','');group.style.display='block';el.insertBefore(group,node);}
   group.append(node);
  }
  range=d.createRange();range.setStart(...start);range.setEnd(...end);selection.removeAllRanges();selection.addRange(range);
  const top=node=>{node=element(node);while(node&&node.parentElement!==el)node=node.parentElement;return node;};
  const first=top(range.startContainer),last=top(range.endContainer);if(!first||!last||!isParagraph(first)||!isParagraph(last))return false;
  const siblings=[...el.children],items=siblings.slice(siblings.indexOf(first),siblings.indexOf(last)+1);
  if(!items.length||items.some(node=>!isParagraph(node)))return false;
  splitRange(items,range);if(spacing!==null)setParagraphSpacing(el,spacing);return true;
 }
 function enter(el){
  const context=listContext(el);if(!context)return false;
  const spaced=spacingListItems(el),values=spaced.slice(0,-1).map(node=>node.style.marginBlockStart==='0px'?node.style.marginBlockEnd:''),spacing=values.length&&values.every(value=>value===values[0]&&/^\d+(?:\.\d+)?px$/.test(value))?parseFloat(values[0]):null;
  const {items,list,range}=context,d=el.ownerDocument,first=items[0],last=items.at(-1);
  if(range.collapsed&&!first.textContent.trim()&&!first.querySelector('img,input,ul,ol')){
   if(canIndent(el,true)){indent(el,true);caret(first);return true;}
   const following=[];for(let node=first.nextSibling;node;node=node.nextSibling)following.push(node);
   const tail=following.some(node=>node.nodeType===1)?copiedList(list):null;if(tail)tail.append(...following);
   const paragraph=rename(first,'p');delete paragraph.__rtSourceCopy;
   list.after(paragraph);if(tail)paragraph.after(tail);
   if(!list.children.length)list.remove();placeholder(paragraph);caret(paragraph);syncMarkers(el);return true;
  }
  splitRange(items,range);if(spacing!==null)setListSpacing(el,spacing);syncMarkers(el);return true;
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
    if(node.nodeType===1&&node.matches('span[data-retouch-paragraph]')){const next=d.createElement('li');next.append(node);list.append(next);item=null;
    }else if(node.nodeType===1&&/^(P|DIV)$/.test(node.tagName)){
     const next=rename(node,'li');list.append(next);item=null;
    }else if(node.nodeType===1&&node.tagName==='BR'){
     if(!item){item=d.createElement('li');list.append(item);}item.append(node);item=null;
    }else{
     if(!item){item=d.createElement('li');list.append(item);}item.append(node);
    }
   }
  }
  if(kind!=='none')for(const item of el.querySelectorAll('li'))if(item.style.listStyleType){item.style.setProperty('list-style-type','inherit',item.style.getPropertyPriority('list-style-type'));item.__rtListMarker='inherit';}
  syncMarkers(el);restoreSelection(el,offsets);return true;
 }
 const api={spacingListItems,setListSpacing,spacingParagraphs,setParagraphSpacing,startNumber,setStart,supported,state,apply,prefixContext,prefix,listContext,canIndent,indent,enter,paragraph,joinContext,join,removeMarker,canRemoveMarker};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.RetouchListEditing=api;
})(typeof window!=='undefined'?window:null);
