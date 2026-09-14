'use strict';
// Logical text paragraphs use phrasing markup so a heading/label keeps its
// semantic source element. The marker makes their boundaries addressable.
function markup(content,jsx=false){return '<span data-retouch-paragraph="" '+(jsx?'style={{display:"block"}}':'style="display: block;"')+'>'+content+'</span>';}
function validate(node){return Object.keys(node).some(key=>!['t','children'].includes(key))?'Invalid text paragraph.':null;}
module.exports={markup,validate};
