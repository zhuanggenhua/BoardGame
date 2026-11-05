# Change: 重构反馈现场包与可回放诊断合同

## Why

当前反馈记录虽然已有 stateSnapshot、actionLog、clientContext 和错误上下文，但这些字段彼此没有统一的故障关联键、采集时机或完整性等级。对于基地结算、AI 卡死、状态注入和撤回时序问题，现有材料能支持“按语义重建一个场景”，却不能稳定回放“原线上故障时点”。

本次重构直接解决用户指出的根因：反馈系统必须保存可关联、可消费、可判断完整性的现场包；拿不到完整现场时，必须明确标记为不可回放，不能再把状态注入成功或单次 E2E 通过写成历史故障已复现。

## What Changes

- 新增统一 diagnosticPacket 现场包，统一保存：
  - captureId、chainId、capturedAt
  - matchId / roomId / requestId / stateId / decisionEpoch
  - 客户端与服务端版本、提交号、构建时间
  - 触发阶段、回合、当前玩家、交互、响应窗口、合法动作、AI 决策预览
  - 故障时点状态、前一状态、后一状态（能采集时）
  - 行动日志尾部、事件流尾部、撤回游标、随机游标
  - replayability 完整性等级与缺失字段列表
- 客户端用户反馈、客户端自动反馈、服务端 AI/watchdog 反馈统一生成该现场包；旧字段继续保留兼容，但不再作为唯一诊断真相。
- 服务端在写入前校验现场包的关联键与完整性等级；缺少故障关联时只能落为 partial / unreplayable，不能伪装成可回放。
- 管理端详情直接展示现场包完整性、关联键和缺失字段，支持按 replayability 筛选。
- 反馈收口流程新增硬门槛：只有同一现场包完成真实消费验证、原始时点回放或明确记录不可回放原因后，才能分别给出“已修复”或“未复现关闭”。
- 为现有自动反馈与人工反馈增加迁移兼容和回填工具，不改写历史事实，不用推测字段冒充原始现场。

## Impact

- Affected specs:
  - feedback-management（新增）
  - admin-dashboard（扩展反馈详情与筛选）
  - .spec/knowledge/standards/feedback-system.md
  - .spec/skills/feedback-closeout/SKILL.md
- Affected code:
  - apps/api/src/modules/feedback/*
  - src/lib/feedback/*
  - src/engine/transport/transportFeedbackReporter.ts
  - src/engine/transport/onlineAiFeedbackDiagnosticsBuilder.ts
  - src/engine/transport/onlineAiWatchdogFeedbackDiagnostics.ts
  - src/pages/admin/*Feedback*
  - scripts/db/*、相关测试
- Compatibility:
  - 保留旧 stateSnapshot / actionLog / clientContext 字段；
  - 新字段作为规范真相，旧字段只作为兼容读取与历史回填输入。
- Explicit non-goals:
  - 不修改游戏规则、UI 交互语义或 AI 策略；
  - 不把重建夹具结果写回成原始线上现场；
  - 不自动把历史 closed/resolved 改成“已修复”。
