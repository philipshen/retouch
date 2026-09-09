(function(root){
  'use strict';
  const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
  const fits=['cover','contain','fill','none','scale-down'];
  function fit(classes,value){if(!fits.includes(value))throw Error('Unknown image fit');return I.replace(classes,t=>fits.some(f=>t==='object-'+f),'object-'+value);}
  function position(classes,x,y){
    if(![x,y].every(v=>Number.isFinite(v)&&v>=0&&v<=100))throw Error('Position must be between 0 and 100 percent');
    return I.replace(classes,t=>t.startsWith('object-')&&!fits.some(f=>t==='object-'+f),`object-[${x}%_${y}%]`);
  }
  function coordinates(classes,computed){
    const own=/(?:^|\s)!?object-\[([-.\d]+)%_([-.\d]+)%\]!?($|\s)/.exec(classes||'');
    if(own)return [Number(own[1]),Number(own[2])];
    return computed.split(/\s+/).map(p=>/^[-\d.]+%$/.test(p)?parseFloat(p):NaN);
  }
  function mount(info,el,save){
    const sec=I.section('Image framing');if(!el||el.tagName!=='IMG')return sec;
    if(info.classNameDynamic){I.note(sec,info.classNameReason||'Image styles are computed.','refused');return sec;}
    const css=el.ownerDocument.defaultView.getComputedStyle(el);
    I.select(sec,'Image fit',[['cover','Fill frame'],['contain','Fit inside'],['fill','Stretch'],['none','Original size'],['scale-down','Scale down']],css.objectFit,v=>save(fit(info.className,v)));
    const parts=css.objectPosition.split(/\s+/);
    const numbers=coordinates(info.className,css.objectPosition);
    const grid=document.createElement('div');grid.className='anchor-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label','Image position');
    const symbols=['↖','↑','↗','←','·','→','↙','↓','↘'];
    for(let y=0;y<3;y++)for(let x=0;x<3;x++){
      const b=I.button(symbols[y*3+x],()=>save(position(info.className,x*50,y*50)));
      const name=['top','middle','bottom'][y]+' '+['left','center','right'][x];b.setAttribute('aria-label','Image position '+name);b.title=name;
      b.setAttribute('aria-pressed',String(numbers[0]===x*50&&numbers[1]===y*50));grid.append(b);
    }
    sec.append(grid);
    const fields=[];
    for(let i=0;i<2;i++){
      const input=document.createElement('input');input.type='number';input.min=0;input.max=100;input.step='any';
      input.value=Number.isFinite(numbers[i])?numbers[i]:'';input.placeholder=parts[i]||'50%';
      I.field(sec,i===0?'Image horizontal position (%)':'Image vertical position (%)',input);fields.push(input);
      input.onchange=()=>{if(fields.every(f=>f.value!==''&&f.checkValidity()))save(position(info.className,...fields.map(f=>Number(f.value))));};
    }
    I.note(sec,'Position the image inside its frame.');
    return sec;
  }
  const api={fit,position,coordinates,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchImageStyle=api;
})(typeof window==='object'?window:globalThis);
