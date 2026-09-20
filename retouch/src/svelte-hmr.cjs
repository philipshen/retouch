'use strict';
function runtime(){return `import {writable} from 'svelte/store';
const states=new Map();
export function sourceState(file,initial){let state=states.get(file);if(!state){state=writable(initial);states.set(file,state);}else state.set(initial);return state;}
if(import.meta.hot)import.meta.hot.on('retouch:svelte-source',data=>{states.get(data.file)?.set({revision:data.revision,texts:data.texts});});
`;}
module.exports={runtime};
