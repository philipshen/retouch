(function(root){
 'use strict';
 let expanded=false,preferredStyle='';
 const properties=['font-family','font-size','font-weight','font-style','font-optical-sizing','font-variation-settings','font-variant-numeric','line-height','letter-spacing','text-align','text-decoration-line','text-transform'];
 function mount(parent,element,options={}){
  const I=root.RetouchInspector,details=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent='Saved text styles';details.append(summary);parent.append(details);
  const body=document.createElement('div');details.append(body);let library=null,busy=false,loaded=false,selected=preferredStyle;
  const status=I.note(body,'');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const controls=document.createElement('fieldset');controls.style.cssText='border:0;padding:0;margin:0;min-width:0';body.append(controls);
  async function request(operation){
   if(operation)return root.RetouchTextStyleRequest(operation);
   const response=await fetch('/rt/__api/text-styles',{method:operation?'POST':'GET',signal:AbortSignal.timeout(15000),headers:{'x-retouch-token':root.__RT_TOKEN,'content-type':'application/json'},...(operation?{body:JSON.stringify(operation)}:{})});
   const result=await response.json();if(!response.ok||!result.ok)throw Error(result.reason||result.error||'Could not load text styles.');return result;
  }
  async function run(action,message){
   if(busy)return;busy=true;controls.disabled=true;status.textContent='Working…';
   try{await action();if(!details.isConnected)return;render();status.textContent=message;}
   catch(error){if(details.isConnected)status.textContent=error.message;}
   finally{busy=false;controls.disabled=false;}
  }
  function load(){return run(async()=>{library=await request();loaded=true;},'');}
  function capture(){
   if(!element.isConnected)throw Error('Select the layer again before saving its typography.');
   const css=element.ownerDocument.defaultView.getComputedStyle(element),values={};
   for(const property of properties){const value=css.getPropertyValue(property).trim();if(!root.RetouchHTMLCSSValues.valid(property,value))throw Error('This layer uses an unsupported '+property+' value: '+value);values[property]=value;}
   return values;
  }
  function render(){
   controls.replaceChildren();
   const refresh=I.button('Reload text styles',load);controls.append(refresh);if(!library)return;
   const transfer=document.createElement('details'),transferTitle=document.createElement('summary');transferTitle.textContent='Import / export styles';transfer.append(transferTitle);controls.append(transfer);
   I.note(transfer,'Share a text-style JSON library between projects. Import adds new styles and keeps existing styles unchanged. Fonts must be available in the destination project.');
   const exportButton=I.button('Export text styles',()=>run(async()=>{
    library=await request();const text=JSON.stringify({version:1,styles:library.styles},null,2)+'\n';
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='retouch-text-styles.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   },'Text styles exported.'));transfer.append(exportButton);
   const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','Text style library file');
   transfer.append(I.button('Import text styles',()=>file.click()),file);
   file.onchange=()=>{const chosen=file.files[0];file.value='';if(!chosen)return;run(async()=>{
    if(chosen.size>512*1024)throw Error('Text style files must be 512 KB or smaller.');
    let incoming;try{incoming=JSON.parse(await chosen.text());}catch{throw Error('Choose a valid text-style JSON library.');}
    if(!details.isConnected)throw Error('Select the layer again before importing.');
    library=await request({type:'import',revision:library.revision,library:incoming});
   },'Import complete. Existing styles were preserved.');};
   const picker=I.select(controls,'Saved text style',[['','Choose a saved style…'],...library.styles.map(style=>[style.id,style.name])],selected,value=>{selected=value;preferredStyle=value;render();});
   picker.disabled=!library.styles.length;
   if(!library.styles.length)I.note(controls,options.selection?'No saved styles yet. Import a library or select one layer to save its typography.':'No saved styles yet. Save this layer’s typography to start your library.');
   const style=library.styles.find(style=>style.id===selected);
   if(options.link){
    const linkedStyle=library.styles.find(item=>item.id===options.link.id),overrides=options.overrides||[];
    I.note(controls,'Linked style: '+(linkedStyle?.name||'Unavailable style'));
    if(options.overrides)I.note(controls,overrides.length?overrides.length+' local '+(overrides.length===1?'override':'overrides')+' in this screen scope.':'No local overrides in this screen scope.');
    if(options.reset){const reset=I.button('Reset text style overrides',()=>run(()=>options.reset(options.link.id,library.revision),'Text style overrides reset.'));reset.disabled=!linkedStyle||!overrides.length;controls.append(reset);}
    controls.append(I.button('Detach text style',()=>run(()=>options.detach(),'Text style detached.')));
   }
   if(!options.link&&options.inherited){
    const inheritedStyle=library.styles.find(item=>item.id===options.inherited.link.id);
    I.note(controls,'Inherited style: '+(inheritedStyle?.name||'Unavailable style')+' · '+options.inherited.label);
    I.note(controls,'Local typography can override this inherited style. Applying it here creates a link for this screen scope and larger, leaving smaller screens unchanged.');
    if(options.apply){const applyHere=I.button('Apply inherited style at this scope',()=>run(()=>options.apply(options.inherited.link.id,library.revision),'Text style applied.'));applyHere.disabled=!inheritedStyle;controls.append(applyHere);}
   }
   const name=document.createElement('input');name.type='text';name.maxLength=80;name.value=style?.name||'';name.placeholder='Heading, Body, Caption…';I.field(controls,'Text style name',name);
   function label(){if(!name.value.trim()){name.setCustomValidity('Give the text style a name.');name.reportValidity();return null;}return name.value.trim();}
   name.oninput=()=>name.setCustomValidity('');
   if(!options.selection)controls.append(I.button('Save current typography',()=>{const title=label();if(!title)return;run(async()=>{const values=capture();library=await request({type:'create',revision:library.revision,name:title,properties:values});selected=library.id;preferredStyle=selected;},'Text style saved.');}));
   if(style){
    if(options.apply)controls.append(I.button('Apply text style',()=>run(()=>options.apply(style.id,library.revision),'Text style applied.')));
    if(options.update){controls.append(I.button('Update style from this layer',()=>run(()=>options.update(style.id,library.revision,style.name,capture()),'Text style updated.')));I.note(controls,'Updates linked layers across project source files. Local overrides are preserved.');}
    const propertiesDetails=document.createElement('details'),propertiesTitle=document.createElement('summary');propertiesTitle.textContent='Style properties';propertiesDetails.append(propertiesTitle);const labels=['Font family','Font size','Font weight','Font style','Optical sizing','Variable font axes','Numeric styles','Line height','Letter spacing','Text alignment','Text decoration','Letter case'];const preview=document.createElement('dl');preview.className='text-style-properties';for(const [property,value]of Object.entries(style.properties)){const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=labels[properties.indexOf(property)];description.textContent=value;preview.append(term,description);}propertiesDetails.append(preview);controls.append(propertiesDetails);
    controls.append(I.button('Rename text style',()=>{const title=label();if(!title)return;run(async()=>{library=await request({type:'update',revision:library.revision,id:style.id,name:title,properties:style.properties});},'Text style renamed.');}));
    const remove=I.button('Delete text style',()=>{
     const confirm=I.button('Confirm delete '+style.name,()=>run(async()=>{library=await request({type:'delete',revision:library.revision,id:style.id});selected='';preferredStyle='';},'Text style deleted.'));
     const cancel=I.button('Cancel deletion',()=>render());remove.replaceWith(confirm,cancel);confirm.focus();
    });controls.append(remove);
   }
   I.note(controls,options.selection?'Applies to all '+options.selection+' selected layers at the selected screen scope. Undo restores the whole selection.':options.apply?(options.update?'Apply at the selected screen scope. Detach keeps the current appearance.':'Apply at the selected screen scope. Library updates do not propagate in this renderer yet.'):'Captures typography at the current screen size. Style application is not available for this renderer yet.');
  }
  render();details.ontoggle=()=>{if(!details.isConnected)return;expanded=details.open;if(details.open&&!loaded)load();};details.open=expanded;
 }
 root.RetouchTextStyles={mount};
})(window);
