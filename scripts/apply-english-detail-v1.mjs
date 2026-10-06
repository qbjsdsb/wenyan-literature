import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/app.js';
let source = await readFile(path, 'utf8');

function replaceText(label, before, after) {
  if (!source.includes(before)) throw new Error(`${label}: expected text not found`);
  source = source.replace(before, after);
}

function replaceRegex(label, pattern, after) {
  if (!pattern.test(source)) throw new Error(`${label}: expected block not found`);
  source = source.replace(pattern, after);
}

replaceText(
  'detail css import',
  "import './style.css';",
  "import './style.css';\nimport './english-detail.css';"
);

replaceText(
  'status import',
  "import {buildEnglishQueue,recentWrongWordIds} from './english/queue.js';",
  "import {buildEnglishQueue,recentWrongWordIds} from './english/queue.js';\nimport {displayVariants,wordLearningState} from './english/status.js';"
);

replaceRegex(
  'word detail function',
  /function wordDetail\(id\)\{[\s\S]*?\}\nfunction exportRecords\(\)\{/,
  `function wordDetail(id){\n const w=words.find(w=>w.id===id);if(!w)return;\n const state=wordLearningState(store.events,id),variants=displayVariants(w.variants);\n const rank=Number.isFinite(w.rank)&&w.rank<90000?String(w.rank):'',frequency=Number.isFinite(w.frequency)&&w.frequency>0?String(w.frequency):'';\n const next=state.state==='mastered'?'已移出默认复习':state.state==='new'?'首次主动回忆后开始排程':state.state==='due'?'现在需要复习':state.due?intervalLabel(state.due):'';\n const tags=[state.label,state.recentWrong?'近期错词':'',state.favorite?'已收藏':''].filter(Boolean);\n openPanel(\`<h2 class="word-small detail-word">\${esc(w.word)}</h2><p class="ipa">\${esc(w.ipa)}</p><p>\${esc(w.meaning)}</p><div class="word-detail-meta">\${tags.map(tag=>\`<span class="\${tag==='近期错词'?'is-wrong':''}">\${esc(tag)}</span>\`).join('')}</div><dl class="word-detail-grid"><dt>考研排名</dt><dd>\${esc(rank?\`#\${rank}\`:'')}</dd><dt>词频</dt><dd>\${esc(frequency)}</dd><dt>分类</dt><dd>\${esc(w.category||'')}</dd><dt>子分类</dt><dd>\${esc(w.subcategory||'')}</dd><dt>其他拼写</dt><dd>\${esc(variants)}</dd><dt>复习次数</dt><dd>\${state.reviewCount?esc(String(state.reviewCount)):''}</dd></dl><p class="word-detail-next muted">\${esc(next)}</p><div class="panel-actions">\${btn('favorite',icon('bookmark-simple')+(state.favorite?' 取消收藏':' 收藏'),'','data-word="'+id+'"')}\${btn('mastered',state.mastered?'恢复复习':'标为已掌握','','data-word="'+id+'"')}\${btn('speak',icon('speaker-high')+' 发音','','data-word="'+id+'"')}</div><p class="source-note">排名、词频和分类来自固定考研词库快照；学习状态来自本机记录。已掌握会移出默认复习队列，可随时恢复。</p><a class="text-link" href="\${w.source}" target="_blank" rel="noopener">词典核对 \${icon('arrow-up-right')}</a>\`);\n}\nfunction exportRecords(){`
);

await writeFile(path, source, 'utf8');
console.log('Applied English word-detail enhancement to src/app.js');
