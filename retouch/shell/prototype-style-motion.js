(function(root){
 'use strict';
 const cssName=name=>name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
 function create(el,frames,timing){
  const d=el.ownerDocument,host=d.createElement('div'),proxy=d.createElement('div'),initial=el.getAttribute('style'),baseline=el.style.cssText,changes=new Map();let names=[];
  host.className='prototype-style-motion';host.inert=true;host.setAttribute('aria-hidden','true');host.style.cssText='all:initial!important;position:fixed!important;left:-100000px!important;top:0!important;width:0!important;height:0!important;overflow:hidden!important;visibility:hidden!important;pointer-events:none!important;contain:strict!important';host.attachShadow({mode:'open'}).append(proxy);proxy.style.cssText='all:initial;display:block;position:absolute';proxy.style.boxSizing=d.defaultView.getComputedStyle(el).boxSizing;d.body.append(host);
  let animation;try{animation=proxy.animate(frames,timing);animation.pause();animation.currentTime=0;}catch(error){host.remove();throw error;}
  function write(name,value){let change=changes.get(name);if(change&&(!change.owned||el.style.getPropertyValue(name)!==change.last||el.style.getPropertyPriority(name)!=='important')){change.owned=false;return;}if(change&&change.last===value)return;if(!change){change={value:el.style.getPropertyValue(name),priority:el.style.getPropertyPriority(name),owned:true};changes.set(name,change);}el.style.setProperty(name,value,'important');change.last=el.style.getPropertyValue(name);}
  function update(){const frames=animation.effect.getKeyframes(),keys=new Set(frames.flatMap(frame=>Object.keys(frame)));names=[...keys].filter(key=>!['offset','computedOffset','easing','composite'].includes(key)&&frames.some(frame=>frame[key]!==frames[0][key])).map(cssName);}
  const owned= (name,change)=>change.owned&&el.style.getPropertyValue(name)===change.last&&el.style.getPropertyPriority(name)==='important';
  function size(name,value){const group=[name,'min-'+name,'max-'+name];
   // Layout constraints can defeat width/height (notably flex-basis). Pin the
   // animated used size, but relinquish the entire group on an app-side edit.
   if(group.some(key=>changes.has(key)&&!owned(key,changes.get(key)))){for(const key of group){const change=changes.get(key);if(!change)continue;if(owned(key,change)){if(change.value)el.style.setProperty(key,change.value,change.priority);else el.style.removeProperty(key);}change.owned=false;}return;}
   for(const key of group)write(key,value);
  }
  function render(){if(!el.isConnected||!names.length)return;write('transition-property','none');const css=d.defaultView.getComputedStyle(proxy);for(const name of names){const value=css.getPropertyValue(name);if((name==='width'||name==='height')&&/^[-+\d.e]+px$/i.test(value))size(name,value);else write(name,value);}}
  function dispose(){animation.cancel();for(const [name,change]of changes){if(name==='transition-property')continue;if(change.owned&&el.style.getPropertyValue(name)===change.last&&el.style.getPropertyPriority(name)==='important'){if(change.value)el.style.setProperty(name,change.value,change.priority);else el.style.removeProperty(name);}}void el.getBoundingClientRect();const transition=changes.get('transition-property');if(transition?.owned&&el.style.getPropertyValue('transition-property')===transition.last&&el.style.getPropertyPriority('transition-property')==='important'){if(transition.value)el.style.setProperty('transition-property',transition.value,transition.priority);else el.style.removeProperty('transition-property');}if(el.style.cssText===baseline){if(initial===null)el.removeAttribute('style');else el.setAttribute('style',initial);}host.remove();}
  update();return {animation,update,render,dispose};
 }
 root.RetouchPrototypeStyleMotion={create};
})(window);
