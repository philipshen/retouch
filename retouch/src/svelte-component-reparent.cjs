'use strict';
const source=require('./svelte-source.cjs'),compiler=require('svelte/compiler'),MagicString=require('magic-string'),insertion=require('./svelte-insert.cjs');
function context(r){
 const parsed=source.collect(r.source,r.relPath),elements=[...parsed.elements,...parsed.components].sort((a,b)=>a.start-b.start),parents=new Map();
 function visit(node){if(!node||typeof node!=='object')return;for(const [key,value]of Object.entries(node)){if(['attributes','expression','metadata','loc'].includes(key))continue;for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object'){parents.set(child,node);visit(child);}}}visit(parsed.ast.fragment);
 const element=elements.find(e=>e.id===r.element.id);if(element?.kind!=='instance')throw Error('Select a Svelte component usage.');
 function scope(node){const chain=[];for(;node;node=parents.get(node)){if(node.type==='Fragment'&&(parents.get(node)&&parents.get(node).type!=='RegularElement'||node.nodes.some(n=>['ConstTag','SnippetBlock','DeclarationTag'].includes(n.type))))chain.push(node);if(node.attributes?.some(a=>a.type==='LetDirective')||node.type==='RegularElement'&&['svg','math','foreignObject','annotation-xml'].includes(node.name))chain.push(node);}return chain;}
 const chain=scope(parents.get(element.node)),parent=elements.find(e=>e.node===parents.get(parents.get(element.node)));
 function destination(target,position='inside'){
  if(!target||target.start>=element.start&&target.end<=element.end)throw Error('Choose a layer outside the selected component.');
  const container=position==='inside'?target:elements.find(e=>e.node===parents.get(parents.get(target.node)));
  if(container?.kind!=='host'||!insertion.describe({...r,element:container}).canInsert)throw Error('Choose a native container that accepts child layers.');
  const next=scope(container.node.fragment);if(chain.length!==next.length||chain.some((n,i)=>n!==next[i]))throw Error('Moving here would change the Svelte scope or runtime branch.');
  return container;
 }
 return {elements,parents,element,parent,destination};
}
function describe(r){try{const ctx=context(r),containers=[],selectionContainers=[],crossTargets=[];for(const e of ctx.elements){try{ctx.destination(e);selectionContainers.push(e.id);if(e.id!==ctx.parent?.id)containers.push(e.id);}catch{}try{const parent=ctx.destination(e,'before');if(parent.id!==ctx.parent?.id)crossTargets.push(e.id);}catch{}}return {containers,selectionContainers,crossTargets,canReparent:containers.length>0};}catch(error){return {containers:[],selectionContainers:[],crossTargets:[],canReparent:false,reparentReason:error.message};}}
function plan(r,op,adapter){try{
 if(op.fileHash!==r.hash)throw Error('The source changed. Re-select the components.');
 const position=op.direction||'inside';if(!['inside','before','after'].includes(position))throw Error('Choose inside, before or after a destination.');
 const selection=['moveComponentSelection','reparentComponentSelection'].includes(op.type),ids=selection?op.ids:[r.element.id];if(!Array.isArray(ids)||ids.length<(selection?2:1)||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(r.element.id))throw Error('Choose distinct component usages from one source file.');
 const ctx=context(r),original=ctx.elements,members=ids.map(id=>original.find(e=>e.id===id));if(members.some(e=>e?.kind!=='instance'))throw Error('Choose component usages from the same source file.');
 const roots=members.filter(e=>!members.some(p=>p!==e&&p.start<e.start&&p.end>=e.end)).sort((a,b)=>a.start-b.start),target=original.find(e=>e.id===op.destinationId);let container;
 for(const element of roots){const c=context({...r,element});container=c.destination(c.elements.find(e=>e.id===op.destinationId),position);}
 // All contexts are separately parsed; compare source identities, not AST objects.
 const parent=original.find(e=>e.id===container.id),siblings=parent.node.fragment.nodes.filter(n=>n.type!=='Comment'&&!(n.type==='Text'&&!n.data.trim()));
 if(position==='inside'&&roots.every((e,i)=>siblings[siblings.length-roots.length+i]?.start===e.start))return {ok:true,unchanged:true,hash:r.hash,selectionIds:roots.map(e=>e.id),edits:[]};
 const raw=r.source.slice(parent.start,parent.end),newline=r.source.includes('\r\n')?'\r\n':'\n',prefix=newline+'  ',positions=new Map();let offset,end,inserted='';
 if(position==='inside'){if(raw.endsWith('/>')){offset=parent.end-2;end=parent.end;inserted='>';}else{const close=raw.lastIndexOf('</'+parent.tag);if(close<0)throw Error('The container closing tag could not be found.');offset=parent.start+close;end=offset;}}
 else{offset=position==='before'?target.start:target.end;end=offset;}
 for(const root of roots){inserted+=prefix;positions.set(root.id,inserted.length);inserted+=r.source.slice(root.start,root.end);}inserted+=newline;if(end>offset)inserted+='</'+parent.tag+'>';
 const out=new MagicString(r.source),removedBefore=start=>roots.filter(e=>e.end<=start).reduce((sum,e)=>sum+e.end-e.start,0);
 for(const root of roots)out.remove(root.start,root.end);if(end>offset)out.overwrite(offset,end,inserted);else out.appendLeft(offset,inserted);
 const after=out.toString();compiler.compile(after,{filename:r.relPath,generate:false});const next=adapter.collect(after,r.relPath).elements,mapping=new Map(),used=new Set();
 for(const old of original){const root=roots.find(e=>old.start>=e.start&&old.end<=e.end),start=root?offset-removedBefore(offset)+positions.get(root.id)+old.start-root.start:old.start-removedBefore(old.start)+(old.start>=end?inserted.length-(end-offset):0),n=next.find(e=>e.start===start&&e.kind===old.kind&&e.tag===old.tag);if(!n||used.has(n.id))throw Error('A moved source layer lost its identity.');mapping.set(old.id,n.id);used.add(n.id);}
 if(used.size!==next.length)throw Error('Moving changed the number of source layers.');const nextParent=next.find(e=>e.id===mapping.get(parent.id));for(const root of roots){const n=next.find(e=>e.id===mapping.get(root.id));if(!nextParent.node.fragment.nodes.includes(n.node)||after.slice(n.start,n.end)!==r.source.slice(root.start,root.end))throw Error('Moving changed the component contents or destination.');}
 const sourceIdMap=[...mapping].filter(([a,b])=>a!==b);return {ok:true,hash:source.contentHash(after),...(selection?{movedComponentIds:roots.map(e=>e.id),selectionIds:roots.map(e=>mapping.get(e.id)),sourceIdMap,destinationId:mapping.get(parent.id),rootCount:roots.length}:{movedComponent:{instanceId:mapping.get(r.element.id),previousInstanceId:r.element.id,sourceIdMap}}),edits:[{file:r.file,before:r.source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={describe,plan};
