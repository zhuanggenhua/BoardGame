# Change: 反馈来源建模与自动反馈可靠投递

## Why
- 目前自动反馈与玩家手填共用同一张表，仅靠 content 前缀 / contactInfo / errorContext.source 猜来源，后台无法稳定筛选或统计。
- 线上 watchdog 自动反馈实际上未送达（game-server 默认回退到 127.0.0.1:18001），导致“看不到自动反馈”。
- 需要正式的来源契约、受信写入策略与后台筛选能力，才能把系统反馈产品化。

## What Changes
- 新增反馈来源一等字段（reporterType/source/autoReportKind/incidentKey），并定义可信写入规则。
- 后台反馈列表支持按来源筛选，并在列表/详情明确展示来源信息。
- 修复 game-server 自动反馈投递地址配置（生产环境显式配置 FEEDBACK_API_URL）。
- 提供历史自动反馈回填（dry-run 默认），将 watchdog 旧记录补成 system 来源。

## Impact
- Affected specs:
  - feedback-management（新增）
  - admin-dashboard（新增反馈管理要求）
- Affected code:
  - apps/api/src/modules/feedback/*
  - src/engine/transport/server.ts
  - src/pages/admin/Feedback.tsx
  - src/pages/admin/components/FeedbackHelpers.tsx
  - docker-compose.prod.yml
  - scripts/db/backfill-feedback-reporter-source.*
- Data impact:
  - feedback 集合新增来源字段 + 索引
  - 可选历史回填
