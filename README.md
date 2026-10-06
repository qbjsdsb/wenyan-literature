# Wenyan / 文研

只供本人使用的南京师范大学文学考研工具。当前采用 **Desktop-first + English-first**：先把电脑端英语训练做成每天能稳定使用的个人工具，再恢复文学内容。

项目坚持：**小而美、本地优先、键盘优先、不过度工程化。**

## 当前基线

当前 main 仍是旧版。新版成果此前分散在 PR #2—#10 的 stacked Draft PR 链中。

现在已建立新的整合候选分支：

`integration/desktop-english-baseline-v1`

它把 PR #2—#10 最新有效英语树压成一个干净的 main 候选基线；旧 PR 继续保留历史和审计价值，但后续开发不再继续往那条长链上叠。

PR #1 `content/public-source-audit-v1` 是独立文学内容审计线，当前冻结。

## 英语目前已经做到

### 词库
- NETEMVocabulary 固定版本，不跟随上游 `master` 漂移。
- 上游 5530 行规范化为 **5528 个稳定学习 ID**。
- 核心 1200 / 高频 2444 / 完整 5528 三层。
- 正常运行读取随应用发布的本地固定快照。
- 词库内容与个人学习状态分离。

### 训练闭环
- 跟打 / 默写 / 听写。
- 首次拼错保留，必须完整订正。
- `ts-fsrs` 负责主动回忆复习调度。
- 默认智能队列：`到期复习 → 近期错词 → 新词`。
- 收藏 / 已掌握 / 错词筛选。
- 刷新后继续未完成词组。
- 切换词库层不会丢当前未完成词。
- 有未完成组时不会被“智能开始”覆盖。
- 提示状态会立即持久化，刷新后不会误算成独立回忆成功。

### 单词详情
- 核心中文义。
- 考研排名 / 词频。
- 分类 / 子分类 / 变体。
- 当前学习状态、复习次数、下次复习。
- 固定 ECDICT enrichment 补充音标与词形变化。
- 当前固定 ECDICT 数据没有可靠词性覆盖，因此不展示假数据。

### 学习反馈
- 今日新学。
- 主动复习。
- 当前到期。
- 首次正确率。
- 拼写错误。

统计直接从 `wenyan-events-v2` 派生，不维护第二套统计数据库。

### 可维护性
英语业务配置、`word:<id>` key、错词判定、词库路径和降级数据已经收敛到明确模块；去掉了排名魔法哨兵值，并修复重复词规范化丢义项、测试隔离和子路径部署问题。

## 当前唯一下一步

**现在停止继续堆英语功能。**

顺序固定为：

1. 以当前整合分支做真实桌面浏览器验收。
2. 只修验收发现的 P0 / P1。
3. 自动测试与构建再次绿灯后，将整合基线安全合入 `main`。
4. 提供一个固定电脑端使用入口，让学习记录长期积累在稳定 origin 下。
5. 连续真实使用后，再处理快速筛词、到期排序、session 日志膨胀和长期性能。
6. 只有确实出现多电脑切换需求时，再做单人薄同步。
7. 最后做反复错词 / 高频难词语境强化，再恢复文学。

**当前不再以手机端 / Android 为维护目标。** 不为移动端键盘、安全区、触控布局或手机 TTS 单独开发，除非以后再次明确恢复该需求。

## 先从这里接手

后续 AI / Work 按顺序读取：

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/README.md`](docs/README.md)
3. [`docs/开发进度.md`](docs/开发进度.md) —— 当前状态唯一事实源
4. [`docs/ROADMAP.md`](docs/ROADMAP.md)
5. [`docs/english/PLAN.md`](docs/english/PLAN.md)
6. [`docs/english/VALIDATION.md`](docs/english/VALIDATION.md)
7. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

不要重新从 PR #2 开始逐层开发；旧 stacked PR 只用于追溯历史。

## 运行

Node.js 24+ 只用于开发 / 构建。应用本身仍是 HTML + CSS + Vanilla JavaScript，没有 Node 业务后端或账号系统。

```bash
npm ci
npm run dev -- --port 4173
```

访问：

```text
http://localhost:4173
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

## 当前验证边界

自动测试和构建已经覆盖英语 E1—E4、session 完整性和近期可维护性调整；但最新整合基线仍需要一轮**真实桌面浏览器验收**。

重点检查：
- 1200 / 2444 / 5528 层切换。
- 跟打 / 默写 / 听写连续训练。
- 错词回流、undo 和 FSRS 评分语义。
- 刷新续学、旧 session 兼容。
- 单词详情、音标、词形、统计。
- 连续 30—50 词性能。
- 完整词库搜索 / 滚动。
- JSON 备份恢复。
- 根路径与静态子路径部署。

没实际测过的内容必须继续写“未验证”。
