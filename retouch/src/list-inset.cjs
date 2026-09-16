'use strict';
const valid=value=>Number.isFinite(value)&&value>=0&&value<=10000;
function patch(raw,tag,value,jsx=false){
 if(!['ul','ol'].includes(tag)||!valid(value))throw Error('Invalid list inset.');
 return require('./inline-source-property.cjs').patch(raw,tag,value+'px',jsx,'padding-inline-start');
}
module.exports={valid,patch};
