# Change: 增加反馈关闭理由、我的反馈与积分记录

## Why
- 当前反馈一旦被关闭，用户侧看不到关闭原因，后台也缺少统一的关闭结论字段，导致“为什么关闭”无法追溯。
- 反馈提交后缺少“我的反馈”追踪入口，用户无法持续查看处理进度、关闭理由与自身反馈记录。
- 需要为后续反馈激励预留最小可用的积分记录模型，避免未来再改反馈协议、用户资料接口与右上角展示位。

## What Changes
- 为非自动反馈增加关闭理由字段，并要求在手动关闭时必填；系统自动反馈关闭时可不填写。
- 为已登录用户提供“我的反馈”入口与列表，展示反馈状态、处理进度、关闭理由和奖励积分；普通用户隐藏后台入口。
- 为反馈提交通路增加积分记录与右上角积分展示，并在提交成功描述中展示“星形积分图标 +1”样式。

## Impact
- Affected specs:
  - feedback-management（扩展现有待归档能力）
  - user-profile
- Affected code:
  - apps/api/src/modules/feedback/*
  - apps/api/src/modules/auth/*
  - src/components/system/FeedbackModal.tsx
  - src/components/social/UserMenu.tsx
  - src/contexts/AuthContext.tsx
  - src/pages/admin/Feedback.tsx
  - src/pages/admin/feedback-shared.tsx
- Data impact:
  - feedback 集合新增关闭理由、奖励积分等字段
  - user 集合新增累计反馈积分字段
- Change overlap note:
  - 该提案依赖 `add-feedback-origin-modeling` 中已经定义的 `reporterType/source` 语义来识别“自动反馈”
