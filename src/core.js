import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';
import { ENGLISH_MODES } from './english/config.js';
import { validSmartPlan } from './english/session.js';

export const scheduler = fsrs({enable_fuzz:false});
export const DAY = 86400000;
export const kinds = new Set(['review','typing','reading','task','favorite','mastered','undo','session','attempt']);
export function validEvent(e) {
  if(!(e && /^[a-zA-Z0-9-]{8,80}$/.test(e.id) && typeof e.device==='string' && e.device.length<=80 && kinds.has(e.kind) && typeof e.key==='string' && e.key.length<=100 && Number.isFinite(e.at) && e.at>0 && e.at<=Date.now()+DAY && e.value && typeof e.value==='object' && !Array.isArray(e.value) && JSON.stringify(e.value).length<=8192))return false;
  const v=e.value;
  if(e.kind==='attempt')return ['firstCorrect','hinted'].includes(v.field)&&typeof v.value==='boolean'&&typeof v.sessionId==='string'&&Number.isSafeInteger(v.index)&&v.index>=0;
  if(e.kind==='review')return [1,3].includes(v.rating);
  if(e.kind==='typing')return typeof v.correct==='boolean';
  if(e.kind==='reading')return typeof v.article==='string' && Number.isSafeInteger(v.section) && v.section>=0 && v.section<1000 && Number.isSafeInteger(v.paragraph) && v.paragraph>=0 && v.paragraph<1000;
  if(e.kind==='task')return typeof v.done==='boolean';
  if(e.kind==='favorite'||e.kind==='mastered')return typeof v.on==='boolean';
  if(e.kind==='undo')return typeof v.id==='string' && /^[a-zA-Z0-9-]{8,80}$/.test(v.id);
  if(e.kind==='session')return ['english','literature'].includes(e.key) && Array.isArray(v.queue) && v.queue.length<=50 && v.queue.every(id=>typeof id==='string'&&id.length<100) && Number.isSafeInteger(v.index) && v.index>=0 && v.index<=v.queue.length && Array.isArray(v.results) && v.results.length<=v.queue.length && v.results.every(r=>r&&typeof r.id==='string'&&[null,1,3].includes(r.rating)) && (e.key==='english'?Object.hasOwn(ENGLISH_MODES,v.mode)&&validSmartPlan(v):typeof v.article==='string');
  return false;
}
export function mergeEvents(...lists) {
  const map=new Map();
  for(const list of lists) for(const e of list) if(validEvent(e) && !map.has(e.id)) map.set(e.id,e);
  return [...map.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
export function activeEvents(events) {
  const undone=new Set(events.filter(e=>e.kind==='undo').map(e=>e.value.id));
  return events.filter(e=>e.kind!=='undo'&&!undone.has(e.id));
}
export function latest(events,kind,key) {
  if(kind==='favorite'||kind==='mastered'){
    const heads=flagHeads(events,kind,key);if(!heads.length)return undefined;
    return {on:kind==='mastered'?heads.every(e=>e.value.on):heads.some(e=>e.value.on),conflict:new Set(heads.map(e=>e.value.on)).size>1};
  }
  return activeEvents(events).filter(e=>e.kind===kind && e.key===key).at(-1)?.value;
}
// Only boolean learning flags carry observed predecessors. Concurrent mastery
// keeps the word in review; concurrent bookmarks keep it visible. A later
// explicit toggle observes both branches and resolves the choice.
export function flagHeads(events,kind,key){
  const list=activeEvents(events).filter(e=>e.kind===kind&&e.key===key).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)),superseded=new Set();
  let legacy;for(const e of list){if(Array.isArray(e.previous))for(const id of e.previous)superseded.add(id);else{if(legacy)superseded.add(legacy.id);legacy=e;}}
  return list.filter(e=>!superseded.has(e.id));
}
export function reviewCard(events,key) {
  let card=createEmptyCard(new Date(0));
  for(const e of activeEvents(events)) if(e.kind==='review'&&e.key===key) {
    const when=new Date(Math.max(e.at,card.last_review?.getTime()||0));
    card=scheduler.repeat(card,when)[e.value.rating].card;
  }
  return card;
}
export function nextReview(events,key,rating,at=Date.now()) {
  return scheduler.repeat(reviewCard(events,key),new Date(at))[rating].card;
}
export function localDay(at=Date.now()) {
  const d=new Date(at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function dueKeys(events,keys,now=Date.now()) {
  return keys.filter(key=>reviewCard(events,key).due.getTime()<=now && !latest(events,'mastered',key)?.on);
}
export function normalizeWord(value) {return value.trim().toLowerCase().normalize('NFKC');}
export function spellingMatches(value,word) {return normalizeWord(value)===word.toLowerCase();}
export function intervalLabel(date) {
  const mins=Math.ceil((date.getTime()-Date.now())/60000);
  return mins<60?`${Math.max(1,mins)}分钟后` : mins<1440?`${Math.ceil(mins/60)}小时后`:`${Math.ceil(mins/1440)}天后`;
}
export { Rating };

export function newId(){return globalThis.crypto.randomUUID?.() || Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");}
