import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@phosphor-icons/web/regular';
import './style.css';
import './english-detail.css';
import './english-experience.css';
import {articles,authors,works,questions,words} from './content.js';
import {latest,activeEvents,reviewCard,nextReview,localDay,dueKeys,spellingMatches,intervalLabel,newId} from './core.js';
import {store,record,save,local,ready,createEvent,commitLearning,setLearningSetting,localSnapshot,adoptCheckpoint,resolveConflict,recoverySnapshots} from './storage.js';

import {configured,cloud,login,logout,syncNow} from './cloud/client.js';
import {importEvents,exportState} from './backup.js';
import {buildEnglishQueue,recentWrongWordIds} from './english/queue.js';
import {displayVariants,wordLearningState} from './english/status.js';
import {formatExchange,formatPartOfSpeech} from './english/lexicon.js';
import {englishDailyStats} from './english/stats.js';
import {hasUnfinishedEnglishSession,markEnglishSessionHinted,pendingEnglishWordIds,recordEnglishFirstAttempt} from './english/session.js';
import {
  DEFAULT_ENGLISH_MODE,
  DEFAULT_ENGLISH_NEW_WORD_LIMIT,
  ENGLISH_LIST_LIMITS,
  ENGLISH_MAX_SESSION_WORDS,
  ENGLISH_MODES,
  ENGLISH_NEW_WORD_LIMITS,
  ENGLISH_STORAGE_KEYS,
  ENGLISH_TTS,
  englishModeDescription,
  englishModeLabel
} from './english/config.js';
import {isWordKey,wordIdFromKey,wordKey} from './english/keys.js';
import {createSmartSession,isSmartSession,stepMode,stepKind,sessionProgress,englishStepEvent,completeEnglishStep,undoEnglishStep,englishSessionStats} from './english/smart.js';
import {initializeVocabulary,getVocabularyState,activeLearningIds,changeEnglishLayer,findEnglishWord,searchEnglishWords,DATASET_PAGE} from './english-vocab.js';
import {ENGLISH_LAYERS,englishLayerLimit} from './english/config.js';

await ready;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name)=>`<i class="ph ph-${name}" aria-hidden="true"></i>`;
const btn=(action,text,cls='',attrs='')=>`<button data-action="${action}" class="${cls}" ${attrs}>${text}</button>`;
const link=(hash,text,cls='')=>`<a href="#${hash}" class="${cls}">${text}</a>`;
const app=$('#app'),panel=$('#panel');
let theme=local.getItem('wenyan-theme')||'system';
let readingSize=Number(local.getItem('wenyan-font-size')||18);
let readingFamily=local.getItem('wenyan-reading-family')||'serif';
let lineHeight=Number(local.getItem('wenyan-line-height')||1.85);
let autoVoice=local.getItem('wenyan-voice')==='on';
const savedEnglishMode=local.getItem(ENGLISH_STORAGE_KEYS.mode);
let currentRead=null,mode=Object.hasOwn(ENGLISH_MODES,savedEnglishMode)?savedEnglishMode:DEFAULT_ENGLISH_MODE,wordFilter='all';
let phase='input',typed='',hinted=false,audioPlayed=false,paused=false,composing=false,busy=false,lastEvent=null;
let session=latest(store.events,'session','english')||null,litSession=latest(store.events,'session','literature')||null,litShown=false,litHint=false;
lastEvent=store.facts.find(e=>e.id===session?.results?.at(-1)?.eventId)||null;
let timer=null,readTimer=null,backupUrl=null;
let newWordLimit=Number(store.settings.newWordLimit?.value||local.getItem('wenyan-english-new-limit'))||DEFAULT_ENGLISH_NEW_WORD_LIMIT;
if(!ENGLISH_NEW_WORD_LIMITS.includes(newWordLimit))newWordLimit=DEFAULT_ENGLISH_NEW_WORD_LIMIT;
let panelReturnFocus=null;
function preference(key,value){try{local.setItem(key,value);}catch{toast('设置未能保存到本机');}}
async function persistSession(){if(session)await record('session','english',session);}
async function persistLit(){if(litSession)await record('session','literature',litSession);}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
function route(){return (location.hash.slice(1)||'today').split('/');}
function go(path){if(location.hash==='#'+path)render();else location.hash=path;}
function saveLabel(){return store.status==='conflict'?'进度需要选择':store.status==='error'?'同步需要处理':store.problem?'保存需要处理':store.status==='synced'?'已同步':store.status==='syncing'?'正在同步':store.status==='auth'?'需要登录':store.status==='offline'?'离线 · 本机已保存':store.outbox.length&&store.owner?'本机已保存 · 待同步':'本机已保存';}
function applyTheme(){document.documentElement.dataset.theme=theme;document.documentElement.style.setProperty('--reading-size',readingSize+'px');document.documentElement.style.setProperty('--reading-leading',lineHeight);document.documentElement.dataset.reading=readingFamily;}
function statusHTML(){return btn('settings',`${icon('hard-drive')}<span>${saveLabel()}</span>`,'sync-status');}
function nav(active){return [['today','house','今日'],['english','text-aa','英语'],['literature','book-open','知识'],['training','keyboard','训练']].map(([path,glyph,label])=>link(path,icon(glyph)+`<span>${label}</span>`,active===path?'nav-item active':'nav-item')).join('');}
function shell(content,active='today',focus=false){
 app.className=focus?'focus-app':'workstation';
 app.innerHTML=`${focus?'':`<aside class="rail"><a class="brand" href="#today">Wenyan</a><nav aria-label="主要导航">${nav(active)}</nav>${btn('search',icon('magnifying-glass')+'<span>搜索</span>','nav-item search-nav')}<div class="rail-foot">${statusHTML()}${btn('settings',icon('sliders-horizontal')+'<span>偏好与备份</span>','nav-item')}</div></aside>`}<main id="main" tabindex="-1">${store.problem?`<div class="save-warning" role="alert">${esc(store.problem)} ${btn('export','导出备份','text-button')}</div>`:''}${content}</main>${focus?'':`<nav class="mobile-nav" aria-label="主要导航">${nav(active)}</nav>`}`;
 applyTheme();document.title=`Wenyan · ${({today:'今日',literature:'知识',training:'训练',english:'英语'})[active]}`;
}
function dayText(){return new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date()).replace('日','日 · ');}
function resume(){return latest(store.events,'reading','resume')||{article:'narrative',section:0,paragraph:0};}
function done(id){return latest(store.events,'task',localDay()+':'+id)?.done||false;}
function wordFlagMap(kind){const map=new Map();for(const e of activeEvents(store.events))if(e.kind===kind&&isWordKey(e.key))map.set(wordIdFromKey(e.key),Boolean(latest(store.events,kind,e.key)?.on));return map;}
function wordCounts(){
 const active=activeEvents(store.events),mastered=wordFlagMap('mastered'),eligible=words.filter(w=>!mastered.get(w.id)),eligibleIds=new Set(eligible.map(w=>w.id));
 const reviewed=new Set(active.filter(e=>e.kind==='review'&&isWordKey(e.key)).map(e=>e.key));
 const due=[],fresh=[];const now=Date.now(),learningIds=activeLearningIds();
 for(const w of eligible){const key=wordKey(w.id);if(!reviewed.has(key)){if(learningIds.has(w.id))fresh.push(w);continue;}const card=reviewCard(store.events,key);if(card.due.getTime()<=now)due.push(w);}
 const byId=new Map(eligible.map(w=>[w.id,w])),wrong=recentWrongWordIds(store.events,eligibleIds).map(id=>byId.get(id)).filter(Boolean);
 return {due,new:fresh,wrong};
}
async function toggleTask(id){lastEvent=await record('task',localDay()+':'+id,{done:!done(id)});render();toast('已更新 · 可撤销');}
function taskRow(id,title,sub,path){return `<div class="task-row ${done(id)?'complete':''}">${btn('task',icon(done(id)?'check-circle':'circle'),'task-check',`data-id="${id}" aria-label="${done(id)?'撤销完成':'标记完成'}：${esc(title)}"`)}${link(path,`<span>${esc(title)}</span><span class="task-meta">${esc(sub)} ${icon('caret-right')}</span>`,'task-link')}</div>`;}
function dailyPlan(counts=wordCounts()){
 const daily=englishDailyStats(store.events),remaining=Math.max(0,newWordLimit-daily.newLearned);
 const plan=createSmartSession({dueIds:counts.due.map(w=>w.id),wrongIds:counts.wrong.map(w=>w.id),newIds:counts.new.map(w=>w.id),newLimit:remaining});
 return {counts,daily,plan,newCount:new Set(plan.queue.filter((id,i)=>plan.steps[i]==='e')).size,progress:sessionProgress(hasUnfinishedEnglishSession(session)?session:plan)};
}
function startLabel(progress,unfinished=false){return unfinished?`继续学习 · ${progress.completed} / ${progress.total}`:`开始 ${progress.total} 词`;}
function estimatedMinutes(plan){return Math.max(1,Math.round([...plan.steps||''].reduce((sum,step)=>sum+(step==='e'?12:20),0)/60));}
function today(){
 const p=resume(),article=articles.find(a=>a.id===p.article)||articles[0],section=Math.min(p.section,article.sections.length-1);
 const {counts,plan,newCount,progress}=dailyPlan(),unfinished=hasUnfinishedEnglishSession(session),hasEnglish=unfinished||plan.queue.length>0;
 const subtitle=`${counts.due.length} 个到期 · ${counts.wrong.length} 个错词${newCount?` · 今日建议 ${newCount} 个新词`:''}`;
 const title=unfinished?'英语 · 继续学习':counts.due.length?'英语 · 今日复习':counts.wrong.length?'英语 · 回忆错词':'英语 · 今日新词';
 const primary=hasEnglish?btn(unfinished?'resume-words':'start-smart',startLabel(progress,unfinished)+' <kbd>Enter</kbd>','primary'):link(`read/${article.id}/${section}`,'继续阅读 <kbd>Enter</kbd>','button primary');
 shell(`<section class="today-page"><header class="page-heading"><h1>今日</h1><span class="muted">${dayText()}</span></header><h2 class="section-label">接着学</h2><div class="resume-block"><div><h2>${hasEnglish?title:esc(article.title)}</h2><p class="muted">${hasEnglish?subtitle:'英语今日任务已完成 · '+esc(article.sections[section].title)}</p></div><div class="resume-actions">${primary}${hasEnglish?link('english','查看英语安排','text-button'):''}</div></div><h2 class="section-label next-label">${hasEnglish?'留一点时间阅读':'其他学习'}</h2><div class="task-list">${taskRow('reading',article.title,'继续阅读',`read/${article.id}/${section}`)}${taskRow('contemporary','当代文学 · 先锋小说','约 8 分钟','read/avant-garde/0')}${taskRow('recall','背诵 · 名词解释与简答','要点回忆','recall/narrative')}${!hasEnglish?taskRow('english','英语 · 自由练习','词表与练习','english'):''}</div>${litSession&&litSession.index<litSession.queue.length?link('recall/'+litSession.article+'/'+(litSession.selection||''),`继续未完成回忆 · ${litSession.index} / ${litSession.queue.length}`,'text-link'):''}<p class="keyboard-note">Enter 开始 · ↑↓ 选择 · / 搜索</p></section>`);
}

function literature(){shell(`<section class="library-page"><header class="page-heading"><h1>知识</h1>${btn('search',icon('magnifying-glass')+' 搜索','text-button')}</header><p class="muted lead">阅读、作品与回忆练习</p><h2 class="section-label">现当代文学</h2><div class="index-list">${articles.map(a=>link(`read/${a.id}/0`,`<div><span class="eyebrow">${a.period}</span><h2>${esc(a.title)}</h2><p class="muted">${esc(a.summary)}</p></div>${icon('arrow-up-right')}`,'index-row')).join('')}</div><h2 class="section-label">作家与作品</h2><div class="index-list">${authors.map(a=>link('author/'+a.id,`<div><h2>${a.name}</h2><p class="muted">${a.years} · ${a.genres}</p></div>${icon('caret-right')}`,'index-row')).join('')}</div><h2 class="section-label">回忆练习</h2><div class="index-list">${questions.map(q=>link('recall/'+q.article+'/'+q.id,`<div><span class="eyebrow">${q.type}</span><h2 class="small-heading">${esc(q.prompt)}</h2></div>${icon('caret-right')}`,'index-row')).join('')}</div><p class="source-note">当前为自编学习样本，内容来源可在阅读页查看。旧版资料保留在旧版页面。</p><a href="/legacy/index.html" class="text-link">打开旧版资料</a></section>`,'literature');}
function authorPage(id){const a=authors.find(x=>x.id===id);if(!a)return go('literature');shell(`<section class="detail-page">${link('literature',icon('arrow-left')+' 文学','back-link')}<h1>${a.name}</h1><p class="muted">${a.years} · ${a.genres}</p><p class="detail-intro">${a.intro}</p><h2 class="section-label">作品</h2><div class="index-list">${a.works.map(id=>{const w=works.find(x=>x.id===id);return link('work/'+id,`<div><h2>${w.title}</h2><p class="muted">${w.meta}</p></div>${icon('caret-right')}`,'index-row');}).join('')}</div><h2 class="section-label">相关阅读</h2>${link('read/narrative/0','鲁迅小说的叙事艺术 '+icon('arrow-up-right'),'reading-link')}<a class="source-note text-link" href="${a.source}" target="_blank" rel="noopener">生平与作品资料 · 上海鲁迅纪念馆</a></section>`,'literature');}
function workPage(id,context){const w=works.find(x=>x.id===id);if(!w)return go('literature');shell(`<section class="detail-page">${context==='from-read'?btn('return-read',icon('arrow-left')+' 返回阅读','back-link'):link('author/'+w.author,icon('arrow-left')+' 鲁迅','back-link')}<h1>${w.title}</h1><p class="muted">${w.meta}</p><p class="detail-intro">${w.intro}</p><a href="${w.source}" target="_blank" rel="noopener" class="text-link">阅读原文 · 维基文库 ${icon('arrow-up-right')}</a><h2 class="section-label">相关练习</h2>${questions.slice(1).map(q=>link('recall/narrative/'+q.id,`<span>${q.type}</span> ${esc(q.prompt)} ${icon('caret-right')}`,'related-row')).join('')}</section>`,'literature');}
function readPage(id,num){
 const a=articles.find(x=>x.id===id);if(!a)return go('literature');const index=Math.max(0,Math.min(Number(num)||0,a.sections.length-1)),sec=a.sections[index];
 const saved=resume();const restore=saved.article===id&&saved.section===index?saved.paragraph:0;
 currentRead={article:id,section:index,paragraph:restore};
 if(saved.article!==id||saved.section!==index)record('reading','resume',currentRead).catch(()=>{});
 shell(`<header class="focus-header">${link('literature',icon('arrow-left')+' 返回','back-link')}<span class="breadcrumb">${a.period} / ${a.author?'鲁迅 / ':''}阅读</span><div>${btn('toc','目录','text-button')}${btn('appearance','Aa','text-button')}</div></header><div id="remote-position"></div><article class="reading-page"><h1>${esc(a.title)}</h1><h2 class="chapter-heading">${String(index+1).padStart(2,'0')} &nbsp; ${esc(sec.title)}</h2>${sec.paragraphs.map((p,i)=>`<p class="reading-paragraph" id="paragraph-${i}">${esc(p)}</p>`).join('')}${sec.work?link('work/'+sec.work+'/from-read','查阅《孔乙己》 '+icon('arrow-up-right'),'text-link inline-work'):''}<details class="source-note"><summary>内容来源</summary><p>${esc(a.source)}</p>${a.author?`<a href="https://zh.wikisource.org/zh-hans/孔乙己" target="_blank" rel="noopener">《孔乙己》原文</a>`:''}</details><footer class="reading-footer">${index?link(`read/${id}/${index-1}`,icon('arrow-left')+' 上一节','text-button'):'<span></span>'}<div class="section-progress"><progress value="${index+1}" max="${a.sections.length}" aria-label="小节位置"></progress><span class="muted">本节 ${index+1} / ${a.sections.length}</span>${questions.some(q=>q.article===id&&q.section===index)?link('recall/'+id+'/section-'+index,'练习本节','button primary'):btn('finish-reading','完成阅读','primary')}</div>${index<a.sections.length-1?link(`read/${id}/${index+1}`,'下一节 '+icon('arrow-right'),'text-button'):btn('finish-reading','完成阅读','text-button')}</footer></article>`,'literature',true);
 requestAnimationFrame(()=>{const p=$('#paragraph-'+restore);if(restore>0)p?.scrollIntoView({block:'start'});});
}
function litStart(article,id){let pool=questions.filter(q=>q.article===article);if(id?.startsWith('section-'))pool=pool.filter(q=>q.section===Number(id.slice(8)));else if(id)pool=pool.filter(q=>q.id===id);else pool=pool.filter(q=>q.type!=='论述').sort((a,b)=>reviewCard(store.events,'lit:'+a.id).due-reviewCard(store.events,'lit:'+b.id).due).slice(0,3);litSession={article,selection:id||'',queue:pool.map(q=>q.id),index:0,results:[]};persistLit();}
function recallPage(article,id){
 if(!litSession||litSession.article!==article||(id||'')!==(litSession.selection||''))litStart(article,id);
 const q=questions.find(x=>x.id===litSession.queue[litSession.index]);litShown=false;litHint=false;busy=false;
 if(!q)return litResults();
 shell(`<header class="focus-header">${link('read/'+article+'/'+(currentRead?.article===article?currentRead.section:q.section),icon('arrow-left')+' 返回阅读','back-link')}<span>${q.type} · 回忆练习</span><span class="muted">${litSession.index+1} / ${litSession.queue.length}</span></header><section class="recall-page"><h1>${esc(q.prompt)}</h1><p class="muted recall-instruction">先在心里回答，也可以记一个提纲。</p><div class="outline-toggle">${btn('outline-toggle','记录自己的提纲（可选）','text-button')}</div><textarea hidden id="outline" aria-label="自己的回答提纲（可不填写）" placeholder="自己的提纲（可不填写）" rows="3"></textarea><div id="lit-answer"></div><div id="lit-actions">${btn('lit-show','查看参考提纲 <kbd>Space</kbd>','primary')}</div><p class="source-note">自编练习 · 展开后再对照关键点自评</p></section>`,'literature',true);
}
function showLit(){litShown=true;const q=questions.find(x=>x.id===litSession.queue[litSession.index]);$('#lit-answer').innerHTML=`<p class="eyebrow">示例提纲</p><ol>${q.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ol><p class="muted">核对必要要点和作品例证，再评价刚才的回忆。</p>`;$('#lit-actions').innerHTML=`${btn('lit-rate','没想起 <kbd>1</kbd>','', 'data-rating="1"')}${btn('lit-rate','想起来了 <kbd>2</kbd>','primary','data-rating="3"')}`;$('#lit-actions button').focus();}
async function rateLit(rating){if(!litShown||busy)return;busy=true;const q=questions.find(x=>x.id===litSession.queue[litSession.index]);lastEvent=await record('review','lit:'+q.id,{rating});litSession.results.push({id:q.id,rating,eventId:lastEvent.id});litSession.index++;await persistLit();render();busy=false;}
function litResults(){shell(`<section class="results-page">${link('today',icon('arrow-left')+' 今日','back-link')}<h1>本次回忆完成</h1><p class="muted">${litSession.results.length}题 · 需要再想${litSession.results.filter(r=>r.rating===1).length}题</p><div class="result-list">${litSession.results.map(r=>{const q=questions.find(q=>q.id===r.id);return `<div class="result-row"><span>${esc(q.prompt)}</span><span class="muted">${intervalLabel(reviewCard(store.events,'lit:'+r.id).due)}</span></div>`;}).join('')}</div>${litSession.results.some(r=>r.rating===1)?btn('lit-retry','再练需要回忆的题','primary'):btn('lit-new','再练本组','primary')}${btn('undo','撤销上次评价','text-button',lastEvent?'':'disabled')}${link('today','回到今日','text-link')}</section>`,'literature');recordTaskOnce('recall');}
function recordTaskOnce(key){if(!done(key))record('task',localDay()+':'+key,{done:true}).catch(()=>{});}
function training(){shell(`<section class="library-page"><header class="page-heading"><h1>训练</h1>${btn('settings',icon('sliders-horizontal')+' 偏好','text-button')}</header><p class="muted lead">先自己回忆或作答，再核对要点。</p><div class="index-list">${link('english','<div><h2>英语词汇</h2><p class="muted">今天学习 · 自由练习 · 错词订正</p></div>'+icon('caret-right'),'index-row')}${articles.map(a=>link('recall/'+a.id,`<div><h2>${esc(a.title)}</h2><p class="muted">要点回忆 · 名词解释 · 简答</p></div>${icon('caret-right')}`,'index-row')).join('')}${questions.filter(q=>q.type==='论述').map(q=>link('recall/'+q.article+'/'+q.id,`<div><span class="eyebrow">论述练习</span><h2 class="small-heading">${esc(q.prompt)}</h2></div>${icon('caret-right')}`,'index-row')).join('')}</div><p class="source-note">当前为自编样本。院校真题下一阶段接入。</p></section>`,'training');}
function layerOptions(){const meta=getVocabularyState();return Object.entries(ENGLISH_LAYERS).map(([id,info])=>`<option value="${id}" ${meta.layer===id?'selected':''}>${info.label} · ${englishLayerLimit(id,meta.total)} 词</option>`).join('');}
function sourceInfo(){
 const meta=getVocabularyState();
 return `<details class="source-note vocabulary-source source-info"><summary>考研词库 · ${meta.total} <span>来源与许可</span></summary><p>词频与释义：<a href="${DATASET_PAGE}" target="_blank" rel="noopener">NETEMVocabulary</a> · CC BY-NC-SA 4.0。固定 commit <code>${esc(meta.sourceCommit)}</code>。上游 ${meta.sourceCount} 行，经大小写规范化、重复义项合并后为 ${meta.total} 个稳定词条。</p><p>音标与词形：<a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noopener">ECDICT</a> · MIT。固定 commit <code>${esc(meta.lexiconSource?.commit||'82c9872576b23118d7c42e920c11beb77f510ae2')}</code>；覆盖 ${meta.phoneticCount} 词音标、${meta.exchangeCount} 词词形。只提取结构化字段，不替换中文释义、不导入词典正文或例句。</p><p>当前范围：${meta.active} 词；兼容保留 ${meta.compatibility} 词；续学保留 ${meta.carryover} 词。${meta.bundled?'使用随应用保存的快照。':'使用固定版本回退数据。'}</p></details>`;
}
function english(){
 const {counts,daily,plan,newCount,progress}=dailyPlan(),meta=getVocabularyState(),hasSession=hasUnfinishedEnglishSession(session),wrongIds=new Set(counts.wrong.map(w=>w.id));
 const favorites=wordFlagMap('favorite'),mastered=wordFlagMap('mastered');
 const list=words.filter(w=>wordFilter==='favorites'?favorites.get(w.id):wordFilter==='mastered'?mastered.get(w.id):wordFilter==='wrong'?wrongIds.has(w.id):true);
 const displayLimit=wordFilter==='all'?ENGLISH_LIST_LIMITS.all:ENGLISH_LIST_LIMITS.filtered,visible=list.slice(0,displayLimit),hiddenCount=Math.max(0,list.length-visible.length);
 const unavailable=meta.status==='loading',available=hasSession||plan.queue.length>0;
 shell(`<section class="english-page"><header class="page-heading"><h1>英语</h1><span class="muted">${meta.status==='ready'?`考研词库 · ${meta.total}`:unavailable?'正在准备词库':'兼容词组'}</span></header><div class="english-entry"><div class="learning-intent"><p class="session-context">${counts.due.length} 个到期 · ${counts.wrong.length} 个错词 · 今日建议 ${newCount} 个新词</p><h2>${hasSession?'继续今天的学习':available?'今天，从这一组开始':'今天的学习已完成'}</h2><p class="muted session-estimate">${hasSession?`已保存进度 · ${isSmartSession(session)?'按记忆状态安排':'自由'+englishModeLabel(session.mode)}`:available?`预计约 ${estimatedMinutes(plan)} 分钟 · 系统安排复习与新词`:'复习会在到期时回来，也可以自由练习。'}</p><div class="start-actions">${hasSession?btn('resume-words',startLabel(progress,true)+' <kbd>Enter</kbd>','primary'):btn('start-smart',startLabel(progress)+' <kbd>Enter</kbd>','primary',available&&!unavailable?'':'disabled')}</div></div><aside class="learning-note"><span class="eyebrow">${hasSession?'回到当前词':'先回忆，再确认'}</span><p>${hasSession?'当前词的提示和首次作答都已保存。':'到期词直接回忆。新词先熟悉拼写，再隔几个词默写一次。'}</p></aside></div>${meta.status==='sample'?'<p class="source-note" role="status">考研词库暂未载入，兼容词组可继续使用。学习记录已保留。</p>':''}<div class="english-secondary"><details class="learning-options"><summary>学习安排 <span>${ENGLISH_LAYERS[meta.layer].label} · 每日 ${newWordLimit} 个新词</span></summary><div class="options-controls"><label class="small-control">每日新词目标 <select id="new-limit">${ENGLISH_NEW_WORD_LIMITS.map(value=>`<option value="${value}" ${value===newWordLimit?'selected':''}>${value} 个</option>`).join('')}</select></label><label class="small-control">词库范围 <select id="vocab-layer">${layerOptions()}</select></label></div><p class="source-note">到期与错词优先；每组会为新词回忆和错词回流留出位置。</p></details><details class="free-practice"><summary>自由练习 <span>跟打 · 默写 · 听写</span></summary><div class="mode-tabs" role="group" aria-label="自由练习模式">${Object.entries(ENGLISH_MODES).map(([id,info])=>btn('mode',info.label,mode===id?'active':'',`data-mode="${id}" aria-pressed="${mode===id}"`)).join('')}</div><p class="mode-description muted">${englishModeDescription(mode)} ${mode==='follow'?'跟打只记录拼写练习。':'自评会用于安排复习。'}</p>${hasSession?'<p class="muted">完成当前组后，再开始自由练习。</p>':btn('start-words','开始'+englishModeLabel(mode),'',counts.due.length+counts.wrong.length+counts.new.length&&!unavailable?'':'disabled')}</details></div><div class="daily-feedback" aria-label="今日英语学习反馈"><span>今日</span><span>新学 ${daily.newLearned}</span><span>主动回忆 ${daily.reviewed}</span>${daily.firstCorrectRate!=null?`<span>首次正确 ${daily.firstCorrectRate}%</span>`:''}${daily.spellingErrors?`<span>拼写订正 ${daily.spellingErrors}</span>`:''}</div><div class="vocabulary-heading"><h2 class="section-label vocabulary-label">词表</h2>${btn('search',icon('magnifying-glass')+' 查找单词 <kbd>/</kbd>','text-button')}</div><div class="filter-tabs">${[['all','全部'],['wrong','错词'],['favorites','收藏'],['mastered','已掌握']].map(([id,name])=>btn('word-filter',name,wordFilter===id?'text-button active':'text-button',`data-filter="${id}" aria-pressed="${wordFilter===id}"`)).join('')}</div><div class="vocabulary-list">${visible.length?visible.map(w=>btn('word-detail',`<span class="word-small">${esc(w.word)}</span><span class="muted">${esc(w.meaning)}</span>`,'vocabulary-row',`data-word="${esc(w.id)}"`)).join(''):'<p class="muted empty-vocabulary">这里还没有单词。</p>'}</div>${hiddenCount?`<p class="list-note muted">显示前 ${visible.length} 个 · / 搜索全部词库</p>`:''}${sourceInfo()}</section>`,'english');
}

async function startSmart(){
 if(hasUnfinishedEnglishSession(session)){go('train');return;}
 if(getVocabularyState().status==='loading'){toast('词库准备好后即可开始');return;}
 const {plan}=dailyPlan();if(!plan.queue.length){toast('今天的学习已完成');return;}
 session={...plan,id:newId()};await persistSession();go('train');
}
async function startWords(){
 if(hasUnfinishedEnglishSession(session)){toast('先继续未完成词组');go('train');return;}
 const c=wordCounts(),queue=buildEnglishQueue({dueIds:c.due.map(w=>w.id),wrongIds:c.wrong.map(w=>w.id),newIds:c.new.map(w=>w.id),newLimit:newWordLimit,maxTotal:ENGLISH_MAX_SESSION_WORDS});if(!queue.length){toast('当前没有待学习单词');return;}
 session={id:newId(),mode,queue,index:0,results:[],startedAt:Date.now()};await persistSession();go('train');
}

function train(){
 if(!session)return go('english');if(session.index>=session.queue.length)return go('results');
 const w=findEnglishWord(session.queue[session.index]);if(!w){const status=getVocabularyState().status;if(status==='loading'){shell(`<section class="training-page"><h1>正在准备词库</h1><p class="muted">未完成词组已保留，载入后继续。</p></section>`,'english',true);return;}shell(`<section class="training-page"><h1>这个词暂时未能载入</h1><p class="muted">续学位置已保留，可以返回后重试。</p>${link('english','返回英语','button primary')}</section>`,'english',true);return;}
 const currentMode=stepMode(session),progress=sessionProgress(session),smart=isSmartSession(session);
 phase=session.current?.phase||(session.current?.firstCorrect===false?'correction':'input');typed='';hinted=Boolean(session.current?.hinted);audioPlayed=false;paused=false;composing=false;busy=false;
 const reveal=currentMode==='follow'||phase!=='input'||hinted;
 const stage=reveal?wordStage(w):currentMode==='recall'?`<h1 class="recall-meaning">${esc(w.meaning)}</h1><p class="muted">回忆并输入英文</p>`:`${btn('speak',icon('speaker-high'),'audio-prompt','aria-label="播放本题发音"')}<p class="muted">听发音，写单词</p>`;
 const stepLabel=smart?stepKind(session)==='e'?'认识新词':stepKind(session)==='x'?'再回忆一次':'主动回忆':englishModeLabel(currentMode);
 shell(`<header class="focus-header training-header">${btn('exit-training',icon('arrow-left')+' 返回','back-link')}<span>${smart?'今日学习 · ':''}${stepLabel}</span>${btn('pause','暂停 <kbd>Esc</kbd>','text-button')}</header><section class="training-page"><div class="training-word-tools">${btn('favorite-word',icon(wordFlagMap('favorite').get(w.id)?'bookmark-simple':'bookmark-simple')+' 收藏','text-button',`data-word="${esc(w.id)}" aria-pressed="${Boolean(wordFlagMap('favorite').get(w.id))}"`)}${btn('mastered-word','已掌握','text-button',`data-word="${esc(w.id)}" aria-pressed="${Boolean(wordFlagMap('mastered').get(w.id))}"`)}</div><div class="word-stage" id="word-stage">${stage}</div><div class="training-input-area"><form id="word-form" autocomplete="off"><label class="sr-only" for="word-input">输入完整英文单词</label><input id="word-input" type="text" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" aria-describedby="input-feedback" ${phase==='rating'?'readonly':''} /><div id="input-feedback" class="input-feedback ${phase==='correction'?'is-error':''}" aria-live="polite">${phase==='correction'?'拼写需要订正，请从首字母完整输入一次。':hinted?'已用提示，本次需要再想':currentMode==='follow'?'完整输入，熟悉拼写':'输入后按 Enter 提交'}</div><div id="word-actions" ${phase==='rating'?'hidden':''}><button type="submit" class="submit-word">提交 <kbd>Enter</kbd></button>${currentMode!=='listen'?btn('speak',icon('speaker-high'),'icon-button','aria-label="播放发音"'):''}${currentMode!=='follow'?btn('hint','提示','text-button'):''}</div></form><div id="memory-actions"></div></div><footer class="training-progress"><div class="progress-line"><progress value="${progress.completed}" max="${progress.total||1}" aria-label="训练进度"></progress><span>${progress.completed} / ${progress.total} 词</span></div><span class="keyboard-note">${phase==='rating'?'Enter 继续 · 1 没想起 · 2 想起来了':'Space 发音 · H 提示（离开输入框时）'} · Esc 暂停</span></footer></section>`,'english',true);
 $('#word-input').addEventListener('compositionstart',()=>composing=true);
 $('#word-input').addEventListener('compositionend',()=>{composing=false;inputChanged();});
 $('#word-input').addEventListener('input',inputChanged);
 $('#word-form').addEventListener('submit',e=>{e.preventDefault();mutate(submitWord);});
 if(phase==='rating'){ $('#word-input').value=w.word;ratingActions(); }
 else $('#word-input').focus();
 if((autoVoice&&currentMode==='follow')||currentMode==='listen')speak(w.word);
 updateViewport();
}
function wordStage(w){return `<h1 class="word-display">${esc(w.word)}</h1><p class="ipa">${esc(w.ipa)}</p><p class="meaning">${esc(w.meaning)}</p>`;}
function inputChanged(){
 typed=$('#word-input')?.value||'';if(composing||!['input','correction'].includes(phase)||stepMode(session)!=='follow')return;
 const w=findEnglishWord(session.queue[session.index]),wrong=[...typed].some((c,i)=>c.toLowerCase()!==w.word[i]?.toLowerCase());
 $('#word-input').classList.toggle('has-error',wrong);
 const first=[...typed].findIndex((c,i)=>c.toLowerCase()!==w.word[i]?.toLowerCase());
 $('#input-feedback').innerHTML=wrong?`第 ${first+1} 个字母 <span class="wrong-letter">${esc(typed[first])}</span> 不匹配，提交后完整订正`:'完整输入，熟悉拼写';
 if(spellingMatches(typed,w.word))mutate(submitWord);
}
function revealWord(w){$('#word-stage').innerHTML=wordStage(w);}
function ratingActions(){
 const failed=hinted||(isSmartSession(session)&&session.current?.firstCorrect===false);
 $('#input-feedback').classList.remove('is-error');
 $('#input-feedback').textContent=failed?'订正已完成，稍后再回忆': '核对刚才的回忆，再自评';
 $('#memory-actions').innerHTML=`${btn('word-rate','没想起 <kbd>1</kbd>',failed?'primary':'','data-rating="1"')}${btn('word-rate','想起来了 <kbd>2</kbd>',failed?'':'primary',`data-rating="3" ${failed?'disabled':''}`)}`;
 $('.training-progress .keyboard-note').textContent='Enter 继续 · 1 没想起'+(failed?'':' · 2 想起来了')+' · Esc 暂停';
 $('#memory-actions [data-rating="'+(failed?'1':'3')+'"]').focus();
}
async function submitWord(){
 if(store.problem||composing||paused||busy||!session||phase==='rating')return;
 const w=findEnglishWord(session.queue[session.index]),value=$('#word-input').value,currentMode=stepMode(session);
 if(!value.trim()){toast('先输入完整单词');return;}
 if(currentMode==='listen'&&!audioPlayed&&!hinted){toast('发音尚未播放，可重播或使用提示');return;}
 const correct=spellingMatches(value,w.word);
 if(phase==='input'&&typeof session.current?.firstCorrect!=='boolean')session=recordEnglishFirstAttempt(session,correct,hinted);
 if(!correct){phase='correction';session.current={...session.current,phase};await persistSession();revealWord(w);$('#word-input').value='';$('#word-input').classList.add('has-error');$('#input-feedback').classList.add('is-error');$('#input-feedback').textContent='拼写需要订正，请从首字母完整输入一次。';$('#word-input').focus();return;}
 $('#word-input').classList.remove('has-error');$('#word-input').classList.add('correct');$('#input-feedback').classList.remove('is-error');
 if(currentMode==='follow'){
  busy=true;await persistSession();$('#input-feedback').textContent=isSmartSession(session)?'已熟悉拼写，稍后回忆':'已完成';const index=session.index,id=session.id;
  setTimeout(()=>{if(paused||route()[0]!=='train'||session.id!==id||session.index!==index){busy=false;return;}mutate(()=>advanceWord(null));},140);
 } else {phase='rating';session.current={...session.current,phase};await persistSession();revealWord(w);$('#word-input').readOnly=true;$('#word-actions').hidden=true;ratingActions();}
}
async function advanceWord(rating){
 const id=session.queue[session.index],descriptor=englishStepEvent(session,rating);
 const event=await createEvent(descriptor.kind,wordKey(id),descriptor.value,{sessionId:session.id,attemptId:session.id+':'+session.index+':'+(stepKind(session)||session.mode)+':'+(session.current?.redoOf||'initial')});
 const next=completeEnglishStep(session,event);await commitLearning([event],next);lastEvent=event;session=next;render();
}
async function persistHint(){hinted=true;session=markEnglishSessionHinted(session);await persistSession();}
async function wordHint(){if(phase!=='input'&&phase!=='correction')return;await persistHint();const w=findEnglishWord(session.queue[session.index]);revealWord(w);$('#input-feedback').textContent='已用提示，本次需要再想';}
async function speak(word){
 if(!('speechSynthesis' in window)){toast('当前浏览器不支持发音，可使用提示');return;}
 if(stepMode(session)==='recall'&&route()[0]==='train'&&phase!=='rating')await persistHint();
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(findEnglishWord(word)?.word||word);u.lang=ENGLISH_TTS.language;u.rate=ENGLISH_TTS.rate;
 const voice=speechSynthesis.getVoices().find(v=>v.lang==='en-GB')||speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)u.voice=voice;
 const id=session?.id,index=session?.index;
 u.onstart=()=>{if(session?.id===id&&session?.index===index)audioPlayed=true;};u.onerror=()=>toast('发音未能播放，可重试或使用提示');speechSynthesis.speak(u);
}
function results(){
 if(!session)return go('english');
 const stats=englishSessionStats(session),smart=isSmartSession(session),progress=sessionProgress(session);
 const last=new Map(session.results.filter(r=>r.rating!=null||!smart).map(r=>[r.id,r])),forgot=[...last.values()].filter(r=>r.rating===1||r.hinted||r.firstCorrect===false),wrong=session.results.filter(r=>r.firstCorrect===false);
 shell(`<section class="results-page">${link('english',icon('arrow-left')+' 英语','back-link')}<h1>${smart?'这一组，学完了':session.mode==='follow'?'本次拼写练习完成':'本次复习完成'}</h1><p class="muted result-intro">${progress.total} 个词${smart?' · 下一次复习已安排':session.mode==='follow'?' · 跟打只记录拼写练习':' · 下一次复习已安排'}</p><div class="session-feedback" aria-label="本组学习反馈">${smart?`<span><strong>${stats.newLearned}</strong> 本组新学</span>`:''}<span><strong>${stats.recalled}</strong> 主动回忆</span><span><strong>${stats.firstCorrectRate==null?'—':stats.firstCorrectRate+'%'}</strong> 首次正确</span><span><strong>${stats.corrections}</strong> 拼写订正</span><span><strong>${stats.needsThought}</strong> 需要再想</span></div><div class="result-actions">${link('english','回到学习安排 <kbd>Enter</kbd>','button primary')}${btn('undo','撤销上次评价','text-button',lastEvent?'':'disabled')}</div><h2 class="section-label">${forgot.length?'下次，再想一想':'本组单词'}</h2><div class="result-list">${(forgot.length?forgot:[...last.values()]).map(r=>{const w=findEnglishWord(r.id);return `<div class="result-row">${btn('word-detail',`<span class="word-small">${esc(w?.word||r.id)}</span> <span class="muted">${esc(w?.meaning||'')}</span>`,'text-button',`data-word="${esc(r.id)}"`)}<span class="muted">${r.rating?intervalLabel(reviewCard(store.events,wordKey(r.id)).due):'拼写练习'}</span></div>`;}).join('')}</div>${wrong.length?`<details class="spelling-results"><summary>拼写订正 · ${stats.corrections} 个词</summary><p class="word-small">${[...new Set(wrong.map(r=>r.id))].map(esc).join(' · ')}</p></details>`:''}${forgot.length||wrong.length?btn('retry-words','再练这些词','text-button'):''}${link('today','回到今日','text-link')}</section>`,'english');recordTaskOnce('english');
}

function render(){
 clearTimeout(readTimer);const [view,id,index]=route();if(view!=='read')window.scrollTo(0,0);
 ({today, literature,training,english,author:()=>authorPage(id),work:()=>workPage(id,index),read:()=>readPage(id,index),recall:()=>recallPage(id,index),train,results}[view]||today)();
}
function openPanel(content){
 if(!panel.open)panelReturnFocus=document.activeElement;
 if(backupUrl){URL.revokeObjectURL(backupUrl);backupUrl=null;}
 panel.innerHTML=`<header class="panel-header"><span>Wenyan</span>${btn('close-panel',icon('x'),'icon-button','aria-label="关闭面板"')}</header>${content}`;
 const title=panel.querySelector('h2');if(title){title.id='panel-title';panel.setAttribute('aria-labelledby','panel-title');}
 if(!panel.open)panel.showModal();
}
function closePanel(){
 const previous=panelReturnFocus;
 panel.close();if(paused)paused=false;
 if(['english','today'].includes(route()[0]))render();
 const replacement=previous?.isConnected?previous:[...document.querySelectorAll('button,a')].find(el=>previous&&(previous.dataset.action?el.dataset.action===previous.dataset.action&&el.dataset.word===previous.dataset.word:previous.getAttribute('href')!=null&&el.getAttribute('href')===previous.getAttribute('href')));
 (replacement||$('#word-input')||$('#main'))?.focus();
}

function settings(){openPanel(`<h2>偏好与备份</h2><label>外观 <select id="theme"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">暗色</option></select></label><label class="check-label"><input id="voice" type="checkbox" ${autoVoice?'checked':''}/>训练时自动发音</label><p class="source-note">上班使用建议关闭发音。发音由浏览器提供。</p><hr/><h3>云端学习记录</h3>${configured?`<p role="status">${saveLabel()}</p>${store.cloudError?`<p class="source-note">${esc(store.cloudError)}</p>`:''}<div class="panel-actions">${store.status==='auth'?btn('cloud-login','登录可信电脑'):btn('cloud-sync','立即同步')}${store.owner?btn('cloud-logout','退出云端登录','text-button'):''}</div>${store.conflicts?.length?btn('conflicts','选择冲突进度'):''}`:'<p class="source-note">当前版本尚未启用云端连接，本机学习和备份可正常使用。</p>'}<hr/><h3>本机备份</h3><div class="panel-actions">${btn('export','导出记录')}${btn('import','导入记录')}${btn('import-text','粘贴备份','text-button')}${btn('recovery','查看本机恢复点','text-button')}</div><p class="source-note">记录保存在这台电脑的当前浏览器。导入会合并记录、复习安排和续学位置。建议定期导出一份备份。</p><input id="import-file" type="file" accept="application/json" hidden/>`);$('#theme').value=theme;}

function openConflicts(){const newest=new Map();for(const c of store.conflicts||[])newest.set(c.type==='checkpoint'?c.proposal.id:c.field,c);openPanel(`<h2>选择保留的进度</h2><p>两台电脑分别修改了同一进度。完成的学习记录均已保留，续学位置需要选择。</p>${[...newest.values()].map(c=>`<section><p>${c.type==='checkpoint'?'训练组：本机第 '+(c.proposal.value.index+1)+' 步，云端第 '+((c.remote?.value.index??0)+1)+' 步':'学习设置：'+esc(c.field)}</p><div class="panel-actions">${btn('conflict-cloud','继续云端进度','',`data-id="${esc(c.id)}" ${c.type==='checkpoint'&&!c.remote?'disabled':''}`)}${btn('conflict-local',c.type==='checkpoint'?'本机进度另存为训练组':'保留本机设置','',`data-id="${esc(c.id)}"`)}</div></section>`).join('')}`);}
async function chooseConflict(id,choice){await localSnapshot();await resolveConflict(id,choice);window.dispatchEvent(new Event('wenyan-remote'));await syncNow();settings();}

function appearance(){openPanel(`<h2>阅读外观</h2><label>字号 <input id="font-size" type="range" min="16" max="24" value="${readingSize}"/> <span id="size-label">${readingSize}px</span></label><label>行距 <select id="line-height"><option value="1.65">紧凑</option><option value="1.85">标准</option><option value="2">宽松</option></select></label><label>正文字体 <select id="reading-family"><option value="serif">宋体</option><option value="sans">黑体</option></select></label>`);$('#line-height').value=lineHeight;$('#reading-family').value=readingFamily;}
function toc(){const a=articles.find(a=>a.id===currentRead.article);openPanel(`<h2>章节目录</h2><div class="toc-list">${a.sections.map((s,i)=>link(`read/${a.id}/${i}`,`${String(i+1).padStart(2,'0')} ${esc(s.title)}`,i===currentRead.section?'active':'')).join('')}</div>`);}
function search(){openPanel(`<h2>搜索</h2><label class="sr-only" for="search-input">搜索单词、作家、作品或知识点</label><input type="search" id="search-input" placeholder="单词、作家、作品或知识点"/><div id="search-results"></div><p class="source-note">↑↓ 选择 · Enter 打开 · Esc 返回</p>`);$('#search-input').focus();$('#search-input').addEventListener('input',searchResults);searchResults();}
function searchResults(){
 const text=$('#search-input').value.trim().toLowerCase();
 const items=[...articles.map(a=>({title:a.title,type:a.period,path:'read/'+a.id+'/0'})),...authors.map(a=>({title:a.name,type:'作家',path:'author/'+a.id})),...works.map(w=>({title:w.title,type:'作品',path:'work/'+w.id})),...questions.map(q=>({title:q.prompt,type:q.type,path:'recall/'+q.article+'/'+q.id}))];
 const found=text?items.filter(i=>i.title.toLowerCase().includes(text)):[];
 const englishFound=text?searchEnglishWords(text,ENGLISH_LIST_LIMITS.search):words.slice(0,5);
 $('#search-results').innerHTML=englishFound.map(w=>btn('word-detail',`<span class="word-small">${esc(w.word)}</span><span class="muted">${esc(w.meaning)}</span>`,'search-result',`data-word="${esc(w.id)}"`)).join('')+found.slice(0,10).map(i=>link(i.path,`<span>${esc(i.title)}</span><small>${i.type}</small>`,'search-result')).join('');
 if(!$('#search-results').innerHTML)$('#search-results').innerHTML='<p class="muted">没有匹配内容，试试其他关键词。</p>';
}

function wordDetail(id){
 const w=findEnglishWord(id);if(!w)return;
 const state=wordLearningState(store.events,id),variants=displayVariants(w.variants),pos=formatPartOfSpeech(w.pos),exchange=formatExchange(w.exchange);
 const next=state.state==='mastered'?'已掌握 · 暂不加入复习':state.state==='new'?'第一次主动回忆后，开始安排复习':state.state==='due'?'现在可以复习':state.due?'下次复习：'+intervalLabel(state.due):'';
 const tags=[state.label,state.recentWrong?'近期错词':'',state.favorite?'已收藏':''].filter(Boolean);
 const metadata=[['考研排名',Number.isFinite(w.rank)?'#'+w.rank:''],['词频',w.frequency>0?w.frequency:''],['分类',w.category],['子分类',w.subcategory],['其他拼写',variants],['词性',pos],['词形',exchange],['复习次数',state.reviewCount||'']].filter(([,value])=>value);
 openPanel(`<div class="word-detail"><h2 class="word-small detail-word">${esc(w.word)}</h2><p class="ipa">${esc(w.ipa)}</p><p class="detail-meaning">${esc(w.meaning)}</p><div class="word-detail-meta">${tags.map(tag=>`<span class="${tag==='近期错词'?'is-wrong':''}">${esc(tag)}</span>`).join('')}</div><p class="word-detail-next muted">${esc(next)}</p><div class="panel-actions">${btn('speak',icon('speaker-high')+' 发音','','data-word="'+esc(id)+'"')}${btn('favorite',icon('bookmark-simple')+(state.favorite?' 取消收藏':' 收藏'),'','data-word="'+esc(id)+'" aria-pressed="'+state.favorite+'"')}${btn('mastered',state.mastered?'恢复复习':'已掌握','','data-word="'+esc(id)+'" aria-pressed="'+state.mastered+'"')}</div><details class="word-detail-more"><summary>更多信息</summary><dl class="word-detail-grid">${metadata.map(([label,value])=>`<dt>${label}</dt><dd>${esc(value)}</dd>`).join('')}</dl>${sourceInfo()}<p class="source-note">学习状态来自本机记录。已掌握可随时恢复，不删除复习历史。</p><a class="text-link" href="${esc(w.source)}" target="_blank" rel="noopener">词典核对 ${icon('arrow-up-right')}</a></details></div>`);
}

function exportRecords(){
 const text=JSON.stringify({...exportState(store.events),settings:store.settings,...(store.problem?{unreadableOriginal:store.rawRecords,unreadableLegacySessions:store.legacySessions,...(store.rawRecovery?{unreadableIndexedDB:store.rawRecovery}:{})}:{})},null,2);
 openPanel(`<h2>导出备份</h2><a id="backup-download" class="button primary">下载备份文件</a><details><summary>下载不可用时，复制备份文字</summary><label for="backup-text">完整备份</label><textarea id="backup-text" readonly rows="8" style="width:100%">${esc(text)}</textarea></details><p class="source-note">包含已完成记录、复习安排和续学位置。请妥善保存。</p>`);
 backupUrl=URL.createObjectURL(new Blob([text],{type:'application/json'}));$('#backup-download').href=backupUrl;$('#backup-download').download='Wenyan-学习记录-'+localDay()+'.json';
}
async function importBackup(data){const merged=importEvents(data,store.events);if(!await save(merged,data.settings||{})){toast('未能保存导入记录，请导出当前备份后重试');return;}window.dispatchEvent(new Event('wenyan-remote'));toast('记录已合并，已有训练组保留当前进度');panel.close();window.dispatchEvent(new Event('wenyan-remote'));render();}
const actions={
 'task':el=>toggleTask(el.dataset.id),'five-minutes':async()=>{litSession=null;go('recall/narrative/perspective');}, 'undo':async()=>{if(!lastEvent)return;const previous=lastEvent,id=previous.id;const undo=await createEvent('undo',previous.key,{id});if(session?.results?.at(-1)?.eventId===id){const next=undoEnglishStep(session,id);next.current={...next.current,redoOf:id};await commitLearning([undo],next);session=next;lastEvent=null;go('train');}else{await commitLearning([undo]);lastEvent=null;render();}toast('已撤销，复习安排已恢复');},
 'finish-reading':async()=>{recordTaskOnce(currentRead?.article==='avant-garde'?'contemporary':'reading');toast('阅读已完成');go('today');},'return-read':async()=>{const r=currentRead||resume();go(`read/${r.article}/${r.section}`);},
 'outline-toggle':async()=>{$('#outline').hidden=!$('#outline').hidden;if(!$('#outline').hidden)$('#outline').focus();},'lit-new':async()=>{litStart(litSession.article);render();},'lit-show':showLit,'lit-rate':el=>rateLit(Number(el.dataset.rating)),'lit-retry':async()=>{litSession={...litSession,queue:litSession.results.filter(r=>r.rating===1).map(r=>r.id),index:0,results:[]};await persistLit();render();},
 'mode':async el=>{mode=el.dataset.mode;preference(ENGLISH_STORAGE_KEYS.mode,mode);document.querySelectorAll('[data-action="mode"]').forEach(button=>{button.classList.toggle('active',button.dataset.mode===mode);button.setAttribute('aria-pressed',button.dataset.mode===mode);});$('.mode-description').textContent=englishModeDescription(mode)+(mode==='follow'?' 跟打只记录拼写练习。':' 自评会用于安排复习。');const start=$('[data-action="start-words"]');if(start)start.textContent='开始'+englishModeLabel(mode);},'word-filter':async el=>{wordFilter=el.dataset.filter;english();},'start-smart':startSmart,'start-words':startWords,'resume-words':()=>{adoptCheckpoint(session?.id);go('train');},
 'exit-training':async()=>{paused=true;await persistSession();window.speechSynthesis?.cancel();go('english');},'pause':async()=>{paused=true;busy=false;window.speechSynthesis?.cancel();openPanel(`<h2>已暂停</h2><p class="muted">已完成的单词已保存。继续后回到当前词。</p>${btn('continue-training','继续训练','primary')}${btn('exit-training','结束本次','text-button')}`);},'continue-training':async()=>{paused=false;panel.close();if($('#word-input')?.classList.contains('correct')&&stepMode(session)==='follow')await advanceWord(null);else if(phase==='rating')ratingActions();else $('#word-input')?.focus();},
 'speak':el=>speak(el.dataset.word||session?.queue[session.index]),'hint':wordHint,'word-rate':async el=>{if(phase!=='rating'||busy)return;busy=true;await advanceWord(Number(el.dataset.rating));},
 'retry-words':async()=>{const list=[...new Set(session.results.filter(r=>r.rating===1||r.firstCorrect===false||r.hinted).map(r=>r.id))];if(!list.length)return;session=isSmartSession(session)?createSmartSession({wrongIds:list,id:newId(),newLimit:0}):{id:newId(),mode:session.mode,queue:list,index:0,results:[],startedAt:Date.now()};await persistSession();go('train');},
 'conflicts':()=>openConflicts(),'conflict-cloud':el=>chooseConflict(el.dataset.id,'cloud'),'conflict-local':el=>chooseConflict(el.dataset.id,'local'),'recovery':async()=>{const rows=await recoverySnapshots();openPanel(`<h2>本机恢复点</h2><p class="source-note">最多保留五份。先导出当前记录，再合并恢复点；已存在的训练组保留当前位置。</p>${rows.map(r=>btn('restore-snapshot',esc(new Date(r.exportedAt).toLocaleString()),'',`data-id="${esc(r.id)}"`)).join('')||'<p>暂无恢复点</p>'}`);},'restore-snapshot':async el=>{const rows=await recoverySnapshots();const row=rows.find(r=>r.id===el.dataset.id);if(row)await importBackup(row);},'cloud-sync':()=>syncNow(),'cloud-logout':async()=>{await logout();settings();},'cloud-login':()=>openPanel(`<h2>登录文研</h2><form id="cloud-login-form"><label>邮箱 <input name="email" type="email" autocomplete="username" required></label><label>密码 <input name="password" type="password" autocomplete="current-password" required></label><button type="submit" class="primary">登录这台可信电脑</button><p class="source-note">仅供本人使用。登录后自动续签，离线时仍可继续学习。</p><p id="login-message" role="status"></p></form>`),'settings':settings,'appearance':appearance,'toc':toc,'search':search,'close-panel':closePanel,
 'favorite-word':async el=>{const id=el.dataset.word,on=!latest(store.events,'favorite',wordKey(id))?.on;await record('favorite',wordKey(id),{on});el.setAttribute('aria-pressed',on);toast(on?'已收藏':'已取消收藏');},'mastered-word':async el=>{const id=el.dataset.word,on=!latest(store.events,'mastered',wordKey(id))?.on;await record('mastered',wordKey(id),{on});el.setAttribute('aria-pressed',on);toast(on?'已掌握 · 后续组不再安排这个词':'已恢复复习');},'word-detail':el=>wordDetail(el.dataset.word),'favorite':async el=>{const id=el.dataset.word;await record('favorite',wordKey(id),{on:!latest(store.events,'favorite',wordKey(id))?.on});wordDetail(id);panel.querySelector('[data-action="favorite"]').focus();},'mastered':async el=>{const id=el.dataset.word;await record('mastered',wordKey(id),{on:!latest(store.events,'mastered',wordKey(id))?.on});wordDetail(id);panel.querySelector('[data-action="mastered"]').focus();},
  'export':exportRecords,'import':()=>$('#import-file').click(),'import-text':()=>openPanel(`<h2>导入备份文字</h2><label for="import-text">完整备份</label><textarea id="import-text" rows="8" style="width:100%"></textarea>${btn('import-pasted','合并记录','primary')}`),'import-pasted':async()=>{try{const value=$('#import-text').value;if(value.length>8*1024*1024)throw Error();await importBackup(JSON.parse(value));}catch{toast('备份格式不正确，未修改当前记录');}},
 'remote-use':async()=>{const p=resume();go(`read/${p.article}/${p.section}`);render();},'remote-keep':async()=>{await record('reading','resume',currentRead);$('#remote-position').innerHTML='';}
};
let mutationPending=false;
async function mutate(fn){if(mutationPending)return;mutationPending=true;app.setAttribute('aria-busy','true');try{await fn();}catch(e){session=latest(store.events,'session','english')||null;litSession=latest(store.events,'session','literature')||null;busy=false;const message=store.problem;if(store.errorCode==='LOCAL_WRITER_CONFLICT'){adoptCheckpoint(session?.id);store.problem='';}toast(message||'记录未能保存，本次停在原位置');render();}finally{mutationPending=false;app.setAttribute('aria-busy','false');}}
for(const name of Object.keys(actions)){const action=actions[name];actions[name]=el=>mutate(()=>action(el));}
document.addEventListener('click',e=>{if(e.target.closest('.skip-link')){e.preventDefault();$('#main').focus();return;}const el=e.target.closest('[data-action]');if(el&&!el.disabled){e.preventDefault();actions[el.dataset.action]?.(el);}if(e.target.closest('#panel a[href^="#"]'))panel.close();});
document.addEventListener('submit',async e=>{if(e.target.id!=='cloud-login-form')return;e.preventDefault();const form=e.target;const message=$('#login-message');try{await login(form.elements.email.value,form.elements.password.value);form.elements.password.value='';settings();}catch(error){form.elements.password.value='';message.textContent=error.code==='invalid_credentials'?'邮箱或密码不正确，请使用刚创建的文研学习账户。':error.code==='email_not_confirmed'?'学习账户尚未确认邮箱。':error.status===429?'登录请求过于频繁，请稍后重试。':'暂时无法连接登录服务，请稍后重试。';}});
document.addEventListener('change',e=>{const el=e.target,selectedValue=el.value;void mutate(async()=>{
 if(el.id==='vocab-layer'){el.disabled=true;await setLearningSetting('layer',selectedValue);changeEnglishLayer(selectedValue);if($('#vocab-layer'))$('#vocab-layer').disabled=false;if($('.learning-options')){$('.learning-options').open=true;$('#vocab-layer').focus();}return;}
 if(el.id==='new-limit'){el.disabled=true;await setLearningSetting('newWordLimit',Number(selectedValue));newWordLimit=Number(selectedValue);preference('wenyan-english-new-limit',newWordLimit);english();$('.learning-options').open=true;$('#new-limit').focus();return;}
 if(el.id==='theme'){theme=el.value;preference('wenyan-theme',theme);applyTheme();}if(el.id==='voice'){autoVoice=el.checked;preference('wenyan-voice',autoVoice?'on':'off');}
 if(el.id==='reading-family'){readingFamily=el.value;preference('wenyan-reading-family',readingFamily);applyTheme();}if(el.id==='line-height'){lineHeight=Number(el.value);preference('wenyan-line-height',lineHeight);applyTheme();}
 if(el.id==='import-file'){try{const f=el.files[0];if(!f||f.size>8*1024*1024)throw Error();const data=JSON.parse(await f.text());await importBackup(data);}catch{toast('备份格式不正确，未修改当前记录');}}
});});
document.addEventListener('input',e=>{if(e.target.id==='font-size'){readingSize=Number(e.target.value);preference('wenyan-font-size',readingSize);$('#size-label').textContent=readingSize+'px';applyTheme();}});
document.addEventListener('keydown',e=>{
 if(e.isComposing||composing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey)return;
 const input=e.target.matches('input,textarea,select,[contenteditable]'),view=route()[0];
 if(panel.open){
  const results=[...panel.querySelectorAll('.search-result')];
  if(results.length&&['ArrowDown','ArrowUp'].includes(e.key)){
   e.preventDefault();const current=results.indexOf(document.activeElement),next=current<0?(e.key==='ArrowDown'?0:results.length-1):(current+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;results[next].focus();
  }else if(e.key==='Enter'&&e.target.id==='search-input'&&results.length){e.preventDefault();results[0].click();}
  return;
 }
 if(e.key==='Escape'&&view==='train'){e.preventDefault();actions.pause();return;}
 if(input)return;
 if(e.key==='/'){e.preventDefault();search();return;}
 if(view==='today'){
  const tasks=[...document.querySelectorAll('.resume-block .primary,.task-link')];
  if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const n=tasks.indexOf(document.activeElement);tasks[n<0?(e.key==='ArrowDown'?0:tasks.length-1):(n+(e.key==='ArrowDown'?1:-1)+tasks.length)%tasks.length]?.focus();}
  if(e.key==='Enter'&&!e.target.closest('a,button,summary')){e.preventDefault();tasks[0]?.click();}
 }
 if(view==='english'&&e.key==='Enter'&&!e.target.closest('a,button,summary')){e.preventDefault();(hasUnfinishedEnglishSession(session)?actions['resume-words']:actions['start-smart'])();}
 if(view==='results'&&e.key==='Enter'&&!e.target.closest('a,button,summary')){e.preventDefault();go('english');}
 if(view==='recall'){if(e.key===' '&&!litShown){e.preventDefault();showLit();}else if(litShown&&['1','2'].includes(e.key)){e.preventDefault();rateLit(e.key==='1'?1:3);}}
 if(view==='train'){
  const key=e.key.toLowerCase();
  if(phase==='rating'&&['1','2'].includes(key)){e.preventDefault();if(key==='1'||!(hinted||(isSmartSession(session)&&session.current?.firstCorrect===false)))mutate(()=>advanceWord(key==='1'?1:3));}
  else if(e.key===' '){e.preventDefault();actions.speak({dataset:{}});}
  else if(key==='h'){e.preventDefault();actions.hint();}
  else if(key==='f'){e.preventDefault();actions['favorite-word']($('[data-action="favorite-word"]'));}
  else if(key==='m'){e.preventDefault();actions['mastered-word']($('[data-action="mastered-word"]'));}
 }
});
window.addEventListener('hashchange',()=>{if(panel.open)panel.close();render();});
window.addEventListener('scroll',()=>{
 if(route()[0]!=='read'||!currentRead)return;clearTimeout(readTimer);readTimer=setTimeout(()=>{
  const ps=[...document.querySelectorAll('.reading-paragraph')];let index=0;ps.forEach((p,i)=>{if(p.getBoundingClientRect().top<innerHeight*.4)index=i;});
  if(currentRead.paragraph!==index){currentRead={...currentRead,paragraph:index};record('reading','resume',currentRead).catch(()=>{});}
 },450);
},{passive:true});
window.addEventListener('wenyan-remote',()=>{
 if(store.settings.newWordLimit?.value)newWordLimit=store.settings.newWordLimit.value;
 const syncedLayer=store.settings.layer?.value;if(syncedLayer&&syncedLayer!==getVocabularyState().layer)changeEnglishLayer(syncedLayer);

 const remoteSession=latest(store.events,'session','english'),remoteLit=latest(store.events,'session','literature');
 if(route()[0]!=='train'&&remoteSession){session=structuredClone(remoteSession);adoptCheckpoint(session.id);}
 if(route()[0]!=='recall'&&remoteLit){litSession=structuredClone(remoteLit);}

 if(route()[0]==='read'){const remote=resume();if(JSON.stringify(remote)!==JSON.stringify(currentRead))$('#remote-position').innerHTML=`<div class="position-notice">另一个页面更新了阅读位置 ${btn('remote-keep','继续本机','text-button')}${btn('remote-use','查看更新位置','text-button')}</div>`;}
 else if(['today','english','literature','training'].includes(route()[0]))render();
});
function updateViewport(){if(window.visualViewport)document.documentElement.style.setProperty('--visible-height',visualViewport.height+'px');}
window.visualViewport?.addEventListener('resize',updateViewport);window.addEventListener('resize',updateViewport);

panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
window.addEventListener('wenyan-cloud-status',()=>{document.querySelectorAll('.sync-status span').forEach(el=>el.textContent=saveLabel());});
window.addEventListener('wenyan-change',()=>{if(store.problem)toast(store.problem);});
window.addEventListener('wenyan-vocabulary-loaded',()=>{if(['today','english','train','results'].includes(route()[0]))render();if(panel.open&&$('#search-input'))searchResults();});
applyTheme();render();
if('serviceWorker' in navigator&&!new URLSearchParams(location.search).has('test'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
void localSnapshot().catch(()=>{});
navigator.storage?.persist?.().catch(()=>{});
initializeVocabulary({getPendingWordIds:()=>pendingEnglishWordIds(session)});
