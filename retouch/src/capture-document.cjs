'use strict';
// Runs in the capture browser. It copies rendered state into literal source; it
// does not serialize application scripts or pretend to recover original code.
module.exports=function captureDocument({shadowKey,responsive=false}={}){
 const warnings=new Set(),output=document.implementation.createHTMLDocument(document.title),rules=[],roots=new Set([document]),scopes=new WeakMap();let count=0,scopeCount=0;
 const absolute=value=>{try{const url=new URL(value,document.baseURI);return ['http:','https:','data:','blob:'].includes(url.protocol)?url.href:'';}catch{return '';}};
 function scope(node){const tree=node.getRootNode();if(!tree.host)return null;if(scopes.has(tree))return scopes.get(tree);roots.add(tree);const ids=new Map(),elements=new WeakMap(),prefix=(shadowKey||'retouchCapture')+'-'+(++scopeCount)+'-';let index=0;for(const element of tree.querySelectorAll('[id]')){const id=prefix+(++index);elements.set(element,id);if(!ids.has(element.id))ids.set(element.id,id);}const value={ids,elements};scopes.set(tree,value);return value;}
 const reference=(node,id)=>scope(node)?.ids.get(id)||id;
 const fragment=(node,value)=>value.startsWith('#')?'#'+reference(node,value.slice(1)):value;
 const cssReferences=(node,value)=>value.replace(/url\(\s*(['"]?)#([^)'"]+)\1\s*\)/g,(match,quote,id)=>scope(node)?.ids.has(id)?'url("#'+reference(node,id)+'")':match);
 function styles(source,pseudo){
  const computed=getComputedStyle(source,pseudo),style=output.createElement('span').style;
  for(const property of computed){if(property.startsWith('animation')||property.startsWith('transition')||property==='-webkit-user-modify')continue;let value=computed.getPropertyValue(property);value=value.split(location.href.split('#')[0]+'#').join('#');value=cssReferences(source,value);style.setProperty(property,value);}
  return style.cssText;
 }
 function clone(node){
  if(node.nodeType===Node.TEXT_NODE)return output.createTextNode(node.data);
  if(node.nodeType!==Node.ELEMENT_NODE)return null;
  if(++count>10000)throw Error('This page exceeds the 10,000-layer capture limit.');
  const tag=node.localName;
  if(['script','style','link','meta','base','noscript','template','head','title','animate','set','animateMotion','animateTransform'].includes(tag))return null;
  if(['iframe','frame','object','embed'].includes(tag)){warnings.add('Embedded documents are omitted.');return null;}
  const shadow=node.shadowRoot||(shadowKey&&window[shadowKey]?.(node));if(shadow){roots.add(shadow);scope(shadow);}
  if(tag==='video'||tag==='audio')warnings.add('Media playback is not captured.');
  let target;
  if(tag==='canvas'){
   target=output.createElement('img');try{const raster=document.createElement('canvas');raster.width=node.width;raster.height=node.height;const context=raster.getContext('2d',{willReadFrequently:true});context.drawImage(node,0,0);target.src=raster.toDataURL();}catch{warnings.add('A canvas could not be captured.');target.alt='Canvas unavailable';}
  }else target=node.namespaceURI==='http://www.w3.org/2000/svg'?output.createElementNS(node.namespaceURI,tag):output.createElement(tag.includes('-')||tag==='slot'?'div':tag);
  for(const attr of node.attributes){const name=attr.name.toLowerCase();if(name.startsWith('on')||name.startsWith('data-rt')||['style','src','srcset','href','xlink:href','action','formaction','form','method','is','nonce','integrity','crossorigin','autofocus','autoplay','srcdoc','value','checked','selected'].includes(name))continue;let value=attr.value;if(['fill','stroke','clip-path','filter','mask','marker-start','marker-mid','marker-end'].includes(name))value=cssReferences(node,value);if(name==='id')value=scope(node)?.elements.get(node)||value;else if(['for','list','aria-activedescendant','aria-controls','aria-describedby','aria-details','aria-errormessage','aria-flowto','aria-labelledby','aria-owns','headers'].includes(name))value=value.split(/\s+/).map(id=>reference(node,id)).join(' ');target.setAttributeNS(attr.namespaceURI,attr.name,value);}
  const frozen=!responsive||!!scope(node)||!!shadow||tag==='canvas';target.setAttribute('style',frozen?styles(node):node.getAttribute('style')||'');const id=String(count);target.setAttribute('data-capture-node',id);
  if(frozen)for(const pseudo of ['::before','::after']){const content=getComputedStyle(node,pseudo).content;if(content&&content!=='none'&&content!=='normal')rules.push('[data-capture-node="'+id+'"]'+pseudo+'{'+styles(node,pseudo)+'}');}
  if(tag==='img'){const source=responsive?node.getAttribute('src'):node.currentSrc||node.src;if(source)target.setAttribute('src',absolute(source));if(!responsive)target.removeAttribute('loading');if(responsive&&node.hasAttribute('srcset'))target.setAttribute('srcset',node.getAttribute('srcset'));}
  if(tag==='source'){if(!responsive||node.parentElement?.localName!=='picture')return null;if(node.hasAttribute('srcset'))target.setAttribute('srcset',node.getAttribute('srcset'));}
  if(tag==='a'){const raw=node.getAttribute('href')||'',url=raw.startsWith('#')?fragment(node,raw):absolute(raw);if(url&&!url.startsWith('data:')&&!url.startsWith('blob:'))target.setAttribute('href',url);target.setAttribute('rel','noopener noreferrer');}
  if(node.namespaceURI==='http://www.w3.org/2000/svg'&&node.hasAttribute('href')){const raw=node.getAttribute('href');if(raw.startsWith('#'))target.setAttribute('href',fragment(node,raw));else if(['image','feImage','use','linearGradient','radialGradient','pattern','textPath','filter','clipPath','mask'].includes(tag))target.setAttribute('href',absolute(raw));}
  if(node.namespaceURI==='http://www.w3.org/2000/svg'&&node.hasAttribute('xlink:href')){const raw=node.getAttribute('xlink:href');target.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',raw.startsWith('#')?fragment(node,raw):absolute(raw));}
  if(tag==='form')target.setAttribute('method','dialog');
  if(tag==='input'){if(!['password','file','hidden'].includes(node.type))target.setAttribute('value',node.value);if(node.checked)target.setAttribute('checked','');}
  if(tag==='option'&&node.selected)target.setAttribute('selected','');
  if(tag==='textarea')target.textContent=node.value;
  else{let children=shadow?shadow.childNodes:node.childNodes;if(tag==='slot'){const assigned=node.assignedNodes?.();if(assigned?.length)children=assigned;}for(const child of children){const copied=clone(child);if(copied)target.append(copied);}}
  return target;
 }
 const root=clone(document.documentElement);output.replaceChild(root,output.documentElement);const head=output.createElement('head'),charset=output.createElement('meta'),title=output.createElement('title');charset.setAttribute('charset','utf-8');title.textContent=document.title;head.append(charset,title);root.prepend(head);
 const style=output.createElement('style');style.textContent=rules.join('\n').replace(/</g,'\\3c ');head.append(style);
 const styleSheets=[];if(responsive){for(const sheet of [...document.styleSheets,...document.adoptedStyleSheets]){if(sheet.disabled)continue;const media=sheet.media?.mediaText;try{const css=[...sheet.cssRules].map(rule=>rule.cssText).join('\n');styleSheets.push({css,media,base:sheet.href||document.baseURI});}catch{if(sheet.href)styleSheets.push({sheet:sheet.href,media});else warnings.add('An author stylesheet was unreadable.');}}if(scopeCount)warnings.add('Shadow components retain captured styling; their responsive rules are not reconstructed.');}
 const fontFaces=[],seen=new Set();
 function fonts(sheet){if(!sheet||sheet.disabled||seen.has(sheet)||sheet.media?.mediaText&&!matchMedia(sheet.media.mediaText).matches)return;seen.add(sheet);try{scan(sheet.cssRules,sheet.href||document.baseURI);}catch{if(sheet.href)fontFaces.push({sheet:sheet.href});else warnings.add('A font stylesheet had no readable source.');}}
 function scan(rules,base){for(const rule of rules){if(rule.type===CSSRule.FONT_FACE_RULE)fontFaces.push({css:rule.cssText,base});else if(rule.type===CSSRule.IMPORT_RULE)fonts(rule.styleSheet);else if(rule.cssRules){if(rule.type===CSSRule.MEDIA_RULE&&!matchMedia(rule.conditionText).matches)continue;if(rule.type===CSSRule.SUPPORTS_RULE&&!CSS.supports(rule.conditionText))continue;scan(rule.cssRules,base);}}}
 if(document.fonts.status==='loading')warnings.add('Some web fonts were still loading when this page was captured.');
 for(const root of roots)for(const sheet of [...root.styleSheets,...root.adoptedStyleSheets])fonts(sheet);
 if([...document.fonts].length&&!fontFaces.length)warnings.add('Web fonts without readable CSS definitions are not included.');
 return {html:'<!doctype html>\n'+output.documentElement.outerHTML+'\n',title:document.title,url:location.href,baseURL:document.baseURI,layers:count,shadowRoots:scopeCount,fontFaces,styleSheets,warnings:[...warnings]};
};
