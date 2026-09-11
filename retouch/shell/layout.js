(function(root){
  'use strict';
  const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
  const display=t=>/^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root)$/.test(t);
  function modeClasses(classes,mode) {
    const additions={flow:'block',row:'flex flex-row',column:'flex flex-col','row-reverse':'flex flex-row-reverse','column-reverse':'flex flex-col-reverse',grid:'grid'};
    if(!Object.hasOwn(additions,mode))throw Error('Unknown layout');
    return I.replace(classes,t=>display(t)||/^flex-(row|col)(-reverse)?$/.test(t),additions[mode]);
  }
  function layoutAxes(parent={}){
    const inline=/^(vertical|sideways)-/.test(parent.writingMode||'')?'height':'width',block=inline==='width'?'height':'width';
    return {inline,block,main:/^column/.test(parent.direction||'')?block:inline};
  }
  function gapValue(value){
    value=String(value).trim();
    if(/^(?:\d+\.?\d*|\.\d+)$/.test(value))value+='px';
    if(value==='normal')return value;
    if(!/^(?:\d+\.?\d*|\.\d+)(?:px|%|rem|em|vw|vh|ch)$/.test(value)||parseFloat(value)>10000)throw Error('Use a nonnegative gap up to 10000, with px, %, rem, em, vw, vh or ch, or normal.');
    return value;
  }
  function gapClasses(classes,axis,value,writingMode){
    if(!['width','height'].includes(axis))throw Error('Choose a horizontal or vertical gap.');
    value=gapValue(value);
    const inline=layoutAxes({writingMode}).inline===axis,kind=inline?'x':'y',property=inline?'column-gap':'row-gap';
    let addition='gap-'+kind+'-['+value+']';
    if(classes.split(/\s+/).some(token=>/^!|!$/.test(token)&&/^(?:gap-(?![xy]-)|\[gap:)/.test(I.base(token)||'')))addition='!'+addition;
    return I.replace(classes,token=>token.startsWith('gap-'+kind+'-')||token.startsWith('['+property+':'),addition);
  }
  function sizeClasses(classes,axis,mode,value,parent={}) {
    if(!['width','height'].includes(axis)||!['fixed','hug','fill','reset'].includes(mode))throw Error('Unknown sizing mode');
    if(mode==='fixed'&&(!Number.isFinite(value)||value<0||value>100000))throw Error('Invalid size');
    const dim=axis==='width'?'w':'h';
    const axes=layoutAxes(parent),alongFlex=/flex/.test(parent.display||'')&&axis===axes.main;
    const stretchAxis=!alongFlex&&/flex/.test(parent.display||'')||/grid/.test(parent.display||''),stretch=mode==='fill'&&stretchAxis,inlineStretch=stretchAxis&&/grid/.test(parent.display||'')&&axis===axes.inline;
    const match=t=>t.startsWith(dim+'-') || t.startsWith('['+axis+':') || mode==='reset'&&stretchAxis&&(inlineStretch?/^justify-self-stretch$|^\[justify-self:stretch\]$/.test(t):/^self-stretch$|^\[align-self:stretch\]$/.test(t)) || stretch&&(inlineStretch?/^justify-self-|^\[justify-self:/.test(t):/^self-|^\[align-self:/.test(t)) || (alongFlex&&(/^(?:grow|shrink)(?:-|$)|^basis-/.test(t)||/^flex-(?:\d+(?:\/\d+)?|auto|initial|none|\[.*\]|\(.*\))$|^\[flex(?:-(?:grow|shrink|basis))?:/.test(t)));
    if(mode==='reset')return I.replace(classes,match,'');
    let addition=mode==='fixed'?`${dim}-[${value}px]`:mode==='hug'?`${dim}-fit`:`${dim}-full`;
    if(stretch)addition=dim+'-auto '+(inlineStretch?'justify-self-stretch':'self-stretch');
    if(alongFlex)addition=mode==='fill'?`${dim}-auto flex-1`:addition+' flex-none';
    if(classes.split(/\s+/).some(token=>(I.base(token)?.startsWith('size-')||stretch&&/^place-self-|^\[place-self:/.test(I.base(token)||''))&&/^!|!$/.test(token)))addition=addition.split(' ').map(token=>'!'+token).join(' ');
    return I.replace(classes,match,addition);
  }
  function spanClasses(classes,axis,value) {
    if(!['column','row'].includes(axis))throw Error('Unknown grid axis');
    if(!['auto','full'].includes(value)&&!(Number.isInteger(value)&&value>=1&&value<=24))throw Error('Choose a span from 1 to 24');
    const prefix=axis==='column'?'col':'row';
    const placement=new RegExp('^-?'+prefix+'-(?:auto|span-(?:full|\\d+|\\[.+\\])|(?:start|end)-(?:auto|\\d+|\\[.+\\])|\\d+|\\[.+\\])$');
    return I.replace(classes,t=>placement.test(t),prefix+'-'+(typeof value==='number'?'span-'+value:value==='full'?'span-full':'auto'));
  }
  function spanValue(start,end) {
    if(start==='auto'&&end==='auto')return 'auto';
    if(start==='1'&&end==='-1')return 'full';
    const span=/^span (\d+)$/.exec(start);
    if(span&&end===start)return span[1];
    return '';
  }
  const limitKeys=['min-width','max-width','min-height','max-height'];
  function limitValue(value,key) {
    if(!limitKeys.includes(key))throw Error('Unknown size limit');
    value=String(value).trim();
    if(/^\d*\.?\d+$/.test(value))value+='px';
    if(!/^(?:\d*\.?\d+(?:px|%|rem|em|vw|vh|svw|svh|dvw|dvh|ch)|min-content|max-content|fit-content)$/.test(value)&&value!==(key.startsWith('min-')?'auto':'none'))throw Error('Use a nonnegative CSS size, or a sizing keyword');
    return value;
  }
  function limitClasses(classes,key,value) {
    if(!limitKeys.includes(key))throw Error('Unknown size limit');
    const prefix=key.replace('width','w').replace('height','h')+'-';
    const addition=value===null?'':prefix+'['+limitValue(value,key)+']';
    return I.replace(classes,t=>t.startsWith(prefix),addition);
  }
  function ownLimit(classes,key) {
    const prefix=key.replace('width','w').replace('height','h')+'-';
    const token=classes.split(/\s+/).map(t=>t.replace(/^!|!$/g,'')).find(t=>t.startsWith(prefix));
    if(!token)return null;
    const value=token.slice(prefix.length);
    return value.startsWith('[')&&value.endsWith(']')?value.slice(1,-1).replace(/_/g,' '):null;
  }
  let limitsOpen=false;
  function mount(info,el,save) {
    const sec=I.section('Layout');if(!el)return sec;
    if(info.classNameDynamic){I.note(sec,info.classNameReason||'This layout has computed classes.','refused');return sec;}
    const css=el.ownerDocument.defaultView.getComputedStyle(el);
    const parent=el.parentElement&&el.ownerDocument.defaultView.getComputedStyle(el.parentElement);
    const classes=info.className||'';
    const mode=/grid/.test(css.display)?'grid':/flex/.test(css.display)?css.flexDirection:'flow';
    const verticalInline=layoutAxes({writingMode:css.writingMode}).inline==='height',rowLabel=verticalInline?'Vertical':'Horizontal',columnLabel=verticalInline?'Horizontal':'Vertical';
    I.select(sec,'Arrange children',[['flow','Normal flow'],['row',rowLabel],['column',columnLabel],['row-reverse',rowLabel+' · reverse'],['column-reverse',columnLabel+' · reverse'],['grid','Grid']],mode,value=>save(modeClasses(classes,value)));
    function numeric(label,value,min,max,change) {
      const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='any';
      input.value=Number.isFinite(value)?Math.round(value*100)/100:0;
      input.oninput=()=>input.setCustomValidity('');
      input.onchange=()=>{if(input.value!==''&&input.checkValidity())try{change(Number(input.value));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
      return I.field(sec,label,input);
    }
    if(mode!=='flow') {
      if(mode==='grid') {
        const explicit=(classes.match(/(?:^|\s)grid-cols-(\d+)(?:\s|$)/)||[])[1];
        const tracks=css.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
        const columns=numeric('Columns',Number(explicit)||tracks||1,1,24,v=>{if(Number.isInteger(v))save(I.replace(classes,t=>t.startsWith('grid-cols-'),`grid-cols-${v}`));});columns.step='1';
      } else {
        I.select(sec,'Wrap children',[['nowrap','No wrap'],['wrap','Wrap'],['wrap-reverse','Wrap · reverse']],css.flexWrap,v=>save(I.replace(classes,t=>/^flex-(wrap|wrap-reverse|nowrap)$/.test(t),'flex-'+v)));
      }
      for(const [prop,label,axis] of [['columnGap',verticalInline?'Vertical gap':'Horizontal gap',verticalInline?'height':'width'],['rowGap',verticalInline?'Horizontal gap':'Vertical gap',verticalInline?'width':'height']]) {
        const input=document.createElement('input');input.type='text';input.value=css[prop].replace(/px$/,'');input.placeholder='0';input.title='Pixels by default; also accepts %, rem, em, vw, vh, ch or normal';
        input.oninput=()=>input.setCustomValidity('');
        input.onchange=()=>{try{save(gapClasses(classes,axis,input.value,css.writingMode));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
        I.field(sec,label,input);
      }
      I.select(sec,'Align children',[['start','Start'],['center','Center'],['end','End'],['stretch','Stretch'],['baseline','Baseline']],(css.alignItems==='normal'?'stretch':css.alignItems.replace('flex-','')),v=>save(I.replace(classes,t=>t.startsWith('items-'),'items-'+v)));
      const justify=css.justifyContent==='normal'?'start':css.justifyContent.replace('flex-','').replace('space-','');
      I.select(sec,'Distribute children',[['start','Start'],['center','Center'],['end','End'],['between','Space between'],['around','Space around'],['evenly','Space evenly']],justify,v=>save(I.replace(classes,t=>/^justify-(?!items-|self-)/.test(t),'justify-'+v)));
    }
    if(parent&&/grid/.test(parent.display)&&!['absolute','fixed'].includes(css.position)) {
      const counts=Array.from({length:24},(_,i)=>[String(i+1),String(i+1)]);
      for(const axis of ['column','row']) {
        const prop=axis==='column'?'gridColumn':'gridRow';
        I.select(sec,axis==='column'?'Span columns':'Span rows',[['','Custom placement'],['auto','Auto'],['full',axis==='column'?'All columns':'All rows'],...counts],spanValue(css[prop+'Start'],css[prop+'End']),v=>{if(v)save(spanClasses(classes,axis,/^\d+$/.test(v)?Number(v):v));});
      }
      I.note(sec,'Choosing a span replaces explicit line placement on that axis. Other dimensions stay unchanged.');
    }
    for(const [side,short] of [['Top','t'],['Right','r'],['Bottom','b'],['Left','l']]) {
      numeric('Padding '+side.toLowerCase(),parseFloat(css['padding'+side])||0,0,10000,v=>save(I.replace(classes,t=>t.startsWith('p'+short+'-'),`p${short}-[${v}px]`)));
    }
    const geometry=root.RetouchReactSelection||require('./react-selection.js');
    const dims=Object.fromEntries(['width','height'].map(axis=>{const value=geometry.dimensionSize(css,axis);return [axis,Number.isFinite(value)?value:el[axis==='width'?'offsetWidth':'offsetHeight']];}));
    for(const axis of ['width','height']) {
      const title=axis[0].toUpperCase()+axis.slice(1),dim=axis==='width'?'w':'h';
      const sizingTokens=classes.split(/\s+/).filter(token=>I.base(token)!==null),ownToken=sizingTokens.find(token=>/^!|!$/.test(token)&&I.base(token).startsWith(dim+'-'))||sizingTokens.find(token=>/^!|!$/.test(token)&&I.base(token).startsWith('size-'))||sizingTokens.find(token=>I.base(token).startsWith(dim+'-'))||sizingTokens.find(token=>I.base(token).startsWith('size-'));
      const own=ownToken&&I.base(ownToken).replace(/^size-/,dim+'-');
      const context={display:parent?.display,direction:parent?.flexDirection,writingMode:parent?.writingMode},axes=layoutAxes(context);
      const stretchFill=own===dim+'-auto'&&parent&&(/grid/.test(parent.display)?axis===axes.inline?css.justifySelf==='stretch':css.alignSelf==='stretch':/flex/.test(parent.display)&&axis!==axes.main&&css.alignSelf==='stretch');
      const sizing=own===dim+'-fit'?'hug':own===dim+'-full'||stretchFill||/\bflex-1\b/.test(classes)&&parent&&/flex/.test(parent.display)&&axis===axes.main?'fill':own&&own!==dim+'-auto'?'fixed':'';
      const size=(mode,value)=>save(sizeClasses(classes,axis,mode,mode==='fixed'?geometry.dimensionValue(css,axis,value):value,context));
      I.select(sec,title+' behavior',[['','Inherited / auto'],['fixed','Fixed'],['hug','Hug content'],['fill','Fill available']],sizing,v=>size(v||'reset',Math.round(dims[axis]*100)/100));
      numeric(title+' (px)',dims[axis],0,100000,v=>size('fixed',v));
    }
    I.note(sec,'Pixel sizes include padding and borders, before transforms.');
    const limits=document.createElement('details');limits.className='advanced';limits.open=limitsOpen;
    limits.ontoggle=()=>{limitsOpen=limits.open;};
    const title=document.createElement('summary');title.textContent='Size limits';limits.append(title);
    for(const key of limitKeys) {
      const label=key.replace('min-','Minimum ').replace('max-','Maximum ');
      const input=document.createElement('input');input.type='text';input.value=ownLimit(classes,key)??css.getPropertyValue(key);input.placeholder=key.startsWith('min-')?'auto':'none';
      input.oninput=()=>input.setCustomValidity('');
      input.onchange=()=>{try{const value=limitValue(input.value,key);input.setCustomValidity('');save(limitClasses(classes,key,value));}catch(e){input.setCustomValidity(e.message);input.reportValidity();}};
      I.field(limits,label,input);
      const reset=I.button('Reset '+label.toLowerCase(),()=>save(limitClasses(classes,key,null)));
      const prefix=key.replace('width','w').replace('height','h')+'-';
      reset.disabled=!classes.split(/\s+/).some(t=>t.replace(/^!|!$/g,'').startsWith(prefix));limits.append(reset);
    }
    I.note(limits,'Use px, %, rem or other CSS units. Reset removes this scope’s override. Minimums take precedence over smaller maximums.');
    sec.append(limits);
    return sec;
  }
  const api={gapValue,gapClasses,layoutAxes,modeClasses,sizeClasses,spanClasses,spanValue,limitValue,limitClasses,ownLimit,mount};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayout=api;
})(typeof window==='object'?window:globalThis);
