import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {launchBrowser} from './browser-launch.mjs';
import {readDatabase,waitIndex,settled} from './browser-storage.mjs';
const base=process.env.WENYAN_BASE_URL||'http://127.0.0.1:4173/';
const byId=new Map(JSON.parse(await readFile('public/data/english/netem-v1.json','utf8')).catalog.map(w=>[w.id,w.word]));
const browser=await launchBrowser();
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'#english');await page.waitForFunction(()=>window.__wenyanVocabularyMeta?.status==='ready');
 await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.reload();await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller)&&window.__wenyanVocabularyMeta?.status==='ready');
 await page.locator('[data-action="start-smart"]').click();await settled(page);await page.locator('#word-input').waitFor();
 let state=await readDatabase(page,null);const id=state.session.id;
 await page.locator('#word-input').fill(byId.get(state.session.queue[0]));await waitIndex(page,0,null);
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.__wenyanVocabularyMeta?.status==='ready');
 state=await readDatabase(page,null);assert.equal(state.session.id,id);assert.equal(state.session.index,1);
 await page.locator('#word-input').fill(byId.get(state.session.queue[1]));await waitIndex(page,1,null);
 await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto(base+'#train');await page.waitForFunction(()=>window.__wenyanVocabularyMeta?.status==='ready');
 state=await readDatabase(page,null);assert.equal(state.session.id,id);assert.equal(state.session.index,2);
 await context.setOffline(false);await page.reload();await page.waitForFunction(()=>window.__wenyanVocabularyMeta?.status==='ready');assert.equal((await readDatabase(page,null)).session.index,2);
 assert.deepEqual(errors,[]);await context.close();
 // Abort the next completion transaction at the actual IDB layer. The UI must
 // stay on the word and show a recovery message, then survive a clean reload.
 const broken=await browser.newContext({viewport:{width:1440,height:900}});const p=await broken.newPage();await p.goto(base+'?test=baseline#english');await p.waitForFunction(()=>window.__wenyanVocabularyMeta?.status==='ready');await p.locator('[data-action="start-smart"]').click();await settled(p);
 const before=await readDatabase(p);await p.evaluate(()=>{const original=IDBObjectStore.prototype.add;let armed=true;IDBObjectStore.prototype.add=function(value,...args){if(armed&&this.name==='facts'&&['typing','review'].includes(value?.event?.kind)){armed=false;this.transaction.abort();throw new DOMException('Synthetic storage failure','QuotaExceededError');}return original.call(this,value,...args);};});
 await p.locator('#word-input').fill(byId.get(before.session.queue[0]));await p.waitForFunction(()=>document.querySelector('.save-warning'));
 assert.equal((await readDatabase(p)).session.index,0);assert.equal((await readDatabase(p)).events.filter(e=>['typing','review'].includes(e.kind)).length,0);
 await p.reload();await p.waitForFunction(()=>window.__wenyanVocabularyMeta?.status==='ready');await p.locator('#word-input').fill(byId.get(before.session.queue[0]));await waitIndex(p,0);
 await broken.close();console.log('Production dist offline/reopen/reconnect and aborted-IDB recovery passed',base);
}finally{await browser.close();}
