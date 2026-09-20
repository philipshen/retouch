'use strict';
const path=require('node:path'),crypto=require('node:crypto'),MagicString=require('magic-string'),compiler=require('svelte/compiler');
const textTags=new Set(['h1','h2','h3','h4','h5','h6','p','span','div','blockquote','label','a','li','button']);
function textRange(element,text){
 if(element.scope.svg||!textTags.has(element.tag)||element.node.attributes.some(a=>a.type==='BindDirective'&&['innerHTML','textContent','innerText'].includes(a.name)))return null;
 const nodes=element.node.fragment.nodes;if(!nodes.every(n=>n.type==='Text'))return null;
 const close=element.end-('</'+element.tag+'>').length;if(text.slice(close,element.end)!=='</'+element.tag+'>')return null;
 return {start:nodes[0]?.start??close,end:close,text:nodes.map(n=>n.data).join('')};
}
const contentHash=source=>crypto.createHash('sha1').update(source).digest('hex');
const literal=attribute=>attribute.type==='Attribute'&&(attribute.value===true||Array.isArray(attribute.value)&&attribute.value.every(node=>node.type==='Text'));
function collect(source,relPath){
 const ast=compiler.parse(source,{filename:relPath,modern:true}),elements=[],components=[],excluded=[];
 function walk(fragment,route,scope){
  let index=0;
  for(const node of fragment?.nodes||[]){
   if(['Text','Comment','ExpressionTag','HtmlTag','ConstTag','DeclarationTag','DebugTag','RenderTag'].includes(node.type))continue;
   const here=route+'/'+index++;if(['SvelteHead','SvelteWindow','SvelteDocument','SvelteBody'].includes(node.type)||['script','style'].includes(node.name))continue;
   const next={...scope,repeated:scope.repeated||node.type==='EachBlock',conditional:scope.conditional||['IfBlock','AwaitBlock','KeyBlock','SvelteBoundary'].includes(node.type),slotted:scope.slotted||['Component','SvelteComponent','SnippetBlock'].includes(node.type),svg:node.name==='svg'||scope.svg&&node.name!=='foreignObject',picture:scope.picture||node.name==='picture'};
   if(node.type==='Component')components.push({id:contentHash(relPath+'|svelte-component|'+here).slice(0,10),kind:'instance',tag:node.name,node,start:node.start,end:node.end,scope:next});
   if(node.type==='RegularElement'){
    const reserved=['data-rt','data-rt-revision'],collision=reserved.some(name=>node.attributes.filter(a=>a.name?.toLowerCase()===name).length>1)||node.attributes.some(a=>a.type==='SpreadAttribute'||reserved.includes(a.name?.toLowerCase())&&!literal(a));
    if(collision)excluded.push({tag:node.name,start:node.start,reason:'A spread or binding can replace the source marker.'});
    else elements.push({id:contentHash(relPath+'|svelte|'+here).slice(0,10),kind:'host',tag:node.name,node,start:node.start,end:node.end,scope:next,attributes:node.attributes.filter(literal).map(a=>({name:a.name.toLowerCase(),start:a.start,end:a.end,value:a.value===true?'':a.value.map(part=>part.data).join('')}))});
   }
   for(const key of ['fragment','body','consequent','alternate','pending','then','catch','fallback'])if(node[key]?.type==='Fragment')walk(node[key],here+'/'+key,next);
  }
 }
 walk(ast.fragment,'',{repeated:false,conditional:false,slotted:false,svg:ast.options?.namespace==='svg',picture:false});
 return {elements,components,excluded,ast};
}
function textSnapshot(source,relPath){
 const parsed=collect(source,relPath),{elements,components,ast}=parsed,out=new MagicString(source),texts={},componentProps={};
 for(const element of components){const info=require('./svelte-component-props.cjs').describe({source,relPath,element},parsed);for(const prop of info.props.filter(prop=>prop.editable)){const attr=element.node.attributes.find(attr=>attr.name===prop.name);componentProps[element.id+'|'+prop.name]=Object.is(prop.value,-0)?'-0':JSON.stringify(prop.value);out.overwrite(attr.start,attr.end,prop.name+'={__RT_PROP__}');}}
 for(const element of elements){const range=textRange(element,source);if(!range||range.text.trim()!==range.text||/[\r\n\t]| {2}/.test(range.text))continue;texts[element.id]=range.text;if(range.start===range.end)out.appendLeft(range.start,'__RT_TEXT__');else out.overwrite(range.start,range.end,'__RT_TEXT__');}
 let styling = null;
 try {
  const css = require('./svelte-css.cjs'); styling = css.runtimeSnapshot(source,relPath); css.removeManaged(out,styling.state);
  for(const element of elements)if(Object.hasOwn(styling.ids,element.id)){
   const marker=element.attributes.find(a=>a.name==='data-rt-style');
   if(marker&&source.slice(marker.start-1,marker.end)===' data-rt-style="'+marker.value+'"')out.remove(marker.start-1,marker.end);
   for(const name of styling.attributeHosts[element.id]||[]){const attribute=element.attributes.find(a=>a.name===name);if(attribute)out.remove(require('./svelte-linked-styles.cjs').attributeRemovalStart(source,attribute.start),attribute.end);}
  }
 }catch{/* Unsupported authored CSS still uses ordinary Svelte compilation. */}
 return {elements,components,ast,texts,componentProps,styling,signature:out.toString(),revision:contentHash(source)};
}
function stamp(source,file,root,{runtime=false}={}){
 const relative=root?path.relative(root,file).split(path.sep).join('/'):file,snapshot=textSnapshot(source,relative),{elements,ast}=snapshot;if(!elements.length&&!snapshot.components.length)return null;
 const out=new MagicString(source),revision=contentHash(source);let binding='__retouch_source_'+contentHash(relative).slice(0,10);while(source.includes(binding))binding+='_';
 for(const element of elements)for(const [name,value]of [['data-rt',element.id],['data-rt-revision',revision]]){const old=element.attributes.find(a=>a.name===name),token=name==='data-rt-revision'&&runtime?name+'={$'+binding+'.revision}':name+'="'+value+'"';if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(element.start+1+element.tag.length,' '+token);}
 if(runtime){
  for(const element of snapshot.components)for(const attribute of element.node.attributes){const key=element.id+'|'+attribute.name;if(Object.hasOwn(snapshot.componentProps,key))out.overwrite(attribute.start,attribute.end,attribute.name+'={'+binding+'_prop($'+binding+'.componentProps['+JSON.stringify(key)+'])}');}
  if(snapshot.styling){
   require('./svelte-css.cjs').removeManaged(out,snapshot.styling.state);
   for(const element of elements)if(Object.hasOwn(snapshot.styling.ids,element.id)){
    const old=element.attributes.find(a=>a.name==='data-rt-style'),token='data-rt-style={$'+binding+'.styleIds['+JSON.stringify(element.id)+']}';
    if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(element.start+1+element.tag.length,' '+token);
    for(const name of snapshot.styling.attributeHosts[element.id]||[]){
     const attribute=element.attributes.find(a=>a.name===name),bindingToken=name+'={$'+binding+'.attributes['+JSON.stringify(element.id+'|'+name)+']}';
     if(attribute)out.overwrite(attribute.start,attribute.end,bindingToken);else out.appendLeft(element.start+1+element.tag.length,' '+bindingToken);
    }
   }
  }
  for(const element of elements)if(Object.hasOwn(snapshot.texts,element.id)){const range=textRange(element,source),expression='{$'+binding+'.texts['+JSON.stringify(element.id)+']}';if(range.start===range.end)out.appendLeft(range.start,expression);else out.overwrite(range.start,range.end,expression);}
  const script='\nimport {sourceState as '+binding+'_create, literalProp as '+binding+'_prop} from "virtual:retouch-svelte-source";\nconst '+binding+' = '+binding+'_create('+JSON.stringify(relative)+','+JSON.stringify({revision,signature:contentHash(snapshot.signature),texts:snapshot.texts,componentProps:snapshot.componentProps,attributes:snapshot.styling?.attributes||{},styleIds:snapshot.styling?.ids||{},css:snapshot.styling?.css||null}).replace(/</g,'\\u003c')+');\n';
  if(ast.module)out.appendLeft(ast.module.content.start,script);else out.prepend('<script module>'+script+'</script>\n');
 }
 return {code:out.toString(),map:out.generateMap({hires:true,source:file,includeContent:true})};
}
module.exports={collect,stamp,contentHash,literal,textRange,textSnapshot};
