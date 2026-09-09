(function(root){
  'use strict';
  function coordinate(p){return !!p&&typeof p==='object'&&!Array.isArray(p)&&['x','y'].every(key=>typeof p[key]==='number'&&Number.isFinite(p[key])&&Math.abs(p[key])<=100000);}
  function curved(nodes){return nodes.some(p=>p.in||p.out||p.arc);}
  function validArc(a){return !!a&&typeof a==='object'&&['rx','ry','rotation'].every(key=>typeof a[key]==='number'&&Number.isFinite(a[key])&&Math.abs(a[key])<=100000)&&a.rx>=0&&a.ry>=0&&[0,1].includes(a.large)&&[0,1].includes(a.sweep);}
  function serialize(nodes,closed=false){
    if(!Array.isArray(nodes)||nodes.length<2||nodes.length>512||typeof closed!=='boolean')return null;
    for(const p of nodes)if(!coordinate(p)||p.in!==undefined&&!coordinate(p.in)||p.out!==undefined&&!coordinate(p.out)||p.arc!==undefined&&(!validArc(p.arc)||p.in))return null;
    for(let i=closed?0:1;i<nodes.length;i++)if(nodes[i].arc&&nodes[(i+nodes.length-1)%nodes.length].out)return null;
    if(new Set(nodes.map(p=>p.x+','+p.y)).size<2||closed&&nodes.length<3&&!curved(nodes))return null;
    const pair=p=>p.x+' '+p.y;
    function segment(a,b){if(b.arc){const r=b.arc;return 'A '+[r.rx,r.ry,r.rotation,r.large,r.sweep,b.x,b.y].join(' ');}return a.out||b.in?'C '+pair(a.out||a)+' '+pair(b.in||b)+' '+pair(b):'L '+pair(b);}
    let d='M '+pair(nodes[0]);for(let i=1;i<nodes.length;i++)d+=' '+segment(nodes[i-1],nodes[i]);
    if(closed){if(nodes.at(-1).out||nodes[0].in||nodes[0].arc)d+=' '+segment(nodes.at(-1),nodes[0]);d+=' Z';}
    return d;
  }
  function parseCompound(text){
    if(typeof text!=='string'||text.length>100000)return null;
    const tokens=[],raw=[],number=/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/iy;
    let i=0;
    while(i<text.length){
      let separated=false;while(/[\t\n\r ]/.test(text[i]||'!')){i++;separated=true;}
      if(i===text.length)break;
      if(text[i]===','){if(typeof tokens.at(-1)!=='number')return null;i++;while(/[\t\n\r ]/.test(text[i]||'!'))i++;if(i===text.length||/[a-z,]/i.test(text[i]))return null;separated=true;}
      if(/[a-z]/i.test(text[i])){raw.push(text[i]);tokens.push(text[i++]);}
      else{if(typeof tokens.at(-1)==='number'&&!separated&&!/[+\-.]/.test(text[i]))return null;number.lastIndex=i;const match=number.exec(text);if(!match)return null;raw.push(match[0]);tokens.push(Number(match[0]));i=number.lastIndex;}
      if(tokens.length>4096)return null;
    }
    const subpaths=[];let nodes=[],at=0,command=null,previous=null,quadratic=null,closed=false;
    function finish(){
      if(closed&&nodes.length>2){const first=nodes[0],last=nodes.at(-1);if(first.x===last.x&&first.y===last.y){if(last.in)first.in=last.in;if(last.arc)first.arc=last.arc;nodes.pop();}}
      if(!serialize(nodes,closed))return false;subpaths.push({nodes,closed});return subpaths.length<=128;
    }
    function numbers(count){const v=tokens.slice(at,at+count);if(v.length!==count||v.some(n=>typeof n!=='number'||!Number.isFinite(n)))return null;at+=count;return v;}
    function flag(){
      if(typeof tokens[at]!=='number'||!/^[01]/.test(raw[at]))return null;
      const result=Number(raw[at][0]),rest=raw[at].slice(1);
      if(rest){if(!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(rest))return null;tokens[at]=Number(rest);raw[at]=rest;}else at++;
      return result;
    }
    while(at<tokens.length){
      if(typeof tokens[at]==='string')command=tokens[at++];
      if(!command)return null;const op=command.toUpperCase(),relative=command!==op,a=(closed?nodes[0]:nodes.at(-1))||{x:0,y:0};
      if(op==='M'&&nodes.length){if(!finish())return null;nodes=[];closed=false;previous=null;quadratic=null;}
      if(closed)return null;
      if(!nodes.length&&op!=='M')return null;
      if(op==='Z'){closed=true;command=null;continue;}
      const count={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7}[op];if(!count)return null;let v;if(op==='A'){const radii=numbers(3);if(!radii)return null;const large=flag(),sweep=flag(),end=numbers(2);if(large===null||sweep===null||!end)return null;v=[...radii,large,sweep,...end];}else v=numbers(count);if(!v)return null;
      const pair=n=>({x:v[n]+(relative?a.x:0),y:v[n+1]+(relative?a.y:0)});
      if(op==='M'){if(nodes.length)return null;nodes.push(pair(0));command=relative?'l':'L';}
      else if(op==='L')nodes.push(pair(0));
      else if(op==='H')nodes.push({x:v[0]+(relative?a.x:0),y:a.y});
      else if(op==='V')nodes.push({x:a.x,y:v[0]+(relative?a.y:0)});
      else if(op==='A')nodes.push({...pair(5),arc:{rx:Math.abs(v[0]),ry:Math.abs(v[1]),rotation:v[2],large:v[3],sweep:v[4]}});
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
  function translateContour(part,dx,dy){
    if(!part||!serialize(part.nodes,part.closed)||!Number.isFinite(dx)||!Number.isFinite(dy))return null;
    const nodes=part.nodes.map(p=>translate(p,dx,dy));return serialize(nodes,part.closed)?{nodes,closed:part.closed}:null;
  }
  function appendContour(document,nodes,closed){
    if(!serializeCompound(document)||!serialize(nodes,closed))return null;
    const next=nodes.map(p=>translate(p,0,0));if(!closed){delete next[0].in;delete next[0].arc;delete next.at(-1).out;}
    const subpaths=[...document.subpaths.map(part=>({closed:part.closed,nodes:part.nodes.map(p=>translate(p,0,0))})),{nodes:next,closed}];
    return serializeCompound({subpaths})?{subpaths,selected:subpaths.length-1}:null;
  }
  function editContour(document,index,action){
    if(!serializeCompound(document)||!Number.isInteger(index)||index<0||index>=document.subpaths.length)return null;
    const subpaths=document.subpaths.map(part=>({closed:part.closed,nodes:part.nodes.map(p=>translate(p,0,0))})),part=subpaths[index];let selected=index;
    if(action==='duplicate'){subpaths.splice(index+1,0,{closed:part.closed,nodes:part.nodes.map(p=>translate(p,10,10))});selected++;}
    else if(action==='delete'){if(subpaths.length===1)return null;subpaths.splice(index,1);selected=Math.min(index,subpaths.length-1);}
    else if(action==='reverse'){
      const ordered=part.closed?[part.nodes[0],...part.nodes.slice(1).reverse()]:[...part.nodes].reverse();
      part.nodes=ordered.map(p=>{const i=part.nodes.indexOf(p),arc=(part.nodes[i+1]||(part.closed?part.nodes[0]:null))?.arc;return {...corner(p),...(p.out?{in:{...p.out}}:{}),...(p.in?{out:{...p.in}}:{}),...(arc?{arc:{...arc,sweep:1-arc.sweep}}:{})};});
    }else if(action==='open'||action==='close'){
      part.closed=action==='close';
      // Opening removes the closing edge. Closing joins the endpoints with a
      // straight segment; do not keep invisible endpoint handles in the model.
      delete part.nodes[0].in;delete part.nodes[0].arc;delete part.nodes.at(-1).out;
    }else return null;
    return serializeCompound({subpaths})?{subpaths,selected}:null;
  }
  function equivalentCompound(a,b){return !!a&&!!b&&a.subpaths.length===b.subpaths.length&&a.subpaths.every((p,i)=>equivalent(p,b.subpaths[i]));}
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  // SVG endpoint-to-center conversion, including automatic radius correction:
  // https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
  function arcCenter(a,b){
    const arc=b.arc;if(!validArc(arc)||!arc.rx||!arc.ry||a.x===b.x&&a.y===b.y)return null;
    const phi=arc.rotation*Math.PI/180,c=Math.cos(phi),s=Math.sin(phi),dx=(a.x-b.x)/2,dy=(a.y-b.y)/2,x=c*dx+s*dy,y=-s*dx+c*dy;
    let rx=arc.rx,ry=arc.ry;const scale=Math.hypot(x/rx,y/ry);if(scale>1){rx*=scale;ry*=scale;}
    const denominator=rx*rx*y*y+ry*ry*x*x,factor=(arc.large===arc.sweep?-1:1)*Math.sqrt(Math.max(0,(rx*rx*ry*ry-denominator)/denominator)),cxp=factor*rx*y/ry,cyp=-factor*ry*x/rx;
    const cx=c*cxp-s*cyp+(a.x+b.x)/2,cy=s*cxp+c*cyp+(a.y+b.y)/2,u={x:(x-cxp)/rx,y:(y-cyp)/ry},v={x:(-x-cxp)/rx,y:(-y-cyp)/ry},start=Math.atan2(u.y,u.x);let delta=Math.atan2(u.x*v.y-u.y*v.x,u.x*v.x+u.y*v.y);
    if(!arc.sweep&&delta>0)delta-=2*Math.PI;else if(arc.sweep&&delta<0)delta+=2*Math.PI;
    return [rx,ry,cx,cy,start,delta].every(Number.isFinite)?{rx,ry,cx,cy,start,delta,c,s}:null;
  }
  function arcPoint(center,t){const angle=center.start+center.delta*t,x=center.rx*Math.cos(angle),y=center.ry*Math.sin(angle);return{x:center.c*x-center.s*y+center.cx,y:center.s*x+center.c*y+center.cy};}
  function segmentMiddle(a,b){if(b.arc){const center=arcCenter(a,b);return center?arcPoint(center,.5):midpoint(a,b);}const ab=midpoint(a,a.out||a),bc=midpoint(a.out||a,b.in||b),cd=midpoint(b.in||b,b);return midpoint(midpoint(ab,bc),midpoint(bc,cd));}
  function split(nodes,index,closed){
    if(!serialize(nodes,closed)||nodes.length>=512||!Number.isInteger(index)||index<0||index>=nodes.length-(closed?0:1))return null;
    const next=nodes.map(p=>translate(p,0,0)),a=next[index],b=next[(index+1)%next.length];let point;
    if(b.arc){const center=arcCenter(a,b);if(!center&&(b.arc.rx&&b.arc.ry)&&(a.x!==b.x||a.y!==b.y))return null;const arc=center?{...b.arc,rx:center.rx,ry:center.ry,large:0}:{...b.arc};point={...(center?arcPoint(center,.5):midpoint(a,b)),arc:{...arc}};b.arc=arc;}else if(a.out||b.in){const ab=midpoint(a,a.out||a),bc=midpoint(a.out||a,b.in||b),cd=midpoint(b.in||b,b),abc=midpoint(ab,bc),bcd=midpoint(bc,cd);a.out=ab;b.in=cd;point={...midpoint(abc,bcd),in:abc,out:bcd};}else point=midpoint(a,b);
    next.splice(index+1,0,point);return serialize(next,closed)?next:null;
  }
  function translate(node,dx,dy){return {...node,...(node.arc?{arc:{...node.arc}}:{}),x:node.x+dx,y:node.y+dy,...(node.in?{in:{x:node.in.x+dx,y:node.in.y+dy}}:{}),...(node.out?{out:{x:node.out.x+dx,y:node.out.y+dy}}:{})};}
  function corner(node){const next=translate(node,0,0);delete next.in;delete next.out;delete next.arc;return next;}
  function smooth(nodes,index,closed=false){
    if(!serialize(nodes,closed)||!Number.isInteger(index)||index<0||index>=nodes.length)return null;
    if(nodes[index].arc||(nodes[index+1]||(closed?nodes[0]:null))?.arc)return null;
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
  function equivalent(a,b){return !!a&&!!b&&a.closed===b.closed&&a.nodes.length===b.nodes.length&&a.nodes.every((p,i)=>(!p.arc&&!b.nodes[i].arc||p.arc&&b.nodes[i].arc&&['rx','ry','rotation','large','sweep'].every(key=>Math.abs(p.arc[key]-b.nodes[i].arc[key])<1e-6))&&['','in','out'].every(key=>{const x=key?p[key]:p,y=key?b.nodes[i][key]:b.nodes[i];return !x&&!y||x&&y&&Math.abs(x.x-y.x)<1e-6&&Math.abs(x.y-y.y)<1e-6;}));}
  const api={serialize,curved,parse,parseCompound,serializeCompound,equivalentCompound,editContour,appendContour,translateContour,split,segmentMiddle,arcCenter,arcPoint,translate,equivalent,corner,smooth,moveHandle};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGPath=api;
})(typeof window==='object'?window:globalThis);
