'use strict';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const model=()=>({version:1,collections:[{id:id(1),name:'Theme',defaultMode:id(2),modes:[{id:id(2),name:'Light'},{id:id(3),name:'Dark'}]}],variables:[{id:id(4),collectionId:id(1),name:'Brand',type:'color',values:{[id(2)]:'#123456',[id(3)]:'#cc3300'}},{id:id(5),collectionId:id(1),name:'Spacing',type:'number',values:{[id(2)]:12,[id(3)]:24}},{id:id(6),collectionId:id(1),name:'Accent',type:'color',values:{[id(2)]:{alias:id(4)},[id(3)]:{alias:id(4)}}}]});
module.exports={id,model};
