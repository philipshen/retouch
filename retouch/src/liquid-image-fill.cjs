'use strict';
const crypto=require('node:crypto'),MagicString=require('magic-string'),R=require('../shell/responsive.js'),I=require('../shell/inspector.js'),F=require('../shell/image-fill.js');
const refuse=reason=>({ok:false,refused:true,reason});
function plan(resolved,op){try{
 const liquid=require('./adapters/liquid.cjs'),node=resolved.element,scope=op.scope||'',action=op.action||'apply';
 if(!['apply','remove','reset'].includes(action))return refuse('Choose an image fill action.');
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the layer.');
 if(node.kind!=='host'||node.generatedImage||node.attributeExpressions||node.classAttr?.dynamic||(node.attributes||[]).filter(attr=>attr.name==='class').length>1)return refuse('Choose a literal Liquid layer for this image fill.');
 if(action==='apply'&&(typeof op.src!=='string'||!/^\/assets\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(op.src)))return refuse('Choose an uploaded theme asset.');
 const variable='--rt-image-fill-'+crypto.createHash('sha256').update(scope).digest('hex').slice(0,10),before=node.classAttr?.value||'';
 let local=R.project(before,scope);if(action==='apply'&&op.initialize)local=F.classes(local,F.framing('fill',1,1));
 if(action==='reset')local=F.classes(local,F.reset());else if(action==='remove')local=F.classes(local,{'background-image':'none'});else local=I.replace(local,token=>/^bg-(?:none|\[(?:image:)?(?:url|var)\(.*\)\])$/.test(token),'!bg-[image:var('+variable+')]');
 const classes=R.replaceScope(before,local,scope),result=liquid.planOp(resolved,{type:'setClasses',classes,fileHash:resolved.hash});if(!result.ok)return result;
 const source=result.edits[0]?.after||resolved.source,current=liquid.collect(source,resolved.relPath).elements.find(el=>el.id===node.id);if(!current)return refuse('The image layer no longer resolves.');
 const attrs=current.attributes.filter(attr=>attr.name==='style');if(attrs.length>1||attrs[0]?.valueStart<0)return refuse('Choose a layer with one quoted style attribute.');
 const attr=attrs[0],outer=attr?source[attr.valueStart-1]:'"';if(!['"',"'"].includes(outer))return refuse('Quote the style attribute before adding an image fill.');
 const quote=outer==='"'?"'":'"',declaration=action==='apply'?variable+':url({{ '+quote+op.src.slice(8)+quote+' | asset_url }});':'',ms=new MagicString(source);
 if(attr){let value=source.slice(attr.valueStart,attr.valueEnd);const existing=new RegExp(variable+':url\\(\\{\\{ [\'"][a-zA-Z0-9_.-]+[\'"] \\| asset_url \\}\\}\\);','g'),matches=value.match(existing)||[];
  if(value.includes(variable)&&matches.length!==1)return refuse('The image fill variable was changed outside Retouch.');
  value=matches.length?value.replace(existing,declaration):declaration?value+(value.trim().endsWith(';')?'':';')+declaration:value;ms.overwrite(attr.valueStart,attr.valueEnd,value);
 }else if(declaration)ms.appendLeft(current.nameEnd,' style="'+declaration+'"');
 const next=ms.toString();liquid.collect(next,resolved.relPath);return {ok:true,hash:liquid.contentHash(next),edits:[{file:resolved.file,before:resolved.source,after:next}]};
}catch(error){return refuse(error.message);}}
module.exports={plan};
