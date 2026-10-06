import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {readDatabase,settled,waitIndex} from './browser-storage.mjs';
import { chromium } from 'playwright';
import { reviewCard, activeEvents } from '../src/core.js';

const base = process.env.WENYAN_BASE_URL || 'http://127.0.0.1:4173/';
const before = process.argv.includes('--before');
const label = process.env.WENYAN_DEPLOYMENT || 'root';
const output = process.env.WENYAN_SCREENSHOT_DIR || 'browser-evidence';
const catalog = JSON.parse(await readFile(new URL('../public/data/english/netem-v1.json', import.meta.url))).catalog;
const byId = new Map(catalog.map(word => [word.id, word]));
const key = name => `wenyan-baseline:${name}`;
const read = (page, name, fallback = null) => page.evaluate(({ name, fallback }) => JSON.parse(localStorage.getItem(name) || JSON.stringify(fallback)), { name: key(name), fallback });
const session = async page => (await readDatabase(page)).session;
const events = async page => (await readDatabase(page)).events;
const ready = page => page.waitForFunction(() => window.__wenyanVocabularyMeta?.status === 'ready');
async function shot(page, dir, name) {
  await page.screenshot({ path: `${dir}/${name}.png`, animations: 'disabled' });
  const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scrollWidth <= dimensions.width + 1, `${name}: horizontal overflow`);
}
async function importText(page, text) {
  await page.locator('[data-action="settings"]').first().click(); await settled(page);
  await page.locator('[data-action="import-text"]').click(); await settled(page);
  await page.locator('#import-text').fill(text);
  await page.locator('[data-action="import-pasted"]').click(); await settled(page);
  await page.locator('#panel').waitFor({ state: 'hidden' });
}
async function submit(page, word) {
  await page.locator('#word-input').fill(word);
  await page.locator('#word-input').press('Enter'); await settled(page);
}
async function rate(page, rating) {
  const index = (await session(page)).index;
  await page.locator(`[data-action="word-rate"][data-rating="${rating}"]`).click(); await settled(page);
  await waitIndex(page,index);
}
async function finishStep(page) {
  const current = await session(page), id = current.queue[current.index], word = byId.get(id).word;
  if (current.steps[current.index] === 'e') {
    await page.locator('#word-input').fill(word);
    await waitIndex(page,current.index);
  } else {
    await submit(page, word);
    await rate(page, current.current?.hinted || current.current?.firstCorrect === false ? 1 : 3);
  }
}

const browser = await chromium.launch();
const report = [];
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    const dir = `${output}/${before ? 'before' : 'after'}/${label}-${viewport.width}x${viewport.height}`;
    await mkdir(dir, { recursive: true });
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?test=baseline#today`); await ready(page);
    await shot(page, dir, '01-today');
    await page.goto(`${base}?test=baseline#english`); await ready(page);
    await shot(page, dir, '02-english');
    if (before) {
      await page.locator('.vocabulary-row').first().click(); await settled(page);
      await shot(page, dir, '03-detail');
      await page.locator('[data-action="close-panel"]').click(); await settled(page);
      await page.locator('[data-action="settings"]').first().click(); await settled(page);
      await page.locator('#theme').selectOption('dark'); await settled(page);
      await page.locator('[data-action="close-panel"]').click(); await settled(page);
      await shot(page, dir, '04-dark');
      await context.close(); continue;
    }

    // First launch -> Today -> English -> Enter. No mode choice is required.
    await page.locator('.learning-options summary').click(); await settled(page);
    await page.locator('#new-limit').selectOption('6'); await settled(page);
    await page.locator('main').press('Enter'); await settled(page);
    await page.locator('#word-input').waitFor();
    let current = await session(page);
    assert.equal(current.smart, 1);
    const freshId = current.queue[0];
    assert.equal(current.steps[0], 'e');
    await shot(page, dir, '05-exposure');
    // Typed letters must not trigger H/F/M, nor Space as audio while typing.
    await page.locator('#word-input').pressSequentially('hfm ');
    assert.equal((await session(page)).index, 0);
    assert.ok(!(await events(page)).some(event => ['favorite', 'mastered'].includes(event.kind)));
    // Exercise composition guards through DOM events; native OS IME remains a manual check.
    await page.locator('#word-input').dispatchEvent('compositionstart', { data: '' });
    await page.locator('#word-input').fill(byId.get(freshId).word);
    await page.locator('#word-input').dispatchEvent('keydown', { key: 'Enter', isComposing: true });
    assert.equal((await session(page)).index, 0);
    await page.locator('#word-input').dispatchEvent('compositionend', { data: byId.get(freshId).word });
    await waitIndex(page,0);
    assert.equal(reviewCard(await events(page), `word:${freshId}`).reps, 0);
    while ((await session(page)).queue[(await session(page)).index] !== freshId) await finishStep(page);
    current = await session(page);
    assert.equal(current.steps[current.index], 'r');
    assert.ok(current.index >= 4);
    assert.equal(await page.locator('.word-display').count(), 0, 'recall must not show the spelling');
    await shot(page, dir, '06-recall');
    // First miss -> full correction, with refresh in both correction and rating.
    await submit(page, 'zzzz-wrong');
    assert.equal((await session(page)).current.firstCorrect, false);
    await shot(page, dir, '07-correction');
    await page.reload(); await ready(page);
    assert.match(await page.locator('#input-feedback').innerText(), /订正/);
    await submit(page, byId.get(freshId).word);
    await page.reload(); await ready(page);
    assert.equal((await session(page)).current.phase, 'rating');
    assert.equal(await page.locator('[data-rating="3"]').isEnabled(), false);
    await shot(page, dir, '08-rating');
    await rate(page, 1);
    current = await session(page);
    const retryAt = current.queue.lastIndexOf(freshId);
    assert.equal(current.steps[retryAt], 'x');
    assert.ok(retryAt > current.index, 'retry must have intervening words');
    assert.equal(reviewCard(await events(page), `word:${freshId}`).reps, 1);
    // Hints persist immediately; hinted answers never become Good.
    await page.locator('[data-action="favorite-word"]').press('f'); await settled(page);
    assert.equal(await page.locator('[data-action="favorite-word"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-action="mastered-word"]').press('m'); await settled(page);
    assert.equal(await page.locator('[data-action="mastered-word"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-action="mastered-word"]').press('m'); await settled(page);
    await page.locator('[data-action="favorite-word"]').press('h'); await settled(page);
    await page.locator('[data-action="favorite-word"]').press('Space'); await settled(page);
    assert.equal(await page.locator('.word-stage').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.reload(); await ready(page);
    assert.equal((await session(page)).current.hinted, true);
    await shot(page, dir, '09-hint');
    // Pause, Today resume, and a real JSON export/import into another browser.
    await page.locator('#word-input').press('Escape'); await settled(page);
    await page.locator('[data-action="exit-training"]').last().click(); await settled(page);
    await page.goto(`${base}?test=baseline#today`); await ready(page);
    assert.match(await page.locator('.resume-block').innerText(), /英语 · 继续学习/);
    await page.locator('[data-action="settings"]').first().click(); await settled(page);
    await page.locator('[data-action="export"]').click(); await settled(page);
    current = await session(page);
    const backupText = await page.locator('#backup-text').inputValue();
    const exported = JSON.parse(backupText);
    assert.equal(exported.schema, 3);
    const restoredContext = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const restored = await restoredContext.newPage();
    restored.on('pageerror', error => errors.push(String(error)));
    await restored.goto(`${base}?test=baseline#english`); await ready(restored);
    await importText(restored, backupText);
    assert.deepEqual(await session(restored), current);
    await restored.locator('[data-action="resume-words"]').click(); await settled(restored);
    assert.equal((await session(restored)).current.hinted, true);
    let steps = 0, sawRetry = false;
    while ((await session(restored)).index < (await session(restored)).queue.length) {
      current = await session(restored);
      if (current.queue[current.index] === freshId && current.steps[current.index] === 'x') {
        sawRetry = true; await shot(restored, dir, '10-delayed-retry');
      }
      await finishStep(restored);
      assert.ok(++steps < 50, 'bounded session must end');
    }
    assert.ok(sawRetry);
    await restored.waitForURL(/#results$/);
    await shot(restored, dir, '11-results');
    assert.equal((await session(restored)).queue.filter(id => id === freshId).length, 3);
    assert.equal(reviewCard(await events(restored), `word:${freshId}`).reps, 2);
    // Undo must restore the last step and remove its actual review.
    const completed = await session(restored), last = completed.results.at(-1);
    await restored.locator('[data-action="undo"]').click(); await settled(restored);
    await restored.locator('#word-input').waitFor();
    assert.equal((await session(restored)).index, completed.index - 1);
    assert.ok(!activeEvents(await events(restored)).some(event => event.id === last.eventId));
    await finishStep(restored); await restored.waitForURL(/#results$/);
    await restored.locator('a[href="#english"]').first().click(); await settled(restored);
    await restored.waitForURL(/#english$/);
    await restored.locator('.english-page').waitFor();
    // Search keyboard selection, learning detail, favorites / mastered, attribution.
    await restored.locator('main').press('/'); await settled(restored);
    await restored.locator('#search-input').fill('abandon');
    await restored.locator('#search-input').press('ArrowDown'); await settled(restored);
    await restored.locator('.search-result').first().press('Enter'); await settled(restored);
    await restored.locator('.word-detail').waitFor();
    await shot(restored, dir, '12-detail');
    await restored.locator('[data-action="favorite"]').click(); await settled(restored);
    await restored.locator('[data-action="mastered"]').click(); await settled(restored);
    assert.match(await restored.locator('.word-detail').innerText(), /已收藏/);
    assert.match(await restored.locator('.word-detail-next').innerText(), /已掌握/);
    await restored.locator('.word-detail-more summary').first().click(); await settled(restored);
    await restored.locator('.word-detail .source-info summary').click(); await settled(restored);
    assert.match(await restored.locator('.word-detail').innerText(), /CC BY-NC-SA 4.0/);
    await restored.locator('[data-action="close-panel"]').click(); await settled(restored);
    await restored.locator('[data-action="settings"]').first().click(); await settled(restored);
    await shot(restored, dir, '13-settings');
    await restored.locator('#theme').selectOption('dark'); await settled(restored);
    await restored.locator('[data-action="close-panel"]').click(); await settled(restored);
    await shot(restored, dir, '14-dark');
    await restoredContext.close();
    await page.locator('[data-action="close-panel"]').click(); await settled(page);
    await context.close();

    // Due and recent wrong fixtures use the unchanged backup/event schema.
    const dueContext = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const duePage = await dueContext.newPage();
    duePage.on('pageerror', error => errors.push(String(error)));
    await duePage.goto(`${base}?test=baseline#today`); await ready(duePage);
    const dueId = catalog[0].id, wrongId = catalog[1].id;
    const seedEvents = [{ id: 'due-fixture-12345678', kind: 'review', key: `word:${dueId}`, device: 'browser-fixture', at: Date.now() - 30 * 86400000, value: { rating: 3, firstCorrect: true, hinted: false } }, { id: 'wrong-fixture-12345678', kind: 'typing', key: `word:${wrongId}`, device: 'browser-fixture', at: Date.now() - 1000, value: { correct: false } }];
    await importText(duePage, JSON.stringify({ schema: 2, events: seedEvents }));
    assert.match(await duePage.locator('.resume-block').innerText(), /今日复习/);
    await duePage.locator('[data-action="start-smart"]').click(); await settled(duePage);
    current = await session(duePage);
    assert.equal(current.queue[0], dueId); assert.equal(current.steps[0], 'r');
    await shot(duePage, dir, '15-due-recall');
    await finishStep(duePage);
    assert.equal(reviewCard(await events(duePage), `word:${dueId}`).reps, 2);
    assert.ok(!(await events(duePage)).some(event => event.kind === 'typing' && event.key === `word:${dueId}`));
    assert.equal((await session(duePage)).queue[(await session(duePage)).index], wrongId);
    assert.equal((await session(duePage)).steps[(await session(duePage)).index], 'r');
    assert.deepEqual(errors, []);
    report.push({ deployment: label, viewport, newExposureReviewCount: 0, delayedRecall: true, correctionRefresh: true, ratingRefresh: true, backupResume: true, boundedRetry: true, dueReviewCount: 2, applicationErrors: errors });
    await dueContext.close();
  }
  await writeFile(`${output}/${before ? 'before' : 'after'}-${label}.json`, JSON.stringify(report, null, 2));
  console.log('Experience dist matrix passed', label, report.length, 'viewports');
} finally { await browser.close(); }
