'use strict';
function markup(position,language='html'){
 if(!position||typeof position!=='object'||Array.isArray(position)||Object.keys(position).some(key=>!['x','y'].includes(key))||![position.x,position.y].every(value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=100000))throw Error('Choose a text position within the editable canvas.');
 const x=Number(position.x.toFixed(6)),y=Number(position.y.toFixed(6));
 if(language!=='html')return '<p '+(language==='react'?'className':'class')+'="block absolute left-['+x+'px] top-['+y+'px] m-0 font-sans text-[16px] leading-normal text-black whitespace-pre">New text</p>';
 const style={display:'block',position:'absolute',left:Number(position.x.toFixed(6))+'px',top:Number(position.y.toFixed(6))+'px',margin:'0',fontFamily:'Arial, sans-serif',fontSize:'16px',lineHeight:'normal',color:'#000000',whiteSpace:'pre'};
 const attribute='style="'+Object.entries(style).map(([key,value])=>key.replace(/[A-Z]/g,char=>'-'+char.toLowerCase())+':'+value).join(';')+'"';
 return '<p '+attribute+'>New text</p>';
}
module.exports={markup};
