# 云基础依赖

| 包 | 固定版本 | 使用 | 官方源 / 许可 |
| --- | --- | --- | --- |
| @supabase/supabase-js | 2.117.2 | Auth 与两个窄 RPC，无管理员 key | https://github.com/supabase/supabase-js · [MIT](SUPABASE-JS-LICENSE.txt) |
| fake-indexeddb | 6.2.5 | 仅 Node 事务测试 | https://github.com/dumbmatter/fakeIndexedDB · [Apache 2.0](FAKE-INDEXEDDB-LICENSE.txt) |
| @electric-sql/pglite | 0.5.8 | 仅测试执行真实 PostgreSQL migration，合成 Auth | https://github.com/electric-sql/pglite · [Apache 2.0](PGLITE-LICENSE.txt) |

版本与 lockfile 一起维护。两个测试包不会进入浏览器 bundle。原 ts-fsrs 仍固定 5.2.3；没有复制或改写调度器。个人记录与密码不随包进入仓库。
