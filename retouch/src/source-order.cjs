'use strict';
// Reorder source chunks while retaining whitespace/comments in their original gap slots.
function reorder(source,ranges,from,to){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=ranges.length||to>=ranges.length||from===to)throw new Error('Invalid source move.');
 const lo=Math.min(from,to),hi=Math.max(from,to),chunks=ranges.slice(lo,hi+1);
 for(let i=0;i<chunks.length;i++){const r=chunks[i];if(!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end<=r.start||r.end>source.length||i&&r.start<chunks[i-1].end)throw new Error('Invalid source ranges.');}
 const ordered=chunks.slice(),[selected]=ordered.splice(from-lo,1);ordered.splice(to-lo,0,selected);
 const start=chunks[0].start,end=chunks.at(-1).end,segments=[];let body='';
 const append=r=>{segments.push({...r,destination:start+body.length});body+=source.slice(r.start,r.end);};
 for(let i=0;i<ordered.length;i++){append(ordered[i]);if(i<ordered.length-1)append({start:chunks[i].end,end:chunks[i+1].start});}
 return {after:source.slice(0,start)+body+source.slice(end),offset(position){const segment=segments.find(s=>position>=s.start&&position<s.end);return segment?segment.destination+position-segment.start:position;}};
}
module.exports={reorder};
