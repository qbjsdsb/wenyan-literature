# 云基础实施与验收

此文件解释协议和可复现测试，不是平行进度文件。当前部署/阻塞只见 [开发进度](开发进度.md)。

## 本地提交

`src/cloud/local-db.js` 使用原生 IndexedDB。facts/checkpoints/outbox/meta/snapshots/conflicts 同库事务；网页缓存是可重建投影。完成一步与 Undo 的事实和 checkpoint 在同一事务写入，成功后才推进 UI。提示/首次结果也先持久保存。Quota/事务失败停止该步，不把待写内存记录当已保存。

v2 localStorage 只作一次迁移源，原值保留。session 历史提取到 checkpoint，不继续长期追加整组快照。JSON schema 3 可导出事实、学习设置和续学组；整份导入同一事务，云 outbox 仍拆至每批最多 50 事实。已有同 ID checkpoint 保留当前进度，不用旧备份回滚已完成历史；旧 schema 2 导入仍支持。时间、ID、首次结果、FSRS 固定 5.2.3/epoch-1 不改写；历史缺失字段保持 unknown。

多标签使用 IDB revision CAS，而 BroadcastChannel 只通知，不能作锁。后台云同步不会等待网络才显示下一词。断网重开由构建生成的版本化 Service Worker 缓存静态 shell/词库/字体；不缓存 token/Auth/API；不在运行组内强制激活新版。

## 数据库

独立 `wenyan_private` schema，复用已授权弃用项目，但不清空旧业务表。私有表全部 RLS，无浏览器表 DML 权限。两个 public RPC 是唯一同步入口：`wenyan_commit` / `wenyan_pull`。窄 SECURITY DEFINER 是为了管理服务端提交顺序和原子 checkpoint，而不是绕过所有者授权。固定空 search_path、显式 owner/client/live session 检查，撤销 PUBLIC/anon execute。

只有 config.owner_id 对应的非匿名 Auth session 能操作。第一方 token 要求无 client_id 且 aud=authenticated。MCP 授权口默认关闭；未来专用 client/aud 也只能读，所有写 RPC 重查第一方权限。user_metadata 不用于权限。服务端不接受客户端 FSRS card。

owner 设置行短锁序列化 mutation/pull；事实 seq 是已提交顺序，不按客户端时间或 PostgreSQL sequence 最大值推水位。pull 固定 H、分页后在 IDB 原子落盘才推进 cursor。

operation UUID 与完整 JSONB 收据持久保存，同 ID 不同内容拒绝。checkpoint CAS 使用 baseRevision/baseOperation，丢 ack 的因果后续提交可查询旧收据；旧写者保留 session_forks，事实仍接受。设置逐字段 CAS。本机明确选择继续云端 checkpoint 或把当前进度另存为新 session；不会替换任何 review。并发 mastered 保守保留复习，并发收藏保留可见性，下一次明确操作观察两条分支后解决。同步不是全包 JSON 最后写入胜出。

## 可复现验证

```bash
npm ci
npm test
npm run build
```

`tests/cloud-sql.test.mjs` 在 PGlite 的真正 PostgreSQL 引擎执行同一 migration，使用合成 auth.users/sessions 与 JWT 声明测试 anon/第二用户/未知 client/错误 audience/session 撤销、直接表权限、SQL 幂等/Undo/CAS/fork、分页与两份 IndexedDB。它验证 PostgreSQL 协议，但不是托管 Auth/OAuth/PostgREST/真实网络验收。

真实构建由 CI 的 browser-smoke 和 experience-smoke 在 root/subpath、三桌面尺寸验证，浏览器断言从 IndexedDB读取，而不是保留假 localStorage 镜像让旧测试绿灯。

托管阶段还必须验证真实第二浏览器/断网/重连/登录续签/第二用户/直接 Data API/RPC、advisors、备份恢复与 OAuth 窄兼容。MCP/Plugin 未过这些门槛不开放。

## 配置与恢复

`.env.example` 只有 URL 和 publishable key。运行时密码直接送 Supabase Auth；token 只由 SDK 处理，不进入 JSON/日志/Git。绑定 owner 前先验证云 RPC授权，其他账号不能接管本机学习历史。

本机保留五份轮转快照，设置里可查看与合并恢复点，并有 JSON 人工备份。私密异地自动备份、托管恢复演练及真正固定 HTTPS 入口仍须在部署阶段完成，不能声称同步等于备份。

回滚原则：不退回只写 localStorage 的旧构建。代码回滚须继续支持 v3 数据读取；停云后本机可学。迁移初始 config.owner_id=null，默认全拒绝，只有由管理面绑定本人的 Auth UUID 才可写。


## 部署准备（未执行）

`.github/workflows/deploy-pages.yml` 只允许 workflow_dispatch，不由 Draft push 发布。依照 [GitHub 官方 custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 配置 Pages；配置需通过正常 Git 审查收入默认分支后才可从 Actions 手动触发，不自动合并。仓库 variables 仅放 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY` 和真实云验收后才设置的 `WENYAN_CLOUD_READY=true`。

管理面启用 Pages、固定实际 HTTPS origin、Auth site URL/精确 callback、禁用托管注册/匿名、绑定 owner 和真实安全验收均由 Work 在登录后完成。构建拒绝 secret/service_role browser key；不使用管理员 token 部署前端。rollback 选可读写 v3 的旧构建，不能退回 main 的 v2 writer。未来 MCP consent/受保护资源 discovery 需另做真实验证，当前没有 mock Plugin 成功。

目前大时钟漂移隔离/恢复尚未完成：不要手改事实时间强行清空 outbox。SQL 的 received_at 保留服务器接收审计，未来时间超一天拒绝，本机 effective at 保证同设备单调。托管验收必须包含系统时间向前/向后改变、重开与多设备迟到重放。
