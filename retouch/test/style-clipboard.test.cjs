'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');require('../shell/component-clipboard.js');require('../shell/style-clipboard.js');const styles=globalThis.RetouchStyleClipboard;
test('style snapshots use supported resolved values and separate them from layout defaults',()=>{
 const values={color:'rgb(180, 20, 30)',opacity:'0.6',width:'300px',padding:'18px','border-radius':'12px'},element={ownerDocument:{defaultView:{getComputedStyle:()=>({getPropertyValue:name=>values[name]||''})}}};const snapshot=styles.snapshot(element);assert.equal(snapshot.format,'retouch/layer-styles@1');assert.equal(snapshot.properties.length,5);assert.ok(styles.groups.Layout.includes('width'));assert.ok(styles.groups.Appearance.includes('opacity'));
});
test('style clipboard rejects unknown properties, malformed CSS, duplicates and component payloads',()=>{
 for(const properties of [[{name:'position',value:'absolute'}],[{name:'color',value:'red;display:none'}],[{name:'opacity',value:'.5'},{name:'opacity',value:'.7'}],[{name:'width',value:5}]])assert.throws(()=>styles.validate({format:'retouch/layer-styles@1',properties}));assert.throws(()=>styles.validate({format:'retouch/component-properties@1',properties:[{name:'color',value:'red'}]}));
});
