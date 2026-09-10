(function () {
  'use strict';
  const preset = document.getElementById('screenPreset');
  const width = document.getElementById('screenWidth');
  const height = document.getElementById('screenHeight');
  const project=window.__RT_RENDERING?.stateScope?.project;
  const key = 'retouch.screen.v1'+(typeof project==='string'&&/^[a-f0-9]{64}$/.test(project)?':'+project:'');
  const savedGroup=document.createElement('optgroup');savedGroup.label='Project screens';preset.append(savedGroup);
  let screen = null, viewport = null;
  function valid(value) { return Number.isInteger(value) && value >= 240 && value <= 7680; }
  function apply(next, options = {}) {
    screen = next;
    const name = next ? `${next.width}x${next.height}` : 'fluid';
    preset.value = [...preset.options].some(o => o.value === name) ? name : [...savedGroup.children].some(o=>o.value==='saved:'+name)?'saved:'+name:'custom';
    if (next) { width.value = next.width; height.value = next.height; }
    if(options.persist!==false)try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    window.dispatchEvent(Object.assign(new CustomEvent('retouch:screen', { detail: next }), {preservePan:!!options.preservePan}));
  }
  function custom() {
    const w = Number(width.value), h = Number(height.value);
    if (!valid(w) || !valid(h)) {
      const input = !valid(w) ? width : height;
      input.setCustomValidity('Choose a whole number from 240 to 7680.');
      input.reportValidity();
      return;
    }
    apply({ width: w, height: h });
  }
  for (const input of [width, height]) {
    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('change', custom);
    input.addEventListener('keydown', e => {
      if(e.key==='Escape'){
        e.preventDefault();e.stopPropagation();
        const committed=screen||viewport;
        if(committed)input.value=input===width?committed.width:committed.height;
        input.setCustomValidity('');input.select();
      }else if(e.shiftKey&&['ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();
        const current=Number(input.value);
        if(Number.isFinite(current)&&input.value!==''){
          input.value=Math.max(240,Math.min(7680,Math.round(current)+(e.key==='ArrowUp'?10:-10)));
          input.setCustomValidity('');custom();
        }
      }else if(e.key==='Enter')input.blur();
    });
  }
  preset.addEventListener('change', () => {
    width.setCustomValidity(''); height.setCustomValidity('');
    if (preset.value === 'fluid') apply(null);
    else if (preset.value === 'custom') { custom(); width.focus(); width.select(); }
    else { const [w, h] = preset.value.replace(/^saved:/,'').split('x').map(Number); apply({ width: w, height: h }); }
  });
  document.getElementById('screenRotate').addEventListener('click', () => {
    const w = Number(width.value), h = Number(height.value);
    if (valid(w) && valid(h)) apply({ width: h, height: w });
  });
  window.addEventListener('retouch:viewport', e => {
    viewport={width:e.detail.width,height:e.detail.height};
    if (!screen) { width.value = e.detail.width; height.value = e.detail.height; }
  });
  window.RetouchScreens = { setSaved(sizes) {
    savedGroup.replaceChildren();
    for(const [label,w,h] of sizes){if(typeof label!=='string'||!valid(w)||!valid(h))continue;const option=document.createElement('option');option.value='saved:'+w+'x'+h;option.textContent=label+' · '+w+' × '+h;savedGroup.append(option);}
    const name=screen?screen.width+'x'+screen.height:'fluid';preset.value=[...preset.options].some(option=>option.value===name)?name:[...savedGroup.children].some(option=>option.value==='saved:'+name)?'saved:'+name:'custom';
  }, get() { return screen ? {...screen} : null; }, set(next, options) { if(next===null || next && valid(next.width) && valid(next.height))apply(next, options); }, restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && valid(saved.width) && valid(saved.height)) apply(saved);
    } catch {}
  } };
})();
