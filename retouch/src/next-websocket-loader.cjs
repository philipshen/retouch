'use strict';
const MagicString=require('magic-string');
const marker='// Retouch: retain the latest completed webpack hash.';
function transform(source,filename){
 if(source.includes(marker))return null;
 const matches=[...source.matchAll(/if \(message\.type === ([\w$.]+)\.SYNC && 'hash' in message\) \{/g)];
 if(matches.length!==1||source.split('let mostRecentCompilationHash = null;').length!==2)return null;
 const match=matches[0],code=new MagicString(source);
 // Next broadcasts SYNC to existing sockets when another preview connects.
 // Keep restart detection, but compare against builds already seen by this
 // client rather than the hash from its initial connection.
 code.appendLeft(match.index,`${marker}\n                if (message.type === ${match[1]}.BUILT && typeof message.hash === 'string') {\n                    mostRecentCompilationHash = message.hash;\n                }\n                `);
 return {code:code.toString(),map:code.generateMap({hires:true,source:filename,includeContent:true})};
}
module.exports=function(source,inputMap){
 const callback=this.async();if(process.env.NODE_ENV==='production')return callback(null,source,inputMap);
 try{const result=transform(source,this.resourcePath);if(result)return callback(null,result.code,result.map);if(!source.includes(marker))this.emitWarning?.(new Error('[retouch] Next websocket hash guard skipped: unrecognized development client.'));callback(null,source,inputMap);}catch(error){this.emitWarning?.(error);callback(null,source,inputMap);}
};
module.exports.transform=transform;
