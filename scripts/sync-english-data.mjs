import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  NETEM_SOURCE_COMMIT,
  NETEM_SOURCE_FILE,
  NETEM_SOURCE_REPO,
  catalogFromPayload,
  isCompleteCatalog
} from '../src/english/catalog.js';

const sourceUrl = `https://raw.githubusercontent.com/${NETEM_SOURCE_REPO}/${NETEM_SOURCE_COMMIT}/${NETEM_SOURCE_FILE}`;
const response = await fetch(sourceUrl, { headers: { 'user-agent': 'wenyan-literature-data-sync' } });
if (!response.ok) throw new Error(`NETEMVocabulary download failed: HTTP ${response.status}`);

const payload = await response.json();
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
  count: catalog.length,
  catalog
};

const text = `${JSON.stringify(snapshot)}\n`;
const sha256 = createHash('sha256').update(text).digest('hex');
const meta = {
  schema: 1,
  generatedFrom: sourceUrl,
  sourceCommit: NETEM_SOURCE_COMMIT,
  count: catalog.length,
  sha256
};

await mkdir('public/data/english', { recursive: true });
await writeFile('public/data/english/netem-v1.json', text, 'utf8');
await writeFile('public/data/english/netem-v1.meta.json', `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
console.log(`Wrote ${catalog.length} NETEM words from ${NETEM_SOURCE_COMMIT.slice(0, 12)} (${sha256.slice(0, 12)}…)`);
