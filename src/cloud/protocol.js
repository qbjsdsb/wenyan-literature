import {validEvent} from '../core.js';
export const PROTOCOL=3;
export const CONTENT_VERSION='netem-v1+ecdict-v1';
export const SCHEDULER_VERSION='ts-fsrs-5.2.3/epoch-1';
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function assertSame(a,b){if(canonical(a)!==canonical(b))throw Error('ID_CONTENT_CONFLICT');}
export function validateFacts(events){
 if(!Array.isArray(events)||events.length>100000||events.some(e=>!validEvent(e)||e.kind==='session'))throw Error('INVALID_FACTS');
 if(events.some(e=>e.version!=null&&(e.version!==3||e.contentVersion!==CONTENT_VERSION||e.schedulerVersion!==SCHEDULER_VERSION)))throw Error('UNKNOWN_FACT_VERSION');
 const seen=new Map();for(const e of events){if(seen.has(e.id))assertSame(seen.get(e.id),e);seen.set(e.id,e);}
}
export function validateCheckpoint(key,value){
 if(!['english','literature'].includes(key)||!validEvent({id:'checkpoint-validate',device:'validator',at:Date.now(),kind:'session',key,value}))throw Error('INVALID_CHECKPOINT');
 if(typeof value.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(value.id))throw Error('INVALID_SESSION_ID');
}
export function checkpointEvent(cp){return {id:'checkpoint-'+cp.id,device:cp.writer||'restored',kind:'session',key:cp.key,at:cp.at,value:cp.value};}
export function validateSetting(field,value){
 if(field==='newWordLimit')return [6,12,24].includes(value);
 if(field==='layer')return ['core','high','full'].includes(value);
 if(field==='timezone'){try{new Intl.DateTimeFormat('en',{timeZone:value});return typeof value==='string';}catch{return false;}}
 return false;
}
