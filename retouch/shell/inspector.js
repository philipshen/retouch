(function (root) {
  'use strict';
  let cornersExpanded=false,numericExpanded=false,variationExpanded=false,shadowStackExpanded=false;
  const tokens = value => (value || '').split(/\s+/).filter(Boolean);
  // Colons inside arbitrary CSS values are not variant separators.
  function base(token) {
    let depth = 0;
    for (const ch of token) {
      if (ch === '[' || ch === '(') depth++;
      if (ch === ']' || ch === ')') depth--;
      if (ch === ':' && depth === 0) return null;
    }
    return token.replace(/^!|!$/g, '');
  }
  function replace(classes, match, additions) {
    const old = tokens(classes);
    const important = old.some(t => base(t) !== null && match(base(t)) && (t.startsWith('!') || t.endsWith('!')));
    return old.filter(t => base(t) === null || !match(base(t)))
      .concat(tokens(additions).map(t => important && !/^!|!$/.test(t) ? '!' + t : t)).join(' ');
  }
  const round = n => Math.round(n * 100) / 100;
  const px = n => `${round(n)}px`;
  const positionToken = t => /^(static|relative|absolute|fixed|sticky)$/.test(t);
  const insetToken = t => /^-?(inset(?:-[xy])?|top|right|bottom|left|start|end)-/.test(t);
  function nearestAnchor(start, size, parentSize) {
    const end = parentSize - start - size;
    const center = Math.abs(start + size / 2 - parentSize / 2);
    if (center < Math.min(Math.abs(start), Math.abs(end))) return 'center';
    return Math.abs(start) <= Math.abs(end) ? 'start' : 'end';
  }
  function axisClasses(g, axis, anchor) {
    const horizontal = axis === 'x';
    const start = horizontal ? g.x : g.y, size = horizontal ? g.width : g.height;
    const parent = horizontal ? g.parentWidth : g.parentHeight;
    const a = horizontal ? 'left' : 'top', b = horizontal ? 'right' : 'bottom', dim = horizontal ? 'w' : 'h';
    if(anchor==='scale'){if(parent<=0)throw Error('Scale needs a container with a nonzero size.');const percent=n=>`${Math.round(n/parent*1000000)/10000}%`;return `${a}-[${percent(start)}] ${b}-auto ${dim}-[${percent(size)}]`;}
    if (anchor === 'stretch') return `${a}-[${px(start)}] ${b}-[${px(parent - start - size)}] ${dim}-auto`;
    if (anchor === 'end') return `${a}-auto ${b}-[${px(parent - start - size)}] ${dim}-[${px(size)}]`;
    if (anchor === 'center') {
      const delta = round(start - parent / 2);
      return `${a}-[calc(50%${delta < 0 ? '-' : '+'}${px(Math.abs(delta))})] ${b}-auto ${dim}-[${px(size)}]`;
    }
    return `${a}-[${px(start)}] ${b}-auto ${dim}-[${px(size)}]`;
  }
  function anchorClasses(classes,g,horizontal,vertical,fallback=''){
    const match=t=>positionToken(t)||insetToken(t)||/^(w|h|size)-/.test(t)||/^-?m(?:[trblxyse])?-/.test(t)||/^box-(border|content)$/.test(t);
    let additions=['absolute m-0 box-border',axisClasses(g,'x',horizontal),axisClasses(g,'y',vertical)].join(' ');
    if(tokens(fallback).some(t=>base(t)!==null&&match(base(t))&&(/^!|!$/.test(t))))additions=tokens(additions).map(t=>'!'+t).join(' ');
    return replace(classes,match,additions);
  }
  function geometry(el) {
    const d = el.ownerDocument, w = d.defaultView;
    for (let n = el; n && n !== d.documentElement; n = n.parentElement) {
      const s = w.getComputedStyle(n);
      if (s.transform !== 'none' || (s.rotate && s.rotate !== 'none') || (s.scale && s.scale !== 'none') || (s.translate && s.translate !== 'none') || (s.zoom && Number(s.zoom) !== 1)) {
        throw new Error('Anchor placement requires an element and ancestors without transforms or zoom.');
      }
    }
    const rect = el.getBoundingClientRect();
    const original = el.getAttribute('style');
    // Ask layout for the real containing block after switching to absolute.
    const alreadyAbsolute=w.getComputedStyle(el).position==='absolute';
    if(!alreadyAbsolute)el.style.setProperty('position', 'absolute', 'important');
    const parent = el.offsetParent;
    if(!alreadyAbsolute){if (original === null) el.removeAttribute('style'); else el.setAttribute('style', original);}
    const viewport = !parent || (parent === d.body && w.getComputedStyle(parent).position === 'static');
    const pr = viewport ? { left: -w.scrollX, top: -w.scrollY } : parent.getBoundingClientRect();
    return {
      x: rect.left - pr.left - (viewport ? 0 : parent.clientLeft) + (viewport ? 0 : parent.scrollLeft),
      y: rect.top - pr.top - (viewport ? 0 : parent.clientTop) + (viewport ? 0 : parent.scrollTop),
      width: rect.width, height: rect.height,
      parentWidth: viewport ? d.documentElement.clientWidth : parent.clientWidth,
      parentHeight: viewport ? w.innerHeight : parent.clientHeight,
      parentLabel: viewport ? 'Page viewport' : `<${parent.tagName.toLowerCase()}>${parent.id ? ' #' + parent.id : ''}`,
    };
  }
  const typeProperties = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variation-settings', 'font-optical-sizing', 'font-variant-numeric', 'line-height', 'letter-spacing', 'text-transform', 'text-decoration-line'];
  function catalog(d) {
    const result = new Map();
    function scan(rules) {
      for (const rule of rules) {
        if (rule.selectorText && rule.style && typeProperties.some(p => rule.style.getPropertyValue(p))) {
          for (const selector of rule.selectorText.split(',')) {
            const m = selector.trim().match(/^\.((?:\\.|[\w-])+)$/);
            if (!m) continue;
            const name = m[1].replace(/\\(.)/g, '$1');
            if (base(name) === null) continue;
            result.set(name, name);
          }
        }
        // Discover only unconditional classes. Never offer breakpoint variants.
        if (rule.cssRules && !rule.conditionText && rule.type !== 4) scan(rule.cssRules);
      }
    }
    for (const sheet of d.styleSheets) { try { scan(sheet.cssRules); } catch {} }
    return [...result.keys()].sort();
  }
  function section(title) {
    const sec = document.createElement('section'); sec.className = 'sec inspector-section';
    const h = document.createElement('h3'); h.textContent = title; sec.append(h); return sec;
  }
  function note(parent, text, className = 'hint') {
    const p = document.createElement('p'); p.className = className; p.textContent = text; parent.append(p); return p;
  }
  function button(text, action) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'control-button'; b.textContent = text; b.onclick = action; return b;
  }
  function gridAxisEdges(template,gap,available,alignment,reverse=false){
    const raw=String(template||'').replace(/\[[^\]]*\]/g,' ').trim().split(/\s+/);
    if(!raw.length||raw.length>64||!raw.every(value=>/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value)))return [];
    const tracks=raw.map(parseFloat),free=available-tracks.reduce((a,b)=>a+b,0)-gap*(tracks.length-1),safe=/^safe /.test(alignment);
    alignment=alignment.replace(/^(?:safe|unsafe) /,'');let offset=0,spacing=gap,extra=safe?Math.max(0,free):free;
    if(alignment==='center')offset=extra/2;
    else if(alignment==='end'||alignment==='flex-end'||alignment===(reverse?'left':'right'))offset=extra;
    else if(free>0&&alignment==='space-between'&&tracks.length>1)spacing+=free/(tracks.length-1);
    else if(free>0&&alignment==='space-around'){spacing+=free/tracks.length;offset=free/tracks.length/2;}
    else if(free>0&&alignment==='space-evenly'){spacing+=free/(tracks.length+1);offset=free/(tracks.length+1);}
    const edges=[];for(const track of tracks){edges.push(offset,offset+track);offset+=track+spacing;}
    return [...new Set(edges.map(value=>reverse?available-value:value))];
  }
  function gridGuideControl(parent){
    const input=document.createElement('input');input.type='checkbox';input.checked=!!root.RetouchGridGuidesEnabled;
    input.onchange=()=>{root.RetouchGridGuidesEnabled=input.checked;};field(parent,'Show grid guides',input);
  }
  function drawGridGuides(overlay,selected){
    if(!selected?.isConnected)return;
    const view=selected.ownerDocument.defaultView;let grid=selected,css=view.getComputedStyle(grid);
    if(!['grid','inline-grid'].includes(css.display)){grid=selected.parentElement;if(!grid)return;css=view.getComputedStyle(grid);}
    if(!['grid','inline-grid'].includes(css.display)||css.writingMode!=='horizontal-tb')return;
    // Axis-aligned geometry only: do not show misleading guides on rotated grids.
    for(let node=grid;node;node=node.parentElement){const style=view.getComputedStyle(node);if(!['none','0deg'].includes(style.rotate))return;if(style.transform!=='none'){const m=/^matrix\(([^)]+)\)$/.exec(style.transform);if(!m)return;const values=m[1].split(',').map(Number);if(values[1]||values[2]||values[0]<=0||values[3]<=0)return;}}
    const n=key=>parseFloat(css[key])||0,r=grid.getBoundingClientRect(),px=n('paddingLeft')+n('paddingRight'),py=n('paddingTop')+n('paddingBottom'),bx=n('borderLeftWidth')+n('borderRightWidth'),by=n('borderTopWidth')+n('borderBottomWidth');
    const width=n('width')+(css.boxSizing==='border-box'?0:px+bx),height=n('height')+(css.boxSizing==='border-box'?0:py+by);if(!width||!height)return;
    const sx=r.width/width,sy=r.height/height,w=width-px-bx,h=height-py-by,x=r.left+(n('borderLeftWidth')+n('paddingLeft')-grid.scrollLeft)*sx,y=r.top+(n('borderTopWidth')+n('paddingTop')-grid.scrollTop)*sy;
    const clip={left:0,top:0,right:view.innerWidth,bottom:view.innerHeight};
    for(let node=grid;node;node=node.parentElement){
      const style=view.getComputedStyle(node),bounds=node.getBoundingClientRect(),scaleX=node.offsetWidth?bounds.width/node.offsetWidth:1,scaleY=node.offsetHeight?bounds.height/node.offsetHeight:1;
      const left=bounds.left+node.clientLeft*scaleX,top=bounds.top+node.clientTop*scaleY,paint=/(?:paint|strict|content)/.test(style.contain);
      if(paint||style.overflowX!=='visible'){clip.left=Math.max(clip.left,left);clip.right=Math.min(clip.right,left+node.clientWidth*scaleX);}
      if(paint||style.overflowY!=='visible'){clip.top=Math.max(clip.top,top);clip.bottom=Math.min(clip.bottom,top+node.clientHeight*scaleY);}
    }
    if(clip.right<=clip.left||clip.bottom<=clip.top)return;
    const gap=(value,size)=>value.endsWith('%')?parseFloat(value)*size/100:parseFloat(value)||0;
    const axes=[['column',gridAxisEdges(css.gridTemplateColumns,gap(css.columnGap,w),w,css.justifyContent,css.direction==='rtl')],['row',gridAxisEdges(css.gridTemplateRows,gap(css.rowGap,h),h,css.alignContent)]];
    const left=x+Math.min(0,...axes[0][1])*sx,right=x+Math.max(w,...axes[0][1])*sx,top=y+Math.min(0,...axes[1][1])*sy,bottom=y+Math.max(h,...axes[1][1])*sy;
    for(const [axis,edges]of axes)for(const edge of edges){
      const vertical=axis==='column',position=vertical?x+edge*sx:y+edge*sy;
      if(position<(vertical?clip.left:clip.top)||position>(vertical?clip.right:clip.bottom))continue;
      const start=Math.max(vertical?top:left,vertical?clip.top:clip.left),end=Math.min(vertical?bottom:right,vertical?clip.bottom:clip.right);if(end<=start)continue;
      const line=document.createElement('div');line.className='grid-guide '+axis;line.setAttribute('aria-hidden','true');line.style.left=(vertical?position:start)+'px';line.style.top=(vertical?start:position)+'px';line.style.width=(vertical?0:end-start)+'px';line.style.height=(vertical?end-start:0)+'px';overlay.append(line);
    }
  }
  function gridPlacementSuggestions(template){
    const groups=[...String(template||'').matchAll(/\[([^\]]+)\]/g)].map(match=>match[1].trim().split(/\s+/).filter(name=>/^[A-Za-z_][\w-]*$/.test(name)&&!['auto','span','initial','inherit','unset','revert','revert-layer'].includes(name.toLowerCase()))).filter(names=>names.length);
    const values=['auto','1 / -1'];
    for(let i=0;i<groups.length&&values.length<50;i++){
      if(i+1<groups.length&&groups[i][0]!==groups[i+1][0])values.push(groups[i][0]+' / '+groups[i+1][0]);
      for(const name of groups[i])if(values.length<50)values.push(name+' / auto');
    }
    const tracks=String(template||'').replace(/\[[^\]]*\]/g,' ').trim().split(/\s+/);
    if(tracks.every(value=>/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value)))for(let i=1;i<=Math.min(24,tracks.length);i++)values.push(i+' / '+(i+1));
    return [...new Set(values)];
  }
  let gridSuggestionId=0;
  function suggestGridPlacement(input,template){
    const list=document.createElement('datalist');list.id='rt-grid-lines-'+(++gridSuggestionId);
    for(const value of gridPlacementSuggestions(template)){const option=document.createElement('option');option.value=value;list.append(option);}
    input.setAttribute('list',list.id);input.parentElement.append(list);
  }
  function field(parent, label, control) {
    const row = document.createElement('label'); row.className = 'inspector-field';
    const text = document.createElement('span'); text.textContent = label;
    if(['Opacity (%)','Shared Opacity (%)'].includes(label))control.title='On the canvas: keys 1–9 set 10%–90% opacity; 0 sets 100%. Type digits quickly for an exact percentage (25, 05, 00). Escape cancels. Typing here edits normally.';
    if(['Visibility','Shared Visibility','Visible layer'].includes(label))control.title='Command/Ctrl+Shift+H hides or shows the selection from the canvas.';
    control.setAttribute('aria-label', label); row.append(text, control); parent.append(row); return control;
  }
  function select(parent, label, choices, value, onChange) {
    const input = document.createElement('select');
    for (const [v, text] of choices) { const o = document.createElement('option'); o.value = v; o.textContent = text; input.append(o); }
    input.value = value; input.onchange = () => onChange(input.value); return field(parent, label, input);
  }
  function fieldDraft(input){
    const initial=input.value,change=input.onchange;
    input.onchange=event=>{if(input.value!==initial)change?.call(input,event);};
    input.title=(input.title?input.title+' ':'')+'Enter saves. Escape cancels.';
    input.addEventListener('keydown',event=>{
      if(event.isComposing||!['Enter','Escape'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      if(event.key==='Escape'){input.value=initial;input.setCustomValidity('');}
      input.blur();
    });
    return input;
  }
  function numericPreview(input,el,property,format=value=>value+'px',render=null){
    input.retouchNumericPreview=()=>{
      if(document.querySelector('[aria-label="Edit range status"]')?.dataset.match==='false')return null;
      const preview=root.RetouchPaintPicker.propertyPreview({el,input,property});
      return {current:()=>el.isConnected,update:value=>{preview.update(format(value));render?.(value);},restore:()=>{preview.restore();render?.(null);}};
    };
    return input;
  }
  function numericLabelDrag(input){
    const label=input.parentElement.querySelector('span');let drag=null;
    label.style.cursor='ew-resize';label.style.touchAction='none';label.style.userSelect='none';
    label.title='Drag to adjust. Shift: 10 units; Alt/Option: 0.1 units. Escape cancels.';
    label.dataset.numericScrub='';
    const stop=cancel=>{
      if(!drag)return;const saved=drag;drag=null;
      root.removeEventListener('blur',abort);saved.observer.disconnect();saved.preview?.restore();
      if(cancel)input.value=saved.initial;
      if(label.hasPointerCapture(saved.id))label.releasePointerCapture(saved.id);
      if(!cancel&&input.isConnected&&input.value!==saved.initial&&input.checkValidity())input.dispatchEvent(new Event('change',{bubbles:true}));
    };
    const abort=()=>stop(true);
    input.addEventListener('blur',abort);
    label.addEventListener('pointerdown',event=>{
      if(event.button!==0||drag||input.disabled||input.readOnly||input.value===''||!input.checkValidity())return;
      event.preventDefault();event.stopPropagation();input.focus({preventScroll:true});
      drag={id:event.pointerId,x:event.clientX,initial:input.value,value:Number(input.value)};
      drag.preview=input.retouchNumericPreview?.();drag.observer=new MutationObserver(()=>{if(!input.isConnected||drag?.preview?.current?.()===false)abort();});drag.observer.observe(document.body,{childList:true,subtree:true});
      label.setPointerCapture(event.pointerId);root.addEventListener('blur',abort);
    });
    label.addEventListener('pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();
      const delta=event.clientX-drag.x;drag.x=event.clientX;
      const min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);
      drag.value=Math.max(min,Math.min(max,Math.round((drag.value+delta*(event.altKey?0.1:event.shiftKey?10:1))*1e6)/1e6));input.value=String(drag.value);drag.preview?.update(drag.value);
    });
    label.addEventListener('pointerup',event=>{if(drag?.id===event.pointerId){event.preventDefault();event.stopPropagation();stop(false);}});
    for(const type of ['pointercancel','lostpointercapture'])label.addEventListener(type,event=>{if(drag?.id===event.pointerId)stop(true);});
    input.addEventListener('keydown',event=>{if(drag&&!event.isComposing&&['Escape','Enter'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();stop(event.key==='Escape');}},true);
    return input;
  }
  function number(parent, label, value, min, max, onChange) {
    const input = document.createElement('input'); input.type = 'number'; input.min = min; input.max = max; input.step = 'any'; input.value = Number.isFinite(value) ? round(value) : '';
    input.onchange = () => { if (input.value !== '' && input.checkValidity()) onChange(Number(input.value)); };
    return numericLabelDrag(field(parent, label, input));
  }
  function relativeNumber(parent,label,value,min,max,onChange) {
    const row=document.createElement('div');row.className='relative-field';parent.append(row);
    const input=number(row,label,value,min,max,()=>{}),initial=input.value;
    let submitted=null;
    const commit=()=>{
      if(input.value===''||!input.checkValidity())return;
      const next=input.value===initial&&Number.isFinite(value)?value:Number(input.value);
      if(next===submitted)return;submitted=next;onChange(next);
    };
    input.onchange=commit;
    const action=button('Use %',commit);
    action.setAttribute('aria-label','Use relative '+label.replace(' (%)','').toLowerCase());
    action.title='Convert to spacing relative to the font size.';row.append(action);
    return input;
  }
  function numericTypography(parent,current,onChange,onReset,canReset=true){
    const values=root.RetouchHTMLCSSValues;
    const details=document.createElement('details');details.className='numeric-typography';details.open=numericExpanded;details.ontoggle=()=>{if(details.isConnected)numericExpanded=details.open;};
    const summary=document.createElement('summary');summary.textContent='Number formatting';details.append(summary);parent.append(details);
    for(const [label,choices]of values.numericGroups){
      const active=choices.find(([v])=>v&&current.split(/\s+/).includes(v))?.[0]||'';
      select(details,label,choices,active,value=>{const next=values.numericChange(current,label,value);if(next!==null)onChange(next);});
    }
    note(details,'Appearance depends on the selected font’s supported features.');
    const reset=button('Reset number formatting',onReset);reset.disabled=!canReset;details.append(reset);
  }
  const opticalToken=t=>/^\[font-optical-sizing:(?:auto|none)\]$/.test(t);
  function opticalTypography(parent,css,onChange,onReset,canReset){
    select(parent,'Optical sizing',[['auto','Automatic'],['none','Off']],css.fontOpticalSizing,onChange);
    const reset=button('Reset optical sizing',onReset);reset.disabled=!canReset;parent.append(reset);
    const manual=root.RetouchHTMLCSSValues.parseVariations(css.fontVariationSettings)?.some(([tag])=>tag==='opsz');
    note(parent,manual?'The explicit Optical size axis overrides automatic sizing. Remove that axis to let the font adapt to text size.':'Automatic sizing adapts letterforms to text size when the font supports optical sizing.');
  }
  const variationToken=t=>/^\[font-variation-settings:.+\]$/.test(t);
  let advancedVariationExpanded=false;
  function variationTypography(parent,css,onChange,onReset,canReset,el){
    const d=el?.ownerDocument;
    const values=root.RetouchHTMLCSSValues,axes=values.parseVariations(css.fontVariationSettings);
    const details=document.createElement('details');details.open=variationExpanded;details.ontoggle=()=>{if(details.isConnected)variationExpanded=details.open;};
    const summary=document.createElement('summary');summary.textContent='Variable font axes';details.append(summary);parent.append(details);
    const axisInputs=new Map(),axisGroups=new Map(),axisDetails=new Map(),axisActions=new Map(),presetPanel=document.createElement('div'),visibleAxes=document.createElement('div'),advanced=document.createElement('details'),advancedAxes=document.createElement('div'),advancedMetadata=document.createElement('div');
    const advancedSummary=document.createElement('summary');advancedSummary.textContent='Advanced font axes';advanced.open=advancedVariationExpanded;advanced.hidden=true;advanced.ontoggle=()=>{if(advanced.isConnected)advancedVariationExpanded=advanced.open;};advanced.append(advancedSummary,advancedAxes,advancedMetadata);details.append(presetPanel,visibleAxes,advanced);

    const labels={wght:'Weight',wdth:'Width',opsz:'Optical size',slnt:'Slant',ital:'Italic'};
    const defaults={wght:parseFloat(css.fontWeight)||400,wdth:100,opsz:parseFloat(css.fontSize)||16,slnt:0,ital:0};
    if(axes){
      const write=next=>onChange(values.serializeVariations(next));
      for(const [tag,value]of axes){
        const group=document.createElement('div');group.className='font-axis-control';group.setAttribute('role','group');group.setAttribute('aria-label',(labels[tag]||tag)+' axis controls');axisGroups.set(tag,group);visibleAxes.append(group);
        axisInputs.set(tag,number(group,(labels[tag]||tag)+' axis',value,-10000,10000,next=>write(axes.map(axis=>axis[0]===tag?[tag,next]:axis))));
        const extra=document.createElement('div'),actions=document.createElement('div');actions.className='font-axis-actions';axisDetails.set(tag,extra);axisActions.set(tag,actions);
        const remove=button('Remove override',()=>write(axes.filter(axis=>axis[0]!==tag)));remove.setAttribute('aria-label','Remove '+(labels[tag]||tag)+' axis');actions.append(remove);group.append(extra,actions);
      }
      const custom=document.createElement('div');custom.hidden=true;
      const add=select(details,'Add font axis',[['','Choose an axis…'],...Object.entries(labels).filter(([tag])=>!axes.some(axis=>axis[0]===tag)),['custom','Custom axis…']],'',tag=>{custom.hidden=tag!=='custom';if(tag in defaults)write([...axes,[tag,defaults[tag]]]);else if(tag==='custom')tagInput.focus();});add.disabled=axes.length>=16;
      const tagInput=document.createElement('input');tagInput.type='text';tagInput.maxLength=4;tagInput.pattern='[A-Za-z0-9]{4}';tagInput.required=true;tagInput.placeholder='GRAD';tagInput.oninput=()=>tagInput.setCustomValidity('');field(custom,'Custom axis tag',tagInput);
      const initial=number(custom,'Initial axis value',0,-10000,10000,()=>{});
      const create=()=>{
        const tag=tagInput.value;
        tagInput.setCustomValidity(!/^[A-Za-z0-9]{4}$/.test(tag)?'Use the font’s four-character letter/number tag.':axes.some(axis=>axis[0]===tag)?'This axis is already listed.':'');
        if(!tagInput.reportValidity()||!initial.reportValidity()||initial.value==='')return;
        write([...axes,[tag,Number(initial.value)]]);
      };
      custom.append(button('Add custom axis',create));
      custom.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();create();}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();custom.hidden=true;add.value='';add.focus();}};
      note(custom,'Tags are case-sensitive. Use the tag and range documented by the font designer.');details.append(custom);

    }else note(details,'This axis syntax cannot be edited here yet. Reset removes the current override.');
    if(d&&root.RetouchFontMetadata){
      const metadata=root.RetouchFontMetadata,declared=metadata.sources(d,css.fontFamily),results=document.createElement('div');results.setAttribute('aria-label','Declared font axes');
      if(declared.files.length){
        let renderRevision=0,selected=metadata.selection(d,declared.family);if(!declared.files.some(file=>file.url===selected))selected=declared.files[0].url;
        const choose=select(details,'Declared font file',declared.files.map(file=>[file.url,file.label]),selected,value=>{selected=value;metadata.selection(d,declared.family,value);render();});
        const inspect=button('Inspect declared font axes',async()=>{
          renderRevision++;inspect.disabled=true;choose.disabled=true;results.textContent='Reading font axes…';
          try{const found=await metadata.inspect(d,selected);if(details.isConnected)await render(found);}catch(error){if(details.isConnected){await render();if(details.isConnected)results.textContent=error.message;}}finally{inspect.disabled=false;choose.disabled=false;}
        });
        async function render(inspected){
          const revision=++renderRevision;visibleAxes.hidden=true;results.replaceChildren();presetPanel.replaceChildren();advancedMetadata.replaceChildren();advanced.hidden=true;for(const extra of axisDetails.values())extra.replaceChildren();for(const actions of axisActions.values())actions.querySelector('[data-axis-default]')?.remove();for(const group of axisGroups.values())visibleAxes.append(group);for(const input of axisInputs.values()){input.min=-10000;input.max=10000;input.title='';}
          const inspectedFont=inspected||await metadata.peek(d,selected);if(revision!==renderRevision||!details.isConnected)return;visibleAxes.hidden=false;if(!inspectedFont)return;const found=inspectedFont.axes;
          const presets=inspectedFont.instances.filter(preset=>axes&&new Set([...axes,...preset.coordinates].map(([tag])=>tag)).size<=16&&preset.coordinates.every(([tag,value])=>/^[A-Za-z0-9]{4}$/.test(tag)&&Math.abs(value)<=10000));
          if(presets.length){const current=new Map(axes),matching=presets.findIndex(preset=>preset.coordinates.every(([tag,value])=>current.has(tag)&&Math.abs(current.get(tag)-value)<.0001));select(presetPanel,'Font style preset',[['','Choose a style…'],...presets.map((preset,index)=>[String(index),preset.name])],matching<0?'':String(matching),value=>{if(value==='')return;const preset=presets[Number(value)],next=new Map(axes);for(const [tag,coordinate]of preset.coordinates)next.set(tag,coordinate);onChange(values.serializeVariations([...next]));});note(presetPanel,'Applies all axes in this font preset at the current screen scope. Other axis overrides are preserved.');}
          if(!found.length)note(results,'This declared file has no variable axes.');
          const order=['wght','wdth','opsz','slnt','ital'],rank=tag=>order.includes(tag)?order.indexOf(tag):order.length;
          for(const axis of [...found].sort((a,b)=>rank(a.tag)-rank(b.tag))){
            const target=axisDetails.get(axis.tag)||(axis.hidden?advancedMetadata:results);if(axis.hidden)advanced.hidden=false;
            const group=axisGroups.get(axis.tag);if(group)(axis.hidden?advancedAxes:visibleAxes).append(group);
            note(target,axis.name+' ('+axis.tag+'): '+axis.min+' to '+axis.max+' · default '+axis.default+(axis.hidden?' · hidden axis':''));
            const compatible=/^[A-Za-z0-9]{4}$/.test(axis.tag)&&axis.min>=-10000&&axis.max<=10000;
            if(compatible&&axisInputs.has(axis.tag)){const input=axisInputs.get(axis.tag);input.min=axis.min;input.max=axis.max;input.title='Declared font range; default '+axis.default;}
            const active=axes?.find(entry=>entry[0]===axis.tag);
            if(compatible&&active&&axis.min<axis.max){
              const row=document.createElement('div');row.className='font-axis-range';
              const slider=document.createElement('input');slider.type='range';slider.min=axis.min;slider.max=axis.max;slider.step='any';slider.value=active[1];
              slider.setAttribute('aria-label','Adjust '+axis.name+' axis');row.append(slider);target.append(row);
              let stopPreview=()=>{},previewState=null;
              const previewValue=value=>{
                if(!el?.isConnected||!slider.isConnected)return;
                if(!previewState){
                  const property='font-variation-settings',originalStyle=el.getAttribute('style'),originalValue=el.style.getPropertyValue(property),originalPriority=el.style.getPropertyPriority(property);
                  const state=previewState={lastStyle:originalStyle,lastValue:null},lifetime=new AbortController();
                  const observer=new MutationObserver(()=>{if(!el.isConnected||!slider.isConnected)stopPreview();});
                  observer.observe(document.body,{childList:true,subtree:true});if(d.body)observer.observe(d.body,{childList:true,subtree:true});
                  stopPreview=()=>{
                    observer.disconnect();lifetime.abort();
                    if(el.getAttribute('style')===state.lastStyle){if(originalStyle===null)el.removeAttribute('style');else el.setAttribute('style',originalStyle);}
                    else if(el.style.getPropertyValue(property)===state.lastValue&&el.style.getPropertyPriority(property)==='important'){if(originalValue)el.style.setProperty(property,originalValue,originalPriority);else el.style.removeProperty(property);}
                    axisInputs.get(axis.tag).value=active[1];previewState=null;stopPreview=()=>{};
                  };
                  window.addEventListener('blur',()=>stopPreview(),{signal:lifetime.signal,once:true});
                  d.defaultView.addEventListener('pagehide',()=>stopPreview(),{signal:lifetime.signal,once:true});
                }
                el.style.setProperty('font-variation-settings',value,'important');previewState.lastValue=el.style.getPropertyValue('font-variation-settings');previewState.lastStyle=el.getAttribute('style');
              };
              const restore=()=>{stopPreview();slider.value=active[1];};let cancelled=false;
              const cancel=event=>{event.preventDefault();event.stopPropagation();cancelled=true;restore();slider.blur();};
              slider.onpointerdown=()=>{
                cancelled=false;slider.focus();const gesture=new AbortController(),options={capture:true,signal:gesture.signal};
                document.addEventListener('keydown',event=>{if(event.key==='Escape')cancel(event);},options);
                document.addEventListener('pointerup',()=>{stopPreview();gesture.abort();},{...options,once:true});
                document.addEventListener('pointercancel',()=>{cancelled=true;restore();gesture.abort();},{...options,once:true});
                window.addEventListener('blur',()=>{cancelled=true;restore();gesture.abort();},{signal:gesture.signal,once:true});
              };
              slider.oninput=()=>{if(cancelled){restore();return;}axisInputs.get(axis.tag).value=round(Number(slider.value));previewValue(values.serializeVariations(axes.map(entry=>entry[0]===axis.tag?[axis.tag,Number(slider.value)]:entry)));};
              slider.onchange=()=>{stopPreview();if(!slider.isConnected||!el.isConnected)return;if(cancelled){restore();return;}const value=Number(slider.value);if(Number.isFinite(value)&&value!==active[1])queueMicrotask(()=>{if(slider.isConnected&&el.isConnected&&!cancelled)onChange(values.serializeVariations(axes.map(entry=>entry[0]===axis.tag?[axis.tag,value]:entry)));});};
              slider.onkeydown=event=>{if(event.key==='Escape')cancel(event);else cancelled=false;};
              slider.onpointercancel=()=>{cancelled=true;restore();};
              slider.title='Drag to preview; release to apply. Escape cancels before release.';
            }
            if(compatible&&axes&&(axes.length<16||active)){const use=button('Font default',()=>{const next=new Map(axes);next.set(axis.tag,axis.default);onChange(values.serializeVariations([...next]));});use.setAttribute('aria-label','Use '+axis.name+' default');use.dataset.axisDefault='';if(axisActions.has(axis.tag))axisActions.get(axis.tag).prepend(use);else{use.textContent='Use '+axis.name+' default';target.append(use);}}
          }
        }
        details.append(inspect,results);render();
        note(details,'Metadata is from the last inspection of this declared file. Inspect again after changing the font file. Local fonts and fallback glyphs may differ.');
      }else note(details,'No readable font-file declaration found for '+declared.family+'.');
      if(declared.partial)note(details,'Some stylesheets could not be inspected.');
    }
    note(details,'Only axes supported by this font affect its appearance. Axis overrides take precedence over basic typography controls.');
    const reset=button('Reset font axes',onReset);reset.disabled=!canReset;details.append(reset);
  }
  const numericToken=t=>/^\[font-variant-numeric:.+\]$/.test(t)||['normal-nums','ordinal','slashed-zero','lining-nums','oldstyle-nums','proportional-nums','tabular-nums','diagonal-fractions','stacked-fractions'].includes(t);
  function locked(sec, info) {
    if (!info.classNameDynamic) return false;
    note(sec, info.classNameReason || 'Classes are computed by the component. Select its editable definition to change styles.', 'refused'); return true;
  }
  function inferredAnchor(classes,axis,fallback=''){
    // Resolve individual edges and dimensions so an auto reset only clears its
    // property; inherited important geometry still outranks normal overrides.
    const properties=new Map();
    for(const token of [...tokens(fallback),...tokens(classes)]){const t=base(token),match=t&&/^-?(inset-x|inset-y|inset|left|right|top|bottom|w|h|size)-(.+)$/.exec(t);if(!match)continue;const important=/^!|!$/.test(token),keys={inset:['left','right','top','bottom'],'inset-x':['left','right'],'inset-y':['top','bottom'],size:['w','h']}[match[1]]||[match[1]];for(const key of keys)if(!properties.get(key)?.important||important)properties.set(key,{value:match[2],important});}
    const value=key=>properties.get(key)?.value,a=value(axis==='x'?'left':'top'),b=value(axis==='x'?'right':'bottom'),size=value(axis==='x'?'w':'h'),active=v=>v&&v!=='auto',percent=v=>/^\[-?[0-9.]+%\]$/.test(v||'')||/^\d+\/\d+$/.test(v||'');
    if(percent(size)&&(percent(a)||!active(a)&&percent(b)))return 'scale';
    if(a?.startsWith('[calc(50%'))return 'center';
    if(active(a)&&active(b)&&(!size||size==='auto'))return 'stretch';
    return !active(a)&&active(b)?'end':'start';
  }
  function position(info, el, save, notify, onTransform, onGeometry) {
    const sec = section('Position');
    if (!el || locked(sec, info)) return sec;
    const css = el.ownerDocument.defaultView.getComputedStyle(el);
    const classes = info.className || '';
    const mode = tokens(classes).map(base).find(positionToken) || css.position;
    const applyAnchor = (x, y) => {
      try { const g=geometry(el),next=anchorClasses(classes,g,x,y,info.anchorInheritedClasses);if(onGeometry)onGeometry(next,g);else save(next); } catch (e) { notify(e.message); }
    };
    select(sec, 'Positioning', [['static','Auto / flow'],['relative','Relative'],['absolute','Absolute'],['fixed','Fixed'],['sticky','Sticky']], mode, value => {
      if (value === 'absolute' && mode !== 'absolute') {
        try { const g=geometry(el),next=anchorClasses(classes,g,nearestAnchor(g.x,g.width,g.parentWidth),nearestAnchor(g.y,g.height,g.parentHeight),info.anchorInheritedClasses);if(onGeometry)onGeometry(next,g);else save(next); }
        catch (e) { notify(e.message); }
      } else save(replace(classes, t => positionToken(t) || (value === 'static' && insetToken(t)), value));
    });
    if (mode === 'absolute') {
      let g;
      try { g = geometry(el); } catch (e) { note(sec,e.message,'refused'); return sec; }
      note(sec, `Anchored to ${g.parentLabel}`);
      if(onTransform){const tools=document.createElement('div');tools.className='stack-presets';for(const action of ['move','resize']){const control=button((action==='move'?'Move':'Resize')+' on canvas',event=>onTransform(action,event.currentTarget));control.dataset.canvasTool=action;tools.append(control);}sec.append(tools);}
      const x = inferredAnchor(classes,'x',info.anchorInheritedClasses), y = inferredAnchor(classes,'y',info.anchorInheritedClasses);
      const horizontal=select(sec,'Horizontal anchor',[['start','Left'],['center','Center'],['end','Right'],['stretch','Left + right'],['scale','Scale']],x,v=>applyAnchor(v,y));
      const vertical=select(sec,'Vertical anchor',[['start','Top'],['center','Center'],['end','Bottom'],['stretch','Top + bottom'],['scale','Scale']],y,v=>applyAnchor(x,v));
      for(const [input,size]of [[horizontal,g.parentWidth],[vertical,g.parentHeight]])if(size===0){const option=input.querySelector('option[value=scale]');option.disabled=true;option.textContent='Scale (needs container size)';}
      const grid = document.createElement('div'); grid.className = 'anchor-grid'; grid.setAttribute('aria-label','Anchor points');
      for (const [yi, yn] of ['start','center','end'].entries()) for (const [xi,xn] of ['start','center','end'].entries()) {
        const b = button('•',()=>applyAnchor(xn,yn)); b.setAttribute('aria-label',`${['Top','Center','Bottom'][yi]} ${['left','center','right'][xi]} anchor`);
        b.setAttribute('aria-pressed',String(x===xn&&y===yn)); grid.append(b);
      }
      sec.append(grid);
      note(sec,'Edge distances stay constant as the container resizes. Both edges stretch the element. Scale changes position and size proportionally.');
    }
    if (mode !== 'static') {
      const row = document.createElement('div'); row.className = 'control-grid';
      for (const side of ['top','right','bottom','left']) {
        const input = document.createElement('input'); input.value = css[side]; input.placeholder = 'auto';
        input.onchange = () => {
          let v = input.value.trim(); if (/^-?\d+(\.\d+)?$/.test(v)) v += 'px';
          if (!/^(auto|-?\d+(\.\d+)?(px|rem|em|%|vh|vw))$/.test(v)) return notify('Use auto, px, rem, em, %, vh, or vw.');
          save(replace(classes, t => t.replace(/^-/, '').startsWith(side+'-'), `${side}-${v==='auto'?'auto':'['+v+']'}`));
        };
        field(row,side[0].toUpperCase()+side.slice(1),input);
      }
      sec.append(row);
    }
    return sec;
  }
  function colorHex(value,d) {
    const canvas=d.createElement('canvas');canvas.width=canvas.height=1;
    const ctx=canvas.getContext('2d');ctx.fillStyle=value;ctx.fillRect(0,0,1,1);
    return '#'+[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  const borderWidthToken=t=>/^border(?:-(?:[trblxyse]))?(?:-(?:\d+(?:\.\d+)?|\[(?:length:[^\]]+|[-.\d][^\]]*)\]))?$/.test(t);
  function borderClasses(classes,property,value,inherited=''){
    if(!['width','style'].includes(property))throw Error('Choose a stroke property.');
    if(value!==null&&(property==='width'? !Number.isFinite(value)||value<0||value>100:!['solid','dashed','dotted','double','none','hidden'].includes(value)))throw Error('Unsupported stroke value.');
    const matches=t=>(property==='width'?borderWidthToken(t):/^border(?:-[trblxyse])?-(solid|dashed|dotted|double|hidden|none)$/.test(t))||new RegExp('^\\[border(?:-[a-z]+(?:-[a-z]+)?)?-'+property+':').test(t);
    let addition=value===null?'':property==='width'?'border-['+value+'px]':'border-'+value;
    if(addition&&[...tokens(classes),...tokens(inherited)].some(token=>/^!|!$/.test(token)&&(matches(base(token)||'')||/^\[border(?:-[trblxyse]|-top|-right|-bottom|-left)?:/.test(base(token)||''))))addition='!'+addition;
    return replace(classes,matches,addition);
  }
  function cornerRadiusClasses(classes,corner,value,inherited=''){
    const names={tl:'top-left',tr:'top-right',bl:'bottom-left',br:'bottom-right'};
    if(corner!==null&&!Object.hasOwn(names,corner))throw Error('Choose a corner.');
    if(value!==null&&(!Number.isFinite(value)||value<0||value>10000))throw Error('Use a radius from 0 to 10000 pixels.');
    const radius=t=>/^rounded(?:-|$)|^\[border(?:-[a-z]+-[a-z]+)?-radius:/.test(t);
    const matches=corner===null?radius:t=>t.startsWith('rounded-'+corner+'-')||t.startsWith('[border-'+names[corner]+'-radius:');
    let addition=value===null?'':'rounded-'+(corner?corner+'-':'')+'['+value+'px]';
    if(addition&&[...tokens(classes),...tokens(inherited)].some(token=>/^!|!$/.test(token)&&radius(base(token)||'')))addition='!'+addition;
    return replace(classes,matches,addition);
  }
  function appearance(info, el, save, colorAction) {
    const sec = section('Appearance');
    if (!el) return sec;
    const css = el.ownerDocument.defaultView.getComputedStyle(el);
    if (locked(sec,info)) return sec;
    if(colorAction){
      for(const [property,label]of [['color','Text color'],['background-color','Background color'],['border-color','Border color'],...(el.namespaceURI==='http://www.w3.org/2000/svg'?[['fill','SVG fill'],['stroke','SVG stroke']]:[])]){
        const input=document.createElement('input');input.type='text';input.spellcheck=false;input.placeholder='CSS color';
        const computed=property==='border-color'?css.borderTopColor:css.getPropertyValue(property);
        input.value=computed;input.dataset.paintProperty=property;input.retouchPaintPreview=()=>root.RetouchPaintPicker.propertyPreview({el,input,property});
        field(sec,label+' with alpha',input);note(sec,computed,'computed-value');
        sec.append(button('Clear local '+label.toLowerCase(),()=>colorAction(property,null).catch(error=>{input.setCustomValidity(error.message);input.reportValidity();})));
        input.onchange=()=>{const value=input.value.trim();if(!root.RetouchHTMLCSSValues.valid('color',value,false)||!el.ownerDocument.defaultView.CSS.supports('color',value)){input.setCustomValidity('Enter a supported literal CSS color.');input.reportValidity();return;}input.setCustomValidity('');colorAction(property,value).catch(error=>{input.setCustomValidity(error.message);input.reportValidity();});};input.oninput=()=>input.setCustomValidity('');fieldDraft(input);
      }
    }
    if(colorAction)note(sec,'Clear removes paint from this screen scope to reveal inherited styles. Saved color links stay attached; reset them from the palette.');
    function writeAppearance(property,value){
      let next=root.RetouchReactSelection.change(info.className,'',property,value,el.ownerDocument);
      const matches=token=>property==='visibility'?/^(visible|invisible|collapse)$|^\[visibility:/.test(token):property==='opacity'?/^opacity-|^\[opacity:/.test(token):property==='mix-blend-mode'?/^mix-blend-|^\[mix-blend-mode:/.test(token):/^(isolate|isolation-auto)$|^\[isolation:/.test(token);
      if(value!==null&&tokens(info.anchorInheritedClasses).some(token=>/^!|!$/.test(token)&&matches(base(token)||'')))next=replace(next,matches,'!'+(property==='visibility'?({visible:'visible',hidden:'invisible',collapse:'collapse'})[value]:property==='opacity'?'opacity-['+value/100+']':property==='mix-blend-mode'?'mix-blend-'+value:value==='auto'?'isolation-auto':'isolate'));
      save(next);
    }
    const row = document.createElement('div'); row.className='opacity-row';
    const input = number(row,'Opacity (%)',Number(css.opacity)*100,0,100,value=>writeAppearance('opacity',value));
    numericPreview(input,el,'opacity',value=>String(value/100));
    const slider = document.createElement('input'); slider.type='range'; slider.min=0; slider.max=100; slider.value=input.value; slider.setAttribute('aria-label','Opacity');
    slider.oninput=()=>{input.value=slider.value;}; slider.onchange=()=>input.onchange(); row.append(slider); sec.append(row);
    const resetOpacity=button('Reset opacity',()=>writeAppearance('opacity',null));resetOpacity.disabled=root.RetouchReactSelection.change(info.className,'','opacity',null)===info.className;sec.append(resetOpacity);
    if(el.style.getPropertyValue('opacity')){input.disabled=true;slider.disabled=true;resetOpacity.disabled=true;note(sec,'An inline opacity controls this layer.');}
    for(const [property,label]of [['visibility','Visibility'],['mix-blend-mode','Blend mode'],['isolation','Blend group']]){
      const values=property==='visibility'?['visible','hidden','collapse']:root.RetouchHTMLCSSValues.options[property],current=css.getPropertyValue(property);
      const write=value=>writeAppearance(property,value);
      const choices=[...new Set([current,...values])].filter(value=>el.ownerDocument.defaultView.CSS.supports(property,value));
      const control=select(sec,label,choices.map(value=>[value,property==='isolation'?(value==='isolate'?'Isolate children':'Blend with surroundings'):value]),current,write);
      const reset=button('Reset '+label.toLowerCase(),()=>write(null));reset.disabled=root.RetouchReactSelection.change(info.className,'',property,null)===info.className;sec.append(reset);
      if(el.style.getPropertyValue(property)){control.disabled=true;reset.disabled=true;note(sec,'An inline '+label.toLowerCase()+' controls this layer.');}
      if(property==='visibility')note(sec,'Hidden layers keep their layout space. Select them in Layers to show them again.');
    }
    const widthToken=borderWidthToken;
    const borderWidths=['Top','Right','Bottom','Left'].map(side=>css['border'+side+'Width']);
    const borderWidth=number(sec,'Border width (px)',borderWidths.every(v=>v===borderWidths[0])?parseFloat(borderWidths[0]):NaN,0,100,v=>{
      let next=borderClasses(info.className,'width',v,info.anchorInheritedClasses);
      if(v>0&&css.borderTopStyle==='none')next=borderClasses(next,'style','solid',info.anchorInheritedClasses);
      save(next);
    });
    borderWidth.placeholder='Mixed';
    const resetWidth=button('Reset border width',()=>save(borderClasses(info.className,'width',null)));resetWidth.disabled=borderClasses(info.className,'width',null)===info.className;sec.append(resetWidth);
    select(sec,'Border style',['solid','dashed','dotted','double','none'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]),css.borderTopStyle,v=>save(borderClasses(info.className,'style',v,info.anchorInheritedClasses)));
    const resetStyle=button('Reset border style',()=>save(borderClasses(info.className,'style',null)));resetStyle.disabled=borderClasses(info.className,'style',null)===info.className;sec.append(resetStyle);
    const borderColor=document.createElement('input');borderColor.type='color';borderColor.value='#000000';
    try {const c=colorHex(css.borderTopColor,el.ownerDocument);if(c)borderColor.value=c;} catch {}
    // Color inputs accept sRGB hex, while computed CSS may use lab/oklch.
    // Show the browser's computed value separately instead of mislabelling it.
    field(sec,'Border color',borderColor);note(sec,css.borderTopColor,'computed-value');
    borderColor.onchange=()=>colorAction?colorAction('border-color',borderColor.value).catch(error=>{borderColor.setCustomValidity(error.message);borderColor.reportValidity();}):save(replace(info.className,t=>t.startsWith('border-')&&!widthToken(t)&&!/^border(?:-[trblxyse])?-(solid|dashed|dotted|double|hidden|none|collapse|separate|spacing-|opacity-)/.test(t),`border-[${borderColor.value}]`));
    const radius=value=>/^[\d.]+px$/.test(value)?parseFloat(value):NaN;
    const radii=[css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius];
    const allRadius=number(sec,'Corner radius (px)',radii.every(v=>v===radii[0])?radius(radii[0]):NaN,0,10000,v=>save(cornerRadiusClasses(info.className,null,v,info.anchorInheritedClasses)));
    numericPreview(allRadius,el,'border-radius');
    const resetRadius=button('Reset corner radius',()=>save(cornerRadiusClasses(info.className,null,null)));resetRadius.disabled=cornerRadiusClasses(info.className,null,null)===info.className;sec.append(resetRadius);
    allRadius.placeholder=radii.every(v=>v===radii[0])?radii[0]:'Mixed';
    const corners=document.createElement('details');corners.className='radius-corners';const summary=document.createElement('summary');summary.textContent='Individual corners';corners.append(summary);
    for(const [name,token,property] of [['Top left','tl','borderTopLeftRadius'],['Top right','tr','borderTopRightRadius'],['Bottom right','br','borderBottomRightRadius'],['Bottom left','bl','borderBottomLeftRadius']]) {
      const field=number(corners,name+' radius (px)',radius(css[property]),0,10000,v=>save(cornerRadiusClasses(info.className,token,v,info.anchorInheritedClasses)));field.placeholder=css[property];numericPreview(field,el,property.replace(/[A-Z]/g,char=>'-'+char.toLowerCase()));
      const reset=button('Reset '+name.toLowerCase()+' radius',()=>save(cornerRadiusClasses(info.className,token,null)));reset.disabled=cornerRadiusClasses(info.className,token,null)===info.className;corners.append(reset);
    }
    corners.open=cornersExpanded;corners.ontoggle=()=>{if(corners.isConnected)cornersExpanded=corners.open;};
    sec.append(corners);root.RetouchClassGradients.mount(sec,info,el,save);return sec;
  }
  function filterClasses(classes,property,value){
    const values=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues;
    if(!['filter','backdrop-filter'].includes(property)||value!==null&&(!values.valid(property,value)||typeof value!=='string'))throw Error('Unsupported filter stack.');
    const match=t=>t.startsWith('['+property+':')||(property==='backdrop-filter'?/^backdrop-(?:blur|brightness|contrast|grayscale|hue-rotate|invert|opacity|saturate|sepia|filter)(?:-|$)/.test(t):/^(?:-?hue-rotate|filter|blur|brightness|contrast|drop-shadow|grayscale|invert|saturate|sepia)(?:-|$)/.test(t));
    if(tokens(classes).some(t=>/^!|!$/.test(t)&&base(t)?.startsWith('[all:')))throw Error('Resolve the important all-property reset before editing filters.');
    return replace(classes,match,value===null?'':'!['+property+':'+value.replace(/\s/g,'_')+']');
  }
  function shadowClasses(classes,value){
    const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues;
    if(value!==null&&!V.valid('box-shadow',value))throw Error('Unsupported shadow stack.');
    if(tokens(classes).some(token=>/^!|!$/.test(token)&&/^(?:\[all:|(?:inset-)?ring(?:-|$))/.test(base(token)||'')))throw Error('Resolve the important ring or all-property reset before editing shadows.');
    return replace(classes,t=>/^shadow(?:-|$)/.test(t)||/^\[box-shadow:/.test(t),value===null?'':'![box-shadow:'+value.replace(/\s/g,'_')+']');
  }
  function shadowStack(parent,info,el,save,notify){
    const V=root.RetouchHTMLCSSValues,shadows=V.parseShadows(el.ownerDocument.defaultView.getComputedStyle(el).boxShadow),details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Shadow stack';details.append(summary);details.open=shadowStackExpanded;details.retouchSetOpen=value=>{shadowStackExpanded=!!value;details.open=shadowStackExpanded;};details.ontoggle=()=>{if(details.isConnected)shadowStackExpanded=details.open;};parent.append(details);
    const write=next=>{try{save(shadowClasses(info.className,next===null?null:V.serializeShadows(next)));}catch(error){notify(error.message);}};
    if(shadows===null)note(details,'This shadow stack contains values these controls cannot edit.');
    else{
      shadows.forEach((shadow,index)=>{
        const group=document.createElement('fieldset'),legend=document.createElement('legend');group.className='shadow-controls';legend.textContent='Shadow '+(index+1);group.append(legend);
        const update=(key,value)=>write(shadows.map((item,i)=>i===index?{...item,[key]:value}:item));
        select(group,'Shadow '+(index+1)+' type',[['drop','Drop shadow'],['inner','Inner shadow']],shadow.inset?'inner':'drop',value=>update('inset',value==='inner'));
        for(const [key,label]of [['x','X'],['y','Y'],['blur','Blur'],['spread','Spread']])numericPreview(number(group,'Shadow '+(index+1)+' '+label+' (px)',shadow[key],key==='blur'?0:-10000,10000,value=>update(key,value)),el,'box-shadow',value=>V.serializeShadows(shadows.map((item,i)=>i===index?{...item,[key]:value}:item)));
        const color=document.createElement('input');color.value=shadow.color;color.retouchPaintPreview=()=>root.RetouchPaintPicker.shadowPreview({el,group,shadows,index});field(group,'Shadow '+(index+1)+' color',color);color.oninput=()=>color.setCustomValidity('');color.onchange=()=>{const value=color.value.trim();if(!V.valid('color',value)||!el.ownerDocument.defaultView.CSS.supports('color',value)){color.setCustomValidity('Enter a supported CSS color.');color.reportValidity();return;}update('color',value);};
        group.append(button('Remove shadow '+(index+1),()=>write(shadows.filter((_,i)=>i!==index))));
        if(index>0)group.append(button('Move shadow '+(index+1)+' up',()=>{const next=[...shadows];[next[index-1],next[index]]=[next[index],next[index-1]];write(next);}));
        if(index<shadows.length-1)group.append(button('Move shadow '+(index+1)+' down',()=>{const next=[...shadows];[next[index],next[index+1]]=[next[index+1],next[index]];write(next);}));
        const duplicate=button('Duplicate shadow '+(index+1),()=>write([...shadows.slice(0,index+1),{...shadow},...shadows.slice(index+1)]));duplicate.disabled=shadows.length>=16;group.append(duplicate);details.append(group);
      });
      const add=button('Add shadow',()=>write([...shadows,{x:0,y:4,blur:8,spread:0,color:'rgba(0, 0, 0, 0.25)',inset:false}]));add.disabled=shadows.length>=16;details.append(add);
    }
    const clear=button('Clear shadows',()=>write([]));clear.disabled=shadows?.length===0;details.append(clear);
    const reset=button('Reset shadows',()=>write(null));try{reset.disabled=shadowClasses(info.className,null)===info.className;}catch(error){reset.disabled=true;reset.title=error.message;}details.append(reset);
    if(el.style.getPropertyPriority('box-shadow')==='important'){for(const input of details.querySelectorAll('input,select,button'))input.disabled=true;note(details,'An inline important shadow controls this layer.');}
    note(details,'Shadows are stacked from front to back. Reset reveals this screen scope’s inherited styling.');
  }
  function effects(info, el, save, notify) {
    const sec = section('Effects');
    if (!el || locked(sec,info)) return sec;
    const css=el.ownerDocument.defaultView.getComputedStyle(el);
    for(const [property,label]of [['filter','Layer blur (px)'],['backdrop-filter','Backdrop blur (px)']]){
      const value=css.getPropertyValue(property).trim(),parsed=root.RetouchHTMLCSSValues.parseFilters(value),blurs=parsed?.filter(item=>item.name==='blur');
      const input=number(sec,label,blurs?.length===1?parseFloat(blurs[0].arg):blurs?.length===0?0:NaN,0,1000,amount=>{
        const next=root.RetouchHTMLCSSValues.withBlur(value,amount);if(next===null)return notify('This filter stack cannot be edited with a single blur control.');
        try{save(filterClasses(info.className,property,next));}catch(error){notify(error.message);}
      });
      numericPreview(input,el,property,amount=>root.RetouchHTMLCSSValues.withBlur(value,amount));
      if(!parsed||blurs.length>1||el.style.getPropertyPriority(property)==='important'){input.disabled=true;note(sec,'This '+(property==='filter'?'layer':'backdrop')+' filter cannot be adjusted with a single blur value.');}
      note(sec,value,'computed-value');
      root.RetouchFilterStack.mount(sec,property,value,next=>save(filterClasses(info.className,property,next)),{disabled:el.style.getPropertyPriority(property)==='important',reset:true});
    }
    note(sec,css.boxShadow,'computed-value');
    shadowStack(sec,info,el,save,notify);
    const shadowMatch=t=>/^shadow(?:-|$)/.test(t)||/^\[box-shadow:/.test(t);
    const saveShadow=value=>{const inherited=tokens(info.anchorInheritedClasses).some(token=>/^!|!$/.test(token)&&base(token)!==null&&shadowMatch(base(token)));return save(replace(info.className,shadowMatch,inherited?'!'+value:value));};
    const presets=[['','Choose shadow…'],['shadow-none','None'],['shadow-sm','Small'],['shadow-md','Medium'],['shadow-lg','Large'],['shadow-xl','Extra large'],['shadow-inner','Inner']];
    select(sec,'Shadow preset',presets,tokens(info.className).map(base).find(t=>presets.some(([p])=>p===t))||'',value=>{if(value)saveShadow(value);});
    const form=document.createElement('div');form.className='control-grid';
    const values={x:0,y:4,blur:12,spread:0};
    for(const [key,label] of [['x','X'],['y','Y'],['blur','Blur'],['spread','Spread']]) number(form,'Shadow '+label,values[key],key==='blur'?0:-1000,1000,v=>{values[key]=v;});
    sec.append(form);
    const color=document.createElement('input');color.type='color';color.value='#000000';field(sec,'Shadow color',color);
    let alpha=20;number(sec,'Shadow opacity (%)',alpha,0,100,v=>{alpha=v;});
    const inset=document.createElement('input');inset.type='checkbox';field(sec,'Inner shadow',inset);
    sec.append(button('Apply custom shadow',()=>{
      if(![...sec.querySelectorAll('input')].every(i=>i.checkValidity()&&i.value!=='')) return notify('Check the shadow values.');
      const hex=color.value+Math.round(alpha/100*255).toString(16).padStart(2,'0');
      saveShadow(`shadow-[${inset.checked?'inset_':''}${px(values.x)}_${px(values.y)}_${px(values.blur)}_${px(values.spread)}_${hex}]`);
    }));
    return sec;
  }
  function fontFamilyClass(value){
    if(typeof value!=='string'||!value.trim()||value.length>500||!value.split(',').every(part=>/^(?:[\p{L}\p{N}_-]+(?: +[\p{L}\p{N}_-]+)*|"[\p{L}\p{N} _-]+"|'[\p{L}\p{N} _-]+')$/u.test(part.trim())))return null;
    return '[font-family:'+value.trim().replace(/'/g,'"').replace(/_/g,'\\_').replace(/ /g,'_')+']';
  }
  const fontFamilyToken=t=>/^(?:font-(?:sans|serif|mono)|font-\[family-name:.*\]|\[font-family:.*\])$/.test(t);
  const isTextLayer=tag=>/^(h[1-6]|p|span|a|label|blockquote|li|button)$/.test(tag);
  const lineHeightToken=t=>/^(?:leading-.+|\[line-height:.+\])$/.test(t);
  const fontWeightToken=t=>/^\[font-weight:.+\]$/.test(t)||/^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+(?:\.\d+)?\])$/.test(t);
  const fontSizeToken=t=>/^\[font-size:.+\]$/.test(t)||/^text-(?:xs|sm|base|lg|[2-9]?xl|\[(?:length:[^\]]+|(?:[-.\d]|(?:calc|min|max|clamp)\()[^\]]*)\]|\(length:--[\w-]+\))(?:\/.*)?$/.test(t);
  const letterSpacingToken=t=>/^(?:-?tracking-.+|\[letter-spacing:.+\])$/.test(t);
  const textAlignToken=t=>/^(?:text-(?:left|center|right|justify|start|end)|\[text-align:.+\])$/.test(t);
  const fontStyleToken=t=>/^(?:italic|not-italic|\[font-style:.+\])$/.test(t);
  const decorationToken=t=>/^(?:underline|line-through|overline|no-underline|\[text-decoration-line:.+\])$/.test(t);
  const caseToken=t=>/^(?:uppercase|lowercase|capitalize|normal-case|\[text-transform:.+\])$/.test(t);
 function expandSizeLeading(projected){
  const I={base,fontSizeToken};return projected.split(/\s+/).filter(Boolean).flatMap(token=>{
   const base=I.base(token);if(!base||!I.fontSizeToken(base))return [token];
   let depth=0,slash=-1;for(let i=0;i<base.length;i++){const c=base[i];if(c==='['||c==='(')depth++;else if(c===']'||c===')')depth--;else if(c==='/'&&!depth){slash=i;break;}}
   if(slash<0)return [token];const size=base.slice(0,slash),leading=base.slice(slash+1),important=/^!|!$/.test(token)?'!':'';
   if(!leading)throw Error('A selected layer has an incomplete line-height utility.');
   return [important+size,important+'leading-'+leading];
  }).join(' ');
 }
  function replaceTypography(classes,match,additions){return replace(match===fontSizeToken||match===lineHeightToken?expandSizeLeading(classes):classes,match,additions);}
  const textOverrideToken=t=>[fontSizeToken,fontWeightToken,fontFamilyToken,lineHeightToken,letterSpacingToken,textAlignToken,fontStyleToken,decorationToken,caseToken,opticalToken,variationToken,numericToken].some(match=>match(t));
  function fontWeightClass(value){return typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=1000?`font-[${value}]`:null;}
  function fontFamilies(d,current){
    const found=new Map([['system-ui','System UI'],['sans-serif','Sans serif'],['serif','Serif'],['monospace','Monospace']]);
    function add(value,label){value=value?.trim();if(value&&fontFamilyClass(value)&&!found.has(value)&&found.size<100)found.set(value,label||value.replace(/["']/g,''));}
    add(current);let count=0;
    for(const face of d.fonts||[]){add(face.family);if(++count>=200)break;}
    count=0;for(const value of pageTextFonts(d)){add(value);if(++count>=300)break;}
    return [...found];
  }
  function* pageTextFonts(d){
    if(!d.body)return;
    const roots=[d.body],seen=new WeakSet();
    // Queue open roots so deeply nested components do not recurse on the JS
    // stack. Each host/root/text node remains an entry in the batched scan.
    for(let i=0;i<roots.length;i++){
      const walker=d.createTreeWalker(roots[i],5);let node=roots[i];
      do {
        if(node.nodeType===1&&node.shadowRoot)roots.push(node.shadowRoot);
        const el=node.nodeType===3&&/\S/.test(node.nodeValue||'')?(node.assignedSlot||node.parentElement):node.nodeType===1&&/^(INPUT|TEXTAREA)$/.test(node.tagName)?node:null;
        if(el&&!seen.has(el)&&!/^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)){seen.add(el);yield d.defaultView.getComputedStyle(el).fontFamily;}else yield null;
      }while(node=walker.nextNode());
    }
  }
  function* pageFontValues(d){for(const face of d.fonts||[])yield face.family;yield* pageTextFonts(d);}
  function scanPageFonts(d,onBatch,active=()=>true){
    const values=pageFontValues(d);let timer,stopped=false;
    const step=()=>{if(stopped||!active())return;const batch=[],deadline=performance.now()+8;let done=false;for(let i=0;i<100&&(i===0||performance.now()<deadline);i++){const next=values.next();if(next.done){done=true;break;}if(next.value&&fontFamilyClass(next.value))batch.push(next.value.trim());}onBatch(batch,done);if(!done&&!stopped)timer=setTimeout(step,0);};
    timer=setTimeout(step,0);return ()=>{stopped=true;clearTimeout(timer);values.return();};
  }
  function filterFonts(choices,query){
    const normalize=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/["']/g,'');
    const words=normalize(query).trim().split(/\s+/).filter(Boolean);
    return choices.filter(([value,label])=>words.every(word=>normalize(value+' '+label).includes(word)));
  }
  function fontFaceStates(d){
    const states=new Map();for(const face of d.fonts||[]){const key=face.family.trim().replace(/^(["'])(.*)\1$/,'$2').toLocaleLowerCase();let counts=states.get(key);if(!counts)states.set(key,counts={loaded:0,loading:0,unloaded:0,error:0});if(Object.hasOwn(counts,face.status))counts[face.status]++;}return states;
  }
  function fontFaceLabel(value,states){
    if(!fontFamilyClass(value))return 'Font status unavailable';
    const family=value.split(',')[0].trim();
    if(/^(system-ui|sans-serif|serif|monospace|cursive|fantasy|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/i.test(family))return 'System / fallback family';
    const counts=states.get(family.replace(/^(["'])(.*)\1$/,'$2').toLocaleLowerCase());
    if(!counts)return 'No page font declaration';
    return [['loading','loading'],['error','failed'],['unloaded','not loaded'],['loaded','loaded']].filter(([key])=>counts[key]).map(([key,label])=>`${counts[key]} ${label}`).join(' · ')||'Font status unavailable';
  }
  function fontPicker(parent,d,current,onChange,options={}){
    const choices=fontFamilies(d,current),supported=choices.some(([value])=>value===current);
    const quick=select(parent,options.label||'Page font',supported?choices:[[current,options.mixed?'Mixed':current],...choices],current,onChange);
    if(!supported)quick.options[0].disabled=true;
    const currentStatus=note(parent,'');currentStatus.setAttribute('aria-label','Current font files');currentStatus.setAttribute('role','status');
    const browse=document.createElement('details');browse.className='font-browser';
    const summary=document.createElement('summary');summary.textContent='Browse page fonts';browse.append(summary);
    const search=document.createElement('input');search.type='search';search.placeholder='Search font names';search.setAttribute('aria-label','Search page fonts');browse.append(search);
    const status=note(browse,'');status.setAttribute('role','status');
    const results=document.createElement('div');results.className='font-results';results.setAttribute('role','group');results.setAttribute('aria-label','Matching fonts');browse.append(results);
    const pages=document.createElement('div');pages.className='font-pages';let offset=0,scanning=false,cancelScan;
    const previous=button('Previous fonts',()=>{offset=Math.max(0,offset-50);render();}),next=button('Next fonts',()=>{offset+=50;render();});pages.append(previous,next);browse.append(pages);
    const render=()=>{
      const states=fontFaceStates(d);currentStatus.textContent=options.mixed?'Multiple font families in this selection.':fontFaceLabel(current,states);
      const matches=filterFonts(choices,search.value),focused=results.contains(document.activeElement)?document.activeElement.dataset.font:null;
      if(offset>=matches.length)offset=0;
      status.textContent=(matches.length?`${matches.length} font ${matches.length===1?'choice':'choices'}`:scanning?'No matches yet.':'No matching fonts. Try another name.')+(scanning?' · Scanning page…':'');status.dataset.scanning=String(scanning);
      pages.hidden=matches.length<=50;previous.disabled=offset===0;next.disabled=offset+50>=matches.length;
      if(matches.length>50)status.textContent+=` · Showing ${offset+1}–${Math.min(offset+50,matches.length)}`;
      results.replaceChildren();for(const [value,label] of matches.slice(offset,offset+50)){const b=button(label,()=>onChange(value));const detail=document.createElement('small');detail.className='font-face-state';detail.textContent=fontFaceLabel(value,states);b.append(detail);b.dataset.font=value;b.setAttribute('aria-label','Use font '+label);b.setAttribute('aria-pressed',String(value===current));results.append(b);if(value===focused)b.focus({preventScroll:true});}
    };
    search.oninput=()=>{offset=0;render();};browse.ontoggle=()=>{
      cancelScan?.();scanning=browse.open;
      if(browse.open){search.focus();choices.splice(0,choices.length,...fontFamilies(d,current));offset=0;const known=new Set(choices.map(([value])=>value));cancelScan=scanPageFonts(d,(batch,done)=>{let changed=false;for(const value of batch)if(!known.has(value)){known.add(value);choices.push([value,value.replace(/["']/g,'')]);changed=true;}scanning=!done;if(changed||done)render();},()=>browse.isConnected&&browse.open);}
      render();
    };
    browse.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();browse.open=false;summary.focus();}});
    note(browse,'Status is for declared font faces. Some characters or weights may still use a fallback.');
    if(d.fonts?.addEventListener){
      const events=['loading','loadingdone','loadingerror'];const update=()=>{if(parent.isConnected)render();};for(const event of events)d.fonts.addEventListener(event,update);
      const observer=new MutationObserver(()=>{if(!parent.isConnected){observer.disconnect();cancelScan?.();for(const event of events)d.fonts.removeEventListener(event,update);}});observer.observe(document.body,{childList:true,subtree:true});
    }
    render();parent.append(browse);return quick;
  }
  function typography(info, el, save, changeTag, textStyleAction) {
    const sec=section('Typography'); if(!el)return sec;
    const d=el.ownerDocument, css=d.defaultView.getComputedStyle(el);
    root.RetouchTextStyles?.mount(sec,el,info.classTextStyles&&!info.classNameDynamic&&textStyleAction?{inherited:root.RetouchResponsive.inheritedLink(info.textStyleLinks,info.styleScope||'',d),update:info.textStyleUpdates===false?undefined:(styleId,libraryRevision,name,properties)=>textStyleAction('updateTextStyle',info.styleScope||'',{styleId,libraryRevision,name,properties}),link:info.textStyleLinks?.[info.styleScope||''],overrides:info.textStyleOverrides?.[info.styleScope||'']||[],reset:(styleId,libraryRevision)=>textStyleAction('resetTextStyle',info.styleScope||'',{styleId,libraryRevision}),apply:(styleId,libraryRevision)=>textStyleAction('applyTextStyle',info.styleScope||'',{styleId,libraryRevision}),detach:()=>textStyleAction('detachTextStyle',info.styleScope||'',{})}:{});
    note(sec,`${css.fontFamily} · ${css.fontSize} / ${css.lineHeight} · ${css.fontWeight}`,'computed-value');
    const preview=document.createElement('iframe');preview.className='type-preview';preview.title='Typography preview';preview.setAttribute('sandbox','allow-same-origin');sec.append(preview);
    preview.onload=()=>{
      const pd=preview.contentDocument;if(!pd||!preview.isConnected||!el.isConnected||!d.location)return;
      const base=pd.createElement('base');base.href=d.location.href;pd.head.append(base);
      for(const s of d.querySelectorAll('link[rel="stylesheet"],style'))pd.head.append(pd.importNode(s,true));
      pd.body.style.cssText='margin:0;padding:12px;background:#fff;color:#181818;overflow-wrap:anywhere;';
      const sample=pd.createElement('div');sample.textContent=el.textContent?.trim().slice(0,100)||'The quick brown fox · Aa 0123456789';
      for(const p of typeProperties)sample.style.setProperty(p,css.getPropertyValue(p));pd.body.append(sample);
    };
    preview.srcdoc='<!doctype html><html><head></head><body></body></html>';
    if(!locked(sec,info)) {
      const names=catalog(d), current=tokens(info.className).filter(t=>names.includes(t));
      if(names.length && !info.styleScope) {
        select(sec,'Typography class',[['','Choose a project style…'],...names.map(n=>[n,n])],current.length===1?current[0]:'',value=>{
          if(value)save(replace(info.className,t=>names.includes(t),value));
        });
        note(sec,current.length?'Applied: '+current.join(' '):'Styles from this page’s loaded CSS.');
      } else note(sec,info.styleScope ? 'Use size and weight below for breakpoint typography. Named project styles currently apply through base styles.' : 'No named typography styles found in the loaded CSS.');
      const controls=[['Font size',{test:fontSizeToken},[['text-sm','Small'],['text-base','Body'],['text-lg','Large'],['text-2xl','Heading'],['text-4xl','Display']]],
        ['Font weight',{test:fontWeightToken},[['font-normal','Regular'],['font-medium','Medium'],['font-semibold','Semibold'],['font-bold','Bold']]]];
      // Project text styles can live outside CSS layers and outrank utilities.
      // An explicit property override must still win without dropping the style's
      // other font properties. Scope wrapping is handled by the shell afterward.
      const styled=[...el.classList].some(t=>names.includes(t));
      const change=(match,value)=>save(replaceTypography(info.className,match,styled?'!'+value:value));
      fontPicker(sec,d,css.fontFamily,value=>{const token=fontFamilyClass(value);if(token)change(fontFamilyToken,token);});
      const resetFamily=button('Reset font family',()=>save(replace(info.className,fontFamilyToken,'')));resetFamily.disabled=!tokens(info.className).map(base).some(t=>t&&fontFamilyToken(t));sec.append(resetFamily);
      for(const [label,re,choices] of controls){const token=tokens(info.className).map(base).find(t=>re.test(t));select(sec,label,[['','Inherited / custom'],...choices],choices.some(([value])=>value===token)?token:'',value=>{if(value)change(re.test,value);});}
      numericPreview(number(sec,'Font weight (1–1000)',parseFloat(css.fontWeight),1,1000,v=>{const token=fontWeightClass(v);if(token)change(fontWeightToken,token);}),el,'font-weight',String);
      const resetWeight=button('Reset font weight',()=>save(replace(info.className,fontWeightToken,'')));resetWeight.disabled=!tokens(info.className).map(base).some(t=>t&&fontWeightToken(t));sec.append(resetWeight);
      numericPreview(number(sec,'Font size (px)',parseFloat(css.fontSize),1,1000,v=>change(fontSizeToken,`text-[${v}px]`)),el,'font-size');
      const relativeLineHeight=relativeNumber(sec,'Line height (%)',parseFloat(css.lineHeight)/parseFloat(css.fontSize)*100,0,1000,v=>change(lineHeightToken,`[line-height:${Math.round(v*1e6)/1e8}]`));relativeLineHeight.title='Relative to this layer’s font size.';
      const lineHeight=number(sec,'Line height (px)',parseFloat(css.lineHeight),0,2000,v=>change(lineHeightToken,`leading-[${v}px]`));
      numericPreview(lineHeight,el,'line-height');numericPreview(relativeLineHeight,el,'line-height',value=>String(Math.round(value*1e6)/1e8));
      if(css.lineHeight==='normal'){lineHeight.value='';lineHeight.placeholder='Automatic';relativeLineHeight.placeholder='Automatic';}
      sec.append(button('Automatic line height',()=>change(lineHeightToken,'[line-height:normal]')));
      const resetLineHeight=button('Reset line height',()=>save(replaceTypography(info.className,lineHeightToken,'')));try{resetLineHeight.disabled=replaceTypography(info.className,lineHeightToken,'')===info.className;}catch{resetLineHeight.disabled=true;}sec.append(resetLineHeight);
      numericPreview(relativeNumber(sec,'Letter spacing (%)',(parseFloat(css.letterSpacing)||0)/parseFloat(css.fontSize)*100,-100,1000,v=>change(letterSpacingToken,`tracking-[${Math.round(v*1e6)/1e8}em]`)),el,'letter-spacing',value=>Math.round(value*1e6)/1e8+'em').title='Relative to this layer’s font size.';
      numericPreview(number(sec,'Letter spacing (px)',parseFloat(css.letterSpacing)||0,-100,100,v=>change(letterSpacingToken,`tracking-[${v}px]`)),el,'letter-spacing');
      select(sec,'Text alignment',['left','center','right','justify','start','end'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]),css.textAlign,v=>change(textAlignToken,'text-'+v));
      select(sec,'Font slant',[['normal','Normal'],['italic','Italic']],css.fontStyle==='italic'?'italic':'normal',v=>change(fontStyleToken,v==='italic'?'italic':'not-italic'));
      select(sec,'Text decoration',[['none','None'],['underline','Underline'],['line-through','Strikethrough'],['overline','Overline']],css.textDecorationLine,v=>change(decorationToken,v==='none'?'no-underline':v));
      select(sec,'Text case',[['none','As written'],['uppercase','Uppercase'],['lowercase','Lowercase'],['capitalize','Capitalize']],css.textTransform,v=>change(caseToken,v==='none'?'normal-case':v));
      opticalTypography(sec,css,value=>change(opticalToken,`[font-optical-sizing:${value}]`),()=>save(replace(info.className,opticalToken,'')),tokens(info.className).map(base).some(t=>t&&opticalToken(t)));
      variationTypography(sec,css,value=>change(variationToken,`[font-variation-settings:${value.replace(/ /g,'_')}]`),()=>save(replace(info.className,variationToken,'')),tokens(info.className).map(base).some(t=>t&&variationToken(t)),el);
      numericTypography(sec,css.fontVariantNumeric,value=>change(numericToken,`[font-variant-numeric:${value.replace(/ /g,'_')}]`),()=>save(replace(info.className,numericToken,'')),tokens(info.className).map(base).some(t=>t&&numericToken(t)));
      const textOverride=textOverrideToken;
      const reset=button('Reset text overrides',()=>save(replace(info.className,textOverride,'')));
      reset.disabled=!tokens(info.className).map(base).some(t=>t!==null&&textOverride(t));sec.append(reset);


    }
    if(info.canSetTag)select(sec,'HTML element',['h1','h2','h3','h4','h5','h6','p','span','div','blockquote','label'].map(n=>[n,n]),info.tag,changeTag);
    return sec;
  }
  function measurements(layer, hover, selected) {
    const d=hover.ownerDocument,w=d.defaultView,r=hover.getBoundingClientRect(),s=w.getComputedStyle(hover);
    function line(x1,y1,x2,y2,label,kind='distance') {
      if(![x1,y1,x2,y2].every(Number.isFinite))return;
      const e=document.createElement('div');e.className='measure-line '+kind;
      e.style.cssText=`left:${Math.min(x1,x2)}px;top:${Math.min(y1,y2)}px;width:${Math.max(1,Math.abs(x2-x1))}px;height:${Math.max(1,Math.abs(y2-y1))}px;`;
      const t=document.createElement('span');t.textContent=label;e.append(t);layer.append(e);
    }
    const pad={top:parseFloat(s.paddingTop),right:parseFloat(s.paddingRight),bottom:parseFloat(s.paddingBottom),left:parseFloat(s.paddingLeft)};
    const b={top:parseFloat(s.borderTopWidth),left:parseFloat(s.borderLeftWidth),bottom:parseFloat(s.borderBottomWidth),right:parseFloat(s.borderRightWidth)};
    const strips=[['top',r.left+b.left,r.top+b.top,r.width-b.left-b.right,pad.top],['bottom',r.left+b.left,r.bottom-b.bottom-pad.bottom,r.width-b.left-b.right,pad.bottom],['left',r.left+b.left,r.top+b.top+pad.top,pad.left,Math.max(0,r.height-b.top-b.bottom-pad.top-pad.bottom)],['right',r.right-b.right-pad.right,r.top+b.top+pad.top,pad.right,Math.max(0,r.height-b.top-b.bottom-pad.top-pad.bottom)]];
    for(const [side,x,y,width,height] of strips)if(pad[side]>0){const e=document.createElement('div');e.className='measure-padding';e.style.cssText=`left:${x}px;top:${y}px;width:${width}px;height:${height}px;`;layer.append(e);}
    if(pad.top)line(r.left+r.width/2,r.top+b.top,r.left+r.width/2,r.top+b.top+pad.top,`Padding ${round(pad.top)}`,'padding');
    if(pad.bottom)line(r.left+r.width/2,r.bottom-b.bottom-pad.bottom,r.left+r.width/2,r.bottom-b.bottom,`Padding ${round(pad.bottom)}`,'padding');
    if(pad.left)line(r.left+b.left,r.top+r.height/2,r.left+b.left+pad.left,r.top+r.height/2,`Padding ${round(pad.left)}`,'padding');
    if(pad.right)line(r.right-b.right-pad.right,r.top+r.height/2,r.right-b.right,r.top+r.height/2,`Padding ${round(pad.right)}`,'padding');
    const other=selected&&selected!==hover?selected:hover.parentElement;if(!other)return;
    const a=other.getBoundingClientRect();
    if(other.contains(hover)){
      const os=w.getComputedStyle(other),left=a.left+parseFloat(os.borderLeftWidth),top=a.top+parseFloat(os.borderTopWidth),right=a.right-parseFloat(os.borderRightWidth),bottom=a.bottom-parseFloat(os.borderBottomWidth);
      line(left,r.top+r.height/2,r.left,r.top+r.height/2,`${round(r.left-left)} px`);
      line(r.right,r.top+r.height/2,right,r.top+r.height/2,`${round(right-r.right)} px`);
      line(r.left+r.width/2,top,r.left+r.width/2,r.top,`${round(r.top-top)} px`);
      line(r.left+r.width/2,r.bottom,r.left+r.width/2,bottom,`${round(bottom-r.bottom)} px`);
    }else{
      const y=Math.max(r.top,Math.min(a.top+a.height/2,r.bottom)),x=Math.max(r.left,Math.min(a.left+a.width/2,r.right));
      if(r.left>=a.right)line(a.right,y,r.left,y,`${round(r.left-a.right)} px`);
      if(a.left>=r.right)line(r.right,y,a.left,y,`${round(a.left-r.right)} px`);
      if(r.top>=a.bottom)line(x,a.bottom,x,r.top,`${round(r.top-a.bottom)} px`);
      if(a.top>=r.bottom)line(x,r.bottom,x,a.top,`${round(a.top-r.bottom)} px`);
    }
  }
  const api={gridAxisEdges,gridGuideControl,drawGridGuides,gridPlacementSuggestions,suggestGridPlacement,borderClasses,cornerRadiusClasses,shadowClasses,filterClasses,expandSizeLeading,replaceTypography,fontSizeToken,letterSpacingToken,textAlignToken,fontStyleToken,decorationToken,caseToken,textOverrideToken,base,replace,nearestAnchor,inferredAnchor,axisClasses,anchorClasses,geometry,catalog,fontFamilies,fontFamilyClass,fontFamilyToken,fontWeightToken,fontWeightClass,lineHeightToken,isTextLayer,filterFonts,fontPicker,scanPageFonts,fontFaceStates,fontFaceLabel,position,appearance,effects,typography,measurements,section,field,fieldDraft,note,button,select,number,numericPreview,relativeNumber,opticalTypography,opticalToken,variationTypography,variationToken,numericTypography,numericToken};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchInspector=api;
})(typeof window==='object'?window:globalThis);
