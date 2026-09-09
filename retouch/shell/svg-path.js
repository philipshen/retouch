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
  function parseCompound(text){
    if(typeof text!=='string'||text.length>100000)return null;
    const tokens=[],number=/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/iy;
    let i=0;
    while(i<text.length){
      let separated=false;while(/[\t\n\r ]/.test(text[i]||'!')){i++;separated=true;}
      if(i===text.length)break;
      if(text[i]===','){if(typeof tokens.at(-1)!=='number')return null;i++;while(/[\t\n\r ]/.test(text[i]||'!'))i++;if(i===text.length||/[a-z,]/i.test(text[i]))return null;separated=true;}
      if(/[a-z]/i.test(text[i])){tokens.push(text[i++]);}
      else{if(typeof tokens.at(-1)==='number'&&!separated&&!/[+\-.]/.test(text[i]))return null;number.lastIndex=i;const match=number.exec(text);if(!match)return null;tokens.push(Number(match[0]));i=number.lastIndex;}
      if(tokens.length>4096)return null;
    }
    const subpaths=[];let nodes=[],at=0,command=null,previous=null,quadratic=null,closed=false;
    function finish(){
      if(closed&&nodes.length>2){const first=nodes[0],last=nodes.at(-1);if(first.x===last.x&&first.y===last.y){if(last.in)first.in=last.in;nodes.pop();}}
      if(!serialize(nodes,closed))return false;subpaths.push({nodes,closed});return subpaths.length<=128;
    }
    function numbers(count){const v=tokens.slice(at,at+count);if(v.length!==count||v.some(n=>typeof n!=='number'||!Number.isFinite(n)))return null;at+=count;return v;}
    while(at<tokens.length){
      if(typeof tokens[at]==='string')command=tokens[at++];
      if(!command)return null;const op=command.toUpperCase(),relative=command!==op,a=(closed?nodes[0]:nodes.at(-1))||{x:0,y:0};
      if(op==='M'&&nodes.length){if(!finish())return null;nodes=[];closed=false;previous=null;quadratic=null;}
      if(closed)return null;
      if(!nodes.length&&op!=='M')return null;
      if(op==='Z'){closed=true;command=null;continue;}
      const count={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2}[op];if(!count)return null;const v=numbers(count);if(!v)return null;
      const pair=n=>({x:v[n]+(relative?a.x:0),y:v[n+1]+(relative?a.y:0)});
      if(op==='M'){if(nodes.length)return null;nodes.push(pair(0));command=relative?'l':'L';}
      else if(op==='L')nodes.push(pair(0));
      else if(op==='H')nodes.push({x:v[0]+(relative?a.x:0),y:a.y});
      else if(op==='V')nodes.push({x:a.x,y:v[0]+(relative?a.y:0)});
      else if(op==='C'||op==='S'){const control=op==='C'?pair(0):['C','S'].includes(previous)&&a.in?{x:2*a.x-a.in.x,y:2*a.y-a.in.y}:{x:a.x,y:a.y};a.out=control;nodes.push({...pair(op==='C'?4:2),in:pair(op==='C'?2:0)});}
      else{const q=op==='Q'?pair(0):['Q','T'].includes(previous)&&quadratic?{x:2*a.x-quadratic.x,y:2*a.y-quadratic.y}:{x:a.x,y:a.y},b=pair(op==='Q'?2:0);a.out={x:a.x+2*(q.x-a.x)/3,y:a.y+2*(q.y-a.y)/3};b.in={x:b.x+2*(q.x-b.x)/3,y:b.y+2*(q.y-b.y)/3};nodes.push(b);quadratic=q;}
      if(!['Q','T'].includes(op))quadratic=null;previous=op;
      if(nodes.length>513)return null;
    }
    if(!finish())return null;return serializeCompound({subpaths})?{subpaths}:null;
  }
  function parse(text){const result=parseCompound(text);return result?.subpaths.length===1?result.subpaths[0]:null;}
  function serializeCompound(document){
    if(!document||!Array.isArray(document.subpaths)||!document.subpaths.length||document.subpaths.length>128)return null;
    let total=0;const parts=[];
    for(const part of document.subpaths){if(!part||!Array.isArray(part.nodes)||(total+=part.nodes.length)>512)return null;const d=serialize(part.nodes,part.closed);if(!d)return null;parts.push(d);}
    return parts.join(' ');
  }
  function equivalentCompound(a,b){return !!a&&!!b&&a.subpaths.length===b.subpaths.length&&a.subpaths.every((p,i)=>equivalent(p,b.subpaths[i]));}
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  function segmentMiddle(a,b){const ab=midpoint(a,a.out||a),bc=midpoint(a.out||a,b.in||b),cd=midpoint(b.in||b,b);return midpoint(midpoint(ab,bc),midpoint(bc,cd));}
  function split(nodes,index,closed){
    if(!serialize(nodes,closed)||nodes.length>=512||!Number.isInteger(index)||index<0||index>=nodes.length-(closed?0:1))return null;
    const next=nodes.map(p=>({...p,...(p.in?{in:{...p.in}}:{}),...(p.out?{out:{...p.out}}:{})})),a=next[index],b=next[(index+1)%next.length];let point;
    if(a.out||b.in){const ab=midpoint(a,a.out||a),bc=midpoint(a.out||a,b.in||b),cd=midpoint(b.in||b,b),abc=midpoint(ab,bc),bcd=midpoint(bc,cd);a.out=ab;b.in=cd;point={...midpoint(abc,bcd),in:abc,out:bcd};}else point=midpoint(a,b);
    next.splice(index+1,0,point);return next;
  }
  function translate(node,dx,dy){return {...node,x:node.x+dx,y:node.y+dy,...(node.in?{in:{x:node.in.x+dx,y:node.in.y+dy}}:{}),...(node.out?{out:{x:node.out.x+dx,y:node.out.y+dy}}:{})};}
  function corner(node){const next=translate(node,0,0);delete next.in;delete next.out;return next;}
  function smooth(nodes,index,closed=false){
    if(!serialize(nodes,closed)||!Number.isInteger(index)||index<0||index>=nodes.length)return null;
    const node=nodes[index],previous=index>0?nodes[index-1]:closed?nodes.at(-1):null,next=index<nodes.length-1?nodes[index+1]:closed?nodes[0]:null;
    let dx=(next||node).x-(previous||node).x,dy=(next||node).y-(previous||node).y;
    // A two-anchor loop has identical neighbors. Keep a usable existing tangent
    // or choose a perpendicular to the edge so smoothing does not collapse it.
    if(Math.hypot(dx,dy)<1e-9){if(node.out){dx=node.out.x-node.x;dy=node.out.y-node.y;}else if(node.in){dx=node.x-node.in.x;dy=node.y-node.in.y;}if(Math.hypot(dx,dy)<1e-9&&next){dx=-(next.y-node.y);dy=next.x-node.x;}}
    const length=Math.hypot(dx,dy);if(length<1e-9)return null;dx/=length;dy/=length;
    const result=corner(node),distance=p=>Math.hypot(p.x-node.x,p.y-node.y)/3;
    if(previous){const size=node.in?Math.hypot(node.in.x-node.x,node.in.y-node.y)||distance(previous):distance(previous);result.in={x:node.x-dx*size,y:node.y-dy*size};}
    if(next){const size=node.out?Math.hypot(node.out.x-node.x,node.out.y-node.y)||distance(next):distance(next);result.out={x:node.x+dx*size,y:node.y+dy*size};}
    return coordinate(result)&&(!result.in||coordinate(result.in))&&(!result.out||coordinate(result.out))?result:null;
  }
  function moveHandle(node,key,point,mode='independent'){
    if(!['in','out'].includes(key)||!['independent','aligned','mirrored'].includes(mode)||!coordinate(node)||!coordinate(point)||!node[key])return null;
    const next=translate(node,0,0),other=key==='in'?'out':'in';next[key]={x:point.x,y:point.y};
    if(mode!=='independent'&&node[other]){
      const dx=point.x-node.x,dy=point.y-node.y,length=Math.hypot(dx,dy);
      if(mode==='mirrored')next[other]={x:node.x-dx,y:node.y-dy};
      else if(length>1e-9){const size=Math.hypot(node[other].x-node.x,node[other].y-node.y);next[other]={x:node.x-dx*size/length,y:node.y-dy*size/length};}
    }
    return (!next.in||coordinate(next.in))&&(!next.out||coordinate(next.out))?next:null;
  }
  function equivalent(a,b){return !!a&&!!b&&a.closed===b.closed&&a.nodes.length===b.nodes.length&&a.nodes.every((p,i)=>['','in','out'].every(key=>{const x=key?p[key]:p,y=key?b.nodes[i][key]:b.nodes[i];return !x&&!y||x&&y&&Math.abs(x.x-y.x)<1e-6&&Math.abs(x.y-y.y)<1e-6;}));}
  const api={serialize,curved,parse,parseCompound,serializeCompound,equivalentCompound,split,segmentMiddle,translate,equivalent,corner,smooth,moveHandle};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGPath=api;
})(typeof window==='object'?window:globalThis);
