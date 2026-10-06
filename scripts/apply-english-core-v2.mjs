import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/app.js';
let source = await readFile(path, 'utf8');

function replaceText(label, before, after) {
  if (!source.includes(before)) throw new Error(`${label}: expected source text not found`);
  source = source.replace(before, after);
}

function replaceRegex(label, pattern, after) {
  if (!pattern.test(source)) throw new Error(`${label}: expected source block not found`);
  source = source.replace(pattern, after);
}

replaceText(
  'queue import',
  "import {importEvents,exportState} from './backup.js';",
  "import {importEvents,exportState} from './backup.js';\nimport {buildEnglishQueue,recentWrongWordIds} from './english/queue.js';"
);

replaceRegex(
  'word counts',
  /function wordCounts\(\)\{[^\n]*\}/,
  `function wordFlagMap(kind){const map=new Map();for(const e of activeEvents(store.events))if(e.kind===kind&&e.key.startsWith('word:'))map.set(e.key.slice(5),Boolean(e.value.on));return map;}\nfunction wordCounts(){\n const active=activeEvents(store.events),mastered=wordFlagMap('mastered'),eligible=words.filter(w=>!mastered.get(w.id)),eligibleIds=new Set(eligible.map(w=>w.id));\n const reviewed=new Set(active.filter(e=>e.kind==='review'&&e.key.startsWith('word:')).map(e=>e.key));\n const due=[],fresh=[];const now=Date.now();\n for(const w of eligible){const key='word:'+w.id;if(!reviewed.has(key)){fresh.push(w);continue;}const card=reviewCard(store.events,key);if(card.due.getTime()<=now)due.push(w);}\n const byId=new Map(eligible.map(w=>[w.id,w])),wrong=recentWrongWordIds(store.events,eligibleIds).map(id=>byId.get(id)).filter(Boolean);\n return {due,new:fresh,wrong};\n}`
);

replaceText(
  'today english summary',
  "const englishSub=counts.due.length?`到期${counts.due.length}词`:`新词${Math.min(12,counts.new.length)}个`;",
  "const englishSub=counts.due.length?`到期${counts.due.length}词`:counts.wrong.length?`错词${counts.wrong.length}个`:`新词${Math.min(12,counts.new.length)}个`;"
);

replaceRegex(
  'english page',
  /function english\(\)\{\n[\s\S]*?\n\}\nfunction startWords\(\)\{/,
  `function english(){\n const counts=wordCounts(),hasSession=session&&session.index<session.queue.length,wrongIds=new Set(counts.wrong.map(w=>w.id));\n const favorites=wordFlagMap('favorite'),mastered=wordFlagMap('mastered');\n const list=words.filter(w=>wordFilter==='favorites'?favorites.get(w.id):wordFilter==='mastered'?mastered.get(w.id):wordFilter==='wrong'?wrongIds.has(w.id):true);\n const displayLimit=wordFilter==='all'?300:500,visible=list.slice(0,displayLimit),hiddenCount=Math.max(0,list.length-visible.length);\n shell(\`<section class="english-page"><header class="page-heading"><h1>英语</h1><span class="muted">基础词组 · 24词</span></header><p class="lead muted">到期复习优先，新词按本组上限加入。</p><h2 class="section-label">本次训练</h2><div class="mode-tabs" role="group" aria-label="训练模式">\${Object.entries(modes).map(([id,name])=>btn('mode',name,mode===id?'active':'',\`data-mode="\${id}" aria-pressed="\${mode===id}"\`)).join('')}</div><p class="mode-description muted">\${mode==='follow'?'看着单词完整输入，先练熟拼写。':mode==='recall'?'根据释义回忆拼写，提交后核对。':'先听发音，再完整写出单词。'}</p><label class="small-control">本组新词上限 <select id="new-limit"><option value="6">6词</option><option value="12" selected>12词</option><option value="24">24词</option></select></label><p class="muted">到期 \${counts.due.length}词 · 近期错词 \${counts.wrong.length}词 · 未学 \${counts.new.length}词</p><div class="start-actions">\${btn('start-words','智能开始','primary',counts.due.length+counts.wrong.length+counts.new.length?'':'disabled')}\${hasSession?btn('resume-words',\`继续上次 · \${session.index} / \${session.queue.length}\`,'text-button'):''}</div><h2 class="section-label vocabulary-label">词表</h2><div class="filter-tabs">\${[['all','全部'],['wrong','错词'],['favorites','收藏'],['mastered','已掌握']].map(([id,name])=>btn('word-filter',name,wordFilter===id?'text-button active':'text-button',\`data-filter="\${id}"\`)).join('')}</div><div class="vocabulary-list">\${visible.length?visible.map(w=>btn('word-detail',\`<span class="word-small">\${w.word}</span><span class="muted">\${esc(w.meaning)}</span>\`,'vocabulary-row',\`data-word="\${w.id}"\`)).join(''):'<p class="muted">这里还没有单词。</p>'}</div>\${hiddenCount?\`<p class="muted">当前仅展示前 \${visible.length} 词，另有 \${hiddenCount} 词仍会参与搜索和训练。</p>\`:''}<p class="source-note">自编基础词组，尚未扩充为完整考研词库。词条可查看词典核对。</p></section>\`,'english');\n}\nfunction startWords(){`
);

replaceRegex(
  'smart start',
  /function startWords\(\)\{\n[\s\S]*?\n\}\nfunction train\(\)\{/,
  `function startWords(){\n const c=wordCounts(),limit=Number($('#new-limit')?.value||12),queue=buildEnglishQueue({dueIds:c.due.map(w=>w.id),wrongIds:c.wrong.map(w=>w.id),newIds:c.new.map(w=>w.id),newLimit:limit,maxTotal:24});if(!queue.length){toast('当前没有待学习单词');return;}\n session={id:newId(),mode,queue,index:0,results:[],startedAt:Date.now()};persistSession();go('train');\n}\nfunction train(){`
);

await writeFile(path, source, 'utf8');
console.log('Applied English smart queue and bounded vocabulary rendering to src/app.js');
