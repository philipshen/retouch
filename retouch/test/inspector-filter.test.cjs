'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../shell/inspector.js'),V=require('../shell/html-css-values.js');
test('local blur replaces only the current filter family and retains stack order and other effects',()=>{
 const value=V.withBlur('brightness(0.8) blur(2px) drop-shadow(1px 2px 3px rgb(0, 0, 0))',4),classes=I.filterClasses('!blur-sm brightness-75 drop-shadow-md backdrop-blur-lg shadow-lg opacity-50 md:blur-lg hover:blur-xl','filter',value);
 assert.equal(classes,'backdrop-blur-lg shadow-lg opacity-50 md:blur-lg hover:blur-xl ![filter:brightness(0.8)_blur(4px)_drop-shadow(1px_2px_3px_rgb(0,_0,_0))]');
 assert.equal(I.filterClasses(classes,'filter',V.withBlur(value,0)).includes('blur(4px)'),false);
});
test('backdrop blur stays independent and can explicitly disable inherited blur',()=>{
 assert.equal(I.filterClasses('blur-lg backdrop-blur-sm backdrop-saturate-150 md:backdrop-blur-lg','backdrop-filter','saturate(1.5) blur(3px)'),'blur-lg md:backdrop-blur-lg ![backdrop-filter:saturate(1.5)_blur(3px)]');
 assert.equal(I.filterClasses('','filter','none'),'![filter:none]');
 assert.throws(()=>I.filterClasses('![all:initial]','filter','blur(2px)'),/all-property/);assert.throws(()=>I.filterClasses('','filter','url(#mask)'),/Unsupported/);assert.throws(()=>I.filterClasses('','color','none'),/Unsupported/);
});
