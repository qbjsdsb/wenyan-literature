import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  NETEM_SOURCE_COMMIT,
  NETEM_SOURCE_FILE,
  NETEM_SOURCE_REPO,
  catalogFromPayload,
  catalogRowsFromPayload,
  isCompleteCatalog,
  normalizeWordId
} from '../src/english/catalog.js';

const sourceUrl = `https://raw.githubusercontent.com/${NETEM_SOURCE_REPO}/${NETEM_SOURCE_COMMIT}/${NETEM_SOURCE_FILE}`;
const response = await fetch(sourceUrl, { headers: { 'user-agent': 'wenyan-literature-data-sync' } });
if (!response.ok) throw new Error(`NETEMVocabulary download failed: HTTP ${response.status}`);

const payload = await response.json();
const rows = catalogRowsFromPayload(payload);
const sourceCount = rows.length;
const seen = new Set();
const duplicateIds = [];
for (const row of rows) {
  const id = normalizeWordId(row?.['单词'] ?? row?.word);
  if (!id) continue;
  if (seen.has(id) && !duplicateIds.includes(id)) duplicateIds.push(id);
  seen.add(id);
}

const catalog = catalogFromPayload(payload);
if (!isCompleteCatalog(catalog)) throw new Error(`NETEMVocabulary incomplete after normalization: ${catalog.length}`);

const snapshot = {
  schema: 1,
  source: {
    repository: NETEM_SOURCE_REPO,
    commit: NETEM_SOURCE_COMMIT,
    file: NETEM_SOURCE_FILE,
    license: 'CC BY-NC-SA 4.0'
  },
  sourceCount,
  uniqueCount: catalog.length,
  duplicateIds,
  catalog
};

const text = `${JSON.stringify(snapshot)}\n`;
const sha256 = createHash('sha256').update(text).digest('hex');
const meta = {
  schema: 1,
  generatedFrom: sourceUrl,
  sourceCommit: NETEM_SOURCE_COMMIT,
  sourceCount,
  uniqueCount: catalog.length,
  duplicateIds,
  sha256
};

await mkdir('public/data/english', { recursive: true });
await writeFile('public/data/english/netem-v1.json', text, 'utf8');
await writeFile('public/data/english/netem-v1.meta.json', `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
console.log(`Wrote ${catalog.length} stable NETEM words from ${sourceCount} source rows; merged duplicate ids: ${duplicateIds.join(', ') || 'none'}; source ${NETEM_SOURCE_COMMIT.slice(0, 12)} (${sha256.slice(0, 12)}…)`);
