(function(root){
  'use strict';
  function coordinate(p){return !!p&&typeof p==='object'&&!Array.isArray(p)&&['x','y'].every(key=>typeof p[key]==='number'&&Number.isFinite(p[key])&&Math.abs(p[key])<=100000);}
  function curved(nodes){return nodes.some(p=>p.in||p.out);}
  function serialize(nodes,closed=false){
    if(!Array.isArray(nodes)||nodes.length<2||nodes.length>512||typeof closed!=='boolean')return null;
    for(const p of nodes)if(!coordinate(p)||p.in!==undefined&&!coordinate(p.in)||p.out!==undefined&&!coordinate(p.out))return null;
    if(new Set(nodes.map(p=>p.x+','+p.y)).size<2||closed&&nodes.length<3&&!curved(nodes))return null;
    const pair=p=>p.x+' '+p.y;
    function segment(a,b){return a.out||b.in?'C '+pair(a.out||a)+' '+pair(b.in||b)+' '+pair(b):'L '+pair(b);}
    let d='M '+pair(nodes[0]);for(let i=1;i<nodes.length;i++)d+=' '+segment(nodes[i-1],nodes[i]);
    if(closed){if(nodes.at(-1).out||nodes[0].in)d+=' '+segment(nodes.at(-1),nodes[0]);d+=' Z';}
    return d;
  }
  const api={serialize,curved};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGPath=api;
})(typeof window==='object'?window:globalThis);
