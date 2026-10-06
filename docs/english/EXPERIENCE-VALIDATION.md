# English Experience v2 · 验收证据

2026-10-06（UTC）。PR #12 保持 Draft，没有 merge / 发布。

实施前先核对远端 main：`5ed504ef28d78f443071af999adcaced5b30f6f8`，再从 main 创建 `feature/english-experience-v2`。前后比较的 main 构建也在 CI 中重新 checkout；实际 head 留在 [before-main-head.txt](../../evidence/english-experience-v2/before-main-head.txt)。

## 实际验证

- 本地 Node 24：56 项 `npm test` 全过，`npm run build` 成功。
- [标准 CI](https://github.com/qbjsdsb/wenyan-literature/actions/runs/37492999170)：成功。
- [生产构建 Chromium 验收](https://github.com/qbjsdsb/wenyan-literature/actions/runs/37492999349)：成功，代码 head `04d9aa45a0130e6eba75e86e8c3fcf8629e18850`。
- [完整截图 artifact](https://github.com/qbjsdsb/wenyan-literature/actions/runs/37492999349/artifacts/11426147657)：94 个文件，包含两条部署路径全部三尺寸截图、main 比较截图与报告。代表截图另外保留在仓库，避免只依赖临时 artifact。
- `tests/browser-smoke.mjs` 保留旧组 / 低频词跨层续学、层级加载 / 搜索、自由跟打连续 30 词、自由默写 / 听写与 JSON 恢复覆盖。
- `tests/experience-smoke.mjs` 新增 Smart 真实 UI 闭环与桌面截图矩阵。所有被服务的页面来自 `npm run build` 的 dist，使用 Python 静态服务；没有把 dev server 当生产验收。

| 正式 dist 路径 | 1366×768 | 1440×900 | 1920×1080 |
| --- | --- | --- | --- |
| `/` | 全流程通过 | 全流程通过 | 全流程通过 |
| `/desktop/` | 全流程通过 | 全流程通过 | 全流程通过 |

机器报告：[root](../../evidence/english-experience-v2/after-root.json)、[subpath](../../evidence/english-experience-v2/after-subpath.json)。六组均无应用 pageerror / console error，无横向溢出。

## Smart 闭环的观察与断言

| 用户行为 / 状态 | 真实浏览器结果 |
| --- | --- |
| 首次打开 → 今日 → 英语 | 今日主入口为英语，首页直接 Enter 开始，无模式选择前置 |
| 新词首次接触 | 英文 / 音标 / 中文义；完整跟打后只产生 typing，FSRS reps 为 0 |
| 新词稍后回忆 | 至少隔 3 个其他词步骤；只显示中文义，输入英文后产生第一条 review |
| 答错 → 完整订正 | 答案显示，输入清空；从首字母完整重输；首次错误仍为 false |
| 订正 / 自评时刷新 | 恢复 correction / rating，同一步位置和首次结果仍存在 |
| 错误自评 | Good 禁用；Enter 继续按 Again，不能把订正当独立答对 |
| 延后错词回流 | r 失败插入一次 x，前面有其他词；新词最多接触 / 回忆 / 回流各一次，组必定结束 |
| 提示 / 发音提示 | H / Space（输入框外）标记 hinted；立即保存，刷新仍为 true；不能记录虚假的 Good |
| 训练键盘 | 输入中的 h/f/m/空格不触发快捷操作；输入框外 F / M 能写收藏 / 已掌握；M 可再次恢复 |
| composing 防误触 | DOM compositionstart / composing Enter 不切词；compositionend 后正常处理输入 |
| 暂停 / 返回 / 今日续学 | Esc 暂停，退出保存；今日优先显示继续英语，原组不被覆盖 |
| JSON 导出 → 新 browser context 导入 | schema 2，完整步骤 / current / queue / index 恢复；可以继续到同一组结果页 |
| 完成 / 结果 / Undo | 反馈区分新学 / 主动回忆 / 首次正确 / 订正 / 需要再想；Undo 实际撤销 review，恢复最后步骤，重做后正常结束 |
| 到期 FSRS 词 | 默认第一步为 r，无英文答案；独立答对新增 review，fixture 的 FSRS reps 从 1 到 2；没有 typing 冒充完成 |
| 近期错词 | 跟在到期词后直接 r；不先跟打 |
| 搜索 / 详情 / 收藏 / 已掌握 | / → ↑↓ → Enter 打开详情；状态可操作；更多信息与许可展开仍存在 |
| 暗色 / reduced-motion | 暗色页可用；reduce 时 word-stage 的 animationName 为 none |

Node 领域测试还覆盖：旧 session 原模式恢复、Smart plan 校验拒绝损坏的新计划、hint 与 firstCorrect 不被订正覆盖、Undo 删除它引入的回流、备份去重、最长实际词 ID 与真实 UUID 长度下的 50 步 / 8192 字符边界；新词目标 24 时会分组，不扩大原事件限制。

词库接口测试覆盖：等待 enrichment 后通知一次，pending 低频词 carryover、层级切换、全库搜索、正式新词池不含 carryover，以及断网失败时不清空旧词 / session / 学习事件。

## 视觉 QA

Cloud Browser 在修改前真实走过今日、英语主页、三模式、订正、自评、结果、详情、搜索、设置、浅 / 暗，见 [实施前审计](EXPERIENCE-AUDIT.md)。本轮人工复查了修改后的 Smart 输入、订正刷新、自评刷新、搜索键盘、详情收藏 / 已掌握、暗色主页和暗色训练。

CI 比较截图：

| 页面 | 1366×768 修改前 / 后 | 1440×900 修改前 / 后 | 1920×1080 修改前 / 后 |
| --- | --- | --- | --- |
| 今日 | [前](../../evidence/english-experience-v2/matrix/before/1366x768/01-today.png) / [后](../../evidence/english-experience-v2/matrix/after/1366x768/01-today.png) | [前](../../evidence/english-experience-v2/matrix/before/1440x900/01-today.png) / [后](../../evidence/english-experience-v2/matrix/after/1440x900/01-today.png) | [前](../../evidence/english-experience-v2/matrix/before/1920x1080/01-today.png) / [后](../../evidence/english-experience-v2/matrix/after/1920x1080/01-today.png) |
| 英语 | [前](../../evidence/english-experience-v2/matrix/before/1366x768/02-english.png) / [后](../../evidence/english-experience-v2/matrix/after/1366x768/02-english.png) | [前](../../evidence/english-experience-v2/matrix/before/1440x900/02-english.png) / [后](../../evidence/english-experience-v2/matrix/after/1440x900/02-english.png) | [前](../../evidence/english-experience-v2/matrix/before/1920x1080/02-english.png) / [后](../../evidence/english-experience-v2/matrix/after/1920x1080/02-english.png) |
| 详情 | [前](../../evidence/english-experience-v2/matrix/before/1366x768/03-detail.png) / [后](../../evidence/english-experience-v2/matrix/after/1366x768/12-detail.png) | [前](../../evidence/english-experience-v2/matrix/before/1440x900/03-detail.png) / [后](../../evidence/english-experience-v2/matrix/after/1440x900/12-detail.png) | [前](../../evidence/english-experience-v2/matrix/before/1920x1080/03-detail.png) / [后](../../evidence/english-experience-v2/matrix/after/1920x1080/12-detail.png) |
| 暗色 | [前](../../evidence/english-experience-v2/matrix/before/1366x768/04-dark.png) / [后](../../evidence/english-experience-v2/matrix/after/1366x768/14-dark.png) | [前](../../evidence/english-experience-v2/matrix/before/1440x900/04-dark.png) / [后](../../evidence/english-experience-v2/matrix/after/1440x900/14-dark.png) | [前](../../evidence/english-experience-v2/matrix/before/1920x1080/04-dark.png) / [后](../../evidence/english-experience-v2/matrix/after/1920x1080/14-dark.png) |

视觉结论：英语从模式 / 配置 / 五统计前置改为单个学习主动作；今日主线反映英语状态；训练单词与输入更近，1366 高度内评分和进度可见，1920 没有把内容无限拉宽；详情学习操作前置，工程信息折叠。保留字体、灰绿、rail 与现有 dialog，没有新增卡片网格、渐变、玻璃拟态或复杂动画。没有证据需要右侧 inspector，因此保留中央 dialog。

组首次正确率按每词首个主动回忆计算；今日统计保留原 review 尝试口径（延后回流是新一次主动回忆），两者分母不同，不改旧事件含义。

## 已知边界 / 未验证

- P0：本轮验收未发现未解决的阻断项。
- P1：本人电脑的实际扬声器 / 系统语音、Windows / macOS 原生 IME、连续 20—30 分钟学习与多日真实使用尚未验证。DOM composing 测试不代表原生 IME 已全面验收。
- P2：组尾无可间隔词时，错词留到下一组；极小剩余新词池的间隔可能小于 3；24 新词目标可能拆为 16 + 下一组。这些属于保留有界与兼容限制的产品选择。
- P2：到期词内部逾期排序、session 日志增长、万级历史性能仍后置。新 Smart 备份在旧 v1 前端的步骤理解未作为兼容承诺；本轮保证新前端读旧备份 / session，以及 Smart 在新前端 round-trip。
- 测试使用隔离 browser context / `?test=baseline`；没有导入或清空本人正式学习记录。
- Cloud Browser 观察到的错误仅来自其 chrome-extension 元数据回传；CI 没有这些扩展，应用错误数组为空。发音错误通过 UI 提供提示入口，没有声称听到了真实扬声器输出。
- Mobbin 因计划权限未能使用；参考只使用官方项目 / 手册原则，没有导入第三方界面代码或截图。

## 第三方数据边界

NETEMVocabulary / ECDICT 快照、词 ID、源 commit、许可、加工方式完全不改。NETEMVocabulary 仍为 CC BY-NC-SA 4.0，ECDICT 仍为 MIT，仅结构化补全，不导入正文或例句。首页和详情折叠区保留完整 attribution；原 `docs/third-party/` 保留。没有 AI 例句或词根新数据。

下一步已明确为快速筛词：1 已掌握 / 2 模糊 / 3 不会，见 ROADMAP。本轮没有实现筛词，也没有发布。
