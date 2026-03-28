# Change: PC 优先的移动端适配框架收口

## Why
- 项目已经不再采用“mobile-first 重写一套界面”的方向，而是明确转为“PC 优先，移动端条件覆盖”。
- 相关实现其实已经落地在运行时、manifest、页面壳层、方向提示、文档和接入规范里，但 active change 仍停留在早期试点口径，无法直接归档。

## What Changes
- 为游戏注册表补充显式移动端元数据要求：`mobileProfile`、`preferredOrientation`、`mobileLayoutPreset`、`shellTargets`。
- 新增通用移动支持能力：manifest 归一化、页面 data attributes、方向提示、`MobileBoardShell`、board-shell 条件缩放兜底。
- 将在线/本地对局页统一接入移动支持数据属性和通用壳层。
- 沉淀移动端适配说明文档与项目内 skill，作为后续游戏接入的权威流程来源。

## Impact
- Affected specs:
  - `game-registry`
  - `mobile-support-framework`
- Affected code:
  - `src/games/manifest.types.ts`
  - `src/games/mobileSupport.ts`
  - `src/config/games.config.tsx`
  - `src/components/common/MobileOrientationGuard.tsx`
  - `src/components/game/framework/MobileBoardShell.tsx`
  - `src/pages/MatchRoom.tsx`
  - `src/pages/LocalMatchRoom.tsx`
  - `src/index.css`
  - `docs/mobile-adaptation.md`
  - `.windsurf/skills/adapt-game-mobile/SKILL.md`

## Current Status
- 已完成实现，准备按现实口径归档。
