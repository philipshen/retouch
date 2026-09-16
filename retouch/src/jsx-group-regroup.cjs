'use strict';
const fs=require('node:fs'),path=require('node:path'),MagicString=require('magic-string'),identity=require('./id.cjs'),runtime=require('./react-group-scale-runtime.cjs'),bootstrap=require('../runtime/group-scale-bootstrap.js');
function member(e){const a=e.node.openingElement.attributes.find(a=>a.name?.name==='data-rt-scale-member');if(!a)return null;const value=a.value;if(value?.type==='StringLiteral')return value.value;if(value?.type==='JSXExpressionContainer'&&value.expression.type==='StringLiteral')return value.expression.value;throw Error('Resolve dynamic member identities before regrouping.');}
function records(resolved){
 const {ast,elements}=identity.collectElements(resolved.source,resolved.relPath),found=[];
 require('@babel/traverse').default(ast,{JSXElement(p){const opening=p.node.openingElement,name=opening.name;if(name.type!=='JSXIdentifier')return;const binding=p.scope.getBinding(name.name);if(binding?.path.node.type!=='ImportDefaultSpecifier'||binding.path.parent.source?.value!=='./.retouch-group-scale.jsx')return;const released=opening.attributes.find(a=>a.name?.name==='released');if(!released)return;
  if(!opening.selfClosing||opening.attributes.length!==1||released.value?.type!=='JSXExpressionContainer')throw Error('Resolve the released React ownership record.');
  const value=released.value.expression,data=JSON.parse(resolved.source.slice(value.start,value.end));if(!data||Object.keys(data).sort().join(',')!=='id,members,metadata'||typeof data.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(data.id)||typeof data.metadata!=='string')throw Error('Invalid released React ownership record.');bootstrap.parse(data.metadata);bootstrap.members(JSON.stringify(data.members));found.push({element:elements.find(e=>e.node===p.node),data,binding:name.name});
 }});return {elements,found};
}
function claim(resolved,ids){
 const {elements,found}=records(resolved),selected=elements.find(e=>e.id===resolved.element.id),id=member(selected),matches=found.filter(r=>r.data.members.includes(id));if(matches.length!==1)throw Error('Select one complete released React group.');const record=matches[0],parent=elements.find(e=>e.node.children?.includes(record.element.node));if(!parent||parent.kind!=='host')throw Error('Keep released members in their native parent.');
 const roots=elements.filter(e=>e.kind==='host'&&parent.node.children.includes(e.node)&&record.data.members.includes(member(e))).sort((a,b)=>a.node.start-b.node.start),members=roots.map(member);if(members.length!==record.data.members.length||members.some((id,i)=>id!==record.data.members[i]))throw Error('Keep the complete released group in its saved order.');
 if(ids&&(!Array.isArray(ids)||new Set(ids).size!==roots.length||ids.length!==roots.length||roots.some(e=>!ids.includes(e.id))))throw Error('Select every direct member of the released group.');
 if(members.some(id=>elements.filter(e=>member(e)===id).length!==1))throw Error('Released members need distinct source identities.');
 for(let i=1;i<roots.length;i++)if(resolved.source.slice(roots[i-1].node.end,roots[i].node.start).trim())throw Error('Keep released group members adjacent.');
 if(record.element.node.start<roots.at(-1).node.end||resolved.source.slice(roots.at(-1).node.end,record.element.node.start).trim())throw Error('Keep the ownership record beside its released members.');
 const helper=path.join(path.dirname(resolved.file),'.retouch-group-scale.jsx');if(!fs.existsSync(helper)||fs.readFileSync(helper,'utf8')!==runtime.component())throw Error('Restore the current React scale helper before regrouping.');
 return {elements,record,parent,roots};
}
function plan(resolved,op){try{
 if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the released layers.');
 const {elements,record,parent,roots}=claim(resolved,op.ids),source=resolved.source,start=roots[0].node.start,anchor=record.element.node,opening='<div data-rt-frame="" data-rt-group="" aria-label="Group" className="contents" data-rt-scale={'+JSON.stringify(record.data.metadata)+'}>',replacement='<'+record.binding+' /></div>',out=new MagicString(source);
 out.appendLeft(start,opening);out.overwrite(anchor.start,anchor.end,replacement);const after=out.toString(),final=identity.collectElements(after,resolved.relPath).elements,shift=at=>at+(at>=start?opening.length:0)+(at>=anchor.end?replacement.length-(anchor.end-anchor.start):0),mapping=new Map();
 for(const old of elements){const next=final.find(e=>e.kind===old.kind&&e.node.start===shift(old.node.start));if(!next)throw Error('Regrouping changed an unrelated source identity.');mapping.set(old.id,next.id);}
 const group=final.find(e=>e.kind==='host'&&e.node.start===start);if(!group||final.length!==elements.length+1||new Set(mapping.values()).size!==elements.length)throw Error('Regrouping changed the source layer structure.');
 require('./native-parent-proof.cjs').prove({...resolved,source:after,elements:final},[group],final.find(e=>e.id===mapping.get(parent.id)),'react');
 return {ok:true,hash:identity.contentHash(after),structural:true,parentId:mapping.get(parent.id),rootCount:roots.length,selectionIds:[group.id],sourceIdMap:[...mapping].filter(([before,after])=>before!==after),removedSourceIds:[],edits:[{file:resolved.file,before:source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
function applies(resolved){try{const id=member(resolved.element);return !!id&&records(resolved).found.some(r=>r.data.members.includes(id));}catch{return !!resolved.element.node.openingElement.attributes.some(a=>a.name?.name==='data-rt-scale-member');}}
function describe(resolved){try{const {parent}=claim(resolved);return {canFrame:true,parentId:parent.id};}catch{return {};}}
module.exports={plan,applies,describe,claim,member};
