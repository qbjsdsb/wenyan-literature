// Verify a PRIVATE snapshot supplied as an absolute local path. Print counts
// only. Never print contents, user identifiers, credentials or word histories.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {openLocalDB} from '../src/cloud/local-db.js';
import {importEvents} from '../src/backup.js';
const path=process.argv[2];if(!path)throw Error('Usage: node scripts/verify-cloud-backup.mjs <private-snapshot.json>');
const backup=JSON.parse(await readFile(path,'utf8'));
const watermark=backup.watermark??backup.cloudBackup?.watermark;assert.equal(backup.schema,3);assert(Number.isSafeInteger(watermark)&&watermark>=0);
const db=await openLocalDB('backup-verification-'+crypto.randomUUID(),indexedDB);
try{
 await db.migrate([]);await db.restore(importEvents(backup,[]),backup.settings);
 const state=await db.read();assert.equal(state.facts.length,backup.events.filter(e=>e.kind!=='session').length);
 for(const[field,row]of Object.entries(backup.settings||{}))assert.deepEqual(state.settings[field].value,row.value);
 console.log(JSON.stringify({verified:true,facts:state.facts.length,checkpoints:state.checkpoints.length,cloudForks:(backup.cloudForks??backup.cloudBackup?.forks)?.length||0,watermark}));
}finally{db.close();}
