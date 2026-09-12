(function(root){
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  let handleMovement='independent';
  function mount({target,frame,canvas,points,pathData=null,propertiesPane=null,onCommit,onEnd,onError}){
    const w=target.ownerDocument.defaultView,property=pathData?'d':'points',original=target.getAttribute(property);
    const initialCSS=pathData?w.getComputedStyle(target).getPropertyValue('d'):null;
    const subpaths=pathData?.subpaths.map(part=>({closed:part.closed,nodes:part.nodes.map(p=>root.RetouchSVGPath.translate(p,0,0))}));
    let contour=0,vertices=subpaths?subpaths[0].nodes:points.map(p=>root.RetouchSVGPath.translate(p,0,0));const cleanup=[];
    const surface=root.document.createElement('div');surface.className='svg-vertex-surface';
    surface.tabIndex=-1;surface.setAttribute('role','group');surface.setAttribute('aria-label','Edit vector points');
    Object.assign(surface.style,{position:'fixed',zIndex:40,overflow:'hidden',touchAction:'none'});
    const drawing=root.document.createElementNS(ns,'svg');
    Object.assign(drawing.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    const selectionBox=root.document.createElement('div');selectionBox.dataset.vectorMarquee='true';selectionBox.hidden=true;selectionBox.style.cssText='position:absolute;pointer-events:none;border:1px solid var(--accent, #0d99ff);background:#0d99ff22;z-index:1;';surface.append(selectionBox);
    const otherContours=root.document.createElementNS(ns,'g');drawing.append(otherContours);
    const preview=root.document.createElementNS(ns,target.tagName.toLowerCase());
    preview.dataset.vectorPreview='true';
    preview.style.cssText='fill:none!important;stroke:var(--accent, #0d99ff)!important;stroke-width:1.5!important;';
    preview.setAttribute('vector-effect','non-scaling-stroke');drawing.append(preview);surface.append(drawing);
    const contourHit=root.document.createElementNS(ns,'path');contourHit.dataset.moveContour='true';contourHit.setAttribute('aria-label','Move selected contour');contourHit.setAttribute('role','button');contourHit.setAttribute('vector-effect','non-scaling-stroke');contourHit.style.cssText='fill:none!important;stroke:transparent!important;stroke-width:14!important;pointer-events:stroke;cursor:move;outline:none;';drawing.append(contourHit);
    let ended=false,drag=null,active=0,activeHandle=null,raf,cancelPen=null,moveContourMode=false,showAllHandles=false,selectedPoints=new Set([0]);
    const initialMatrix=target.getScreenCTM(),matrixValues=m=>m&&[m.a,m.b,m.c,m.d,m.e,m.f];
    const initial=matrixValues(initialMatrix);
    function listen(el,type,fn,options){el.addEventListener(type,fn,options);cleanup.push(()=>el.removeEventListener(type,fn,options));}
    function cancel(){if(ended)return;ended=true;cancelPen?.();root.cancelAnimationFrame(raf);cleanup.forEach(f=>f());surface.remove();arcPanel.remove();arrangePanel.remove();positionPanel.remove();onEnd();}
    function animated(){
      // WebKit can cache animatedPoints across React attribute updates. Inspect
      // SMIL targets instead of treating that stale list as the rendered geometry.
      return [...target.ownerDocument.querySelectorAll(`animate[attributeName="${property}"],set[attributeName="${property}"]`)].some(animation=>{
        if(animation.targetElement)return animation.targetElement===target;
        const href=animation.getAttribute('href')||animation.getAttributeNS('http://www.w3.org/1999/xlink','href');
        return href?!!target.id&&href==='#'+target.id:animation.parentElement===target;
      });
    }
    function current(){
      const m=matrixValues(target.getScreenCTM());
      return target.isConnected&&!animated()&&target.getAttribute(property)===original&&m&&initial&&m.every((n,i)=>Math.abs(n-initial[i])<1e-6)&&
        (pathData?w.getComputedStyle(target).getPropertyValue('d')===initialCSS:target.points.numberOfItems===points.length);
    }
    function verify(){if(current())return true;const message=animated()?(pathData?'This path has a geometry animation. Remove the animation before editing.':'This vector has a points animation. Remove the animation before editing its points.'):'The vector changed while editing. Select it again.';cancel();onError(message);return false;}
    function local(e){
      const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth;
      const p=new w.DOMPoint((e.clientX-f.left)/scale,(e.clientY-f.top)/scale).matrixTransform(initialMatrix.inverse());
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('This vector transform cannot be edited.');return p;
    }
    let closed=subpaths?subpaths[0].closed:target.tagName.toLowerCase()==='polygon';const minimum=pathData?2:closed?3:2;
    let handles=[],insertions=[],curveHandles=[];
    const tangentLines=root.document.createElementNS(ns,'g');drawing.append(tangentLines);
    const toolbar=root.document.createElement('div');
    toolbar.className='svg-vertex-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Vector editing actions');
    Object.assign(toolbar.style,{position:'absolute',left:'12px',bottom:'72px',maxWidth:'calc(100% - 24px)',display:'flex',flexWrap:'wrap',gap:'8px',alignItems:'center',padding:'8px',background:'#ffffff',border:'1px solid var(--line, #e6e6e6)',borderRadius:'8px',boxShadow:'0 4px 16px #0002',zIndex:2});
    const status=root.document.createElement('span');status.setAttribute('role','status');
    status.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';toolbar.append(status);
    function action(label,fn){const b=root.document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;Object.assign(b.style,{padding:'0 8px',minHeight:'28px',border:'1px solid var(--line, #e6e6e6)',borderRadius:'4px',background:'var(--control, #f5f5f5)',color:'var(--ink, #1e1e1e)',font:'12px Inter,system-ui',cursor:'pointer'});if(label==='Done'){b.style.background='var(--accent, #0d99ff)';b.style.color='#fff';b.style.borderColor='transparent';}toolbar.append(b);return b;}
    const actionIcons={
      'Make corner':'<path d="M3 13 8 3l5 10"/><rect x="6.5" y="1.5" width="3" height="3" fill="currentColor"/>',
      'Make smooth':'<path d="M2 13C2 1 14 1 14 13M2 3h12"/><circle cx="8" cy="3" r="2" fill="white"/>',
      'Move contour':'<path d="M8 1v14M1 8h14M5 4l3-3 3 3M5 12l3 3 3-3M4 5 1 8l3 3M12 5l3 3-3 3"/>',
      'Draw contour':'<path d="m3 13 2-6 6-5 3 3-5 6-6 2Zm2-6 4 4M3 13l4-4"/>',
      'Select all points':'<path d="M5 2h6M14 5v6M11 14H5M2 11V5" stroke-dasharray="2 2"/><path d="M1 1h3v3H1zM12 1h3v3h-3zM1 12h3v3H1zM12 12h3v3h-3z"/>',
      'Delete point':'<path d="M3 8h10"/><rect x="1" y="6" width="4" height="4" fill="white"/><rect x="11" y="6" width="4" height="4" fill="white"/>'
    };
    function compact(button,label){button.setAttribute('aria-label',label);button.title=button.title||label;button.innerHTML='<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">'+actionIcons[label]+'</svg>';Object.assign(button.style,{width:'28px',padding:'0',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:'0'});}
    const options=root.document.createElement('details');options.className='svg-vector-options';options.style.cssText='font:12px Inter,system-ui;';
    const optionsToggle=root.document.createElement('summary');optionsToggle.textContent='•••';optionsToggle.setAttribute('aria-label','More vector actions');optionsToggle.title='More vector actions';optionsToggle.style.cssText='display:flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer;border-radius:4px;background:var(--control, #f5f5f5);color:var(--ink, #1e1e1e);';options.append(optionsToggle);
    const optionsPanel=root.document.createElement('div');optionsPanel.setAttribute('role','group');optionsPanel.setAttribute('aria-label','More vector actions');optionsPanel.style.cssText='position:absolute;bottom:calc(100% + 8px);right:8px;width:180px;display:flex;flex-direction:column;gap:4px;padding:8px;border:1px solid var(--line, #e6e6e6);border-radius:8px;background:white;box-shadow:0 4px 16px #0002;';options.append(optionsPanel);
    listen(optionsToggle,'click',()=>{optionsPanel.style.maxHeight=Math.max(32,toolbar.getBoundingClientRect().top-surface.getBoundingClientRect().top-16)+'px';optionsPanel.style.overflowY='auto';optionsPanel.style.boxSizing='border-box';});
    listen(optionsPanel,'click',event=>{if(event.target.closest('button')){options.open=false;if(optionsPanel.contains(root.document.activeElement))optionsToggle.focus();}});
    listen(options,'keydown',event=>{if(event.key==='Escape'&&options.open){event.preventDefault();event.stopImmediatePropagation();options.open=false;optionsToggle.focus();}},true);
    let handleMode,contourPicker,deleteContourButton,duplicateContourButton,closureButton,drawContourButton,moveContourButton,cornerButton,smoothButton;
    if(subpaths){
      const label=root.document.createElement('label');label.textContent='Contour ';label.style.cssText='font:12px Inter,system-ui;color:var(--ink, #1e1e1e);';
      contourPicker=root.document.createElement('select');contourPicker.setAttribute('aria-label','Path contour');contourPicker.style.cssText='padding:6px;background:var(--control, #f5f5f5);color:var(--ink, #1e1e1e);border:1px solid var(--line, #e6e6e6);border-radius:4px;';

      contourPicker.onchange=()=>selectContour(Number(contourPicker.value));label.append(contourPicker);toolbar.append(label);
    }
    function selectContour(index){
      if(drag||!verify())return;contour=index;vertices=subpaths[index].nodes;closed=subpaths[index].closed;active=0;activeHandle=null;arcAnchor=-1;
      if(contourPicker)contourPicker.value=String(index);rebuild();(moveContourMode?contourHit:handles[0]).focus({preventScroll:true});
    }
    if(pathData){
      cornerButton=action('Make corner',()=>reshape('corner'));cornerButton.title='Remove the selected anchor’s handles';
      smoothButton=action('Make smooth',()=>reshape('smooth'));smoothButton.title='Create aligned handles along the neighboring anchors';
      const label=root.document.createElement('label');label.textContent='Move handles ';label.style.cssText='font:12px Inter,system-ui;color:var(--ink, #1e1e1e);';
      handleMode=root.document.createElement('select');handleMode.setAttribute('aria-label','Handle movement');handleMode.title='Applies to paired handles while editing. Independent moves one; aligned keeps the opposite length; mirrored keeps equal lengths.';
      for(const [value,text] of [['independent','Independent'],['aligned','Aligned'],['mirrored','Mirrored']]){const option=root.document.createElement('option');option.value=value;option.textContent=text;handleMode.append(option);}
      handleMode.value=handleMovement;handleMode.style.cssText='padding:6px;background:var(--control, #f5f5f5);color:var(--ink, #1e1e1e);border:1px solid var(--line, #e6e6e6);border-radius:4px;';handleMode.onchange=()=>{handleMovement=handleMode.value;refreshPosition();};label.append(handleMode);toolbar.append(label);
      const visibilityLabel=root.document.createElement('label'),visibility=root.document.createElement('input');visibilityLabel.style.cssText='display:flex;align-items:center;gap:4px;font:12px Inter,system-ui;color:var(--ink, #1e1e1e);';visibility.type='checkbox';visibility.setAttribute('aria-label','Show all handles');visibility.onchange=()=>{showAllHandles=visibility.checked;paint();};visibilityLabel.append(visibility,root.document.createTextNode('Show all handles'));visibilityLabel.title='Normally only the selected point’s curve handles are shown. Select any point to reshape it.';optionsPanel.append(visibilityLabel);
    }
    if(subpaths){
      moveContourButton=action('Move contour',()=>{if(drag||!verify())return;moveContourMode=!moveContourMode;activeHandle=null;rebuild();(moveContourMode?contourHit:handles[active]).focus({preventScroll:true});});moveContourButton.title='Move every anchor and handle in the selected contour. Drag its outline or use arrow keys; Shift constrains movement.';
      drawContourButton=action('Draw contour',drawContour);drawContourButton.title='Draw a new outline in this path. Finish drawing, then Done saves the path.';
      duplicateContourButton=action('Duplicate contour',()=>restructure('duplicate'));duplicateContourButton.title='Copy this contour with a 10-unit SVG offset';
      deleteContourButton=action('Delete contour',()=>restructure('delete'));deleteContourButton.title='Remove this contour, keeping the rest of the path';
      action('Reverse contour',()=>restructure('reverse')).title='Reverse drawing direction. This can change holes with the nonzero fill rule.';
      closureButton=action('Close contour',()=>restructure(closed?'open':'close'));
    }
    function drawContour(){
      if(drag||!verify()||cancelPen)return;
      if(totalPoints()>510||subpaths.length>=128){announce('This path has no room for another contour.');return;}
      surface.style.display='none';arcPanel.style.display='none';arrangePanel.style.display='none';positionPanel.style.display='none';
      cancelPen=root.RetouchSVGPen.mount({target,frame,canvas,maxPoints:512-totalPoints(),isCurrent:current,contextPath:root.RetouchSVGPath.serializeCompound({subpaths}),
        onEnd:()=>{cancelPen=null;if(!ended){surface.style.display='';rebuild(false);(moveContourMode?contourHit:handles[active]).focus({preventScroll:true});}},
        onError,
        onCommit:(flat,closed,nodes)=>{
          if(ended||!verify())return;
          const drawn=nodes||Array.from({length:flat.length/2},(_,i)=>({x:flat[i*2],y:flat[i*2+1]}));
          const result=root.RetouchSVGPath.appendContour({subpaths},drawn,closed);
          if(!result){announce('The new contour exceeds this path’s supported limits.');return;}
          subpaths.splice(0,subpaths.length,...result.subpaths);selectContour(result.selected);announce('Contour added to preview. Done saves; Escape cancels.');
        }});
    }
    function restructure(action){
      if(drag||!verify())return;
      const result=root.RetouchSVGPath.editContour({subpaths},contour,action);
      if(!result){announce('This contour change would exceed path limits or leave an invalid path.');return;}
      subpaths.splice(0,subpaths.length,...result.subpaths);selectContour(result.selected);
      announce({duplicate:'Contour duplicated. Done saves; Escape cancels.',delete:'Contour removed from preview. Done saves; Escape cancels.',reverse:'Contour direction reversed. Done saves; Escape cancels.',open:'Closing edge removed. Done saves; Escape cancels.',close:'Endpoints joined. Done saves; Escape cancels.'}[action]);
    }
    const arcPanel=root.document.createElement('div');arcPanel.setAttribute('role','group');arcPanel.setAttribute('aria-label','Arc properties');arcPanel.style.cssText='display:none;flex-basis:100%;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line, #e6e6e6);padding-top:8px;color:var(--ink, #1e1e1e);font:12px Inter,system-ui;';
    const arcHeading=root.document.createElement('strong');arcHeading.textContent='Arc properties';arcHeading.style.cssText='flex-basis:100%;font-size:12px;';arcPanel.append(arcHeading);
    const arcPicker=root.document.createElement('select');arcPicker.setAttribute('aria-label','Arc segment');arcPanel.append(arcPicker);
    const arcInputs={};let arcIndex=null,arcAnchor=-1;
    for(const [key,label] of [['rx','Radius X'],['ry','Radius Y'],['rotation','Rotation (°)']]){
      const wrap=root.document.createElement('label');wrap.textContent=label+' ';const input=root.document.createElement('input');input.type='number';input.step='any';input.min=key==='rotation'?'-100000':'0';input.max='100000';input.setAttribute('aria-label','Arc '+label);input.style.cssText='width:78px;padding:5px;background:var(--control, #f5f5f5);color:var(--ink, #1e1e1e);border:1px solid var(--line, #e6e6e6);border-radius:4px;';input.oninput=()=>changeArc({[key]:input.value===''?NaN:Number(input.value)},input);arcInputs[key]=input;wrap.append(input);arcPanel.append(wrap);
    }
    const longLabel=root.document.createElement('label'),longArc=root.document.createElement('input');longArc.type='checkbox';longArc.setAttribute('aria-label','Long arc');longArc.onchange=()=>changeArc({large:longArc.checked?1:0});longLabel.append(longArc,root.document.createTextNode('Long arc'));arcPanel.append(longLabel);
    const reverseArc=action('Reverse arc',()=>{if(arcIndex!==null)changeArc({sweep:1-vertices[arcIndex].arc.sweep});});arcPanel.append(reverseArc);const arcNote=root.document.createElement('span');arcNote.dataset.arcHint='true';arcNote.style.cssText='flex-basis:100%;font-size:11px;line-height:1.4;color:var(--muted, #757575);';arcPanel.append(arcNote);if(propertiesPane){arcPanel.style.padding='12px';arcPanel.style.marginBottom='12px';arcPanel.style.border='1px solid var(--line, #e6e6e6)';arcPanel.style.borderRadius='6px';propertiesPane.prepend(arcPanel);}else toolbar.append(arcPanel);
    const convertArc=action('Convert arc to Bézier',()=>{
      if(drag||cancelPen||arcIndex===null||!verify())return;
      if(Object.values(arcInputs).some(input=>input.getAttribute('aria-invalid')==='true')){status.textContent='Correct the arc properties before converting.';return;}
      const converted=root.RetouchSVGPath.arcToCubics({nodes:vertices,closed},arcIndex);
      if(!converted||totalPoints()-vertices.length+converted.nodes.length>512){status.textContent='This conversion cannot meet the precision and point limits. The arc is unchanged.';return;}
      vertices.splice(0,vertices.length,...converted.nodes);active=converted.selected;activeHandle=null;arcAnchor=-1;rebuild();handles[active].focus({preventScroll:true});announce('Arc converted to editable Bézier curves. Done saves; Escape cancels.');
    });convertArc.title='Approximate this arc with editable curves, within 0.01 SVG units. The original arc can be restored with Undo.';arcPanel.insertBefore(convertArc,arcNote);
    arcPicker.style.cssText='padding:5px;background:var(--control, #f5f5f5);color:var(--ink, #1e1e1e);border:1px solid var(--line, #e6e6e6);border-radius:4px;';arcPicker.onchange=()=>{arcIndex=Number(arcPicker.value);refreshArc();};
    listen(arcPanel,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}else if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.type==='number'){e.preventDefault();e.stopImmediatePropagation();commit();}},true);
    function refreshArc(){
      const next=(active+1)%vertices.length,indices=[];if(vertices[active]?.arc)indices.push(active);if((closed||active<vertices.length-1)&&vertices[next]?.arc)indices.push(next);
      arcPanel.style.display=pathData&&!moveContourMode&&selectedPoints.size===1&&indices.length?'flex':'none';
      if(!indices.length)return;if(arcAnchor!==active||!indices.includes(arcIndex))arcIndex=indices[0];arcAnchor=active;arcPicker.replaceChildren();
      for(const index of indices){const option=root.document.createElement('option');option.value=String(index);option.textContent=index===active?'Arc into point '+(active+1):'Arc out of point '+(active+1);arcPicker.append(option);}arcPicker.value=String(arcIndex);
      const arc=vertices[arcIndex].arc;for(const [key,input] of Object.entries(arcInputs)){input.value=String(arc[key]);input.removeAttribute('aria-invalid');}longArc.checked=!!arc.large;updateArcHint();
    }
    function updateArcHint(){
      const node=vertices[arcIndex];if(!node?.arc)return;const arc=node.arc,center=root.RetouchSVGPath.arcCenter(vertices[(arcIndex+vertices.length-1)%vertices.length],node),number=n=>Number(n.toFixed(2));
      arcNote.textContent=!arc.rx||!arc.ry?'A zero radius makes this segment straight.':center&&(center.rx>arc.rx+1e-6||center.ry>arc.ry+1e-6)?`SVG expands these radii to ${number(center.rx)} × ${number(center.ry)} to connect the endpoints.`:'Changes are previewed until you choose Done.';
    }
    function changeArc(changes,input){
      if(drag||cancelPen||arcIndex===null||!verify())return;
      const result=root.RetouchSVGPath.setArc({nodes:vertices,closed},arcIndex,changes);if(input)input.setAttribute('aria-invalid',String(!result));
      if(!result){status.textContent='Enter finite radii from 0 to 100000 and a rotation from −100000 to 100000.';return;}
      vertices[arcIndex].arc=result.nodes[arcIndex].arc;paint();status.textContent='Arc updated in preview. Done saves; Escape cancels.';
    }
    const positionPanel=root.document.createElement('div');positionPanel.setAttribute('role','group');positionPanel.setAttribute('aria-label','Vector position');positionPanel.style.cssText='padding:12px 16px;border-bottom:1px solid var(--line, #e6e6e6);color:var(--ink, #1e1e1e);font:12px Inter,system-ui;';
    const positionHeading=root.document.createElement('strong');positionHeading.textContent='Point position';positionPanel.append(positionHeading);
    const positionRow=root.document.createElement('div');positionRow.style.cssText='display:flex;gap:8px;margin-top:12px;';positionPanel.append(positionRow);const positionInputs={};
    for(const axis of ['x','y']){
      const label=root.document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:0 8px;height:28px;border-radius:4px;background:var(--control, #f5f5f5);color:var(--muted, #757575);';label.append(root.document.createTextNode(axis.toUpperCase()));
      const input=root.document.createElement('input');input.type='number';input.step='any';input.min='-100000';input.max='100000';input.setAttribute('aria-label','Vector '+axis.toUpperCase());input.style.cssText='width:100%;min-width:0;border:0;background:transparent;color:var(--ink, #1e1e1e);font:12px Inter,system-ui;';input.oninput=()=>changePosition(axis,input);label.append(input);positionInputs[axis]=input;positionRow.append(label);
    }
    const positionNote=root.document.createElement('p');positionNote.style.cssText='margin:8px 0 0;color:var(--muted, #757575);font-size:11px;line-height:1.4;';positionPanel.append(positionNote);
    if(propertiesPane)propertiesPane.prepend(positionPanel);else toolbar.append(positionPanel);
    listen(positionPanel,'keydown',event=>{event.stopPropagation();if(event.isComposing)return;if(event.key==='Escape'){event.preventDefault();cancel();}else if(event.key==='Enter'){event.preventDefault();commit();}},true);
    function refreshPosition(reset=false){
      const visible=!moveContourMode&&!cancelPen&&selectedPoints.size>0;positionPanel.style.display=visible?'block':'none';if(!visible)return;
      positionHeading.textContent=activeHandle?(activeHandle==='in'?'Incoming handle':'Outgoing handle'):selectedPoints.size>1?'Selected points':'Point position';positionNote.textContent=activeHandle?'SVG coordinates · '+({independent:'Independent handle',aligned:'Aligned handles',mirrored:'Mirrored handles'}[handleMovement]):selectedPoints.size>1?'SVG coordinates · Top-left of selected anchors. Moves points together.':'SVG coordinates · Shared across screen sizes';
      for(const axis of ['x','y']){const input=positionInputs[axis];if(reset){input.setCustomValidity('');input.removeAttribute('aria-invalid');}if(reset||root.document.activeElement!==input&&input.getAttribute('aria-invalid')!=='true')input.value=String(activeHandle?vertices[active][activeHandle][axis]:Math.min(...[...selectedPoints].map(i=>vertices[i][axis])));}
    }
    function changePosition(axis,input){
      if(drag||cancelPen||moveContourMode||!selectedPoints.size||!verify())return;
      const value=input.value===''?NaN:Number(input.value),start=Math.min(...[...selectedPoints].map(i=>vertices[i][axis]));
      let result=null;
      if(Number.isFinite(value)&&Math.abs(value)<=100000){
        if(activeHandle){const node=root.RetouchSVGPath.moveHandle(vertices[active],activeHandle,{...vertices[active][activeHandle],[axis]:value},handleMovement);if(node){const nodes=vertices.map((original,i)=>i===active?node:original);if(root.RetouchSVGPath.serialize(nodes,closed))result={nodes};}}
        else result=root.RetouchSVGPath.translatePoints({nodes:vertices,closed},[...selectedPoints],axis==='x'?value-start:0,axis==='y'?value-start:0);
      }
      input.setCustomValidity(result?'':'Keep anchors and handles within supported SVG coordinates.');input.setAttribute('aria-invalid',String(!result));if(!result)return;
      vertices.splice(0,vertices.length,...result.nodes);paint();status.textContent=(activeHandle?'Handle':'Point')+' position updated in preview. Done saves; Escape cancels.';
    }
    const arrangePanel=root.document.createElement('div');arrangePanel.setAttribute('role','group');arrangePanel.setAttribute('aria-label','Arrange points');arrangePanel.style.cssText='display:none;padding:16px;border-bottom:1px solid var(--line, #e6e6e6);color:var(--ink, #1e1e1e);font:12px Inter,system-ui;';
    const arrangeHeading=root.document.createElement('strong');arrangeHeading.textContent='Arrange points';arrangePanel.append(arrangeHeading);const arrangeButtons=[];
    for(const [axis,labels] of [['x',['Left','Center','Right']],['y',['Top','Middle','Bottom']]]){
      const row=root.document.createElement('div');row.style.cssText='display:flex;gap:4px;margin-top:8px;';arrangePanel.append(row);
      labels.forEach((label,i)=>{const button=action('Align points '+label.toLowerCase(),()=>arrange(axis,['min','center','max'][i]));button.setAttribute('aria-label',button.textContent);button.textContent=label;button.style.flex='1';row.append(button);arrangeButtons.push({button,min:2});});
    }
    for(const [axis,label] of [['x','Space horizontally'],['y','Space vertically']]){const button=action(label,()=>arrange(axis,'distribute'));button.style.marginTop='8px';button.style.width='100%';arrangePanel.append(button);arrangeButtons.push({button,min:3});}
    const arrangeHelp=root.document.createElement('p');arrangeHelp.textContent='Aligns point centers on the canvas. Handles move with their points. Done saves; Escape cancels.';arrangeHelp.style.cssText='font-size:11px;line-height:1.4;color:var(--muted, #757575);margin:8px 0 0;';arrangePanel.append(arrangeHelp);if(propertiesPane)positionPanel.after(arrangePanel);else toolbar.append(arrangePanel);
    listen(arrangePanel,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}},true);
    function refreshArrange(){arrangePanel.style.display=!moveContourMode&&!cancelPen&&!activeHandle&&selectedPoints.size>1?'block':'none';for(const {button,min} of arrangeButtons)button.disabled=selectedPoints.size<min;}
    function arrange(axis,mode){
      if(drag||cancelPen||moveContourMode||!verify())return;
      const result=root.RetouchSVGPath.arrangePoints({nodes:vertices,closed},[...selectedPoints],axis,mode,initialMatrix);
      if(!result){announce('This arrangement would leave an invalid contour or exceed coordinate limits. Points are unchanged.');return;}
      vertices.splice(0,vertices.length,...result.nodes);activeHandle=null;rebuild(false);handles[active].focus({preventScroll:true});announce('Points arranged. Done saves; Escape cancels.');
    }
    function selectAllPoints(){if(drag||moveContourMode||!verify())return;selectedPoints=new Set(vertices.map((_,i)=>i));activeHandle=null;announce();paint();handles[active].focus({preventScroll:true});}
    action('Select all points',selectAllPoints).title='Select every point in this contour. Drag a box for a smaller selection. Shift-click or Shift-drag adds points; drag selected points or use arrows to move them.';
    const removeButton=action('Delete point',removePoint);
    for(const button of [...toolbar.children]){const label=button.textContent;if(actionIcons[label])compact(button,label);if(['Duplicate contour','Delete contour','Reverse contour','Close contour'].includes(label)){button.style.textAlign='left';optionsPanel.append(button);}}
    if(subpaths||pathData)toolbar.append(options);
    action('Done',commit);action('Cancel',cancel);surface.append(toolbar);
    function adjacentArc(){return [...selectedPoints].some(i=>vertices[i]?.arc||(vertices[i+1]||(closed?vertices[0]:null))?.arc);}
    function announce(message){refreshArc();refreshArrange();refreshPosition(true);if(cornerButton){const arcEndpoint=adjacentArc(),disabled=moveContourMode||!selectedPoints.size||arcEndpoint;cornerButton.title=arcEndpoint?'Arc endpoints retain arc geometry. Move them or use Arc properties.':'Remove the selected anchor’s handles';smoothButton.title=arcEndpoint?'Arc endpoints retain arc geometry. Move them or use Arc properties.':'Create aligned handles along the neighboring anchors';cornerButton.disabled=disabled;smoothButton.disabled=disabled;for(const button of [cornerButton,smoothButton])button.style.opacity=disabled?'.5':'1';}status.textContent=message||(!selectedPoints.size?'No points selected. Drag a box to select points.':null)||(selectedPoints.size>1&&!activeHandle?`${selectedPoints.size} points selected. Shift-click adds or removes points.`:null)||`${activeHandle?activeHandle==='in'?'Incoming handle on point':'Outgoing handle on point':'Point'} ${active+1} of ${vertices.length}`;removeButton.disabled=moveContourMode||!selectedPoints.size||vertices.length-selectedPoints.size<minimum;removeButton.setAttribute('aria-label',selectedPoints.size>1?'Delete points':'Delete point');removeButton.title=removeButton.getAttribute('aria-label');removeButton.style.opacity=removeButton.disabled?'.5':'1';}
    const totalPoints=()=>subpaths?subpaths.reduce((sum,part)=>sum+part.nodes.length,0):vertices.length;
    function refreshContours(){
      if(!contourPicker)return;contourPicker.replaceChildren();
      subpaths.forEach((part,i)=>{const option=root.document.createElement('option');option.value=String(i);option.textContent=`${i+1} of ${subpaths.length} · ${part.closed?'Closed':'Open'}`;contourPicker.append(option);});contourPicker.value=String(contour);
      drawContourButton.disabled=subpaths.length>=128||totalPoints()>510;deleteContourButton.disabled=subpaths.length===1;duplicateContourButton.disabled=subpaths.length>=128||totalPoints()+vertices.length>512;
      closureButton.textContent=closed?'Open contour':'Close contour';closureButton.title=closed?'Remove the edge from the last anchor to the first':'Join the last anchor to the first with a straight edge';
      moveContourButton.setAttribute('aria-pressed',String(moveContourMode));moveContourButton.style.background=moveContourMode?'#e5f4ff':'var(--control, #f5f5f5)';cornerButton.disabled=moveContourMode;smoothButton.disabled=moveContourMode;handleMode.disabled=moveContourMode;
      for(const button of [deleteContourButton,duplicateContourButton,drawContourButton,cornerButton,smoothButton])button.style.opacity=button.disabled?'.5':'1';
    }
    function rebuild(resetSelection=true){
      if(resetSelection)selectedPoints=new Set([active]);
      refreshContours();
      for(const b of [...handles,...insertions,...curveHandles.map(h=>h.button)])b.remove();handles=[];insertions=[];curveHandles=[];
      vertices.forEach((_,i)=>{
        const b=root.document.createElement('button');b.type='button';b.dataset.vertex=String(i);b.setAttribute('aria-label','Vector point '+(i+1));
        Object.assign(b.style,{position:'absolute',width:'12px',height:'12px',padding:'0',border:'2px solid var(--accent, #0d99ff)',background:'white',borderRadius:'2px',cursor:'move',touchAction:'none',zIndex:1});
        surface.append(b);handles.push(b);
        if(pathData)for(const key of ['in','out'])if(vertices[i][key]&&Math.hypot(vertices[i][key].x-vertices[i].x,vertices[i][key].y-vertices[i].y)>1e-9){const control=root.document.createElement('button');control.type='button';control.dataset.vertex=String(i);control.dataset.curveHandle=key;control.setAttribute('aria-label',(key==='in'?'Incoming':'Outgoing')+' handle '+(i+1));Object.assign(control.style,{position:'absolute',width:'10px',height:'10px',padding:'0',border:'2px solid var(--accent, #0d99ff)',background:'white',borderRadius:'50%',cursor:'move',touchAction:'none',zIndex:1});surface.append(control);curveHandles.push({button:control,index:i,key});}

        if(closed||i<vertices.length-1){
          const add=root.document.createElement('button');add.type='button';add.dataset.insertVertex=String(i);add.setAttribute('aria-label','Add point after '+(i+1));add.title='Add a point on this edge';add.textContent='+';add.disabled=totalPoints()>=512;
          Object.assign(add.style,{position:'absolute',width:'18px',height:'18px',padding:'0',border:'1px solid var(--accent, #0d99ff)',background:'white',color:'#0d99ff',borderRadius:'50%',font:'14px/16px system-ui',cursor:'copy'});
          surface.append(add);insertions.push(add);
        }
      });
      for(const button of [...handles,...insertions,...curveHandles.map(h=>h.button)])button.hidden=moveContourMode;
      tangentLines.style.display=moveContourMode?'none':'';preview.style.setProperty('stroke','var(--accent, #0d99ff)','important');preview.style.setProperty('stroke-width',moveContourMode?'2.5':'1.5','important');
      contourHit.style.display=moveContourMode?'':'none';contourHit.setAttribute('tabindex',moveContourMode?'0':'-1');
      announce(moveContourMode?'Drag this contour or use arrows. Shift: 10 units. Done or Enter saves.':undefined);paint();
    }
    function reshape(kind){
      if(drag||!verify())return;
      if(adjacentArc()){announce('Arc endpoints support moving and subdivision. Edit path data to change arc parameters.');return;}
      const candidate=vertices.map((p,i)=>selectedPoints.has(i)?kind==='corner'?root.RetouchSVGPath.corner(p):root.RetouchSVGPath.smooth(vertices,i,closed):p);
      if(candidate.some(p=>!p)||!root.RetouchSVGPath.serialize(candidate,closed)){announce('These points cannot use that shape. Keep a valid path.');return;}
      vertices.splice(0,vertices.length,...candidate);activeHandle=null;rebuild(false);handles[active].focus({preventScroll:true});
    }
    function changeHandle(node,key,point){
      const next=root.RetouchSVGPath.moveHandle(node,key,point,handleMovement);
      if(next)vertices[active]=next;else announce('Keep handles within supported SVG coordinates.');
    }
    function insertPoint(index){
      if(drag||!verify())return;
      if(totalPoints()>=512){announce('This vector has reached 512 points.');return;}
      const a=vertices[index],b=vertices[(index+1)%vertices.length];
      if(pathData){const next=root.RetouchSVGPath.split(vertices,index,closed);if(!next)return;vertices.splice(0,vertices.length,...next);}else vertices.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});activeHandle=null;active=index+1;rebuild();(moveContourMode?contourHit:handles[active]).focus({preventScroll:true});
    }
    function removePoint(){
      if(drag||!selectedPoints.size||!verify())return;
      const remaining=vertices.filter((_,i)=>!selectedPoints.has(i));
      if(remaining.length<minimum){announce(`Keep at least ${minimum} points in this ${closed?'polygon':'line'}.`);return;}
      if(pathData&&!root.RetouchSVGPath.serialize(remaining,closed)){announce('Keep a valid contour with distinct anchors.');return;}
      vertices.splice(0,vertices.length,...remaining);activeHandle=null;active=Math.min(active,vertices.length-1);rebuild();handles[active].focus({preventScroll:true});
    }
    listen(surface,'focusin',e=>{if(e.target.dataset.vertex!==undefined){active=Number(e.target.dataset.vertex);activeHandle=e.target.dataset.curveHandle||null;if(!selectedPoints.has(active))selectedPoints=new Set([active]);announce();paint();}});
    listen(surface,'click',e=>{if(e.target.dataset.contour!==undefined){e.preventDefault();e.stopImmediatePropagation();selectContour(Number(e.target.dataset.contour));return;}if(e.target.dataset.insertVertex!==undefined){e.preventDefault();e.stopImmediatePropagation();insertPoint(Number(e.target.dataset.insertVertex));}});
    function paint(){
      updateArcHint();refreshPosition();
      const f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth,m=initialMatrix;
      preview.setAttribute(property,pathData?root.RetouchSVGPath.serialize(vertices,closed)||'':root.RetouchSVGPoints.format(vertices));
      preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);
      contourHit.setAttribute('d',preview.getAttribute('d')||'');contourHit.setAttribute('transform',preview.getAttribute('transform'));
      otherContours.replaceChildren();
      subpaths?.forEach((part,i)=>{if(i===contour)return;const outline=root.document.createElementNS(ns,'path');outline.setAttribute('d',root.RetouchSVGPath.serialize(part.nodes,part.closed));outline.setAttribute('transform',preview.getAttribute('transform'));outline.setAttribute('vector-effect','non-scaling-stroke');outline.style.cssText='fill:none!important;stroke:#99d6ff!important;stroke-width:1.5!important;';otherContours.append(outline);
        const hit=outline.cloneNode();hit.dataset.contour=String(i);hit.style.cssText='fill:none!important;stroke:transparent!important;stroke-width:12!important;pointer-events:stroke;cursor:pointer;';const title=root.document.createElementNS(ns,'title');title.textContent='Edit contour '+(i+1);hit.append(title);otherContours.append(hit);});
      function position(b,p,half){const q=new w.DOMPoint(p.x,p.y).matrixTransform(m);Object.assign(b.style,{left:f.left+q.x*scale-r.left-half+'px',top:f.top+q.y*scale-r.top-half+'px'});}
      vertices.forEach((p,i)=>{position(handles[i],p,6);handles[i].style.background=selectedPoints.has(i)?'var(--accent, #0d99ff)':'white';handles[i].setAttribute('aria-pressed',String(selectedPoints.has(i)));});
      insertions.forEach((b,i)=>{b.hidden=moveContourMode||!!pathData&&!selectedPoints.has(i)&&!selectedPoints.has((i+1)%vertices.length);const a=vertices[i],next=vertices[(i+1)%vertices.length];position(b,pathData?root.RetouchSVGPath.segmentMiddle(a,next):{x:(a.x+next.x)/2,y:(a.y+next.y)/2},9);});
      tangentLines.replaceChildren();curveHandles.forEach(h=>{h.button.hidden=moveContourMode||!showAllHandles&&!selectedPoints.has(h.index);if(h.button.hidden)return;const a=vertices[h.index],b=a[h.key];const selected=h.index===active&&h.key===activeHandle;h.button.style.background=selected?'var(--accent, #0d99ff)':'white';h.button.setAttribute('aria-pressed',String(selected));position(h.button,b,5);const line=root.document.createElementNS(ns,'line'),p=new w.DOMPoint(a.x,a.y).matrixTransform(m),q=new w.DOMPoint(b.x,b.y).matrixTransform(m);line.setAttribute('x1',f.left+p.x*scale-r.left);line.setAttribute('y1',f.top+p.y*scale-r.top);line.setAttribute('x2',f.left+q.x*scale-r.left);line.setAttribute('y2',f.top+q.y*scale-r.top);line.style.cssText='stroke:var(--accent, #0d99ff)!important;stroke-width:1!important;';tangentLines.append(line);});

    }
    function commit(){
      if(!verify())return;
      if(positionPanel.style.display!=='none'&&Object.values(positionInputs).some(input=>!input.checkValidity())){Object.values(positionInputs).find(input=>!input.checkValidity())?.reportValidity();return;}
      if(arcPanel.style.display!=='none'&&Object.values(arcInputs).some(input=>input.getAttribute('aria-invalid')==='true')){status.textContent='Correct the arc properties before saving.';return;}
      const value=pathData?root.RetouchSVGPath.serializeCompound({subpaths}):root.RetouchSVGPoints.format(vertices),changed=pathData?JSON.stringify(subpaths)!==JSON.stringify(pathData.subpaths):JSON.stringify(vertices)!==JSON.stringify(points);
      if(pathData?!value:!root.RetouchSVGPoints.parse(value)){cancel();onError('Vector points must stay within supported SVG coordinates.');return;}
      cancel();if(changed)onCommit(value);
    }
    function updateMarquee(e){
      const left=Math.min(drag.box.x,e.clientX),top=Math.min(drag.box.y,e.clientY),right=Math.max(drag.box.x,e.clientX),bottom=Math.max(drag.box.y,e.clientY),r=surface.getBoundingClientRect();
      selectedPoints=new Set(drag.box.previous);
      handles.forEach((button,i)=>{const b=button.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;if(x>=left&&x<=right&&y>=top&&y<=bottom)selectedPoints.add(i);});
      if(selectedPoints.size&&!selectedPoints.has(active))active=[...selectedPoints][0];activeHandle=null;
      Object.assign(selectionBox.style,{left:left-r.left+'px',top:top-r.top+'px',width:right-left+'px',height:bottom-top+'px'});selectionBox.hidden=false;announce();paint();
    }
    function moveSelected(nodes,dx,dy){
      if(!selectedPoints.size)return;
      const result=root.RetouchSVGPath.translatePoints({nodes,closed},[...selectedPoints],dx,dy);
      if(result)vertices.splice(0,vertices.length,...result.nodes);else announce('Keep the selected points within supported SVG coordinates.');
    }
    function move(e){
      if(!drag||e.pointerId!==drag.id||!verify())return;
      if(drag.box){updateMarquee(e);return;}
      try{const p=local(e);let dx=p.x-drag.pointer.x,dy=p.y-drag.pointer.y;
        if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
        if(drag.contour){const translated=root.RetouchSVGPath.translateContour(drag.contour,dx,dy);if(translated)vertices.splice(0,vertices.length,...translated.nodes);else announce('Keep the contour within supported SVG coordinates.');}else if(activeHandle)changeHandle(drag.node,activeHandle,{x:drag.point.x+dx,y:drag.point.y+dy});else moveSelected(drag.nodes,dx,dy);paint();
      }catch(error){cancel();onError(error.message);}
    }
    listen(surface,'pointerdown',e=>{
      const b=e.target;if(e.button!==0||drag)return;
      if(moveContourMode&&b===contourHit){e.preventDefault();e.stopImmediatePropagation();if(!verify())return;try{contourHit.focus({preventScroll:true});drag={id:e.pointerId,pointer:local(e),point:{...vertices[0]},contour:{closed,nodes:vertices.map(p=>root.RetouchSVGPath.translate(p,0,0))}};contourHit.setPointerCapture(e.pointerId);}catch(error){cancel();onError(error.message);}return;}
      if(!moveContourMode&&(b===surface||b===drawing)){e.preventDefault();e.stopImmediatePropagation();if(!verify())return;surface.focus({preventScroll:true});drag={id:e.pointerId,box:{x:e.clientX,y:e.clientY,previous:e.shiftKey?[...selectedPoints]:[]}};surface.setPointerCapture(e.pointerId);updateMarquee(e);return;}
      if(b.dataset.vertex===undefined)return;
      e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      try{const index=Number(b.dataset.vertex);activeHandle=b.dataset.curveHandle||null;
        if(e.shiftKey&&!activeHandle){if(selectedPoints.has(index)&&selectedPoints.size>1){selectedPoints.delete(index);active=[...selectedPoints][0];handles[active].focus({preventScroll:true});announce();paint();return;}selectedPoints.add(index);}else if(!selectedPoints.has(index))selectedPoints=new Set([index]);
        active=index;b.focus({preventScroll:true});announce();paint();drag={id:e.pointerId,pointer:local(e),nodes:vertices.map(p=>root.RetouchSVGPath.translate(p,0,0)),node:root.RetouchSVGPath.translate(vertices[active],0,0),point:root.RetouchSVGPath.translate(activeHandle?vertices[active][activeHandle]:vertices[active],0,0),collapse:!e.shiftKey&&!activeHandle};b.setPointerCapture(e.pointerId);
      }catch(error){cancel();onError(error.message);}
    });
    listen(surface,'pointermove',move);
    listen(surface,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();move(e);if(!ended&&drag.box){drag=null;selectionBox.hidden=true;announce();return;}if(!ended){const selected=drag.contour?vertices[0]:activeHandle?vertices[active][activeHandle]:vertices[active],moved=Math.hypot(selected.x-drag.point.x,selected.y-drag.point.y)>1e-9;const collapse=drag.collapse;drag=null;if(moved)commit();else if(collapse){selectedPoints=new Set([active]);announce();paint();}}});
    listen(surface,'pointercancel',cancel);listen(surface,'lostpointercapture',()=>{if(drag)cancel();});
    listen(surface,'keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(options.open){options.open=false;optionsToggle.focus();return;}cancel();return;}
      if(toolbar.contains(e.target)&&['BUTTON','SUMMARY'].includes(e.target.tagName)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){
        const scope=options.open&&optionsPanel.contains(e.target)?optionsPanel:toolbar,items=[...scope.querySelectorAll('button:not(:disabled),summary')].filter(el=>el.getClientRects().length),index=items.indexOf(e.target);
        if(index>=0){e.preventDefault();e.stopImmediatePropagation();const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+items.length)%items.length;items[next]?.focus();}return;
      }
      if(arcPanel.contains(e.target)){if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.type==='number'){e.preventDefault();e.stopImmediatePropagation();commit();}return;}
      if(e.target===handleMode||e.target===contourPicker||toolbar.contains(e.target)&&e.target.tagName==='INPUT')return;
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){e.preventDefault();e.stopImmediatePropagation();selectAllPoints();return;}
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();if(moveContourMode)restructure('delete');else removePoint();return;}
      if(e.key==='Enter'&&(e.target.dataset.vertex!==undefined||e.target===contourHit||e.target===surface)){e.preventDefault();e.stopImmediatePropagation();commit();return;}
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!delta||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      const step=e.shiftKey?10:1;if(moveContourMode){const translated=root.RetouchSVGPath.translateContour({nodes:vertices,closed},delta[0]*step,delta[1]*step);if(translated)vertices.splice(0,vertices.length,...translated.nodes);else announce('Keep the contour within supported SVG coordinates.');}else if(activeHandle)changeHandle(vertices[active],activeHandle,root.RetouchSVGPath.translate(vertices[active][activeHandle],delta[0]*step,delta[1]*step));else moveSelected(vertices,delta[0]*step,delta[1]*step);paint();
    },true);
    for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
    listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(canvas,'scroll',cancel);
    if(pathData&&initialCSS){
      // Compare values normalized by the same browser CSS parser: computed d can
      // round coordinates even when the source attribute supplies all geometry.
      const style=root.document.createElement('span').style;style.setProperty('d','path("'+original.replace(/\s+/g,' ')+'")');
      const parseCSS=value=>{const match=/^path\(["']([\s\S]*)["']\)$/.exec(value);return match&&root.RetouchSVGPath.parseCompound(match[1]);};
      if(!root.RetouchSVGPath.equivalentCompound(parseCSS(style.getPropertyValue('d'))||pathData,parseCSS(initialCSS))){cancel();onError('This path has a CSS geometry override. Edit that style before changing its source points.');return null;}
    }
    if(!initial||Math.abs(initialMatrix.a*initialMatrix.d-initialMatrix.b*initialMatrix.c)<1e-12){cancel();onError('This vector transform cannot be edited.');return null;}
    const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    const left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
    if(right<=left||bottom<=top){cancel();onError('Bring the vector into view before editing.');return null;}
    Object.assign(surface.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
    if(bottom-top<180)toolbar.style.bottom='12px';
    listen(root.document,'pointerdown',event=>{if(options.open&&!options.contains(event.target))options.open=false;},true);
    root.document.body.append(surface);rebuild();handles[0].focus({preventScroll:true});
    function watch(){if(!ended&&verify())raf=root.requestAnimationFrame(watch);}raf=root.requestAnimationFrame(watch);
    return cancel;
  }
  root.RetouchSVGVertices={mount};
})(window);
