'use strict';
// Only statically known keys are compared. Dynamic expressions and spreads are
// not evaluated here, and this check does not establish their runtime uniqueness.
function literalKey(node){
 if(node?.type!=='JSXElement')return undefined;
 const attributes=node.openingElement.attributes;if(attributes.some(attr=>attr.type==='JSXSpreadAttribute'))return undefined;
 const keys=attributes.filter(attr=>attr.name?.name==='key');if(keys.length!==1)return undefined;
 let value=keys[0].value;if(!value)return 'true';if(value.type==='JSXExpressionContainer')value=value.expression;
 if(['StringLiteral','NumericLiteral','BooleanLiteral'].includes(value.type))return String(value.value);
 if(value.type==='NullLiteral')return 'null';
 if(value.type==='UnaryExpression'&&['+','-'].includes(value.operator)&&value.argument.type==='NumericLiteral')return String(value.operator==='-'?-value.argument.value:value.argument.value);
 if(value.type==='TemplateLiteral'&&value.expressions.length===0)return value.quasis[0].value.cooked??undefined;
 return undefined;
}
module.exports=function assertMoveKeys(target,sources){
 const incoming=sources.filter(source=>source.parentPath?.node.start!==target.node.start||source.parentPath?.node.end!==target.node.end);if(!incoming.length)return;
 const known=new Set((target.node.children||[]).map(literalKey).filter(key=>key!==undefined));
 for(const source of incoming){const key=literalKey(source.node);if(key===undefined)continue;if(known.has(key))throw Error('Moving would duplicate the React key '+JSON.stringify(key)+'. Give the incoming component a unique key before moving it.');known.add(key);}
};
