# Wenyan / 文研

只供本人使用的南京师范大学文学考研工具。目标是：**开发快、小而美、长期使用舒服，真正帮助每天学习。**

电脑端偏键盘与输入；手机端偏触控与连续练习。项目坚持本地优先、单人使用、不过度工程化。

## 当前状态

当前路线是 **English-first**。文学内容和文学真题暂时冻结，先把英语做成可以每天稳定使用、电脑手机连续学习的工具。

当前最新完整英语开发版本在：

`feature/english-session-integrity-v1`（PR #8 之上的 session 完整性修复线）

完整 stacked 开发链：

```text
main
→ PR #2 Web v0.1
→ PR #3 真实考研词库初版
→ PR #4 仓库维护基线
→ PR #5 英语核心 v2
→ PR #6 单词详情
→ PR #7 音标 / 词形增强
→ PR #8 轻量学习反馈
→ session 完整性修复线
```

PR #1 是独立文学内容审计线，English-first 阶段冻结。

## 英语目前已经做到

### 词库
- NETEMVocabulary 固定版本，不再跟随上游 `master` 漂移。
- 上游 5530 行规范化为 **5528 个唯一词条**。
- 三层学习范围：核心 1200 / 高频 2444 / 完整 5528。
- 正常运行优先使用随应用发布的本地固定快照。
- 词库内容与个人学习状态分离，不把完整目录塞进 localStorage。

### 学习闭环
- 跟打 / 默写 / 听写。
- 首次拼错保留，必须完整订正。
- `ts-fsrs` 负责主动回忆复习调度。
- 默认智能队列：`到期复习 → 近期错词 → 新词`。
- 收藏 / 已掌握 / 错词筛选。
- 刷新后继续未完成词组。

### 单词详情
- 核心中文义。
- 考研排名 / 词频。
- 分类 / 子分类 / 变体。
- 当前学习状态、复习次数、下次复习。
- ECDICT 固定版本补充音标与词形变化。
- 当前固定 ECDICT 数据的词性覆盖为 0，因此不冒充已经支持词性。

### 学习反馈
- 今日新学。
- 主动复习。
- 当前到期。
- 首次正确率。
- 拼写错误。

这些统计直接从 `wenyan-events-v2` 派生，不维护第二套统计数据库。

## 最新 P0 修复

代码复核确认并已修复三个 session 完整性问题：

1. **切换词库层 / 异步加载不会丢未完成词。** 未完成 session 剩余词会临时保留在活动词表，完成后仍按所选层学习。
2. **未完成词组不能被“智能开始”覆盖。** 有未完成组时主入口直接继续当前组。
3. **提示状态立即持久化。** 点击提示，或默写中通过发音获得提示后，尚未提交就刷新，`hinted` 仍然保留，不会被错误统计成独立回忆成功。

同时修复了一个相关启动竞态：直接恢复到 `#train` 时，如果正式词库还在异步载入，不再清空 session，而是保留记录等待词库准备完成。

这些修复通过了“应用补丁 → `npm test` → `npm run build` → 成功后才提交”的自动流程。

## 当前下一步

现在**不要继续堆英语功能**。顺序固定为：

1. 按 [`docs/english/VALIDATION.md`](docs/english/VALIDATION.md) 做真实桌面浏览器与 Android 验收。
2. 修复验收发现的 P0/P1 问题。
3. 收拢当前 stacked PR，形成一个可靠 `main` 基线。
4. 提供固定个人访问入口，避免电脑/手机不断更换 origin。
5. 做单人薄云同步：本地先写，电脑 ↔ 手机同步学习事件、未完成 session 和少量偏好。
6. 连续真实使用后，再做反复错词 / 高频难词的语境强化。
7. 英语稳定后恢复文学开发。

**云同步现在排在语境训练之前。** 对当前真实使用场景，电脑背一会、手机继续，比先扩充大量例句更重要。

## 先从这里接手

后续 AI / Work 不要重新规划：

1. [`AGENTS.md`](AGENTS.md) — 开发原则和禁止过度工程化边界。
2. [`docs/README.md`](docs/README.md) — 文档总导航。
3. [`docs/开发进度.md`](docs/开发进度.md) — **当前状态唯一事实源**。
4. [`docs/ROADMAP.md`](docs/ROADMAP.md) — 后续顺序和完成标准。
5. [`docs/english/PLAN.md`](docs/english/PLAN.md) — 英语产品原则。
6. [`docs/english/VALIDATION.md`](docs/english/VALIDATION.md) — 当前真实设备验收清单。
7. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 稳定数据边界。

## 运行

Node.js 24+ 只用于开发 / 构建。应用本身仍是 HTML + CSS + Vanilla JavaScript，没有 Node 业务后端或账号系统。

```bash
npm ci
npm run dev -- --port 4173
```

访问 `http://localhost:4173`。

```bash
npm test
npm run build
```

## 数据保存

个人学习状态保存在浏览器 localStorage，核心事件键为 `wenyan-events-v2`。

稳定边界：
- 稳定事件 ID。
- `word:<规范化英文单词>`。
- 收藏 / 已掌握事件语义。
- 英语未完成 session。
- 首次正确 / 错误结果。
- JSON 备份兼容。
- `ts-fsrs` 历史。

每次学习动作先写本机。手动 JSON 导入 / 导出继续保留为兜底；自动跨设备同步尚未实现。

## 第三方数据

考研词频与中文释义来自 `exam-data/NETEMVocabulary` 固定版本，数据许可为 CC BY-NC-SA 4.0。详见 [`docs/third-party/NETEMVocabulary-DATA.md`](docs/third-party/NETEMVocabulary-DATA.md)。

ECDICT 只用于结构化 enrichment（当前主要是音标和词形变化），不替换 NETEM 的中文释义，也不批量导入例句正文。详见 `docs/third-party/`。

英语交互参考 Qwerty Learner、TypeWords、Clozemaster 等成熟产品，但不直接混入会改变本仓库许可义务的 GPL 程序代码。

## 验证边界

自动测试和构建已经覆盖英语 E1—E4 与最新 session 修复，但**自动测试不等于 Android 真机已通过**。

仍需真实验证：
- 1200 / 2444 / 5528 层切换。
- 跟打 / 默写 / 听写连续使用。
- 错词回流和 undo。
- 刷新续学和旧 session 兼容。
- Android 软键盘、TTS、短视口。
- 连续 30—50 词性能。
- 手机完整词库搜索 / 滚动。

没实际测过的内容必须继续写“未验证”。
