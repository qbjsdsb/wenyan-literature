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

现在不继续堆新训练模式。

顺序固定为：
1. **提供固定电脑端访问入口。**
2. 开始连续真实使用，让学习记录在稳定 origin 下长期积累。
3. 下一个优先功能：**快速筛词**，用真实个人判断淘汰已经掌握的基础词，而不是再写硬编码黑名单。
4. 再根据真实数据决定：到期排序、session 日志压缩、长期性能优化。
5. 只有出现真实多电脑需求时才做单人薄同步。
6. 再做反复错词 / 高频难词语境强化。
7. 最后恢复文学。

当前不维护 Android / iOS 专项体验。

## 接手顺序

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/README.md`](docs/README.md)
3. [`docs/开发进度.md`](docs/开发进度.md) —— 当前状态唯一事实源
4. [`docs/ROADMAP.md`](docs/ROADMAP.md)
5. [`docs/english/PLAN.md`](docs/english/PLAN.md)
6. [`docs/english/VALIDATION.md`](docs/english/VALIDATION.md)
7. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

从 `main` 开始新工作，不要再从 PR #2—#10 旧链续接。

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

稳定边界：
- 稳定事件 ID。
- `word:<规范化英文单词>`。
- 收藏 / 已掌握事件语义。
- 英语未完成 session。
- 首次正确 / 错误 / hinted 结果。
- JSON 备份兼容。
- `ts-fsrs` 历史。

每次学习动作先写本机。手动 JSON 导入 / 导出继续作为重要兜底。

## 第三方数据

考研词频与中文释义来自固定版本 `exam-data/NETEMVocabulary`，数据许可为 CC BY-NC-SA 4.0。详见 [`docs/third-party/NETEMVocabulary-DATA.md`](docs/third-party/NETEMVocabulary-DATA.md)。

ECDICT 只用于结构化 enrichment（当前主要是音标和词形变化），不替换 NETEM 中文释义，也不批量导入例句正文。详见 `docs/third-party/`。

英语交互参考 Qwerty Learner、TypeWords、Clozemaster 等成熟产品，但不直接混入会改变本仓库许可义务的 GPL 程序代码。
