# ECDICT enrichment 数据说明

Wenyan 只使用 ECDICT 的少量结构化字段补充考研词条，不导入其中文释义、英文释义或例句。

来源：
- 项目：`skywind3000/ECDICT`
- 地址：https://github.com/skywind3000/ECDICT
- 文件：`ecdict.csv`
- 固定提交：`82c9872576b23118d7c42e920c11beb77f510ae2`
- 仓库许可证：MIT License

本项目提取字段：
- `phonetic`：音标
- `pos`：词性及语料占比
- `exchange`：过去式、过去分词、现在分词、第三人称单数、比较级、最高级、复数、原形等词形关系

明确不提取：
- `definition`
- `translation`
- `detail`
- 例句或其他词典正文内容

原因：NETEMVocabulary 已作为 Wenyan 的核心考研词义和词频事实源；引入另一套释义会制造冲突，而且 ECDICT 的历史数据来自长期多来源汇总。Wenyan 仅复用其结构化语言字段。

生成方式：

```bash
python3 scripts/sync-english-lexicon.py
```

脚本读取 Wenyan 已固定的 NETEM 词表，只从固定 ECDICT 提交中匹配这些目标词，生成：
- `public/data/english/ecdict-v1.json`
- `public/data/english/ecdict-v1.meta.json`

生成文件应保留固定来源提交和覆盖率统计。更新 ECDICT 版本时必须单独审查差异，不静默跟随 `master`。
