import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLexiconEnrichment, formatExchange, formatPartOfSpeech } from '../src/english/lexicon.js';

test('applies only selected lexicon fields without replacing NETEM meaning', () => {
  const catalog = [{ id: 'abandon', word: 'abandon', meaning: '放弃', rank: 1 }];
  const payload = { entries: { abandon: { phonetic: "ə'bændən", pos: 'v:90/n:10', exchange: 'p:abandoned/i:abandoning' } } };
  const [word] = applyLexiconEnrichment(catalog, payload);
  assert.equal(word.meaning, '放弃');
  assert.equal(word.ipa, "ə'bændən");
  assert.equal(word.pos, 'v:90/n:10');
  assert.equal(word.exchange, 'p:abandoned/i:abandoning');
});

test('missing lexicon entry keeps original object data', () => {
  const catalog = [{ id: 'abandon', word: 'abandon', meaning: '放弃', ipa: '/seed/' }];
  const [word] = applyLexiconEnrichment(catalog, { entries: {} });
  assert.equal(word.ipa, '/seed/');
  assert.equal(word.meaning, '放弃');
});

test('formats weighted part-of-speech codes for reading', () => {
  assert.equal(formatPartOfSpeech('n:46/v:54'), '名词 46% · 动词 54%');
  assert.equal(formatPartOfSpeech('a'), '形容词');
  assert.equal(formatPartOfSpeech(''), '');
});

test('formats common exchange codes', () => {
  assert.equal(
    formatExchange('p:perceived/d:perceived/i:perceiving/3:perceives'),
    '过去式 perceived · 过去分词 perceived · 现在分词 perceiving · 第三人称单数 perceives'
  );
  assert.equal(formatExchange(''), '');
});
