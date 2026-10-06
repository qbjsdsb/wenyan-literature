# Wenyan 结构与数据边界

这不是传统“架构设计文档”。它只固定那些**以后改代码时最容易误伤、但又必须保持清楚的边界**。

## 1. 当前技术形态

Wenyan 当前是轻量静态 Web 应用：
- HTML + CSS + Vanilla JavaScript
- Vite 仅用于开发和构建
- `ts-fsrs` 用于复习调度
- 没有业务 Node 后端
- 没有账号系统
- 没有数据库作为运行前提
- 学习状态本地优先保存

当前只维护桌面浏览器主体验。除非现有方式已经明显妨碍真实使用，否则不要因为“更现代”重写框架。

## 2. 代码地图

### 应用入口与交互
- `src/app.js`：页面渲染、路由、训练交互、设置、搜索等。
- `src/style.css`：整体视觉与布局。
- `src/english-detail.css`：英语详情局部样式。
- `src/english-stats.css`：英语反馈局部样式。
- `index.html`：应用入口。

### 文学内容
- `src/content.js`：当前文学小样、练习等。

文学正式内容当前冻结，不要在英语收口阶段扩张。

### 英语内容与规则
- `src/english-vocab.js`：英语页词库加载与页面装饰层。
- `src/english/catalog.js`：NETEM 词库规范化、分层与兼容逻辑。
- `src/english/config.js`：英语业务配置事实源。
- `src/english/keys.js`：`word:<id>` 生成 / 解析。
- `src/english/events.js`：英语错误事件语义。
- `src/english/fallback.js`：旧 24 个兼容 / 故障降级词。
- `src/english/queue.js`：智能队列与近期错词。
- `src/english/session.js`：未完成英语 session 相关纯逻辑。
- `src/english/status.js`：单词个人学习状态派生。
- `src/english/stats.js`：日学习反馈派生。
- `src/english/lexicon.js`：ECDICT enrichment 合并与格式化。

### 学习状态
- `src/core.js`：事件合法性、FSRS 排程、拼写规范等核心纯逻辑。
- `src/storage.js`：localStorage 保存、测试前缀隔离与多标签合并。
- `src/backup.js`：学习记录导入 / 导出。

这些属于高风险区。修改前先理解现有 schema 和兼容逻辑，修改后必须跑测试。

### 数据快照
- `public/data/english/netem-v1.json`：固定 NETEM 考研词库快照。
- `public/data/english/ecdict-v1.json`：固定 ECDICT enrichment 快照。
- `scripts/sync-english-data.mjs`：确定性生成 NETEM 快照。
- `scripts/sync-english-lexicon.py`：提取 ECDICT enrichment。

内容快照不属于用户学习状态。

### 测试与旧版
- `tests/`：保护学习数据、排程、备份、英语队列 / session / 统计等关键行为。
- `legacy/`：旧版资料，默认保留，不以“清理”为理由删除。
- `evidence/`：历史验收截图，不包含真实个人学习内容。

## 3. 必须保持稳定的数据边界

### 学习事件
主要记录键：`wenyan-events-v2`。

原则：
- 已有事件 ID 不重写。
- 合并优先去重，不静默覆盖已有学习记录。
- 无法读取时不静默清空。
- schema 变化必须先设计向后兼容或迁移。

### 英语单词 ID
稳定 ID 使用规范化英文单词本身，并继续以 `word:<id>` 进入学习记录。

因此：
- 换词库不能随意换 ID。
- 已有收藏、已掌握、复习记录和未完成 session 必须继续找到对应单词。
- 外部词库只提供内容，不拥有学习状态。
- 大小写规范化重复词保持同一稳定学习 ID，但内容可合并义项。

### 未完成训练
英语 session 属于续学体验。任何重构都要检查：
- 刷新后能否继续。
- 关闭页面后能否继续。
- 切词库层后能否继续。
- 导出 / 导入后能否继续。
- 提示和首次答题结果是否保持。

## 4. 内容与来源边界

正式学习内容必须区分：
1. **事实源 / 原始证据**：官方信息、教材、原典、真题、论文等。
2. **Wenyan 自编整理**：摘要、提纲、题目映射、复习提示。
3. **第三方数据**：英语词频 / 音标等，必须保留许可与来源。

AI 可以整理和表达，但不能把自己当知识来源。

## 5. 页面结构边界

一级入口保持：
- 今日
- 知识
- 训练

新功能优先挂在现有入口下，不轻易增加一级导航。

设计基准继续参考 `docs/design/selected-reference.png`。除非真实桌面使用证明现方向有问题，否则不要重新做视觉系统。

## 6. 当前已知结构债

### 已收敛的英语渲染边界（Experience v2）

`english-vocab.js` 只负责异步快照 / enrichment、层级、兼容与 carryover。导出 `initializeVocabulary({getPendingWordIds})`、`getVocabularyState()`、`activeLearningIds()`、`changeEnglishLayer()`、`findEnglishWord()`、`searchEnglishWords()`。

`app.js` 显式初始化，加载完成收到 `wenyan-vocabulary-loaded` 后重渲染；所有词库 UI 一次由 app.js 渲染。移除 MutationObserver 和 session 全局 hook。只读 `__wenyanVocabularyMeta` 保留给既有 smoke / 诊断，不作为业务状态接口。全词库搜索不切换活动层；carryover 不进入正式新词池。

`english/smart.js` 是组计划和步骤完成 / undo / 组反馈的领域逻辑；`english/session.js` 包含可选 Smart 计划校验和旧 session helper。core 只校验 optional plan，不导入 queue，避免领域依赖环。

Smart 计划复用 session 的 queue/index/results，追加 `smart:1` 与紧凑 `steps` 字符串；当前步骤可含 `phase`。既有 schema、queue 50 / event value 8192 限制不变，预算预留接触与一次回流。没有第二套数据库或派生 FSRS 存储。

### session 历史增长
当前 session 更新会追加状态事件。长期使用前要观察备份体积和存储增长。

不要现在就引入复杂事件压缩系统；真实数据证明有问题后，再设计只压缩可替代 session 状态、不伤害 review 历史的方案。

### review 重放性能
`reviewCard()` 会基于历史 review 计算状态。

只有长期真实数据证明打开英语页明显变慢，才考虑派生索引 / cache。

## 7. 可选同步边界

当前不把云同步作为近期必做。

如果以后真实出现多电脑切换需求，同步仍应只是薄层：
- 学习动作先落本地。
- 同步稳定事件或等价可合并状态。
- 稳定 ID 去重。
- 失败不阻塞本地学习。
- JSON 备份始终保留。

不要先建完整用户中心、权限系统或复杂同步协议。

## 8. 什么时候才值得拆文件或升级架构

满足至少一个条件再做：
- 单个文件已经明显难以安全修改。
- 同一模块存在多个独立生命周期。
- 测试或复用确实被当前结构阻碍。
- 真实桌面性能数据证明当前实现不够。

“看起来更规范”本身不是拆分理由。

