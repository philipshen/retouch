'use strict';
const fs=require('node:fs'),path=require('node:path'),MagicString=require('magic-string');
const identity=require('./id.cjs'),runtime=require('./react-group-scale-runtime.cjs'),bootstrap=require('../runtime/group-scale-bootstrap.js');
const attr=(e,name)=>e.node.openingElement.attributes.find(a=>a.name?.name===name),literal=(e,name)=>{const value=attr(e,name)?.value;if(!value)return null;if(value.type==='StringLiteral')return value.value;if(value.type==='JSXExpressionContainer'&&value.expression.type==='StringLiteral')return value.expression.value;throw Error('Resolve dynamic '+name+' before ungrouping.');};
function plan(resolved,op){try{
 if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the group.');
 const source=resolved.source,{ast,elements}=identity.collectElements(source,resolved.relPath),group=elements.find(e=>e.id===resolved.element.id),metadata=group&&literal(group,'data-rt-scale');
 if(!metadata||group.kind!=='host'||group.node.openingElement.name.name!=='div'||!attr(group,'data-rt-group')||!attr(group,'data-rt-frame')||!group.node.closingElement)throw Error('Choose a saved native scale group.');
 if(literal(group,'className')!=='contents'||group.node.openingElement.attributes.some(a=>a.type!=='JSXAttribute'||!['data-rt-frame','data-rt-group','aria-label','className','data-rt-scale'].includes(a.name.name)))throw Error('Resolve wrapper styling or behavior before ungrouping.');
 bootstrap.parse(metadata);
 const helper=path.join(path.dirname(resolved.file),'.retouch-group-scale.jsx'),generated=runtime.component(),before=fs.existsSync(helper)?fs.readFileSync(helper,'utf8'):null;if(before===null||!runtime.recognized(before))throw Error('Restore the generated React scale helper before ungrouping.');
 const anchors=require('./jsx-group-scale.cjs').anchors(ast,resolved),allRoots=elements.filter(e=>group.node.children.includes(e.node)),registrations=allRoots.filter(e=>anchors.has(e.node.start)),roots=allRoots.filter(e=>!anchors.has(e.node.start));
 if(registrations.length!==1||!roots.length||roots.some(e=>e.kind!=='host')||allRoots.at(-1)!==registrations[0]||group.node.children.some(n=>!['JSXElement','JSXText'].includes(n.type)||n.type==='JSXText'&&n.value.trim()))throw Error('Choose native sibling children with one trailing runtime registration.');
 const parent=elements.find(e=>e.node.children?.includes(group.node));if(!parent||parent.kind!=='host')throw Error('Choose a group with a native source parent.');
 require('./structure.cjs').ranges({...resolved,ast,elements,element:group},'react',{scaleChildren:true});require('./native-parent-proof.cjs').prove({...resolved,ast,elements},roots,parent,'react');
 const members=roots.map(e=>literal(e,'data-rt-scale-member'));bootstrap.members(JSON.stringify(members));
 const registration=registrations[0],payload={id:identity.contentHash(source+'|release|'+group.id).slice(0,10),metadata,members},replacement='<'+registration.node.openingElement.name.name+' released={'+JSON.stringify(payload)+'} />',out=new MagicString(source),openEnd=group.node.openingElement.end,closeStart=group.node.closingElement.start;
 out.remove(group.node.start,openEnd);out.remove(closeStart,group.node.end);out.overwrite(registration.node.start,registration.node.end,replacement);
 const after=out.toString(),final=identity.collectElements(after,resolved.relPath).elements,shift=at=>at-(at>=openEnd?openEnd-group.node.start:0)-(at>=group.node.end?group.node.end-closeStart:0)+(at>=registration.node.end?replacement.length-(registration.node.end-registration.node.start):0),mapping=new Map();
 for(const old of elements){if(old===group)continue;const next=final.find(e=>e.kind===old.kind&&e.node.start===shift(old.node.start));if(!next)throw Error('Ungrouping changed an unrelated source identity.');mapping.set(old.id,next.id);}
 if(final.length!==elements.length-1||new Set(mapping.values()).size!==final.length)throw Error('Ungrouping changed the source layer structure.');
 return {ok:true,hash:identity.contentHash(after),structural:true,parentId:mapping.get(parent.id),rootCount:roots.length,selectionIds:roots.map(e=>mapping.get(e.id)),sourceIdMap:[...mapping].filter(([before,after])=>before!==after),removedSourceIds:[group.id],edits:[...(before===generated?[]:[{file:helper,before,after:generated}]),{file:resolved.file,before:source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}}
module.exports={plan,applies:resolved=>!!attr(resolved.element,'data-rt-scale')};
