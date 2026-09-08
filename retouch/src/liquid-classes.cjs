'use strict';
// Preserve the authored expression and apply a token patch to its result on
// every render. Never replace a conditional class string with one DOM snapshot.
const {twMerge}=require('tailwind-merge');
const TOKEN=/^[^\s"'`\\<>{}]+$/u;
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
function edit(value,id,rendered,desired,source) {
  if (typeof rendered!=='string') throw new Error('Reload the preview to read this element’s rendered classes.');
  const patch=unpack(value,id),before=tokens(effective(value,id,rendered)),after=tokens(twMerge(desired));
  const removed=new Set([...patch.removed,...before.filter(t=>!after.includes(t))]);
  const added=[...new Set([...patch.added.filter(t=>after.includes(t)),...after.filter(t=>!before.includes(t))])];
  // Remove conflicting known utilities in inactive branches as well. Variant
  // prefixes remain distinct under the same Tailwind merge rules as React.
  const literals=[...source.matchAll(/(['"])([^'"\r\n]*)\1/g)].flatMap(m=>tokens(m[2]));
  literals.push(...tokens(patch.original.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g,' ')));
  for (const token of literals) if (TOKEN.test(token)&&!tokens(twMerge(token+' '+added.join(' '))).includes(token)) removed.add(token);
  const meta=Buffer.from(JSON.stringify({removed:[...removed],added})).toString('base64');
  const input=`__rt_classes_${id}`,list=`__rt_class_list_${id}`,item=`__rt_class_${id}`;
  const condition=[...removed].map(t=>`${item} == '${t}'`).join(' or ');
  const output=`{{ ${item} }} `;
  return `{% capture ${input} %}${patch.original}{% endcapture %}`+
    `{% assign ${list} = ${input} | newline_to_br | replace: '<br />', ' ' | replace: '\t', ' ' | strip_newlines | split: ' ' %}`+
    `{% for ${item} in ${list} %}`+(condition?`{% unless ${condition} %}${output}{% endunless %}`:output)+
    `{% endfor %}${added.join(' ')}{% comment %}retouch-classes-v1:${meta}{% endcomment %}`;
}
module.exports={effective,edit,unpack};
