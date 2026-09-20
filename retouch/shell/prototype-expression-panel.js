(function(root){
 'use strict';
 const E=root.RetouchPrototypeExpressions,I=root.RetouchInspector,defaults={number:0,string:'',boolean:false,color:'#000000ff'};
 const literal=type=>({kind:'literal',type,value:defaults[type]});
 function options(type){
  const result=[];const add=(op,label,args)=>result.push({key:op+':'+args.join(','),op,label,args});
  if(type==='number'){for(const [op,label]of [['+','Add'],['-','Subtract'],['*','Multiply'],['/','Divide'],['%','Remainder']])add(op,label,['number','number']);add('negate','Negate',['number']);}
  if(type==='string'){add('concat','Join text',['string','string']);for(const input of ['number','boolean','color','string'])add('to-string',input[0].toUpperCase()+input.slice(1)+' to text',[input]);}
  if(type==='boolean'){
   for(const input of ['number','string','boolean','color'])for(const [op,label]of [['==','equals'],['!=','does not equal']])add(op,input[0].toUpperCase()+input.slice(1)+' '+label,[input,input]);
   for(const [op,label]of [['<','Less than'],['<=','At most'],['>','Greater than'],['>=','At least']])add(op,label,['number','number']);add('and','And',['boolean','boolean']);add('or','Or',['boolean','boolean']);add('not','Not',['boolean']);
  }
  add('if','If / else',['boolean',type,type]);return result;
 }
 function mount(parent,{expression,type,library,index,change}){
  let draft=structuredClone(expression);const box=document.createElement('div');box.className='prototype-expression';parent.append(box);const message=I.note(box,'');message.setAttribute('role','status');
  function set(path,value){const next=structuredClone(draft);let updated=next;if(!path.length)updated=value;else{let node=next;for(const n of path.slice(0,-1))node=node.args[n];node.args[path.at(-1)]=value;}
   try{const checked=E.analyze(updated);if(checked.type!==type)throw Error('The expression must return '+type+'.');draft=checked.expression;message.textContent='';return change(draft);}catch(error){message.textContent=error.message;}
  }
  function node(value,expected,path,label){
   const group=document.createElement('fieldset');group.className='prototype-expression-node';const legend=document.createElement('legend');legend.textContent=label;group.append(legend);const address=index+' '+(path.length?path.map(n=>n+1).join('.'):'root'),choices=options(expected);
   const selected=value.kind==='operation'?choices.find(choice=>(choice.op===value.op||expected==='string'&&value.op==='+'&&choice.op==='concat')&&choice.args.every((type,n)=>E.analyze(value.args[n]).type===type))?.key||'':value.kind;
   I.select(group,'Expression input '+address,[['literal','Value'],['variable','Variable'],...choices.map(choice=>[choice.key,choice.label])],selected,key=>{
    if(key==='literal')return set(path,literal(expected));
    if(key==='variable'){const first=library?.variables.find(v=>v.type===expected);if(!first){message.textContent='Create a '+expected+' variable first.';return;}return set(path,{kind:'variable',id:first.id,type:expected});}
    const choice=choices.find(choice=>choice.key===key);const args=choice.args.map((type,n)=>n===0&&E.analyze(value).type===type?value:literal(type));if(['/', '%'].includes(choice.op))args[1]={kind:'literal',type:'number',value:1};return set(path,{kind:'operation',op:choice.op,args});
   });
   if(value.kind==='variable'){
    const available=(library?.variables||[]).filter(v=>v.type===expected),names=available.map(v=>[v.id,(library.collections.find(c=>c.id===v.collectionId)?.name||'')+' / '+v.name]);if(!available.some(v=>v.id===value.id))names.unshift([value.id,'Missing or incompatible variable']);I.select(group,'Expression variable '+address,names,value.id,id=>set(path,{kind:'variable',id,type:expected}));
    const variable=available.find(v=>v.id===value.id),collection=library?.collections.find(c=>c.id===variable?.collectionId);I.select(group,'Expression mode '+address,[['','Current mode'],...(value.modeId&&!collection?.modes.some(m=>m.id===value.modeId)?[[value.modeId,'Missing mode']]:[]),...(collection?.modes||[]).map(m=>[m.id,m.name])],value.modeId||'',modeId=>set(path,{kind:'variable',id:value.id,type:expected,...(modeId?{modeId}:{})}));
   }else if(value.kind==='literal'){
    if(expected==='boolean')I.select(group,'Expression value '+address,[['false','False'],['true','True']],String(value.value),v=>set(path,{kind:'literal',type:expected,value:v==='true'}));
    else {const input=document.createElement('input');input.type=expected==='number'?'number':'text';input.value=value.value;if(expected==='number'){input.step='any';input.min='-1000000';input.max='1000000';}else input.maxLength=4096;I.field(group,'Expression value '+address,input);input.onchange=()=>set(path,{kind:'literal',type:expected,value:expected==='number'?(input.value===''?NaN:Number(input.value)):input.value});}
   }else for(const [n,arg]of value.args.entries())group.append(node(arg,E.analyze(arg).type,[...path,n],value.op==='if'?['Condition','Then','Otherwise'][n]:value.args.length===1?'Input':n===0?'Left':'Right'));
   for(const label of group.querySelectorAll('.inspector-field > span')){const match=/^Expression (input|variable|value|mode) /.exec(label.textContent);if(match)label.textContent={input:'Use',variable:'Variable',value:'Value',mode:'Mode'}[match[1]];}
   return group;
  }
  box.prepend(node(draft,type,[],'Expression'));I.note(box,'Uses the current presentation values when triggered.');
  if(library){message.textContent='Previewing default values…';root.RetouchVariableModePreview({revision:library.revision,expression:draft}).then(response=>{if(box.isConnected)message.textContent='Default value: '+String(response.result.value);}).catch(error=>{if(box.isConnected)message.textContent=error.message;});}
 }
 root.RetouchPrototypeExpressionPanel={mount};
})(window);
