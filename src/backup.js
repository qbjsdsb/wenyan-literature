import {validEvent,mergeEvents} from './core.js';
export function importEvents(data,current){
 if(data?.schema!==2||!Array.isArray(data.events)||data.events.some(e=>!validEvent(e)))throw Error('INVALID_BACKUP');
 return mergeEvents(current,data.events);
}
export function exportState(events){return {schema:2,events,exportedAt:new Date().toISOString()};}
