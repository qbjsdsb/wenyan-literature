# NETEMVocabulary 数据说明

Wenyan 的考研英语词频与中文释义数据来自：

- 项目：`exam-data/NETEMVocabulary`
- 地址：https://github.com/exam-data/NETEMVocabulary
- 原始数据：`netem_full_list.json`
- 固定提交：`bf83111e0ebf29c6f9aca45d2a4f30e2c72af2e7`
- 数据许可：CC BY-NC-SA 4.0
- 上游程序许可：MIT License

上游 README 说明：数据以《2024 年全国硕士研究生招生考试英语（一）考试大纲词汇表》的 5530 个词为基础，并结合四六级、考研英语、专四专八约 200 套试卷文本进行词频排序；前 2444 个词出现 40 次以上。

## Wenyan 如何使用这份数据

Wenyan 不再在运行时静默跟随上游 `master`。

当前做法：

1. `scripts/sync-english-data.mjs` 从上面的固定提交读取 `netem_full_list.json`。
2. 规范化后生成 `public/data/english/netem-v1.json` 与校验元数据。
3. 应用优先读取随自身构建发布的同源固定快照。
4. 如果部署缺少该快照，才回退到同一个固定提交的 jsDelivr / GitHub raw 地址。
5. 不再把完整 5530 词目录写入学习状态 localStorage；旧 `wenyan-netem-catalog-v1` 仅是可删除的历史内容缓存，不属于用户学习记录。

这样做的目的：

- 上游释义或排序变化不会静默改变已有学习体验。
- 构建结果可复现。
- 外部 CDN / GitHub 故障不会成为正常使用的首要依赖。
- 词库大文件与 `wenyan-events-v2` 学习记录彻底分离，减少 localStorage 容量风险。

## 学习范围

当前支持三层：

- `core`：前 1200 词。
- `high`：前 2444 词。
- `full`：完整 5530 词。

默认 `core`。改变词库范围只改变“可进入训练的新词池”，不迁移或重写既有 `word:<id>` 学习记录。v0.1 原有 24 个种子词始终保留，以兼容旧收藏、复习记录和未完成 session。

## 与其他项目的关系

Wenyan 不把 Qwerty Learner / TypeWords 的 GPL-3.0 程序代码复制进本仓库。本仓库继续使用自身 MIT 代码，只借鉴其训练交互；NETEMVocabulary 数据按其独立的数据许可证使用。

上游数据的署名、非商业和相同方式共享要求按 CC BY-NC-SA 4.0 保留。Wenyan 自身代码许可证不因此改为 GPL；生成的词库快照仍受上述数据许可证约束。
