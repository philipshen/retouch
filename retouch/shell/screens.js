(function () {
  'use strict';
  const preset = document.getElementById('screenPreset');
  const width = document.getElementById('screenWidth');
  const height = document.getElementById('screenHeight');
  const key = 'retouch.screen.v1';
  let screen = null;
  function valid(value) { return Number.isInteger(value) && value >= 240 && value <= 7680; }
  function apply(next, options = {}) {
    screen = next;
    const name = next ? `${next.width}x${next.height}` : 'fluid';
    preset.value = [...preset.options].some(o => o.value === name) ? name : 'custom';
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
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { input.blur(); } });
  }
  preset.addEventListener('change', () => {
    width.setCustomValidity(''); height.setCustomValidity('');
    if (preset.value === 'fluid') apply(null);
    else if (preset.value === 'custom') { custom(); width.focus(); width.select(); }
    else { const [w, h] = preset.value.split('x').map(Number); apply({ width: w, height: h }); }
  });
  document.getElementById('screenRotate').addEventListener('click', () => {
    const w = Number(width.value), h = Number(height.value);
    if (valid(w) && valid(h)) apply({ width: h, height: w });
  });
  window.addEventListener('retouch:viewport', e => {
    if (!screen) { width.value = e.detail.width; height.value = e.detail.height; }
  });
  window.RetouchScreens = { get() { return screen ? {...screen} : null; }, set(next, options) { if(next===null || next && valid(next.width) && valid(next.height))apply(next, options); }, restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && valid(saved.width) && valid(saved.height)) apply(saved);
    } catch {}
  } };
})();
