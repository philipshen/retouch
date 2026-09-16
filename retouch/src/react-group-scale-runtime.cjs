'use strict';
const runtime=require('./group-scale-runtime.cjs');
function component(){return `'use client';
import {useLayoutEffect,useRef} from 'react';
const revision=${JSON.stringify(runtime.revision())};
function install(host){
 const document=host.document,key=Symbol.for('retouch.group-scale.runtime');
 if(document[key]?.revision===revision&&document[key].register)return document[key];
 document[key]?.dispose();
 const scope={document,MutationObserver:host.MutationObserver,ResizeObserver:host.ResizeObserver};
 for(const name of ['requestAnimationFrame','cancelAnimationFrame','addEventListener','removeEventListener','matchMedia'])scope[name]=host[name].bind(host);
 const modules=Object.create(null),require=name=>{if(!modules[name])throw Error('Missing scale runtime dependency: '+name);return modules[name];};
 ${runtime.moduleSource()}
 const registrations=new Map(),control=require('./bootstrap.js').mount({document,geometry:require('./group-move.js'),controller:require('./group-scale.js'),eligible:node=>registrations.has(node)});
 control.revision=revision;
 control.register=node=>{registrations.set(node,(registrations.get(node)||0)+1);control.refresh();let disposed=false;return ()=>{if(disposed)return;disposed=true;const count=registrations.get(node)||0;if(count<=1)registrations.delete(node);else registrations.set(node,count-1);control.refresh();};};
 document[key]=control;return control;
}
export default function RetouchScaleRuntime({warm=false}){
 const anchor=useRef(null);
 useLayoutEffect(()=>{const node=anchor.current,group=node?.parentElement;const release=group?.hasAttribute('data-rt-group')?install(group.ownerDocument.defaultView).register(group):null;node?.removeAttribute('data-rt-react-scale-pending');return ()=>{node?.setAttribute('data-rt-react-scale-pending','');release?.();};},[warm]);
 return warm?null:<script ref={anchor} type="application/json" data-rt-react-scale-anchor="" data-rt-react-scale-pending="" />;
}
`;}
module.exports={component};
