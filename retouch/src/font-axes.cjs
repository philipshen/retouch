'use strict';
// Read metadata only; this does not reconstruct glyphs or install a font.
const zlib=require('node:zlib');
const LIMIT=32*1024*1024;
const tags=['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB','EBSC','JSTF','MATH','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gvar','hsty','just','lcar','mort','morx','opbd','prop','trak','Zapf','Silf','Glat','Gloc','Feat','Sill'];
function bytes(b,offset,length){if(!Number.isInteger(offset)||!Number.isInteger(length)||offset<0||length<0||offset+length>b.length)throw Error('Truncated font metadata.');return b.subarray(offset,offset+length);}
const u16=(b,o)=>bytes(b,o,2).readUInt16BE(0),u32=(b,o)=>bytes(b,o,4).readUInt32BE(0),tag=(b,o)=>bytes(b,o,4).toString('latin1');
function tables(b){
 const signature=tag(b,0),result=new Map();
 const put=(name,value)=>{if(result.has(name))throw Error('Duplicate font table.');result.set(name,value);};
 if(signature==='wOF2'){
  bytes(b,0,48);if(tag(b,4)==='ttcf')throw Error('Font collections are not supported yet.');if(u32(b,8)!==b.length)throw Error('Invalid WOFF2 length.');
  const count=u16(b,12);if(!count||count>256)throw Error('Invalid font table count.');let offset=48,total=0;
  const base128=()=>{let value=0;for(let i=0;i<5;i++){const byte=bytes(b,offset++,1)[0];if(i===0&&byte===128||value>0x1ffffff)throw Error('Invalid WOFF2 table length.');value=value*128+(byte&127);if(!(byte&128))return value;}throw Error('Invalid WOFF2 table length.');};
  const entries=[];
  for(let i=0;i<count;i++){
   const flags=bytes(b,offset++,1)[0],name=(flags&63)===63?tag(b,offset):tags[flags&63];if((flags&63)===63)offset+=4;
   const version=flags>>6,outline=name==='glyf'||name==='loca',original=base128();
   if(outline?![0,3].includes(version):version!==0&&!(name==='hmtx'&&version===1))throw Error('Unsupported WOFF2 table transform.');
   const transformed=outline?version!==3:version!==0,length=transformed?base128():original;
   if(name==='loca'&&transformed&&length!==0)throw Error('Invalid transformed loca length.');
   total+=length;if(total>LIMIT)throw Error('Font metadata exceeds the decompression limit.');entries.push({name,length});
  }
  const unpacked=zlib.brotliDecompressSync(bytes(b,offset,u32(b,20)),{maxOutputLength:LIMIT});if(unpacked.length!==total)throw Error('Invalid decompressed font length.');
  offset=0;for(const entry of entries){put(entry.name,bytes(unpacked,offset,entry.length));offset+=entry.length;}
 }else if(signature==='wOFF'){
  bytes(b,0,44);if(u32(b,8)!==b.length)throw Error('Invalid WOFF length.');const count=u16(b,12);if(!count||count>256)throw Error('Invalid font table count.');let total=0;
  for(let i=0;i<count;i++){
   const o=44+i*20,name=tag(b,o),packed=u32(b,o+8),original=u32(b,o+12),data=bytes(b,u32(b,o+4),packed);total+=original;
   if(packed>original||total>LIMIT)throw Error('Invalid WOFF table length.');
   const value=packed===original?data:zlib.inflateSync(data,{maxOutputLength:Math.max(1,original)});if(value.length!==original)throw Error('Invalid decompressed font table.');put(name,value);
  }
 }else{
  if(!['OTTO','true'].includes(signature)&&u32(b,0)!==0x10000)throw Error('Unsupported font format.');
  const count=u16(b,4);if(!count||count>256)throw Error('Invalid font table count.');
  for(let i=0;i<count;i++){const o=12+i*16;put(tag(b,o),bytes(b,u32(b,o+8),u32(b,o+12)));}
 }
 return result;
}
function names(table){
 const result=new Map();if(!table)return result;const count=u16(table,2),start=u16(table,4);if(count>4096)throw Error('Too many font name records.');
 for(let i=0;i<count;i++){
  const o=6+i*12,platform=u16(table,o),encoding=u16(table,o+2),language=u16(table,o+4),id=u16(table,o+6),length=u16(table,o+8),data=bytes(table,start+u16(table,o+10),length);
  if(platform!==0&&!(platform===3&&[1,10].includes(encoding)))continue;
  if(length%2)throw Error('Invalid Unicode font name.');
  const value=Buffer.from(data).swap16().toString('utf16le').replace(/\0/g,'').trim(),rank=platform===3&&language===0x409?3:platform===0?2:1;
  if(value&&(!result.has(id)||result.get(id).rank<rank))result.set(id,{value,rank});
 }
 return result;
}
function readFontAxes(input){
 if(!(input instanceof Uint8Array))throw Error('Expected font bytes.');
 if(input.byteLength>16*1024*1024)throw Error('Font files must be 16 MB or smaller.');
 const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength);
 const all=tables(b),fvar=all.get('fvar');if(!fvar)return [];
 if(u16(fvar,0)!==1||u16(fvar,2)!==0)throw Error('Unsupported font variation version.');
 const offset=u16(fvar,4),count=u16(fvar,8),size=u16(fvar,10);if(offset<16||count>64||size<20)throw Error('Invalid font variation directory.');bytes(fvar,offset,count*size);
 const labels=names(all.get('name')),seen=new Set(),axes=[];
 for(let i=0;i<count;i++){
  const o=offset+i*size,axis=tag(fvar,o),values=[4,8,12].map(n=>bytes(fvar,o+n,4).readInt32BE(0)/65536),[min,defaultValue,max]=values;
  if(!/^[\x20-\x7e]{4}$/.test(axis)||seen.has(axis)||min>defaultValue||defaultValue>max)throw Error('Invalid font variation axis.');seen.add(axis);
  axes.push({tag:axis,name:labels.get(u16(fvar,o+18))?.value||axis,min,default:defaultValue,max,hidden:!!(u16(fvar,o+16)&1)});
 }
 return axes;
}
module.exports={readFontAxes};
