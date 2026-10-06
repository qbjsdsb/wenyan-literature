# Wenyan 路线图

Desktop-first、English-first，文学冻结。路线按真实学习闭环推进；不以功能数量衡量。当前完成事实见[开发进度](开发进度.md)，协议见[cloud-implementation](cloud-implementation.md)，长期理由见[研究](research/CLOUD-MCP.md)。当前唯一实施入口是 Draft #14；不自动合并 main。

## 当前原则

- 真实使用优先于继续扩架构。
- 用户现实场景是一人、一台电脑；多设备并发不是上线硬门槛。
- 本地学习先可靠落盘，Supabase 是长期云副本与 ChatGPT 数据源。
- 已经实现的幂等、CAS、fork、冲突保护继续保留，但不为不存在的多设备需求继续增复杂度。
- MCP 先只读；ChatGPT 永远不能伪造 review、修改 FSRS card/due 或删除历史。

## S0 — 英语体验收口

Smart Session / English Experience v2 已在 #12 完成自动验收并被 #14 复用。保留三种自由练习、FSRS、稳定词 ID、首次结果、提示/订正/Undo、键盘体验与 JSON 兼容。本人原生 IME、实际语音和连续多日体验只能靠真实使用反馈，不由远端自动化冒充。

## S1 — Supabase Foundation 与本地协议

已实施 IndexedDB facts/checkpoints/outbox/settings/snapshots/conflicts，同一步学习必须本地事务成功后才推进 UI；Supabase private schema、RLS、owner/live session、commit/pull RPC、固定水位、幂等收据、checkpoint CAS/fork 与设置 CAS 已落地。

完成标准：本地失败不丢学习、旧 v2 可迁移、JSON v3 可恢复、托管 schema/RLS/RPC 真实可用、secret 不进入浏览器/GitHub。

## S2 — 单电脑云同步与恢复闭环

这是当前最重要的上线门槛。

需要证明：
- 正常学习 → IndexedDB → outbox → Supabase。
- 刷新、关页重开后学习状态不丢。
- 断网时继续学习，恢复网络后自动提交。
- 丢 response / 重试不会产生重复 review。
- 一个干净 browser profile 可以从云端恢复已提交状态。
- 私密异地备份可以读回并恢复。
- 版本更新 / Service Worker 不再出现旧 HTML 引用已删除 bundle 的混合版本问题。

两个隔离 browser contexts 只作为恢复/协议自动测试，不代表现实需要两台电脑。真实双电脑同时学习、复杂跨设备冲突不再是 v1 上线硬门槛。

## S3 — 正式访问入口与开始日用

目标：固定 HTTPS 地址打开即可学习。

上线前只要求：
- 当前静态版本和 Service Worker 一致。
- Auth session 可恢复/续签，失效时提示重新登录。
- 本机离线可继续，联网后同步。
- 云备份任务只保留一个，首次实际定时运行成功后记录事实。
- GitHub / 构建产物不包含密码、service_role、token 或真实学习历史。

达到后停止继续“模拟用户”，本人开始真实日用。真实反馈优先决定后续英语优化。

## S4 — Wenyan 只读 MCP + ChatGPT

`wenyan-mcp` 已部署为 Supabase Edge Function，五个只读领域工具源码必须与部署版本一起保存在 GitHub：
- `get_learning_overview`
- `get_review_pressure`
- `get_problem_words`
- `get_word_history`
- `preview_study_session`

MCP 只读取云端已提交事实，不读取本机未同步 outbox；返回必须包含数据截止时间、时区、水位、样本量和缺失信息。

固定授权页面、可选 Auth token hook 和个人 Plugin package 已准备，MCP 授权仍关闭。下一门槛是实际 OAuth：
- 使用官方 Supabase OAuth / MCP 认证能力。
- 专用 resource/audience、真实 owner、live session、批准 client。
- 匿名、错误 audience、其他 client、其他用户和直接 Data API 绕过必须失败。
- OAuth/资源绑定没有真实通过前，`mcp_enabled` 保持关闭。
- 不用无认证 URL、URL secret、service_role 或管理员 token 绕过。

通过 Inspector / 实际 ChatGPT client 验证后，再让本人做一次最小插件安装与 OAuth 同意。

## S5 — 真实使用反馈后的英语改进

不预设大重构。优先从本人实际使用中判断：
- 快速筛词是否必要。
- 新词量是否合适。
- 到期排序是否需要优化。
- TTS / 键盘 / Smart Session 哪些地方真正烦。
- session 历史是否真的需要压缩。
- 长期 review 性能是否真的需要索引/cache。

没有真实痛点就不做。

## S6 — Tutor Skill 与有限可逆写入（按需）

默认保持 MCP 只读。只有真实需求出现时才考虑收藏、当天新词目标、计划草稿等可撤销写入。任何写入都必须明确授权、幂等、revision-aware、可审计、可撤销。

永久禁止 AI：伪造 review/firstCorrect、直接改 FSRS card/due、修改调度参数、删除历史、任意 SQL。

## S7 — 真题与 Learner Model

在词汇真实日用稳定后，从一个最小真题训练模块开始。先保存真实 attempt，再做错因和能力推断；推断必须带样本、窗口、证据、置信度和版本。没有真实题目行为时不建设画像、知识图谱或向量基础设施。

## S8 — 恢复文学

英语持续使用可靠以后再接南师大真题与现当代文学专题；不机械搬旧 1101 条。当前继续冻结。

## 用户参与边界

AI/Work/Codex 负责普通研究、代码、SQL/migrations、测试、部署准备、Git/PR 和文档。本人只在密码/首次登录、OAuth 同意、Plugin 安装、正式发布风险确认、域名/费用等无法代办节点参与；每次只给一个最小动作。

明确不做：多人 SaaS、权限后台、手机专项、框架重写、微服务、production Docker 体系、复杂 CQRS/通用事件平台、自建 OAuth、通用 repository/DI、批量 AI 例句、聊天替代数据库。
