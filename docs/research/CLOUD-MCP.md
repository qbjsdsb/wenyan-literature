# Wenyan 云端与 ChatGPT 集成研究

核验日期：2026-10-07（Asia/Shanghai）。本文件保存研究依据与方案理由；当前状态只维护在 `../开发进度.md`，路线只维护在 `../ROADMAP.md`。

## 已恢复的基线

- main：`5ed504ef28d78f443071af999adcaced5b30f6f8`，Desktop English Baseline v1 已合入。
- [Draft PR #12](https://github.com/qbjsdsb/wenyan-literature/pull/12)：`6426f071c068324d7b8e59c513f13c36505cba05`，英语体验 v2 / Smart Session 未合并，最新 CI / browser 成功。
- 当前事件：`id/device/kind/key/at/value`，schema 2，本地整包 localStorage；session 快照也被追加为事件；FSRS 从有效 review 重放。
- 研究范围：云端事实、本地即时响应、单身份授权、MCP 与学习推理边界；不实现数据库或发布产品。

## 首批核验依据

- [OpenAI Plugins authentication](https://developers.openai.com/plugins/build/auth)：用户数据需要授权；MCP resource 与 token audience 必须核验，不能把任意网页登录 token 当 MCP 授权。
- [Supabase OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server)：可复用 Supabase 身份，不需要自建 OAuth Server；与 ChatGPT 的具体 resource/scopes 兼容尚需深入核验。

其余结论随研究提交补齐。本文件此时不构成已完成的实施方案。
