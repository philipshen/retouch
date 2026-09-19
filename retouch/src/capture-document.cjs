'use strict';
// Runs in the capture browser. It copies rendered state into literal source; it
// does not serialize application scripts or pretend to recover original code.
module.exports=function captureDocument(){
 const warnings=new Set(),output=document.implementation.createHTMLDocument(document.title),rules=[];let count=0;
 const absolute=value=>{try{const url=new URL(value,document.baseURI);return ['http:','https:','data:','blob:'].includes(url.protocol)?url.href:'';}catch{return '';}};
 function styles(source,pseudo){
  const computed=getComputedStyle(source,pseudo),style=output.createElement('span').style;
  for(const property of computed){if(property.startsWith('animation')||property.startsWith('transition')||property==='-webkit-user-modify')continue;let value=computed.getPropertyValue(property);value=value.split(location.href.split('#')[0]+'#').join('#');style.setProperty(property,value);}
  return style.cssText;
 }
 function clone(node){
  if(node.nodeType===Node.TEXT_NODE)return output.createTextNode(node.data);
  if(node.nodeType!==Node.ELEMENT_NODE)return null;
  if(++count>10000)throw Error('This page exceeds the 10,000-layer capture limit.');
  const tag=node.localName;
  if(['script','style','link','meta','base','noscript','template','head','title','animate','set','animateMotion','animateTransform'].includes(tag))return null;
  if(['iframe','frame','object','embed'].includes(tag)){warnings.add('Embedded documents are omitted.');return null;}
  if(node.shadowRoot)warnings.add('Shadow DOM contents are not captured.');
  if(tag==='video'||tag==='audio')warnings.add('Media playback is not captured.');
  let target;
  if(tag==='canvas'){
   target=output.createElement('img');try{const raster=document.createElement('canvas');raster.width=node.width;raster.height=node.height;const context=raster.getContext('2d',{willReadFrequently:true});context.drawImage(node,0,0);target.src=raster.toDataURL();}catch{warnings.add('A canvas could not be captured.');target.alt='Canvas unavailable';}
  }else target=node.namespaceURI==='http://www.w3.org/2000/svg'?output.createElementNS(node.namespaceURI,tag):output.createElement(tag.includes('-')?'div':tag);
  for(const attr of node.attributes){const name=attr.name.toLowerCase();if(name.startsWith('on')||name.startsWith('data-rt')||['style','src','srcset','href','xlink:href','action','formaction','form','method','is','nonce','integrity','crossorigin','autofocus','autoplay','srcdoc','value','checked','selected'].includes(name))continue;target.setAttributeNS(attr.namespaceURI,attr.name,attr.value);}
  target.setAttribute('style',styles(node));const id=String(count);target.setAttribute('data-capture-node',id);
  for(const pseudo of ['::before','::after']){const content=getComputedStyle(node,pseudo).content;if(content&&content!=='none'&&content!=='normal')rules.push('[data-capture-node="'+id+'"]'+pseudo+'{'+styles(node,pseudo)+'}');}
  if(tag==='img'){const url=absolute(node.currentSrc||node.src);if(url.startsWith('blob:'))warnings.add('Temporary image URLs may expire.');target.setAttribute('src',url);target.removeAttribute('loading');}
  if(tag==='source')return null;
  if(tag==='a'){const raw=node.getAttribute('href')||'',url=raw.startsWith('#')?raw:absolute(raw);if(url&&!url.startsWith('data:')&&!url.startsWith('blob:'))target.setAttribute('href',url);target.setAttribute('rel','noopener noreferrer');}
  if(node.namespaceURI==='http://www.w3.org/2000/svg'&&node.hasAttribute('href')){const raw=node.getAttribute('href');if(raw.startsWith('#'))target.setAttribute('href',raw);else if(tag==='image'||tag==='use')target.setAttribute('href',absolute(raw));}
  if(node.namespaceURI==='http://www.w3.org/2000/svg'&&node.hasAttribute('xlink:href')){const raw=node.getAttribute('xlink:href');target.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',raw.startsWith('#')?raw:absolute(raw));}
  if(tag==='form')target.setAttribute('method','dialog');
  if(tag==='input'){if(!['password','file','hidden'].includes(node.type))target.setAttribute('value',node.value);if(node.checked)target.setAttribute('checked','');}
  if(tag==='option'&&node.selected)target.setAttribute('selected','');
  if(tag==='textarea')target.textContent=node.value;
  else for(const child of node.childNodes){const copied=clone(child);if(copied)target.append(copied);}
  return target;
 }
 const root=clone(document.documentElement);output.replaceChild(root,output.documentElement);const head=output.createElement('head'),charset=output.createElement('meta'),title=output.createElement('title');charset.setAttribute('charset','utf-8');title.textContent=document.title;head.append(charset,title);root.prepend(head);
 const style=output.createElement('style');style.textContent=rules.join('\n').replace(/</g,'\\3c ');head.append(style);
 // Computed font-family alone cannot reproduce downloadable font faces.
 if([...document.fonts].length)warnings.add('Web font files are not included; unavailable fonts use their fallback.');
 return {html:'<!doctype html>\n'+output.documentElement.outerHTML+'\n',title:document.title,url:location.href,layers:count,warnings:[...warnings]};
};
