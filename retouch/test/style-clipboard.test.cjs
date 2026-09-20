'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');require('../shell/component-clipboard.js');require('../shell/style-clipboard.js');const styles=globalThis.RetouchStyleClipboard;
test('style snapshots use supported resolved values and separate them from layout defaults',()=>{
 const values={color:'rgb(180, 20, 30)',opacity:'0.6',width:'300px',padding:'18px','border-radius':'12px'},element={ownerDocument:{defaultView:{getComputedStyle:()=>({getPropertyValue:name=>values[name]||''})}}};const snapshot=styles.snapshot(element);assert.equal(snapshot.format,'retouch/layer-styles@1');assert.equal(snapshot.properties.length,5);assert.ok(styles.groups.Layout.includes('width'));assert.ok(styles.groups.Appearance.includes('opacity'));
});
test('style clipboard rejects unknown properties, malformed CSS, duplicates and component payloads',()=>{
 for(const properties of [[{name:'position',value:'absolute'}],[{name:'color',value:'red;display:none'}],[{name:'opacity',value:'.5'},{name:'opacity',value:'.7'}],[{name:'width',value:5}]])assert.throws(()=>styles.validate({format:'retouch/layer-styles@1',properties}));assert.throws(()=>styles.validate({format:'retouch/component-properties@1',properties:[{name:'color',value:'red'}]}));
});
test('style paste disables shorthands when any inline subproperty is important',()=>{
 const priorities={'border-top-color':'important','padding-inline-start':'important','border-top-left-radius':'important','row-gap':'important','inline-size':'important'},target=styles.target({tag:'p'},{style:{getPropertyPriority:key=>priorities[key]||''}}),editable=name=>target.props.find(p=>p.name===name).editor.editable;
 for(const key of ['border-color','padding','border-radius','gap','width','height'])assert.equal(editable(key),false,key);for(const key of ['color','border-width','font-size'])assert.equal(editable(key),true,key);
 const reset=styles.target({tag:'p'},{style:{getPropertyPriority:key=>key==='all'?'important':''}});assert.ok(reset.props.every(p=>!p.editor.editable));
});
