# Change: 跨游戏通用 AI 对战系统

## Why
- 项目已经具备跨游戏复用的引擎、传输层和本地房间能力，但本地 AI 的策略层仍然偏薄，更多是“按动作类型硬编码优先级”。
- 用户已经明确路线是“更适合桌游的方向”，也就是围绕 `legalActions` 做启发式评分、必要时叠加搜索，而不是把行为树作为默认总方案。
- 如果不先把这层通用决策框架定义清楚，就会很快退化成“每个游戏自己写一套 if/else”，后续接 AstrBot、远程 provider 和训练数据都难以统一。

## What Changes
- 新增并收口 `game-ai-system` 能力，明确跨游戏 AI 的统一决策上下文、合法动作门控、seat controller、训练采集和 provider 接口。
- 在本地逻辑 AI 层引入“桌游优先”的通用策略抽象：
  - 默认以 `legalActions -> heuristic scoring -> best action` 为主流程
  - 允许游戏在同一抽象上叠加浅层搜索 / MCTS
  - 行为树仅作为个别游戏可选实现方式，不作为框架默认方案
- 在 `src/engine/ai` 增加可复用的合法动作评分策略 helper，避免每个游戏重复实现动作评分与 tie-break 逻辑。
- 将 Dice Throne 的 baseline 本地 AI 落到这套评分框架上，作为第一个较复杂桌游对象，而不只停留在 Tic-Tac-Toe 级别的简单样例。

## Impact
- Affected specs:
  - `game-ai-system`
  - `game-registry`（维持已有 `manifest.ai` 口径，不新增本轮变更）
- Affected code:
  - `src/engine/ai/`
  - `src/games/dicethrone/ai.ts`
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
  - 可能补充 `src/games/tictactoe/ai.ts` 的后续复用，但不作为本轮落地重点

## Current Status
- 已完成：proposal / design / delta spec / 跨游戏基础契约 / seat controller / 训练采集 / 本地 AI runner / Tic-Tac-Toe 与 Dice Throne 的首轮 runtime 接入
- 本轮新增目标：把策略层从“薄弱优先级表”升级为“通用桌游评分框架”，并在 Dice Throne 真正落地
