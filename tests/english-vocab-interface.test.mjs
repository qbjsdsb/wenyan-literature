import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { words } from '../src/content.js';

const seed = words.map(word => ({ ...word }));
const payload = JSON.parse(await readFile(new URL('../public/data/english/netem-v1.json', import.meta.url)));
const lexicon = JSON.parse(await readFile(new URL('../public/data/english/ecdict-v1.json', import.meta.url)));
const storage = new Map();
globalThis.location = { search: '?test=baseline' };
globalThis.window = new EventTarget();
globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };

test('explicit catalog initialization waits for enrichment, carries pending words and renders through one notification', async () => {
  const pendingId = payload.catalog.at(-1).id;
  const oldSession = JSON.stringify({ mode: 'recall', queue: [pendingId], index: 0, results: [] });
  storage.set('wenyan-baseline:wenyan-session', oldSession);
  storage.set('wenyan-baseline:wenyan-events-v2', '[]');
  let resolveLexicon, loaded = 0;
  const onLoaded = () => loaded++;
  window.addEventListener('wenyan-vocabulary-loaded', onLoaded);
  globalThis.fetch = async url => ({ ok: true, json: () => String(url).includes('ecdict') ? new Promise(resolve => { resolveLexicon = resolve; }) : Promise.resolve(payload) });
  const api = await import('../src/english-vocab.js?interface-ready');
  const initialization = api.initializeVocabulary({ getPendingWordIds: () => [pendingId] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(api.getVocabularyState().status, 'loading');
  assert.equal(storage.get('wenyan-baseline:wenyan-session'), oldSession);
  resolveLexicon(lexicon);
  await initialization;
  assert.equal(loaded, 1);
  assert.equal(api.getVocabularyState().active, 1200);
  assert.equal(api.getVocabularyState().total, 5528);
  assert.ok(api.getVocabularyState().carryover >= 1);
  assert.equal(api.findEnglishWord(pendingId).id, pendingId);
  assert.ok(!api.activeLearningIds().has(pendingId));
  assert.equal(api.searchEnglishWords(payload.catalog.at(-1).word)[0].id, pendingId);
  const state = api.getVocabularyState(); state.total = 0;
  assert.equal(api.getVocabularyState().total, 5528, 'interface snapshots are detached');
  api.changeEnglishLayer('full');
  assert.equal(api.getVocabularyState().active, 5528);
  api.changeEnglishLayer('core');
  assert.ok(words.some(word => word.id === pendingId));
  assert.equal(storage.get('wenyan-baseline:wenyan-session'), oldSession);
  assert.equal(storage.get('wenyan-baseline:wenyan-events-v2'), '[]');
  window.removeEventListener('wenyan-vocabulary-loaded', onLoaded);
  words.splice(0, words.length, ...seed);
});

test('failed async catalog load retains legacy words, session and learning records', async () => {
  const originalSession = storage.get('wenyan-baseline:wenyan-session');
  globalThis.fetch = async () => { throw Error('offline fixture'); };
  const api = await import('../src/english-vocab.js?interface-offline');
  await api.initializeVocabulary({ getPendingWordIds: () => [payload.catalog.at(-1).id] });
  assert.equal(api.getVocabularyState().status, 'sample');
  assert.equal(words.length, seed.length);
  assert.equal(storage.get('wenyan-baseline:wenyan-session'), originalSession);
  assert.equal(storage.get('wenyan-baseline:wenyan-events-v2'), '[]');
});
