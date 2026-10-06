import {validEvent,mergeEvents} from './core.js';
import {assertSame,CONTENT_VERSION,SCHEDULER_VERSION,validateSetting} from './cloud/protocol.js';
const upgraded=e=>e.version?e:{...e,version:3,contentVersion:CONTENT_VERSION,schedulerVersion:SCHEDULER_VERSION,imported:true};
export function importEvents(data,current){
 if(![2,3].includes(data?.schema)||!Array.isArray(data.events)||data.events.some(e=>!validEvent(e)))throw Error('INVALID_BACKUP');
 const seen=new Map(current.filter(e=>e.kind!=='session').map(e=>[e.id,e]));
 for(const[k,row]of Object.entries(data.settings||{}))if(!validateSetting(k,row&&typeof row==='object'?row.value:row))throw Error('INVALID_SETTING');
 for(const e of data.events)if(e.kind!=='session'&&seen.has(e.id))assertSame(upgraded(seen.get(e.id)),upgraded(e));
 return mergeEvents(current,data.events);
}
export function exportState(events){return {schema:3,events,exportedAt:new Date().toISOString()};}
