(function(root){
  'use strict';
  function parse(value){
    if(typeof value!=='string'||value.length>20000)return null;
    const number='[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?';
    const text=value.trim();
    if(!new RegExp('^'+number+'(?:(?:\\s*,\\s*|\\s+)'+number+')+$').test(text))return null;
    const values=text.split(/[\s,]+/).map(Number);
    if(values.length%2||values.length>1024||values.some(v=>!Number.isFinite(v)||Math.abs(v)>100000))return null;
    const points=[];for(let i=0;i<values.length;i+=2)points.push({x:values[i],y:values[i+1]});
    return points;
  }
  function format(points){return points.map(p=>[p.x,p.y].map(n=>String(n)).join(',')).join(' ');}
  const api={parse,format};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGPoints=api;
})(typeof window==='object'?window:globalThis);
