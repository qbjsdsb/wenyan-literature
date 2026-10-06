// Thin serial outbox pump. Acknowledgements never advance pull cursors.
export class SyncEngine {
 constructor(database,transport,onStatus=()=>{}){this.db=database;this.transport=transport;this.onStatus=onStatus;this.running=null;this.attempt=0;this.stopped=false;}
 flush(){if(this.running)return this.running;this.running=this.run().finally(()=>{this.running=null;});return this.running;}
 async run(){
  if(this.stopped)return;this.onStatus('syncing');
  try{
   // Oldest durable operation first, preserving checkpoint/undo dependencies.
   for(;;){const state=await this.db.read();const op=state.outbox.sort((a,b)=>(a.order||0)-(b.order||0)||a.createdAt-b.createdAt||a.id.localeCompare(b.id))[0];if(!op)break;
    const receipt=await this.transport.commit(op);await this.db.acknowledge(op,receipt);
   }
   let state=await this.db.read(),cursor=state.cursor,high=null;
   for(;;){const page=await this.transport.pull(cursor,high);high=page.watermark;await this.db.receive(page);if(page.nextCursor===high)break;if(page.nextCursor<=cursor)throw Error('NON_PROGRESSING_PAGE');cursor=page.nextCursor;}
   await this.db.snapshot();this.attempt=0;this.onStatus((await this.db.read()).conflicts.length?'conflict':'synced');
  }catch(e){this.attempt++;this.onStatus(e.status===401||e.code==='42501'?'auth':e.code||e.message==='ID_CONTENT_CONFLICT'?'error':'offline',e);throw e;}
 }
 retryDelay(){return Math.min(60000,1000*2**Math.min(this.attempt,6))*(.8+Math.random()*.4);}
 stop(){this.stopped=true;}
}
