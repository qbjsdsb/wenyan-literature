import {validEvent,mergeEvents} from './core.js';
export function importEvents(data,current){
 if(![2,3].includes(data?.schema)||!Array.isArray(data.events)||data.events.some(e=>!validEvent(e)))throw Error('INVALID_BACKUP');
 const seen=new Map(current.filter(e=>e.kind!=='session').map(e=>[e.id,e]));
 for(const e of data.events)if(e.kind!=='session'&&seen.has(e.id)&&JSON.stringify(seen.get(e.id))!==JSON.stringify(e))throw Error('ID_CONTENT_CONFLICT');
 return mergeEvents(current,data.events);
}
export function exportState(events){return {schema:3,events,exportedAt:new Date().toISOString()};}
