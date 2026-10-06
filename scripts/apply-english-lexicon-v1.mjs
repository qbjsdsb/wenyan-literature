import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/app.js';
let source = await readFile(path, 'utf8');

function replaceText(label, before, after) {
  if (!source.includes(before)) throw new Error(`${label}: expected text not found`);
  source = source.replace(before, after);
}

replaceText(
  'lexicon formatter import',
  "import {displayVariants,wordLearningState} from './english/status.js';",
  "import {displayVariants,wordLearningState} from './english/status.js';\nimport {formatExchange,formatPartOfSpeech} from './english/lexicon.js';"
);

replaceText(
  'detail derived fields',
  "const state=wordLearningState(store.events,id),variants=displayVariants(w.variants);",
  "const state=wordLearningState(store.events,id),variants=displayVariants(w.variants),pos=formatPartOfSpeech(w.pos),exchange=formatExchange(w.exchange);"
);

replaceText(
  'detail grid',
  "<dt>其他拼写</dt><dd>${esc(variants)}</dd><dt>复习次数</dt>",
  "<dt>其他拼写</dt><dd>${esc(variants)}</dd><dt>词性</dt><dd>${esc(pos)}</dd><dt>词形</dt><dd>${esc(exchange)}</dd><dt>复习次数</dt>"
);

replaceText(
  'detail source note',
  "排名、词频和分类来自固定考研词库快照；学习状态来自本机记录。已掌握会移出默认复习队列，可随时恢复。",
  "排名、词频和分类来自固定考研词库快照；音标和词形在有匹配时由固定 ECDICT enrichment 补充；学习状态来自本机记录。已掌握会移出默认复习队列，可随时恢复。"
);

await writeFile(path, source, 'utf8');
console.log('Applied ECDICT enrichment fields to word detail UI');
