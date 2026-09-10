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
        if(declarations&&queries.some(query=>/\b(?:width|height|orientation|aspect-ratio)\b/.test(query))&&selector){
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
  // Candidate boundaries suggest sizes; the browser remains authoritative for
  // nested alternatives, orientation, range syntax and environment conditions.
  function previewSize(choice,d,current,wanted=true){
    const groups=choice?.queries||(choice?.condition?[[choice.condition]]:null);
    if(!groups?.length||!d||!current)return null;
    const probe=d.createElement('iframe');probe.title='Breakpoint preview measurement';probe.setAttribute('aria-hidden','true');probe.tabIndex=-1;
    probe.style.cssText='position:fixed!important;left:-10000px!important;top:0!important;border:0!important;visibility:hidden!important;pointer-events:none!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;';
    d.documentElement.append(probe);
    try{
      const w=probe.contentWindow;if(!w)return null;
      const initial=parseFloat(w.getComputedStyle(w.document.documentElement).fontSize)||16;
      const unitPixels={px:1,em:initial,rem:initial,in:96,cm:96/2.54,mm:96/25.4,q:96/101.6,pt:96/72,pc:16};
      const widths=new Set([current.width,240,7680]),heights=new Set([current.height,240,7680]),ratios=[];
      const add=(set,value)=>{for(const n of [Math.floor(value)-1,Math.floor(value),Math.ceil(value),Math.ceil(value)+1])if(n>=240&&n<=7680)set.add(n);};
      for(const query of groups.flat())for(const part of query.matchAll(/\(([^()]*)\)/g)){
        if(/\baspect-ratio\b/.test(part[1]))for(const match of part[1].matchAll(/(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?/g)){
          const a=match[1],b=match[2]||'1',scale=10**Math.max(a.split('.')[1]?.length||0,b.split('.')[1]?.length||0);
          let numerator=Math.round(Number(a)*scale),denominator=Math.round(Number(b)*scale);
          if(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator)||numerator<=0||denominator<=0)continue;
          let x=numerator,y=denominator;while(y){const remainder=x%y;x=y;y=remainder;}
          ratios.push({numerator:numerator/x,denominator:denominator/x});
        }
        const axes=part[1].match(/(?:min-|max-)?(width|height)\b/g)||[];
        for(const value of part[1].matchAll(/(\d+(?:\.\d+)?)(px|rem|em|in|cm|mm|q|pt|pc)\b/gi))for(const axis of axes)add(axis.endsWith('width')?widths:heights,Number(value[1])*unitPixels[value[2].toLowerCase()]);
      }
      // Orientation can require crossing the other dimension without an
      // explicit numerical boundary in the query.
      for(const value of [...widths,...heights]){add(widths,value);add(heights,value);}
      const pairs=new Map(),pair=(width,height)=>{if(Number.isInteger(width)&&Number.isInteger(height)&&width>=240&&width<=7680&&height>=240&&height<=7680)pairs.set(width+'x'+height,{width,height});};
      for(const width of widths)for(const height of heights)pair(width,height);
      for(const {numerator:a,denominator:b}of ratios){
        // Near-boundary pairs cover inequalities. Integer multiples of the
        // reduced fraction also cover exact ratios without rounding drift.
        for(const height of heights){const near=new Set();add(near,height*a/b);for(const width of near)pair(width,height);}
        for(const width of widths){const near=new Set();add(near,width*b/a);for(const height of near)pair(width,height);}
        const low=Math.ceil(Math.max(240/a,240/b)),high=Math.floor(Math.min(7680/a,7680/b));
        for(const multiple of [low,high,...[...widths].map(width=>width/a),...[...heights].map(height=>height/b)])for(const k of [Math.floor(multiple),Math.ceil(multiple)])if(k>=low&&k<=high)pair(k*a,k*b);
      }
      const candidates=[...pairs.values()];
      candidates.sort((a,b)=>(Math.abs(a.width-current.width)+Math.abs(a.height-current.height))-(Math.abs(b.width-current.width)+Math.abs(b.height-current.height)));
      for(const size of candidates.slice(0,2000)){
        probe.style.setProperty('width',size.width+'px','important');probe.style.setProperty('height',size.height+'px','important');
        void probe.offsetWidth;
        if(matches(choice,w)===wanted)return size;
      }
      return null;
    }finally{probe.remove();}
  }
  function inheritedLink(links,prefix,d,choices=null){
    if(!links||!prefix||!d||Object.hasOwn(links,prefix))return null;
    choices=choices||discover(d);
    const probe=d.createElement('span');probe.style.cssText='font-size:initial;position:absolute;visibility:hidden';d.documentElement.append(probe);
    const initial=parseFloat(d.defaultView.getComputedStyle(probe).fontSize)||16;probe.remove();
    function minimum(scope){
      if(scope==='')return -1;
      const arbitrary=/^min-\[(\d+(?:\.\d+)?)(px|rem|em)\]:$/.exec(scope),condition=minimumCondition(choices.find(item=>item.prefix===scope));
      const named=condition&&/^\(\s*(?:min-width\s*:\s*|width\s*>=\s*)([\d.]+)(px|rem|em)\s*\)$/.exec(condition),match=arbitrary||named;
      return match?Number(match[1])*(match[2]==='px'?1:initial):null;
    }
    const limit=minimum(prefix);if(limit===null)return null;
    const candidates=[];
    for(const [scope,link]of Object.entries(links)){
      const width=minimum(scope);if(width===null||width===limit)return null;
      if(width<limit)candidates.push({scope,link,width,label:scope?(choices.find(item=>item.prefix===scope)?.label||width+'px and larger'):'All sizes'});
    }
    candidates.sort((a,b)=>b.width-a.width);
    if(!candidates.length||candidates.length>1&&candidates[0].width===candidates[1].width)return null;
    const {scope,link,label}=candidates[0];return {scope,link,label};
  }
  const api={split,project,replaceScope,discover,matches,inherited,atWidth,inheritedLink,previewSize};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RetouchResponsive=api;
})(typeof window==='object'?window:globalThis);
