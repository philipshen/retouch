'use strict';
// Compare the shaft itself so endpoint changes cannot silently alter its dashes.
const assert=require('node:assert/strict'),path=require('node:path'),model=require('../../shell/svg-parametric.js');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const browser=await require(process.env.RT_E2E_PLAYWRIGHT_ROOT||path.join(fixture,'node_modules/playwright'))[engine].launch();
 try{
  const page=await browser.newPage(),cases=[];
  for(const length of [100,113,150])for(const dash of ['8 6','3 5 9 4','5.5 2.5'])for(const offset of [0,3,7])for(const startArrow of [false,true])for(const endArrow of [false,true]){
   const spec={kind:'arrow',x1:20,y1:30,x2:20+length,y2:30,headLength:12,headWidth:16,startArrow,endArrow,startHeadLength:8,startHeadWidth:10};
   cases.push({length,dash,offset,startArrow,endArrow,points:model.generate(spec),path:model.arrowPath(model.generate(spec))});
  }
  const results=await page.evaluate(async cases=>{
   const render=async(body,attributes)=>{const svg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><g fill="none" stroke="black" stroke-width="4" '+attributes+'>'+body+'</g></svg>',image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();const canvas=document.createElement('canvas');canvas.width=200;canvas.height=60;const context=canvas.getContext('2d');context.drawImage(image,0,0);return context.getImageData(0,30,200,1).data;};
   const results=[];
   for(const row of cases){
    const attributes='stroke-dasharray="'+row.dash+'" stroke-dashoffset="'+row.offset+'"',line='<line x1="20" y1="30" x2="'+(20+row.length)+'" y2="30"/>',expected=await render(line,attributes),actual=await render('<polyline points="'+row.points+'"/>',attributes);
    // A separate undashed head is the reference architecture for future endpoint rendering.
    const points=row.points.split(' '),heads=[];if(row.endArrow)heads.push([points[2],points[1],points[4]]);if(row.startArrow){const tail=points.slice(-4);heads.push([tail[1],tail[0],tail[3]]);}
    const productPath=await render('<path d="'+row.path+'"/>',attributes);
    const separated=await render(line+heads.map(points=>'<polyline stroke-dasharray="none" points="'+points.join(' ')+'"/>').join(''),attributes);
    let changedPixels=0,separatedChangedPixels=0,pathChangedPixels=0;
    for(let x=40;x<row.length;x++){if(Math.abs(expected[x*4+3]-productPath[x*4+3])>1)pathChangedPixels++;if(Math.abs(expected[x*4+3]-actual[x*4+3])>1)changedPixels++;if(Math.abs(expected[x*4+3]-separated[x*4+3])>1)separatedChangedPixels++;}
    results.push({...row,points:undefined,path:undefined,changedPixels,separatedChangedPixels,pathChangedPixels});
   }
   return results;
  },cases);
  const pathFailures=results.filter(row=>row.pathChangedPixels),failures=results.filter(row=>row.changedPixels),separatedFailures=results.filter(row=>row.separatedChangedPixels);
  console.log(JSON.stringify({engine,version:browser.version(),total:results.length,pathPassed:results.length-pathFailures.length,currentPassed:results.length-failures.length,separatedPassed:results.length-separatedFailures.length,failures},null,2));
  assert.equal(separatedFailures.length,0,'Independent head geometry must preserve shaft dashes');
  assert.equal(pathFailures.length,0,'Converted arrow paths must preserve shaft dashes');
  if(!process.env.RT_E2E_ARROW_PATH)assert.equal(failures.length,0,'Changing arrowheads must preserve shaft dashes');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
