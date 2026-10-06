# Wenyan / 文研

只供本人使用的南京师范大学文学考研工具。当前策略是 **Desktop-first + English-first**：先把电脑端英语训练做成每天稳定使用的个人工具，再恢复文学内容。

项目坚持：**小而美、本地优先、键盘优先、不过度工程化。**

## 当前正式基线

`main` 已于 2026-10-06 收入 **Desktop English Baseline v1**。

来源：PR #11，squash merge 后主线提交：

`c01cee9512398d805f13163bc4b7e96b99c19d58`

此前 PR #2—#10 的有效英语成果已被 #11 收拢；旧 PR 仅保留历史追溯价值，不再作为开发父链。PR #1 是独立文学内容审计线，继续冻结。

## 英语当前能力

### 词库
- 固定 NETEMVocabulary 版本，不跟随上游 `master` 漂移。
- 上游 5530 行规范化为 **5528 个稳定学习 ID**。
- 核心 1200 / 高频 2444 / 完整 5528 三层。
- 词库随应用发布，本地即可加载。
- 兼容词与未完成 session 的 carryover 不污染正式层级计数。

### 训练
- 跟打 / 默写 / 听写。
- 首次拼错保留，必须完整订正。
- `ts-fsrs` 负责主动回忆调度。
- 智能队列：`到期 → 近期错词 → 新词`。
- 收藏 / 已掌握 / 错词筛选 / undo。
- 刷新续学。
- 切换词库层不丢未完成词。
- 未完成组不会被“智能开始”覆盖。
- hinted / 首次答题状态可跨刷新保持。

### 单词详情与反馈
- 中文义、考研排名 / 词频、分类 / 子分类 / 变体。
- 固定 ECDICT enrichment：音标与词形变化。
- 当前学习状态、复习次数、下次复习。
- 今日新学、主动复习、当前到期、首次正确率、拼写错误。

统计直接从 `wenyan-events-v2` 派生，不维护第二套统计数据库。

### 备份
- JSON 导出 / 导入。
- 学习事件、收藏、已掌握和未完成 session 可恢复。
- Chromium smoke 已验证真实“导出 → 干净 browser context 导入 → 继续未完成训练”。

## 验证状态

PR #11 合并前已经通过：
- `npm ci`
- `npm test`
- `npm run build`
- Chromium 对真实 `dist` 的桌面 smoke
- 根路径部署
- `/desktop/` 子路径部署
- 1200 / 2444 / 5528 层级
- 完整词库搜索
- 三种训练模式的关键状态语义
- 刷新续学 / hinted / 未完成组保护
- 低频词跨层续学
- JSON 备份恢复
- 连续 30 词跟打

合并到 `main` 后，push CI 也再次成功。

详细证据见 [`docs/english/VALIDATION.md`](docs/english/VALIDATION.md)。

## 当前下一步

当前运行版仍是本地桌面英语v1。Smart Session / English Experience v2 在 [Draft PR #12](https://github.com/qbjsdsb/wenyan-literature/pull/12)，已通过其最新CI/浏览器矩阵，尚未合并。

[Draft PR #13](https://github.com/qbjsdsb/wenyan-literature/pull/13) 只研究下一阶段：**静态Wenyan + IndexedDB本地即时保存 + Supabase长期事实/Auth + 只读Wenyan MCP + ChatGPT推理**。没有实现云端、安装插件或发布。

用户尚未开始正式使用，没有需要迁移的真实学习历史。schema 2不作为永久协议；云基础允许有理由的一次升级，保留Smart Session、FSRS、稳定word ID、首次结果与JSON备份。

顺序：英语体验收口 → 云基础与学习状态 → 多电脑/离线/备份 → 固定正式入口 → 只读MCP/个人Plugin → 按需可逆写入 → 真题与有证据的Learner Model。文学与手机专项冻结。

理由与来源见 [云端与MCP研究](docs/research/CLOUD-MCP.md)，完成标准见 [ROADMAP](docs/ROADMAP.md)。不新增网站AI聊天框，不自建OAuth，不让ChatGPT拥有学习事实。

## 接手顺序

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/README.md`](docs/README.md)
3. [`docs/开发进度.md`](docs/开发进度.md) —— 当前状态唯一事实源
4. [`docs/ROADMAP.md`](docs/ROADMAP.md)
5. [`docs/english/PLAN.md`](docs/english/PLAN.md)
6. [`docs/english/VALIDATION.md`](docs/english/VALIDATION.md)
7. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

新工作先核对远端 `main` 与进行中的 #12 / #13；两者独立，不粗暴覆盖。不要从 PR #2—#10 旧链续接。

## 运行

Node.js 24+ 只用于开发 / 构建；应用本身仍是 HTML + CSS + Vanilla JavaScript，没有 Node 业务后端或账号系统。

```bash
npm ci
npm run dev -- --port 4173
```

验证：

```bash
npm test
npm run build
```

## 数据保存

个人学习状态当前保存在浏览器 localStorage，核心事件键为 `wenyan-events-v2`。

当前运行版保护的边界（下一阶段存储协议可按明确设计升级）：
- 稳定事件 ID。
- `word:<规范化英文单词>`。
- 收藏 / 已掌握事件语义。
- 英语未完成 session。
- 首次正确 / 错误 / hinted 结果。
- JSON 备份兼容。
- `ts-fsrs` 历史。

每次学习动作先写本机。JSON导入/导出长期保留。下一阶段云权威与本地outbox尚未实现；不把“本机已存”称为“已同步”。真实学习数据与secret不进入公共Git。

## 第三方数据

考研词频与中文释义来自固定版本 `exam-data/NETEMVocabulary`，数据许可为 CC BY-NC-SA 4.0。详见 [`docs/third-party/NETEMVocabulary-DATA.md`](docs/third-party/NETEMVocabulary-DATA.md)。

ECDICT 只用于结构化 enrichment（当前主要是音标和词形变化），不替换 NETEM 中文释义，也不批量导入例句正文。详见 `docs/third-party/`。

英语交互参考 Qwerty Learner、TypeWords、Clozemaster 等成熟产品，但不直接混入会改变本仓库许可义务的 GPL 程序代码。
