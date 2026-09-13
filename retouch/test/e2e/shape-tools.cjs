'use strict';
// Exercise the public toolbar/search paths; shape actions have no inspector buttons.
async function run(page,label){
 if(label==='Pen'){await page.getByRole('button',{name:'Pen tool',exact:true}).click();return;}
 if(label.startsWith('Draw ')){await page.getByRole('button',{name:'Shape tools',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();return;}
 await page.locator('#quickActions').click();await page.getByRole('combobox',{name:'Search actions'}).fill(label);await page.getByRole('option',{name:label,exact:true}).click();
}
module.exports={run};
