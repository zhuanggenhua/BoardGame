# 反馈真实提交链路 E2E 证据（2026-05-15）

## 范围

- 真实用户反馈链路：大厅反馈弹窗 -> `POST /feedback` -> `/admin/feedback` 列表 -> 详情
- 目标：验证“最近都没有反馈”是否来自反馈系统自身故障

## 结论

- 本地真实链路正常。
- 这次 E2E 证明：反馈弹窗能提交，API 能写入，后台列表能看到同一条记录，详情能展开同一条记录。
- 生产只读盘面也不是“没有反馈”：近 14 天仍有 45 条反馈记录，当前仍有 1 条系统 AI 反馈 open、1 条用户反馈 in_progress。

## 验证命令

- `npx eslint e2e/feedback-real-submission.e2e.ts`
- `node scripts/infra/run-e2e-single.mjs ci e2e/feedback-real-submission.e2e.ts "匿名用户从反馈弹窗提交后，应能在后台反馈列表看到同一条记录"`

## 关键截图

### 1. [01-feedback-modal-before-submit.png](../test-results/evidence-screenshots/feedback-real-submission/01-feedback-modal-before-submit.png)

- 实际看到：大厅右下角反馈弹窗已打开，描述框和联系方式都已填入探针内容。
- 实际看到：提交按钮可点，说明这不是静态空弹窗。
- 是否达标：达标，能作为“提交前已正确输入”的证据。

### 2. [02-admin-feedback-list-after-submit.png](../test-results/evidence-screenshots/feedback-real-submission/02-admin-feedback-list-after-submit.png)

- 实际看到：后台“反馈管理”列表中出现新的一行探针反馈，状态为“待处理”，时间为“刚刚”。
- 实际看到：列表里能直接看见和提交时一致的探针标题，说明写入后确实落到了后台列表。
- 是否达标：达标，能作为“写入后出现在真实后台列表”的证据。

### 3. [03-admin-feedback-detail-after-submit.png](../test-results/evidence-screenshots/feedback-real-submission/03-admin-feedback-detail-after-submit.png)

- 实际看到：右侧详情面板展开了同一条探针反馈。
- 实际看到：详情里同时显示内容、联系方式、匿名用户、提交来源“用户 / 反馈弹窗”、状态“待处理”。
- 是否达标：达标，能作为“列表项和详情是同一条真实记录”的证据。

## 生产只读盘面

- 查询窗口：最近 14 天
- `open/in_progress` 统计：
  - `splendor | online-ai-watchdog | open = 1`
  - `smashup | feedback-modal | in_progress = 1`
- 这说明“最近没有反馈”不是事实；更准确的说法是“最近反馈量不高，但系统并未断流”。
