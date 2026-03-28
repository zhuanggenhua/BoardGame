## Context
DiceThrone 当前实现已经包含多角色数据、`setup` 选角阶段、房主开始门禁和角色初始化流程，但原设计文档仍使用早期“Monk/Barbarian 两角色 + 拖拽球选角”的表述。

## Goals / Non-Goals
**Goals**
- 用 `setup` 阶段承载独立选角流程
- 在核心状态里记录角色选择与 ready 状态
- 用统一的角色目录驱动角色初始化
- 提供独立选角界面，并清晰展示角色归属、ready 和 host start 状态

**Non-Goals**
- 不在本次 change 中定义新增英雄的完整平衡方案
- 不要求保留早期拖拽式交互原型

## Decisions
- **选角状态放在 core**：使用 `selectedCharacters`、`readyPlayers` 和 `hostStarted` 作为单一真实来源
- **setup 阶段门禁**：`canAdvancePhase` 在未选齐、未 ready 或房主未开始时阻止进入正式回合
- **角色初始化按所选角色执行**：退出 `setup` 时发出 `HERO_INITIALIZED` 事件，按角色装配牌库、技能、Token、资源与骰子
- **选角 UI 使用点击卡牌**：玩家通过点击角色卡牌完成选择，界面展示玩家标记、当前选择、ready 状态和房主开始按钮
- **允许重复选角**：系统只限制“只能给自己选”，不限制多人使用同一角色

## Risks / Trade-offs
- 角色目录和资源接入继续扩展时，需要保持选角目录、初始化和 UI 展示同步
- `setup` 阶段加入门禁后，教程、本地模式和联机模式都要维持各自的推进策略

## Migration Plan
- 先对齐 change 文档到当前实际实现
- 归档为正式 spec，作为后续继续扩角色的基线

## Open Questions
- 后续是否需要在 `setupData` 中支持预选角色，用于自动化或快速开局
- 若未来支持更多房间主持场景，是否需要迁移 host start 权限
