(function(root){
 'use strict';
 function classesForBounds(classes,scope,g,css,document=null,anchorOverride=null){
  const I=root.RetouchInspector||require('./inspector.js'),R=root.RetouchResponsive||require('./responsive.js'),current=R.project(classes,scope),base=R.inherited(classes,scope,document),anchors=anchorOverride||{x:I.inferredAnchor(current,'x',base),y:I.inferredAnchor(current,'y',base)};
  let next=I.anchorClasses(current,g,anchors.x,anchors.y,base);
  if(css.boxSizing==='content-box'){
   next=I.replace(next,t=>/^box-(border|content)$/.test(t),'box-content');
   for(const [axis,size,parent,edges,token]of [['x','width','parentWidth',['left','right'],'w'],['y','height','parentHeight',['top','bottom'],'h']]){
    if(anchors[axis]==='stretch')continue;
    const decoration=edges.reduce((total,edge)=>total+(parseFloat(css.getPropertyValue('padding-'+edge))||0)+(parseFloat(css.getPropertyValue('border-'+edge+'-width'))||0),0),value=Math.max(0,g[size]-decoration),dimension=anchors[axis]==='scale'?(Math.round(value/g[parent]*1000000)/10000)+'%':(Math.round(value*1000000)/1000000)+'px';
    next=I.replace(next,t=>t.startsWith(token+'-'),token+'-['+dimension+']');
   }
  }
  // Keep priority per geometry group. An important right anchor must not
  // turn an unchanged width into !important and suppress a wider breakpoint.
  const group=token=>/^(static|relative|absolute|fixed|sticky)$/.test(token)?'position':/^-?(left|right|start|end|inset-x)-/.test(token)?'x':/^-?(top|bottom|inset-y)-/.test(token)?'y':/^-?inset-/.test(token)?'inset':/^(w|h|size)-/.test(token)?token.split('-')[0]:/^box-(border|content)$/.test(token)?'box':/^-?m(?:[trblxyse])?-/.test(token)?'margin':null;
  const important=new Set((current+' '+base).split(/\s+/).filter(token=>I.base(token)!==null&&/^!|!$/.test(token)).map(token=>group(I.base(token))));
  next=next.split(/\s+/).map(token=>{const clean=I.base(token),kind=clean===null?null:group(clean);if(!kind)return token;return (important.has(kind)||['x','y'].includes(kind)&&important.has('inset')||['w','h'].includes(kind)&&important.has('size')?'!':'')+clean;}).join(' ');
  return R.replaceScope(classes,next,scope);
 }
 function strategy(infos,elements,scope,{reason,matches,save}){
  const I=root.RetouchInspector,R=root.RetouchResponsive;
  return {
   validate(){
    const d=elements[0]?.ownerDocument;if(!d)throw Error('Re-select the layers.');
    if(scope){const arbitrary=/^min-\[(\d+(?:\.\d+)?)(px|rem|em)\]:$/.exec(scope),condition=R.discover(d).find(choice=>choice.prefix===scope)?.condition||(arbitrary?'(min-width: '+arbitrary[1]+arbitrary[2]+')':null);if(!condition||!d.defaultView.matchMedia(condition).matches)throw Error('Choose a screen where this style scope is active before changing selection geometry.');}
    for(let i=0;i<infos.length;i++){
     if(!infos[i].classSelection||infos[i].classNameDynamic)throw Error('Selection geometry needs editable host classes.');
     if(matches(infos[i].id).length!==1)throw Error('This source layer renders more than once. Choose unique source layers for selection geometry.');
     const refusal=reason(infos[i],elements[i]);if(refusal)throw Error(refusal);
    }
   },
   flip(planned){
    this.validate();
    return save(Object.fromEntries(infos.map((info,i)=>{
     const el=elements[i],next=planned[i],classes=classesForBounds(info.className,scope,next.geometry,el.ownerDocument.defaultView.getComputedStyle(el),el.ownerDocument),inherited=R.inherited(classes,scope,el.ownerDocument);
     let current=R.project(classes,scope);
     for(const [property,value,match]of [['scale',next.scale.replaceAll(' ','_'),root.RetouchFlip.token],['rotate',next.geometry.rotation+'deg',token=>/^-?rotate-(?![xyz]-)|^\[rotate:/.test(token)]]){
      const important=el.style.getPropertyValue(property)||inherited.split(/\s+/).some(token=>/^!|!$/.test(token)&&match(I.base(token)||''));
      current=I.replace(current,match,(important?'!':'')+'['+property+':'+value+']');
     }
     return [info.id,R.replaceScope(classes,current,scope)];
    })));
   },
   makeAbsolute(measured){
    this.validate();const expected=Object.fromEntries(infos.map((info,i)=>[info.id,measured[i].geometry]));
    return save(Object.fromEntries(infos.map((info,i)=>[info.id,classesForBounds(info.className,scope,measured[i].geometry,elements[i].ownerDocument.defaultView.getComputedStyle(elements[i]),elements[i].ownerDocument,{x:'start',y:'start'})])),expected);
   },
   write(measured,deltas){
    this.validate();
    const expected=measured.map((item,i)=>({...item.geometry,x:item.geometry.x+deltas[i].x,y:item.geometry.y+deltas[i].y,width:deltas[i].width??item.geometry.width,height:deltas[i].height??item.geometry.height}));
    const changes=Object.fromEntries(infos.map((info,i)=>{
     const g=measured[i].geometry,next=expected[i];if(!['x','y','width','height'].every(key=>Number.isFinite(next[key])&&Math.abs(next[key])<=100000))throw Error('Keep layer bounds within 100,000 pixels.');
     if(['x','y','width','height'].every(key=>Math.abs(next[key]-g[key])<1/32))return [info.id,null];
     return [info.id,classesForBounds(info.className,scope,next,elements[i].ownerDocument.defaultView.getComputedStyle(elements[i]),elements[i].ownerDocument)];
    }));return save(changes,Object.fromEntries(infos.map((info,i)=>[info.id,expected[i]])));
   }
  };
 }
 const api={classesForBounds,strategy};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchReactSelectionGeometry=api;
})(typeof window==='object'?window:globalThis);
