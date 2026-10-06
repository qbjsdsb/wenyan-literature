# Wenyan / 文研

只供本人使用的南京师范大学文学考研工具。目标是：**开发快、小而美、长期使用舒服，真正帮助每天复习、回忆、答题和写作。**

电脑端偏键盘、阅读和输入；手机端偏触控和连续练习。项目坚持本地优先、单人使用、不过度工程化。

## 当前状态

当前开发线由三个相互独立/叠加的 Draft PR 组成：

- **PR #1**：内容审计与公开资料基线，维护来源、旧内容审计和 P0 内容方向。
- **PR #2**：Web v0.1 极简工作台基线，已验证本地学习闭环。
- **PR #3**：在 v0.1 上接入真实考研英语词频词库，仍需运行与 Android 真机验收。

当前稳定产品骨架仍是 Web v0.1：

- **今日**：继续阅读、未完成词组/回忆、到期复习与短任务入口。
- **知识**：专题阅读、作家作品、搜索、章节和段落续读、阅读外观。
- **训练**：先回忆再看参考提纲；文学名词解释/简答/论述自评；英语跟打、默写、听写、错词订正。
- **本机备份**：导出 JSON 或复制完整备份文字；导入后合并去重并恢复续学。

文学内容目前仍是小样，下一阶段重点是 **P0 现当代文学专题 + 2023—2026 真题关联**。英语已从 24 个演示词升级为真实考研词库接入，但 PR #3 在完成运行验收前保持 Draft。

## 先从这里接手

后续 AI / Work / 开发者不要从猜测开始：

1. [`AGENTS.md`](AGENTS.md) — 开发原则与禁止过度工程化边界。
2. [`docs/README.md`](docs/README.md) — 文档总导航。
3. [`docs/开发进度.md`](docs/开发进度.md) — **当前状态唯一事实源**。
4. [`docs/ROADMAP.md`](docs/ROADMAP.md) — 下一步优先级与完成标准。
5. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 数据、模块和兼容边界。

## 英语词汇

英语训练交互参考 Qwerty Learner、TypeWords 等成熟打字背词产品，但不复制其 GPL 程序代码。Wenyan 继续使用自身 MIT 代码，并保留：

- 跟打、默写、听写
- 首次答错记录与强制订正
- 收藏、已掌握
- 到期优先、新词限额
- FSRS 复习安排
- 半组刷新续学

词频与中文释义来自 [`exam-data/NETEMVocabulary`](https://github.com/exam-data/NETEMVocabulary)。上游说明该数据以 2024 考研英语（一）大纲 5530 词为基础，并结合约 200 套四六级、考研英语、专四专八试卷文本排序；数据许可为 CC BY-NC-SA 4.0。完整说明见 [`docs/third-party/NETEMVocabulary-DATA.md`](docs/third-party/NETEMVocabulary-DATA.md)。

首次联网会下载完整目录并缓存在当前浏览器；失败时自动回退到原有 24 词，不阻塞学习。为避免手机一次渲染 5530 行并控制长期复习计算成本，当前先激活词频靠前的 1200 词，同时强制保留旧版 24 个种子词以兼容历史记录。

## 运行

Node.js 24+ 只用于开发/构建。应用本身是 HTML + CSS + Vanilla JavaScript；没有 Node 业务后端和账号系统。

```bash
npm ci
npm run dev -- --port 4173
```

访问 `http://localhost:4173`。源码使用 ES 模块与已有字体/FSRS 依赖，不要直接双击源码 `index.html`。

```bash
npm test
npm run build
npm start -- --port 4173
```

构建得到 `dist/`，可由任意静态服务器运行：

```bash
python3 -m http.server 8000 --directory dist
```

## 数据保存

文学小样在 `src/content.js`；英语扩展词库由 `src/english-vocab.js` 运行时加载。

个人学习状态保存在当前浏览器 localStorage，主要键为 `wenyan-events-v2`。每次学习动作先保存本机，刷新/重开保留，英语半组与阅读位置可续接。原有 `wenyan-progress-v1` 保留，旧版位于 `legacy/`。

考研词汇完整目录使用独立缓存键 `wenyan-netem-catalog-v1`，不混入学习记录备份；缓存丢失后可重新获取。词条 ID 继续使用规范化英文单词，旧 v0.1 的复习记录、收藏和未完成训练不因换词库被重写。

沿用 schema 2 事件记录与 `ts-fsrs`。跟打只记输入练习，回忆自评才影响排程；首次错误不会因订正刷新变成正确。

在“偏好与备份”导出；换浏览器或设备后导入可手动继续。重复导入不增加相同记录。错误备份整份拒绝；保存失败会提示导出，不假报成功。

目前**没有自动云同步**。不同浏览器、设备、域名或端口的存储各自独立；无痕窗口/清理浏览器数据会影响保存，请定期备份。

## 验证与边界

Web v0.1 基线：

- 8 项 Node 自带测试通过。
- `npm run build` 通过。
- 真实浏览器走通阅读、回忆、英语订正、刷新续学、备份文字恢复和文件导入。
- 360 / 393 / 412 / 768 / 1366 / 1440px 及 430px 短视口已检查。

具体见 [`docs/web-v0.1-validation.md`](docs/web-v0.1-validation.md)。

英语词库升级保持原学习记录 schema，不复制 GPL 项目代码。新增运行时词库层仍需在合并前验证：首次联网加载、缓存后二次启动、断网降级、旧 session 兼容和 Android 长词表性能。

视口夹具不等于真实 Android 系统键盘/语音/安全区测试；没验证的项目必须明确写“未验证”。

## 仓库结构

```text
.
├── README.md              # 产品入口
├── AGENTS.md              # 后续 AI / 开发规则
├── src/                   # 当前 Web 应用
├── tests/                 # 关键状态与设备检查
├── scripts/               # 小型辅助脚本
├── legacy/                # 保留的旧版资料
├── evidence/              # 与验收对应的截图证据
├── docs/
│   ├── README.md          # 文档导航
│   ├── 开发进度.md       # 当前状态唯一事实源
│   ├── ROADMAP.md         # 迭代顺序与完成标准
│   ├── ARCHITECTURE.md    # 稳定边界
│   ├── design/            # 设计基准与 QA
│   └── third-party/       # 第三方来源与许可证
└── .github/
    └── pull_request_template.md
```

不要为了“整理”随意删除 `legacy/`、学习兼容代码或验证证据。

## 下一阶段

按 [`docs/ROADMAP.md`](docs/ROADMAP.md) 执行：

1. 完成英语词汇 v1 的真实运行 / 真机验收。
2. 接入 P0 现当代文学专题与 2023—2026 真题关联。
3. 让“今日”由真实学习状态驱动。
4. 再做一个人的薄云同步。
5. 连续使用后只针对真实痛点优化交互、排程和视觉。

MIT。字体、图标、FSRS 与第三方数据许可说明统一放在 `docs/third-party/`。
