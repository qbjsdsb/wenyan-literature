import test from 'node:test';
import assert from 'node:assert/strict';
import {importEvents,exportState} from '../src/backup.js';
import {reviewCard,latest} from '../src/core.js';
const at=Date.now()-60000;
const e=(id,kind,key,value)=>({id,device:'qa-device',at,kind,key,value});
test('备份往返保留阅读位置、首次订正结果、复习状态和半组续学，重复导入不增加记录',()=>{
 const events=[e('reading-resume','reading','resume',{article:'narrative',section:1,paragraph:1}),e('spelling-review','review','word:abandon',{rating:1,firstCorrect:false}),e('study-session','session','english',{queue:['abandon','ability'],index:1,mode:'recall',results:[{id:'abandon',rating:1,firstCorrect:false}]})];
 const backup=JSON.parse(JSON.stringify(exportState(events)));
 const restored=importEvents(backup,[]);assert.equal(restored.length,3);
 assert.deepEqual(latest(restored,'reading','resume'),events[0].value);
 assert.deepEqual(latest(restored,'session','english'),events[2].value);
 assert.deepEqual(reviewCard(restored,'word:abandon'),reviewCard(events,'word:abandon'));
 assert.deepEqual(importEvents(backup,restored),restored);
});
test('错误备份整份拒绝，不改变现有学习记录',()=>{
 const current=[e('existing-task','task','2026-10-06:reading',{done:true})];
 for(const bad of [{schema:1,events:[]},{schema:2,events:{}},{schema:2,events:[{...current[0],value:{done:'yes'}}]},null])assert.throws(()=>importEvents(bad,current));
 assert.equal(current.length,1);assert.equal(current[0].value.done,true);
});
