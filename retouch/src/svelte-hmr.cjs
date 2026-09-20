'use strict';
function runtime(){return `import {writable} from 'svelte/store';
const states=new Map(),styles=new Map();
function applyCSS(file,css){
 if(!css){styles.get(file)?.remove();styles.delete(file);return;}
 if(typeof document==='undefined')return;
 let element=document.querySelector('style[data-rt-svelte-css="'+css.id+'"]');
 if(!element){element=document.createElement('style');element.setAttribute('data-rt-svelte-css',css.id);document.head.append(element);}
 styles.set(file,element);
 if(element.textContent!==css.text)element.textContent=css.text;
}
export function sourceState(file,initial){applyCSS(file,initial.css);let state=states.get(file);if(!state){state=writable(initial);states.set(file,state);}else state.set(initial);return state;}
if(import.meta.hot)import.meta.hot.on('retouch:svelte-source',data=>{applyCSS(data.file,data.css);states.get(data.file)?.set({revision:data.revision,texts:data.texts,styleIds:data.styleIds,css:data.css});});
`;}
module.exports={runtime};
