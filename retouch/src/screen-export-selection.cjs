'use strict';
// Evaluated only in the disposable export document.
module.exports=function isolateSelection(ids){
    const selected=ids.map(id=>document.querySelector('[data-capture-node="'+id+'"]'));if(selected.some(el=>!el))throw Error('A selected layer is unavailable in the snapshot.');
    // display:contents wrappers have no principal box. Their rendered children
    // still form a meaningful selection, including anonymous text fragments.
    const boxes=[];
    const measure=node=>{
     if(node.nodeType===Node.TEXT_NODE){const range=document.createRange();range.selectNodeContents(node);for(const box of range.getClientRects())boxes.push(box);return;}
     if(node.nodeType!==Node.ELEMENT_NODE)return;
     if(getComputedStyle(node).display==='contents'){for(const child of node.childNodes)measure(child);return;}
     boxes.push(node.getBoundingClientRect());
    };
    for(const node of selected)measure(node);
    const visibleBoxes=boxes.filter(box=>box.width>0&&box.height>0);
    if(!visibleBoxes.length)throw Error('The selected layers have no visible bounds.');
    const bounds=visibleBoxes.reduce((all,box)=>({left:Math.min(all.left,box.left),top:Math.min(all.top,box.top),right:Math.max(all.right,box.right),bottom:Math.max(all.bottom,box.bottom)}),{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity});
    const left=Math.floor(bounds.left+scrollX),top=Math.floor(bounds.top+scrollY),right=Math.ceil(bounds.right+scrollX),bottom=Math.ceil(bounds.bottom+scrollY);
    if(left<0||top<0)throw Error('The selected layers extend outside the page. Move them inside the page before exporting.');
    // Definitions do not paint by themselves. Keep them available to symbols,
    // masks, paint servers and other selected SVG content.
    const svgNS='http://www.w3.org/2000/svg',definitionTags=new Set(['defs','symbol','clipPath','mask','filter','marker','linearGradient','radialGradient','pattern']);
    const definition=el=>{for(let node=el;node;node=node.parentElement)if(node.namespaceURI===svgNS&&definitionTags.has(node.localName))return true;return false;};
    const fragmentId=value=>{try{return decodeURIComponent(value);}catch{return value;}};
    const uses=[...document.querySelectorAll('use')].filter(el=>el.namespaceURI===svgNS),copies=new Map();let serial=0,referenceNodes=0;
    const freshId=()=>{let id;do{id='retouch-export-reference-'+(++serial);}while(document.getElementById(id));return id;};
    // A <use> may reference a normally painted sibling, not just a <defs>
    // descendant. Give it a private definition before hiding that sibling.
    for(const use of uses){const href=use.getAttribute('href')||use.getAttributeNS('http://www.w3.org/1999/xlink','href');if(!href?.startsWith('#'))continue;const target=document.getElementById(fragmentId(href.slice(1)));if(!target||target.namespaceURI!==svgNS||definition(target)||copies.has(target.id))continue;referenceNodes+=1+target.querySelectorAll('*').length;if(referenceNodes>10000)throw Error('SVG references exceed the 10,000-layer export limit. Export a smaller selection.');copies.set(target.id,{target,clone:target.cloneNode(true),id:freshId()});}
    const globalIds=new Map([...copies].map(([id,entry])=>[id,entry.id]));
    const rewrite=(node,ids)=>{for(const attr of [...node.attributes]){let value=attr.value;if(attr.localName==='href'&&value.startsWith('#')&&ids.has(fragmentId(value.slice(1))))value='#'+ids.get(fragmentId(value.slice(1)));value=value.replace(/url\(\s*(['"]?)#([^)'"]+)\1\s*\)/g,(match,quote,id)=>ids.has(fragmentId(id))?'url("#'+ids.get(fragmentId(id))+'")':match);if(value!==attr.value)node.setAttributeNS(attr.namespaceURI,attr.name,value);}};
    for(const entry of copies.values()){
     const nodes=[entry.clone,...entry.clone.querySelectorAll('*')],localIds=new Map(globalIds);for(const node of nodes)if(node.id)localIds.set(node.id,node===entry.clone?entry.id:freshId());
     for(const node of nodes){if(node.id)node.id=localIds.get(node.id);node.removeAttribute('data-capture-node');rewrite(node,localIds);}
     const defs=document.createElementNS(svgNS,'defs');defs.append(entry.clone);(entry.target.ownerSVGElement||entry.target).append(defs);
    }
    for(const use of uses)rewrite(use,globalIds);
    const hidden=[];for(const el of document.querySelectorAll('[data-capture-node]'))if(!definition(el)&&!selected.some(node=>node===el||node.contains(el))){el.style.setProperty('visibility','hidden','important');hidden.push('[data-capture-node="'+el.getAttribute('data-capture-node')+'"]');}
    const style=document.createElement('style');style.textContent=hidden.map(selector=>selector+'::before,'+selector+'::after').join(',')+'{visibility:hidden!important}';document.head.append(style);
    for(const el of [document.documentElement,document.body])if(!selected.includes(el)&&!selected.some(node=>node.contains(el))){el.style.setProperty('background','transparent','important');}
    return {x:left,y:top,width:right-left,height:bottom-top};
};
