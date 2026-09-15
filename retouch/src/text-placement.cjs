'use strict';
function markup(position,language='html'){
 if(!position||typeof position!=='object'||Array.isArray(position)||Object.keys(position).some(key=>!['x','y','width','height'].includes(key))||![position.x,position.y].every(value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=100000))throw Error('Choose a text position within the editable canvas.');
 const box=position.width!==undefined||position.height!==undefined;if(box&&![position.width,position.height].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=100000))throw Error('Choose a text box from 1 to 100000 pixels on each axis.');
 const x=Number(position.x.toFixed(6)),y=Number(position.y.toFixed(6));
 const width=box?Number(position.width.toFixed(6)):null,height=box?Number(position.height.toFixed(6)):null;
 if(language!=='html')return '<p '+(language==='react'?'className':'class')+'="block absolute left-['+x+'px] top-['+y+'px] m-0 font-sans text-[16px] leading-normal text-black '+(box?'box-border p-0 border-0 w-['+width+'px] h-['+height+'px] whitespace-pre-wrap':'whitespace-pre')+'">New text</p>';
 const style={display:'block',position:'absolute',left:Number(position.x.toFixed(6))+'px',top:Number(position.y.toFixed(6))+'px',margin:'0',fontFamily:'Arial, sans-serif',fontSize:'16px',lineHeight:'normal',color:'#000000',whiteSpace:'pre'};
 if(box)Object.assign(style,{boxSizing:'border-box',padding:'0',border:'0',width:width+'px',height:height+'px',whiteSpace:'pre-wrap'});
 const attribute='style="'+Object.entries(style).map(([key,value])=>key.replace(/[A-Z]/g,char=>'-'+char.toLowerCase())+':'+value).join(';')+'"';
 return '<p '+attribute+'>New text</p>';
}
module.exports={markup};
