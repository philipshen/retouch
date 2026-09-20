(function(root){
 'use strict';
 const I=root.RetouchInspector,A=root.RetouchPrototypeActionList,names={'navigate':'Navigate to','back':'Back','open-link':'Open link','set-variable':'Set variable','set-variable-mode':'Set variable mode','scroll':'Scroll to','open-overlay':'Open overlay','swap-overlay':'Swap overlay','close-overlay':'Close overlay','conditional':'Conditional'};
 const signatures=new WeakMap();
 function mount(parent,{actions,index,library,fields,pick,change}){
  const tree=structuredClone(actions),box=document.createElement('div');box.className='prototype-action-list';parent.append(box);const status=I.note(box,'');status.setAttribute('role','status');
  function listAt(next,path){return path.length?A.locate(next,path.slice(0,-1))[path.at(-1)]:next;}
  function update(mutate){const next=structuredClone(tree);try{mutate(next);return change(A.validate(next));}catch(error){status.textContent=error.message;}}
  function replace(path,value){return update(next=>{listAt(next,path.slice(0,-1))[path.at(-1)]=value;});}
  function move(from,to){return update(next=>{if(to.length>from.length&&from.every((n,i)=>to[i]===n))throw Error('An action cannot contain itself.');const source=listAt(next,from.slice(0,-1)),target=listAt(next,to.slice(0,-1)),old=from.at(-1),at=to.at(-1),[item]=source.splice(old,1);target.splice(source===target&&old<at?at-1:at,0,item);});}
  function list(container,items,path){
   items.forEach((action,n)=>{
    const current=[...path,n],id=index+'.'+current.map(x=>typeof x==='number'?x+1:x).join('.'),card=document.createElement('details'),summary=document.createElement('summary'),content=document.createElement('div');card.className='prototype-action';card.dataset.actionPath=JSON.stringify(current);signatures.set(card,JSON.stringify(action));card.open=true;summary.textContent=names[action.action]+(action.action==='set-variable'?' · '+(library?.variables.find(v=>v.id===action.assignment.id)?.name||'Missing variable'):'');summary.dataset.actionDropPath=JSON.stringify(current);summary.setAttribute('aria-label','Action details '+id);card.append(summary,content);container.append(card);
    const controls=document.createElement('div');controls.className='prototype-action-controls';content.append(controls);
    for(const [label,offset]of [['Move up',-1],['Move down',1]]){const button=I.button(label,()=>update(next=>{const siblings=listAt(next,path),[item]=siblings.splice(n,1);siblings.splice(n+offset,0,item);}));button.setAttribute('aria-label',label+' action '+id);button.title=label;button.textContent=offset<0?'↑':'↓';button.disabled=n+offset<0||n+offset>=items.length;controls.append(button);}
    const remove=I.button('Remove action',()=>update(next=>listAt(next,path).splice(n,1)));remove.setAttribute('aria-label','Remove action '+id);remove.title='Remove action';remove.textContent='×';remove.disabled=!path.length&&items.length===1;controls.append(remove);
    if(action.action==='conditional'){
     fields(content,action,id,value=>replace(current,value),()=>pick(current));
     root.RetouchPrototypeExpressionPanel.mount(content,{expression:action.condition,type:'boolean',library,index:id+' condition',change:condition=>replace(current,{...action,condition})});
     for(const [branch,label]of [['then','If true'],['else','Otherwise']]){const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=label;group.append(legend);content.append(group);list(group,action[branch],[...current,branch]);}
    }else fields(content,action,id,value=>replace(current,value),()=>pick(current));
    for(const label of content.querySelectorAll('.inspector-field > span'))label.textContent=label.textContent.replace(/ [0-9]+(?:\.[a-z0-9]+)*$/,'');
   });
   const id=index+(path.length?'.'+path.map(x=>typeof x==='number'?x+1:x).join('.'):''),add=I.button('Add action',()=>update(next=>listAt(next,path).push({action:'navigate',destination:'/'})));add.setAttribute('aria-label','Add action '+id);add.dataset.actionDropPath=JSON.stringify([...path,items.length]);container.append(add);
  }
  list(box,tree,[]);root.RetouchPrototypeActionView.reorder(box,move);
 }
 function reveal(parent,path){const card=[...(parent?.querySelectorAll('.prototype-action')||[])].find(el=>el.dataset.actionPath===JSON.stringify(path));if(!card)return;for(let el=card;el&&el!==parent;el=el.parentElement)if(el.localName==='details')el.open=true;card.scrollIntoView({block:'nearest'});card.querySelector('select')?.focus({preventScroll:true});}
 function snapshot(parent){return [...parent.querySelectorAll('.prototype-action')].map(card=>({path:JSON.parse(card.dataset.actionPath),signature:signatures.get(card),open:card.open}));}
 function restore(parent,state){const cards=[...parent.querySelectorAll('.prototype-action')],open=root.RetouchPrototypeActionView.reconcile(snapshot(parent),state);cards.forEach((card,n)=>card.open=open[n]);}
 root.RetouchPrototypeActionPanel={mount,reveal,snapshot,restore};
})(window);
