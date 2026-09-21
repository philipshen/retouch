'use strict';
// Source creation stays internal until browser style and instance fidelity are
// proved. Existing retained groups support guarded alignment and restoration.
// Callers of the internal creator supply resolved paint in local coordinates.
const crypto=require('node:crypto'),G=require('../shell/svg-path.js'),A=require('../shell/svg-affine.js'),S=require('../shell/svg-stroke-alignment.js');
const view=require('./svg-boolean-group.cjs').view;
const marker='data-rt-stroke-alignment',originalMarker='data-rt-stroke-original';
const paintNames=['fill','stroke','fill-rule','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','fill-opacity','stroke-opacity'];
const jsxNames=Object.fromEntries([...paintNames,'clip-rule','clip-path'].map(name=>[name,name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]));
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function input(model){return {...model,document:G.parseCompound(model.path)};}
function shape(r,kind,v=view(r,kind)){
 r={...r,elements:v.elements};
 const e=r.element,tag=v.tag(e),geometry=kind==='react'?require('./jsx-svg-geometry.cjs').describe(r):kind==='liquid'?require('./liquid-svg-geometry.cjs').describe(r):require('./svg-geometry.cjs').describe(e);
 if(!geometry||geometry.fields.some(f=>f.editable===false))throw Error('Choose literal SVG geometry.');
 const allowed=new Set([...geometry.fields.map(f=>f.name),...paintNames,...Object.values(jsxNames),'transform','data-rt-name','data-rt-shape']);
 const attrs=v.attrs(e);if(attrs.some(a=>!allowed.has(a.name)||typeof a.value!=='string'||/\{[%{]/.test(a.value))||new Set(attrs.map(a=>a.name)).size!==attrs.length)throw Error('Resolve dynamic, referenced or styled shape attributes before retaining a stroke.');
 // Some HTML parsers discard duplicate attributes. Require every authored
 // opening token to be accounted for before accepting the literal snapshot.
 let cursor=v.start(e),unaccounted='';
 for(const a of [...attrs].sort((a,b)=>a.start-b.start)){
  if(!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<cursor)throw Error('The original attributes could not be verified.');
  unaccounted+=r.source.slice(cursor,a.start);cursor=a.end;
 }
 unaccounted+=r.source.slice(cursor,v.opening(e));
 if(!new RegExp('^<'+tag+'\\s*/?>$').test(unaccounted))throw Error('The original opening tag contains unaccounted attributes.');
 if(!Number.isInteger(v.end(e))||v.end(e)<=v.opening(e)-1)throw Error('Choose a complete SVG shape.');
 const close=v.closing(e);if(Number.isInteger(close)&&r.source.slice(v.opening(e),close).trim())throw Error('Preserve shape metadata and animation before retaining a stroke.');
 if(!Number.isInteger(close)&&!r.source.slice(v.start(e),v.opening(e)).endsWith('/>'))throw Error('Choose an explicitly closed SVG shape.');
 const parentId=v.parents.get(e.id);if(!parentId)throw Error('Choose a shape inside an SVG parent.');
 const cap=kind==='react'?require('./jsx-svg-delete.cjs').describe(r):kind==='html'?require('./svg-delete.cjs').describe(r):require('./structure.cjs').describe(r,'liquid');
 if(!cap?.canDelete)throw Error('Choose an SVG shape outside a rendered template.');
 const fields=Object.fromEntries(geometry.fields.map(f=>[f.name,f.value]));let path;
 if(tag==='path')path=fields.d;
 else if(['polygon','polyline'].includes(tag)){
  const points=require('../shell/svg-points.js').parse(fields.points);if(points)path=points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')+(tag==='polygon'?' Z':'');
 }else path=require('./svg-convert.cjs').pathFor(tag,geometry.fields);
 const document=G.parseCompound(path);if(!document)throw Error('The original shape geometry could not be retained.');
 const matrix=A.parse(v.attr(e,'transform'));if(!matrix)throw Error('Resolve the original shape transform.');
 return {path:G.serializeCompound(document),matrix,parentId};
}
function markup(original,model,id,kind){
 const normalized=S.normalize(input(model));
 let rendered=S.render(input(normalized),id);
 if(kind==='react')rendered=rendered.replace(/ ([a-z]+(?:-[a-z]+)+)=/g,(token,name)=>jsxNames[name]?' '+jsxNames[name]+'=':token);
 const encoded=Buffer.from(JSON.stringify(normalized)).toString('base64url');
 const prefix='<g '+marker+'="1" data-rt-stroke-id="'+escape(id)+'" data-rt-stroke-model="'+encoded+'"><g display="none" '+originalMarker+'="">';
 return {text:prefix+original+'</g>'+rendered+'</g>',originalOffset:prefix.length,model:normalized};
}
function context(r,kind){
 try{
  const v=view(r,kind),group=r.element;if(v.tag(group)!=='g'||v.attr(group,marker)!=='1')return null;
  const originalGroup=v.elements.find(e=>v.parents.get(e.id)===group.id&&v.attr(e,originalMarker)==='');
  if(!originalGroup)return null;
  const roots=v.elements.filter(e=>v.parents.get(e.id)===originalGroup.id);if(roots.length!==1)return null;
  const original=roots[0],source=r.source.slice(v.start(original),v.end(original)),encoded=v.attr(group,'data-rt-stroke-model');
  if(typeof encoded!=='string'||encoded.length>200000||!/^[A-Za-z0-9_-]+$/.test(encoded))return null;
  const model=JSON.parse(Buffer.from(encoded,'base64url').toString()),id=v.attr(group,'data-rt-stroke-id');
  const canonical=markup(source,model,id,kind),geometry=shape({...r,element:original},kind,v);
  if(geometry.path!==canonical.model.path||JSON.stringify(geometry.matrix)!==JSON.stringify(canonical.model.matrix))return null;
  if(r.source.slice(v.start(group),v.end(group))!==canonical.text)return null;
  // The identity is reserved even for center strokes, which have no definition.
  const outside=r.source.slice(0,v.start(group))+r.source.slice(v.end(group));if(outside.includes(id))return null;
  return {v,group,original,source,id,model:canonical.model,originalOffset:canonical.originalOffset};
 }catch{return null;}
}
function plan(r,op,kind){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(!['html','react','liquid'].includes(kind))return refuse('Choose a supported source adapter.');
 if(op.fileHash!==r.hash)return refuse('The file changed. Re-select the shape.');
 try{
  const v=view(r,kind);let start=v.start(r.element),end=v.end(r.element),original,oldOriginal,model,id,replacement,originalOffset,created=false;
  if(op.type==='createSVGStrokeSource'){
   const geometry=shape(r,kind,v);model=S.normalize(op.model);
   if(model.path!==geometry.path||JSON.stringify(model.matrix)!==JSON.stringify(geometry.matrix))throw Error('The stroke snapshot does not match the original geometry and transform.');
   for(let parent=v.parents.get(r.element.id);parent;parent=v.parents.get(parent)){const e=v.elements.find(e=>e.id===parent);if(v.attr(e,marker)!==undefined||v.attr(e,'data-rt-boolean')!==undefined)throw Error('Edit the owning retained group first.');}
   original=r.source.slice(start,end);oldOriginal=r.element;created=true;
   do{id='rt-stroke-'+crypto.randomBytes(8).toString('hex');}while(r.source.includes(id));
  }else{
   const c=context(r,kind);if(!c)throw Error('Select an unchanged retained stroke group.');
   ({source:original,original:oldOriginal,model,id}=c);
   if(op.type==='restoreSVGStrokeSource'){replacement=original;originalOffset=0;}
   else if(op.type==='setSVGStrokeSourcePosition'){
    if(!['inside','center','outside'].includes(op.position))throw Error('Choose Inside, Center or Outside.');
    model=S.normalize({...input(model),position:op.position});
   }
   else if(op.type==='setSVGStrokeSourceWidth'){
    if(!Number.isFinite(op.width)||op.width<0||op.width>10000)throw Error('Choose a stroke width between 0 and 10,000 source units.');
    model=S.normalize({...input(model),width:op.width});
   }
   else if(op.type==='setSVGStrokeSourceStyle'){
    if(!['linecap','linejoin','miterlimit','dasharray','dashoffset'].includes(op.property)||op.value===null||op.value===undefined)throw Error('Choose a supported stroke setting and value.');
    model=S.normalize({...input(model),[op.property]:op.value});
   }
   else throw Error('Choose a supported retained stroke edit.');
  }
  if(replacement===undefined){const rendered=markup(original,model,id,kind);replacement=rendered.text;originalOffset=rendered.originalOffset;}
  const after=r.source.slice(0,start)+replacement+r.source.slice(end);
  if(after===r.source)return {ok:true,unchanged:true,hash:r.hash,edits:[]};
  const next=view({...r,source:after,elements:null},kind),mapping=new Map(),removed=[];
  const oldStart=v.start(oldOriginal),oldEnd=v.end(oldOriginal),freshOriginal=next.elements.find(e=>next.start(e)===start+originalOffset&&next.tag(e)===v.tag(oldOriginal));
  if(!freshOriginal)throw Error('The original shape could not be preserved.');
  for(const e of v.elements){
   const offset=v.start(e),inside=offset>=start&&offset<end,isOriginal=offset>=oldStart&&offset<oldEnd;
   if(inside&&!isOriginal){removed.push(e.id);continue;}
   const expected=isOriginal?start+originalOffset+offset-oldStart:offset>=end?offset+replacement.length-(end-start):offset;
   const fresh=next.elements.find(n=>next.start(n)===expected&&next.tag(n)===v.tag(e));if(!fresh)throw Error('An existing source layer could not be preserved.');mapping.set(e.id,fresh.id);
  }
  const group=op.type==='restoreSVGStrokeSource'?null:next.elements.find(e=>next.start(e)===start&&next.attr(e,marker)==='1');
  if(op.type!=='restoreSVGStrokeSource'&&(!group||!context({...r,source:after,elements:next.elements,element:group},kind)))throw Error('The retained stroke source did not round-trip.');
  for(const e of v.elements){
   if(!mapping.has(e.id)||e.id===oldOriginal.id)continue;
   const expected=mapping.get(v.parents.get(e.id));if((next.parents.get(mapping.get(e.id))??null)!==(expected??null))throw Error('An unrelated source layer would move.');
  }
  const parentId=mapping.get(v.parents.get(r.element.id));
  const selected=group||freshOriginal;
  if((next.parents.get(selected.id)??null)!==(parentId??null))throw Error('The retained stroke would move to another parent.');
  if(group&&!created){mapping.set(r.element.id,group.id);removed.splice(removed.indexOf(r.element.id),1);}
  return {ok:true,structural:true,hash:v.adapter.contentHash(after),parentId,selectionIds:[selected.id],sourceIdMap:[...mapping].filter(([a,b])=>a!==b),removedSourceIds:removed,edits:[{file:r.file,before:r.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan,context};

// Creation remains internal until the browser can prove style/instance fidelity.
// Existing retained groups can change alignment/weight or restore original source.
const types=new Set(['setSVGStrokeSourcePosition','setSVGStrokeSourceWidth','setSVGStrokeSourceStyle','restoreSVGStrokeSource']);
const deletionTypes=new Set(['deleteElement','deleteSelection','deleteComponent','deleteComponentSelection']);
function referencedIds(op){
 const ids=new Set();
 for(const [key,value]of Object.entries(op||{}))if(/^(?:id|ids|.*Id|.*Ids)$/.test(key))for(const item of Array.isArray(value)?value:[value])if(typeof item==='string'&&/^[a-f0-9]{10}$/.test(item))ids.add(item);
 return [...ids];
}
function marked(v){return v.elements.filter(e=>v.attrs(e).some(a=>a.name===marker));}
function owner(r,kind){
 if(!r.source?.includes(marker))return null;
 const v=view(r,kind);for(let id=r.element.id;id;id=v.parents.get(id)){const e=v.elements.find(e=>e.id===id);if(e&&v.attrs(e).some(a=>a.name===marker))return id;}return null;
}
function describe(r,kind){
 if(!r.source?.includes(marker))return null;
 const c=context(r,kind);if(!c)return null;
 const positions=['inside','center','outside'].filter(position=>{try{S.normalize({...input(c.model),position});return true;}catch{return false;}});
 return {position:c.model.position,width:c.model.width,positions,originalId:c.original.id,canRestore:true,definitionId:c.id,model:c.model};
}
function guard(r,op,kind){
 if(!r.source?.includes(marker))return null;
 const v=view(r,kind),groups=marked(v),selected=new Set([r.element.id,...referencedIds(op)]),targets=v.elements.filter(e=>selected.has(e.id));
 const contains=(a,b)=>v.start(a)<=v.start(b)&&v.end(a)>=v.end(b);
 const refuse=()=>({ok:false,refused:true,reason:'Restore the original shape before editing the contents of this retained stroke.'});
 for(const group of groups)for(const target of targets){
  if(contains(group,target)){
   if(types.has(op.type)&&target.id===group.id&&target.id===r.element.id)continue;
   if(deletionTypes.has(op.type)&&targets.some(e=>contains(e,group)))continue;
   return refuse();
  }
  if(contains(target,group)&&!deletionTypes.has(op.type)&&!['renameElement','setSVGTransform','setSVGTransforms'].includes(op.type))return refuse();
 }
 return null;
}
function validatePlan(r,op,kind,planned){
 if(!planned?.ok||!Array.isArray(planned.edits))return planned;
 const refuse=()=>({ok:false,refused:true,reason:'This edit would alter retained stroke source. Restore the original shape before editing or duplicating its generated structure.'});
 // Source operations are deterministic; only their exact single-file plan may
 // replace the canonical group. Never trust a caller-supplied bypass flag.
 if(types.has(op.type)){
  const expected=plan(r,op,kind);return expected.ok&&JSON.stringify(expected.edits)===JSON.stringify(planned.edits)?planned:refuse();
 }
 try{
  for(const edit of planned.edits){
   if(![edit.before,edit.after].some(source=>typeof source==='string'&&source.includes(marker)))continue;
   if(!require('./adapters/'+kind+'.cjs').matches(edit.file))continue;
   const relPath=require('node:path').relative(r.appRoot||require('node:path').dirname(r.file),edit.file);
   const state=source=>{const resolved={...r,file:edit.file,relPath,source:source||'',elements:null},v=view(resolved,kind);return {resolved,v,groups:marked(v)};};
   const before=state(edit.before),after=state(edit.after),unmatched=[...after.groups];
   const selected=new Set([r.element.id,...(Array.isArray(op.ids)?op.ids:[])]),originalView=edit.file===r.file?view(r,kind):null;
   for(const group of before.groups){
    const text=edit.before.slice(before.v.start(group),before.v.end(group));
    const index=unmatched.findIndex(e=>edit.after.slice(after.v.start(e),after.v.end(e))===text);
    if(index>=0){
     const fresh=unmatched.splice(index,1)[0];
     // A new definition reference outside the group can invalidate otherwise
     // unchanged markup. Previously damaged groups may remain untouched.
     if(context({...before.resolved,element:group},kind)&&!context({...after.resolved,element:fresh},kind))return refuse();
    }else{
     const removable=deletionTypes.has(op.type)&&originalView&&originalView.elements.some(e=>selected.has(e.id)&&originalView.start(e)<=before.v.start(group)&&originalView.end(e)>=before.v.end(group));
     if(!removable)return refuse();
    }
   }
   if(unmatched.length)return refuse();
  }
  return planned;
 }catch{return refuse();}
}
Object.assign(module.exports,{types,referencedIds,owner,describe,guard,validatePlan});

function decorateDescription(info){
 if(!info.svgStrokeOwner)return info;
 const structure={...info.structure,canCopy:false,canDuplicate:false,canReparent:false,canFrame:false,canRemoveFrame:false,canMoveBefore:false,canMoveAfter:false,canMoveFirst:false,canMoveLast:false};
 if(info.svgStrokeOwner!==info.id)structure.canDelete=false;
 return {...info,structure,canRename:false,canCreateComponent:false,svgGeometry:null,svgConversion:null,svgDuplication:null,svgMovement:null,svgInsertion:null,svgBooleanReplacement:null,svgMask:null,
  svgTransform:info.svgTransform?{...info.svgTransform,editable:false,reason:'Restore the original shape before changing its geometry.'}:null};
}
module.exports.decorateDescription=decorateDescription;
