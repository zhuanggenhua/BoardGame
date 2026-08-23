# 交互选项刷新索引

本文只记录旧 `InteractionSystem` 的选项刷新机制入口，不作为新增交互的设计规范。交互权限、Choice Request 和响应窗口设计以 [`rule-driven-interaction-design`](../.spec/knowledge/standards/rule-driven-interaction-design.md) 为准。

## 解决的问题

队列中后续交互可能在创建后才轮到玩家处理。等待期间如果场上对象、手牌、区域或计分结果变化，旧选项可能失效。旧 `simple-choice` 通过刷新候选降低这类过期风险。

## 当前入口

| 对象 | 入口 |
| --- | --- |
| 交互队列与刷新 | [`src/engine/systems/InteractionSystem.ts`](../src/engine/systems/InteractionSystem.ts) |
| 典型回归测试 | [`src/engine/systems/__tests__/InteractionSystem.test.ts`](../src/engine/systems/__tests__/InteractionSystem.test.ts) |
| 复杂游戏交互测试 | `src/games/**/__tests__/*interaction*.test.*` |

## 刷新时机

- 交互进入 `current` 时，若带 `optionsGenerator`，基于当前状态重建选项。
- 队列里的交互被弹出成为 `current` 时，再次刷新候选。
- 当前交互需要跟随状态变化时，可调用 `refreshInteractionOptions` 刷新。

## 刷新来源

| 来源 | 用途 |
| --- | --- |
| `optionsGenerator` | 复杂或业务条件敏感的候选，优先使用显式生成器 |
| 自动推断 | 旧兼容路径，根据稳定对象字段做基础活体检查 |
| 静态选项 | 跳过、完成、取消、纯确认等控制项 |

自动推断只能做基础候选保活，不能替代业务校验。候选是否真的可执行仍由正式命令验证、当前交互身份和规则状态决定。

## 使用边界

- 发现候选过期时，优先给交互补稳定业务 ID 或显式 `optionsGenerator`。
- 不要把刷新机制当成状态修复；它只更新候选展示，不能自动修正已经错误的规则状态。
- 多步、响应窗口、私有选择和 AI 可控选择优先建立正式合同，不继续扩大旧 `simple-choice` 的推断面。
