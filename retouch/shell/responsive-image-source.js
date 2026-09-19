(function(root){
 'use strict';
 const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
 const px='(\\d+(?:\\.\\d+)?|\\.\\d+)';
 function range(media){
  if(!media?.trim())return {kind:'all'};
  const one=new RegExp('^\\(\\s*(min|max)-width\\s*:\\s*'+px+'px\\s*\\)$','i').exec(media.trim());
  if(one)return {kind:one[1].toLowerCase()==='min'?'from':'upTo',value:Number(one[2])};
  const both=new RegExp('^\\(\\s*min-width\\s*:\\s*'+px+'px\\s*\\)\\s+and\\s+\\(\\s*max-width\\s*:\\s*'+px+'px\\s*\\)$','i').exec(media.trim());
  if(both)return {kind:'between',min:Number(both[1]),max:Number(both[2])};
  return {kind:'custom',value:media};
 }
 function condition(kind,min,max,custom){
  const width=value=>{if(!['string','number'].includes(typeof value)||typeof value==='string'&&!value.trim()||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>100000)throw Error('Enter a screen width from 0 to 100,000 pixels.');return Number(value);};
  if(kind==='all')return null;
  if(kind==='custom')return custom.trim()||null;
  if(kind==='from')return '(min-width: '+width(min)+'px)';
  if(kind==='upTo')return '(max-width: '+width(max)+'px)';
  if(kind==='between'){const low=width(min),high=width(max);if(low>high)throw Error('Minimum screen width must not exceed maximum screen width.');return '(min-width: '+low+'px) and (max-width: '+high+'px)';}
  throw Error('Choose a screen range.');
 }
 function mount(source,onSave,{open=false,onToggle=()=>{}}={}){
  const box=document.createElement('div'),details=document.createElement('details'),summary=document.createElement('summary');details.className='advanced';details.open=open;details.ontoggle=()=>{if(details.isConnected)onToggle(details.open);};summary.textContent='Source settings';details.append(summary);box.append(details);
  const controls=document.createElement('div');controls.className='responsive-image-source';details.append(controls);
  I.note(controls,source.index<0?'Sizing applies to the image fallback and its width candidates.':'These settings apply to every candidate in Source '+(source.index+1)+'. Earlier matching sources take priority.');
  let kind,min,max,custom,mediaDirty=false;
  const error=I.note(controls,'','refused');error.hidden=true;error.setAttribute('role','alert');
  if(source.index>=0){
   const state=range(source.media),ranges=document.createElement('div');controls.append(ranges);
   kind=I.select(ranges,'Screen range',[['all','All widths'],['upTo','Up to width'],['from','From width'],['between','Between widths'],['custom','Custom condition']],state.kind,()=>{mediaDirty=true;update();});
   const number=(label,value)=>{const input=document.createElement('input');input.type='number';input.min='0';input.max='100000';input.step='any';input.value=value;input.oninput=()=>{mediaDirty=true;};return I.field(ranges,label,input);};
   min=number('Minimum width (px)',state.kind==='from'?state.value:state.min??0);max=number('Maximum width (px)',state.kind==='upTo'?state.value:state.max??600);
   custom=document.createElement('input');custom.type='text';custom.maxLength=4096;custom.value=source.media||'';custom.placeholder='(orientation: landscape)';custom.oninput=()=>{mediaDirty=true;};I.field(ranges,'Media condition',custom);
   function update(){min.parentElement.hidden=!['from','between'].includes(kind.value);max.parentElement.hidden=!['upTo','between'].includes(kind.value);custom.parentElement.hidden=kind.value!=='custom';error.hidden=true;}
   update();
  }
  const field=(label,value,placeholder)=>{const input=document.createElement('input');input.type='text';input.maxLength=4096;input.value=value||'';input.placeholder=placeholder;I.field(controls,label,input);return input;};
  const sizes=field('Display sizes',source.sizes,'100vw'),type=source.index>=0?field('Image format',source.type,'Any supported format'):null;
  I.note(controls,'Display sizes guide width-based image selection, for example (max-width: 600px) 100vw, 50vw. They do not resize the frame.');
  const save=I.button('Apply source settings',async()=>{
   error.hidden=true;
   try{
    const changes={},read=input=>input.value.trim()||null;
    if(source.index>=0&&mediaDirty){const media=condition(kind.value,min.value,max.value,custom.value);if(media!==source.media)changes.media=media;}
    for(const [name,input]of [['sizes',sizes],['type',type]])if(input&&input.value!==(source[name]||''))changes[name]=read(input);
    if(!Object.keys(changes).length)return;
    save.disabled=true;await onSave(changes);
   }catch(reason){error.textContent=reason.message;error.hidden=false;}finally{save.disabled=false;}
  });controls.append(save);return box;
 }
 const api={range,condition,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchResponsiveImageSource=api;
})(typeof globalThis!=='undefined'?globalThis:this);
