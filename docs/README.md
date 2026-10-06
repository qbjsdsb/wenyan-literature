# Wenyan 文档导航

这里是仓库文档入口。目标不是把文档做复杂，而是让后续 AI / 开发者几分钟内知道：**现在做到哪、什么不能乱改、下一步做什么、怎么验收。**

## 先读这 6 个文件

1. [`../README.md`](../README.md) — 产品是什么、怎么运行、当前能力。
2. [`../AGENTS.md`](../AGENTS.md) — 当前 Desktop-first / English-first 规则。
3. [`开发进度.md`](开发进度.md) — **当前状态唯一事实源（SSOT）**。
4. [`ROADMAP.md`](ROADMAP.md) — 当前总路线与完成标准。
5. [`english/PLAN.md`](english/PLAN.md) — 当前最重要专项文档：英语电脑端。
6. [`ARCHITECTURE.md`](ARCHITECTURE.md) — 代码、数据与兼容边界。

当前真实验收清单：[`english/VALIDATION.md`](english/VALIDATION.md)。

## 当前基线

旧 PR #2—#10 是历史 stacked PR，保留追溯价值，但不再继续向上叠开发。

正式基线为远端最新 `main`，PR #11 已合入。当前续接工作：PR #12 `feature/english-experience-v2`（Draft），从 main 直接创建。

当前规则：Desktop-first、English-first、文学冻结。先审计真实体验，再局部改进 Smart Session 和桌面学习层级，不自动合并或发布。

## 文档分类

### 状态与验收
- [`开发进度.md`](开发进度.md)：当前分支、已完成、未验证、下一动作。
- [`english/VALIDATION.md`](english/VALIDATION.md)：当前桌面真实使用验收。
- [`web-v0.1-validation.md`](web-v0.1-validation.md)：早期 Web v0.1 历史验收记录。
- [`../evidence/`](../evidence/)：与历史验收对应的截图。

### 当前专项：英语
- [`english/EXPERIENCE-AUDIT.md`](english/EXPERIENCE-AUDIT.md)：本轮实施前真实 UX 审计。
- [`english/EXPERIENCE-VALIDATION.md`](english/EXPERIENCE-VALIDATION.md)：本轮生产构建验证与视觉对比。
- [`english/PLAN.md`](english/PLAN.md)：英语产品原则、已完成能力和后续阶段。
- [`english/MAINTAINABILITY-AUDIT.md`](english/MAINTAINABILITY-AUDIT.md)：已处理与刻意后置的英语维护问题。

### 产品与设计
- [`design/selected-reference.png`](design/selected-reference.png)：当前选定视觉方向。
- [`design/v0.1-qa.md`](design/v0.1-qa.md)：v0.1 视觉 / 功能 QA 摘要。

### 内容研究
- `南师大现当代文学考研-二轮调研报告.md`：早期研究输入，不等于当前产品事实源。

文学研究材料继续保留，但当前不主动扩文学产品内容。

### 第三方与许可证
- [`third-party/`](third-party/)：字体、图标、FSRS、英语词库等第三方许可与来源。

## 文档维护规则

- **只允许一个当前状态文件**：`docs/开发进度.md`。
- 总优先级写在 `ROADMAP.md`；英语专项决定写在 `english/PLAN.md`。
- `english/VALIDATION.md` 只写当前真正要执行的桌面验收，不保留已经废弃的手机验收目标。
- 验收记录只写实际做过的检查，不把计划写成已完成。
- PR / commit 表达历史；文档只维护“现在是什么”和“接下来做什么”。
- 第三方代码 / 数据进入项目要在 `third-party/` 留来源与许可。

## 接手顺序

```text
README
→ AGENTS
→ docs/开发进度
→ ROADMAP
→ english/PLAN
→ english/VALIDATION
→ 远端最新 main / 当前 Draft 分支代码
```

如果文档与远端实际状态冲突，**以实际远端为准，并立即修正 `docs/开发进度.md`**。

