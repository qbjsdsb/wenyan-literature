# 文研只读 MCP

本分支的 Edge Function 已部署；公开 metadata 200、匿名 tools/list 401 及 WWW-Authenticate 已通过真实 HTTPS 验证。实际 OAuth Server、批准 client、专用 audience、refresh/撤销和 ChatGPT 安装尚未通过。`wenyan_private.config.mcp_enabled` 保持 false；这不是已可使用的 ChatGPT 连接。

## 端点与权限

资源地址固定为 `https://cmjhxvpkdeheujuteqoi.supabase.co/functions/v1/wenyan-mcp`；保护资源 metadata 为其 `/.well-known/oauth-protected-resource` 子路径。Issuer 为同项目 `/auth/v1`。实际 JWKS 提供 ES256 公钥。

使用 MCP TypeScript SDK 1.32.1 的 stateless Streamable HTTP。JWT 必须真实非对称验签，并匹配 issuer、精确 resource audience、expiry、非匿名 authenticated owner、client_id、live session。每次请求先执行用户 token 的窄 pull RPC，包括 initialize/tools/list；不用 service_role。RPC 另查当前配置，未知 client、撤销 session、disabled MCP 与所有 OAuth 写入均拒绝。

托管 Edge 代理实际传入 `http://<项目>.supabase.co/wenyan-mcp`；入口仅对精确配置 host 和函数路径恢复外部 HTTPS `/functions/v1/`，不修改 Origin/Authorization、不接受其他 host。无 token/header 日志。

## 五个有界只读工具

| 工具 | 结果 |
| --- | --- |
| get_learning_overview | 今日已提交活动、到期数量和续学组 |
| get_review_pressure | 到期分布和有窗口的近期复习观察 |
| get_problem_words | 达到重复失败/提示样本门槛的候选词 |
| get_word_history | 一个稳定词 ID 的有限历史、Undo 和共享 FSRS 投影 |
| preview_study_session | 续学或短组计划预览，不创建 session |

领域投影直接复用网站的事实/Undo/FSRS/Smart 实现。返回 as_of、timezone、watermark、版本、样本/分母、证据与缺失；未上传离线历史为 unknown。未采集的错拼/作答用时不编造，单次答对不等于 mastered。预览 45 秒/词只是假设，明确没有测量时长。

读取固定提交水位、连续 seq；上限 10,000 facts / 25 pages，超限不计算 FSRS 或掌握结论。工具输入严格且无 owner/SQL 参数，没有写工具。真实 learning data、token 不进入 Git。

## 继续前必须验证

1. 开启官方 OAuth Server，DCR 保持关闭，使用预注册单 client 和精确 redirect；本人完成 OAuth 同意。
2. `/oauth/consent.html` 使用同一网页登录 session、SDK 读取真实详情，精确批准 client 与 scope，不自动同意。
3. 实测 authorize/token 携带相同 resource 后 JWT aud；文档仍展示 authenticated 默认 audience。若托管 token 不满足精确 audience，启用仅批准 client 的 Custom Access Token Hook；不能放宽 MCP audience 或自行签 token。
4. 真实 PKCE、refresh、撤销、PostgREST 专用 audience 兼容、owner read / OAuth commit 拒绝、未知 client / 第二用户 / 直接 API 负例。
5. Inspector 和代表性 prompt 通过后再安装个人 Plugin。Plugin manifest 只是准备，不能视为实际安装；Tutor Skill 继续等待只读授权闭环稳定。

官方来源： [Supabase OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)、[Token security / Custom Access Token Hook](https://supabase.com/docs/guides/auth/oauth-server/token-security)、[Auth 授权 URL 拼接实现](https://github.com/supabase/auth/blob/master/internal/api/oauthserver/authorize.go)、[OpenAI Plugin authentication](https://developers.openai.com/plugins/build/auth)、[Plugin package](https://developers.openai.com/plugins/build/plugins)。Site URL 带仓库子路径，Auth 在其后拼接 `/oauth/consent.html`，不是 origin 根路径。
