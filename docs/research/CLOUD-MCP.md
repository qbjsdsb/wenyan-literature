# Wenyan 云端学习事实与 ChatGPT 集成研究

核验日期：2026-10-07（Asia/Shanghai）。本文件是设计结论和依据，不代表已实现。当前状态只维护在 [开发进度](../开发进度.md)，边界见 [ARCHITECTURE](../ARCHITECTURE.md)，阶段见 [ROADMAP](../ROADMAP.md)。

## 1. 决策

选定 **现有静态 Wenyan + IndexedDB 本地提交/outbox + Supabase Postgres/Auth + 一个薄的 Edge Function MCP**。

Wenyan 保存可导出、可追溯的学习事实；Supabase 是联网后的长期权威副本；ChatGPT 是可更换的推理与辅导客户端。离线未同步操作也是真实事实，不能因为云端尚未收到就丢弃。网站不新增 AI 聊天框，不需要 OpenAI API key，不维护第二份聊天式“学习数据库”。

本轮只定方向，不创建项目、表、函数或插件，不改英语运行代码。先收口 #12，再做薄云基础；MCP 在云状态可靠之后。快速筛词可独立推进，但不再为了它永久锁死 schema 2。

### 方案比较

能力事实来自末尾官方来源；取舍是本项目判断，不是供应商排名。

| 方案 | 优点 | 本项目额外负担 | 判断 |
| --- | --- | --- | --- |
| 纯 localStorage + 手动 JSON | 零云服务，代码已存在 | 跨电脑搬文件；ChatGPT 无法读未打开的电脑；缺云权威 | 保留兜底，不满足目标 |
| Supabase 托管 | SQL事务、RLS、Auth、OAuth Server、Edge可在一个服务完成 | 仍需outbox/冲突；免费暂停与备份责任 | 选定，总维护成本较低 |
| Firebase Auth + Firestore | 内置离线持久化/同步 | 同文档默认最后写入胜出不适合整组session；MCP授权仍需额外边界 | 可行，但不足以抵消迁移与身份接入成本 |
| Workers + D1 | 轻量托管SQL与函数 | 身份提供商、MCP授权与同步仍需配置 | 已有成熟Cloudflare身份基础才值得重评 |
| PocketBase/SQLite自托管 | 后端紧凑可控 | 运行、升级、备份、OAuth由项目负责；v1前兼容风险 | 不把备考时间换成运维时间 |
| Anki + AnkiConnect替代Wenyan | 成熟SRS与同步 | 增加本机Anki依赖，改变已验证打字与Smart体验；不是天然远端服务 | 借鉴边界，不依赖它运行 |

不引入 PowerSync/RxDB/CRDT、Realtime必需链、向量库、队列服务、自建OAuth。若真实多设备冲突或数据量证明薄同步不够，再独立比较同步引擎，不能长期维护越来越复杂的自制协议。

## 2. 恢复的实现与可复用部分

开工 main `5ed504ef28d78f443071af999adcaced5b30f6f8`。桌面 v1 已合入；[Draft #12](https://github.com/qbjsdsb/wenyan-literature/pull/12) head `6426f071c068324d7b8e59c513f13c36505cba05` 是英语体验 v2，尚未合并。最新 [CI](https://github.com/qbjsdsb/wenyan-literature/actions/runs/37495578644) 与 [Chromium矩阵](https://github.com/qbjsdsb/wenyan-literature/actions/runs/37495579282) 成功。#1文学审计冻结，旧#2—#10不再作父链。

| 现有代码 | 观察 | 云基础处理 |
| --- | --- | --- |
| core.js | id/device/kind/key/at/value；按at/ID合并，重复ID首份胜出 | 保留语义，加严格同ID同内容验证、版本与来源；当前merge不是云协议 |
| storage.js | localStorage整包读写，多标签先读后合并 | 改IDB事务；旧localStorage仅作为导入来源与小偏好 |
| backup.js | schema 2整包事件，无outbox/身份/游标 | 新备份分事实/checkpoint/设置；不含token；v2仅一次性导入适配 |
| reviewCard() | 有效review重放ts-fsrs；enable_fuzz:false；Again/Good（1/3） | 保留算法，固定版本/参数/排序；不突然换四档评分 |
| app.js | 完整session快照反复追加；review/checkpoint分开写 | checkpoint独立；一步的事实+checkpoint+outbox原子提交 |
| #12 english/smart.js | 接触只typing，回忆才review；错误/hinted按Again；有限回流/Undo | 复用，步骤有稳定attempt ID；e/r/x分别是独立学习步骤 |
| word:<id>/静态快照 | 5528稳定ID，版本化内容 | ID不改，不上传成5528行用户数据 |

用户未正式使用、无真实历史，允许一次有理由的协议升级。本轮不改v2；实施前重新检查，若期间开始学习则有备份迁移，不能依据今天声明以后清空。继承#12的真实首次答题、hint、订正、自评、刷新续学及备份测试。

## 3. 数据职责与最小模型

| 数据 | 长期位置 | 本地位置 | 可重建性 |
| --- | --- | --- | --- |
| 首次提交、提示、完成typing/recall、撤销、收藏/mastered判断 | 云学习事实，稳定ID/时间/来源/版本 | confirmed cache + outbox | 原始观察不能猜回 |
| 进行中queue/steps/index/current/firstCorrect/hinted/phase | 云最新checkpoint+session元数据 | 当前工作checkpoint，即时事务保存 | 不能仅靠完成review恢复 |
| 完成组 | 起止/模式/内容/算法版本，结果引用事实 | cache | 统计可重算，不留每版整组快照 |
| FSRS card/due、错词、统计 | 云可重建投影与revision | 同算法投影+未同步事实叠加 | 可重建，不能替代review历史 |
| 新词目标、活动词库层、时区 | 云少量学习设置 | cache与离线改动 | 人工意图不是统计推断 |
| 主题、声音、voice、焦点、输入草稿 | 本机偏好/内存 | 本机 | 不同步；原始逐键输入默认不保存 |
| 5528词库/ECDICT/许可/固定题面 | Git版本化静态内容；私有媒体以后用Storage | 静态缓存 | 从指定内容版本恢复 |
| AI诊断/建议 | 首版只在对话；以后存被接受建议及证据 | 非必需 | 换模型重算，不覆盖事实 |

四个领域表候选：`study_events`（长期事实）、`study_sessions`（元数据/最新checkpoint）、`learner_settings`（学习设置和同步计数）、`word_state`（稀疏FSRS/状态投影）。这是职责草案，不提前冻结SQL。收藏与mastered是可撤销人工判断，不另造收藏库；设备ID用于溯源，不是身份。Learner Model与真题attempts不现在建空表。

事实至少回答：谁在什么设备/session/step，对哪个稳定内容版本做哪种训练，首次结果/是否提示，发生时间，写入来源，撤销/纠错引用。

- 首次尝试/提示发生时持久保存；中断attempt保持未完成，不能自动算失败或成功。
- 完成review是唯一调度输入；接触、订正、读解释、AI说“你会了”都不等于独立回忆。
- event ID用于重试幂等；attempt ID用于同一呈现步骤唯一性。r/x为不同attempt，不按同词同日去重。
- 同ID/attempt同内容返回原收据；不同内容拒绝并保留冲突副本，不随意选首份。
- Undo引用明确事实，保留原观察，投影排除。不可撤销撤销，不跨owner，不指向不存在记录；未同步撤销按依赖上传。
- v2缺少的时长/原始错误拼写/提示次数/review session ID记unknown，不由AI补历史。
- 分开backup/event/checkpoint/content/scheduler version与parameter epoch。一个schema整数不代表所有兼容关系。
- 新云协议上线冻结旧云写入口，低版本停止同步；旧构建可隔离本地打开，不承诺任意版本双向写。
- v2导入先校验/预览计数/暂存/备份，保留稳定word/event ID；无个人数据则新建干净v3，不建设多年双写兼容。

## 4. 同步与冲突

不互相覆盖全量JSON，不每次回车等服务器。

1. 一步完成时IDB事务保存事实、checkpoint、outbox、本地投影，commit成功再进下一题；失败停在本步。
2. 后台上传有界小批；服务器提交后ack。丢响应/重启保留原ID重试，未ack永远保留。
3. 云mutation短事务验证身份/版本/依赖，去重，提交事实与checkpoint，更新受影响投影并返回收据。少量固定RPC，不做通用命令框架。
4. 增量拉事实；学习设置与仍可续学的session少，可每次拉当前快照。事实游标与checkpoint revision分开，不预建通用变更日志。
5. 拉取结果在IDB事务落盘后推进游标；未确认操作叠加在已确认基线上。
6. 启动/focus/online、学习中短批flush、完成/暂停触发；关闭前尽力，持久outbox才是保障。退避抖动，401等待续签，不无限重试/丢数据。

游标不能用at/updated_at，离线晚到和同毫秒会漏。也不能把并发数据库序列最大值当提交水位，小编号可能晚提交。选定**按owner序列化短mutation/pull事务**（行锁或advisory lock），分配提交事实序号；固定水位H分页至H，checkpoint/设置各带revision。所有写路径遵守同一锁规则，不用外部锁服务。

| 冲突 | 规则 |
| --- | --- |
| 两电脑不同事实 | 并集保留，固定顺序重放受影响词，不拿最新card覆盖学习历史 |
| 晚到review/时钟漂移 | received_at仅审计；合法effective occurred_at+device ordinal+ID固定全序，同设备倒退不改变顺序；大漂移隔离保留原时间，不以上传时间冒充学习时间 |
| 两机确实各复习同词 | 两观察都留；旧base revision标stale exposure，不误认网络重复；需排除时追加可追溯纠错 |
| 同session两机继续 | checkpoint CAS/revision，同机多标签单写者，换机取得writer generation；旧离线writer冲突保存fork，事实照收，不拼queue/index/hinted |
| 收藏/mastered相反判断 | base状态引用；因果新判断胜出；并发保留两判断，保守mastered=false/favorite=true；以后本人明确判断解除 |
| 学习设置并发 | 逐字段base revision，不同字段合并；同字段保留云已确认值和本地提案，不让旧设置静默盖新 |
| Undo/AI与新学习撞车 | 目标ID+预期revision；过期重算/拒绝，不撤销“最近一条” |

默认一个活跃续学写者，切电脑是续接，不是实时协作。离线fork可一次选择“保留本机进度/继续云端进度”，事实都保留。这是学习选择，不要求用户解决技术冲突。

离线分两层：已打开页面断网仍可学；关闭后离线重开需小型Service Worker缓存app shell/词库/字体。这是桌面离线能力，不恢复手机维护。版本化cache在组间激活，不缓存Auth回调/token/学习API；旧内容缺失时保留checkpoint停止该组，不用新答案替换继续。

## 5. 最小身份与授权

默认一个预创建Supabase Auth用户，**email/password登录；关闭公众注册和anonymous sign-in；每台可信电脑首次登录后续签**。无注册页/组织/个人中心。本人密码通过受保护输入，不进聊天/Git/CI。Work代办配置，不能杜撰密码；必要时授权管理员重置。

GitHub/Google登录增加外部OAuth App配置与账户依赖，先不作为默认。Magic link依赖邮件递送；passkey按届时稳定性重评。owner是Supabase用户UUID，ChatGPT OAuth sub必须是同一UUID，不按邮箱或ChatGPT账号ID拼身份。

- 暴露表全开RLS，所有者约束+唯一owner+client边界，默认无权限；匿名/第二用户不可读写。
- web token与MCP OAuth token分流。只批准一个client_id；MCP只读范围由RLS和所有RPC强制。检查permissive policies的OR，不能留owner全权限策略架空只读。
- 前端只有publishable key/URL；secret/service_role只用于受控管理部署，不交MCP/模型/浏览器。MCP用用户授权的RLS client。
- server seq/owner/projection不能由客户端改。若撤销表级DML后确实需要窄SECURITY DEFINER RPC，固定search_path/执行角色、显式重查owner与client、限定动作、撤销PUBLIC execute并解释必要性；不为修permission error随手加。读view使用security_invoker或不暴露。
- user_metadata可编辑，不作授权来源；官方token-security有此类示例，不能照抄。只信签名顶层client_id与服务端授权配置。
- JWT校验不等于即时撤销。MCP请求检查grant/session有效性；未来写权限同样检查。仅靠token到期须明确剩余窗口。

### OAuth先做窄兼容验证

托管OAuth Server+Edge MCP已有官方路线，但本项目尚未跑通。

1. 优先预注册一个ChatGPT client，精确redirect URI，关闭开放DCR。surface只能DCR时仅设置阶段打开，批准生成client后关闭并测重连；CIMD读真实discovery不猜。
2. HTTPS/Streamable HTTP，固定函数resource与Auth issuer。verify_jwt=false如用于discovery放行，函数内工具调用必须认证，不等于公共数据接口。
3. OpenAI/MCP要求用途绑定；Supabase默认aud=authenticated，flows未建立任意resource指示器的完整承诺，hook可定制aud不等于端到端兼容。
4. 验证固定client→固定MCP resource服务端绑定，优先托管hook签发专用aud；非法resource失败或至少拿不到可用于非法resource的token。MCP验签/issuer/aud/exp/sub/client，拒绝web token/ID token/其他resource。专用aud能否被所选Supabase user client/PostgREST接受且保持RLS要真实测试，不能忽略aud解决。
5. 当前只有标准OIDC scopes，不声称支持wenyan:read/write。只读靠批准client的服务器能力+RLS/RPC；未来写可独立受控client/grant，不为scope自建OAuth。
6. 测PKCE、回调、refresh、撤销、second user、未批准client、直接Data API/RPC写入绕过，再安装个人插件。

窄验证失败时云同步继续，MCP暂不开放个人数据；先调整托管配置/官方SDK，确不兼容再评估成熟托管OAuth。不得临时公共无认证、URL secret、共享service_role、自建OAuth框架。这个未知点是实施门槛，不是本轮研究阻塞。
