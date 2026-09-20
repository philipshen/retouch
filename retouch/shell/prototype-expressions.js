(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./palette-values.js'));else root.RetouchPrototypeExpressions=factory(root.RetouchPaletteValues);})(typeof globalThis!=='undefined'?globalThis:this,function(palette){
 'use strict';
 const types=['number','boolean','string','color'],uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
 const arity={'+':2,'-':2,'*':2,'/':2,'%':2,negate:1,'==':2,'!=':2,'<':2,'<=':2,'>':2,'>=':2,and:2,or:2,not:1,concat:2,'to-string':1,if:3};
 function fail(message){throw Error(message);}
 function shape(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))fail('Invalid prototype expression.');}
 function literal(type,value){
  if(type==='number'){if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1000000)fail('Expression numbers must be finite and between -1000000 and 1000000.');return value;}
  if(type==='boolean'){if(typeof value!=='boolean')fail('Expected a Boolean expression value.');return value;}
  if(type==='string'){if(typeof value!=='string'||value.length>4096||value.includes('\0'))fail('Expression text must contain at most 4096 characters and no null characters.');return value;}
  if(type==='color')return palette.parse(value).value;
  fail('Unsupported expression value type.');
 }
 function analyze(input){
  let count=0;const references=new Map(),referenceTypes=new Map();
  function visit(node,depth){
   if(++count>128||depth>16)fail('Use at most 128 expression nodes and 16 levels.');
   shape(node,['kind','type','value','id','modeId','op','args']);
   if(node.kind==='literal'){shape(node,['kind','type','value']);const value=literal(node.type,node.value);return {type:node.type,expression:{kind:'literal',type:node.type,value}};}
   if(node.kind==='variable'){
    shape(node,['kind','type','id','modeId']);if(!types.includes(node.type)||typeof node.id!=='string'||!uuid.test(node.id))fail('Choose a typed expression variable.');
    if(Object.hasOwn(node,'modeId')&&(typeof node.modeId!=='string'||!uuid.test(node.modeId)))fail('Choose a valid expression variable mode.');
    if(referenceTypes.has(node.id)&&referenceTypes.get(node.id)!==node.type)fail('An expression variable cannot have conflicting types.');referenceTypes.set(node.id,node.type);
    const reference={id:node.id,type:node.type,...(node.modeId?{modeId:node.modeId}:{})};references.set(node.id+'/'+(node.modeId||''),reference);
    return {type:node.type,expression:{kind:'variable',...reference}};
   }
   shape(node,['kind','op','args']);if(node.kind!=='operation'||typeof node.op!=='string'||!Object.hasOwn(arity,node.op)||!Array.isArray(node.args)||node.args.length!==arity[node.op])fail('Choose an expression operator with the correct number of inputs.');
   const args=node.args.map(child=>visit(child,depth+1)),argTypes=args.map(child=>child.type),every=type=>argTypes.every(t=>t===type);let type;
   if(['-','*','/','%','negate'].includes(node.op)||node.op==='+'&&every('number')){if(!every('number'))fail('Arithmetic requires number inputs.');type='number';}
   else if(node.op==='concat'||node.op==='+'){if(!every('string'))fail('Text joining requires string inputs of the same type.');type='string';}
   else if(['<','<=','>','>='].includes(node.op)){if(!every('number'))fail('Ordered comparisons require number inputs.');type='boolean';}
   else if(['==','!='].includes(node.op)){if(argTypes[0]!==argTypes[1])fail('Equality compares values of the same type.');type='boolean';}
   else if(['and','or','not'].includes(node.op)){if(!every('boolean'))fail('Logical operators require Boolean inputs.');type='boolean';}
   else if(node.op==='if'){if(argTypes[0]!=='boolean'||argTypes[1]!==argTypes[2])fail('A conditional needs a Boolean test and two results of the same type.');type=argTypes[1];}
   else if(node.op==='to-string')type='string';
   return {type,expression:{kind:'operation',op:node.op,args:args.map(child=>child.expression)}};
  }
  const result=visit(input,1);return {...result,references:[...references.values()]};
 }
 function evaluate(input,resolve){
  const checked=analyze(input),values=new Map();
  function visit(node){
   if(node.kind==='literal')return node.value;
   if(node.kind==='variable'){
    const key=node.id+'/'+(node.modeId||'');if(!values.has(key)){
     if(typeof resolve!=='function')fail('An expression variable resolver is required.');const result=resolve(node.id,node.modeId);
     if(!result||result.type!==node.type)fail('An expression variable is missing or its type changed.');values.set(key,literal(node.type,result.value));
    }
    return values.get(key);
   }
   const a=visit(node.args[0]);
   if(node.op==='if')return visit(node.args[a?1:2]);
   if(node.op==='and')return a&&visit(node.args[1]);
   if(node.op==='or')return a||visit(node.args[1]);
   if(node.op==='not')return !a;
   if(node.op==='negate')return literal('number',-a);
   if(node.op==='to-string')return literal('string',String(a));
   const b=visit(node.args[1]);let value;
   switch(node.op){
    case '+':value=a+b;break;case '-':value=a-b;break;case '*':value=a*b;break;
    case '/':case '%':if(b===0)fail('Cannot divide by zero in a prototype expression.');value=node.op==='/'?a/b:a%b;break;
    case 'concat':return literal('string',a+b);
    case '==':return a===b;case '!=':return a!==b;
    case '<':return a<b;case '<=':return a<=b;case '>':return a>b;case '>=':return a>=b;
   }
   return literal(typeof value==='number'?'number':'string',value);
  }
  return {type:checked.type,value:literal(checked.type,visit(checked.expression))};
 }
 return {analyze,validate:input=>analyze(input).expression,evaluate,operators:Object.freeze({...arity})};
});
