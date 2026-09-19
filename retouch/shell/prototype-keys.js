(function(root){
 'use strict';
 const modifiers=['ctrl','alt','shift','meta'],codes=[...Array.from({length:26},(_,i)=>'Key'+String.fromCharCode(65+i)),...Array.from({length:10},(_,i)=>'Digit'+i),'Enter','Space','Escape','Tab','Backspace','Delete','Insert','Home','End','PageUp','PageDown','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Minus','Equal','BracketLeft','BracketRight','Backslash','Semicolon','Quote','Backquote','Comma','Period','Slash',...Array.from({length:24},(_,i)=>'F'+(i+1)),...Array.from({length:10},(_,i)=>'Numpad'+i),'NumpadEnter','NumpadAdd','NumpadSubtract','NumpadMultiply','NumpadDivide','NumpadDecimal'];
 function validate(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['code',...modifiers].includes(key))||!codes.includes(value.code)||modifiers.some(key=>value[key]!==undefined&&typeof value[key]!=='boolean'))throw Error('Choose a supported key and keyboard modifiers.');return {code:value.code,...Object.fromEntries(modifiers.map(key=>[key,!!value[key]]))};}
 function signature(value){const v=validate(value);return modifiers.map(key=>v[key]?'1':'0').join('')+':'+v.code;}
 function matches(value,event){return !event.isComposing&&!event.repeat&&event.code===value.code&&modifiers.every(key=>!!event[key+'Key']===!!value[key]);}
 function keyName(code){return code.replace(/^Key|^Digit/,'').replace(/^Arrow/,'Arrow ').replace(/^Numpad/,'Numpad ');}
 function label(value){const v=validate(value);return [...modifiers.filter(key=>v[key]).map(key=>({ctrl:'Ctrl',alt:'Alt',shift:'Shift',meta:'⌘ / Meta'})[key]),keyName(v.code)].join(' + ');}
 function next(items){const used=new Set(items.filter(item=>item.trigger==='keyboard').map(item=>signature(item.shortcut)));for(const shift of [false,true])for(const code of ['KeyK',...codes]){const candidate=validate({code,shift});if(!used.has(signature(candidate)))return candidate;}return null;}
 const api={codes,modifiers,validate,signature,matches,keyName,label,next};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeKeys=api;
})(typeof window==='object'?window:globalThis);
