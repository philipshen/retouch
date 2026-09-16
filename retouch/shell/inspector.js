(function (root) {
  'use strict';
  let cornersExpanded=false,fontPositionExpanded=false,capsExpanded=false,ligatureExpanded=false,numericExpanded=false,variationExpanded=false,shadowStackExpanded=false,underlineExpanded=false;
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
  function rotationLayoutRect(rect,width,height,angle,origin,scale=[1,1]){
    if(![rect.left,rect.top,width,height,angle,...origin,...scale].every(Number.isFinite)||width<=0||height<=0||origin.length!==2||scale.length!==2||scale.some(value=>value===0))throw Error('The rotated layer needs measurable dimensions and a two-dimensional origin.');
    const radians=angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>({x:origin[0]+(x-origin[0])*scale[0]*c-(y-origin[1])*scale[1]*s,y:origin[1]+(x-origin[0])*scale[0]*s+(y-origin[1])*scale[1]*c}));
    return {left:rect.left-Math.min(...corners.map(p=>p.x)),top:rect.top-Math.min(...corners.map(p=>p.y)),width,height};
  }
  function scaledOutline(g){
    const origin=g.transformOrigin.split(/\s+/).slice(0,2).map(parseFloat),sx=g.scaleX??1,sy=g.scaleY??1;
    if(origin.length!==2||![g.layoutLeft,g.layoutTop,g.width,g.height,g.rotation,sx,sy,...origin].every(Number.isFinite)||g.width<=0||g.height<=0||sx===0||sy===0)throw Error('The layer needs measurable two-dimensional bounds.');
    const minX=Math.min(0,g.width*sx),minY=Math.min(0,g.height*sy),x=origin[0]*(1-sx)+minX,y=origin[1]*(1-sy)+minY;
    // Absorb signed scale into the rectangle, preserving the rotation pivot.
    // Keep layer scale from distorting the outline stroke.
    return {...g,layoutLeft:g.layoutLeft+x,layoutTop:g.layoutTop+y,width:Math.abs(g.width*sx),height:Math.abs(g.height*sy),sourceTransformOrigin:g.transformOrigin,transformOrigin:(origin[0]-x)+'px '+(origin[1]-y)+'px'};
  }
  function outlineGeometry(el){const g=geometry(el,{allowRotation:true,allowScale:true,layoutOnly:true});return {...scaledOutline(g),sourceScale:el.ownerDocument.defaultView.getComputedStyle(el).scale};}
  function localPositionCorners(g,points=[[0,0],[g.width,0],[g.width,g.height],[0,g.height]]){
    if(g.referenceTransform){const m=g.referenceTransform;if(m.length!==6||!m.every(Number.isFinite))throw Error('Use a finite transform reference box.');return points.map(([x,y])=>({x:g.x+m[0]*x+m[2]*y+m[4],y:g.y+m[1]*x+m[3]*y+m[5]}));}
    const origin=(g.transformOrigin||'0px 0px').split(/\s+/);if(origin.length>2&&parseFloat(origin[2])!==0)throw Error('Use a two-dimensional transform origin.');
    const [ox,oy]=origin.slice(0,2).map(value=>/^-?(?:\d*\.)?\d+px$/.test(value)?parseFloat(value):NaN),matrix=g.transformMatrix||[1,0,0,1,0,0],angle=(g.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),sx=g.scaleX??1,sy=g.scaleY??1;
    if(matrix.length!==6||![g.x,g.y,g.width,g.height,ox,oy,sx,sy,angle,...matrix].every(Number.isFinite))throw Error('Use resolved local bounds and transform origin.');
    return points.map(([x,y])=>{const tx=matrix[0]*(x-ox)+matrix[2]*(y-oy)+matrix[4],ty=matrix[1]*(x-ox)+matrix[3]*(y-oy)+matrix[5];return {x:g.x+(g.translateX||0)+ox+tx*sx*c-ty*sy*s,y:g.y+(g.translateY||0)+oy+tx*sx*s+ty*sy*c};});
  }
  function positionGeometry(el){try{return geometry(el,{allowRotation:true,allowScale:true});}catch(error){return localPositionGeometry(el);}}
  function localPositionGeometry(el,{allowFlow=false}={}){
    const d=el.ownerDocument,w=d.defaultView,css=w.getComputedStyle(el),parent=el.offsetParent;
    const flow=css.position!=='absolute';if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||!parent||flow&&(!allowFlow||!['static','relative','sticky'].includes(css.position)||['inline','contents','none'].includes(css.display)||el.getClientRects().length!==1))throw Error('Choose a single measurable HTML layout box with a containing frame.');
    if(css.zoom&&Number(css.zoom)!==1)throw Error('Local position for zoom on the layer is not available yet.');
    let matrix;if(css.transform!=='none'){const m=new w.DOMMatrix(css.transform);if(!m.is2D||![m.a,m.b,m.c,m.d,m.e,m.f].every(Number.isFinite)||Math.abs(m.a*m.d-m.b*m.c)<1e-9)throw Error('Local positioning requires a nonzero two-dimensional transform matrix.');matrix=[m.a,m.b,m.c,m.d,m.e,m.f];}
    const rotation=(root.RetouchReactSelection||require('./react-selection.js')).rotationDegrees(css.rotate||'none'),scale=(root.RetouchFlip||require('./flip.js')).parse(css.scale||'none');
    if(!Number.isFinite(rotation)||!scale||scale.length!==2||scale.some(value=>value===0))throw Error('Local positioning requires a nonzero two-dimensional rotation and scale.');
    for(let node=el;node;node=node.parentElement)if(node.namespaceURI!=='http://www.w3.org/1999/xhtml')throw Error('Local HTML position inside SVG is not available yet.');
    const pixel=property=>{const value=css.getPropertyValue(property);if(!/^-?(?:\d*\.)?\d+px$/.test(value))throw Error('Local position requires resolved pixel dimensions and insets.');return parseFloat(value);};
    const dimension=axis=>pixel(axis)+(css.boxSizing==='content-box'?(axis==='width'?['left','right']:['top','bottom']).reduce((sum,edge)=>sum+pixel('padding-'+edge)+pixel('border-'+edge+'-width'),0):0);
    const g={localCoordinates:true,...(flow?{localFlow:true}:{}),x:flow?el.offsetLeft:pixel('left')+pixel('margin-left'),y:flow?el.offsetTop:pixel('top')+pixel('margin-top'),width:dimension('width'),height:dimension('height'),parentWidth:parent.clientWidth,parentHeight:parent.clientHeight,parentLabel:'<'+parent.localName+'>'};
    const contentReference=['content-box','fill-box'].includes(css.transformBox);
    if(css.translate&&css.translate!=='none'){const values=(root.RetouchTranslateValues||require('./translate-values.js')).parse(css.translate),sizes=[g.width,g.height];if(contentReference)for(const [i,edges]of [[0,['left','right']],[1,['top','bottom']]])sizes[i]-=edges.reduce((sum,edge)=>sum+pixel('padding-'+edge)+pixel('border-'+edge+'-width'),0);g.translate=css.translate;[g.translateX,g.translateY]=values.map((value,i)=>value.pixels+value.percent*sizes[i]/100);}
    if(contentReference||flow){
      // Computed origins can lose the reference-box offset. Recover the border
      // origin from the rendered bounds and affine axes without probing inside
      // the layer, which also works for replaced elements such as images.
      const probe=root.RetouchSVGDraw||require('./svg-draw.js'),frame=probe.stableNativeSpace(parent).matrix,authored=new w.DOMMatrix(matrix||[1,0,0,1,0,0]);authored.e=authored.f=0;const local=new w.DOMMatrix().rotate(rotation).scale(scale[0],scale[1]).multiply(authored),screen=frame.multiply(local);screen.e=screen.f=0;
      const offsets=[[0,0],[g.width,0],[g.width,g.height],[0,g.height]].map(([x,y])=>new w.DOMPoint(x,y).matrixTransform(screen)),rect=el.getBoundingClientRect(),origin=new w.DOMPoint(rect.left-Math.min(...offsets.map(p=>p.x)),rect.top-Math.min(...offsets.map(p=>p.y))).matrixTransform(frame.inverse());g.referenceTransform=[local.a,local.b,local.c,local.d,origin.x-g.x,origin.y-g.y];
    }
    if(matrix||rotation||scale.some(value=>value!==1)){if(matrix)g.transformMatrix=matrix;g.rotation=rotation;g.scaleX=scale[0];g.scaleY=scale[1];g.transformOrigin=css.transformOrigin;localPositionCorners(g);}
    if(!['x','y','width','height','parentWidth','parentHeight'].every(key=>Number.isFinite(g[key])&&Math.abs(g[key])<=100000)||g.width<=0||g.height<=0)throw Error('The layer needs measurable bounds within 100,000 pixels.');return g;
  }
  function geometry(el,{allowRotation=false,allowScale=false,layoutOnly=false}={}) {
    const d = el.ownerDocument, w = d.defaultView;
    for (let n = el; n && n !== d.documentElement; n = n.parentElement) {
      const s = w.getComputedStyle(n);
      if (s.transform !== 'none' || (s.rotate && !['none','0deg'].includes(s.rotate) && !(allowRotation&&n===el&&Number.isFinite(root.RetouchReactSelection.rotationDegrees(s.rotate)))) || (s.scale && s.scale !== 'none' && !(allowScale&&n===el)) || (s.translate && s.translate !== 'none') || (s.zoom && Number(s.zoom) !== 1)) {
        throw new Error('Anchor placement requires an element and ancestors without transforms or zoom.');
      }
    }
    let rect = el.getBoundingClientRect();
    const css=w.getComputedStyle(el),rotation=allowRotation?root.RetouchReactSelection.rotationDegrees(css.rotate):0;
    const scale=allowScale?(root.RetouchFlip||require('./flip.js')).parse(css.scale||'none'):[1,1];
    if(!scale||scale.length>2||scale.some(value=>value===0))throw Error('Selection reflection needs a nonzero two-dimensional scale.');
    if(rotation||allowScale){
      const dimension=axis=>{const value=css.getPropertyValue(axis);if(!/^-?(?:\d*\.)?\d+px$/.test(value))throw Error('The rotated layer needs resolved pixel dimensions.');return parseFloat(value)+(css.boxSizing==='content-box'?(axis==='width'?['left','right']:['top','bottom']).reduce((sum,edge)=>sum+(parseFloat(css.getPropertyValue('padding-'+edge))||0)+(parseFloat(css.getPropertyValue('border-'+edge+'-width'))||0),0):0);};
      const origin=css.transformOrigin.split(/\s+/);if(origin.length>2&&parseFloat(origin[2])!==0)throw Error('A three-dimensional transform origin is not supported for positioning yet.');
      rect=rotationLayoutRect(rect,dimension('width'),dimension('height'),rotation,origin.slice(0,2).map(value=>/^-?(?:\d*\.)?\d+px$/.test(value)?parseFloat(value):NaN),scale);
    }
    if(layoutOnly)return {layoutLeft:rect.left,layoutTop:rect.top,width:rect.width,height:rect.height,rotation,transformOrigin:css.transformOrigin,...(allowScale?{scaleX:scale[0],scaleY:scale[1]}:{})};
    const original = el.getAttribute('style');
    // Ask layout for the real containing block after switching to absolute.
    const alreadyAbsolute=w.getComputedStyle(el).position==='absolute';
    if(!alreadyAbsolute)el.style.setProperty('position', 'absolute', 'important');
    const parent = el.offsetParent;
    if(!alreadyAbsolute){
      // Reset through the attribute API before removing an originally absent style.
      // CSSOM can otherwise defer serialization and recreate style="" on read.
      if(original===null){el.setAttribute('style','');el.removeAttribute('style');}
      else el.setAttribute('style',original);
    }
    const viewport = !parent || (parent === d.body && w.getComputedStyle(parent).position === 'static' && ['none',''].includes(w.getComputedStyle(parent).rotate||''));
    const pr = viewport ? { left: -w.scrollX, top: -w.scrollY } : parent.getBoundingClientRect();
    return {
      ...(allowRotation?{rotation,layoutLeft:rect.left,layoutTop:rect.top}:{}),
      ...(allowScale?{scaleX:scale[0],scaleY:scale[1]}:{}),
      x: rect.left - pr.left - (viewport ? 0 : parent.clientLeft) + (viewport ? 0 : parent.scrollLeft),
      y: rect.top - pr.top - (viewport ? 0 : parent.clientTop) + (viewport ? 0 : parent.scrollTop),
      width: rect.width, height: rect.height,
      parentWidth: viewport ? d.documentElement.clientWidth : parent.clientWidth,
      parentHeight: viewport ? w.innerHeight : parent.clientHeight,
      parentLabel: viewport ? 'Page viewport' : `<${parent.tagName.toLowerCase()}>${parent.id ? ' #' + parent.id : ''}`,
    };
  }
  const typeProperties = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variation-settings', 'font-optical-sizing', 'font-variant-numeric', 'font-variant-ligatures', 'font-variant-caps', 'font-variant-position', 'line-height', 'letter-spacing', 'text-indent', 'text-wrap', 'text-box', 'text-transform', 'text-decoration-line','text-decoration-style','text-decoration-thickness','text-underline-offset','text-decoration-skip-ink','text-decoration-color'];
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
  function layoutParent(el){
    for(let parent=el.parentElement;parent;parent=parent.parentElement)if(el.ownerDocument.defaultView.getComputedStyle(parent).display!=='contents')return parent;
    return null;
  }
  function gridGuideControl(parent){
    const input=document.createElement('input');input.type='checkbox';input.checked=!!root.RetouchGridGuidesEnabled;
    input.onchange=()=>{root.RetouchGridGuidesEnabled=input.checked;};field(parent,'Show grid guides',input);
  }
  function drawGridGuides(overlay,selected){
    if(!selected?.isConnected)return;
    const view=selected.ownerDocument.defaultView;let grid=selected,css=view.getComputedStyle(grid);
    if(!['grid','inline-grid'].includes(css.display)){grid=layoutParent(selected);if(!grid)return;css=view.getComputedStyle(grid);}
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
  function canvasTool(action,start){
    const control=button((action==='move'?'Move':'Resize')+' on canvas',()=>start(control));control.dataset.canvasTool=action;control.retouchCanvasStart=initial=>start(control,initial);return control;
  }
  function numericPreview(input,el,property,format=value=>value+'px',render=null){
    input.retouchPreviewTarget=el;
    input.retouchNumericPreview=()=>{
      const preview=root.RetouchPaintPicker.propertyPreview({el,input,property,respectScope:true});
      return {current:()=>el.isConnected&&preview.current(),update:value=>{preview.update(format(value));render?.(value);},restore:()=>{preview.restore();render?.(null);}};
    };
    if(property==='rotate'){const control=button('Rotate on canvas',()=>root.rotateLayerOnCanvas?.(el,input));control.dataset.canvasTool='rotate';input.parentElement.after(control);}
    return input;
  }
  function scrubSpeed(dy){return dy < -40?2:dy>80?.25:dy>40?.5:1;}
  function sharedLengthDrag(input,getElements,property,ready,save){
    const values=()=>{if(!ready())return null;const elements=getElements(),items=elements.map(el=>/^(-?(?:\d*\.)?\d+)(px|em|rem|%)$/.exec(el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue(property).trim()));if(!items.length||items.some(item=>!item||item[2]!==items[0][2]))return null;return {elements,unit:items[0][2],numbers:items.map(item=>Number(item[1]))};};
    input.retouchNumericInitialValue=()=>{const current=values();return current?current.numbers[0]+current.unit:'';};
    numericLabelDrag(input,()=>{const current=values();if(!current)return null;const {numbers,unit}=current,base=numbers[0];return {value:base,min:base+(property==='text-decoration-thickness'?0:-10000)-Math.min(...numbers),max:base+10000-Math.max(...numbers),format:value=>value+unit};});
    input.parentElement.querySelector('span').title='Drag to adjust each selected length by the same amount. Values must use the same unit. Escape cancels.';
    input.retouchNumericPreview=()=>{
      const current=values();if(!current)throw Error('Choose explicit lengths with the same unit before dragging.');const {elements,numbers,unit}=current,original=input.value,previews=elements.map(el=>root.RetouchPaintPicker.propertyPreview({el,input,property,respectScope:true}));
      const next=value=>numbers.map(number=>Math.round((number+value-numbers[0])*1e6)/1e6+unit);
      return {current:()=>input.isConnected&&!input.disabled&&getElements().every((el,i)=>el===elements[i]&&el.isConnected)&&previews.every(preview=>preview.current()),update:value=>{const result=next(value);previews.forEach((preview,i)=>preview.update(result[i]));},restore:()=>previews.forEach(preview=>preview.restore()),commit:value=>{if(value===numbers[0]){input.value=original;return;}if(ready())save(next(value));}};
    };
  }
  function numericLabelDrag(input,read=raw=>({value:Number(raw)})){
    const label=input.parentElement.querySelector('span'),interruptions=['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'],handles=new WeakMap();let drag=null;
    label.style.cursor='ew-resize';label.style.touchAction='none';label.style.userSelect='none';
    label.title='Drag to adjust; move up for faster values or down for finer values. Shift: 10 units; Alt/Option on label: 0.1 units. Escape cancels.';
    input.title=(input.title?input.title+' ':'')+'Alt/Option-drag inside the field to scrub.';
    label.dataset.numericScrub='';
    const stop=cancel=>{
      if(!drag)return;const saved=drag;cancel=cancel||saved.preview?.current?.()===false;drag=null;root.cancelAnimationFrame(saved.raf);saved.hint.remove();
      for(const type of interruptions)root.removeEventListener(type,abort);saved.observer.disconnect();saved.preview?.restore();
      if(cancel)input.value=saved.initial;
      if(saved.id!==null&&saved.target.hasPointerCapture(saved.id))saved.target.releasePointerCapture(saved.id);
      if(!cancel&&input.isConnected&&input.value!==saved.initial&&input.checkValidity()){if(saved.keyboard)saved.options.onCommit?.();if(saved.preview?.commit)saved.preview.commit(saved.value);else input.dispatchEvent(new Event('change',{bubbles:true}));}
    };
    const abort=()=>stop(true);
    input.addEventListener('blur',abort);
    const start=(event,keyboard=false)=>{
      const options=handles.get(event.currentTarget)||{},raw=options.initialValue?String(options.initialValue()):input.retouchNumericInitialValue?String(input.retouchNumericInitialValue()):input.value;
      if((!keyboard&&event.button!==0)||drag||!input.isConnected||input.disabled||input.readOnly||raw===''||!input.checkValidity())return;
      const parsed=input.retouchNumericRead?input.retouchNumericRead(raw):read(raw);if(!parsed||!Number.isFinite(parsed.value))return;if(options.minimum)parsed.min=Math.max(parsed.min??-Infinity,options.minimum());
      if(options.canvas)for(let parent=input.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
      event.preventDefault();event.stopPropagation();(keyboard?event.currentTarget:input).focus({preventScroll:true});
      drag={keyboard,held:new Set(),options,id:keyboard?null:event.pointerId,target:event.currentTarget,inputDrag:event.currentTarget===input,y:event.clientY,x:options.axis==='y'?event.clientY:event.clientX,initial:input.value,value:parsed.value,format:parsed.format||String,min:parsed.min,max:parsed.max};
      try{drag.preview=input.retouchNumericPreview?.();}catch(error){drag=null;input.setCustomValidity(error.message);input.reportValidity();return;}
      drag.hint=document.createElement('div');drag.hint.dataset.numericScrubSpeed='';drag.hint.setAttribute('role','status');Object.assign(drag.hint.style,{position:'fixed',bottom:'116px',left:'50%',transform:'translateX(-50%)',padding:'8px 12px',border:'1px solid var(--line)',borderRadius:'6px',background:'var(--panel)',color:'var(--ink)',fontSize:'11px',zIndex:41});drag.hint.textContent='1x';document.body.append(drag.hint);
      drag.observer=new MutationObserver(()=>{if(!input.isConnected||drag?.preview?.current?.()===false)abort();});drag.observer.observe(document.body,{childList:true,subtree:true});
      if(!keyboard)drag.target.setPointerCapture(event.pointerId);for(const type of interruptions)root.addEventListener(type,abort);const tick=()=>{if(!drag)return;if(!input.isConnected||drag.preview?.current?.()===false){abort();return;}drag.raf=root.requestAnimationFrame(tick);};drag.raf=root.requestAnimationFrame(tick);
    };
    label.addEventListener('pointerdown',start);input.addEventListener('pointerdown',event=>{if(event.altKey)start(event);});
    const applyDelta=delta=>{if(!drag)return;if(drag.preview?.current?.()===false){abort();return;}const min=drag.min??(input.min===''?-Infinity:Number(input.min)),max=drag.max??(input.max===''?Infinity:Number(input.max));drag.value=Math.max(min,Math.min(max,Math.round((drag.value+delta)*1e6)/1e6));input.value=drag.format(drag.value);try{drag.preview?.update(drag.value);}catch(error){abort();input.setCustomValidity(error.message);input.reportValidity();}};
    const move=event=>{
      if(!drag||drag.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();
      if(drag.preview?.current?.()===false){abort();return;}const coordinate=drag.options.axis==='y'?event.clientY:event.clientX,delta=(coordinate-drag.x)/(drag.options.scale?.()||1);drag.x=coordinate;const speed=drag.options.canvas?1:scrubSpeed(event.clientY-drag.y);drag.hint.textContent=({2:'2x',1:'1x',.5:'1/2',.25:'1/4'})[speed];
      applyDelta(delta*speed*(event.altKey&&!drag.inputDrag?0.1:event.shiftKey?10:1));
    };
    label.addEventListener('pointermove',move);input.addEventListener('pointermove',move);
    for(const target of [label,input])target.addEventListener('pointerup',event=>{if(drag?.id===event.pointerId){event.preventDefault();event.stopPropagation();stop(false);}});
    for(const target of [label,input])for(const type of ['pointercancel','lostpointercapture'])target.addEventListener(type,event=>{if(drag?.id===event.pointerId)stop(true);});
    input.addEventListener('keydown',event=>{if(drag&&!event.isComposing&&['Escape','Enter'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();stop(event.key==='Escape');}},true);
    input.retouchNumericHandle=(target,options={})=>{
      handles.set(target,options);const blocked=new Set(),up=event=>{if(drag?.id===event.pointerId){event.preventDefault();event.stopPropagation();stop(false);}},cancel=event=>{if(drag?.id===event.pointerId)stop(true);},blur=()=>{if(drag?.target===target)abort();};
      const down=event=>{if(!options.canvas||event.isComposing)return;
        if(drag?.keyboard&&drag.target===target&&['Escape','Enter'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='Escape')for(const key of drag.held)blocked.add(key);stop(event.key==='Escape');return;}
        if(event.metaKey||event.ctrlKey)return;const keys=options.axis==='y'?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight'];if(!keys.includes(event.key))return;event.preventDefault();event.stopPropagation();if(blocked.has(event.key))return;if(!drag)start(event,true);if(!drag?.keyboard||drag.target!==target)return;drag.held.add(event.key);applyDelta((event.key===keys[0]?-1:1)*(event.shiftKey?10:event.altKey?0.1:1));
      };
      const release=event=>{blocked.delete(event.key);if(drag?.keyboard&&drag.target===target&&drag.held.has(event.key)){event.preventDefault();event.stopPropagation();drag.held.delete(event.key);if(!drag.held.size)stop(false);}};
      const events=[['pointerdown',start],['pointermove',move],['pointerup',up],['pointercancel',cancel],['lostpointercapture',cancel],['keydown',down],['keyup',release],['blur',blur]];for(const [name,fn]of events)target.addEventListener(name,fn);return ()=>{for(const [name,fn]of events)target.removeEventListener(name,fn);handles.delete(target);};
    };
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
    const normalize=root.RetouchNumericExpression.calculation(input,{unit:'%'});
    let submitted=null;
    const commit=()=>{
      if(input.value===''||!normalize()||!input.checkValidity())return;
      const next=input.value===initial&&Number.isFinite(value)?value:Number(input.value);
      if(next===submitted)return;submitted=next;onChange(next);
    };
    input.onchange=commit;input.retouchCommitRelative=commit;fieldDraft(input);
    const action=button('Use %',commit);
    action.setAttribute('aria-label','Use relative '+label.replace(' (%)','').toLowerCase());
    action.title='Convert to spacing relative to the font size.';row.append(action);
    return input;
  }
  const fontPositionToken=t=>/^\[font-variant-position:.+\]$/.test(t);
  const textSizeLimits=['min-width','min-height','max-width','max-height','min-inline-size','min-block-size','max-inline-size','max-block-size'];
  const textResizeProperties=[...textSizeLimits,'aspect-ratio','width','height','inline-size','block-size','white-space','white-space-collapse','text-wrap','text-wrap-mode','text-wrap-style','flex','flex-grow','flex-shrink','flex-basis','align-self','justify-self','place-self'];
  function textResizeChanges(css,mode,parent=null){
    if(!['width','height','fixed'].includes(mode))throw Error('Choose a supported text sizing mode.');
    const width=parseFloat(css.width),height=parseFloat(css.height);
    if(![width,height].every(value=>Number.isFinite(value)&&value>0&&value<=100000))throw Error('The text layer has no measurable size.');
    const changes={'aspect-ratio':'auto',...Object.fromEntries(textSizeLimits.map(key=>[key,key.startsWith('min-')?'0px':'none'])),width:mode==='width'?'max-content':width+'px',height:mode==='fixed'?height+'px':'auto','white-space':mode==='width'?'pre':'pre-wrap','text-wrap':(mode==='width'?'nowrap':'wrap')+(['balance','pretty','stable'].includes(css.getPropertyValue('text-wrap-style'))?' '+css.getPropertyValue('text-wrap-style'):'')};
    if(parent&&/^(?:inline-)?flex$/.test(parent.display))Object.assign(changes,{'flex-grow':'0','flex-shrink':'0','flex-basis':'auto'});
    const axes=(root.RetouchLayout||require('./layout.js')).layoutAxes({writingMode:parent?.writingMode,direction:parent?.flexDirection});
    const property=parent&&/^(?:inline-)?grid$/.test(parent.display)?(axes.inline==='height'?'justify-self':'align-self'):parent&&/^(?:inline-)?flex$/.test(parent.display)&&axes.main==='width'?'align-self':null;
    const own=property==='justify-self'?css.justifySelf:css.alignSelf,alignment=own==='auto'?(property==='justify-self'?parent?.justifyItems:parent?.alignItems):own;
    if(mode!=='fixed'&&property&&['normal','stretch'].includes(alignment))changes[property]='flex-start';
    return changes;
  }
  function textResizeMode(sizes,css,parent=null){
    const fixed=value=>typeof value==='string'&&/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value);
    const mode=sizes.width==='max-content'&&sizes.height==='auto'?'width':fixed(sizes.width)&&sizes.height==='auto'?'height':fixed(sizes.width)&&fixed(sizes.height)?'fixed':null;
    if(!mode||css.aspectRatio&&css.aspectRatio!=='auto')return null;
    if(textSizeLimits.some(key=>{const value=css.getPropertyValue?.(key);return value&&(key.startsWith('min-')?!['0px','auto'].includes(value):value!=='none');}))return null;
    if(parent&&/^(?:inline-)?flex$/.test(parent.display)&&(Number(css.flexGrow)!==0||Number(css.flexShrink)!==0||css.flexBasis!=='auto'))return null;
    if(mode!=='fixed'){
      const axes=(root.RetouchLayout||require('./layout.js')).layoutAxes({writingMode:parent?.writingMode,direction:parent?.flexDirection});
      const property=parent&&/^(?:inline-)?grid$/.test(parent.display)?(axes.inline==='height'?'justifySelf':'alignSelf'):parent&&/^(?:inline-)?flex$/.test(parent.display)&&axes.main==='width'?'alignSelf':null;
      const own=property&&css[property],alignment=own==='auto'?parent[property==='justifySelf'?'justifyItems':'alignItems']:own;
      if(property&&['normal','stretch'].includes(alignment))return null;
    }
    return mode;
  }
  function currentTextResizeMode(el){
    try{const styles=el.computedStyleMap(),parent=layoutParent(el),view=el.ownerDocument.defaultView;return textResizeMode({width:styles.get('width').toString(),height:styles.get('height').toString()},view.getComputedStyle(el),parent?view.getComputedStyle(parent):null);}catch{return null;}
  }
  function sharedTextResizing(parent,getElements,ready,onChange){
    const eligible=el=>el?.isConnected&&isTextLayer(el.localName)&&el.namespaceURI==='http://www.w3.org/1999/xhtml'&&!['inline','contents','none'].includes(el.ownerDocument.defaultView.getComputedStyle(el).display);
    if(!getElements().every(eligible))return;
    const available=()=>ready()&&getElements().every(el=>eligible(el)&&textResizeProperties.every(key=>el.style.getPropertyPriority(key)!=='important'));
    const modes=getElements().map(currentTextResizeMode),mixed=modes.some(mode=>mode!==modes[0]),current=mixed?null:modes[0];
    const row=document.createElement('div'),label=document.createElement('span'),group=document.createElement('div');row.className='text-resize-controls';label.className='hint';label.textContent=mixed?'Resizing · Mixed':'Resizing';group.className='layout-mode-segments';row.dataset.textSizingMode=mixed?'mixed':current||'custom';row.append(label,group);parent.append(row);
    for(const [mode,name]of [['width','Auto width'],['height','Auto height'],['fixed','Fixed size']]){
      const control=button(name,async()=>{if(!row.isConnected||!available())return;try{const changes=getElements().map(el=>textResizeChanges(el.ownerDocument.defaultView.getComputedStyle(el),mode,layoutParent(el)?el.ownerDocument.defaultView.getComputedStyle(layoutParent(el)):null));root.RetouchPanelFocus?.queue(control);await onChange(changes);}catch(error){note(parent,error.message,'refused');}});
      control.setAttribute('aria-label','Shared '+name);control.setAttribute('aria-pressed',String(current===mode));control.disabled=!available();control.title=control.disabled?'Preview the selected edit range and resolve important inline sizing or wrapping rules.':mode==='width'?'Fit each layer to its own text, preserving explicit line breaks.':mode==='height'?'Keep each layer’s width and fit its height to wrapped text.':'Keep each layer’s current width and height.';if(!control.disabled)control.title+=' Clears size limits and aspect ratio in the selected screen range.';group.append(control);
    }
    root.RetouchInspectorUI?.keyboardToolbar(group,'Shared text resizing',{role:'group'});
  }
  function textResizing(parent,el,onChange,ready=()=>true){
    sharedTextResizing(parent,()=>[el],ready,changes=>onChange(changes[0]));
    const row=parent.querySelector('.text-resize-controls');if(!row)return;
    row.querySelector('[role="group"]')?.setAttribute('aria-label','Text resizing');
    for(const button of row.querySelectorAll('button'))button.setAttribute('aria-label',button.getAttribute('aria-label').replace(/^Shared /,''));
  }
  function wrapTypography(parent,css,onChange,onReset,canReset){
    const value=css.getPropertyValue('text-wrap'),choices=[['wrap','Auto'],['balance','Balance'],['pretty','Pretty'],['nowrap','No wrap']].filter(([key])=>CSS.supports('text-wrap',key));
    if(!choices.length)return;
    if(value&&!choices.some(([key])=>key===value))choices.unshift([value,'Custom']);
    const input=select(parent,'Wrap style',choices,value,onChange);input.title='Auto fills each line. Balance evens out short text. Pretty improves line endings. No wrap keeps text on one line.';
    const row=input.closest('.inspector-field'),holder=document.createElement('div');holder.className='property-row';holder.dataset.typeWrap='true';row.before(holder);const reset=button('↺',onReset);reset.setAttribute('aria-label','Reset wrap style');reset.title='Reset wrap style';reset.classList.add('property-reset');reset.disabled=!canReset;holder.append(row,reset);
  }
  function textVerticalLayout(css){
    if(css.writingMode&&css.writingMode!=='horizontal-tb'||css.display==='inline'||css.display==='contents'||css.display==='none')return null;
    if(/^(?:inline-)?flex$/.test(css.display)){
      const column=css.flexDirection.startsWith('column');
      return {property:column?'justify-content':css.flexWrap==='nowrap'?'align-items':'align-content',reverse:column?css.flexDirection==='column-reverse':css.flexWrap==='wrap-reverse'};
    }
    return ['block','inline-block','flow-root','grid','inline-grid','list-item','table-cell'].includes(css.display)?{property:'align-content',reverse:false}:null;
  }
  const verticalAlignmentMatchers={
    'align-content':t=>/^(?:content-(?:normal|center|start|end|between|around|evenly|baseline|stretch)|\[align-content:.+\])$/.test(t),
    'align-items':t=>/^(?:items-(?:start|end|center|baseline|stretch|baseline-last)|\[align-items:.+\])$/.test(t),
    'justify-content':t=>/^(?:justify-(?:normal|start|end|center|between|around|evenly|stretch)|\[justify-content:.+\])$/.test(t)
  };
  function textVerticalValue(value,reverse=false){
    if(value==='center')return 'center';if(value==='start')return 'top';if(value==='end')return 'bottom';
    if(['flex-start','normal','stretch'].includes(value))return reverse?'bottom':'top';if(value==='flex-end')return reverse?'top':'bottom';return 'custom';
  }
  function verticalAlignmentTypography(parent,css,onChange,onReset,hasOwn){
    const layout=textVerticalLayout(css);if(!layout)return;
    const {property,reverse}=layout,current=textVerticalValue(css.getPropertyValue(property),reverse);
    const holder=document.createElement('div');holder.className='property-row';holder.dataset.textVerticalAlignment='true';parent.append(holder);
    const choices=[['top','Top'],['center','Middle'],['bottom','Bottom']];if(current==='custom')choices.unshift(['custom','Custom']);
    const input=select(holder,'Vertical text alignment',choices,current,value=>{if(value==='custom')return;onChange(property,value==='center'?'center':(value==='top')!==reverse?'flex-start':'flex-end');});input.title='Align text within its existing box. Increase the height to leave room above or below the text.';
    const reset=button('↺',()=>onReset(property));reset.setAttribute('aria-label','Reset vertical text alignment');reset.title='Reset vertical text alignment';reset.classList.add('property-reset');reset.disabled=!hasOwn(property);holder.append(reset);
  }
  const textBoxToken=t=>/^\[text-box(?:-trim|-edge)?:.+\]$/.test(t);
  function sharedVerticalAlignment(parent,getElements,ready,onChange,hasOwn){
    const read=()=>getElements().map(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el),layout=textVerticalLayout(css);if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||!isTextLayer(el.localName)||!layout)return null;return {...layout,current:textVerticalValue(css.getPropertyValue(layout.property),layout.reverse)};}),layouts=read();if(layouts.some(value=>!value))return;
    const holder=document.createElement('div');holder.className='property-row';holder.dataset.sharedTextVerticalAlignment='true';parent.append(holder);
    const mixed=layouts.some(layout=>layout.current!==layouts[0].current),choices=[['top','Top'],['center','Middle'],['bottom','Bottom']];if(mixed)choices.unshift(['mixed','Mixed']);else if(layouts[0].current==='custom')choices.unshift(['custom','Custom']);
    const write=value=>{if(!holder.isConnected||value!==null&&!['top','center','bottom'].includes(value))return;const current=read();if(current.some(layout=>!layout)||!ready(current,value===null))return;onChange(current.map(layout=>({property:layout.property,value:value===null?null:value==='center'?'center':(value==='top')!==layout.reverse?'flex-start':'flex-end'})));};
    const input=select(holder,'Shared vertical text alignment',choices,mixed?'mixed':layouts[0].current,write);input.disabled=!ready(layouts,false);
    const reset=button('↺',()=>write(null));reset.classList.add('property-reset');reset.setAttribute('aria-label','Reset shared vertical text alignment');reset.title='Reset shared vertical text alignment';reset.disabled=!ready(layouts,true)||!layouts.some((layout,index)=>hasOwn(index,layout.property));holder.append(reset);
  }
  function verticalTrimTypography(parent,css,onChange,onReset,canReset){
    if(!CSS.supports('text-box','trim-both cap alphabetic'))return;
    const trim=css.getPropertyValue('text-box-trim'),edge=css.getPropertyValue('text-box-edge');
    const current=trim==='none'?'normal':trim==='trim-both'&&edge==='cap alphabetic'?'trim-both cap alphabetic':css.getPropertyValue('text-box');
    const choices=[['normal','None'],['trim-both cap alphabetic','Cap height']];if(current&&!choices.some(([value])=>value===current))choices.unshift([current,'Custom']);
    const input=select(parent,'Vertical trim',choices,current,onChange);input.title='Cap height removes extra space above capital letters and below the alphabetic baseline. Text content and line height stay unchanged.';
    const field=input.closest('.inspector-field'),row=document.createElement('div');row.className='property-row';row.dataset.typeTrim='true';field.before(row);row.append(field);
    const reset=button('↺',onReset);reset.setAttribute('aria-label','Reset vertical trim');reset.title='Reset vertical trim';reset.classList.add('property-reset');reset.disabled=!canReset;row.append(reset);
  }
  const truncationToken=t=>/^(?:line-clamp-.+|\[-webkit-line-clamp:.+\])$/.test(t);
  const truncationProperties=['line-clamp','-webkit-line-clamp','display','overflow','overflow-x','overflow-y','-webkit-box-orient'];
  function sharedTruncationTypography(parent,getElements,ready,onChange,canReset){
    const elements=getElements();if(!elements.every(el=>el?.isConnected&&el.namespaceURI==='http://www.w3.org/1999/xhtml'&&isTextLayer(el.localName)&&el.ownerDocument.defaultView.CSS.supports('-webkit-line-clamp','3')))return;
    const values=elements.map(el=>{const value=Number(el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue('-webkit-line-clamp'));return Number.isInteger(value)&&value>0?value:0;}),mixed=values.some(value=>value!==values[0]),active=values.some(Boolean);
    const group=document.createElement('div');group.dataset.typeTruncation='true';parent.append(group);
    const available=reset=>ready()&&getElements().every(el=>el?.isConnected&&(reset||truncationProperties.every(key=>el.style.getPropertyPriority(key)!=='important')));
    const refusal=()=>!ready()?'Switch to a screen inside the selected edit range.':'An important inline rule controls text truncation.';
    const write=value=>{if(!group.isConnected||!available(value===null)||value!==null&&value!=='none'&&(!Number.isInteger(value)||value<1||value>1000))return;return onChange(value);};
    const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=values.every(Boolean);toggle.indeterminate=active&&!toggle.checked;toggle.disabled=!available(false);toggle.onchange=()=>write(toggle.checked?3:'none');field(group,'Shared Truncate text',toggle);toggle.closest('.inspector-field').querySelector('span').textContent='Truncate text';toggle.title=toggle.disabled?refusal():'Limit visible text on every selected layer without deleting its content.';
    const maximum=number(group,'Shared Max lines',mixed?NaN:values[0]||3,1,1000,write);maximum.step='1';maximum.disabled=!active||!available(false);maximum.title=!available(false)?refusal():active?'Maximum visible lines for the selected screen scope.':'Enable truncation to set a line limit.';maximum.placeholder=mixed?'Mixed':'';maximum.closest('.inspector-field').querySelector('span').textContent='Max lines';fieldDraft(maximum);
    const reset=button('↺',()=>write(null));reset.setAttribute('aria-label','Reset shared text truncation');reset.title='Reset shared text truncation';reset.classList.add('property-reset');reset.disabled=!canReset||!available(true);
    const row=toggle.closest('.inspector-field'),holder=document.createElement('div');holder.className='property-row';row.before(holder);holder.append(row,reset);
  }
  function truncationTypography(parent,el,ready,onChange,canReset){
    sharedTruncationTypography(parent,()=>[el],ready,onChange,canReset);
    const group=parent.querySelector('[data-type-truncation]');if(!group)return;
    for(const control of group.querySelectorAll('[aria-label]'))control.setAttribute('aria-label',control.getAttribute('aria-label').replace(/^Shared /,'').replace(/^Reset shared /,'Reset '));
    const toggle=group.querySelector('input[type="checkbox"]');if(!toggle.disabled)toggle.title='Limit visible text without deleting its content.';
    group.querySelector('.property-reset').title='Reset text truncation';
  }
  function underlineTypography(parent,css,onChange,onReset,hasOwn,el){
    const details=document.createElement('details'),summary=document.createElement('summary');details.className='underline-typography';details.open=underlineExpanded;details.ontoggle=()=>{if(details.isConnected)underlineExpanded=details.open;};summary.textContent='Underline details';details.append(summary);parent.append(details);
    const choices={'text-decoration-style':[['solid','Solid'],['dotted','Dotted'],['dashed','Dashed'],['double','Double'],['wavy','Wavy']],'text-decoration-skip-ink':[['auto','Auto'],['none','None'],['all','All']]};
    for(const [property,label]of [['text-decoration-style','Underline style'],['text-decoration-thickness','Underline thickness'],['text-underline-offset','Underline offset'],['text-decoration-skip-ink','Underline skip ink'],['text-decoration-color','Underline color']]){
      let input;const value=css.getPropertyValue(property);
      if(choices[property])input=select(details,label,choices[property].filter(([choice])=>CSS.supports(property,choice)),value,next=>onChange(property,next));
      else{input=document.createElement('input');input.type='text';input.value=value;input.spellcheck=false;input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{let next=input.value.trim();if(property!=='text-decoration-color'&&/^-?(?:\d*\.)?\d+$/.test(next))next+='px';if(!root.RetouchHTMLCSSValues.valid(property,next)||!CSS.supports(property,next)){input.setCustomValidity('Enter a supported '+(property==='text-decoration-color'?'color.':'length, auto'+(property==='text-decoration-thickness'?', or from-font.':'.')));input.reportValidity();return;}onChange(property,next);};field(details,label,input);fieldDraft(input);
       if(property==='text-decoration-color'){input.dataset.paintProperty=property;input.retouchPaintPreview=()=>root.RetouchPaintPicker.propertyPreview({el,input,property});}
       else{let unit='px';numericLabelDrag(input,raw=>{const match=/^(-?(?:\d*\.)?\d+)(px|em|rem|%)?$/.exec(raw);if(!match)return null;unit=match[2]||'px';return {value:Number(match[1]),format:v=>v+unit,min:property==='text-underline-offset'?-10000:0,max:10000};});numericPreview(input,el,property,v=>v+unit);}
      }
      input.title=property==='text-decoration-color'?'Use currentColor to follow the text color.':property==='text-decoration-thickness'?'Auto, from-font, pixels, or percent of the font size.':property==='text-underline-offset'?'Auto, pixels, or percent of the font size. Negative values move the line upward.':input.title;
      const resetLabel='Reset '+label.toLowerCase(),reset=button('↺',()=>onReset(property));reset.setAttribute('aria-label',resetLabel);reset.title=resetLabel;reset.classList.add('property-reset');reset.disabled=!hasOwn(property);const row=input.closest('.inspector-field'),holder=document.createElement('div');holder.className='property-row';row.before(holder);holder.append(row,reset);row.querySelector('span').textContent=label.replace('Underline ','').replace(/^./,letter=>letter.toUpperCase());
    }
  }
  function fontPositionTypography(parent,current,onChange,onReset,canReset=true){
    const details=document.createElement('details'),summary=document.createElement('summary');details.className='font-position-typography';details.open=fontPositionExpanded;details.ontoggle=()=>{if(details.isConnected)fontPositionExpanded=details.open;};summary.textContent='Number position';details.append(summary);parent.append(details);
    select(details,'Number position',[['normal','Normal'],['super','Superscript'],['sub','Subscript']],current,onChange);
    note(details,'Uses alternate glyphs provided by the selected font.');
    const reset=button('Reset number position',onReset);reset.disabled=!canReset;details.append(reset);
  }
  const capsToken=t=>/^\[font-variant-caps:.+\]$/.test(t);
  function capsTypography(parent,current,onChange,onReset,canReset=true){
    const details=document.createElement('details'),summary=document.createElement('summary');details.className='caps-typography';details.open=capsExpanded;details.ontoggle=()=>{if(details.isConnected)capsExpanded=details.open;};summary.textContent='Capital forms';details.append(summary);parent.append(details);
    select(details,'Capital forms',[['normal','Normal'],['small-caps','Small caps'],['all-small-caps','All small caps'],['petite-caps','Petite caps'],['all-petite-caps','All petite caps'],['unicase','Unicase'],['titling-caps','Titling caps']],current,onChange);
    const reset=button('Reset capital forms',onReset);reset.disabled=!canReset;details.append(reset);
  }
  const ligatureToken=t=>/^\[font-variant-ligatures:.+\]$/.test(t);
  function ligatureTypography(parent,current,onChange,onReset,canReset=true){
    const values=root.RetouchHTMLCSSValues,details=document.createElement('details'),summary=document.createElement('summary');details.className='ligature-typography';details.open=ligatureExpanded;details.ontoggle=()=>{if(details.isConnected)ligatureExpanded=details.open;};summary.textContent='Ligatures';details.append(summary);parent.append(details);
    for(const [label,choices]of values.ligatureGroups){const active=current==='none'?choices[2][0]:choices.find(([v])=>v&&current.split(/\s+/).includes(v))?.[0]||'';select(details,label,choices,active,value=>{const next=values.ligatureChange(current,label,value);if(next!==null)onChange(next);});}
    note(details,'Appearance depends on the selected font’s supported features.');const reset=button('Reset ligatures',onReset);reset.disabled=!canReset;details.append(reset);
  }
  const sharedFeatureExpanded=new Set();
  function sharedFeatureTypography(parent,kind,getElements,ready,onChange,onReset,canReset){
    const values=root.RetouchHTMLCSSValues,property='font-variant-'+(kind==='numeric'?'numeric':'ligatures'),groups=values[kind+'Groups'],change=values[kind+'Change'];
    const details=document.createElement('details'),summary=document.createElement('summary');details.className='inspector-disclosure';summary.textContent=kind==='numeric'?'Number formatting':'Ligatures';details.append(summary);parent.append(details);details.open=sharedFeatureExpanded.has(kind);details.ontoggle=()=>{if(details.isConnected){if(details.open)sharedFeatureExpanded.add(kind);else sharedFeatureExpanded.delete(kind);}};
    const read=()=>getElements().map(el=>el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue(property));
    for(const [label,choices]of groups){
      const active=read().map(current=>kind==='ligature'&&current==='none'?choices[2][0]:choices.find(([value])=>value&&current.split(/\s+/).includes(value))?.[0]||''),mixed=active.some(value=>value!==active[0]);
      const input=select(details,'Shared '+label,mixed?[['__mixed','Mixed'],...choices]:choices,mixed?'__mixed':active[0],value=>{if(!ready()||value==='__mixed')return;const next=read().map(current=>change(current,label,value));if(next.every(value=>value!==null))onChange(next);});
      input.closest('.inspector-field').querySelector('span').textContent=label;if(mixed)input.options[0].disabled=true;input.disabled=!ready();if(input.disabled)input.title='Choose a screen inside the edit range and remove any important inline font rule.';
    }
    const reset=button('Reset shared '+(kind==='numeric'?'number formatting':'ligatures'),()=>{if(ready(true))onReset();});reset.disabled=!canReset||!ready(true);details.append(reset);
    note(details,'Appearance depends on the selected font’s supported features.');return details;
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
  function sharedAxisRanges(fonts){
    if(!fonts.length||fonts.some(font=>!font))return [];
    return fonts[0].axes.flatMap(axis=>{const entries=fonts.map(font=>font.axes.find(item=>item.tag===axis.tag));if(entries.some(item=>!item))return [];const min=Math.max(...entries.map(item=>item.min)),max=Math.min(...entries.map(item=>item.max));return /^[A-Za-z0-9]{4}$/.test(axis.tag)&&Number.isFinite(min)&&Number.isFinite(max)&&min<=max&&min>=-10000&&max<=10000?[{tag:axis.tag,name:axis.name,min,max}]:[];});
  }
  function sharedFontPresets(fonts){
    if(!fonts.length||fonts.some(font=>!font))return [];
    return (fonts[0].instances||[]).flatMap(preset=>{
      const matches=fonts.map(font=>(font.instances||[]).filter(item=>item.name===preset.name));if(!preset.name||matches.some(items=>items.length!==1))return [];
      const coordinates=matches.map(items=>items[0].coordinates);
      if(coordinates.some((entries,index)=>!entries.length||entries.length>16||new Set(entries.map(([tag])=>tag)).size!==entries.length||entries.some(([tag,value])=>{const axis=fonts[index].axes.find(axis=>axis.tag===tag);return !/^[A-Za-z0-9]{4}$/.test(tag)||!Number.isFinite(value)||Math.abs(value)>10000||!axis||value<axis.min||value>axis.max;})))return [];
      return [{name:preset.name,coordinates}];
    });
  }
  function sharedVariationTypography(parent,getElements,ready,onChange,onReset,canReset){
    const V=root.RetouchHTMLCSSValues,details=document.createElement('details'),summary=document.createElement('summary');details.className='inspector-disclosure';summary.textContent='Variable font axes';details.append(summary);parent.append(details);
    details.open=sharedFeatureExpanded.has('variation');details.ontoggle=()=>{if(details.isConnected){if(details.open)sharedFeatureExpanded.add('variation');else sharedFeatureExpanded.delete('variation');}};
    const read=()=>getElements().map(el=>V.parseVariations(el.ownerDocument.defaultView.getComputedStyle(el).fontVariationSettings)),axes=read(),labels={wght:'Weight',wdth:'Width',opsz:'Optical size',slnt:'Slant',ital:'Italic'};
    const explicitOptical=axes.filter(axes=>axes?.some(([tag])=>tag==='opsz')).length;if(explicitOptical)note(details,'An explicit Optical size axis overrides automatic sizing on '+explicitOptical+' selected '+(explicitOptical===1?'layer':'layers')+'. Remove that axis to use automatic sizing.');
    let ranges=null;const inputs=new Map();
    const write=(tag,value)=>{if(!details.isConnected||!ready())return;if(value!==null&&ranges){const range=ranges.get(tag);if(!range||value<range.min||value>range.max){note(details,'Choose an axis and value supported by every inspected font.','refused');return;}}const current=read();if(current.some(value=>value===null))return;const next=current.map(axes=>{const map=new Map(axes);if(value===null)map.delete(tag);else map.set(tag,value);return V.serializeVariations([...map]);});if(next.every(value=>V.parseVariations(value)!==null))onChange(next);else note(details,'A selected layer would exceed 16 axis overrides. Remove an override before adding another.','refused');};
    const bindDrag=(input,tag)=>{
      let gestureChange=false;const change=input.onchange;input.onchange=event=>{if(!gestureChange)change?.call(input,event);};input.addEventListener('input',()=>{gestureChange=false;});
      const state=()=>{if(!details.isConnected||!ready()||input.disabled)return null;const elements=getElements(),axes=read();if(axes.some(value=>value===null))return null;const numbers=axes.map(axes=>axes.find(axis=>axis[0]===tag)?.[1]);return numbers.length&&numbers.every(value=>Number.isFinite(value)&&value>=Number(input.min)&&value<=Number(input.max))?{elements,axes,numbers,families:elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el).fontFamily)}:null;};
      input.retouchNumericInitialValue=()=>state()?.numbers[0]??'';
      input.retouchNumericRead=()=>{const current=state();if(!current)return null;const {numbers}=current,base=numbers[0];return {value:base,min:base+Number(input.min)-Math.min(...numbers),max:base+Number(input.max)-Math.max(...numbers)};};
      input.retouchNumericPreview=()=>{
        const current=state();if(!current)throw Error('Set an explicit axis value on every selected layer before dragging.');gestureChange=true;const {elements,axes,numbers,families}=current,original=input.value,previews=elements.map(el=>root.RetouchPaintPicker.propertyPreview({el,input,property:'font-variation-settings',respectScope:true}));
        const next=value=>axes.map((axes,index)=>V.serializeVariations(axes.map(axis=>axis[0]===tag?[tag,Math.round((numbers[index]+value-numbers[0])*1e6)/1e6]:axis)));
        return {current:()=>input.isConnected&&!input.disabled&&getElements().every((el,index)=>el===elements[index]&&el.isConnected&&el.ownerDocument.defaultView.getComputedStyle(el).fontFamily===families[index])&&previews.every(preview=>preview.current()),update:value=>{const values=next(value);previews.forEach((preview,index)=>preview.update(values[index]));},restore:()=>previews.forEach(preview=>preview.restore()),commit:value=>{if(value===numbers[0]){input.value=original;return;}if(ready())onChange(next(value));}};
      };
      input.parentElement.querySelector('span').title='Drag to adjust every explicit axis value by the same amount. Escape cancels.';
    };
    if(axes.every(value=>value!==null)){
      const tags=[...new Set(axes.flatMap(axes=>axes.map(([tag])=>tag)))];
      for(const tag of tags){const values=axes.map(axes=>axes.find(axis=>axis[0]===tag)?.[1]),mixed=values.some(value=>value!==values[0])||values[0]===undefined,row=document.createElement('div');row.className='property-row';details.append(row);
        const input=number(row,'Shared '+(labels[tag]||tag)+' axis',mixed?NaN:values[0],-10000,10000,value=>write(tag,value));if(mixed)input.placeholder='Mixed';input.disabled=!ready();input.closest('.inspector-field').querySelector('span').textContent=labels[tag]||tag;inputs.set(tag,input);bindDrag(input,tag);
        const remove=button('↺',()=>write(tag,null));remove.setAttribute('aria-label','Remove shared '+(labels[tag]||tag)+' axis');remove.title='Remove this axis override from every selected layer';remove.classList.add('property-reset');remove.disabled=!ready();row.append(remove);
      }
      const custom=document.createElement('details'),caption=document.createElement('summary');custom.className='inspector-disclosure';caption.textContent='Add font axis';custom.append(caption);details.append(custom);
      const tag=document.createElement('input');tag.type='text';tag.maxLength=4;tag.pattern='[A-Za-z0-9]{4}';tag.required=true;tag.placeholder='wght';field(custom,'Shared axis tag',tag);
      const coordinate=number(custom,'Shared initial axis value',0,-10000,10000,()=>{}),add=button('Add axis to selected text',()=>{if(!ready()||!tag.reportValidity()||!coordinate.reportValidity()||coordinate.value==='')return;write(tag.value,Number(coordinate.value));});custom.append(add);tag.disabled=coordinate.disabled=add.disabled=!ready();
      note(details,'Axis tags and ranges come from the font designer. A font only renders axes it supports. Other axis values are preserved for each layer.');
    }else note(details,'A selected layer uses axis syntax that cannot be edited here yet.');
    const metadata=root.RetouchFontMetadata;
    if(metadata&&axes.every(value=>value!==null)){
      const files=new Map();for(const el of getElements()){const d=el.ownerDocument,source=metadata.sources(d,d.defaultView.getComputedStyle(el).fontFamily);if(!files.has(source.family)){let url=metadata.selection(d,source.family);if(!source.files.some(file=>file.url===url))url=source.files[0]?.url;files.set(source.family,{d,source,url});}}
      if([...files.values()].every(item=>item.url)){
        const discovered=new Set(),panel=document.createElement('div'),result=document.createElement('div');details.append(panel);result.setAttribute('aria-label','Shared declared font axes');panel.append(result);let revision=0;
        const apply=found=>{ranges=new Map(sharedAxisRanges(found).map(axis=>[axis.tag,axis]));for(const tag of discovered)inputs.delete(tag);discovered.clear();result.replaceChildren();
          for(const [tag,input]of inputs){const range=ranges.get(tag);input.disabled=!ready()||!range;if(range){input.min=range.min;input.max=range.max;input.title='Shared font range: '+range.min+' to '+range.max;}else input.title='This axis is not supported by every inspected font.';}
          for(const axis of ranges.values()){if(inputs.has(axis.tag))continue;const input=number(result,'Shared '+(labels[axis.tag]||axis.tag)+' axis',NaN,axis.min,axis.max,value=>write(axis.tag,value));input.placeholder='Font default';input.title=axis.name+' · shared range '+axis.min+' to '+axis.max;input.disabled=!ready();inputs.set(axis.tag,input);bindDrag(input,axis.tag);discovered.add(axis.tag);}
          const families=[...files.keys()],presets=sharedFontPresets(found),fontIndex=el=>{const d=el.ownerDocument,source=metadata.sources(d,d.defaultView.getComputedStyle(el).fontFamily),item=files.get(source.family);return item&&source.files.some(file=>file.url===item.url)?families.indexOf(source.family):-1;};
          const matching=presets.findIndex(preset=>getElements().every(el=>{const index=fontIndex(el),axes=V.parseVariations(el.ownerDocument.defaultView.getComputedStyle(el).fontVariationSettings);return index>=0&&axes&&preset.coordinates[index].every(([tag,value])=>axes.some(axis=>axis[0]===tag&&Math.abs(axis[1]-value)<.0001));}));
          if(presets.length){const input=select(result,'Shared font style preset',[['','Choose a style…'],...presets.map((preset,index)=>[String(index),preset.name])],matching<0?'':String(matching),value=>{if(!details.isConnected||!input.isConnected||!ready()||value==='')return;const preset=presets[Number(value)];if(!preset)return;const next=getElements().map(el=>{const index=fontIndex(el),axes=V.parseVariations(el.ownerDocument.defaultView.getComputedStyle(el).fontVariationSettings);if(index<0||!axes)return null;const map=new Map(axes);for(const [tag,coordinate]of preset.coordinates[index])map.set(tag,coordinate);const result=V.serializeVariations([...map]);return V.parseVariations(result)!==null?result:null;});if(next.every(value=>value!==null))onChange(next);else note(result,'The selected fonts or axis overrides changed. Re-select the text before applying a preset.','refused');});input.disabled=!ready();input.closest('.inspector-field').querySelector('span').textContent='Style preset';}
          note(result,ranges.size?'Ranges include values supported by every inspected font.':'These font files have no variable axes in common.');
        };
        const refresh=async inspect=>{const own=++revision;inspectButton.disabled=true;try{const found=await Promise.all([...files.values()].map(item=>inspect?metadata.inspect(item.d,item.url):metadata.peek(item.d,item.url)));if(own===revision&&details.isConnected&&found.every(Boolean))apply(found);}catch(error){if(own===revision&&details.isConnected)result.textContent=error.message;}finally{if(own===revision&&details.isConnected)inspectButton.disabled=false;}};
        for(const item of files.values())select(panel,'Shared font file: '+item.source.family,item.source.files.map(file=>[file.url,file.label]),item.url,url=>{item.url=url;metadata.selection(item.d,item.source.family,url);ranges=null;for(const tag of discovered)inputs.delete(tag);discovered.clear();result.replaceChildren();for(const input of inputs.values()){input.min=-10000;input.max=10000;input.title='';input.disabled=!ready();}refresh(false);});
        const inspectButton=button('Inspect selected font axes',()=>refresh(true));panel.append(inspectButton);queueMicrotask(()=>refresh(false));
      }else note(details,'Font-file inspection is unavailable for one or more selected families. Explicit axis overrides remain editable.');
    }
    const reset=button('Reset shared font axes',()=>{if(ready(true))onReset();});reset.disabled=!canReset||!ready(true);details.append(reset);return details;
  }
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
  function position(info, el, save, notify, onTransform, onGeometry, onAlign) {
    const sec = section('Position');
    if (!el || locked(sec, info)) return sec;
    const css = el.ownerDocument.defaultView.getComputedStyle(el);
    const classes = info.className || '';
    const mode = tokens(classes).map(base).find(positionToken) || css.position;
    sec.append(root.RetouchFlip.mount(el,value=>{const important=el.style.getPropertyValue('scale')||tokens(info.anchorInheritedClasses).some(word=>/^!|!$/.test(word)&&root.RetouchFlip.token(base(word)||''));save(replace(classes,root.RetouchFlip.token,(important?'!':'')+'[scale:'+value.replaceAll(' ','_')+']'));}));
    const rotationValue=()=>root.RetouchReactSelection.rotationDegrees(el.ownerDocument.defaultView.getComputedStyle(el).rotate);
    const rotationBlocked=()=>!el.isConnected||el.style.getPropertyPriority('rotate')==='important'||!Number.isFinite(rotationValue());
    const writeRotation=value=>{
      if(!el.isConnected||value!==null&&rotationBlocked()){notify('Edit this layer’s important inline or 3D rotation in its source first.');return;}
      try{save(root.RetouchReactSelection.changeRotation(classes,'',value,el,info.anchorInheritedClasses));}catch(error){notify(error.message);}
    };
    const rotation=number(sec,'Rotation (°)',rotationValue(),-360,360,writeRotation);fieldDraft(rotation);numericPreview(rotation,el,'rotate',value=>value+'deg');
    const resetRotation=button('Reset rotation',()=>writeRotation(null));resetRotation.disabled=root.RetouchReactSelection.change(classes,'','rotate',null)===classes;sec.append(resetRotation);
    if(rotationBlocked()){rotation.disabled=true;rotation.title='Edit this layer’s important inline or 3D rotation in its source first.';}
    const applyAnchor = (x, y) => {
      try { const g=positionGeometry(el);if(onAlign){onAlign(g,g,{x,y});return;}const next=anchorClasses(classes,g,x,y,info.anchorInheritedClasses);if(onGeometry)onGeometry(next,g);else save(next); } catch (e) { notify(e.message); }
    };
    select(sec, 'Positioning', [['static','Auto / flow'],['relative','Relative'],['absolute','Absolute'],['fixed','Fixed'],['sticky','Sticky']], mode, value => {
      if (value === 'absolute' && mode !== 'absolute') {
        try { const g=geometry(el),next=anchorClasses(classes,g,nearestAnchor(g.x,g.width,g.parentWidth),nearestAnchor(g.y,g.height,g.parentHeight),info.anchorInheritedClasses);if(onGeometry)onGeometry(next,g);else save(next); }
        catch (e) { notify(e.message); }
      } else save(replace(classes, t => positionToken(t) || (value === 'static' && insetToken(t)), value));
    });
    if (mode === 'absolute') {
      if(onAlign&&css.position==='absolute')try{sec.insertBefore(root.RetouchSelectionLayout.singlePosition(el,onAlign,notify),sec.children[1]);}catch(error){note(sec,error.message,'refused');}
      let g;
      try { g = positionGeometry(el); } catch (e) { const coordinates=sec.querySelector('[aria-label="X"]');if(coordinates&&onTransform&&!coordinates.dataset.localCoordinates){for(const action of ['move','resize']){const control=canvasTool(action,(opener,initial)=>onTransform(action,opener,initial));sec.append(control);}}note(sec,coordinates?'Anchor presets and canvas transforms for this coordinate system are not available yet.':e.message,coordinates?'':'refused'); return sec; }
      note(sec, `Anchored to ${g.parentLabel}`);
      if(onTransform){const tools=document.createElement('div');tools.className='stack-presets';for(const action of ['move','resize']){const control=canvasTool(action,(opener,initial)=>onTransform(action,opener,initial));tools.append(control);}sec.append(tools);}
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
      const row = document.createElement('div'); row.className = 'control-grid property-pair';
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
  function borderClasses(classes,property,value,inherited='',side=null){
    const edges={top:'t',right:'r',bottom:'b',left:'l'};if(side!==null&&!Object.hasOwn(edges,side))throw Error('Choose a border edge.');
    if(!['width','style'].includes(property))throw Error('Choose a stroke property.');
    if(value!==null&&(property==='width'? !Number.isFinite(value)||value<0||value>100:!['solid','dashed','dotted','double','none','hidden'].includes(value)))throw Error('Unsupported stroke value.');
    const matches=t=>(property==='width'?borderWidthToken(t):/^border(?:-[trblxyse])?-(solid|dashed|dotted|double|hidden|none)$/.test(t))||new RegExp('^\\[border(?:-[a-z]+(?:-[a-z]+)?)?-'+property+':').test(t);
    let addition=value===null?'':property==='width'?'border-['+value+'px]':'border-'+value;
    if(addition&&[...tokens(classes),...tokens(inherited)].some(token=>/^!|!$/.test(token)&&(matches(base(token)||'')||/^\[border(?:-[trblxyse]|-top|-right|-bottom|-left)?:/.test(base(token)||''))))addition='!'+addition;
    if(side!==null){if(addition)addition=property==='style'?(addition.startsWith('!')?'!':'')+'[border-'+side+'-style:'+value+']':addition.replace('border-', 'border-'+edges[side]+'-');return replace(classes,t=>((t==='border-'+edges[side]||t.startsWith('border-'+edges[side]+'-'))&&matches(t))||t.startsWith('[border-'+side+'-'+property+':'),addition);}
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
  function appearance(info, el, save, colorAction, backgroundAction) {
    const sec = section('Appearance');
    if (!el) return sec;
    const css = el.ownerDocument.defaultView.getComputedStyle(el);
    if (locked(sec,info)) return sec;
    if(colorAction){
      for(const [property,label]of [['color','Text color'],['background-color','Background color'],['border-color','Border color'],...(el.namespaceURI==='http://www.w3.org/2000/svg'?[['fill','SVG fill'],['stroke','SVG stroke']]:[])]){
        const input=document.createElement('input');input.type='text';input.spellcheck=false;input.placeholder='CSS color';
        const computed=css.getPropertyValue(property);
        input.value=root.RetouchBackgroundPaintUI.sourceColor(info,'',property)??computed;input.dataset.paintProperty=property;root.RetouchBackgroundPaintUI.bindSource(input,info,'',property,el);input.retouchPaintPreview=()=>root.RetouchPaintPicker.propertyPreview({el,input,property});
        field(sec,label+' with alpha',input);note(sec,computed,'computed-value');
        sec.append(button('Clear local '+label.toLowerCase(),()=>colorAction(property,null).catch(error=>{input.setCustomValidity(error.message);input.reportValidity();})));
        input.onchange=()=>{const value=input.value.trim();if(!root.RetouchHTMLCSSValues.valid(property==='border-color'?'border-color':'color',value,false)||!el.ownerDocument.defaultView.CSS.supports(property==='border-color'?'border-color':'color',value)){input.setCustomValidity('Enter a supported literal CSS color.');input.reportValidity();return;}input.setCustomValidity('');colorAction(property,value).catch(error=>{input.setCustomValidity(error.message);input.reportValidity();});};input.oninput=()=>input.setCustomValidity('');if(property==='background-color'&&backgroundAction)root.RetouchBackgroundPaintUI.bind(info,el,input,backgroundAction,()=>root.RetouchBackgroundPaintUI.sourceState(info,''));fieldDraft(input);
      }
    }
    if(colorAction)note(sec,'Clear removes paint from this screen scope to reveal inherited styles. Saved color links stay attached; reset them from the palette.');
    const appearanceReady=(reset=false,property='visibility')=>el.isConnected&&(!info.styleScope||root.document.querySelector('[aria-label="Edit range status"]')?.dataset.match!=='false')&&(reset||el.style.getPropertyPriority(property)!=='important');
    function writeAppearance(property,value){
      if(['visibility','opacity'].includes(property)&&!appearanceReady(value===null,property))return;
      let next=root.RetouchReactSelection.change(info.className,'',property,value,el.ownerDocument,false,el);
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
    input.disabled=slider.disabled=!appearanceReady(false,'opacity');resetOpacity.disabled||=!appearanceReady(true,'opacity');if(input.disabled)input.title=slider.title='Preview the selected edit range and resolve important inline opacity rules.';
    for(const [property,label]of [['visibility','Visibility'],['mix-blend-mode','Blend mode'],['isolation','Blend group']]){
      const values=property==='visibility'?['visible','hidden','collapse']:root.RetouchHTMLCSSValues.options[property],current=css.getPropertyValue(property);
      const write=value=>writeAppearance(property,value);
      const choices=[...new Set([current,...values])].filter(value=>el.ownerDocument.defaultView.CSS.supports(property,value));
      const control=select(sec,label,choices.map(value=>[value,property==='isolation'?(value==='isolate'?'Isolate children':'Blend with surroundings'):value]),current,write);
      const reset=button('Reset '+label.toLowerCase(),()=>write(null));reset.disabled=root.RetouchReactSelection.change(info.className,'',property,null)===info.className;sec.append(reset);
      if(property==='visibility'){control.disabled=!appearanceReady();reset.disabled||=!appearanceReady(true);if(control.disabled)control.title='Preview the selected edit range and resolve important inline visibility rules.';}else if(el.style.getPropertyValue(property)){control.disabled=true;reset.disabled=true;note(sec,'An inline '+label.toLowerCase()+' controls this layer.');}
      if(property==='visibility')note(sec,'Hidden layers keep their layout space. Select them in Layers to show them again.');
    }
    const widthToken=borderWidthToken;
    const borderWidths=['Top','Right','Bottom','Left'].map(side=>css['border'+side+'Width']);
    const borderWidth=number(sec,'Border width (px)',borderWidths.every(v=>v===borderWidths[0])?parseFloat(borderWidths[0]):NaN,0,100,v=>{
      let next=borderClasses(info.className,'width',v,info.anchorInheritedClasses);
      if(v>0)for(const side of ['top','right','bottom','left'])if(css.getPropertyValue('border-'+side+'-style')==='none')next=borderClasses(next,'style','solid',info.anchorInheritedClasses,side);
      save(next);
    });
    borderWidth.placeholder='Mixed';
    const resetWidth=button('Reset border width',()=>save(borderClasses(info.className,'width',null)));resetWidth.disabled=borderClasses(info.className,'width',null)===info.className;sec.append(resetWidth);
    for(const side of ['top','right','bottom','left']){
      const name='Border '+side+' width',property='border-'+side+'-width';
      const input=number(sec,name+' (px)',parseFloat(css.getPropertyValue(property)),0,100,v=>{
        let next=borderClasses(info.className,'width',v,info.anchorInheritedClasses,side);
        if(v>0&&css.getPropertyValue('border-'+side+'-style')==='none')next=borderClasses(next,'style','solid',info.anchorInheritedClasses,side);
        save(next);
      });numericPreview(input,el,property);
      const reset=button('Reset '+name.toLowerCase(),()=>save(borderClasses(info.className,'width',null,'',side)));reset.disabled=borderClasses(info.className,'width',null,'',side)===info.className;sec.append(reset);
      const style=css.getPropertyValue('border-'+side+'-style');select(sec,'Border '+side+' style',[...new Set([style,'solid','dashed','dotted','double','none'])].map(v=>[v,v[0].toUpperCase()+v.slice(1)]),style,v=>save(borderClasses(info.className,'style',v,info.anchorInheritedClasses,side)));
      const resetStyle=button('Reset border '+side+' style',()=>save(borderClasses(info.className,'style',null,'',side)));resetStyle.disabled=borderClasses(info.className,'style',null,'',side)===info.className;sec.append(resetStyle);
    }
    const styles=['top','right','bottom','left'].map(side=>css.getPropertyValue('border-'+side+'-style')),mixedStyles=styles.some(value=>value!==styles[0]);
    const styleControl=select(sec,'Border style',[...(mixedStyles?[['','Mixed']]:[]),...[...new Set([...styles,'solid','dashed','dotted','double','none'])].map(v=>[v,v[0].toUpperCase()+v.slice(1)])],mixedStyles?'':styles[0],v=>{if(v)save(borderClasses(info.className,'style',v,info.anchorInheritedClasses));});if(mixedStyles)styleControl.options[0].disabled=true;
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
    const match=t=>t.startsWith('['+property+':')||t.startsWith('[--rt-hidden-'+property+':')||(property==='backdrop-filter'?/^backdrop-(?:blur|brightness|contrast|grayscale|hue-rotate|invert|opacity|saturate|sepia|filter)(?:-|$)/.test(t):/^(?:-?hue-rotate|filter|blur|brightness|contrast|drop-shadow|grayscale|invert|saturate|sepia)(?:-|$)/.test(t));
    if(tokens(classes).some(t=>/^!|!$/.test(t)&&base(t)?.startsWith('[all:')))throw Error('Resolve the important all-property reset before editing filters.');
    return replace(classes,match,value===null?'':'!['+property+':'+value.replace(/\s/g,'_')+']');
  }
  function shadowClasses(classes,value){
    const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues;
    if(value!==null&&!V.valid('box-shadow',value))throw Error('Unsupported shadow stack.');
    if(tokens(classes).some(token=>/^!|!$/.test(token)&&/^(?:\[all:|(?:inset-)?ring(?:-|$))/.test(base(token)||'')))throw Error('Resolve the important ring or all-property reset before editing shadows.');
    return replace(classes,t=>/^shadow(?:-|$)/.test(t)||/^\[(?:box-shadow|--rt-hidden-shadows):/.test(t),value===null?'':'![box-shadow:'+value.replace(/\s/g,'_')+']');
  }
  function shadowStack(parent,info,el,save,notify){
    const V=root.RetouchHTMLCSSValues,shadows=root.RetouchBackgroundPaintUI.sourceShadows(info,'')??root.RetouchBackgroundPaintUI.readShadows(info,el),details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Shadow stack';details.append(summary);details.open=shadowStackExpanded;details.retouchSetOpen=value=>{shadowStackExpanded=!!value;details.open=shadowStackExpanded;};details.ontoggle=()=>{if(details.isConnected)shadowStackExpanded=details.open;};parent.append(details);
    const write=next=>{try{save(next===null?shadowClasses(info.className,null):root.RetouchBackgroundPaintUI.shadowClasses(info.className,'',root.RetouchBackgroundPaintUI.shadowChanges(next,info)));}catch(error){notify(error.message);}};
    if(shadows===null)note(details,'This shadow stack contains values these controls cannot edit.');
    else{
      shadows.forEach((shadow,index)=>{
        const group=document.createElement('fieldset'),legend=document.createElement('legend');group.className='shadow-controls';legend.textContent='Shadow '+(index+1);group.append(legend);
        const update=(key,value)=>write(shadows.map((item,i)=>i===index?{...item,[key]:value}:item));
        select(group,'Shadow '+(index+1)+' type',[['drop','Drop shadow'],['inner','Inner shadow']],shadow.inset?'inner':'drop',value=>update('inset',value==='inner'));
        for(const [key,label]of [['x','X'],['y','Y'],['blur','Blur'],['spread','Spread']])numericPreview(number(group,'Shadow '+(index+1)+' '+label+' (px)',shadow[key],key==='blur'?0:-10000,10000,value=>update(key,value)),el,'box-shadow',value=>root.RetouchBackgroundPaintUI.shadowChanges(shadows.map((item,i)=>i===index?{...item,[key]:value}:item),info)['box-shadow']);
        const color=document.createElement('input');color.value=shadow.color;color.retouchPaintPreview=()=>root.RetouchPaintPicker.shadowPreview({el,group,shadows,index});field(group,'Shadow '+(index+1)+' color',color);color.oninput=()=>color.setCustomValidity('');color.onchange=()=>{const value=color.value.trim();if(!V.valid('color',value)||!el.ownerDocument.defaultView.CSS.supports('color',value)){color.setCustomValidity('Enter a supported CSS color.');color.reportValidity();return;}update('color',value);};
        root.RetouchBackgroundPaintUI.shadowEye(color,()=>[shadow],hidden=>update('hidden',hidden),()=>root.RetouchBackgroundPaintUI.rangeActive(color,el)||root.RetouchBackgroundPaintUI.sourceShadows(info,'')!==null,el,'Shadow '+(index+1));
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
    const B=root.RetouchBackgroundPaintUI,F=root.RetouchFilterVisibility,states=Object.fromEntries(['filter','backdrop-filter'].map(property=>[property,B.filterState(info,'',el,property)])),effectValue=property=>states[property]?.value??B.sourceEffect(info,'',property)??css.getPropertyValue(property);
    sec.dataset.emptyEffects=String(['filter','backdrop-filter','box-shadow'].every(property=>(effectValue(property)||'none').trim()==='none'));
    for(const [property,label]of [['filter','Layer blur (px)'],['backdrop-filter','Backdrop blur (px)']]){
      const value=effectValue(property).trim(),parsed=root.RetouchHTMLCSSValues.parseFilters(value),blurs=parsed?.filter(item=>item.name==='blur');
      const input=number(sec,label,blurs?.length===1?parseFloat(blurs[0].arg):blurs?.length===0?0:NaN,0,1000,amount=>{
        const next=states[property].model?F.withBlur(states[property].model,amount):null;if(next===null)return notify('This filter stack cannot be edited with a single blur control.');
        try{save(B.filterClasses(info.className,'',property,B.filterChanges(property,next,info)));}catch(error){notify(error.message);}
      });
      numericPreview(input,el,property,amount=>states[property].model?B.filterChanges(property,F.withBlur(states[property].model,amount),info)[property]:null);
      if(!parsed||blurs.length>1||el.style.getPropertyPriority(property)==='important'){input.disabled=true;note(sec,'This '+(property==='filter'?'layer':'backdrop')+' filter cannot be adjusted with a single blur value.');}
      note(sec,value,'computed-value');
      root.RetouchFilterStack.mount(sec,property,value,next=>save(filterClasses(info.className,property,next)),{disabled:el.style.getPropertyPriority(property)==='important',reset:true,element:el,active:()=>states[property].source||B.rangeActive(sec,el),model:states[property].model,saveModel:next=>save(B.filterClasses(info.className,'',property,B.filterChanges(property,next,info)))});
    }
    note(sec,css.boxShadow,'computed-value');
    shadowStack(sec,info,el,save,notify);
    const shadowMatch=t=>/^shadow(?:-|$)/.test(t)||/^\[(?:box-shadow|--rt-hidden-shadows):/.test(t);
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
  const textWrapToken=t=>/^(?:text-(?:wrap|nowrap|balance|pretty)|\[text-wrap(?:-mode|-style)?:.+\])$/.test(t);
  const textIndentToken=t=>/^(?:-?indent-.+|\[text-indent:.+\])$/.test(t);
  const textAlignToken=t=>/^(?:text-(?:left|center|right|justify|start|end)|\[text-align:.+\])$/.test(t);
  const fontStyleToken=t=>/^(?:italic|not-italic|\[font-style:.+\])$/.test(t);
  const decorationToken=t=>/^(?:underline|line-through|overline|no-underline|\[text-decoration-line:.+\])$/.test(t);
  const decorationStyleToken=t=>/^(?:decoration-(?:solid|double|dotted|dashed|wavy)|\[text-decoration-style:.+\])$/.test(t);
  const decorationThicknessToken=t=>/^(?:decoration-(?:auto|from-font|\d+|\[(?:(?:length|percentage):[^\]]+|(?:[.\d]|(?:calc|min|max|clamp)\()[^\]]*)\]|\(length:--[\w-]+\))|\[text-decoration-thickness:.+\])$/.test(t);
  const decorationMatchers={'text-decoration-style':decorationStyleToken,'text-decoration-thickness':decorationThicknessToken,'text-underline-offset':t=>/^(?:-?underline-offset-.+|\[text-underline-offset:.+\])$/.test(t),'text-decoration-skip-ink':t=>/^\[text-decoration-skip-ink:.+\]$/.test(t),'text-decoration-color':t=>/^\[text-decoration-color:.+\]$/.test(t)||/^decoration-/.test(t)&&!decorationStyleToken(t)&&!decorationThicknessToken(t)};
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
  const textOverrideToken=t=>[fontSizeToken,fontWeightToken,fontFamilyToken,lineHeightToken,letterSpacingToken,textIndentToken,textWrapToken,textBoxToken,textAlignToken,fontStyleToken,decorationToken,caseToken,opticalToken,variationToken,numericToken,ligatureToken,capsToken,fontPositionToken,...Object.values(decorationMatchers)].some(match=>match(t));
  function fontWeightClass(value){return typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=1000?`font-[${value}]`:null;}
  function fontDisplayName(value){return value.trim().toLowerCase()==='-webkit-standard'?'Browser default':value.replace(/["']/g,'');}
  function fontFamilies(d,current){
    const found=new Map([['system-ui','System UI'],['sans-serif','Sans serif'],['serif','Serif'],['monospace','Monospace']]);
    function add(value,label){value=value?.trim();if(value&&fontFamilyClass(value)&&!found.has(value)&&found.size<100)found.set(value,label||fontDisplayName(value));}
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
    if(typeof value==='string'&&value.trim().toLowerCase()==='-webkit-standard')return 'Browser default family';
    if(!fontFamilyClass(value))return 'Font status unavailable';
    const family=value.split(',')[0].trim();
    if(/^(system-ui|sans-serif|serif|monospace|cursive|fantasy|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/i.test(family))return 'System / fallback family';
    const counts=states.get(family.replace(/^(["'])(.*)\1$/,'$2').toLocaleLowerCase());
    if(!counts)return 'No page font declaration';
    return [['loading','loading'],['error','failed'],['unloaded','not loaded'],['loaded','loaded']].filter(([key])=>counts[key]).map(([key,label])=>`${counts[key]} ${label}`).join(' · ')||'Font status unavailable';
  }
  function fontPicker(parent,d,current,onChange,options={}){
    const choices=fontFamilies(d,current),supported=choices.some(([value])=>value===current);
    const choose=value=>{if(options.disabled)return;if(options.preview){current=value;options.mixed=false;if(![...quick.options].some(option=>option.value===value))quick.add(new Option(fontDisplayName(value),value));quick.value=value;render();}onChange(value);};
    const quick=select(parent,options.label||'Page font',supported?choices:[[current,options.mixed?'Mixed':fontDisplayName(current)],...choices],current,choose);
    quick.disabled=!!options.disabled;if(!supported)quick.options[0].disabled=true;
    const currentStatus=note(parent,'');currentStatus.setAttribute('aria-label','Current font files');currentStatus.setAttribute('role','status');
    const browse=document.createElement('details');browse.className='font-browser';
    const summary=document.createElement('summary');summary.textContent='Browse page fonts';browse.append(summary);
    const search=document.createElement('input');search.type='search';search.placeholder='Search font names';search.setAttribute('aria-label','Search page fonts');search.disabled=!!options.disabled;browse.append(search);
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
      results.replaceChildren();for(const [value,label] of matches.slice(offset,offset+50)){const b=button(label,()=>choose(value));b.disabled=!!options.disabled;const detail=document.createElement('small');detail.className='font-face-state';detail.textContent=fontFaceLabel(value,states);b.append(detail);b.dataset.font=value;b.setAttribute('aria-label','Use font '+label);b.setAttribute('aria-pressed',String(value===current));results.append(b);if(value===focused)b.focus({preventScroll:true});}
    };
    search.oninput=()=>{offset=0;render();};browse.ontoggle=()=>{
      cancelScan?.();scanning=browse.open;
      if(browse.open){search.focus();choices.splice(0,choices.length,...fontFamilies(d,current));offset=0;const known=new Set(choices.map(([value])=>value));cancelScan=scanPageFonts(d,(batch,done)=>{let changed=false;for(const value of batch)if(!known.has(value)){known.add(value);choices.push([value,fontDisplayName(value)]);changed=true;}scanning=!done;if(changed||done)render();},()=>browse.isConnected&&browse.open);}
      render();
    };
    browse.addEventListener('keydown',event=>{if(event.key==='Escape'&&browse.open){event.preventDefault();event.stopPropagation();browse.open=false;summary.focus();}});
    note(browse,'Status is for declared font faces. Some characters or weights may still use a fallback.');
    if(d.fonts?.addEventListener){
      const events=['loading','loadingdone','loadingerror'];const update=()=>{if(parent.isConnected)render();};for(const event of events)d.fonts.addEventListener(event,update);
      const observer=new MutationObserver(()=>{if(!parent.isConnected){observer.disconnect();cancelScan?.();for(const event of events)d.fonts.removeEventListener(event,update);}});observer.observe(document.body,{childList:true,subtree:true});
    }
    render();parent.append(browse);return quick;
  }
  function spacingPercent(property,value){
    if(!['line-height','letter-spacing'].includes(property))return null;
    const match=/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(em|%)?$/.exec(String(value??'').trim());
    if(!match||property!=='line-height'&&match[2]!=='em')return null;
    const percent=Number(match[1])*(match[2]==='%'?1:100);
    return Number.isFinite(percent)?percent:null;
  }
  function effectiveSpacingPercent(classes,inherited,el,property){
    const test=property==='line-height'?lineHeightToken:letterSpacingToken,own=tokens(classes).filter(t=>base(t)&&test(base(t)));
    const candidates=own.length?own:tokens(inherited).filter(t=>base(t)&&test(base(t)));
    const selected=candidates.find(t=>/^!|!$/.test(t))||(candidates.length===1?candidates[0]:''),token=base(selected)||'',inline=el.style.getPropertyValue(property);
    const match=property==='line-height'?/^(?:\[line-height:|leading-\[)([^\]]+)\]$/.exec(token):/^(?:\[letter-spacing:|tracking-\[)([^\]]+)\]$/.exec(token);
    const raw=inline&&(el.style.getPropertyPriority(property)==='important'||!/^!|!$/.test(selected))?inline:match?.[1],percent=spacingPercent(property,raw),css=el.ownerDocument.defaultView.getComputedStyle(el),expected=percent/100*parseFloat(css.fontSize),actual=parseFloat(css.getPropertyValue(property));
    return percent!==null&&Number.isFinite(actual)&&Math.abs(expected-actual)<.02?percent:null;
  }
  let sharedPreviewIndex=0;
  function sharedTypographyPreview(parent,elements){
    if(!elements.length)return;
    const preview=document.createElement('div');preview.className='shared-type-preview';parent.append(preview);
    let sample=null,frame=null;sharedPreviewIndex=Math.min(sharedPreviewIndex,elements.length-1);
    const render=index=>{sharedPreviewIndex=index;frame?.remove();frame=typographyPreview(preview,elements[index]);frame.title='Selected layer typography preview';frame.retouchSample(sample);};
    select(preview,'Preview selected text layer',elements.map((el,index)=>[String(index),(index+1)+'. '+((el.innerText||el.textContent||el.localName).trim().replace(/\s+/g,' ').slice(0,45)||el.localName)]),String(sharedPreviewIndex),value=>{const index=Number(value);if(Number.isInteger(index)&&index>=0&&index<elements.length)render(index);});
    preview.querySelector('.inspector-field > span').textContent='Preview layer';
    preview.retouchSample=text=>{sample=text;frame?.retouchSample(text);};render(sharedPreviewIndex);return preview;
  }
  function typographyPreview(parent,el){
    const d=el.ownerDocument,css=d.defaultView.getComputedStyle(el);
    const preview=document.createElement('iframe');preview.className='type-preview';preview.title='Typography preview';preview.setAttribute('sandbox','allow-same-origin');parent.append(preview);
    const originalText=(el.innerText||el.textContent)?.trim().slice(0,100)||'The quick brown fox · Aa 0123456789';let sampleText=originalText,sample=null,fit=()=>{};
    const renderSample=()=>{if(!sample)return;const doc=sample.ownerDocument;sample.replaceChildren(...sampleText.split('\n').flatMap((part,index)=>[...(index?[doc.createElement('br')]:[]),doc.createTextNode(part)]));};
    preview.retouchSample=text=>{sampleText=text??originalText;if(sample){renderSample();fit();}};
    preview.onload=()=>{
      const pd=preview.contentDocument;if(!pd||!preview.isConnected||!el.isConnected||!d.location)return;
      const base=pd.createElement('base');base.href=d.location.href;pd.head.append(base);
      for(const s of d.querySelectorAll('link[rel="stylesheet"],style')){const copy=pd.importNode(s,true);copy.addEventListener('load',()=>fit());pd.head.append(copy);}
      pd.documentElement.style.overflow='hidden';pd.body.style.cssText='margin:0;padding:12px;background:#fff;color:#181818;overflow-wrap:anywhere;';
      sample=pd.createElement('div');renderSample();
      for(const p of typeProperties)sample.style.setProperty(p,css.getPropertyValue(p));
      const clamped=Number(css.getPropertyValue('-webkit-line-clamp'))>0;
      // Chromium reports a clamped legacy box as flow-root; copying that computed
      // display loses the legacy clamp behavior in a fresh preview element.
      if(clamped){for(const p of ['width','overflow','-webkit-box-orient','-webkit-line-clamp'])sample.style.setProperty(p,css.getPropertyValue(p));sample.style.display='-webkit-box';}
      sample.style.transformOrigin='top left';pd.body.append(sample);
      fit=()=>{if(!preview.isConnected||!sample)return;const width=pd.documentElement.clientWidth-24,height=pd.documentElement.clientHeight-24;if(width<=0||height<=0)return;sample.style.transform='scale('+Math.min(1,width/Math.max(1,sample.scrollWidth),height/Math.max(1,clamped?sample.offsetHeight:sample.scrollHeight))+')';};
      const observer=new pd.defaultView.ResizeObserver(fit);observer.observe(sample);pd.defaultView.addEventListener('resize',fit);pd.fonts.ready.then(fit);fit();
    };
    preview.srcdoc='<!doctype html><html><head></head><body></body></html>';
    return preview;
  }
  function typography(info, el, save, changeTag, textStyleAction) {
    const sec=section('Typography'); if(!el)return sec;
    const d=el.ownerDocument, css=d.defaultView.getComputedStyle(el);
    const typeActive=()=>el.isConnected&&(!info.styleScope||root.document.querySelector('[aria-label="Edit range status"]')?.dataset.match!=='false');
    root.RetouchTextStyles?.mount(sec,el,info.classTextStyles&&!info.classNameDynamic&&textStyleAction?{inherited:root.RetouchResponsive.inheritedLink(info.textStyleLinks,info.styleScope||'',d),update:info.textStyleUpdates===false?undefined:(styleId,libraryRevision,name,properties)=>textStyleAction('updateTextStyle',info.styleScope||'',{styleId,libraryRevision,name,properties}),link:info.textStyleLinks?.[info.styleScope||''],overrides:info.textStyleOverrides?.[info.styleScope||'']||[],reset:(styleId,libraryRevision)=>textStyleAction('resetTextStyle',info.styleScope||'',{styleId,libraryRevision}),apply:(styleId,libraryRevision)=>textStyleAction('applyTextStyle',info.styleScope||'',{styleId,libraryRevision}),detach:()=>textStyleAction('detachTextStyle',info.styleScope||'',{})}:{});
    note(sec,`${css.fontFamily} · ${css.fontSize} / ${css.lineHeight} · ${css.fontWeight}`,'computed-value');
    typographyPreview(sec,el);
    if(!locked(sec,info)) {
      textResizing(sec,el,changes=>save(root.RetouchReactSelection.changeTextResizing(info.className,'',changes,el)),typeActive);
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
      const fontSizeBlocked=()=>el.style.getPropertyPriority('font-size')==='important';
      const inlineTypeProperty=match=>match===fontSizeToken?'font-size':match===lineHeightToken?'line-height':match===letterSpacingToken?'letter-spacing':match===fontFamilyToken?'font-family':match===fontWeightToken?'font-weight':match===fontStyleToken?'font-style':null;
      const change=(match,value)=>{const property=inlineTypeProperty(match);if(property&&(!typeActive()||el.style.getPropertyPriority(property)==='important'))return;return save(replaceTypography(info.className,match,styled||property&&el.style.getPropertyValue(property)?'!'+value:value));};
      const resetProperty=(label,match)=>{const reset=button(label,()=>{if(!inlineTypeProperty(match)||typeActive())save(replaceTypography(info.className,match,''));});try{reset.disabled=replaceTypography(info.className,match,'')===info.className;}catch{reset.disabled=true;}sec.append(reset);};
      fontPicker(sec,d,css.fontFamily,value=>{const token=fontFamilyClass(value);if(token)change(fontFamilyToken,token);},{disabled:!typeActive()||el.style.getPropertyPriority('font-family')==='important'});
      const resetFamily=button('Reset font family',()=>{if(typeActive())save(replace(info.className,fontFamilyToken,''));});resetFamily.disabled=!tokens(info.className).map(base).some(t=>t&&fontFamilyToken(t));sec.append(resetFamily);
      for(const [label,re,choices] of controls){const token=tokens(info.className).map(base).find(t=>re.test(t));const control=select(sec,label,[['','Inherited / custom'],...choices],choices.some(([value])=>value===token)?token:'',value=>{if(value)change(re.test,value);});if(el.style.getPropertyPriority(label==='Font size'?'font-size':'font-weight')==='important'){control.disabled=true;control.title='An important inline rule controls this typography property.';}}
      const fontWeight=numericPreview(number(sec,'Font weight (1–1000)',parseFloat(css.fontWeight),1,1000,v=>{const token=fontWeightClass(v);if(token)change(fontWeightToken,token);}),el,'font-weight',String);
      if(el.style.getPropertyPriority('font-weight')==='important'){fontWeight.disabled=true;fontWeight.title='An important inline rule controls this font weight.';}
      const resetWeight=button('Reset font weight',()=>{if(typeActive())save(replace(info.className,fontWeightToken,''));});resetWeight.disabled=!tokens(info.className).map(base).some(t=>t&&fontWeightToken(t));sec.append(resetWeight);
      const fontSize=numericPreview(number(sec,'Font size (px)',parseFloat(css.fontSize),1,1000,v=>change(fontSizeToken,`text-[${v}px]`)),el,'font-size');
      if(fontSizeBlocked()){fontSize.disabled=true;fontSize.title='An important inline rule controls this font size.';}
      resetProperty('Reset font size',fontSizeToken);
      const relativeLineHeight=relativeNumber(sec,'Line height (%)',parseFloat(css.lineHeight)/parseFloat(css.fontSize)*100,0,1000,v=>change(lineHeightToken,`[line-height:${Math.round(v*1e6)/1e8}]`));relativeLineHeight.title='Relative to this layer’s font size.';
      const lineHeight=number(sec,'Line height (px)',parseFloat(css.lineHeight),0,2000,v=>change(lineHeightToken,`leading-[${v}px]`));
      numericPreview(lineHeight,el,'line-height');numericPreview(relativeLineHeight,el,'line-height',value=>String(Math.round(value*1e6)/1e8));
      if(css.lineHeight==='normal'){lineHeight.value='';lineHeight.placeholder='Automatic';relativeLineHeight.placeholder='Automatic';}
      const automaticLineHeight=button('Automatic line height',()=>change(lineHeightToken,'[line-height:normal]'));automaticLineHeight.disabled=el.style.getPropertyPriority('line-height')==='important';sec.append(automaticLineHeight);
      const resetLineHeight=button('Reset line height',()=>{if(typeActive())save(replaceTypography(info.className,lineHeightToken,''));});try{resetLineHeight.disabled=replaceTypography(info.className,lineHeightToken,'')===info.className;}catch{resetLineHeight.disabled=true;}sec.append(resetLineHeight);
      numericPreview(relativeNumber(sec,'Letter spacing (%)',(parseFloat(css.letterSpacing)||0)/parseFloat(css.fontSize)*100,-100,1000,v=>change(letterSpacingToken,`tracking-[${Math.round(v*1e6)/1e8}em]`)),el,'letter-spacing',value=>Math.round(value*1e6)/1e8+'em').title='Relative to this layer’s font size.';
      numericPreview(number(sec,'Letter spacing (px)',parseFloat(css.letterSpacing)||0,-100,100,v=>change(letterSpacingToken,`tracking-[${v}px]`)),el,'letter-spacing');
      resetProperty('Reset letter spacing',letterSpacingToken);
      for(const [property,label]of [['line-height','Line height'],['letter-spacing','Letter spacing']])if(el.style.getPropertyPriority(property)==='important')for(const unit of ['px','%']){const input=sec.querySelector('[aria-label="'+label+' ('+unit+')"]');input.disabled=true;input.title='An important inline rule controls this typography property.';}
      const indent=number(sec,'Paragraph indent (px)',/^-?[\d.]+px$/.test(css.textIndent)?parseFloat(css.textIndent):NaN,-10000,10000,v=>change(textIndentToken,`[text-indent:${v}px]`));
      if(!indent.value)indent.placeholder=css.textIndent;indent.title='Offsets the first line of each paragraph. Negative values create a hanging indent.';numericPreview(indent,el,'text-indent');
      const resetIndent=button('Reset paragraph indent',()=>save(replace(info.className,textIndentToken,'')));resetIndent.disabled=!tokens(info.className).map(base).some(t=>t&&textIndentToken(t));sec.append(resetIndent);
      verticalAlignmentTypography(sec,css,(property,value)=>change(verticalAlignmentMatchers[property],`[${property}:${value}]`),property=>save(replace(info.className,verticalAlignmentMatchers[property],'')),property=>tokens(info.className).map(base).some(t=>t&&verticalAlignmentMatchers[property](t)));
      wrapTypography(sec,css,value=>change(textWrapToken,`[text-wrap:${value}]`),()=>save(replace(info.className,textWrapToken,'')),tokens(info.className).map(base).some(t=>t&&textWrapToken(t)));
      verticalTrimTypography(sec,css,value=>change(textBoxToken,`[text-box:${value.replace(/ /g,'_')}]`),()=>save(replace(info.className,textBoxToken,'')),tokens(info.className).map(base).some(t=>t&&textBoxToken(t)));
      truncationTypography(sec,el,typeActive,value=>save(root.RetouchReactSelection.changeTextTruncation(info.className,'',value,el)),tokens(info.className).map(base).some(t=>t&&truncationToken(t)));
      select(sec,'Text alignment',['left','center','right','justify','start','end'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]),css.textAlign,v=>change(textAlignToken,'text-'+v)).dataset.textDirection=css.direction;
      resetProperty('Reset text alignment',textAlignToken);
      const fontSlant=select(sec,'Font slant',[['normal','Normal'],['italic','Italic']],css.fontStyle==='italic'?'italic':'normal',v=>change(fontStyleToken,v==='italic'?'italic':'not-italic'));fontSlant.disabled=el.style.getPropertyPriority('font-style')==='important';
      resetProperty('Reset font style',fontStyleToken);
      select(sec,'Text decoration',[['none','None'],['underline','Underline'],['line-through','Strikethrough'],['overline','Overline']],css.textDecorationLine,v=>change(decorationToken,v==='none'?'no-underline':v));
      resetProperty('Reset text decoration',decorationToken);
      underlineTypography(sec,css,(property,value)=>change(decorationMatchers[property],`[${property}:${value.replace(/ /g,'_')}]`),property=>save(replace(info.className,decorationMatchers[property],'')),property=>tokens(info.className).map(base).some(t=>t&&decorationMatchers[property](t)),el);
      select(sec,'Text case',[['none','As written'],['uppercase','Uppercase'],['lowercase','Lowercase'],['capitalize','Capitalize']],css.textTransform,v=>change(caseToken,v==='none'?'normal-case':v));
      resetProperty('Reset text case',caseToken);
      opticalTypography(sec,css,value=>change(opticalToken,`[font-optical-sizing:${value}]`),()=>save(replace(info.className,opticalToken,'')),tokens(info.className).map(base).some(t=>t&&opticalToken(t)));
      variationTypography(sec,css,value=>change(variationToken,`[font-variation-settings:${value.replace(/ /g,'_')}]`),()=>save(replace(info.className,variationToken,'')),tokens(info.className).map(base).some(t=>t&&variationToken(t)),el);
      fontPositionTypography(sec,css.fontVariantPosition,value=>change(fontPositionToken,`[font-variant-position:${value}]`),()=>save(replace(info.className,fontPositionToken,'')),tokens(info.className).map(base).some(t=>t&&fontPositionToken(t)));
      capsTypography(sec,css.fontVariantCaps,value=>change(capsToken,`[font-variant-caps:${value}]`),()=>save(replace(info.className,capsToken,'')),tokens(info.className).map(base).some(t=>t&&capsToken(t)));
      ligatureTypography(sec,css.fontVariantLigatures,value=>change(ligatureToken,`[font-variant-ligatures:${value.replace(/ /g,'_')}]`),()=>save(replace(info.className,ligatureToken,'')),tokens(info.className).map(base).some(t=>t&&ligatureToken(t)));
      numericTypography(sec,css.fontVariantNumeric,value=>change(numericToken,`[font-variant-numeric:${value.replace(/ /g,'_')}]`),()=>save(replace(info.className,numericToken,'')),tokens(info.className).map(base).some(t=>t&&numericToken(t)));
      const textOverride=textOverrideToken;
      const reset=button('Reset text overrides',()=>{if(typeActive())save(replace(info.className,textOverride,''));});
      reset.disabled=!tokens(info.className).map(base).some(t=>t!==null&&textOverride(t));sec.append(reset);


    }
    for(const [property,label] of [['line-height','Line height (px)'],['letter-spacing','Letter spacing (px)']]){
      const percent=effectiveSpacingPercent(info.className,info.anchorInheritedClasses||'',el,property),input=sec.querySelector('[aria-label="'+label+'"]');
      if(input&&percent!==null)input.retouchSpacingPercent=percent;
    }
    if(!typeActive())for(const control of sec.querySelectorAll('input,select,button')){const name=control.getAttribute('aria-label')||control.textContent;if(/^(?:Page font$|Font (?:size|weight|slant)|Line height|Letter spacing|Automatic line height$|Reset (?:font (?:size|weight|family|style)|line height|letter spacing|text overrides)$)/i.test(name)){control.disabled=true;control.title='Switch to a screen inside the selected edit range.';}}
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
  const api={textSizeLimits,textResizeMode,truncationProperties,sharedTruncationTypography,textResizeChanges,textResizeProperties,sharedTextResizing,textVerticalValue,sharedVerticalAlignment,sharedFontPresets,sharedAxisRanges,sharedVariationTypography,sharedTypographyPreview,sharedFeatureTypography,sharedLengthDrag,effectiveSpacingPercent,localPositionCorners,positionGeometry,localPositionGeometry,textResizing,textVerticalLayout,verticalAlignmentMatchers,verticalAlignmentTypography,verticalTrimTypography,truncationTypography,truncationToken,wrapTypography,decorationMatchers,underlineTypography,fontPositionToken,fontPositionTypography,capsToken,capsTypography,ligatureToken,ligatureTypography,typographyPreview,spacingPercent,canvasTool,layoutParent,gridAxisEdges,gridGuideControl,drawGridGuides,gridPlacementSuggestions,suggestGridPlacement,borderClasses,cornerRadiusClasses,shadowClasses,filterClasses,expandSizeLeading,replaceTypography,fontSizeToken,letterSpacingToken,textIndentToken,textWrapToken,textBoxToken,textAlignToken,fontStyleToken,decorationToken,caseToken,textOverrideToken,base,replace,nearestAnchor,inferredAnchor,axisClasses,anchorClasses,geometry,rotationLayoutRect,scaledOutline,outlineGeometry,catalog,fontFamilies,fontFamilyClass,fontFamilyToken,fontWeightToken,fontWeightClass,lineHeightToken,isTextLayer,filterFonts,fontPicker,scanPageFonts,fontFaceStates,fontFaceLabel,position,appearance,effects,typography,measurements,section,field,fieldDraft,note,button,select,number,scrubSpeed,numericLabelDrag,numericPreview,relativeNumber,opticalTypography,opticalToken,variationTypography,variationToken,numericTypography,numericToken};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchInspector=api;
})(typeof window==='object'?window:globalThis);
