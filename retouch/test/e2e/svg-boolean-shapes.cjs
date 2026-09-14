'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{const browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setContent('<svg width="500" height="300" xmlns="http://www.w3.org/2000/svg"><path id="result"/></svg>');
 for(const file of [require.resolve('paper/dist/paper-core.min.js'),...['svg-affine.js','svg-path.js','svg-boolean.js'].map(file=>path.resolve(__dirname,'../../shell',file))])await page.addScriptTag({path:file});
 const result=await page.evaluate(()=>{
  const matrix=[1.4,.2,.3,.8,40,10],rect=(x,y,w,h)=>`M${x} ${y}h${w}v${h}h${-w}Z`,operations={union:(a,b)=>a||b,subtract:(a,b)=>a&&!b,intersect:(a,b)=>a&&b,exclude:(a,b)=>a!==b},scopes=Object.keys(paper.PaperScope._scopes).length,failures=[];let checks=0;
  for(const fillRule of ['nonzero','evenodd'])for(const [operation,expected]of Object.entries(operations)){
   const operands=[{document:RetouchSVGPath.parseCompound(rect(0,0,100,100)+' '+rect(25,25,50,50)),fillRule,matrix},{document:RetouchSVGPath.parseCompound(rect(40,-10,40,120)),matrix}],before=JSON.stringify(operands),result=RetouchSVGBoolean.combineShapes(operands,operation);if(!result.ok)throw Error(result.reason);if(JSON.stringify(operands)!==before)throw Error('Input mutation');const output=document.querySelector('#result');output.setAttribute('d',result.empty?'':RetouchSVGPath.serializeCompound(result.document));output.setAttribute('fill-rule',result.fillRule);
   for(let x=-7;x<110;x+=11)for(let y=-7;y<110;y+=11){if([0,25,40,75,80,100].includes(x)||[0,25,75,100].includes(y))continue;const a=x>0&&x<100&&y>0&&y<100&&!(fillRule==='evenodd'&&x>25&&x<75&&y>25&&y<75),b=x>40&&x<80&&y>-10&&y<110,p=new DOMPoint(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]);checks++;if(output.isPointInFill(p)!==expected(a,b))failures.push({fillRule,operation,x,y});}
  }
  for(const [operation,expected]of Object.entries(operations)){
   const m=[1.6,.3,.4,.7,20,-15],det=m[0]*m[3]-m[1]*m[2],result=RetouchSVGBoolean.combineShapes([{document:RetouchSVGPath.parseCompound('M0 50A50 50 0 0 1 100 50A50 50 0 0 1 0 50Z'),matrix:m},{document:RetouchSVGPath.parseCompound(rect(75,10,70,65))}],operation);if(!result.ok)throw Error(result.reason);const output=document.querySelector('#result');output.setAttribute('d',RetouchSVGPath.serializeCompound(result.document));output.setAttribute('fill-rule',result.fillRule);
   for(let x=3;x<230;x+=8)for(let y=-8;y<120;y+=8){const dx=x-m[4],dy=y-m[5],lx=(m[3]*dx-m[2]*dy)/det,ly=(-m[1]*dx+m[0]*dy)/det,distance=Math.hypot(lx-50,ly-50);if(Math.abs(distance-50)<.05||[75,145].includes(x)||[10,75].includes(y))continue;checks++;if(output.isPointInFill(new DOMPoint(x,y))!==expected(distance<50,x>75&&x<145&&y>10&&y<75))failures.push({arc:true,operation,x,y});}
  }
  if(Object.keys(paper.PaperScope._scopes).length!==scopes)throw Error('Temporary scope retained');return {checks,failures};
 });assert.ok(result.checks>500);assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);console.log(engine+': PASS '+result.checks+' native SVG fill checks for transformed whole-shape booleans, holes, fill rules, input immutability and scope cleanup');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
