import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@phosphor-icons/web/regular';
import './style.css';
import {articles,authors,works,questions,words,modes} from './content.js';
import {latest,activeEvents,reviewCard,nextReview,localDay,dueKeys,spellingMatches,intervalLabel,newId} from './core.js';
import {store,record,save,local} from './storage.js';

import {importEvents,exportState} from './backup.js';
import {buildEnglishQueue,recentWrongWordIds} from './english/queue.js';

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
let currentRead=null,mode=local.getItem('wenyan-mode')||'follow',wordFilter='all';
let phase='input',typed='',hinted=false,audioPlayed=false,paused=false,composing=false,busy=false,lastEvent=null;
let session=latest(store.events,'session','english')||loadJSON('wenyan-session',null),litSession=latest(store.events,'session','literature')||loadJSON('wenyan-lit-session',null),litShown=false,litHint=false;
let timer=null,readTimer=null,backupUrl=null;
function loadJSON(key,fallback){try{return JSON.parse(local.getItem(key))||fallback;}catch{return fallback;}}
function preference(key,value){try{local.setItem(key,value);}catch{toast('设置未能保存到本机');}}
function persistSession(){preference('wenyan-session',JSON.stringify(session));if(session)record('session','english',session);}
function persistLit(){preference('wenyan-lit-session',JSON.stringify(litSession));if(litSession)record('session','literature',litSession);}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
function route(){return (location.hash.slice(1)||'today').split('/');}
function go(path){if(location.hash==='#'+path)render();else location.hash=path;}
function saveLabel(){return '仅本机保存';}
function applyTheme(){document.documentElement.dataset.theme=theme;document.documentElement.style.setProperty('--reading-size',readingSize+'px');document.documentElement.style.setProperty('--reading-leading',lineHeight);document.documentElement.dataset.reading=readingFamily;}
function statusHTML(){return btn('settings',`${icon('hard-drive')}<span>${saveLabel()}</span>`,'sync-status');}
function nav(active){const selected=active==='english'?'training':active;return ['today','literature','training'].map((v,i)=>link(v,icon(['house','book-open','keyboard'][i])+`<span>${['今日','知识','训练'][i]}</span>`,selected===v?'nav-item active':'nav-item')).join('');}
function shell(content,active='today',focus=false){
 app.className=focus?'focus-app':'workstation';
 app.innerHTML=`${focus?'':`<aside class="rail"><a class="brand" href="#today">Wenyan</a><nav aria-label="主要导航">${nav(active)}</nav>${btn('search',icon('magnifying-glass')+'<span>搜索</span>','nav-item search-nav')}<div class="rail-foot">${statusHTML()}${btn('settings',icon('sliders-horizontal')+'<span>偏好与备份</span>','nav-item')}</div></aside>`}<main id="main" tabindex="-1">${store.problem?`<div class="save-warning" role="alert">${esc(store.problem)} ${btn('export','导出备份','text-button')}</div>`:''}${content}</main>${focus?'':`<nav class="mobile-nav" aria-label="主要导航">${nav(active)}</nav>`}`;
 applyTheme();document.title=`Wenyan · ${({today:'今日',literature:'知识',training:'训练',english:'英语'})[active]}`;
}
function dayText(){return new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date()).replace('日','日 · ');}
function resume(){return latest(store.events,'reading','resume')||{article:'narrative',section:0,paragraph:0};}
function done(id){return latest(store.events,'task',localDay()+':'+id)?.done||false;}
function wordFlagMap(kind){const map=new Map();for(const e of activeEvents(store.events))if(e.kind===kind&&e.key.startsWith('word:'))map.set(e.key.slice(5),Boolean(e.value.on));return map;}
function wordCounts(){
 const active=activeEvents(store.events),mastered=wordFlagMap('mastered'),eligible=words.filter(w=>!mastered.get(w.id)),eligibleIds=new Set(eligible.map(w=>w.id));
 const reviewed=new Set(active.filter(e=>e.kind==='review'&&e.key.startsWith('word:')).map(e=>e.key));
 const due=[],fresh=[];const now=Date.now();
 for(const w of eligible){const key='word:'+w.id;if(!reviewed.has(key)){fresh.push(w);continue;}const card=reviewCard(store.events,key);if(card.due.getTime()<=now)due.push(w);}
 const byId=new Map(eligible.map(w=>[w.id,w])),wrong=recentWrongWordIds(store.events,eligibleIds).map(id=>byId.get(id)).filter(Boolean);
 return {due,new:fresh,wrong};
}
function toggleTask(id){lastEvent=record('task',localDay()+':'+id,{done:!done(id)});render();toast('已更新 · 可撤销');}
function taskRow(id,title,sub,path){return `<div class="task-row ${done(id)?'complete':''}">${btn('task',icon(done(id)?'check-circle':'circle'),'task-check',`data-id="${id}" aria-label="${done(id)?'撤销完成':'标记完成'}：${esc(title)}"`)}${link(path,`<span>${esc(title)}</span><span class="task-meta">${esc(sub)} ${icon('caret-right')}</span>`,'task-link')}</div>`;}
function today(){
 const p=resume(),article=articles.find(a=>a.id===p.article)||articles[0],section=Math.min(p.section,article.sections.length-1),counts=wordCounts();
 const englishSub=counts.due.length?`到期${counts.due.length}词`:counts.wrong.length?`错词${counts.wrong.length}个`:`新词${Math.min(12,counts.new.length)}个`;
 const dueLiterature=questions.filter(q=>{const c=reviewCard(store.events,'lit:'+q.id);return c.reps>0&&c.due.getTime()<=Date.now();});
 const taskDefs=[['contemporary','当代文学 · 先锋小说','约8分钟','read/avant-garde/0'],['english','英语 · '+englishSub,'约6分钟','english'],['recall','背诵 · 名词解释与简答',dueLiterature.length?`到期${dueLiterature.length}题`:'3题','recall/narrative']];
 shell(`<div class="mobile-top"><a href="#today" class="brand">Wenyan</a>${statusHTML()}</div><section class="today-page"><header class="page-heading"><h1>今日</h1><span class="muted">${dayText()}</span></header><h2 class="section-label">接着学</h2><div class="resume-block"><div><h2>${esc(article.title)}</h2><p class="muted">上次停在：${esc(article.sections[section].title)}</p></div><div class="resume-actions">${link(`read/${article.id}/${section}`,'继续阅读 <kbd>Enter</kbd>','button primary')}${btn('five-minutes','先学5分钟','text-button')}</div></div>${session&&session.index<session.queue.length?link('train',`继续未完成词组 · ${session.index} / ${session.queue.length}`,'text-link'):''}${litSession&&litSession.index<litSession.queue.length?link('recall/'+litSession.article+'/'+(litSession.selection||''),`继续未完成回忆 · ${litSession.index} / ${litSession.queue.length}`,'text-link'):''}<h2 class="section-label next-label">接下来</h2><div class="task-list">${taskDefs.map(x=>taskRow(...x)).join('')}</div><div class="today-footer"><span class="muted">${taskDefs.filter(x=>done(x[0])).length+(done('reading')?1:0)}项已完成</span>${btn('undo','撤销上次记录','text-button',lastEvent?'':'disabled')}</div><p class="keyboard-note">↑↓ 选择任务 · Enter 开始 · / 搜索</p></section>`);
}
function literature(){shell(`<section class="library-page"><header class="page-heading"><h1>知识</h1>${btn('search',icon('magnifying-glass')+' 搜索','text-button')}</header><p class="muted lead">阅读、作品与回忆练习</p><h2 class="section-label">现当代文学</h2><div class="index-list">${articles.map(a=>link(`read/${a.id}/0`,`<div><span class="eyebrow">${a.period}</span><h2>${esc(a.title)}</h2><p class="muted">${esc(a.summary)}</p></div>${icon('arrow-up-right')}`,'index-row')).join('')}</div><h2 class="section-label">作家与作品</h2><div class="index-list">${authors.map(a=>link('author/'+a.id,`<div><h2>${a.name}</h2><p class="muted">${a.years} · ${a.genres}</p></div>${icon('caret-right')}`,'index-row')).join('')}</div><h2 class="section-label">回忆练习</h2><div class="index-list">${questions.map(q=>link('recall/'+q.article+'/'+q.id,`<div><span class="eyebrow">${q.type}</span><h2 class="small-heading">${esc(q.prompt)}</h2></div>${icon('caret-right')}`,'index-row')).join('')}</div><p class="source-note">当前为自编学习样本，内容来源可在阅读页查看。旧版资料保留在旧版页面。</p><a href="/legacy/index.html" class="text-link">打开旧版资料</a></section>`,'literature');}
function authorPage(id){const a=authors.find(x=>x.id===id);if(!a)return go('literature');shell(`<section class="detail-page">${link('literature',icon('arrow-left')+' 文学','back-link')}<h1>${a.name}</h1><p class="muted">${a.years} · ${a.genres}</p><p class="detail-intro">${a.intro}</p><h2 class="section-label">作品</h2><div class="index-list">${a.works.map(id=>{const w=works.find(x=>x.id===id);return link('work/'+id,`<div><h2>${w.title}</h2><p class="muted">${w.meta}</p></div>${icon('caret-right')}`,'index-row');}).join('')}</div><h2 class="section-label">相关阅读</h2>${link('read/narrative/0','鲁迅小说的叙事艺术 '+icon('arrow-up-right'),'reading-link')}<a class="source-note text-link" href="${a.source}" target="_blank" rel="noopener">生平与作品资料 · 上海鲁迅纪念馆</a></section>`,'literature');}
function workPage(id,context){const w=works.find(x=>x.id===id);if(!w)return go('literature');shell(`<section class="detail-page">${context==='from-read'?btn('return-read',icon('arrow-left')+' 返回阅读','back-link'):link('author/'+w.author,icon('arrow-left')+' 鲁迅','back-link')}<h1>${w.title}</h1><p class="muted">${w.meta}</p><p class="detail-intro">${w.intro}</p><a href="${w.source}" target="_blank" rel="noopener" class="text-link">阅读原文 · 维基文库 ${icon('arrow-up-right')}</a><h2 class="section-label">相关练习</h2>${questions.slice(1).map(q=>link('recall/narrative/'+q.id,`<span>${q.type}</span> ${esc(q.prompt)} ${icon('caret-right')}`,'related-row')).join('')}</section>`,'literature');}
function readPage(id,num){
 const a=articles.find(x=>x.id===id);if(!a)return go('literature');const index=Math.max(0,Math.min(Number(num)||0,a.sections.length-1)),sec=a.sections[index];
 const saved=resume();const restore=saved.article===id&&saved.section===index?saved.paragraph:0;
 currentRead={article:id,section:index,paragraph:restore};
 if(saved.article!==id||saved.section!==index)record('reading','resume',currentRead);
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
function rateLit(rating){if(!litShown||busy)return;busy=true;const q=questions.find(x=>x.id===litSession.queue[litSession.index]);lastEvent=record('review','lit:'+q.id,{rating});litSession.results.push({id:q.id,rating,eventId:lastEvent.id});litSession.index++;persistLit();render();busy=false;}
function litResults(){shell(`<section class="results-page">${link('today',icon('arrow-left')+' 今日','back-link')}<h1>本次回忆完成</h1><p class="muted">${litSession.results.length}题 · 需要再想${litSession.results.filter(r=>r.rating===1).length}题</p><div class="result-list">${litSession.results.map(r=>{const q=questions.find(q=>q.id===r.id);return `<div class="result-row"><span>${esc(q.prompt)}</span><span class="muted">${intervalLabel(reviewCard(store.events,'lit:'+r.id).due)}</span></div>`;}).join('')}</div>${litSession.results.some(r=>r.rating===1)?btn('lit-retry','再练需要回忆的题','primary'):btn('lit-new','再练本组','primary')}${btn('undo','撤销上次评价','text-button',lastEvent?'':'disabled')}${link('today','回到今日','text-link')}</section>`,'literature');recordTaskOnce('recall');}
function recordTaskOnce(key){if(!done(key))record('task',localDay()+':'+key,{done:true});}
function training(){shell(`<section class="library-page"><header class="page-heading"><h1>训练</h1>${btn('settings',icon('sliders-horizontal')+' 偏好','text-button')}</header><p class="muted lead">先自己回忆或作答，再核对要点。</p><div class="index-list">${link('english','<div><h2>英语词汇</h2><p class="muted">跟打 · 默写 · 听写 · 错词订正</p></div>'+icon('caret-right'),'index-row')}${articles.map(a=>link('recall/'+a.id,`<div><h2>${esc(a.title)}</h2><p class="muted">要点回忆 · 名词解释 · 简答</p></div>${icon('caret-right')}`,'index-row')).join('')}${questions.filter(q=>q.type==='论述').map(q=>link('recall/'+q.article+'/'+q.id,`<div><span class="eyebrow">论述练习</span><h2 class="small-heading">${esc(q.prompt)}</h2></div>${icon('caret-right')}`,'index-row')).join('')}</div><p class="source-note">当前为自编样本。院校真题下一阶段接入。</p></section>`,'training');}
function english(){
 const counts=wordCounts(),hasSession=session&&session.index<session.queue.length,wrongIds=new Set(counts.wrong.map(w=>w.id));
 const favorites=wordFlagMap('favorite'),mastered=wordFlagMap('mastered');
 const list=words.filter(w=>wordFilter==='favorites'?favorites.get(w.id):wordFilter==='mastered'?mastered.get(w.id):wordFilter==='wrong'?wrongIds.has(w.id):true);
 const displayLimit=wordFilter==='all'?300:500,visible=list.slice(0,displayLimit),hiddenCount=Math.max(0,list.length-visible.length);
 shell(`<section class="english-page"><header class="page-heading"><h1>英语</h1><span class="muted">基础词组 · 24词</span></header><p class="lead muted">到期复习优先，新词按本组上限加入。</p><h2 class="section-label">本次训练</h2><div class="mode-tabs" role="group" aria-label="训练模式">${Object.entries(modes).map(([id,name])=>btn('mode',name,mode===id?'active':'',`data-mode="${id}" aria-pressed="${mode===id}"`)).join('')}</div><p class="mode-description muted">${mode==='follow'?'看着单词完整输入，先练熟拼写。':mode==='recall'?'根据释义回忆拼写，提交后核对。':'先听发音，再完整写出单词。'}</p><label class="small-control">本组新词上限 <select id="new-limit"><option value="6">6词</option><option value="12" selected>12词</option><option value="24">24词</option></select></label><p class="muted">到期 ${counts.due.length}词 · 近期错词 ${counts.wrong.length}词 · 未学 ${counts.new.length}词</p><div class="start-actions">${btn('start-words','智能开始','primary',counts.due.length+counts.wrong.length+counts.new.length?'':'disabled')}${hasSession?btn('resume-words',`继续上次 · ${session.index} / ${session.queue.length}`,'text-button'):''}</div><h2 class="section-label vocabulary-label">词表</h2><div class="filter-tabs">${[['all','全部'],['wrong','错词'],['favorites','收藏'],['mastered','已掌握']].map(([id,name])=>btn('word-filter',name,wordFilter===id?'text-button active':'text-button',`data-filter="${id}"`)).join('')}</div><div class="vocabulary-list">${visible.length?visible.map(w=>btn('word-detail',`<span class="word-small">${w.word}</span><span class="muted">${esc(w.meaning)}</span>`,'vocabulary-row',`data-word="${w.id}"`)).join(''):'<p class="muted">这里还没有单词。</p>'}</div>${hiddenCount?`<p class="muted">当前仅展示前 ${visible.length} 词，另有 ${hiddenCount} 词仍会参与搜索和训练。</p>`:''}<p class="source-note">自编基础词组，尚未扩充为完整考研词库。词条可查看词典核对。</p></section>`,'english');
}
function startWords(){
 const c=wordCounts(),limit=Number($('#new-limit')?.value||12),queue=buildEnglishQueue({dueIds:c.due.map(w=>w.id),wrongIds:c.wrong.map(w=>w.id),newIds:c.new.map(w=>w.id),newLimit:limit,maxTotal:24});if(!queue.length){toast('当前没有待学习单词');return;}
 session={id:newId(),mode,queue,index:0,results:[],startedAt:Date.now()};persistSession();go('train');
}
function train(){
 if(!session)return go('english');if(session.index>=session.queue.length)return go('results');
 const w=words.find(x=>x.id===session.queue[session.index]);if(!w){session=null;persistSession();return go('english');}
 phase='input';typed='';hinted=Boolean(session.current?.hinted);audioPlayed=false;paused=false;composing=false;busy=false;
 shell(`<header class="focus-header training-header">${btn('exit-training',icon('arrow-left')+' 返回','back-link')}<span>${modes[session.mode]}</span>${btn('pause','暂停','text-button')}</header><section class="training-page"><div class="word-stage" id="word-stage">${session.mode==='follow'?`<h1 class="word-display">${w.word}</h1><p class="ipa">${esc(w.ipa)}</p><p class="meaning">${esc(w.meaning)}</p>`:session.mode==='recall'?`<h1 class="recall-meaning">${esc(w.meaning)}</h1><p class="muted">回忆并输入完整单词</p>`:`${btn('speak',icon('speaker-high'),'audio-prompt','aria-label="播放本题发音"')}<p class="muted">听发音，写单词</p>`}</div><form id="word-form" autocomplete="off"><label class="sr-only" for="word-input">输入完整英文单词</label><input id="word-input" type="text" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" aria-describedby="input-feedback" /><div id="input-feedback" class="input-feedback" aria-live="polite">${session.mode==='follow'?'输入完整单词':'输入后按 Enter 提交'}</div><div id="word-actions"><button type="submit" class="submit-word">提交</button>${session.mode!=='listen'?btn('speak',icon('speaker-high'),'icon-button','aria-label="播放发音"'):''}${session.mode!=='follow'?btn('hint','提示','text-button'):''}</div></form><div id="memory-actions"></div><footer class="training-progress"><progress value="${session.index}" max="${session.queue.length}" aria-label="训练进度"></progress><span>${session.index+1} / ${session.queue.length}</span><span class="keyboard-note">Esc 暂停</span></footer></section>`,'english',true);
 $('#word-input').addEventListener('compositionstart',()=>composing=true);
 $('#word-input').addEventListener('compositionend',()=>{composing=false;inputChanged();});
 $('#word-input').addEventListener('input',inputChanged);
 $('#word-form').addEventListener('submit',e=>{e.preventDefault();submitWord();});
 if(!matchMedia('(pointer:coarse)').matches)$('#word-input').focus();
 if((autoVoice&&session.mode==='follow')||session.mode==='listen')speak(w.word);
 updateViewport();
}
function inputChanged(){typed=$('#word-input')?.value||'';if(composing||!['input','correction'].includes(phase)||session.mode!=='follow')return;const w=words.find(w=>w.id===session.queue[session.index]);const wrong=[...typed].some((c,i)=>c.toLowerCase()!==w.word[i]);$('#word-input').classList.toggle('has-error',wrong);const first=[...typed].findIndex((c,i)=>c.toLowerCase()!==w.word[i]);$('#input-feedback').innerHTML=wrong?`第${first+1}个字母 <span class="wrong-letter">${esc(typed[first])}</span> 不匹配，提交后从头订正`:'输入完整单词';if(!matchMedia('(pointer:coarse)').matches && spellingMatches(typed,w.word))submitWord();}
function revealWord(w){$('#word-stage').innerHTML=`<h1 class="word-display">${w.word}</h1><p class="ipa">${esc(w.ipa)}</p><p class="meaning">${esc(w.meaning)}</p>`;}
function submitWord(){
 if(composing||paused||busy||!session)return;const w=words.find(w=>w.id===session.queue[session.index]),value=$('#word-input').value;
 if(!value.trim()){toast('先输入完整单词');return;}
 if(session.mode==='listen'&&!audioPlayed&&!hinted){toast('发音尚未播放，可重播或使用提示');return;}
 const correct=spellingMatches(value,w.word);
 if(phase==='input'&&!session.current){session.current={firstCorrect:correct,hinted};persistSession();}
 if(!correct){phase='correction';revealWord(w);$('#word-input').value='';$('#word-input').classList.add('has-error');$('#input-feedback').innerHTML='拼写需要订正，请从首字母完整输入一次。';$('#word-input').focus();return;}
 $('#word-input').classList.remove('has-error');$('#word-input').classList.add('correct');
 if(session.mode==='follow'){busy=true;$('#input-feedback').textContent='已完成';setTimeout(()=>{if(paused){busy=false;return;}advanceWord(null);},220);}
 else {phase='rating';revealWord(w);$('#word-input').readOnly=true;$('#word-actions').hidden=true;$('#input-feedback').textContent=hinted?'已用提示，本次按需要再想记录':'核对刚才的回忆，再自评';$('#memory-actions').innerHTML=`${btn('word-rate','没想起 <kbd>1</kbd>','','data-rating="1"')}${btn('word-rate','想起来了 <kbd>2</kbd>','primary',`data-rating="3" ${hinted?'disabled':''}`)}`;$('#memory-actions button').focus();}
}
function advanceWord(rating){
 const id=session.queue[session.index],cur=session.current||{firstCorrect:true,hinted};
 const event=rating?record('review','word:'+id,{rating,firstCorrect:cur.firstCorrect,hinted:cur.hinted}):record('typing','word:'+id,{correct:cur.firstCorrect,session:session.id});lastEvent=event;
 session.results.push({id,rating,firstCorrect:cur.firstCorrect,hinted:cur.hinted,eventId:event.id});session.index++;delete session.current;persistSession();render();
}
function wordHint(){if(phase!=='input'&&phase!=='correction')return;hinted=true;const w=words.find(w=>w.id===session.queue[session.index]);revealWord(w);$('#input-feedback').textContent='已用提示，本次需要再想';}
function speak(word){
 if(!('speechSynthesis' in window)){toast('当前浏览器不支持发音，可使用提示');return;}
 if(session?.mode==='recall'&&route()[0]==='train')hinted=true;
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(word);u.lang='en-GB';u.rate=.82;
 const voice=speechSynthesis.getVoices().find(v=>v.lang==='en-GB')||speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)u.voice=voice;
 u.onstart=()=>audioPlayed=true;u.onerror=()=>toast('发音未能播放，可重试或使用提示');speechSynthesis.speak(u);
}
function results(){
 if(!session)return go('english');
 const wrong=session.results.filter(r=>!r.firstCorrect),forgot=session.results.filter(r=>r.rating===1);
 shell(`<section class="results-page">${link('english',icon('arrow-left')+' 英语','back-link')}<h1>本次${session.mode==='follow'?'输入练习':'复习'}完成</h1><p class="muted">${session.results.length}词 · 拼写订正${wrong.length}词${session.mode!=='follow'?` · 需要再想${forgot.length}词`:''}</p><p class="source-note">${session.mode==='follow'?'跟打记录输入练习；默写和听写的自评用于安排复习。':'下一次复习已按本次回忆评价安排。'}</p><h2 class="section-label">${forgot.length?'需要再想':'本次单词'}</h2><div class="result-list">${(forgot.length?forgot:session.results).map(r=>{const w=words.find(w=>w.id===r.id);return `<div class="result-row">${btn('word-detail',`<span class="word-small">${w.word}</span> <span class="muted">${esc(w.meaning)}</span>`,'text-button',`data-word="${w.id}"`)}<span class="muted">${r.rating?intervalLabel(reviewCard(store.events,'word:'+r.id).due):'输入练习'}</span></div>`;}).join('')}</div>${wrong.length?`<details class="spelling-results"><summary>拼写订正 · ${wrong.length}词</summary><p class="word-small">${wrong.map(r=>r.id).join(' · ')}</p></details>`:''}<div class="result-actions">${btn('retry-words',forgot.length?'再想这些词':'练习拼写订正','primary',forgot.length||wrong.length?'':'disabled')}${btn('undo','撤销上次评价','text-button',lastEvent?'':'disabled')}</div>${link('today','回到今日','text-link')}</section>`,'english');recordTaskOnce('english');
}
function render(){
 clearTimeout(readTimer);const [view,id,index]=route();if(view!=='read')window.scrollTo(0,0);
 ({today, literature,training,english,author:()=>authorPage(id),work:()=>workPage(id,index),read:()=>readPage(id,index),recall:()=>recallPage(id,index),train,results}[view]||today)();
}
function openPanel(content){if(backupUrl){URL.revokeObjectURL(backupUrl);backupUrl=null;}panel.innerHTML=`<header class="panel-header"><span>Wenyan</span>${btn('close-panel',icon('x'),'icon-button','aria-label="关闭面板"')}</header>${content}`;panel.showModal();}
function settings(){openPanel(`<h2>偏好与备份</h2><label>外观 <select id="theme"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">暗色</option></select></label><label class="check-label"><input id="voice" type="checkbox" ${autoVoice?'checked':''}/>训练时自动发音</label><p class="source-note">上班使用建议关闭发音。发音由浏览器提供。</p><hr/><h3>本机备份</h3><div class="panel-actions">${btn('export','导出记录')}${btn('import','导入记录')}${btn('import-text','粘贴备份','text-button')}</div><p class="source-note">记录保存在当前浏览器。导入合并已完成记录、复习安排和续学位置，不覆盖当前记录。跨设备同步尚未接通。</p><input id="import-file" type="file" accept="application/json" hidden/>`);$('#theme').value=theme;}
function appearance(){openPanel(`<h2>阅读外观</h2><label>字号 <input id="font-size" type="range" min="16" max="24" value="${readingSize}"/> <span id="size-label">${readingSize}px</span></label><label>行距 <select id="line-height"><option value="1.65">紧凑</option><option value="1.85">标准</option><option value="2">宽松</option></select></label><label>正文字体 <select id="reading-family"><option value="serif">宋体</option><option value="sans">黑体</option></select></label>`);$('#line-height').value=lineHeight;$('#reading-family').value=readingFamily;}
function toc(){const a=articles.find(a=>a.id===currentRead.article);openPanel(`<h2>章节目录</h2><div class="toc-list">${a.sections.map((s,i)=>link(`read/${a.id}/${i}`,`${String(i+1).padStart(2,'0')} ${esc(s.title)}`,i===currentRead.section?'active':'')).join('')}</div>`);}
function search(){openPanel(`<h2>搜索</h2><label class="sr-only" for="search-input">搜索作家、作品、知识点或单词</label><input type="search" id="search-input" placeholder="作家、作品、知识点或单词"/><div id="search-results"></div><p class="source-note">检索本机已有学习内容。</p>`);$('#search-input').focus();$('#search-input').addEventListener('input',searchResults);searchResults();}
function searchResults(){const text=$('#search-input').value.toLowerCase();const items=[...articles.map(a=>({title:a.title,type:a.period,path:'read/'+a.id+'/0'})),...authors.map(a=>({title:a.name,type:'作家',path:'author/'+a.id})),...works.map(w=>({title:w.title,type:'作品',path:'work/'+w.id})),...questions.map(q=>({title:q.prompt,type:q.type,path:'recall/'+q.article+'/'+q.id}))];const found=items.filter(i=>i.title.includes(text));$('#search-results').innerHTML=found.slice(0,10).map(i=>link(i.path,`<span>${esc(i.title)}</span><small>${i.type}</small>`,'search-result')).join('')+words.filter(w=>(w.word+w.meaning).includes(text)&&text).slice(0,5).map(w=>btn('word-detail',w.word+' · '+esc(w.meaning),'search-result',`data-word="${w.id}"`)).join('');if(!found.length&&!$('#search-results').innerHTML)$('#search-results').innerHTML='<p class="muted">没有匹配内容，试试其他关键词。</p>';}
function wordDetail(id){const w=words.find(w=>w.id===id);if(!w)return;openPanel(`<h2 class="word-small detail-word">${w.word}</h2><p class="ipa">${esc(w.ipa)}</p><p>${esc(w.meaning)}</p><div class="panel-actions">${btn('favorite',icon('bookmark-simple')+(latest(store.events,'favorite','word:'+id)?.on?' 取消收藏':' 收藏'),'','data-word="'+id+'"')}${btn('mastered',latest(store.events,'mastered','word:'+id)?.on?'恢复复习':'标为已掌握','','data-word="'+id+'"')}${btn('speak',icon('speaker-high')+' 发音','','data-word="'+id+'"')}</div><p class="source-note">已掌握会移出默认复习队列，可随时恢复。</p><a class="text-link" href="${w.source}" target="_blank" rel="noopener">词典核对 ${icon('arrow-up-right')}</a>`);}
function exportRecords(){
 const text=JSON.stringify({...exportState(store.events),...(store.problem?{unreadableOriginal:store.rawRecords}:{})},null,2);
 openPanel(`<h2>导出备份</h2><a id="backup-download" class="button primary">下载备份文件</a><details><summary>下载不可用时，复制备份文字</summary><label for="backup-text">完整备份</label><textarea id="backup-text" readonly rows="8" style="width:100%">${esc(text)}</textarea></details><p class="source-note">包含已完成记录、复习安排和续学位置。请妥善保存。</p>`);
 backupUrl=URL.createObjectURL(new Blob([text],{type:'application/json'}));$('#backup-download').href=backupUrl;$('#backup-download').download='Wenyan-学习记录-'+localDay()+'.json';
}
function importBackup(data){const merged=importEvents(data,store.events);if(!save(merged)){toast('未能保存导入记录，请导出当前备份后重试');return;}window.dispatchEvent(new Event('wenyan-remote'));toast('记录已合并');panel.close();render();}
const actions={
 'task':el=>toggleTask(el.dataset.id),'five-minutes':()=>{litSession=null;go('recall/narrative/perspective');},'undo':()=>{if(!lastEvent)return;record('undo',lastEvent.key,{id:lastEvent.id});const id=lastEvent.id;lastEvent=null;toast('已撤销，复习安排已恢复');if(session?.results.at(-1)?.eventId===id){session.results.pop();session.index--;persistSession();record('task',localDay()+':english',{done:false});go('train');}else if(litSession?.results.at(-1)?.eventId===id){litSession.results.pop();litSession.index--;persistLit();record('task',localDay()+':recall',{done:false});go('recall/'+litSession.article);render();}else render();},
 'finish-reading':()=>{recordTaskOnce(currentRead?.article==='avant-garde'?'contemporary':'reading');toast('阅读已完成');go('today');},'return-read':()=>{const r=currentRead||resume();go(`read/${r.article}/${r.section}`);},
 'outline-toggle':()=>{$('#outline').hidden=!$('#outline').hidden;if(!$('#outline').hidden)$('#outline').focus();},'lit-new':()=>{litStart(litSession.article);render();},'lit-show':showLit,'lit-rate':el=>rateLit(Number(el.dataset.rating)),'lit-retry':()=>{litSession={...litSession,queue:litSession.results.filter(r=>r.rating===1).map(r=>r.id),index:0,results:[]};persistLit();render();},
 'mode':el=>{mode=el.dataset.mode;preference('wenyan-mode',mode);english();},'word-filter':el=>{wordFilter=el.dataset.filter;english();},'start-words':startWords,'resume-words':()=>go('train'),
 'exit-training':()=>{persistSession();window.speechSynthesis?.cancel();go('english');},'pause':()=>{paused=true;busy=false;window.speechSynthesis?.cancel();openPanel(`<h2>已暂停</h2><p class="muted">已完成的单词已保存。继续后回到当前词。</p>${btn('continue-training','继续训练','primary')}${btn('exit-training','结束本次','text-button')}`);},'continue-training':()=>{paused=false;panel.close();if($('#word-input')?.classList.contains('correct')&&session.mode==='follow')advanceWord(null);else $('#word-input')?.focus();},
 'speak':el=>speak(el.dataset.word||session?.queue[session.index]),'hint':wordHint,'word-rate':el=>{if(phase!=='rating'||busy)return;busy=true;advanceWord(Number(el.dataset.rating));},
 'retry-words':()=>{const list=session.results.filter(r=>r.rating===1||!r.firstCorrect);if(!list.length)return;session={id:newId(),mode:session.mode,queue:list.map(r=>r.id),index:0,results:[],startedAt:Date.now()};persistSession();go('train');},
 'settings':settings,'appearance':appearance,'toc':toc,'search':search,'close-panel':()=>{panel.close();if(route()[0]==='train'&&paused)paused=false;},
 'word-detail':el=>wordDetail(el.dataset.word),'favorite':el=>{const id=el.dataset.word;record('favorite','word:'+id,{on:!latest(store.events,'favorite','word:'+id)?.on});wordDetail(id);},'mastered':el=>{const id=el.dataset.word;record('mastered','word:'+id,{on:!latest(store.events,'mastered','word:'+id)?.on});wordDetail(id);},
  'export':exportRecords,'import':()=>$('#import-file').click(),'import-text':()=>openPanel(`<h2>导入备份文字</h2><label for="import-text">完整备份</label><textarea id="import-text" rows="8" style="width:100%"></textarea>${btn('import-pasted','合并记录','primary')}`),'import-pasted':()=>{try{const value=$('#import-text').value;if(value.length>8*1024*1024)throw Error();importBackup(JSON.parse(value));}catch{toast('备份格式不正确，未修改当前记录');}},
 'remote-use':()=>{const p=resume();go(`read/${p.article}/${p.section}`);render();},'remote-keep':()=>{record('reading','resume',currentRead);$('#remote-position').innerHTML='';}
};
document.addEventListener('click',e=>{if(e.target.closest('.skip-link')){e.preventDefault();$('#main').focus();return;}const el=e.target.closest('[data-action]');if(el&&!el.disabled){e.preventDefault();actions[el.dataset.action]?.(el);}if(e.target.closest('#panel a[href^="#"]'))panel.close();});
document.addEventListener('change',async e=>{
 const el=e.target;if(el.id==='theme'){theme=el.value;preference('wenyan-theme',theme);applyTheme();}if(el.id==='voice'){autoVoice=el.checked;preference('wenyan-voice',autoVoice?'on':'off');}
 if(el.id==='reading-family'){readingFamily=el.value;preference('wenyan-reading-family',readingFamily);applyTheme();}if(el.id==='line-height'){lineHeight=Number(el.value);preference('wenyan-line-height',lineHeight);applyTheme();}
 if(el.id==='import-file'){try{const f=el.files[0];if(!f||f.size>8*1024*1024)throw Error();const data=JSON.parse(await f.text());importBackup(data);}catch{toast('备份格式不正确，未修改当前记录');}}
});
document.addEventListener('input',e=>{if(e.target.id==='font-size'){readingSize=Number(e.target.value);preference('wenyan-font-size',readingSize);$('#size-label').textContent=readingSize+'px';applyTheme();}});
document.addEventListener('keydown',e=>{
 const input=e.target.matches('input,textarea,select,[contenteditable]');
 if(e.key==='Escape'&&route()[0]==='train'&&!panel.open){e.preventDefault();actions.pause();return;}
 if(panel.open)return;
 if(!input&&e.key==='/'){e.preventDefault();search();return;}
 if(!input&&route()[0]==='today'){
  const tasks=[...document.querySelectorAll('.resume-block a,.task-link')];
  if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const n=tasks.indexOf(document.activeElement);tasks[(n+(e.key==='ArrowDown'?1:-1)+tasks.length)%tasks.length]?.focus();}
  if(e.key==='Enter'&&!e.target.closest('a,button')){e.preventDefault();tasks[0]?.click();}
 }
 if(!input&&route()[0]==='recall'){if(e.key===' '&&!litShown){e.preventDefault();showLit();}else if(litShown&&['1','2'].includes(e.key)){e.preventDefault();rateLit(e.key==='1'?1:3);}}
 if(!input&&route()[0]==='train'&&phase==='rating'&&['1','2'].includes(e.key)){e.preventDefault();if(e.key==='1'||!hinted)advanceWord(e.key==='1'?1:3);}
});
window.addEventListener('hashchange',()=>{if(panel.open)panel.close();render();});
window.addEventListener('scroll',()=>{
 if(route()[0]!=='read'||!currentRead)return;clearTimeout(readTimer);readTimer=setTimeout(()=>{
  const ps=[...document.querySelectorAll('.reading-paragraph')];let index=0;ps.forEach((p,i)=>{if(p.getBoundingClientRect().top<innerHeight*.4)index=i;});
  if(currentRead.paragraph!==index){currentRead={...currentRead,paragraph:index};record('reading','resume',currentRead);}
 },450);
},{passive:true});
window.addEventListener('wenyan-remote',()=>{
 const remoteSession=latest(store.events,'session','english'),remoteLit=latest(store.events,'session','literature');
 if(route()[0]!=='train'&&remoteSession){session=structuredClone(remoteSession);preference('wenyan-session',JSON.stringify(session));}
 if(route()[0]!=='recall'&&remoteLit){litSession=structuredClone(remoteLit);preference('wenyan-lit-session',JSON.stringify(litSession));}

 if(route()[0]==='read'){const remote=resume();if(JSON.stringify(remote)!==JSON.stringify(currentRead))$('#remote-position').innerHTML=`<div class="position-notice">另一个页面更新了阅读位置 ${btn('remote-keep','继续本机','text-button')}${btn('remote-use','查看更新位置','text-button')}</div>`;}
 else if(['today','english','literature','training'].includes(route()[0]))render();
});
function updateViewport(){if(window.visualViewport)document.documentElement.style.setProperty('--visible-height',visualViewport.height+'px');}
window.visualViewport?.addEventListener('resize',updateViewport);window.addEventListener('resize',updateViewport);

panel.addEventListener('cancel',()=>{paused=false;});
window.addEventListener('wenyan-change',()=>{if(store.problem)toast(store.problem);});
applyTheme();render();
