'use strict';
const MagicString=require('magic-string');
const containers=new Set(['body','div','main','section','article','aside','header','footer','nav','form','fieldset','dialog','figure','details','blockquote','li','td','th']);
function describe(resolved,language){
 const el=resolved.element,node=el.node,react=language==='react',tag=react?node?.openingElement?.name?.name:el.tag;
 const fail=insertReason=>({canInsert:false,insertReason});
 if(el.kind!=='host'||!containers.has(tag)||el.dynamicTag||el.generatedImage)return fail('Select a native content container to add a layer.');
 if(react){
  if(node.openingElement.attributes.some(a=>a.type==='JSXSpreadAttribute'||['children','dangerouslySetInnerHTML'].includes(a.name?.name)))return fail('This container supplies children through props. Edit that binding first.');
  const ancestry=resolved.elements.filter(e=>e.node.start<node.start&&e.node.end>node.end).reverse();
  if(ancestry.find(e=>['svg','foreignObject'].includes(e.node.openingElement.name.name))?.node.openingElement.name.name==='svg')return fail('Select an HTML container outside the SVG canvas.');
 }else{
  if(el.selfClosing||!Number.isInteger(el.closeNameStart)||resolved.source[el.closeEnd-1]!=='>')return fail('Select an explicitly closed content container.');
  // Appending at a closing tag must stay in the same Liquid branch as its opening tag.
  const scopes=[],blocks=new Set(['if','unless','for','tablerow','case','capture','form','paginate','raw','comment','schema','javascript','stylesheet']);
  const tokens=resolved.source.slice(el.openEnd,el.closeStart).matchAll(/\{%-?\s*(\w+)[\s\S]*?-?%\}/g);
  for(const token of tokens){const name=token[1],raw=['raw','comment','schema','javascript','stylesheet'].includes(scopes.at(-1));
   if(raw&&name!=='end'+scopes.at(-1))continue;
   if(blocks.has(name))scopes.push(name);
   else if(name.startsWith('end')){if(scopes.pop()!==name.slice(3))return fail('The container crosses Liquid control boundaries.');}
   else if(name==='liquid'||['else','elsif','when'].includes(name)&&!scopes.length)return fail('The container crosses Liquid control boundaries.');
  }
  if(scopes.length)return fail('The container crosses Liquid control boundaries.');
  for(let ancestor=el;ancestor;ancestor=ancestor.parent){
   if(ancestor.textBinding||ancestor.attributes?.some(a=>['x-for','v-for','x-if','v-if'].includes(a.name)))return fail('This container is controlled by a client template.');
   if(ancestor.tag==='foreignobject')break;
   if(ancestor.tag==='svg')return fail('Select an HTML container outside the SVG canvas.');
  }
 }
 return {canInsert:true,insertReason:null};
}
function plan(resolved,op,language){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the container.');
  const capability=describe(resolved,language);if(!capability.canInsert)return refuse(capability.insertReason);
  if(!['text','frame'].includes(op.preset))return refuse('Choose a text layer or frame.');
  const react=language==='react',adapter=require(react?'./id.cjs':'./adapters/liquid.cjs'),collect=react?adapter.collectElements:adapter.collect;
  const content=op.preset==='text'?'<p>New text</p>':react?'<div aria-label="Frame" className="min-h-[100px] p-4 border border-dashed border-[#999]"></div>':'<div aria-label="Frame" class="min-h-[100px] p-4 border border-dashed border-[#999]"></div>';
  const node=resolved.element.node,selfClosing=react&&node.openingElement.selfClosing;
  const offset=react?(selfClosing?node.openingElement.end-2:node.closingElement.start):node.closeStart;
  const prefix=selfClosing?'>':'',suffix=selfClosing?'</'+node.openingElement.name.name+'>':'';
  const insertion=prefix+content+suffix,out=new MagicString(resolved.source);
  if(selfClosing)out.overwrite(offset,node.openingElement.end,insertion);else out.appendLeft(offset,insertion);
  const after=out.toString(),next=collect(after,resolved.relPath).elements,start=e=>react?e.node.start:e.tagStart;
  const created=next.find(e=>start(e)===offset+prefix.length),parent=next.find(e=>e.id===resolved.element.id),delta=insertion.length-(selfClosing?2:0);
  if(next.length!==resolved.elements.length+1||!created||!(react?parent?.node.children.includes(created.node):created.parent===parent)||resolved.elements.some(old=>!next.some(fresh=>fresh.id===old.id&&fresh.kind===old.kind&&start(fresh)===start(old)+(start(old)>=offset?delta:0))))return refuse('The insertion would change surrounding source layer identities.');
  return {ok:true,hash:adapter.contentHash(after),parentId:parent.id,createdId:created.id,structural:true,edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan};
