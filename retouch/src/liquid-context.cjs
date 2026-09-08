'use strict';
// Only the adapter interprets renderer metadata. The shell transports it as
// an opaque snapshot and uses the adapter's generic renderScope to co-highlight.
function context(value) {
  if (!value?.attributes) return value || {};
  const attr=value.attributes;
  const blocks=[];
  for (const a of [attr,...(value.ancestors || [])].reverse()) {
    const id=a['data-rt-block']; if (id&&!blocks.includes(id)) blocks.push(id);
  }
  return {section:attr['data-rt-section'],block:attr['data-rt-block'],blocks,
    template:attr['data-rt-template'],locale:attr['data-rt-locale'],origin:attr['data-rt-origin'],tag:value.tag,
    className:value.className,src:value.src};
}
function scope(source,value) {
  const c=context(value);
  if (source?.kind==='locale') return {'data-rt-locale':c.locale};
  if (source?.kind==='setting'&&source.scope!=='theme') return {
    'data-rt-section':c.section,'data-rt-template':c.template,
    ...(source.scope==='block'?{'data-rt-block':c.block}:{})};
  return {};
}
module.exports={context,scope};
