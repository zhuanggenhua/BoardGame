# Change: DiceThrone 角色选择门禁与多角色接入

## Why
当前 DiceThrone 已经不再是单一 Monk 开局，游戏实际存在独立的 `setup` 选角阶段、房主开始门禁、角色初始化和多角色资源接入，但 change 文档仍停留在早期方案，和现状有偏差。

## What Changes
- 引入 DiceThrone 角色目录与可选角色列表，至少覆盖 `monk`、`barbarian`
- 记录每位玩家的角色选择，允许多人选择相同角色
- 在 `setup` 阶段增加选角门禁：未选齐或房主未开始时，不进入正式回合
- 根据所选角色初始化牌库、技能、Token、资源与骰子配置
- 提供独立选角界面，使用点击角色卡牌完成选择，并展示玩家 ready/start 状态

## Impact
- Affected specs: `dicethrone-hero-selection`
- Affected code: `src/games/dicethrone/domain/*`, `src/games/dicethrone/ui/*`, `src/games/dicethrone/Board.tsx`
