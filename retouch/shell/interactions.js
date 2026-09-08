(function (root) {
  'use strict';
  // Figma hierarchy navigation: Enter child, Shift+Enter parent, Tab siblings.
  // https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
  const STAMP = '[data-rt], [data-rt-i]';
  function nativeInput(target) {
    return !!target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
  }
  function parentOf(el) { return el?.parentElement?.closest(STAMP) || null; }
  function childOf(el) { return el?.querySelector(STAMP) || null; }
  function siblingOf(el, backwards) {
    const parent = parentOf(el) || el?.ownerDocument?.body;
    const siblings = Array.from(parent?.querySelectorAll(STAMP) || []).filter(node => (parentOf(node) || node.ownerDocument.body) === parent);
    const index = siblings.indexOf(el);
    return index < 0 || siblings.length < 2 ? null : siblings[(index + (backwards ? -1 : 1) + siblings.length) % siblings.length];
  }
  function commandFor(event, state, canvas) {
    if (event.defaultPrevented || event.isComposing || nativeInput(event.target) || state.editing) return null;
    const key = event.key.toLowerCase(), mod = event.metaKey || event.ctrlKey;
    if (state.mode !== 'edit' || state.busy) return null;
    if (mod && !event.altKey) {
      if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
      if (key === 'y' && !event.shiftKey) return 'redo';
      if (key === 'd' && !event.shiftKey) return 'duplicate';
      if (key === 'c' && !event.shiftKey) return 'copy';
      if (key === 'v' && !event.shiftKey) return 'paste';
      if (key === '[' && !event.shiftKey) return 'moveBackward';
      if (key === ']' && !event.shiftKey) return 'moveForward';
      return null;
    }
    if (mod || event.altKey) return null;
    if (key === 'escape') return 'clearSelection';
    if (!state.selected) return null;
    if (key === 'contextmenu' || (key === 'f10' && event.shiftKey)) return 'contextMenu';
    if (key === 'enter') return event.shiftKey ? 'selectParent' : 'selectChild';
    if (key === 'tab' && canvas) return event.shiftKey ? 'previousSibling' : 'nextSibling';
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return 'nudge';
    if (key === 'delete' || key === 'backspace') return 'delete';
    return null;
  }
  function create({ document: d, getState, actions, onError = () => {} }) {
    let menu = null, opener = null, generation = 0;
    const cleanups = [];
    let nudgeGesture = null, nudgeSerial = 0;
    function endNudge() {
      if (!nudgeGesture) return;
      const key = nudgeGesture.id; nudgeGesture = null;
      try { Promise.resolve(actions.endNudgeGesture?.(key)).catch(onError); } catch (error) { onError(error); }
    }
    function close(restoreFocus = false) {
      generation++;
      if (menu) { menu.remove(); menu = null; }
      if (restoreFocus && opener?.isConnected) opener.focus?.();
      opener = null;
    }
    function enabled(name, state) {
      if (state.busy) return false;
      if (name === 'nudge') return !!state.selected && !!state.canNudge;
      const structuralFlag = { duplicate: 'canDuplicate', delete: 'canDelete', moveBackward: 'canMoveBefore', moveForward: 'canMoveAfter', paste: 'canPaste' }[name];
      if (structuralFlag) return !!state.selected && !!state.structure?.[structuralFlag] && (name !== 'paste' || state.canPaste !== false);
      if (name === 'undo') return !!state.canUndo;
      if (name === 'redo') return !!state.canRedo;
      if (name === 'selectParent') return !!parentOf(state.selected);
      if (name === 'selectChild') return !!childOf(state.selected);
      if (name === 'nextSibling' || name === 'previousSibling') return !!siblingOf(state.selected, name === 'previousSibling');
      if (name === 'contextMenu' || name === 'clearSelection') return !!state.selected;
      if (name === 'detachComponent') return !!state.component?.canDetach;
      if (name === 'editDefinition') return !!state.component;
      if (name === 'editText') return !!state.selected && state.canEditText !== false;
      return !!actions[name] && (!!state.selected || name === 'paste');
    }
    function available(name) {
      return ['selectParent', 'selectChild', 'nextSibling', 'previousSibling', 'contextMenu'].includes(name) ? !!actions.select : typeof actions[name] === 'function';
    }
    async function run(name) {
      const state = getState();
      if (!available(name) || !enabled(name, state)) return;
      try {
        if (name === 'selectParent') await actions.select(parentOf(state.selected));
        else if (name === 'selectChild') await actions.select(childOf(state.selected));
        else if (name === 'nextSibling' || name === 'previousSibling') await actions.select(siblingOf(state.selected, name === 'previousSibling'));
        else await actions[name]();
      } catch (error) { onError(error); }
    }
    function show(x, y) {
      close();
      const state = getState();
      opener = state.selected?.ownerDocument?.activeElement || d.activeElement;
      menu = d.createElement('div');
      menu.className = 'rt-context-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Canvas actions');
      const mac = /Mac|iPhone|iPad/.test(d.defaultView.navigator?.platform || '');
      const mod = mac ? '⌘' : 'Ctrl+';
      const rows = [
        ['undo', 'Undo', mod + 'Z'], ['redo', 'Redo', mod + '⇧Z'],
        ['copy', 'Copy', mod + 'C'], ['paste', 'Paste', mod + 'V'], ['duplicate', 'Duplicate', mod + 'D'],
        ['selectParent', 'Select parent', '⇧Enter'], ['selectChild', 'Select child', 'Enter'],
        ['editText', 'Edit text', ''], ['editDefinition', 'Go to main component', ''], ['detachComponent', 'Detach instance', ''],
        ['moveForward', 'Bring forward', mod + ']'], ['moveBackward', 'Send backward', mod + '['],
        ['delete', 'Delete', '⌫'], ['clearSelection', 'Deselect', 'Esc'],
      ];
      for (const [name, label, shortcut] of rows) {
        if (!available(name) || ((name === 'editDefinition' || name === 'detachComponent') && !state.component)) continue;
        const button = d.createElement('button'); button.type = 'button'; button.setAttribute('role', 'menuitem'); button.tabIndex = -1;
        button.disabled = !enabled(name, state); button.dataset.command = name;
        const text = d.createElement('span'); text.textContent = label;
        const hint = d.createElement('kbd'); hint.textContent = shortcut;
        button.append(text, hint);
        button.addEventListener('click', () => { close(); void run(name); });
        menu.append(button);
      }
      d.body.append(menu);
      const rect = menu.getBoundingClientRect();
      menu.style.left = Math.max(4, Math.min(x, d.defaultView.innerWidth - rect.width - 4)) + 'px';
      menu.style.top = Math.max(4, Math.min(y, d.defaultView.innerHeight - rect.height - 4)) + 'px';
      menu.addEventListener('keydown', event => {
        const buttons = Array.from(menu.querySelectorAll('button:not(:disabled)'));
        const index = buttons.indexOf(d.activeElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        } else if (event.key === 'Escape' || event.key === 'Tab') {
          event.preventDefault(); event.stopPropagation(); close(true);
        }
      });
      menu.querySelector('button:not(:disabled)')?.focus();
    }
    function bindDocument(target, { canvas = false, toShellPoint = (x, y) => ({ x, y }) } = {}) {
      const listen = (type, listener, capture = true) => {
        target.addEventListener(type, listener, capture);
        const cleanup = () => target.removeEventListener(type, listener, capture);
        cleanups.push(cleanup); return cleanup;
      };
      const removers = [];
      removers.push(listen('keydown', event => {
        if (menu?.contains(event.target) || d.querySelector('dialog[open]')) return;
        const state = getState();
        let command = commandFor(event, state, canvas);
        if (command === 'selectChild' && !childOf(state.selected) && actions.editText && state.canEditText !== false) command = 'editText';
        if (!command || !available(command)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (command === 'nudge') {
          close();
          if (!enabled(command, state)) { endNudge(); return; }
          if (!nudgeGesture || nudgeGesture.key !== event.key || !event.repeat) {
            endNudge(); nudgeGesture = { key: event.key, id: 'nudge-' + (++nudgeSerial) };
          }
          const step = event.shiftKey ? 10 : 1;
          const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
          const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
          try { Promise.resolve(actions.nudge(dx, dy, { gestureKey: nudgeGesture.id })).catch(onError); } catch (error) { onError(error); }
          return;
        }
        endNudge();
        if (command === 'contextMenu') {
          const rect = state.selected.getBoundingClientRect(), point = toShellPoint(rect.left, rect.bottom);
          show(point.x, point.y);
        } else { close(); void run(command); }
      }));
      removers.push(listen('keyup', event => { if (event.key === nudgeGesture?.key) endNudge(); }));
      removers.push(listen('blur', () => endNudge()));
      if (canvas) removers.push(listen('contextmenu', async event => {
        const state = getState();
        if (state.mode !== 'edit' || state.editing || state.busy || nativeInput(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation(); endNudge(); close();
        const serial = generation;
        const node = event.target.closest?.(STAMP);
        try {
          if (node) await actions.select(node); else await actions.clearSelection?.();
          if (serial !== generation || getState().mode !== 'edit') return;
          const point = toShellPoint(event.clientX, event.clientY); show(point.x, point.y);
        } catch (error) { onError(error); }
      }));
      removers.push(listen('pointerdown', event => { endNudge(); if (!menu?.contains(event.target)) close(); }));
      removers.push(listen('scroll', () => close()));
      return () => { for (const remove of removers) remove(); endNudge(); close(); };
    }
    return { bindDocument, close, destroy() { endNudge(); close(); for (const cleanup of cleanups.splice(0)) cleanup(); } };
  }
  const api = { create, commandFor, nativeInput, parentOf, childOf, siblingOf };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RetouchInteractions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
