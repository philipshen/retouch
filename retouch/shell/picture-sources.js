(function(root){
 'use strict';
 function mount(info,onSave,{open=false,onToggle=()=>{}}={}){
  const I=root.RetouchInspector,details=document.createElement('details'),summary=document.createElement('summary');details.className='advanced';details.open=open;details.ontoggle=()=>{if(details.isConnected)onToggle(details.open);};summary.textContent='Artwork by screen';details.append(summary);
  const box=document.createElement('div');box.className='picture-sources';details.append(box);I.note(box,'The first matching source supplies the image. New sources are tried first.');
  const error=I.note(box,'','refused');error.hidden=true;error.setAttribute('role','alert');
  const run=async(button,change)=>{error.hidden=true;button.disabled=true;try{await onSave(change);}catch(reason){error.textContent=reason.message;error.hidden=false;}finally{button.disabled=false;}};
  const sources=info.responsiveImage.sources.filter(source=>source.index>=0);
  for(const source of sources){const row=document.createElement('div');row.className='picture-source-row';const title=document.createElement('span');title.textContent='Source '+(source.index+1)+' · '+(source.media||'All screens');title.title=title.textContent;row.append(title);
   for(const [label,action,destinationIndex,symbol,disabled]of [['Move source earlier','move',source.index-1,'↑',source.index===0],['Move source later','move',source.index+1,'↓',source.index===sources.length-1],['Remove picture source','remove',null,'×',false]]){const button=I.button(symbol,()=>run(button,{action,sourceIndex:source.index,destinationIndex}));button.setAttribute('aria-label',label+' '+(source.index+1));button.title=label;button.disabled=disabled;row.append(button);}box.append(row);
  }
  const heading=document.createElement('h4');heading.textContent='Add artwork';box.append(heading);
  const input=(label,title,value,kind='text')=>{const field=document.createElement('input');field.type=kind;field.value=value;if(kind==='number'){field.min='0';field.max='100000';field.step='any';}else field.maxLength=4096;I.field(box,label,field).parentElement.querySelector('span').textContent=title;return field;};
  const path=input('Artwork image path','Image path','');path.placeholder='/images/phone.svg';
  const range=I.select(box,'Artwork screen range',[['upTo','Up to width'],['from','From width'],['between','Between widths'],['all','All widths'],['custom','Custom condition']],'upTo',update);range.parentElement.querySelector('span').textContent='Screen range';
  const min=input('Artwork minimum width (px)','Min width',0,'number'),max=input('Artwork maximum width (px)','Max width',600,'number'),custom=input('Artwork media condition','Condition','');
  function update(){min.parentElement.hidden=!['from','between'].includes(range.value);max.parentElement.hidden=!['upTo','between'].includes(range.value);custom.parentElement.hidden=range.value!=='custom';}update();
  const add=I.button('Add picture source',()=>{let media;try{media=root.RetouchResponsiveImageSource.condition(range.value,min.value,max.value,custom.value);}catch(reason){error.textContent=reason.message;error.hidden=false;return;}return run(add,{action:'add',src:path.value.trim(),media});});box.append(add);return details;
 }
 root.RetouchPictureSources={mount};
})(typeof globalThis!=='undefined'?globalThis:this);
