// Compatibility/failure fallback only. The normal learning catalog comes from the
// versioned NETEM snapshot under public/data/english.
const rows = [
  ['abandon','əˈbændən','放弃；抛弃'],['ability','əˈbɪləti','能力'],['abstract','ˈæbstrækt','抽象的'],['academic','ˌækəˈdemɪk','学术的'],
  ['achieve','əˈtʃiːv','实现；达到'],['acquire','əˈkwaɪə','获得；习得'],['adapt','əˈdæpt','适应；改编'],['adequate','ˈædɪkwət','足够的'],
  ['admire','ədˈmaɪə','钦佩'],['advantage','ədˈvɑːntɪdʒ','优势'],['advocate','ˈædvəkeɪt','提倡；拥护'],['affect','əˈfekt','影响'],
  ['alternative','ɔːlˈtɜːnətɪv','可供选择的；替代方案'],['ambiguous','æmˈbɪɡjuəs','含糊的；有歧义的'],['analyze','ˈænəlaɪz','分析'],['apparent','əˈpærənt','明显的；表面的'],
  ['approach','əˈprəʊtʃ','接近；方法'],['appropriate','əˈprəʊpriət','合适的'],['argument','ˈɑːɡjumənt','论点；争论'],['assess','əˈses','评估'],
  ['assume','əˈsjuːm','假定；认为'],['attitude','ˈætɪtjuːd','态度'],['aware','əˈweə','意识到的'],['coherent','kəʊˈhɪərənt','连贯的']
];

export const fallbackWords = rows.map(([word, ipa, meaning]) => ({
  id: word,
  word,
  ipa: `/${ipa}/`,
  meaning,
  source: `https://dictionary.cambridge.org/dictionary/english/${word}`
}));
