# 反馈 UI 改动 E2E 证据

## 验证目标

- 普通用户右上角显示反馈积分徽标，菜单里保留“我的反馈”入口并隐藏后台入口。
- “我的反馈”弹窗能展示自己的反馈、关闭状态、关闭理由和奖励积分。
- 提交反馈成功后，toast 内出现积分星形图标 `+1`，右上角积分同步增加。

## 执行命令

```bash
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
node scripts/infra/run-e2e-single.mjs ci e2e/feedback-ui.e2e.ts
```

## 结果

- 结果：通过
- 用例：
  - `普通用户右上角应显示积分并隐藏后台入口，且我的反馈弹窗展示关闭理由与积分`
  - `反馈提交成功后应显示积分 +1 toast，并同步更新右上角积分`

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\feedback-ui\01-user-menu-reward-points-and-my-feedback-entry.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\feedback-ui\02-my-feedback-modal-with-close-reason-and-reward.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\feedback-ui\03-feedback-success-toast-with-reward-plus-one.png`

## 人工观察

### 01 用户菜单入口态

- 右上角用户菜单触发器左侧已有星形积分徽标，当前值为 `7`，说明通用积分组件已经挂在真实首页入口上。
- 展开的菜单里能直接看到“我的反馈”，但没有“后台入口”，符合普通用户隐藏后台入口的要求。
- 这张图同时保留了首页真实页面背景、菜单展开边界和右上角入口位置，能证明这不是组件孤立页截图。

### 02 我的反馈弹窗展开态

- 弹窗标题为“我的反馈”，列表里这条反馈状态是“已关闭”，右上角有星形 `+1` 奖励徽标。
- 卡片正文下方清晰可见关闭理由“已核对为旧描述残留，现已按最新规则修正。”，说明关闭理由已经透到普通用户视角。
- 弹窗处于真实页面遮罩之上，关闭理由、奖励积分和反馈内容都在同一张图里可直接肉眼核对，达到本轮验收标准。

### 03 提交成功 toast 成功态

- 页面右上角 toast 显示“反馈提交成功，感谢支持！”并带星形 `+1` 奖励徽标，满足用户要求的正反馈样式。
- toast 出现时，用户菜单入口积分已经从 `3` 同步变为 `4`，说明前端本地积分状态联动生效，不只是 toast 文案假增量。
- 截图仍来自真实首页链路，能同时看到 toast、右上角积分入口和 HUD 浮层，足以证明提交成功态已落到新 UI。

## 结论

- 这轮反馈 UI 的三个关键态已经补齐真实页面截图：入口态、我的反馈展开态、提交成功态。
- 普通用户看不到后台入口，但能在右上角进入“我的反馈”，并看到关闭理由与奖励积分。
- 积分图标已统一走通用星形组件；成功反馈时不做额外庆祝动画，而是在 toast 文案内显示 `积分图标 +1`，且右上角积分同步增加。
