'use strict';
// Preserve the authored expression and apply a token patch to its result on
// every render. Never replace a conditional class string with one DOM snapshot.
const {twMerge}=require('tailwind-merge');
const TOKEN={test:require('./class-tokens.cjs').liquid};
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
// Keep raw scanner candidates in a non-rendering Liquid comment while the
// actual attribute text is HTML-escaped. The adapter strips this owned marker
// before describing a literal class attribute.
const marker=/\{% comment %\}retouch-font-candidates: [\s\S]*?\{% endcomment %\}/g;
const clean=value=>value.replace(marker,'');
function literal(value){const special=tokens(value).filter(t=>require('./class-tokens.cjs').fontFamily(t)||escape(t)!==t);return (special.length?'{% comment %}retouch-font-candidates: '+special.join(' ')+' {% endcomment %}':'')+escape(value);}

function familyScope(token){const m=/^(.*?:)?!?(?:font-(?:sans|serif|mono)|font-\[family-name:.*\]|\[font-family:.*\])!?$/.exec(token);return m?m[1]||'':null;}
const tokens=value=>String(value||'').split(/\s+/).filter(Boolean);
function unpack(value,id) {
  const prefix=`{% capture __rt_classes_${id} %}`;
  const boundary='{% endcapture %}';
  const metadata=/\{% comment %\}retouch-classes-v1:([A-Za-z0-9+/=]+)\{% endcomment %\}$/;
  const match=metadata.exec(value);
  if (!value.startsWith(prefix)||!match) return {original:value,removed:[],added:[]};
  const end=value.indexOf(boundary,prefix.length);
  const patch=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));
  if (end<0||!Array.isArray(patch.removed)||!Array.isArray(patch.added)||![...patch.removed,...patch.added].every(t=>typeof t==='string'&&TOKEN.test(t))) throw new Error('The class patch changed. Re-select the element.');
  return {original:value.slice(prefix.length,end),...patch};
}
function effective(value,id,rendered) {
  const patch=unpack(value,id);
  return twMerge([...tokens(rendered).filter(t=>!patch.removed.includes(t)),...patch.added].join(' '));
}
function edit(value,id,rendered,desired,source,html=true) {
  if (typeof rendered!=='string') throw new Error('Reload the preview to read this element’s rendered classes.');
  const patch=unpack(value,id),before=tokens(effective(value,id,rendered)),after=tokens(twMerge(desired));
  const removed=new Set([...patch.removed,...before.filter(t=>!after.includes(t))]);
  const added=[...new Set([...patch.added.filter(t=>after.includes(t)),...after.filter(t=>!before.includes(t))])];
  // Remove conflicting known utilities in inactive branches as well. Variant
  // prefixes remain distinct under the same Tailwind merge rules as React.
  const literals=[...source.matchAll(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g)].flatMap(block=>[...block[0].matchAll(/"([^"]*)"|'([^']*)'/g)].flatMap(m=>tokens(m[1]??m[2])));
  literals.push(...tokens(decode(patch.original.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g,' '))));
  for (const token of literals) if (TOKEN.test(token)&&(!tokens(twMerge(token+' '+added.join(' '))).includes(token)||(familyScope(token)!==null&&added.some(next=>familyScope(next)===familyScope(token))))) removed.add(token);
  const meta=Buffer.from(JSON.stringify({removed:[...removed],added})).toString('base64');
  const input=`__rt_classes_${id}`,list=`__rt_class_list_${id}`,item=`__rt_class_${id}`;
  // Captures preserve literal backslashes without depending on string-literal
  // escape behavior. Decode the HTML-safe capture before comparing class tokens.
  const removalValues=[...removed].map((token,i)=>{const name=`__rt_remove_${id}_${i}`;return {name,code:`{% capture ${name} %}${escape(token)}{% endcapture %}{% assign ${name} = ${name} | replace: '&quot;', '"' | replace: '&#39;', "'" | replace: '&amp;', '&' %}`};});
  const condition=removalValues.map(({name})=>`${item} == ${name}`).join(' or ');
  const output=`{{ ${item}${html?' | escape':''} }} `;
  return `{% capture ${input} %}${patch.original}{% endcapture %}`+
    `{% assign ${list} = ${input}${html?` | replace: '&quot;', '"' | replace: '&#39;', "'" | replace: '&amp;', '&'`:''} | newline_to_br | replace: '<br />', ' ' | replace: '\t', ' ' | strip_newlines | split: ' ' %}`+
    removalValues.map(({code})=>code).join('')+`{% for ${item} in ${list} %}`+(condition?`{% unless ${condition} %}${output}{% endunless %}`:output)+
    `{% endfor %}${html?literal(added.join(' ')):added.join(' ')}{% comment %}retouch-classes-v1:${meta}{% endcomment %}`;
}
module.exports={effective,edit,unpack,literal,clean,decode};
