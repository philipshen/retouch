'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{classesForBounds}=require('../shell/react-selection-geometry.js');
const css={boxSizing:'content-box',getPropertyValue:p=>p.startsWith('padding-')?'5px':'2px'},g={x:30,y:40,width:114,height:64,parentWidth:600,parentHeight:500};
test('React selection bounds preserve content-box dimensions and end anchors',()=>{
 const result=classesForBounds('absolute left-0 bottom-0 w-[100px] h-[50px] box-content p-[5px] border-[2px] bg-red-500','',g,css);
 for(const token of ['box-content','w-[100px]','h-[50px]','left-[30px]','bottom-[396px]','p-[5px]','border-[2px]','bg-red-500'])assert.ok(result.split(' ').includes(token),result);assert.ok(!result.includes('box-border'));
});
test('React group bounds retain percentage/stretch models and inherited important classes',()=>{
 const scale=classesForBounds('absolute left-[5%] top-[10%] w-[20%] h-[10%] box-content','',g,css);assert.ok(scale.includes('w-[16.6667%]'),scale);assert.ok(scale.includes('h-[10%]'),scale);
 const stretch=classesForBounds('absolute left-0 right-0 top-0 bottom-0 w-auto h-auto box-content','',g,css);assert.ok(stretch.includes('w-auto')&&stretch.includes('h-auto')&&stretch.includes('right-[456px]')&&stretch.includes('bottom-[396px]'),stretch);
 const scoped=classesForBounds('absolute right-0! top-0 w-[80px] h-[40px] hover:opacity-50','md:',g,{boxSizing:'border-box'},null);assert.ok(scoped.includes('md:!right-[456px]')&&scoped.includes('md:w-[114px]')&&!scoped.includes('md:!w-')&&scoped.includes('hover:opacity-50'),scoped);
});

test('absolute conversion replaces inherited end anchors while preserving responsive priority and content size',()=>{
 const result=classesForBounds('relative right-0! bottom-0! box-content w-[100px] h-[50px] p-[5px] border-[2px] hover:opacity-50','md:',g,css,null,{x:'start',y:'start'});
 for(const token of ['md:absolute','md:!left-[30px]','md:!right-auto','md:!top-[40px]','md:!bottom-auto','md:box-content','md:w-[100px]','md:h-[50px]','hover:opacity-50'])assert.ok(result.split(' ').includes(token),result);
 assert.ok(result.includes('right-0!')&&result.includes('bottom-0!'),result);
});
