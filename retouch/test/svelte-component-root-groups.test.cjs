'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),markers=require('../src/svelte-component-markers.cjs');
function read(text){const meta=markers.metadata(text,'App.svelte');return {...meta,tags:meta.rootGroups.map(ids=>ids.map(id=>meta.roots.find(root=>root.id===id).tag))};}
test('Svelte component groups enumerate anchored branch combinations in document order',()=>{
 const result=read('<header>Anchor</header>{#if show}<main>A</main>{:else if other}<aside>B</aside>{:else}<footer>C</footer>{/if}{#if end}<nav>D</nav>{/if}');
 assert.deepEqual(result.tags,[['header','main','nav'],['header','main'],['header','aside','nav'],['header','aside'],['header','footer','nav'],['header','footer']]);
 const keyed=read('<header/>{#key key}<main/>{/key}');assert.deepEqual(keyed.tags,[['header','main']]);
 const awaited=read('<header/>{#await promise}<main/>{:then value}<article/>{:catch error}<footer/>{/await}');assert.deepEqual(awaited.tags,[['header','main'],['header','article'],['header','footer']]);
});
test('Svelte component groups do not pretend unaccounted DOM or repeating roots are complete',()=>{
 for(const text of ['<header/>text','<header/>{text}','<header/>{@html text}','<header/><Child/>','<header/><svelte:element this={tag}/>','<header/><main {...props}/>','<header/>{#each items as item}<main/>{/each}','{#if show}<main/>{:else}<footer/>{/if}','{#if show}<main/>{/if}'])assert.deepEqual(read(text).rootGroups,[],text);
 assert.deepEqual(read('<header/><!-- note -->{#snippet child()}<aside/>{/snippet}<footer/>').tags,[['header','footer']]);
 assert.deepEqual(read('<header/>'+Array.from({length:7},(_,i)=>'{#if test'+i+'}<main/>{/if}').join('')).rootGroups,[]);
});
test('Svelte anchored sequences partition repeated invocations without crossing their roots',()=>{
 const {rootGroups,roots}=read('<header/>{#if show}<main/>{/if}<footer/>'),group=require('../shell/component-instances.js').group;
 const make=ids=>ids.map(id=>({getAttribute:name=>name==='data-rt'?id:null})),ids=[...rootGroups[0],...rootGroups[1],...rootGroups[0]],nodes=make(ids);nodes.forEach((node,i)=>node.nextElementSibling=nodes[i+1]||null);
 const groups=group(nodes,rootGroups);assert.deepEqual(groups.map(item=>item.elements.length),[3,2,3]);assert.ok(groups.every(item=>item.complete));
});
