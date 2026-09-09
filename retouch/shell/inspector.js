(function (root) {
  'use strict';
  let cornersExpanded=false,numericExpanded=false,variationExpanded=false;
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
  function field(parent, label, control) {
    const row = document.createElement('label'); row.className = 'inspector-field';
    const text = document.createElement('span'); text.textContent = label;
    control.setAttribute('aria-label', label); row.append(text, control); parent.append(row); return control;
  }
  function select(parent, label, choices, value, onChange) {
    const input = document.createElement('select');
    for (const [v, text] of choices) { const o = document.createElement('option'); o.value = v; o.textContent = text; input.append(o); }
    input.value = value; input.onchange = () => onChange(input.value); return field(parent, label, input);
  }
  function number(parent, label, value, min, max, onChange) {
    const input = document.createElement('input'); input.type = 'number'; input.min = min; input.max = max; input.step = 'any'; input.value = Number.isFinite(value) ? round(value) : '';
    input.onchange = () => { if (input.value !== '' && input.checkValidity()) onChange(Number(input.value)); };
    return field(parent, label, input);
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
  function variationTypography(parent,css,onChange,onReset,canReset,el){
    const d=el?.ownerDocument;
    const values=root.RetouchHTMLCSSValues,axes=values.parseVariations(css.fontVariationSettings);
    const details=document.createElement('details');details.open=variationExpanded;details.ontoggle=()=>{if(details.isConnected)variationExpanded=details.open;};
    const summary=document.createElement('summary');summary.textContent='Variable font axes';details.append(summary);parent.append(details);
    const axisInputs=new Map();
    const labels={wght:'Weight',wdth:'Width',opsz:'Optical size',slnt:'Slant',ital:'Italic'};
    const defaults={wght:parseFloat(css.fontWeight)||400,wdth:100,opsz:parseFloat(css.fontSize)||16,slnt:0,ital:0};
    if(axes){
      const write=next=>onChange(values.serializeVariations(next));
      for(const [tag,value]of axes){
        axisInputs.set(tag,number(details,(labels[tag]||tag)+' axis',value,-10000,10000,next=>write(axes.map(axis=>axis[0]===tag?[tag,next]:axis))));
        details.append(button('Remove '+(labels[tag]||tag)+' axis',()=>write(axes.filter(axis=>axis[0]!==tag))));
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
        let selected=metadata.selection(d,declared.family);if(!declared.files.some(file=>file.url===selected))selected=declared.files[0].url;
        const choose=select(details,'Declared font file',declared.files.map(file=>[file.url,file.label]),selected,value=>{selected=value;metadata.selection(d,declared.family,value);render();});
        const inspect=button('Inspect declared font axes',async()=>{
          inspect.disabled=true;choose.disabled=true;results.textContent='Reading font axes…';
          try{const found=await metadata.inspect(d,selected);if(details.isConnected)render(found);}catch(error){if(details.isConnected){render();results.textContent=error.message;}}finally{inspect.disabled=false;choose.disabled=false;}
        });
        function render(inspected){
          results.replaceChildren();for(const input of axisInputs.values()){input.min=-10000;input.max=10000;input.title='';}
          const found=inspected||metadata.peek(d,selected);if(!found)return;
          if(!found.length)note(results,'This declared file has no variable axes.');
          for(const axis of found){
            note(results,axis.name+' ('+axis.tag+'): '+axis.min+' to '+axis.max+' · default '+axis.default+(axis.hidden?' · hidden axis':''));
            const compatible=/^[A-Za-z0-9]{4}$/.test(axis.tag)&&axis.min>=-10000&&axis.max<=10000;
            if(compatible&&axisInputs.has(axis.tag)){const input=axisInputs.get(axis.tag);input.min=axis.min;input.max=axis.max;input.title='Declared font range; default '+axis.default;}
            const active=axes?.find(entry=>entry[0]===axis.tag);
            if(compatible&&active&&axis.min<axis.max){
              const row=document.createElement('div');row.className='font-axis-range';
              const slider=document.createElement('input');slider.type='range';slider.min=axis.min;slider.max=axis.max;slider.step='any';slider.value=active[1];
              const output=document.createElement('output');output.textContent=String(active[1]);
              field(row,'Adjust '+axis.name+' axis',slider);row.append(output);results.append(row);
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
              const restore=()=>{stopPreview();slider.value=active[1];output.textContent=String(active[1]);};let cancelled=false;
              const cancel=event=>{event.preventDefault();event.stopPropagation();cancelled=true;restore();slider.blur();};
              slider.onpointerdown=()=>{
                cancelled=false;slider.focus();const gesture=new AbortController(),options={capture:true,signal:gesture.signal};
                document.addEventListener('keydown',event=>{if(event.key==='Escape')cancel(event);},options);
                document.addEventListener('pointerup',()=>{stopPreview();gesture.abort();},{...options,once:true});
                document.addEventListener('pointercancel',()=>{cancelled=true;restore();gesture.abort();},{...options,once:true});
                window.addEventListener('blur',()=>{cancelled=true;restore();gesture.abort();},{signal:gesture.signal,once:true});
              };
              slider.oninput=()=>{if(cancelled){restore();return;}output.textContent=String(round(Number(slider.value)));axisInputs.get(axis.tag).value=round(Number(slider.value));previewValue(values.serializeVariations(axes.map(entry=>entry[0]===axis.tag?[axis.tag,Number(slider.value)]:entry)));};
              slider.onchange=()=>{stopPreview();if(!slider.isConnected||!el.isConnected)return;if(cancelled){restore();return;}const value=Number(slider.value);if(Number.isFinite(value)&&value!==active[1])queueMicrotask(()=>{if(slider.isConnected&&el.isConnected&&!cancelled)onChange(values.serializeVariations(axes.map(entry=>entry[0]===axis.tag?[axis.tag,value]:entry)));});};
              slider.onkeydown=event=>{if(event.key==='Escape')cancel(event);else cancelled=false;};
              slider.onpointercancel=()=>{cancelled=true;restore();};
              slider.title='Drag to preview; release to apply. Escape cancels before release.';
            }
            if(compatible&&axes&&(axes.length<16||active)){const use=button('Use '+axis.name+' default',()=>{const next=new Map(axes);next.set(axis.tag,axis.default);onChange(values.serializeVariations([...next]));});results.append(use);}
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
  function appearance(info, el, save) {
    const sec = section('Appearance');
    if (!el) return sec;
    const css = el.ownerDocument.defaultView.getComputedStyle(el);
    if (locked(sec,info)) return sec;
    const row = document.createElement('div'); row.className='opacity-row';
    const input = number(row,'Opacity (%)',Number(css.opacity)*100,0,100,value=>save(replace(info.className,t=>t.startsWith('opacity-'),`opacity-[${round(value/100)}]`)));
    const slider = document.createElement('input'); slider.type='range'; slider.min=0; slider.max=100; slider.value=input.value; slider.setAttribute('aria-label','Opacity');
    slider.oninput=()=>{input.value=slider.value;}; slider.onchange=()=>input.onchange(); row.append(slider); sec.append(row);
    const widthToken=t=>/^border(?:-(?:[trblxyse]))?(?:-(?:\d+(?:\.\d+)?|\[(?:length:[^\]]+|[-.\d][^\]]*)\]))?$/.test(t);
    const borderWidths=['Top','Right','Bottom','Left'].map(side=>css['border'+side+'Width']);
    const borderWidth=number(sec,'Border width (px)',borderWidths.every(v=>v===borderWidths[0])?parseFloat(borderWidths[0]):NaN,0,100,v=>{
      let next=replace(info.className,widthToken,`border-[${v}px]`);
      if(v>0&&css.borderTopStyle==='none')next=replace(next,t=>/^border(?:-[trblxyse])?-(solid|dashed|dotted|double|hidden|none)$/.test(t),'border-solid');
      save(next);
    });
    borderWidth.placeholder='Mixed';
    select(sec,'Border style',['solid','dashed','dotted','double','none'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]),css.borderTopStyle,v=>save(replace(info.className,t=>/^border(?:-[trblxyse])?-(solid|dashed|dotted|double|hidden|none)$/.test(t),'border-'+v)));
    const borderColor=document.createElement('input');borderColor.type='color';borderColor.value='#000000';
    try {const c=colorHex(css.borderTopColor,el.ownerDocument);if(c)borderColor.value=c;} catch {}
    // Color inputs accept sRGB hex, while computed CSS may use lab/oklch.
    // Show the browser's computed value separately instead of mislabelling it.
    field(sec,'Border color',borderColor);note(sec,css.borderTopColor,'computed-value');
    borderColor.onchange=()=>save(replace(info.className,t=>t.startsWith('border-')&&!widthToken(t)&&!/^border(?:-[trblxyse])?-(solid|dashed|dotted|double|hidden|none|collapse|separate|spacing-|opacity-)/.test(t),`border-[${borderColor.value}]`));
    const radius=value=>/^[\d.]+px$/.test(value)?parseFloat(value):NaN;
    const radii=[css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius];
    const allRadius=number(sec,'Corner radius (px)',radii.every(v=>v===radii[0])?radius(radii[0]):NaN,0,10000,v=>save(replace(info.className,t=>/^rounded(?:-|$)/.test(t),`rounded-[${v}px]`)));
    allRadius.placeholder=radii.every(v=>v===radii[0])?radii[0]:'Mixed';
    const corners=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Individual corners';corners.append(summary);
    for(const [name,token,property] of [['Top left','tl','borderTopLeftRadius'],['Top right','tr','borderTopRightRadius'],['Bottom right','br','borderBottomRightRadius'],['Bottom left','bl','borderBottomLeftRadius']]) {
      const field=number(corners,name+' radius (px)',radius(css[property]),0,10000,v=>save(replace(info.className,t=>t.startsWith('rounded-'+token+'-'),`rounded-${token}-[${v}px]`)));field.placeholder=css[property];
    }
    corners.open=cornersExpanded;corners.ontoggle=()=>{if(corners.isConnected)cornersExpanded=corners.open;};
    sec.append(corners);return sec;
  }
  function effects(info, el, save, notify) {
    const sec = section('Effects');
    if (!el || locked(sec,info)) return sec;
    const css=el.ownerDocument.defaultView.getComputedStyle(el);
    note(sec,css.boxShadow,'computed-value');
    const shadowMatch=t=>/^shadow(?:-|$)/.test(t);
    const presets=[['','Choose shadow…'],['shadow-none','None'],['shadow-sm','Small'],['shadow-md','Medium'],['shadow-lg','Large'],['shadow-xl','Extra large'],['shadow-inner','Inner']];
    select(sec,'Shadow preset',presets,tokens(info.className).map(base).find(t=>presets.some(([p])=>p===t))||'',value=>{if(value)save(replace(info.className,shadowMatch,value));});
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
      save(replace(info.className,shadowMatch,`shadow-[${inset.checked?'inset_':''}${px(values.x)}_${px(values.y)}_${px(values.blur)}_${px(values.spread)}_${hex}]`));
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
  const fontWeightToken=t=>/^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+(?:\.\d+)?\])$/.test(t);
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
  function fontPicker(parent,d,current,onChange){
    const choices=fontFamilies(d,current),supported=choices.some(([value])=>value===current);
    const quick=select(parent,'Page font',supported?choices:[[current,current],...choices],current,onChange);
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
      const states=fontFaceStates(d);currentStatus.textContent=fontFaceLabel(current,states);
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
  function typography(info, el, save, changeTag) {
    const sec=section('Typography'); if(!el)return sec;
    const d=el.ownerDocument, css=d.defaultView.getComputedStyle(el);
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
      const controls=[['Font size',/^text-(?:xs|sm|base|lg|[2-9]?xl|\[(?:length:)?[-.\d][^\]]*\])(?:\/.*)?$/,[['text-sm','Small'],['text-base','Body'],['text-lg','Large'],['text-2xl','Heading'],['text-4xl','Display']]],
        ['Font weight',{test:fontWeightToken},[['font-normal','Regular'],['font-medium','Medium'],['font-semibold','Semibold'],['font-bold','Bold']]]];
      // Project text styles can live outside CSS layers and outrank utilities.
      // An explicit property override must still win without dropping the style's
      // other font properties. Scope wrapping is handled by the shell afterward.
      const styled=[...el.classList].some(t=>names.includes(t));
      const change=(match,value)=>save(replace(info.className,match,styled?'!'+value:value));
      fontPicker(sec,d,css.fontFamily,value=>{const token=fontFamilyClass(value);if(token)change(fontFamilyToken,token);});
      const resetFamily=button('Reset font family',()=>save(replace(info.className,fontFamilyToken,'')));resetFamily.disabled=!tokens(info.className).map(base).some(t=>t&&fontFamilyToken(t));sec.append(resetFamily);
      for(const [label,re,choices] of controls){const token=tokens(info.className).map(base).find(t=>re.test(t));select(sec,label,[['','Inherited / custom'],...choices],choices.some(([value])=>value===token)?token:'',value=>{if(value)change(t=>re.test(t),value);});}
      number(sec,'Font weight (1–1000)',parseFloat(css.fontWeight),1,1000,v=>{const token=fontWeightClass(v);if(token)change(fontWeightToken,token);});
      const resetWeight=button('Reset font weight',()=>save(replace(info.className,fontWeightToken,'')));resetWeight.disabled=!tokens(info.className).map(base).some(t=>t&&fontWeightToken(t));sec.append(resetWeight);
      number(sec,'Font size (px)',parseFloat(css.fontSize),1,1000,v=>change(t=>controls[0][1].test(t),`text-[${v}px]`));
      const relativeLineHeight=relativeNumber(sec,'Line height (%)',parseFloat(css.lineHeight)/parseFloat(css.fontSize)*100,0,1000,v=>change(lineHeightToken,`[line-height:${Math.round(v*1e6)/1e8}]`));relativeLineHeight.title='Relative to this layer’s font size.';
      const lineHeight=number(sec,'Line height (px)',parseFloat(css.lineHeight),0,2000,v=>change(lineHeightToken,`leading-[${v}px]`));
      if(css.lineHeight==='normal'){lineHeight.value='';lineHeight.placeholder='Automatic';relativeLineHeight.placeholder='Automatic';}
      sec.append(button('Automatic line height',()=>change(lineHeightToken,'[line-height:normal]')));
      const resetLineHeight=button('Reset line height',()=>save(replace(info.className,lineHeightToken,'')));resetLineHeight.disabled=!tokens(info.className).map(base).some(t=>t&&lineHeightToken(t));sec.append(resetLineHeight);
      relativeNumber(sec,'Letter spacing (%)',(parseFloat(css.letterSpacing)||0)/parseFloat(css.fontSize)*100,-100,1000,v=>change(t=>/^-?tracking-/.test(t),`tracking-[${Math.round(v*1e6)/1e8}em]`)).title='Relative to this layer’s font size.';
      number(sec,'Letter spacing (px)',parseFloat(css.letterSpacing)||0,-100,100,v=>change(t=>/^-?tracking-/.test(t),`tracking-[${v}px]`));
      select(sec,'Text alignment',['left','center','right','justify','start','end'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]),css.textAlign,v=>change(t=>/^text-(left|center|right|justify|start|end)$/.test(t),'text-'+v));
      select(sec,'Font slant',[['normal','Normal'],['italic','Italic']],css.fontStyle==='italic'?'italic':'normal',v=>change(t=>t==='italic'||t==='not-italic',v==='italic'?'italic':'not-italic'));
      select(sec,'Text decoration',[['none','None'],['underline','Underline'],['line-through','Strikethrough'],['overline','Overline']],css.textDecorationLine,v=>change(t=>['underline','line-through','overline','no-underline'].includes(t),v==='none'?'no-underline':v));
      select(sec,'Text case',[['none','As written'],['uppercase','Uppercase'],['lowercase','Lowercase'],['capitalize','Capitalize']],css.textTransform,v=>change(t=>['uppercase','lowercase','capitalize','normal-case'].includes(t),v==='none'?'normal-case':v));
      opticalTypography(sec,css,value=>change(opticalToken,`[font-optical-sizing:${value}]`),()=>save(replace(info.className,opticalToken,'')),tokens(info.className).map(base).some(t=>t&&opticalToken(t)));
      variationTypography(sec,css,value=>change(variationToken,`[font-variation-settings:${value.replace(/ /g,'_')}]`),()=>save(replace(info.className,variationToken,'')),tokens(info.className).map(base).some(t=>t&&variationToken(t)),el);
      numericTypography(sec,css.fontVariantNumeric,value=>change(numericToken,`[font-variant-numeric:${value.replace(/ /g,'_')}]`),()=>save(replace(info.className,numericToken,'')),tokens(info.className).map(base).some(t=>t&&numericToken(t)));
      const textOverride=t=>opticalToken(t)||variationToken(t)||numericToken(t)||lineHeightToken(t)||fontFamilyToken(t)||controls.some(([,re])=>re.test(t)) || /^(?:leading-|tracking-|-tracking-|text-(?:left|center|right|justify|start|end)$)/.test(t) || ['italic','not-italic','underline','line-through','overline','no-underline','uppercase','lowercase','capitalize','normal-case'].includes(t);
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
  const api={base,replace,nearestAnchor,inferredAnchor,axisClasses,anchorClasses,geometry,catalog,fontFamilies,fontFamilyClass,fontFamilyToken,fontWeightToken,fontWeightClass,lineHeightToken,isTextLayer,filterFonts,fontPicker,scanPageFonts,fontFaceStates,fontFaceLabel,position,appearance,effects,typography,measurements,section,field,note,button,select,number,relativeNumber,opticalTypography,opticalToken,variationTypography,variationToken,numericTypography,numericToken};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchInspector=api;
})(typeof window==='object'?window:globalThis);
