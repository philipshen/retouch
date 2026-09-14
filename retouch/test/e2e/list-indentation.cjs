'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,target,read,wait,settled,states,kind})=>{
 const button=name=>page.getByRole('button',{name,exact:true}),field=page.getByLabel('Text layer list style',{exact:true});
 const choose=async(first,last=first)=>{await target.focus();await target.evaluate((el,[first,last])=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4),nodes=[];for(let n;n=w.nextNode();)if(/^[A-G]$/.test(n.data))nodes.push(n);const a=nodes.find(n=>n.data===first),b=nodes.find(n=>n.data===last),r=d.createRange();r.setStart(a,0);r.setEnd(b,first===last?0:1);d.getSelection().removeAllRanges();d.getSelection().addRange(r);},[first,last]);};
 const positions=()=>target.evaluate(el=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4),out={};for(let n;n=w.nextNode();)if(/^[A-G]$/.test(n.data)){const r=d.createRange();r.selectNodeContents(n);const rect=r.getBoundingClientRect();let depth=0;for(let p=n.parentElement;p&&p!==el;p=p.parentElement)if(/^(UL|OL)$/.test(p.tagName))depth++;out[n.data]={x:rect.x,y:rect.y,depth};}return out;});
 const markers=()=>target.evaluate(el=>[...el.querySelectorAll('ul,ol')].map(n=>({tag:n.tagName,marker:getComputedStyle(n).listStyleType})));
 const checkMarkers=async(kind)=>{const values=await markers();for(const value of values)assert.equal(value.marker,kind==='ul'?'disc':['decimal','lower-alpha','lower-roman'][values.indexOf(value)%3]);};
 const order=()=>target.evaluate(el=>{const w=el.ownerDocument.createTreeWalker(el,4),out=[];for(let n;n=w.nextNode();)if(/^[A-G]$/.test(n.data))out.push(n.data);return out.join('');});
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});
 for(const [i,char]of [...'ABCDEFG'].entries()){if(i)await page.keyboard.press('Shift+Enter');await page.keyboard.insertText(char);}
 await field.selectOption('ul');await save();await open();
 // A range ending at C's start selects B only. Verify through keyboard,
 // persistence and source undo before running the broader nesting workflow.
 await target.focus();await target.evaluate(el=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4),nodes={};for(let n;n=w.nextNode();)if(/^[BC]$/.test(n.data))nodes[n.data]=n;const r=d.createRange();r.setStart(nodes.B,0);r.setEnd(nodes.C,0);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});
 await page.keyboard.press('Tab');assert.equal((await positions()).B.depth,2);assert.equal((await positions()).C.depth,1);
 await save();await open();assert.equal((await positions()).B.depth,2);assert.equal((await positions()).C.depth,1);
 await button('Finish text editing').click();await settled();await button('Undo').click();await settled();await wait(()=>read()===states.at(-2));states.pop();await open();
 const baseline=await positions(),flat=await target.innerHTML();
 await choose('A');await page.keyboard.press('Tab');assert.equal(await target.innerHTML(),flat);await page.keyboard.press('Shift+Tab');assert.equal(await target.innerHTML(),flat);
 for(const [first,action]of [['B','Tab'],['C','button'],['D','Control+]'],['E','Tab']]){
  await choose(first,'G');if(action==='button')await button('Increase list indentation').click();else await page.keyboard.press(action);
  assert.equal(await order(),'ABCDEFG');assert.equal(read(),states.at(-1));
 }
 const deep=await target.innerHTML(),nested=await positions();assert.equal(nested.G.depth,5);assert.ok(nested.G.x>baseline.G.x);
 for(const char of 'ABCDEFG')assert.ok(Math.abs(nested[char].y-baseline[char].y)<1,'Indenting must not add blank lines at '+char);
 await choose('F','G');await page.keyboard.press('Tab');assert.equal(await target.innerHTML(),deep);assert.equal(await button('Increase list indentation').isDisabled(),true);
 await button('Undo').click();assert.equal((await positions()).G.depth,4);await button('Redo').click();assert.equal(await target.innerHTML(),deep);
 await save();await open();await checkMarkers('ul');await choose('A');
 await field.selectOption('ol');await checkMarkers('ol');await save();await open();await checkMarkers('ol');await choose('F');
 const beforeOutdent=await target.innerHTML();await page.keyboard.press('Shift+Tab');const outdented=await target.innerHTML(),after=await positions();
 assert.equal(await order(),'ABCDEFG');assert.equal(after.F.depth,4);assert.equal(after.G.depth,5);assert.ok(after.F.x<nested.F.x);assert.equal(after.G.x,nested.G.x);
 for(const char of 'ABCDEFG')assert.ok(Math.abs(after[char].y-baseline[char].y)<1,'Outdenting must not add blank lines at '+char);
 await button('Undo').click();assert.equal(await target.innerHTML(),beforeOutdent);await button('Redo').click();assert.equal(await target.innerHTML(),outdented);
 assert.deepEqual((await markers()).map(v=>v.marker),['decimal','lower-alpha','lower-roman','decimal','lower-alpha','lower-alpha']);
 await save();await open();assert.deepEqual((await markers()).map(v=>v.marker),['decimal','lower-alpha','lower-roman','decimal','lower-alpha','lower-alpha']);await choose('G');assert.equal(await button('Decrease list indentation').isEnabled(),true);await button('Decrease list indentation').click();assert.equal((await positions()).G.depth,4);await button('Undo').click();
 await field.selectOption('ul');assert.ok((await markers()).every(v=>v.marker==='disc'));await button('Undo').click();
 if(process.env.RT_E2E_LIST_INDENT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIST_INDENT_SCREENSHOT});
 await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('LIST INDENTATION PASS '+kind+': Tab, Shift+Tab, bracket shortcut, buttons, five-level limit, middle-item split, geometry/order, grouped local and exact source history');
};
