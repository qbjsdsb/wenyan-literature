# Wenyan 英语桌面验收记录

本文件记录 Desktop English Baseline v1 的工程验收事实，并作为后续回归测试参考。

## 当前状态

Desktop English Baseline v1 已于 2026-10-06 通过 PR #11 正式合入 `main`。

主线基线提交：

`c01cee9512398d805f13163bc4b7e96b99c19d58`

合并前最新 head：

`bcdf60dd16df07cc0d1192307263b98693cca306`

当前不维护 Android / iOS 专项验收。

## 证据层级

严格区分：
1. Node 自动测试 / 构建。
2. Chromium 对真实 `dist` 静态产物的浏览器闭环验收。
3. 本人长期日常使用后的体验结论。

前两层已满足并用于进入 `main`；第三层属于固定入口上线后的真实使用阶段。

## 自动门槛

标准 CI：

```bash
npm ci
npm test
npm run build
```

PR #11 最终 head 全部成功；squash 合入 `main` 后，push CI 在 `c01cee9...` 上再次成功。

## 浏览器 smoke 环境

- Ubuntu 24.04 GitHub runner。
- Node 24。
- Playwright 1.63.0，仅 CI 临时安装。
- Chrome for Testing / Chromium 153。
- 1440 × 900 桌面视口。
- 直接运行 `npm run build` 生成的真实 `dist`，不是 mock 页面，也不是 Vite dev server。

长期回归 workflow：

`.github/workflows/browser-smoke.yml`

## 已通过：词库与层级

- 默认正式词库不是 24 个兼容词。
- 核心层正式规模 1200。
- 高频层正式规模 2444。
- 完整层正式规模 5528。
- 兼容旧记录的种子词不混入正式层级计数。
- 未完成 session 临时保留的低频词单独作为 carryover。
- 完整层可以搜索到默认可见列表之外的最低频测试词 `zoom`。
- 切换层级不破坏当前未完成 session。

第一次 Chromium smoke 曾真实发现“高频层显示 2448”：4 个旧 v0.1 兼容词被误计入正式层级。已经修复为 `active / compatibility / carryover` 三种独立计数，并回归通过。

## 已通过：三种训练模式

### 跟打
- 连续推进正常。
- 只产生 `typing`，不会冒充主动 `review` / FSRS 成功。
- 自动连续完成 30 词，最终进入结果页。

### 默写
- 可以根据释义输入英文。
- 首次故意答错后进入完整订正。
- 输入正确词后才能继续。
- 订正后再进行 FSRS 评价。
- 训练推进后刷新可以回到正确 session index。
- 点击提示后 `hinted:true` 立即持久化，刷新后仍保留。

### 听写
- 可以进入听写模式。
- 使用提示后答题 / 评价正常推进。
- 产生的 review 保留 `hinted:true`。
- 浏览器音频环境不可用时训练状态不损坏。

未自动宣称“扬声器真实可听性”；这属于固定入口后的本人电脑真实使用观察。

## 已通过：智能队列与错词

Node 测试保护：

```text
到期 → 近期错词 → 新词
```

覆盖：
- 近期错词派生。
- 后续正确清除旧错词派生状态。
- undo 对错词状态的影响。
- 队列去重和上限。

## 已通过：Session 完整性

- 开始训练后推进 index。
- 刷新后继续同一未完成词组。
- 点击提示但未提交时刷新，hinted 不丢失。
- 有未完成组时不会被新的智能开始覆盖。
- 点击继续后保持原 index。
- 在核心层恢复完整层低频词 session 时，该词作为 carryover 保留并可以继续。
- 旧 v0.1 种子词兼容另有 catalog / session 自动测试保护。

## 已通过：详情与统计

代码与 Node 测试覆盖：
- 音标、中文义。
- 考研排名 / 词频。
- 分类 / 子分类 / 变体。
- 词形变化。
- 学习状态、近期错词、收藏。
- 复习次数 / 下次复习。
- `may / May`、`march / March` 规范化重复项合并义项。
- 今日新学、主动复习、首次正确率、拼写错误、undo 活跃事件语义。
- 旧 review 缺少 `firstCorrect` 时不污染首次正确率。

固定 ECDICT 没有可靠 `pos` 覆盖，因此继续不展示假词性。

## 已通过：JSON 备份恢复

Chromium smoke 实际完成：
1. 产生真实英语学习事件和未完成 session。
2. 导出完整 JSON。
3. 新建干净 browser context。
4. 通过应用自己的“粘贴备份”入口重新导入。
5. 验证事件恢复。
6. 验证未完成 session index 恢复。
7. 点击“继续上次”并确认仍处于相同 index。

因此不是只验证 JSON 能解析。

## 已通过：静态部署路径

Vite 使用相对 base。

同一套真实 `dist` smoke 已在：
- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4174/desktop/`

两种路径各跑一次并全部通过，保护后续固定静态入口的根路径 / 项目子路径场景。

## 2026-10-06 结论

```text
标准 CI：通过
Chromium dist smoke：通过
根路径：通过
/desktop/ 子路径：通过
P0/P1：未发现残留阻塞
真实发现并修复：高频层 2444 被兼容词误显示为 2448
未自动验证：本人 Windows 长期日常使用体验、真实扬声器 TTS 主观效果
合并结果：PR #11 已 squash merge 到 main
main push CI：通过
```

## 后续验收重点

合并完成后，不再反复做“是否能进入 main”的验收。下一阶段关注真实产品使用：
1. 固定电脑端访问入口。
2. 本人开始连续真实使用。
3. 记录真实痛点，而不是凭空扩功能。
4. 优先评估快速筛词。
5. 再按真实数据决定到期排序、session 压缩和长期性能优化。

文学继续冻结，直到英语桌面端稳定长期使用。
