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

三个首期领域表：`study_events`（长期事实）、`study_sessions`（元数据/最新checkpoint）、`learner_settings`（学习设置和同步计数）。`word_state`仅为以后性能证明需要的投影cache候选，不是首期必建。这是职责草案，不提前冻结SQL。收藏与mastered是可撤销人工判断，不另造收藏库；设备ID用于溯源，不是身份。Learner Model与真题attempts不现在建空表。

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
3. 云mutation短事务验证身份/版本/依赖，去重，提交事实与checkpoint并返回收据。投影从已提交事实由共享ts-fsrs纯规则计算，不在SQL里重写FSRS，也不接收浏览器提交的card。少量固定RPC，不做通用命令框架。
4. 增量拉事实；学习设置与仍可续学的session少，可每次拉当前快照。事实游标与checkpoint revision分开，不预建通用变更日志。非事件操作的提交收据必须持久化（可用一张很小的sync_receipts技术表），重试先查收据再做CAS，不能把丢ack当并发冲突；未确认操作的收据不能过早清除。
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
- 前端只有publishable key/URL；secret/service_role只用于受控管理部署，不交MCP/模型/浏览器。MCP用用户授权的RLS client；当前官方文档没有建立ChatGPT能替代Wenyan保存个人长期事实的保证。
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

## 6. MCP首版：五个读工具

Supabase开发管理MCP用于Work管理工程，**不等于Wenyan学习MCP**。学习插件不暴露execute_sql/apply_migration/任意table/URL/filesystem。

| 工具候选 | 用途与边界 |
| --- | --- |
| get_learning_overview | 今日/最近窗口学习量、到期、未完成组、目标；时区/分母明确 |
| get_review_pressure | 到期分布、新学/失败/提示与积压趋势；观察不是因果结论 |
| get_problem_words | 有最小样本与窗口的反复失败/提示词，返回failure/sample、最近成功、证据ID |
| get_word_history | 指定稳定ID的有界事实与card；首次/提示后/订正/撤销/未知分开 |
| preview_study_session | 时间预算+Smart planner，输出建议词/主动作/网站链接；不写session或due；无耗时历史标估算 |

cloud与browser共享锁定版本的JS reducer。MCP以已确认事实计算投影；若后期缓存，必须带输入水位并在失效时重建。云事实写入、读取授权与投影计算分开，不让MCP凭投影管理权绕过RLS。全量历史首次bootstrap可分页，以后增量；用合成的多年学习规模数据评估性能后再决定cache。

共同返回as_of、已提交水位/projection revision、时区、content/scheduler版本、窗口、样本、unknown/coverage、证据ID和分页。云无法知道未联网设备outbox数量，只能说“截至最近收到的数据”。相邻工具可要求同水位；历史快照不可用就stale/retry，不把不同时间统计拼成精确因果。

不要求通用search/fetch才算MCP；需要对应检索surface才加。resources可提供短指标定义/许可/数据字典，关键事实仍通过tools返回；不假定所有客户端主动读resources/prompts。工具与UI不承担长期会话数据库。

### 写权限分级

| 阶段 | 允许 | 控制 |
| --- | --- | --- |
| M1 | 只读、session preview | annotations+服务器+RLS全只读 |
| M2 | 计划草稿、收藏、当天降低新词目标等可逆意图 | 明确请求、差异预览、operation ID、revision、actor/原值/新值、撤销 |
| M3 | 小批本人确认mastered/取消暂缓 | 有界ID与数量；绑定精确集合且短期有效的proposal；确认后重查revision；优先网站一次确认，不凭AI置信度执行 |
| 默认永不开放 | 编造review/firstCorrect、直接改card/due/参数、删历史/全量数据、任意SQL | 模型/skill说可以也由服务器拒绝 |

“把明显掌握的词处理掉”返回候选和依据，mastered是人工排除常规队列，不是FSRS证明永久记住。不删词/历史，可恢复；建议先少量冷回忆抽查。

首版诊断/15分钟安排在ChatGPT完成；计时训练、输入、提示、订正、评分留在Wenyan网站。聊天口头答对不自动正式review。未来专门带attempt/context/hint标记的训练工具经验证后才可能记录聊天训练事实。

## 7. Tutor Skill与可选UI

MCP稳定后值得加一份短Wenyan Tutor Skill：先读真实状态并引用证据；无数据承认冷启动；分事实/假设；先尝试再提示；一次一问；提示后不给独立成功；建议有限训练与再测时间。Skill改善风格，不执行授权/算法/数据库规则。先私有custom MCP，再按支持surface包装Skill，不提前建“插件平台”。

Khanmigo与Study Mode启发是递进提示、解释、检查理解，其产品说明不是教学有效性实证。Study Mode会错、可能直接答，并有特殊surface限制，不能假定Work/Project中的@Wenyan自动组合Study Mode。闭环由事实与再测保证。

| 问题 | 可观察证据 | 输出与验证 |
| --- | --- | --- |
| 今天学什么 | 到期/活跃组/时间目标/近期新学 | 先续学或复习，余预算少量新词；网站执行记录 |
| 哪些词总忘 | 窗口失败/提示/间隔/样本 | 有据候选，下次无提示回忆验证，不贴永久标签 |
| 为什么复习增多 | 新词摄入/Again/漏学日/参数epoch/撤销 | 分解贡献与未知，相关不等于“记忆差” |
| 安排15分钟 | Smart候选与实际耗时分布 | 冷启动保守估时，训练可暂停，不精确承诺 |

首版不做内嵌UI：简洁结果+网站深链接足够。以后展示计划预览/候选掌握清单，不复制打字训练器或建聊天Dashboard。Edge不依赖sampling/长连接/内存session；模型运行在ChatGPT，不在数据库函数。

## 8. Learner Model与真题接缝

FSRS回答卡片何时复习，不能从拼写正确率推阅读推断能力。Learner Model以后是可失效、有证据的推断：维度、估计、置信程度、样本、evidence IDs、model/prompt版本、窗口、人工纠正。换模型重估，不改事实。

真题以后新增版本化question:<source>:<year>:<section>:<number>、passage/sentence ID与attempt，保存作答、答案来源版本、提示/时间、客观评分来源。错因分本人判断、规则判定、AI提案；引用作答与文本证据。翻译/长难句主观评价保留rubric、参考来源、模型/人工评分身份，不把模型点评当官方答案。

届时新增专项纯逻辑/表，不塞进word review任意JSON；共用owner/session/attempt/证据/内容版本即可。不现在建万能activity引擎。固定授权题面可随版本发布；私有来源材料走受控存储，不把未知版权真题放公共Git。需要语义检索时才评估向量。

先有真实attempt，再有能力模型；不能因只有词汇数据就预建阅读/翻译画像。

## 9. 用户参与与长期成本

Work可完成仓库/代码/tests/migrations/RLS/类型/Edge/部署配置/备份格式/Draft PR/插件清单/自动验收。管理凭证仅部署环境持有；Git只存工程恢复信息/假数据，不存个人学习、secret、数据库备份。

真正可能需要本人：选择授权独立Wenyan Supabase项目（创建工具要求组织与成本确认）；受保护界面设密码/首次登录；部署服务/固定入口授权（若既有授权不足）；插件风险确认、安装、OAuth同意；选收费服务才付款。到节点一次给最小操作，不让用户写SQL/复制代码/部署函数。

本轮只读列出可见项目，没有可确认属于Wenyan的项目，不借用xueqing/名称不明项目，不恢复或改动它们。研究现在不需要选项目。插件在个人账号/workspace实际可用性与Auth未实测，不承诺安装一次以后永不重授权。

免费Supabase适合开始验证，暂停/独立备份责任是真实成本，不等于几年无人维护保证。正式使用前必须自动私密异地备份并恢复演练；不能放公共Git或只放同一个Supabase。保留完整JSON、可信本机自动快照，异地优先已有私有Drive（能稳定自动化时），否则届时比较单一私有存储。未选定/恢复未成功不能称“长期可靠完成”；不造假流量保活，不默认付费。

## 10. 风险与验收反例

| 风险 | 防线/验收 |
| --- | --- |
| 本地保存失败/清理 | commit失败不进题、最近同步状态、本机/异地备份、新browser恢复；清理前未同步确有损失边界 |
| 丢响应/重复上传 | ID+attempt唯一与指纹、ack后删outbox、断线重试不多算review |
| 双机并发/晚到 | 游标提交顺序、checkpoint CAS/fork、同算法重建；最终事实数与FSRS一致 |
| RLS假只读 | 匿名/第二用户/OAuth直接Data API与RPC绕过拒绝；policy OR/definer审核；advisors+负例集成 |
| token用途/secret | 专用aud、批准client、撤销检查；不记录Auth header；Git/build/CI只有public key；XSS防护与CSP |
| AI错误写入 | 首版只读；以后proposal/revision/幂等/撤销；不开放review/due/删除 |
| scheduler升级 | 固定依赖/参数epoch、parity fixtures、单独验收，不随同步自动调参 |
| 模型/云供应商更换 | JSON/Postgres可导出、共享纯逻辑、有界协议；provider不拥有事实 |
| 工程无限增长 | 三领域表+必要收据/少量RPC/一个MCP；每阶段一条可验收链 |

## 11. 官方来源与核验记录

以下均于2026-10-07阅读。来源证明表中的能力；本项目设计是推论。工具search_docs与网页有版本差异时读当前页面，旧片段不作为实现规范。web工具初次打不开changelog.md，回退页面后又成功读取官方markdown索引，检查了相关变化。

| 来源 | 核验内容 |
| --- | --- |
| [OpenAI Plugins](https://learn.chatgpt.com/docs/plugins) | Plugin可含Skill/MCP；Cloud Work不支持plugin lifecycle hooks |
| [连接测试](https://developers.openai.com/plugins/deploy/connect-chatgpt) | 私人custom MCP、HTTPS/Streamable HTTP、安装/@调用、账号/workspace规则；无需公开目录提交 |
| [Plugin包装](https://developers.openai.com/plugins/build/plugins) | portable plugin.json/mcp.json与兼容布局；私有marketplace支持随surface验证 |
| [OpenAI MCP Auth](https://developers.openai.com/plugins/build/auth) | discovery/resource/PKCE/client注册；不拿API key/管理员token替代 |
| [MCP 2026-07-28 Auth](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) | resource server用途/token责任；实施同时核对客户端协议版本 |
| [Supabase changelog](https://supabase.com/changelog) | Data API自动暴露变更；Node20支持变化；server框架adapter弃用；本项目Node24/原生fetch不需该adapter |
| [托管OAuth Server](https://supabase.com/docs/guides/auth/oauth-server) | 复用Auth用户第三方授权，无需自建OAuth |
| [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows) | 标准OIDC scopes/default aud/client_id；无自定义scope，不代表表访问授权 |
| [Token security](https://supabase.com/docs/guides/auth/oauth-server/token-security) | client_id RLS/hook；用途兼容须测试，示例非可照抄安全配置 |
| [Supabase MCP Auth](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) | 新页面已有部署指南；tool搜索旧“无MCP hosting”措辞已过时 |
| [Deploy MCP](https://supabase.com/docs/guides/ai-tools/byo-mcp) | Edge/user-scoped/discovery/stateless限制；SDK实施时固定版本 |
| [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | ownership/USING/WITH CHECK/views/特权边界 |
| [Password Auth](https://supabase.com/docs/guides/auth/passwords) / [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) | 密码与邮件流不同；默认SMTP限制，不依赖每天邮件登录 |
| [备份](https://supabase.com/docs/guides/platform/backups) / [暂停](https://supabase.com/docs/guides/platform/free-project-pausing) | 免费需独立备份，低活动可能暂停；DB备份不含Storage对象 |
| [idb](https://github.com/jakearchibald/idb) | IDB轻包装，事务不能跨任意网络等待 |
| [Anki同步](https://docs.ankiweb.net/syncing.html) / [Deck options](https://docs.ankiweb.net/deck-options.html) | 同步不是备份，历史/card/参数不同职责，不直接复制冲突算法 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | scheduler/card/review log领域，复用现有依赖 |
| [AnkiConnect旧官方入口](https://github.com/FooSoft/anki-connect) → [新上游](https://git.sr.ht/~foosoft/anki-connect) | GitHub README已迁移；web读取失败后shell读取新上游README，确认Anki须运行及本机服务边界；不据旧fork设计云授权 |
| [Khanmigo](https://khanmigo.ai/) / [教学原则](https://support.khanacademy.org/hc/en-us/articles/13860282793869-What-are-the-Community-Guidelines-for-Khanmigo) | 指导思考，不宣称教学疗效或本项目有效性已验证 |
| [Study Mode](https://help.openai.com/en/articles/11780217-using-study-mode-in-chatgpt) | 提示/理解检查/出错与特殊surface限制；未验证与本插件自动组合 |
| [Firestore offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline) | 内置离线；同文档最后写入胜出 |
| [D1](https://developers.cloudflare.com/d1/) / [PocketBase](https://pocketbase.io/docs/) | 候选DB/后端能力；选Supabase属总成本判断 |

未做：云schema/RLS部署、Auth/refresh/revocation、专用aud到PostgREST、双机离线、个人插件安装、本人系统IME/实际语音/多日使用。本轮方案完整不等于这些实施门槛已通过。
