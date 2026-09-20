'use strict';
const {PDFName,PDFArray,PDFDict,PDFNumber,PDFString}=require('pdf-lib');
const key=name=>PDFName.of(name),text=value=>typeof value?.decodeText==='function'?value.decodeText():null;
function uri(value){try{const url=new URL(value);return ['http:','https:','mailto:','tel:'].includes(url.protocol)?url.href:null;}catch{return null;}}
function destinationName(value){if(value instanceof PDFName){try{return new TextDecoder('utf-8',{fatal:true}).decode(value.asBytes());}catch{}}return text(value);}
function destination(annotation){const direct=annotation.lookup(key('Dest'));if(direct)return direct;const action=annotation.lookup(key('A'));return action instanceof PDFDict&&text(action.lookup(key('S')))==='GoTo'?action.lookup(key('D')):null;}
function copyLinks({input,source,output,target,crop,scale,baseURL}){
 const annotations=source.node.Annots();if(!annotations)return;
 for(const ref of annotations.asArray()){
  const original=input.context.lookup(ref);if(!(original instanceof PDFDict)||text(original.lookup(key('Subtype')))!=='Link')continue;
  const box=original.lookup(key('Rect'));if(!(box instanceof PDFArray)||box.size()!==4)continue;
  const values=box.asArray().map(value=>input.context.lookup(value)).map(value=>value instanceof PDFNumber?value.asNumber():NaN);if(!values.every(Number.isFinite))continue;
  const left=Math.max(crop.left,Math.min(values[0],values[2])),bottom=Math.max(crop.bottom,Math.min(values[1],values[3])),right=Math.min(crop.right,Math.max(values[0],values[2])),top=Math.min(crop.top,Math.max(values[1],values[3]));if(right<=left||top<=bottom)continue;
  const annotation={Type:'Annot',Subtype:'Link',F:4,Border:[0,0,0],Rect:[(left-crop.left)*scale,(bottom-crop.bottom)*scale,(right-crop.left)*scale,(top-crop.bottom)*scale]};
  const action=original.lookup(key('A'));let address=action instanceof PDFDict&&text(action.lookup(key('S')))==='URI'?uri(text(action.lookup(key('URI')))):null;
  const raw=destination(original),name=destinationName(raw);let dest=raw;
  if(name){const names=input.catalog.lookup(key('Dests'));dest=names instanceof PDFDict?names.lookup(raw instanceof PDFName?raw:key(name)):null;}
  if(dest instanceof PDFDict)dest=dest.lookup(key('D'));
  if(dest instanceof PDFArray&&dest.get(0)?.toString()===source.ref.toString()&&text(dest.lookup(1))==='XYZ'){
   const x=dest.lookup(2),y=dest.lookup(3),left=x instanceof PDFNumber?x.asNumber():crop.left,top=y instanceof PDFNumber?y.asNumber():crop.top;
   if(left>=crop.left&&left<=crop.right&&top>=crop.bottom&&top<=crop.top)annotation.Dest=[target.ref,'XYZ',(left-crop.left)*scale,(top-crop.bottom)*scale,null];
  }
  // A destination outside this exported crop is still reachable on the site.
  if(!annotation.Dest&&!address&&name){try{const url=new URL(baseURL);url.hash=name;address=uri(url.href);}catch{}}
  if(!annotation.Dest){if(!address)continue;annotation.A={Type:'Action',S:'URI',URI:PDFString.of(address)};}
  target.node.addAnnot(output.context.register(output.context.obj(annotation)));
 }
}
function rebindLocalLinks(source,target){
 const before=source.node.Annots(),after=target.node.Annots();if(!before||!after)return;
 for(let i=0;i<before.size();i++){
  const original=source.doc.context.lookup(before.get(i)),copy=target.doc.context.lookup(after.get(i));if(!(original instanceof PDFDict)||!(copy instanceof PDFDict))continue;
  const old=destination(original),next=destination(copy);
  if(old instanceof PDFArray&&next instanceof PDFArray&&old.get(0)?.toString()===source.ref.toString())next.set(0,target.ref);
 }
}
module.exports={copyLinks,rebindLocalLinks};
