# NETEMVocabulary 数据说明

Wenyan 的考研英语词频与中文释义数据在运行时读取自：

- 项目：`exam-data/NETEMVocabulary`
- 地址：https://github.com/exam-data/NETEMVocabulary
- 原始数据：`netem_full_list.json`
- 数据许可：CC BY-NC-SA 4.0
- 上游程序许可：MIT License

上游 README 说明：数据以《2024 年全国硕士研究生招生考试英语（一）考试大纲词汇表》的 5530 个词为基础，并结合四六级、考研英语、专四专八约 200 套试卷文本进行词频排序；前 2444 个词出现 40 次以上。

Wenyan 不把上游 GPL 项目 Qwerty Learner / TypeWords 的程序代码复制进本仓库。本仓库继续使用自身 MIT 代码，只借鉴其训练交互，并把许可独立的词汇数据作为运行时数据源。

为了手机性能，当前默认激活词频排序靠前的 1200 个词，并额外保留 v0.1 原有 24 个种子词以兼容已有学习记录和未完成训练。完整 5530 词目录下载后缓存在当前浏览器；后续可在不改变学习记录 ID 的前提下增加分层词库或全量搜索。

上游数据的署名、非商业和相同方式共享要求按 CC BY-NC-SA 4.0 保留。Wenyan 自身代码许可证不因此改为 GPL。
