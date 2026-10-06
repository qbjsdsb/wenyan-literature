import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.WENYAN_BASE_URL || 'http://127.0.0.1:4173/';
const catalogPayload = JSON.parse(await readFile(new URL('../public/data/english/netem-v1.json', import.meta.url), 'utf8'));
const catalog = catalogPayload.catalog;
const byId = new Map(catalog.map(word => [word.id, word]));
const lowestRankWord = catalog.at(-1);

function scopedKey(scope, key) {
  return `wenyan-${scope}:${key}`;
}

async function readSession(page, scope = 'baseline') {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), scopedKey(scope, 'wenyan-session'));
}

async function waitVocabulary(page) {
  await page.waitForFunction(() => window.__wenyanVocabularyMeta?.status === 'ready');
  return page.evaluate(() => window.__wenyanVocabularyMeta);
}

async function clearScope(page, scope) {
  await page.evaluate(prefix => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    }
  }, `wenyan-${scope}:`);
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.goto(`${baseUrl}?test=baseline#english`, { waitUntil: 'domcontentloaded' });
  await clearScope(page, 'baseline');
  await page.reload({ waitUntil: 'domcontentloaded' });

  let meta = await waitVocabulary(page);
  assert.equal(meta.total, 5528, '固定考研词库应为 5528 个稳定词条');
  assert.equal(meta.layer, 'core');
  await page.locator('#vocab-layer').waitFor();
  assert.match(await page.locator('.page-heading .muted').innerText(), /核心学习集/);

  await page.locator('#vocab-layer').selectOption('high');
  await page.waitForFunction(() => window.__wenyanVocabularyMeta?.layer === 'high');
  assert.match(await page.locator('.page-heading .muted').innerText(), /高频学习集 · 2444词/);

  await page.locator('#vocab-layer').selectOption('full');
  await page.waitForFunction(() => window.__wenyanVocabularyMeta?.layer === 'full');
  assert.match(await page.locator('.page-heading .muted').innerText(), /完整学习集 · 5528词/);

  await page.locator('[data-action="search"]').first().click();
  await page.locator('#search-input').fill(lowestRankWord.word);
  const fullSearchText = await page.locator('#search-results').innerText();
  assert.ok(fullSearchText.toLowerCase().includes(lowestRankWord.word.toLowerCase()), '完整层应能搜到最低频词');
  await page.locator('[data-action="close-panel"]').click();

  await page.locator('#vocab-layer').selectOption('core');
  await page.waitForFunction(() => window.__wenyanVocabularyMeta?.layer === 'core');
  await page.locator('[data-action="mode"][data-mode="recall"]').click();
  await page.locator('#new-limit').selectOption('6');
  await page.locator('[data-action="start-words"]').click();
  await page.waitForURL(/#train$/);
  await page.locator('#word-input').waitFor();

  let session = await readSession(page);
  assert.ok(session && session.queue.length >= 1 && session.queue.length <= 24, '智能开始应创建有效训练组');
  const firstWord = byId.get(session.queue[0]);
  assert.ok(firstWord, '训练词必须来自固定词库');

  await page.locator('#word-input').fill('zzzz-not-the-word');
  await page.locator('#word-form').press('Enter');
  assert.match(await page.locator('#input-feedback').innerText(), /拼写需要订正/);
  await page.locator('#word-input').fill(firstWord.word);
  await page.locator('#word-form').press('Enter');
  await page.locator('[data-action="word-rate"][data-rating="1"]').click();
  await page.locator('#word-input').waitFor();

  session = await readSession(page);
  assert.equal(session.index, 1, '完成首词后应推进到下一词');
  const savedIndex = session.index;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitVocabulary(page);
  await page.locator('#word-input').waitFor();
  session = await readSession(page);
  assert.equal(session.index, savedIndex, '刷新后应继续同一未完成词组');

  await page.locator('[data-action="hint"]').click();
  session = await readSession(page);
  assert.equal(session.current?.hinted, true, '点击提示应立即持久化 hinted');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitVocabulary(page);
  session = await readSession(page);
  assert.equal(session.current?.hinted, true, '刷新后 hinted 不应丢失');

  await page.locator('[data-action="exit-training"]').click();
  await page.waitForURL(/#english$/);
  await page.locator('[data-action="resume-words"]').waitFor();
  assert.equal(await page.locator('[data-action="start-words"]').count(), 0, '有未完成组时不应出现新的智能开始按钮');
  await page.locator('[data-action="resume-words"]').click();
  await page.locator('#word-input').waitFor();
  session = await readSession(page);
  assert.equal(session.index, savedIndex, '继续上次不能覆盖当前训练组');

  await page.locator('[data-action="exit-training"]').click();
  await page.locator('[data-action="settings"]').first().click();
  await page.locator('[data-action="export"]').click();
  const backupText = await page.locator('#backup-text').inputValue();
  const backup = JSON.parse(backupText);
  assert.ok(Array.isArray(backup.events) && backup.events.length > 0, '浏览器导出应包含学习事件');

  const restorePage = await context.newPage();
  await restorePage.goto(`${baseUrl}?test=baseline-restore#english`, { waitUntil: 'domcontentloaded' });
  await clearScope(restorePage, 'baseline-restore');
  const seededSession = {
    id: 'browser-smoke-low-frequency',
    mode: 'recall',
    queue: [lowestRankWord.id],
    index: 0,
    results: [],
    startedAt: Date.now()
  };
  await restorePage.evaluate(({ sessionKey, layerKey, seededSession }) => {
    localStorage.setItem(sessionKey, JSON.stringify(seededSession));
    localStorage.setItem(layerKey, 'core');
  }, {
    sessionKey: scopedKey('baseline-restore', 'wenyan-session'),
    layerKey: scopedKey('baseline-restore', 'wenyan-english-layer-v1'),
    seededSession
  });
  await restorePage.goto(`${baseUrl}?test=baseline-restore&run=2#train`, { waitUntil: 'domcontentloaded' });
  meta = await waitVocabulary(restorePage);
  await restorePage.locator('#word-input').waitFor();
  assert.equal(meta.layer, 'core');
  assert.ok(meta.carryover >= 1, '核心层应临时保留未完成 session 的低频词');
  assert.equal((await readSession(restorePage, 'baseline-restore')).queue[0], lowestRankWord.id);

  const bodyWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  assert.ok(bodyWidth.scroll <= bodyWidth.client + 1, '1440px 桌面视口不应出现横向溢出');
  assert.deepEqual(pageErrors, [], `页面不应出现未捕获异常：${pageErrors.join('\n')}`);

  console.log('Desktop browser smoke passed:', {
    totalWords: meta.total,
    lowestRankWord: lowestRankWord.word,
    backupEvents: backup.events.length
  });
} finally {
  await browser.close();
}
