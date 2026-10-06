const POS_LABELS = Object.freeze({
  n: '名词', v: '动词', a: '形容词', j: '形容词', r: '副词', d: '副词', p: '介词', c: '连词', u: '感叹词', m: '数词', q: '量词', x: '其他'
});

const EXCHANGE_LABELS = Object.freeze({
  p: '过去式', d: '过去分词', i: '现在分词', '3': '第三人称单数', r: '比较级', t: '最高级', s: '复数', '0': '原形', '1': '派生'
});

export function applyLexiconEnrichment(catalog, payload) {
  const entries = payload?.entries && typeof payload.entries === 'object' ? payload.entries : {};
  return catalog.map(item => {
    const extra = entries[item.id];
    if (!extra) return item;
    return {
      ...item,
      ipa: extra.phonetic || item.ipa || '',
      pos: extra.pos || '',
      exchange: extra.exchange || ''
    };
  });
}

export function formatPartOfSpeech(value) {
  if (!value) return '';
  return String(value)
    .split('/')
    .map(part => {
      const [code, weight] = part.split(':');
      const label = POS_LABELS[code] || code;
      return weight ? `${label} ${weight}%` : label;
    })
    .filter(Boolean)
    .join(' · ');
}

export function formatExchange(value) {
  if (!value) return '';
  return String(value)
    .split('/')
    .map(part => {
      const colon = part.indexOf(':');
      if (colon < 1) return part;
      const code = part.slice(0, colon);
      const word = part.slice(colon + 1);
      if (!word) return '';
      return `${EXCHANGE_LABELS[code] || code} ${word}`;
    })
    .filter(Boolean)
    .join(' · ');
}
