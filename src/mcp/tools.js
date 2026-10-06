// Shared, pure learning projection. No transport, credential, SQL or write API.
import {activeEvents,mergeEvents,reviewCard,latest,DAY} from '../core.js';
import {createSmartSession} from '../english/smart.js';
import {recentWrongWordIds} from '../english/queue.js';
import {CONTENT_VERSION,SCHEDULER_VERSION,validateFacts,validateSetting} from '../cloud/protocol.js';
export const TOOL_NAMES=['get_learning_overview','get_review_pressure','get_problem_words','get_word_history','preview_study_session'];
export function projectLearning(snapshot,catalog,now=Date.now()){
 validateFacts(snapshot.events);const events=mergeEvents(snapshot.events),active=activeEvents(events),reviews=active.filter(e=>e.kind==='review'&&e.key.startsWith('word:'));
 const grouped=new Map();for(const e of reviews){if(!grouped.has(e.key))grouped.set(e.key,[]);grouped.get(e.key).push(e);}
 const cards=new Map([...grouped].map(([key,rows])=>[key,reviewCard(rows,key)]));
 const flags=new Map();for(const e of active)if(e.kind==='mastered'){if(!flags.has(e.key))flags.set(e.key,[]);flags.get(e.key).push(e);}
 const mastered=new Map([...flags].map(([key,rows])=>[key,latest(rows,'mastered',key)?.on??false]));
 const timezone=validateSetting('timezone',snapshot.settings?.timezone?.value)?snapshot.settings.timezone.value:'UTC';
 const day=at=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
 const meta={as_of:snapshot.asOf,timezone,watermark:snapshot.watermark,projection_revision:`${snapshot.watermark}/${SCHEDULER_VERSION}`,content_version:CONTENT_VERSION,scheduler_version:SCHEDULER_VERSION,
  sample:{committed_facts:events.length,active_reviews:reviews.length,observed_first_results:reviews.filter(e=>typeof e.value.firstCorrect==='boolean').length},
  coverage:{complete_committed_history:true,offline_devices:'unknown',timing_observations:'unavailable',timezone_source:snapshot.settings?.timezone?'learner_setting':'UTC_fallback'},missing:['unsynced learning on other computers','original incorrect spellings and durations are not collected']};
 const due=[...cards].filter(([key,c])=>c.due.getTime()<=now&&!mastered.get(key)).sort((a,b)=>a[1].due-b[1].due).map(([key])=>key.slice(5));
 return {events,active,reviews,grouped,cards,mastered,meta,due,catalog,day,now,snapshot};
}
const evidence=(events,limit=20)=>events.slice(-limit).map(e=>e.id);
export function learningTool(name,args,snapshot,catalog,now=Date.now()){
 if(!TOOL_NAMES.includes(name))throw Error('UNKNOWN_TOOL');
 if(!snapshot.complete)return {metadata:{as_of:snapshot.asOf,watermark:snapshot.watermark,coverage:{complete_committed_history:false,offline_devices:'unknown'}},data_unavailable:'History exceeds the bounded query budget; no FSRS or mastery conclusion was computed.'};
 const p=projectLearning(snapshot,catalog,now),{events,active,reviews,grouped,cards,mastered,meta,due,day}=p;
 const days=args.days??7,windowReviews=reviews.filter(e=>e.at>=now-days*DAY&&e.at<=now),window={from:new Date(now-days*DAY).toISOString(),to:new Date(now).toISOString(),days};
 if(name==='get_learning_overview'){
  const todayReviews=reviews.filter(e=>day(e.at)===day(now)&&e.at<=now),observed=todayReviews.filter(e=>typeof e.value.firstCorrect==='boolean'),first=[...grouped.values()].filter(rows=>day(rows[0].at)===day(now)&&rows[0].at<=now);
  return {metadata:meta,today:{local_date:day(now),reviews:todayReviews.length,first_reviews_of_words:first.length,typing:active.filter(e=>e.kind==='typing'&&day(e.at)===day(now)&&e.at<=now).length,
   independent_first_correct:observed.filter(e=>e.value.firstCorrect===true&&e.value.hinted===false).length,first_result_denominator:observed.length},due:due.length,new_word_target:snapshot.settings?.newWordLimit?.value??12,
   unfinished_sessions:(snapshot.checkpoints||[]).filter(cp=>cp.key==='english'&&cp.value.index<cp.value.queue.length).map(cp=>({id:cp.id,index:cp.value.index,steps:cp.value.queue.length,revision:cp.revision})),evidence:evidence(todayReviews)};
 }
 if(name==='get_review_pressure')return {metadata:meta,window,due:due.length,upcoming:[0,1,2,3,4,5,6].map(offset=>({local_date:day(now+offset*DAY),count:[...cards].filter(([key,c])=>day(c.due.getTime())===day(now+offset*DAY)&&!mastered.get(key)).length})),reviews:windowReviews.length,again:windowReviews.filter(e=>e.value.rating===1).length,hinted:windowReviews.filter(e=>e.value.hinted===true).length,evidence:evidence(windowReviews),interpretation:'Counts describe observations; they do not prove why the workload changed.'};
 if(name==='get_problem_words'){
  const groups=new Map();for(const e of windowReviews){if(!groups.has(e.key))groups.set(e.key,[]);groups.get(e.key).push(e);}
  const words=[...groups].map(([key,rows])=>({word_id:key.slice(5),sample:rows.length,again:rows.filter(e=>e.value.rating===1).length,hinted:rows.filter(e=>e.value.hinted===true).length,last_independent_success:rows.filter(e=>e.value.firstCorrect===true&&e.value.hinted===false).at(-1)?.at??null,evidence:evidence(rows)})).filter(w=>w.sample>=2&&(w.again>=2||w.hinted>=2)).sort((a,b)=>b.again-a.again||b.hinted-a.hinted||a.word_id.localeCompare(b.word_id));
  return {metadata:meta,window,min_sample:2,words:words.slice(0,args.limit??10),total_candidates:words.length,missing:words.length===0?'No repeated-failure candidate meets the sample rule; this does not mean all words are mastered.':undefined};
 }
 if(name==='get_word_history'){
  const id=args.word_id.trim().toLowerCase().normalize('NFKC'),key='word:'+id,rows=events.filter(e=>e.key===key),undone=new Set(events.filter(e=>e.kind==='undo').map(e=>e.value.id));
   return {metadata:meta,word_id:id,known_word:catalog.some(w=>w.id===id),sample:rows.length,history:rows.slice(-(args.limit??30)).map(e=>({evidence_id:e.id,at:e.at,kind:e.kind,undone:undone.has(e.id),rating:e.value.rating??null,first_correct:e.value.firstCorrect??null,hinted:e.value.hinted??null,undo_target:e.kind==='undo'?e.value.id:undefined})),card:cards.get(key)??null,manual_mastered:mastered.get(key)??false,missing:rows.length===0?'No committed observations for this word; do not infer mastery.':undefined};
 }
 const unfinished=(snapshot.checkpoints||[]).filter(cp=>cp.key==='english'&&cp.value.index<cp.value.queue.length).sort((a,b)=>b.at-a.at)[0];
 if(unfinished)return {metadata:meta,minutes:args.minutes??15,action:'resume',session:{id:unfinished.id,index:unfinished.value.index,revision:unfinished.revision},writes:false};
 const layer=snapshot.settings?.layer?.value??'core',size={core:1200,high:2444,full:catalog.length}[layer],eligible=catalog.slice(0,size).filter(w=>!mastered.get('word:'+w.id)),ids=new Set(eligible.map(w=>w.id));
 const selectedDue=due.filter(id=>ids.has(id)),wrong=recentWrongWordIds(events,ids,{now}),newIds=eligible.filter(w=>!grouped.has('word:'+w.id)).map(w=>w.id),budget=Math.max(1,Math.floor((args.minutes??15)*60/45));
 const plan=createSmartSession({id:'preview-only',dueIds:selectedDue.slice(0,budget),wrongIds:wrong.slice(0,budget),newIds:newIds.slice(0,budget),newLimit:Math.min(snapshot.settings?.newWordLimit?.value??12,budget),now});
 return {metadata:meta,minutes:args.minutes??15,action:'preview',words:[...new Set(plan.queue)].slice(0,budget),priority:'due, recent wrong, then new',writes:false,time_estimate:'Conservative planning assumption of about 45 seconds per word; no measured timing sample exists.'};
}
