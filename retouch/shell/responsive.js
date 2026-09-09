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
    function add(prefix,queries) {
      if(!/^[a-zA-Z][\w-]*:$/.test(prefix) || /^(hover|focus|active|disabled|dark|group|peer|print):$/.test(prefix))return;
      const item=found.get(prefix)||{prefix,label:prefix.slice(0,-1),queries:[]};
      if(!item.queries.some(group=>JSON.stringify(group)===JSON.stringify(queries)))item.queries.push(queries);
      item.condition=item.queries.map(group=>group.length===1?group[0]:group.map(query=>'['+query+']').join(' AND ')).join(' OR ');found.set(prefix,item);
    }
    function scan(rules,media=[],parentSelector='',ancestors=new Set()) {
      for(const rule of rules) {
        const own=rule.media?.mediaText,queries=own&&own!=='all'&&!media.includes(own)?[...media,own]:media;
        const selector=rule.selectorText || parentSelector;
        const declarations=rule.style?(rule.style.length===undefined||rule.style.length>0):!rule.cssRules;
        if(declarations&&queries.some(query=>/width/.test(query))&&selector){
          for(const match of selector.matchAll(/\.([a-zA-Z][\w-]*)\\:/g))add(match[1]+':',queries);
        }
        if(rule.styleSheet)scanSheet(rule.styleSheet,queries,ancestors);
        if(rule.cssRules)scan(rule.cssRules,queries,selector,ancestors);
      }
    }
    function scanSheet(sheet,media=[],ancestors=new Set()){
      if(!sheet||ancestors.has(sheet))return;
      try{if(sheet.disabled)return;const own=sheet.media?.mediaText,queries=own&&own!=='all'&&!media.includes(own)?[...media,own]:media;scan(sheet.cssRules,queries,'',new Set([...ancestors,sheet]));}catch{}
    }
    for(const sheet of [...(d.styleSheets||[]),...(d.adoptedStyleSheets||[])])scanSheet(sheet);
    return [...found.values()].sort((a,b)=>a.label.localeCompare(b.label));
  }
  function matches(choice,w){
    const groups=choice?.queries||(choice?.condition?[[choice.condition]]:null);if(!groups?.length)return null;
    try{return groups.some(group=>group.every(query=>w.matchMedia(query).matches));}catch{return null;}
  }
  function minimumCondition(item){
    if(item?.queries&&(item.queries.length!==1||item.queries[0].length!==1))return null;
    return item?.queries?.[0][0]||item?.condition||null;
  }
  // Anchor fallback for distinct, ascending minimum-width scopes. Complex media
  // conditions and state variants are excluded rather than treated as breakpoints.
  function inherited(classes,prefix,d,choices=d?discover(d):[]){
    const base=project(classes);if(!prefix||!d)return base;
    const probe=d.createElement('span');probe.style.cssText='font-size:initial;position:absolute;visibility:hidden';d.documentElement.append(probe);const initial=parseFloat(d.defaultView.getComputedStyle(probe).fontSize)||16;probe.remove();
    const minimum=scope=>{
      const arbitrary=/^min-\[(\d+(?:\.\d+)?)(px|rem|em)\]:$/.exec(scope);
      const condition=minimumCondition(choices.find(item=>item.prefix===scope));
      const named=condition&&/^\(\s*(?:min-width\s*:\s*|width\s*>=\s*)([\d.]+)(px|rem|em)\s*\)$/.exec(condition);
      const match=arbitrary||named;return match?Number(match[1])*(match[2]==='px'?1:initial):null;
    };
    const limit=minimum(prefix);if(limit===null)return base;
    const scopes=[...new Set(tokens(classes).map(token=>split(token).prefix))].filter(scope=>scope&&scope!==prefix).map(scope=>({scope,width:minimum(scope)})).filter(item=>item.width!==null&&item.width<limit).sort((a,b)=>a.width-b.width);
    return [base,...scopes.map(item=>project(classes,item.scope))].filter(Boolean).join(' ');
  }
  function atWidth(d,width,choices=discover(d)) {
    // Media-query em/rem units use the initial font size, not a styled root.
    const probe=d.createElement('span');probe.style.cssText='font-size:initial;position:absolute;visibility:hidden';
    d.documentElement.append(probe);
    const initial=parseFloat(d.defaultView.getComputedStyle(probe).fontSize)||16;probe.remove();
    const minima=choices.map(item=>{
      const match=minimumCondition(item)?.match(/^\(\s*(?:min-width\s*:\s*|width\s*>=\s*)([\d.]+)(px|rem|em)\s*\)$/);
      return match?{...item,unit:match[2],px:Number(match[1])*(match[2]==='px'?1:initial)}:null;
    }).filter(Boolean);
    const existing=minima.find(item=>Math.abs(item.px-width)<.01);
    if(existing)return existing;
    const units=choices.flatMap(item=>item.queries?item.queries.flat():[item.condition||'']).map(query=>query.match(/(?:min-width\s*:\s*|width\s*>=\s*)[\d.]+(px|rem|em)/)?.[1]).filter(Boolean);
    const unit=units.includes('rem')?'rem':minima[0]?.unit||units[0]||'px';
    const size=Math.round((unit==='px'?width:width/initial)*100000)/100000;
    return {prefix:`min-[${size}${unit}]:`,label:`${width} px and larger`};
  }
  const api={split,project,replaceScope,discover,matches,inherited,atWidth};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RetouchResponsive=api;
})(typeof window==='object'?window:globalThis);
