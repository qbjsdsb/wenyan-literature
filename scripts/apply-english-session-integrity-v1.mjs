import fs from 'node:fs';

function replaceExact(text, before, after, label) {
  if (!text.includes(before)) throw new Error(`Missing expected block: ${label}`);
  return text.replace(before, after);
}

let app = fs.readFileSync('src/app.js', 'utf8');
app = replaceExact(
  app,
  "import {englishDailyStats} from './english/stats.js';",
  "import {englishDailyStats} from './english/stats.js';\nimport {hasUnfinishedEnglishSession,markEnglishSessionHinted,pendingEnglishWordIds,recordEnglishFirstAttempt} from './english/session.js';",
  'session helper import'
);
app = replaceExact(
  app,
  " const counts=wordCounts(),daily=englishDailyStats(store.events),hasSession=session&&session.index<session.queue.length,wrongIds=new Set(counts.wrong.map(w=>w.id));",
  " const counts=wordCounts(),daily=englishDailyStats(store.events),hasSession=hasUnfinishedEnglishSession(session),wrongIds=new Set(counts.wrong.map(w=>w.id));",
  'hasSession calculation'
);
app = replaceExact(
  app,
  "<div class=\"start-actions\">${btn('start-words','智能开始','primary',counts.due.length+counts.wrong.length+counts.new.length?'':'disabled')}${hasSession?btn('resume-words',`继续上次 · ${session.index} / ${session.queue.length}`,'text-button'):''}</div>",
  "<div class=\"start-actions\">${hasSession?btn('resume-words',`继续上次 · ${session.index} / ${session.queue.length}`,'primary'):btn('start-words','智能开始','primary',counts.due.length+counts.wrong.length+counts.new.length?'':'disabled')}</div>",
  'start actions'
);
app = replaceExact(
  app,
  "function startWords(){\n const c=wordCounts(),limit=Number($('#new-limit')?.value||12),queue=buildEnglishQueue({dueIds:c.due.map(w=>w.id),wrongIds:c.wrong.map(w=>w.id),newIds:c.new.map(w=>w.id),newLimit:limit,maxTotal:24});if(!queue.length){toast('当前没有待学习单词');return;}\n session={id:newId(),mode,queue,index:0,results:[],startedAt:Date.now()};persistSession();go('train');\n}",
  "function startWords(){\n if(hasUnfinishedEnglishSession(session)){toast('先继续未完成词组');go('train');return;}\n const c=wordCounts(),limit=Number($('#new-limit')?.value||12),queue=buildEnglishQueue({dueIds:c.due.map(w=>w.id),wrongIds:c.wrong.map(w=>w.id),newIds:c.new.map(w=>w.id),newLimit:limit,maxTotal:24});if(!queue.length){toast('当前没有待学习单词');return;}\n session={id:newId(),mode,queue,index:0,results:[],startedAt:Date.now()};persistSession();go('train');\n}",
  'startWords guard'
);
app = replaceExact(
  app,
  " const w=words.find(x=>x.id===session.queue[session.index]);if(!w){session=null;persistSession();return go('english');}",
  " const w=words.find(x=>x.id===session.queue[session.index]);if(!w){const status=window.__wenyanVocabularyMeta?.status;if(!status||status==='loading'){shell(`<section class=\"training-page\"><h1>正在准备词库</h1><p class=\"muted\">未完成词组已保留，词库载入后会自动继续。</p></section>`,'english',true);return;}shell(`<section class=\"training-page\"><h1>暂时找不到这个续学词</h1><p class=\"muted\">未完成词组没有被删除。返回英语页后可重试。</p>${link('english','返回英语','button primary')}</section>`,'english',true);return;}",
  'missing session word handling'
);
app = replaceExact(
  app,
  " if(phase==='input'&&!session.current){session.current={firstCorrect:correct,hinted};persistSession();}",
  " if(phase==='input'&&typeof session.current?.firstCorrect!=='boolean'){session=recordEnglishFirstAttempt(session,correct,hinted);persistSession();}",
  'first attempt persistence'
);
app = replaceExact(
  app,
  "function wordHint(){if(phase!=='input'&&phase!=='correction')return;hinted=true;const w=words.find(w=>w.id===session.queue[session.index]);revealWord(w);$('#input-feedback').textContent='已用提示，本次需要再想';}",
  "function persistHint(){hinted=true;session=markEnglishSessionHinted(session);persistSession();}\nfunction wordHint(){if(phase!=='input'&&phase!=='correction')return;persistHint();const w=words.find(w=>w.id===session.queue[session.index]);revealWord(w);$('#input-feedback').textContent='已用提示，本次需要再想';}",
  'hint persistence'
);
app = replaceExact(
  app,
  " if(session?.mode==='recall'&&route()[0]==='train')hinted=true;",
  " if(session?.mode==='recall'&&route()[0]==='train')persistHint();",
  'recall speak persistence'
);
app = replaceExact(
  app,
  "applyTheme();render();",
  "window.__wenyanActiveEnglishSessionIds=()=>pendingEnglishWordIds(session);\napplyTheme();render();",
  'session ids hook'
);
fs.writeFileSync('src/app.js', app);

let vocab = fs.readFileSync('src/english-vocab.js', 'utf8');
vocab = replaceExact(
  vocab,
  "  status: 'sample',",
  "  status: 'loading',",
  'initial vocabulary status'
);
vocab = replaceExact(
  vocab,
  "  const active = selectActiveCatalog(enriched, seedWords, activeLayer).map(withRuntimeFields);\n  words.splice(0, words.length, ...active);",
  "  const baseActive = selectActiveCatalog(enriched, seedWords, activeLayer);\n  const pendingIds = globalThis.__wenyanActiveEnglishSessionIds?.() ?? [];\n  const active = selectActiveCatalog(enriched, seedWords, activeLayer, pendingIds).map(withRuntimeFields);\n  words.splice(0, words.length, ...active);",
  'preserve unfinished session words'
);
vocab = replaceExact(
  vocab,
  "    active: active.length,",
  "    active: baseActive.length,\n    carryover: Math.max(0, active.length - baseActive.length),",
  'active metadata'
);
vocab = replaceExact(
  vocab,
  "      ? `${ENGLISH_LAYERS[activeLayer].label}学习集 · ${vocabularyMeta.active}词 / 唯一词${vocabularyMeta.total}词`",
  "      ? `${ENGLISH_LAYERS[activeLayer].label}学习集 · ${vocabularyMeta.active}词 / 唯一词${vocabularyMeta.total}词${vocabularyMeta.carryover?` · 续学保留${vocabularyMeta.carryover}词`:''}`",
  'carryover badge'
);
vocab = replaceExact(
  vocab,
  "window.addEventListener('wenyan-vocabulary-loaded', () => {\n  if (location.hash === '#english') window.dispatchEvent(new Event('hashchange'));\n  else decorateEnglishPage();\n});",
  "window.addEventListener('wenyan-vocabulary-loaded', () => {\n  if (['#english','#train'].includes(location.hash)) window.dispatchEvent(new Event('hashchange'));\n  else decorateEnglishPage();\n});",
  'rerender train after vocabulary load'
);
vocab = replaceExact(
  vocab,
  "decorateEnglishPage();\nPromise.all([loadCatalog(), loadLexicon()])",
  "window.__wenyanVocabularyMeta = { ...vocabularyMeta };\ndecorateEnglishPage();\nPromise.all([loadCatalog(), loadLexicon()])",
  'publish loading metadata'
);
vocab = replaceExact(
  vocab,
  "  .catch(() => {\n    vocabularyMeta.status = 'sample';\n    decorateEnglishPage();\n  });",
  "  .catch(() => {\n    vocabularyMeta.status = 'sample';\n    window.__wenyanVocabularyMeta = { ...vocabularyMeta };\n    window.dispatchEvent(new CustomEvent('wenyan-vocabulary-loaded', { detail: { ...vocabularyMeta } }));\n  });",
  'publish load failure'
);
fs.writeFileSync('src/english-vocab.js', vocab);
console.log('Applied English session integrity fixes.');
