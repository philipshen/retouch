(function(root){
  'use strict';
  const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
  const display=t=>/^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root)$/.test(t);
  function modeClasses(classes,mode,inherited='') {
    const additions={flow:'block',row:'flex flex-row',column:'flex flex-col','row-reverse':'flex flex-row-reverse','column-reverse':'flex flex-col-reverse',grid:'grid'};
    if(!Object.hasOwn(additions,mode))throw Error('Unknown layout');
    const matches=t=>display(t)||/^flex-(row|col)(-reverse)?$|^\[(?:display|flex-direction):/.test(t);
    let addition=additions[mode];
    if([...classes.split(/\s+/),...inherited.split(/\s+/)].some(token=>/^!|!$/.test(token)&&(matches(I.base(token)||'')||/^\[flex-flow:/.test(I.base(token)||''))))addition=addition.split(' ').map(token=>'!'+token).join(' ');
    return I.replace(classes,matches,addition);
  }
  function arrangementClasses(classes,property,value,inherited=''){
    const options={flow:['row','col','row-dense','col-dense'],wrap:['nowrap','wrap','wrap-reverse'],align:['start','center','end','stretch','baseline'],justify:['start','center','end','between','around','evenly']};
    if(['columns','rows'].includes(property)?!Number.isInteger(value)||value<1||value>24:!options[property]?.includes(value))throw Error('Unknown arrangement value');
    const rules={
      flow:{match:t=>/^grid-flow-|^\[grid-auto-flow:/.test(t),shorthand:t=>/^\[grid:/.test(t),addition:'grid-flow-'+value},
      wrap:{match:t=>/^flex-(wrap|wrap-reverse|nowrap)$|^\[flex-wrap:/.test(t),shorthand:t=>/^\[flex-flow:/.test(t),addition:'flex-'+value},
      align:{match:t=>/^items-|^\[align-items:/.test(t),shorthand:t=>/^place-items-|^\[place-items:/.test(t),addition:'items-'+value},
      justify:{match:t=>/^justify-(?!items-|self-)|^\[justify-content:/.test(t),shorthand:t=>/^place-content-|^\[place-content:/.test(t),addition:'justify-'+value},
      columns:{match:t=>/^grid-cols-|^\[grid-template-columns:/.test(t),shorthand:t=>/^\[grid(?:-template)?:/.test(t),addition:'grid-cols-'+value},
      rows:{match:t=>/^grid-rows-|^\[grid-template-rows:/.test(t),shorthand:t=>/^\[grid(?:-template)?:/.test(t),addition:'grid-rows-'+value}
    };
    const rule=rules[property];let addition=rule.addition;
    if([...classes.split(/\s+/),...inherited.split(/\s+/)].some(token=>/^!|!$/.test(token)&&(rule.match(I.base(token)||'')||rule.shorthand(I.base(token)||''))))addition='!'+addition;
    return I.replace(classes,rule.match,addition);
  }
  function alignmentClasses(classes,x,y,context={},inherited=''){
    if(![0,1,2].includes(x)||![0,1,2].includes(y))throw Error('Choose an alignment point.');
    const values=root.RetouchHTMLCSSValues||require('./html-css-values.js');
    const changes=values.flexAlignment(x,y,context);
    for(const [property,value] of Object.entries(changes)){
      const matches=token=>token.startsWith('['+property+':')||(property==='justify-content'?/^justify-(?!items-|self-)/.test(token):property==='align-items'?/^items-/.test(token):/^content-(normal|center|start|end|between|around|evenly|baseline|stretch)$/.test(token));
      const shorthand=token=>property==='align-items'?/^place-items-|^\[place-items:/.test(token):/^place-content-|^\[place-content:/.test(token);
      let addition='['+property+':'+value+']';
      if([...classes.split(/\s+/),...inherited.split(/\s+/)].some(token=>/^!|!$/.test(token)&&(matches(I.base(token)||'')||shorthand(I.base(token)||''))))addition='!'+addition;
      classes=I.replace(classes,matches,addition);
    }
    return classes;
  }
  function clipClasses(classes,value,inherited=''){
    if(value!==null&&typeof value!=='boolean')throw Error('Choose whether to clip content.');
    const matches=t=>/^overflow-(?:(?:x|y)-)?(?:auto|hidden|clip|visible|scroll)$|^\[overflow(?:-[xy])?:/.test(t);
    let addition=value===null?'':value?'overflow-clip':'overflow-visible';
    if(addition&&inherited.split(/\s+/).some(token=>/^!|!$/.test(token)&&matches(I.base(token)||'')))addition='!'+addition;
    return I.replace(classes,matches,addition);
  }
  function gridTrackCount(value){
    return String(value||'').replace(/\[[^\]]*\]/g,' ').trim().split(/\s+/).filter(t=>t&&!['none','subgrid','masonry'].includes(t)).length;
  }
  function paddingClasses(classes,side,value,inherited=''){
    const short={top:'t',right:'r',bottom:'b',left:'l'}[side];
    if(!short)throw Error('Choose a padding edge.');
    if(value!==null&&(!Number.isFinite(value)||value<0||value>10000))throw Error('Use padding from 0 to 10000 pixels.');
    const axis=side==='top'||side==='bottom'?'y':'x';
    const matches=t=>t.startsWith('p'+short+'-')||t.startsWith('[padding-'+side+':');
    let addition=value===null?'':'p'+short+'-['+value+'px]';
    if(addition&&[...classes.split(/\s+/),...inherited.split(/\s+/)].some(token=>/^!|!$/.test(token)&&(matches(I.base(token)||'')||new RegExp('^p(?:'+axis+')?-|^\\[padding:').test(I.base(token)||''))))addition='!'+addition;
    return I.replace(classes,matches,addition);
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
  function gapClasses(classes,axis,value,writingMode,inherited=''){
    if(!['width','height'].includes(axis))throw Error('Choose a horizontal or vertical gap.');
    if(value!==null)value=gapValue(value);
    const inline=layoutAxes({writingMode}).inline===axis,kind=inline?'x':'y',property=inline?'column-gap':'row-gap';
    let addition=value===null?'':'gap-'+kind+'-['+value+']';
    const matches=token=>token.startsWith('gap-'+kind+'-')||token.startsWith('['+property+':');
    if(addition&&[...classes.split(/\s+/),...inherited.split(/\s+/)].some(token=>/^!|!$/.test(token)&&(/^(?:gap-(?![xy]-)|\[gap:)/.test(I.base(token)||'')||matches(I.base(token)||''))))addition='!'+addition;
    return I.replace(classes,matches,addition);
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
    if([...classes.split(/\s+/),...(parent.inheritedClasses||'').split(/\s+/)].some(token=>(I.base(token)?.startsWith('size-')||match(I.base(token)||'')||stretch&&/^place-self-|^\[place-self:/.test(I.base(token)||''))&&/^!|!$/.test(token)))addition=addition.split(' ').map(token=>'!'+token).join(' ');
    return I.replace(classes,match,addition);
  }
  function spanClasses(classes,axis,value,inherited='') {
    if(!['column','row'].includes(axis))throw Error('Unknown grid axis');
    if(value!==null&&!['auto','full'].includes(value)&&!(Number.isInteger(value)&&value>=1&&value<=24))throw Error('Choose a span from 1 to 24');
    const prefix=axis==='column'?'col':'row';
    const placement=new RegExp('^-?'+prefix+'-(?:auto|span-(?:full|\\d+|\\[.+\\])|(?:start|end)-(?:auto|\\d+|\\[.+\\])|\\d+|\\[.+\\])$');
    const matches=t=>placement.test(t)||t.startsWith('[grid-'+axis+':')||t.startsWith('[grid-'+axis+'-start:')||t.startsWith('[grid-'+axis+'-end:');
    if(value===null)return I.replace(classes,matches,'');
    let addition=prefix+'-'+(typeof value==='number'?'span-'+value:value==='full'?'span-full':'auto');
    if([...classes.split(/\s+/),...inherited.split(/\s+/)].some(t=>/^!|!$/.test(t)&&(matches(I.base(t)||'')||(I.base(t)||'').startsWith('[grid-area:'))))addition='!'+addition;
    return I.replace(classes,matches,addition);
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
  function limitClasses(classes,key,value,inherited='') {
    if(!limitKeys.includes(key))throw Error('Unknown size limit');
    const prefix=key.replace('width','w').replace('height','h')+'-';
    const matches=t=>t.startsWith(prefix)||t.startsWith('['+key+':');
    let addition=value===null?'':prefix+'['+limitValue(value,key)+']';
    if(addition&&inherited.split(/\s+/).some(t=>/^!|!$/.test(t)&&matches(I.base(t)||'')))addition='!'+addition;
    return I.replace(classes,matches,addition);
  }
  function ownLimit(classes,key) {
    if(!limitKeys.includes(key))throw Error('Unknown size limit');
    const prefix=key.replace('width','w').replace('height','h')+'-';
    const tokens=classes.split(/\s+/).filter(t=>{const base=I.base(t);return base!==null&&(base.startsWith(prefix)||base.startsWith('['+key+':'));});
    const token=I.base(tokens.find(t=>/^!|!$/.test(t))||tokens[0]||'');
    if(token.startsWith('['+key+':'))return token.slice(key.length+2,-1).replace(/_/g,' ');
    const value=token.slice(prefix.length);
    return value.startsWith('[')&&value.endsWith(']')?value.slice(1,-1).replace(/_/g,' '):null;
  }
  let limitsOpen=false;
  function mount(info,el,save) {
    const sec=I.section('Layout');if(!el)return sec;
    if(info.classNameDynamic){I.note(sec,info.classNameReason||'This layout has computed classes.','refused');return sec;}
    const css=el.ownerDocument.defaultView.getComputedStyle(el);
    const parent=el.parentElement&&el.ownerDocument.defaultView.getComputedStyle(el.parentElement);
    const classes=info.className||'',inherited=info.styleScope?info.anchorInheritedClasses||'':'';
    const mode=/grid/.test(css.display)?'grid':/flex/.test(css.display)?css.flexDirection:'flow';
    const verticalInline=layoutAxes({writingMode:css.writingMode}).inline==='height',rowLabel=verticalInline?'Vertical':'Horizontal',columnLabel=verticalInline?'Horizontal':'Vertical';
    const modeSelect=I.select(sec,'Arrange children',[['flow','Normal flow'],['row',rowLabel],['column',columnLabel],['row-reverse',rowLabel+' · reverse'],['column-reverse',columnLabel+' · reverse'],['grid','Grid']],mode,value=>save(modeClasses(classes,value,info.styleScope?info.anchorInheritedClasses||'':'')));
    modeSelect.dataset.inlineAxis=verticalInline?'vertical':'horizontal';
    function numeric(label,value,min,max,change) {
      const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='any';
      input.value=Number.isFinite(value)?Math.round(value*100)/100:0;
      input.oninput=()=>input.setCustomValidity('');
      input.onchange=()=>{if(input.value!==''&&input.checkValidity())try{change(Number(input.value));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
      return I.field(sec,label,input);
    }
    if(mode!=='flow') {
      if(mode==='grid') {
        for(const [label,property,computed] of [['Columns','columns',css.gridTemplateColumns],['Rows','rows',css.gridTemplateRows]]){
          const field=numeric(label,gridTrackCount(computed)||1,1,24,v=>save(arrangementClasses(classes,property,v,inherited)));field.step='1';
        }
        I.note(sec,'Counts create equal tracks. Content may create additional implicit tracks.');
        const flow=css.gridAutoFlow==='dense'?'row-dense':css.gridAutoFlow.replace('column','col').replace(/\s+/g,'-');
        I.select(sec,'Place grid items',[['row','Across rows'],['col','Down columns'],['row-dense','Across rows · fill gaps'],['col-dense','Down columns · fill gaps']],flow,v=>save(arrangementClasses(classes,'flow',v,inherited)));
        I.note(sec,'Fill gaps can move later items into earlier empty spaces.');
      } else {
        I.select(sec,'Wrap children',[['nowrap','No wrap'],['wrap','Wrap'],['wrap-reverse','Wrap · reverse']],css.flexWrap,v=>save(arrangementClasses(classes,'wrap',v,inherited)));
      }
      for(const [prop,label,axis] of [['columnGap',verticalInline?'Vertical gap':'Horizontal gap',verticalInline?'height':'width'],['rowGap',verticalInline?'Horizontal gap':'Vertical gap',verticalInline?'width':'height']]) {
        const input=document.createElement('input');input.type='text';input.value=css[prop].replace(/px$/,'');input.placeholder='0';input.title='Pixels by default; also accepts %, rem, em, vw, vh, ch or normal';
        input.oninput=()=>input.setCustomValidity('');
        input.onchange=()=>{try{save(gapClasses(classes,axis,input.value,css.writingMode,info.styleScope?info.anchorInheritedClasses||'':''));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
        I.field(sec,label,input);
        const reset=I.button('Reset '+label.toLowerCase(),()=>save(gapClasses(classes,axis,null,css.writingMode)));
        reset.disabled=gapClasses(classes,axis,null,css.writingMode)===classes;sec.append(reset);
      }
      if(mode!=='grid'){
        const values=root.RetouchHTMLCSSValues||require('./html-css-values.js');
        const picker=document.createElement('div');picker.className='layout-alignment';picker.setAttribute('role','group');picker.setAttribute('aria-label','Align children');
        for(let y=0;y<3;y++)for(let x=0;x<3;x++){
          const changes=values.flexAlignment(x,y,css),label='Align children '+['top','middle','bottom'][y]+' '+['left','center','right'][x];
          const button=I.button('•',()=>save(alignmentClasses(classes,x,y,css,inherited)));button.setAttribute('aria-label',label);button.title=label;
          button.setAttribute('aria-pressed',String(Object.entries(changes).every(([property,value])=>css.getPropertyValue(property)===value)));
          if(Object.keys(changes).some(property=>el.style.getPropertyValue(property)))button.disabled=true;
          picker.append(button);
        }
        sec.append(picker);
      }
      I.select(sec,'Align children',[['start','Start'],['center','Center'],['end','End'],['stretch','Stretch'],['baseline','Baseline']],(css.alignItems==='normal'?'stretch':css.alignItems.replace('flex-','')),v=>save(arrangementClasses(classes,'align',v,inherited)));
      const justify=css.justifyContent==='normal'?'start':css.justifyContent.replace('flex-','').replace('space-','');
      I.select(sec,'Distribute children',[['start','Start'],['center','Center'],['end','End'],['between','Space between'],['around','Space around'],['evenly','Space evenly']],justify,v=>save(arrangementClasses(classes,'justify',v,inherited)));
    }
    if(parent&&/grid/.test(parent.display)&&!['absolute','fixed'].includes(css.position)) {
      const counts=Array.from({length:24},(_,i)=>[String(i+1),String(i+1)]);
      for(const axis of ['column','row']) {
        const prop=axis==='column'?'gridColumn':'gridRow';
        I.select(sec,axis==='column'?'Span columns':'Span rows',[['','Custom placement'],['auto','Auto'],['full',axis==='column'?'All columns':'All rows'],...counts],spanValue(css[prop+'Start'],css[prop+'End']),v=>{if(v)save(spanClasses(classes,axis,/^\d+$/.test(v)?Number(v):v,inherited));});
        const reset=I.button('Reset '+axis+' placement',()=>save(spanClasses(classes,axis,null)));
        reset.disabled=spanClasses(classes,axis,null)===classes;sec.append(reset);
      }
      I.note(sec,'Choosing a span replaces line placement on that axis. Reset removes this scope’s axis override, retaining any shared grid area.');
    }
    for(const side of ['Top','Right','Bottom','Left']) {
      const edge=side.toLowerCase();
      numeric('Padding '+edge,parseFloat(css['padding'+side])||0,0,10000,v=>save(paddingClasses(classes,edge,v,inherited)));
      const reset=I.button('Reset padding '+edge,()=>save(paddingClasses(classes,edge,null)));
      reset.disabled=paddingClasses(classes,edge,null)===classes;sec.append(reset);
    }
    const geometry=root.RetouchReactSelection||require('./react-selection.js');
    const dims=Object.fromEntries(['width','height'].map(axis=>{const value=geometry.dimensionSize(css,axis);return [axis,Number.isFinite(value)?value:el[axis==='width'?'offsetWidth':'offsetHeight']];}));
    for(const axis of ['width','height']) {
      const title=axis[0].toUpperCase()+axis.slice(1),dim=axis==='width'?'w':'h';
      const sizingTokens=classes.split(/\s+/).filter(token=>I.base(token)!==null),ownToken=sizingTokens.find(token=>/^!|!$/.test(token)&&I.base(token).startsWith(dim+'-'))||sizingTokens.find(token=>/^!|!$/.test(token)&&I.base(token).startsWith('size-'))||sizingTokens.find(token=>I.base(token).startsWith(dim+'-'))||sizingTokens.find(token=>I.base(token).startsWith('size-'));
      const own=ownToken&&I.base(ownToken).replace(/^size-/,dim+'-');
      const context={display:parent?.display,direction:parent?.flexDirection,writingMode:parent?.writingMode,inheritedClasses:info.styleScope?info.anchorInheritedClasses||'':''},axes=layoutAxes(context);
      const stretchFill=own===dim+'-auto'&&parent&&(/grid/.test(parent.display)?axis===axes.inline?css.justifySelf==='stretch':css.alignSelf==='stretch':/flex/.test(parent.display)&&axis!==axes.main&&css.alignSelf==='stretch');
      const sizing=own===dim+'-fit'?'hug':own===dim+'-full'||stretchFill||/\bflex-1\b/.test(classes)&&parent&&/flex/.test(parent.display)&&axis===axes.main?'fill':own&&own!==dim+'-auto'?'fixed':'';
      const size=(mode,value)=>save(sizeClasses(classes,axis,mode,mode==='fixed'?geometry.dimensionValue(css,axis,value):value,context));
      I.select(sec,title+' behavior',[['','Inherited / auto'],['fixed','Fixed'],['hug','Hug content'],['fill','Fill available']],sizing,v=>size(v||'reset',Math.round(dims[axis]*100)/100));
      numeric(title+' (px)',dims[axis],0,100000,v=>size('fixed',v));
    }
    const clipping=document.createElement('input');clipping.type='checkbox';
    clipping.checked=['hidden','clip'].includes(css.overflowX)&&['hidden','clip'].includes(css.overflowY);
    clipping.indeterminate=!clipping.checked&&!(css.overflowX==='visible'&&css.overflowY==='visible');
    clipping.onchange=()=>save(clipClasses(classes,clipping.checked,inherited));I.field(sec,'Clip content',clipping);
    const resetClipping=I.button('Reset clipping',()=>save(clipClasses(classes,null)));resetClipping.disabled=clipClasses(classes,null)===classes;sec.append(resetClipping);
    if(['overflow','overflow-x','overflow-y'].some(property=>el.style.getPropertyValue(property))){clipping.disabled=true;resetClipping.disabled=true;I.note(sec,'Inline overflow controls clipping on this layer.');}
    I.note(sec,'Pixel sizes include padding and borders, before transforms.');
    const limits=document.createElement('details');limits.className='advanced';limits.open=limitsOpen;
    limits.ontoggle=()=>{limitsOpen=limits.open;};
    const title=document.createElement('summary');title.textContent='Size limits';limits.append(title);
    for(const key of limitKeys) {
      const label=key.replace('min-','Minimum ').replace('max-','Maximum ');
      const input=document.createElement('input');input.type='text';input.value=ownLimit(classes,key)??css.getPropertyValue(key);input.placeholder=key.startsWith('min-')?'auto':'none';
      input.oninput=()=>input.setCustomValidity('');
      input.onchange=()=>{try{const value=limitValue(input.value,key);input.setCustomValidity('');save(limitClasses(classes,key,value,inherited));}catch(e){input.setCustomValidity(e.message);input.reportValidity();}};
      I.field(limits,label,input);
      const reset=I.button('Reset '+label.toLowerCase(),()=>save(limitClasses(classes,key,null)));
      reset.disabled=limitClasses(classes,key,null)===classes;limits.append(reset);
    }
    I.note(limits,'Use px, %, rem or other CSS units. Reset removes this scope’s override. Minimums take precedence over smaller maximums.');
    sec.append(limits);
    return sec;
  }
  const api={alignmentClasses,clipClasses,gridTrackCount,paddingClasses,arrangementClasses,gapValue,gapClasses,layoutAxes,modeClasses,sizeClasses,spanClasses,spanValue,limitValue,limitClasses,ownLimit,mount};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayout=api;
})(typeof window==='object'?window:globalThis);
