'use strict';
const crypto=require('node:crypto'),strength=['sha256','sha384','sha512'];
// Validate the strongest supported metadata before updating matching digests.
// Preserve alternate digests, unknown tokens, options, algorithms and whitespace.
function rewrite(value,before,after){
 if(typeof value!=='string'||value.length>16384)throw Error('The stylesheet integrity metadata is too large.');
 if(!value.trim())return value;
 const digest=(algorithm,text)=>crypto.createHash(algorithm).update(text).digest('base64'),cache=new Map();
 const original=algorithm=>{if(!cache.has(algorithm))cache.set(algorithm,digest(algorithm,before));return cache.get(algorithm);};
 const canonical=value=>value.replace(/-/g,'+').replace(/_/g,'/').replace(/=+$/,'');
 const tokens=[...value.matchAll(/[^\t\n\f\r ]+/g)].map(match=>{const token=match[0],parts=/^(sha256|sha384|sha512)(?:-([^?]*))?(\?.*)?$/.exec(token);return {token,parts};}),known=tokens.filter(item=>item.parts);
 const strongest=Math.max(...known.map(item=>strength.indexOf(item.parts[1])));
 const matches=item=>/^[A-Za-z0-9+/_-]+={0,2}$/.test(item.parts[2]||'')&&canonical(item.parts[2])===canonical(original(item.parts[1]));
 if(!known.length||!known.some(item=>strength.indexOf(item.parts[1])===strongest&&matches(item)))throw Error('The local stylesheet does not match its strongest integrity hash.');
 if(before===after)return value;
 let index=0;return value.replace(/[^\t\n\f\r ]+/g,()=>{const item=tokens[index++];return item.parts&&matches(item)?item.parts[1]+'-'+digest(item.parts[1],after)+(item.parts[3]||''):item.token;});
}
module.exports={rewrite};
