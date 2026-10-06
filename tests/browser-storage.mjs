// Inspect actual IndexedDB; no production dual-write compatibility mirror.
export const settled=page=>page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')!=='true');
export async function readDatabase(page,scope='baseline'){
 await settled(page);
 return page.evaluate(async name=>{
  const db=await new Promise((res,rej)=>{const req=indexedDB.open(name?'wenyan-'+name+':wenyan-v3':'wenyan-v3');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
  const tx=db.transaction(['facts','checkpoints'],'readonly');const all=s=>new Promise((res,rej)=>{const r=tx.objectStore(s).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  const [facts,cps]=await Promise.all([all('facts'),all('checkpoints')]);db.close();
  const cp=cps.filter(c=>c.key==='english').sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).at(-1);
  return {events:[...facts.map(r=>r.event),...cps.map(c=>({id:'checkpoint-'+c.id,device:c.writer,kind:'session',key:c.key,at:c.at,value:c.value}))].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)),session:cp?.value||null};
 },scope);
}
export async function waitIndex(page,index,scope='baseline'){
 const deadline=Date.now()+30000;
 while(Date.now()<deadline){const state=await readDatabase(page,scope);if(state.session?.index>index){await settled(page);return;}await new Promise(resolve=>setTimeout(resolve,25));}
 throw Error('Persisted session did not advance beyond '+index);
}
export async function resetScope(page,scope){
 await page.evaluate(async scope=>{window.__wenyanTestClose?.();for(const k of Object.keys(localStorage))if(k.startsWith('wenyan-'+scope+':'))localStorage.removeItem(k);await new Promise((res,rej)=>{const req=indexedDB.deleteDatabase('wenyan-'+scope+':wenyan-v3');req.onsuccess=res;req.onerror=()=>rej(req.error);});},scope);
}
