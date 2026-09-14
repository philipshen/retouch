'use strict';
const valid=(tag,value)=>tag==='ul'?value==='disc':tag==='ol'?['decimal','lower-alpha','lower-roman'].includes(value):tag==='li'&&['none','inherit'].includes(value);
const source=require('./inline-source-property.cjs');
function patch(raw,tag,marker,jsx=false){if(!valid(tag,marker))throw Error('Invalid list marker.');return source.patch(raw,tag,marker,jsx);}
module.exports={valid,patch,css:(value,marker)=>source.css(value,marker)};
