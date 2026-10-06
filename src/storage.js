import {mergeEvents,validEvent,newId} from './core.js';
const testScope=new URLSearchParams(location.search).get('test');
export const prefix=['1','visual','baseline','baseline-restore'].includes(testScope)?testScope==='1'?'wenyan-test:':testScope==='visual'?'wenyan-visual:':'wenyan-'+testScope+':':'';
let problem='';
export const local={getItem:k=>{try{return localStorage.getItem(prefix+k);}catch{problem='浏览器无法读取记录，请导出备份。';return null;}},setItem:(k,v)=>localStorage.setItem(prefix+k,v)};
const key='wenyan-events-v2';
let stored=[],rawRecords='';
try {rawRecords=local.getItem(key)||'';stored=rawRecords?JSON.parse(rawRecords):[];if(!Array.isArray(stored)||stored.some(e=>!validEvent(e)))throw Error('invalid');}
catch {problem='本机记录未能读取，请先导出备份；原数据未覆盖。';stored=[];}
const device=local.getItem('wenyan-device')||newId();
try{local.setItem('wenyan-device',device);}catch{problem='浏览器无法保存记录，请导出备份。';}
export const store={events:mergeEvents(stored),device,problem,rawRecords,status:'local'};
export function save(events=store.events) {
 if(problem){store.problem=problem;return false;}
 try {
  // Merge records from other tabs before writing; never erase their completed work.
  const current=JSON.parse(local.getItem(key)||'[]');
  if(!Array.isArray(current)||current.some(e=>!validEvent(e)))throw Error('invalid');
  const merged=mergeEvents(current,events);
  local.setItem(key,JSON.stringify(merged));store.events=merged;store.problem='';return true;
 } catch {store.problem='未能保存到本机，请立即导出备份。';return false;}
}
export function record(kind,key,value) {
 const event={id:newId(),device,kind,key,at:Date.now(),value:structuredClone(value)};
 store.events=mergeEvents(store.events,[event]);save();window.dispatchEvent(new Event('wenyan-change'));return event;
}
window.addEventListener('storage',e=>{
 if(e.key===prefix+key){try{const list=JSON.parse(e.newValue||'[]');if(!Array.isArray(list)||list.some(e=>!validEvent(e)))return;store.events=mergeEvents(store.events,list);window.dispatchEvent(new Event('wenyan-remote'));}catch{}}
});
