// 自编学习样本；分析提纲不是官方标准答案。原文链接保留供核对。
export const articles=[
 {id:'narrative',title:'鲁迅小说的叙事艺术',period:'现代文学',author:'luxun',summary:'从叙述者的位置进入作品，再用文本例证展开分析。',sections:[
  {id:'perspective',title:'叙述视角',paragraphs:['阅读鲁迅小说时，可以先辨认叙述者是谁，再观察叙述者与人物之间的距离。叙述视角不仅组织故事，也影响读者如何理解人物。','分析时应回到具体作品：谁在讲述，哪些信息被省略，叙述语气与人物处境形成了怎样的关系。','例如《孔乙己》由酒店小伙计“我”追述故事。复习时应结合具体段落，辨认“我”所见与读者能够推知的内容。'],work:'kongyiji'},
  {id:'character',title:'人物形象',paragraphs:['人物分析需要把语言、动作、处境和叙述评价放在一起。概括性标签可以帮助记忆，但不能代替作品分析。','准备简答时，先提出一个明确判断，再选取具体情节或细节说明。避免只有“国民性”“悲剧性”等术语而没有文本支撑。']},
  {id:'language',title:'语言与反讽',paragraphs:['同一句话可能同时具有字面意思与批判意味。分析反讽时，需要说明说话者、情境以及两种意义之间的距离。','回到《孔乙己》中的对话和笑声，观察叙述怎样呈现人物的困境。这是阅读提示，具体答案仍需要你自行组织。']},
  {id:'argument',title:'把阅读变成论述',paragraphs:['可以按“判断—文本证据—分析—回扣题意”组织一个段落。每个论点选择最能说明问题的例证，不求作品名称越多越好。','练习结束后检查：有没有回答题干？例证是否贴合？是否说明例证怎样支持判断？背诵应保留这些联系。']}
 ],source:'自编阅读与复习提纲；作品事实请结合原文核对。'},
 {id:'avant-garde',title:'先锋小说：从叙事形式进入作品',period:'当代文学',summary:'一次短阅读，关注叙述顺序、视角与形式的作用。',sections:[
  {id:'form',title:'从形式提出问题',paragraphs:['阅读先锋小说时，可以把注意力放在“故事怎样被讲述”上：叙述顺序是否打乱，视角如何变化，哪些信息被延迟交代。','术语只是分析的入口。挑选一个具体片段，说明它怎样改变阅读体验，再讨论这种形式与作品主题之间的关系。']},
  {id:'evidence',title:'准备一段自己的回答',paragraphs:['先选择一部你读过的作品，写下一个叙事特点和一处文本证据。没有读过的作品不要仅凭提纲虚构情节。','本节是学习方法样本，尚未提供具体作品的完整考点。可以用你的教材和阅读笔记补充。']}
 ],source:'自编学习方法样本，非院校真题或标准答案。'}
];
export const authors=[{id:'luxun',name:'鲁迅',years:'1881—1936',genres:'小说、杂文、散文',intro:'本页先收录一组小说阅读样本，供练习叙事分析。作品链接可以与阅读提纲来回查阅。',works:['nahan','kongyiji'],source:'https://www.luxunmuseum.cn/lxcl/index/id/5.html'}];
export const works=[
 {id:'nahan',title:'《呐喊》',author:'luxun',meta:'1923 · 小说集',intro:'鲁迅的第一部小说集。这里先从《孔乙己》进入具体文本阅读。',source:'https://zh.wikisource.org/zh-hans/呐喊'},
 {id:'kongyiji',title:'《孔乙己》',author:'luxun',meta:'小说 · 收入《呐喊》',intro:'阅读时辨认酒店小伙计“我”的叙述位置，留意人物语言、笑声和酒店空间。下面的练习提纲是自编分析提示。',source:'https://zh.wikisource.org/zh-hans/孔乙己'}
];
export const questions=[
 {id:'perspective',article:'narrative',section:0,type:'名词解释',prompt:'什么是叙述视角？',points:['界定：叙述者观察和讲述故事的角度。','展开：说明人物信息如何进入叙述。','例证：选取作品片段，解释具体效果。']},
 {id:'narrator',article:'narrative',section:0,type:'简答',prompt:'怎样从叙述者的位置分析《孔乙己》？',points:['辨认叙述者：“我”是酒店的小伙计。','说明观察范围：结合“我”所见、所闻的具体细节。','回到文本：分析叙述距离怎样影响人物呈现。']},
 {id:'character',article:'narrative',section:1,type:'简答',prompt:'分析人物形象时，怎样组织一个论证段落？',points:['提出明确判断，不只用概括性标签。','选择语言、动作或处境等具体细节。','说明细节怎样支持判断，再回扣题意。']},
 {id:'irony',article:'narrative',section:2,type:'简答',prompt:'分析反讽时，需要交代哪些联系？',points:['说明说话者与具体情境。','辨认字面意思与另一层意味。','解释两种意义之间的距离及其效果。']},
 {id:'essay',article:'narrative',section:3,type:'论述',prompt:'选择鲁迅的一篇小说，论述叙事方式与人物呈现的关系。',points:['明确论点：选定一个具体叙事特点。','提供例证：指出具体片段，不只列作品名。','展开论证：解释叙事特点怎样影响人物呈现。','回扣题意：保持论点、例证与结论之间的联系。']}
];
export { fallbackWords as words } from './english/fallback.js';
