# Wenyan 路线图

Desktop-first、English-first，文学冻结。路线按真实学习闭环推进；不以功能数量衡量。当前完成事实见[开发进度](开发进度.md)，理由见[研究](research/CLOUD-MCP.md)，稳定职责见[ARCHITECTURE](ARCHITECTURE.md)。本轮只研究，不自动部署/合并。

## S0 — 英语体验收口

- 保留独立Draft #12的Smart Session与UI成果，真实head/CI检查后再评审。
- 不重造训练器；不混入Auth/schema实验。研究#13独立于main，不覆盖#12。
- 验收已有输入/首次结果/提示/订正/有限回流/Undo/刷新/JSON与三桌面尺寸/根和子路径。
- 本人IME/实际声音/连续20—30分钟与多日反馈仍属未验证；不能由远端浏览器代替。
- 快速筛词是可独立的小功能，复用人工mastered，无硬编码黑名单；不要求先筛完才能做云基础。
- 合并#12、部署都等待独立授权，不由本轮研究自动触发。

## S1 — Supabase Foundation与本地协议

目标：在正式积累历史前确定薄数据边界，不一次搭大后端。

- 独立Wenyan项目，一owner，关闭注册/anonymous；受保护首次登录。
- Git保存config/migrations/类型/假数据，不保存secret或真实学习历史。
- v3事实/checkpoint/backup版本，IDB事务/outbox；保留word ID、Smart领域逻辑、固定ts-fsrs/参数epoch。
- 原v2仅导入适配；实施前检查是否新增真实数据，不能静默清空。
- 对实际SDK/CLI能力再核验，依赖固定版本与lockfile；不建production Docker体系。临时测试栈若确需Docker只用于验证，不成为本人运行要求。

完成标准：本地一步原子提交/保存失败/重启恢复、v2导入不伪造字段、JSON到干净browser；云schema与RLS负例（匿名/第二用户）及advisors。测试不足不开放正式数据写入。

## S2 — 云端学习状态

- 少量RPC把事实+session checkpoint+幂等收据原子提交，重试收据；RLS/client权限从起步就分开。
- 词库保持静态；学习设置少量云端，外观/声音本机。
- 共享JS/ts-fsrs从确认事实计算云查询投影，与本地重建parity；不直接接受客户端card，不在SQL重写FSRS，word_state cache等性能证明需要再加。
- 保存状态能区分本机已存/待同步/已同步/需要重新登录，不能全部称云已保存。

完成标准：单机offline→online、丢ack重试、hint与首次提交阶段刷新、Undo/未知版本/同ID不同内容/非法payload/投影重建。没有任何重复review或丢checkpoint。

## S3 — 多电脑与离线闭环

- owner提交游标、固定水位分页、IDB落盘后推进；短批自动重试。
- 单session writer generation/CAS、旧离线fork、并发mastered/设置规则。
- 小Service Worker缓存静态app/内容，组间激活；不缓存Auth/个人API。
- 私密本机快照+异地自动备份，失败可见，恢复演练。同步不等于备份。

完成标准：两个干净browser contexts真实API学习→断网→两边操作→乱序/重复重连，事实数量/card最终一致；小序号晚提交不漏；旧writer不覆盖；断网重开可学；清空一机/恢复新环境可继续。模拟协议测试与真实网络测试都要有。

## S4 — 正式访问入口与开始使用

固定origin与Auth回调在S1就规划，正式部署放在上述基础过关后。已有静态访问能力不是已上线地址。

- 固定HTTPS网站，桌面打开即学；允许已登录本机在网络故障时继续。
- 版本回滚不降级写新schema，内容版本与cache规则明确。
- 实测上班/住处网络、Auth续签、静态字体/语音、本人桌面连续使用；不恢复手机维护。
- 免费项目暂停/备份限制在部署方案里落实，付费只有本人明确同意。

完成标准：部署授权、真实URL/根或子路径、Auth callbacks、离线重开、备份恢复、无secret打包泄漏；随后收集真实使用反馈。不为了获得反馈拖延所有独立开发，也不声称已验证多日体验。

## S5 — Wenyan只读MCP + 个人ChatGPT连接

先做窄Auth兼容验证，再领域工具，再安装；不先做内嵌UI/Skill平台。

- Supabase托管OAuth、批准单client、专用resource/aud、用户RLS client；具体兼容门槛见研究。
- 一个stateless Edge MCP，五个有界只读工具；结果含证据/窗口/分母/版本/水位/缺失。
- Inspector与负例通过后，准备个人custom Plugin连接；不提交公共目录、不对外发布。
- 只读不要求OpenAI API key；模型直接在ChatGPT推理。

完成标准：同一owner登录、refresh与撤销、其他client/audience/匿名/第二用户/直接Data API写入绕过全拒绝；五个代表prompt与空历史/过期数据/注入文本负例；本人仅进行风险确认/安装/OAuth同意，工具实测返回正确事实。

Auth窄验证失败：保留可靠云同步，暂不开放MCP；不以无认证/忽略aud/管理token作为完成方式。

## S6 — Tutor Skill与可逆写入（有真实需求再做）

- Skill只约束辅导流程：读事实→有限诊断→建议→训练→验证。
- 默认诊断留ChatGPT，训练留网站；Study Mode能否同surface组合不作为依赖。
- 有价值时才保存计划/收藏/当天目标；明确请求、差异、幂等、revision、可撤销。
- 小批mastered先候选/抽查/精确proposal再本人一次确认，不删历史。
- 只有计划预览确需可视操作时再内嵌UI。

完成标准：模型误调用/重复/过期revision/无授权写均拒绝；权限升级可撤销；review/card/due/参数/删除不可达。不给聊天口头答对自动记Good。

## S7 — 真题最小训练与Learner Model

先真实题目attempt，后能力推断；不要从词汇数据推阅读画像。

- 先一种阅读或长难句小模块，再完形/翻译等；题面与答案来源/许可清楚、ID与内容版本稳定。
- attempt保存作答/提示/时间/客观或rubric评分来源。
- 错因分本人/规则/AI提案，保留证据；主观评分不能冒充官方答案。
- Learner Model仅有据维度/样本/窗口/置信度/model版本/可纠正推断，不能改FSRS历史。

完成标准：作答→诊断假设→针对训练→未提示再测，用可比较结果验证建议；可换模型重算。没有真实数据时只做描述统计，不建设画像/知识图谱/向量基础设施。

## S8 — 恢复文学

英语持续使用可靠以后再接南师大真题与现当代文学专题；不机械搬旧1101条。当前继续冻结。

## 用户参与边界

Work完成普通研究、命名、SQL/migrations、测试、部署准备与PR。本人仅在独立项目/成本与组织选择、首次秘密输入/登录、必要服务授权、正式部署授权、插件安装风险/OAuth、付费节点参与；每次给一个最小操作。不让本人写SQL、复制代码、部署函数。

明确不做：多人SaaS、权限后台、手机专项、框架重写、微服务、Docker生产体系、复杂CQRS/事件溯源框架、自建OAuth、通用repository/DI、批量AI例句、聊天替代数据库。
