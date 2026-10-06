import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {readDatabase,waitIndex,resetScope} from './browser-storage.mjs';
import { chromium } from 'playwright';

const baseUrl = process.env.WENYAN_BASE_URL || 'http://127.0.0.1:4173/';
const catalogPayload = JSON.parse(await readFile(new URL('../public/data/english/netem-v1.json', import.meta.url), 'utf8'));
const catalog = catalogPayload.catalog;
const byId = new Map(catalog.map(word => [word.id, word]));
const lowestRankWord = catalog.at(-1);

function scopedKey(scope, key) {
  return `wenyan-${scope}:${key}`;
}

async function readJson(page, scope, key, fallback = null) {
  return page.evaluate(({ storageKey, fallback }) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : fallback;
  }, { storageKey: scopedKey(scope, key), fallback });
}

async function readSession(page,scope='baseline'){return (await readDatabase(page,scope)).session;}
async function readEvents(page,scope='baseline'){return (await readDatabase(page,scope)).events;}

async function waitVocabulary(page) {
  await page.waitForFunction(() => window.__wenyanVocabularyMeta?.status === 'ready');
  return page.evaluate(() => window.__wenyanVocabularyMeta);
}

async function clearScope(page,scope){await resetScope(page,scope);}

async function freshPage(context, scope = 'baseline', hash = 'english') {
  const page = await context.newPage();
  await page.goto(`${baseUrl}?test=${scope}#${hash}`, { waitUntil: 'domcontentloaded' });
  await clearScope(page, scope);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitVocabulary(page);
  return page;
}

async function openOptions(page) {
  if (!(await page.locator('.learning-options').getAttribute('open'))) {
    // An open boolean attribute serializes to an empty string.
    if (!(await page.locator('#new-limit').isVisible())) await page.locator('.learning-options summary').click();
  }
}
async function chooseLayer(page, layer) {
  await openOptions(page);
  await page.locator('#vocab-layer').selectOption(layer);
  await page.waitForFunction(layer => window.__wenyanVocabularyMeta?.layer === layer, layer);
  assert.equal(await page.locator('#vocab-layer').evaluate(el => document.activeElement === el), true, '切层后保持配置键盘焦点');
}
async function startMode(page, mode, newLimit = '6') {
  await page.goto(`${baseUrl}?test=baseline#english`, { waitUntil: 'domcontentloaded' });
  await waitVocabulary(page);
  await openOptions(page);
  await page.locator('#new-limit').selectOption(newLimit);
  await page.locator('.free-practice summary').click();
  await page.locator(`[data-action="mode"][data-mode="${mode}"]`).click();
  await page.locator('[data-action="start-words"]').click();
  await page.waitForURL(/#train$/);
  await page.locator('#word-input').waitFor();
  const session = await readSession(page);
  assert.ok(session?.queue?.length, `${mode} 应创建训练组`);
  return session;
}

async function completeFollowWords(page, count) {
  let completed = 0;
  while (completed < count) {
    const session = await readSession(page);
    assert.ok(session && session.mode === 'follow', '连续输入测试应保持跟打模式');
    assert.ok(session.index < session.queue.length, '连续输入测试不应提前结束');
    const index = session.index;
    const word = byId.get(session.queue[index]);
    assert.ok(word, `应找到训练词 ${session.queue[index]}`);
    await page.locator('#word-input').fill(word.word);
    await waitIndex(page,index);
    completed += 1;
    if (completed < count) await page.locator('#word-input').waitFor();
  }
  return completed;
}

const browser = await chromium.launch({ headless: true });
try {
  // Main state and compatibility smoke.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await freshPage(context);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  let meta = await waitVocabulary(page);
  assert.equal(meta.total, 5528, '固定考研词库应为 5528 个稳定词条');
  assert.equal(meta.layer, 'core');
  await page.locator('#vocab-layer').waitFor({ state: 'attached' });
  assert.equal(meta.active, 1200);

  await chooseLayer(page, 'high');
  await page.waitForFunction(() => window.__wenyanVocabularyMeta?.layer === 'high');
  assert.equal((await waitVocabulary(page)).active, 2444);

  await chooseLayer(page, 'full');
  await page.waitForFunction(() => window.__wenyanVocabularyMeta?.layer === 'full');
  assert.equal((await waitVocabulary(page)).active, 5528);

  await page.locator('[data-action="search"]').first().click();
  await page.locator('#search-input').fill(lowestRankWord.word);
  const fullSearchText = await page.locator('#search-results').innerText();
  assert.ok(fullSearchText.toLowerCase().includes(lowestRankWord.word.toLowerCase()), '完整层应能搜到最低频词');
  await page.locator('[data-action="close-panel"]').click();

  await chooseLayer(page, 'core');
  await startMode(page, 'recall');

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

  // Import the real exported backup into a clean browser context and resume it.
  const importContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const importPage = await freshPage(importContext);
  await importPage.locator('[data-action="settings"]').first().click();
  await importPage.locator('[data-action="import-text"]').click();
  await importPage.locator('#import-text').fill(backupText);
  await importPage.locator('[data-action="import-pasted"]').click();
  await importPage.locator('#panel').waitFor({state:'hidden'});
  const importedEvents = await readEvents(importPage);
  assert.ok(importedEvents.length >= backup.events.length, '导入后应恢复备份中的全部事件');
  const importedSession = await readSession(importPage);
  assert.equal(importedSession?.index, savedIndex, '导入后应恢复未完成 session 位置');
  await importPage.locator('[data-action="resume-words"]').click();
  await importPage.locator('#word-input').waitFor();
  assert.equal((await readSession(importPage)).index, savedIndex, '导入后应能真正继续未完成训练');
  await importContext.close();

  // Core layer must temporarily carry a low-frequency word from an unfinished session.
  const restoreContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const restorePage = await freshPage(restoreContext, 'baseline-restore');
  const seededSession = {
    id: 'browser-smoke-low-frequency',
    mode: 'recall',
    queue: [lowestRankWord.id],
    index: 0,
    results: [],
    startedAt: Date.now()
  };
  await resetScope(restorePage,'baseline-restore');
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
  await restoreContext.close();

  // Follow mode must remain typing-only and survive sustained keyboard input.
  const followContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const followPage = await freshPage(followContext);
  let followSession = await startMode(followPage, 'follow', '24');
  const followFirstId = followSession.queue[0];
  await completeFollowWords(followPage, 24);
  const followEvents = await readEvents(followPage);
  assert.ok(followEvents.some(event => event.kind === 'typing' && event.key === `word:${followFirstId}`), '跟打应记录 typing');
  assert.ok(!followEvents.some(event => event.kind === 'review' && event.key === `word:${followFirstId}`), '跟打不能冒充主动 review');
  await startMode(followPage, 'follow', '6');
  const secondGroup = await readSession(followPage);
  assert.equal(secondGroup.queue.length, 6, '连续训练第二组应按新词额度创建');
  await completeFollowWords(followPage, 6);
  assert.match(followPage.url(), /#results$/, '连续完成 30 词后应正常进入结果页');
  await followContext.close();

  // Listen mode must keep the same correction/rating semantics even if audio is unavailable.
  const listenContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const listenPage = await freshPage(listenContext);
  const listenSession = await startMode(listenPage, 'listen', '6');
  const listenWord = byId.get(listenSession.queue[0]);
  await listenPage.locator('[data-action="hint"]').click();
  await listenPage.locator('#word-input').fill(listenWord.word);
  await listenPage.locator('#word-form').press('Enter');
  await listenPage.locator('[data-action="word-rate"][data-rating="1"]').click();
  const listenEvents = await readEvents(listenPage);
  const listenReview = listenEvents.find(event => event.kind === 'review' && event.key === `word:${listenWord.id}`);
  assert.equal(listenReview?.value?.hinted, true, '听写使用提示后应以 hinted review 记录');
  await listenContext.close();

  const bodyWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  assert.ok(bodyWidth.scroll <= bodyWidth.client + 1, '1440px 桌面视口不应出现横向溢出');
  assert.deepEqual(pageErrors, [], `页面不应出现未捕获异常：${pageErrors.join('\n')}`);

  console.log('Desktop browser smoke passed:', {
    totalWords: meta.total,
    lowestRankWord: lowestRankWord.word,
    backupEvents: backup.events.length,
    importedEvents: importedEvents.length,
    continuousFollowWords: 30
  });
} finally {
  await browser.close();
}

