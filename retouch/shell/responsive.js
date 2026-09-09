(function(root) {
  'use strict';
  const tokens = text => (text || '').split(/\s+/).filter(Boolean);
  // Split variants without interpreting colons in arbitrary values/selectors.
  function split(token) {
    let depth=0, quote='', escaped=false, last=-1;
    for(let i=0;i<token.length;i++) {
      const c=token[i];
      if(escaped){escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(quote){if(c===quote)quote='';continue;}
      if(c==='"'||c==="'"){quote=c;continue;}
      if(c==='['||c==='(')depth++;
      else if(c===']'||c===')')depth--;
      else if(c===':'&&depth===0)last=i;
    }
    return {prefix:token.slice(0,last+1),value:token.slice(last+1)};
  }
  function project(classes,prefix='') {
    return tokens(classes).map(split).filter(t=>t.prefix===prefix).map(t=>t.value).join(' ');
  }
  function replaceScope(classes,values,prefix='') {
    if(prefix && !/^(?:[a-zA-Z][\w-]*|(?:min|max)-\[\d+(?:\.\d+)?(?:px|rem|em)\]):$/.test(prefix))throw Error('Unsupported screen scope');
    const additions=tokens(values);
    // Raw class editor remains scoped as well: no silently nested variants.
    if(additions.some(t=>split(t).prefix))throw Error('Choose a screen scope before adding an unprefixed class.');
    return tokens(classes).filter(t=>split(t).prefix!==prefix).concat([...new Set(additions)].map(t=>prefix+t)).join(' ');
  }
  function discover(d) {
    const found=new Map();
    function add(prefix,condition) {
      if(!/^[a-zA-Z][\w-]*:$/.test(prefix) || /^(hover|focus|active|disabled|dark|group|peer|print):$/.test(prefix))return;
      found.set(prefix,{prefix,label:prefix.slice(0,-1),condition});
    }
    function scan(rules,media='',parentSelector='') {
      for(const rule of rules) {
        const condition=rule.media?.mediaText || media;
        const selector=rule.selectorText || parentSelector;
        if(condition && /width/.test(condition) && selector) {
          for(const match of selector.matchAll(/\.([a-zA-Z][\w-]*)\\:/g)) add(match[1]+':',condition);
        }
        if(rule.cssRules)scan(rule.cssRules,condition,selector);
      }
    }
    for(const sheet of d.styleSheets){try{scan(sheet.cssRules);}catch{}}
    return [...found.values()].sort((a,b)=>a.label.localeCompare(b.label));
  }
  function atWidth(d,width,choices=discover(d)) {
    // Media-query em/rem units use the initial font size, not a styled root.
    const probe=d.createElement('span');probe.style.cssText='font-size:initial;position:absolute;visibility:hidden';
    d.documentElement.append(probe);
    const initial=parseFloat(d.defaultView.getComputedStyle(probe).fontSize)||16;probe.remove();
    const minima=choices.map(item=>{
      const match=item.condition.match(/(?:min-width\s*:\s*|width\s*>=\s*)([\d.]+)(px|rem|em)/);
      return match?{...item,unit:match[2],px:Number(match[1])*(match[2]==='px'?1:initial)}:null;
    }).filter(Boolean);
    const existing=minima.find(item=>Math.abs(item.px-width)<.01);
    if(existing)return existing;
    const unit=minima.find(item=>item.unit==='rem')?.unit || minima[0]?.unit || 'px';
    const size=Math.round((unit==='px'?width:width/initial)*100000)/100000;
    return {prefix:`min-[${size}${unit}]:`,label:`${width} px and larger`};
  }
  const api={split,project,replaceScope,discover,atWidth};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RetouchResponsive=api;
})(typeof window==='object'?window:globalThis);
