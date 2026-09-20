'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{PDFDocument,PDFName,PDFHexString}=require('pdf-lib'),{copyLinks,rebindLocalLinks}=require('../src/screen-export-pdf-links.cjs');
const key=name=>PDFName.of(name),annots=page=>(page.node.Annots()?.asArray()||[]).map(ref=>page.doc.context.lookup(ref));
async function setup(){const input=await PDFDocument.create(),source=input.addPage([300,500]),output=await PDFDocument.create(),target=output.addPage([300,400]);const add=value=>source.node.addAnnot(input.context.register(input.context.obj({Type:'Annot',Subtype:'Link',Rect:[80,280,180,320],...value})));return {input,source,output,target,add,crop:{left:100,bottom:200,right:250,top:400},scale:2,baseURL:'https://example.com/page?q=1'};}
test('PDF links are clipped and scaled with artwork, unsafe and outside links are excluded',async()=>{
 const state=await setup();for(const url of ['https://example.com/hello','mailto:hello@example.com','tel:+15555550100','javascript:alert(1)','file:///tmp/private'])state.add({A:{S:'URI',URI:PDFHexString.fromText(url)}});
 state.add({Rect:[0,0,10,10],A:{S:'URI',URI:PDFHexString.fromText('https://hidden.example/')}});state.add({A:{S:'Launch',F:PDFHexString.fromText('app')}});
 copyLinks(state);const links=annots(state.target);assert.equal(links.length,3);for(const link of links)assert.deepEqual(link.lookup(key('Rect')).asArray().map(n=>n.asNumber()),[0,160,160,240]);assert.deepEqual(links.map(link=>link.lookup(key('A')).lookup(key('URI')).decodeText()),['https://example.com/hello','mailto:hello@example.com','tel:+15555550100']);
});
test('PDF internal destinations stay on the exported page and outside targets retain their web destination',async()=>{
 const state=await setup();state.input.catalog.set(key('Dests'),state.input.context.obj({inside:[state.source.ref,'XYZ',150,350,0],outside:[state.source.ref,'XYZ',20,20,0]}));state.add({Dest:key('inside')});state.add({Dest:key('outside')});copyLinks(state);
 const [inside,outside]=annots(state.target),dest=inside.lookup(key('Dest'));assert.equal(dest.get(0),state.target.ref);assert.deepEqual([dest.lookup(2).asNumber(),dest.lookup(3).asNumber()],[100,300]);assert.equal(outside.lookup(key('A')).lookup(key('URI')).decodeText(),'https://example.com/page?q=1#outside');
});
test('copied internal links refer to the actual merged page instead of an orphan copy',async()=>{
 const state=await setup();state.input.catalog.set(key('Dests'),state.input.context.obj({inside:[state.source.ref,'XYZ',150,350,0]}));state.add({Dest:key('inside')});copyLinks(state);
 const merged=await PDFDocument.create();merged.addPage([10,10]);const [copied]=await merged.copyPages(state.output,[0]);merged.addPage(copied);rebindLocalLinks(state.target,copied);const saved=await PDFDocument.load(await merged.save()),page=saved.getPage(1),dest=annots(page)[0].lookup(key('Dest'));assert.equal(dest.get(0).toString(),page.ref.toString());assert.deepEqual([dest.lookup(2).asNumber(),dest.lookup(3).asNumber()],[100,300]);
});
