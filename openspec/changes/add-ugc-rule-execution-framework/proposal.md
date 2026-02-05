# Change: UGC 规则执行框架（仅基础框架，无游戏特化）

## Why
当前 UGC 引擎定位明确为“需求 → 提示词 → 外部 AI → 粘贴导入”，规则完全由用户生成。现有能力虽已支持 DomainCore 执行，但缺少“只提供基础框架、不内置任何游戏规则”的统一规范，容易与 ugc-builder-v2 的结构化效果块方向产生分叉。

## What Changes
- 新增“UGC 规则执行框架”能力规格，明确：
  - 仅提供 DomainCore 执行框架与通用组件骨架，不提供任何内置规则/牌型/比较逻辑
  - 规则代码只允许由外部 AI 生成后粘贴导入，不提供手动代码编辑器
  - 组件动作钩子与禁用开关仅作为框架能力，不绑定具体规则
- 明确与 `ugc-builder-v2` 的方向互斥：本变更不引入结构化效果块/移除 code 的路线

## Impact
- Affected specs: `ugc-rule-execution-framework`（新增能力）
- Affected code (future): UGC Runtime/Builder 执行框架与组件骨架

## Mutual-Exclusion
- 本变更与 `ugc-builder-v2` 目标互斥（结构化效果块 + 移除 code）。
- 最终仅保留其一，作为 UGC 主线执行方案。
