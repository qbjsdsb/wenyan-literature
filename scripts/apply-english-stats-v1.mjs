import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/app.js';
let source = await readFile(path, 'utf8');

function replaceText(label, before, after) {
  if (!source.includes(before)) throw new Error(`${label}: expected text not found`);
  source = source.replace(before, after);
}

replaceText(
  'stats css import',
  "import './english-detail.css';",
  "import './english-detail.css';\nimport './english-stats.css';"
);

replaceText(
  'stats import',
  "import {formatExchange,formatPartOfSpeech} from './english/lexicon.js';",
  "import {formatExchange,formatPartOfSpeech} from './english/lexicon.js';\nimport {englishDailyStats} from './english/stats.js';"
);

replaceText(
  'english stats computation',
  "const counts=wordCounts(),hasSession=session&&session.index<session.queue.length,wrongIds=new Set(counts.wrong.map(w=>w.id));",
  "const counts=wordCounts(),daily=englishDailyStats(store.events),hasSession=session&&session.index<session.queue.length,wrongIds=new Set(counts.wrong.map(w=>w.id));"
);

replaceText(
  'english stats insertion',
  '<p class="muted">到期 ${counts.due.length}词 · 近期错词 ${counts.wrong.length}词 · 未学 ${counts.new.length}词</p><div class="start-actions">',
  '<p class="muted">到期 ${counts.due.length}词 · 近期错词 ${counts.wrong.length}词 · 未学 ${counts.new.length}词</p><div class="english-stats" aria-label="今日英语学习反馈"><div class="english-stat"><strong>${daily.newLearned}</strong><span>今日新学</span></div><div class="english-stat"><strong>${daily.reviewed}</strong><span>主动复习</span></div><div class="english-stat"><strong>${counts.due.length}</strong><span>当前到期</span></div><div class="english-stat"><strong>${daily.firstCorrectRate==null?\'—\':daily.firstCorrectRate+\'%\'}</strong><span>首次正确</span></div><div class="english-stat"><strong>${daily.spellingErrors}</strong><span>拼写错误</span></div></div><div class="start-actions">'
);

await writeFile(path, source, 'utf8');
console.log('Applied compact English daily stats UI to src/app.js');
