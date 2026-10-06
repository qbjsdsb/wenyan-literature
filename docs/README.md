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

## 当前基线与研究入口

main为桌面英语v1；#12是未合并的Smart Session/Experience v2；#13是独立云端与MCP研究 Draft，#14 是整合 Smart/研究的云基础实施。旧#2—#10不续接，#1文学审计冻结。接手读取实时main/PR/CI，不把文档SHA当永久head。

新增研究入口：[research/CLOUD-MCP.md](research/CLOUD-MCP.md)。保存方案比较、官方依据、同步/身份/MCP未知门槛与风险；不是第二份进度表。架构图在ARCHITECTURE，路线/验收在ROADMAP。

当前方向：Desktop-first、English-first；云长期事实与本地即时响应；ChatGPT可更换推理层。IDB/RPC/Auth UI/薄同步代码在 #14，托管 Auth/云同步尚未实测；MCP 尚未开放，文学/手机专项冻结。

## 文档分类

### 云基础实施
- [cloud-implementation.md](cloud-implementation.md)：IDB/RPC/同步协议、配置与可复现验收；当前状态仍只看开发进度。

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
→ research/CLOUD-MCP（本任务）
→ 实际main与进行中PR代码
```

如果文档与远端实际状态冲突，**以实际远端为准，并立即修正 `docs/开发进度.md`**。

