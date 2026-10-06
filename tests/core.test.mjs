import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeEvents,reviewCard,latest,dueKeys,spellingMatches,DAY} from '../src/core.js';
const at=Date.now()-DAY;
const event=(id,kind,key,value,when=at)=>({id,device:'test-device',kind,key,value,at:when});
test('离线设备分别提交、重试同步后，记录只保留一次且结果与同步顺序无关',()=>{
 const a=event('device-a-review','review','word:abandon',{rating:3});
 const b=event('device-b-review','review','word:abandon',{rating:1},at+60000);
 const first=mergeEvents([a],[b,a]),second=mergeEvents([b],[a]);
 assert.equal(first.length,2);assert.deepEqual(reviewCard(first,'word:abandon'),reviewCard(second,'word:abandon'));
});
test('跟打和手动已掌握不生成记忆评分，已掌握可恢复',()=>{
 const typing=event('typing-example','typing','word:abandon',{correct:true});
 assert.equal(reviewCard([typing],'word:abandon').reps,0);
 const mastered=event('mastery-example','mastered','word:abandon',{on:true});
 assert.deepEqual(dueKeys([typing,mastered],['word:abandon']),[]);
 const undoMastered=event('mastery-restored','mastered','word:abandon',{on:false},at+1);
 assert.deepEqual(dueKeys([typing,mastered,undoMastered],['word:abandon']),['word:abandon']);
});
test('撤销评价恢复之前的FSRS状态，而不是给下一张卡加一次评分',()=>{
 const a=event('first-review-id','review','word:abandon',{rating:3});
 const b=event('second-review-id','review','word:abandon',{rating:1},at+DAY);
 const undo=event('undo-review-id','undo','word:abandon',{id:b.id},at+DAY+1);
 assert.deepEqual(reviewCard([a,b,undo],'word:abandon'),reviewCard([a],'word:abandon'));
 assert.equal(reviewCard([a,b],'word:abandon').reps,2);
});
test('同一日期任务记录可撤销，昨天的完成不会污染今天',()=>{
 const a=event('task-complete-id','task','2026-10-06:reading',{done:true});
 const undo=event('task-undo-id','undo',a.key,{id:a.id},at+1);
 assert.equal(latest([a],'task',a.key).done,true);assert.equal(latest([a,undo],'task',a.key),undefined);
 assert.equal(latest([a],'task','2026-10-07:reading'),undefined);
});
test('单词提交接受大小写和外围空格，不接受漏字或字母间空格',()=>{
 assert.equal(spellingMatches(' Abandon ','abandon'),true);
 assert.equal(spellingMatches('abando','abandon'),false);
 assert.equal(spellingMatches('aban don','abandon'),false);
});
