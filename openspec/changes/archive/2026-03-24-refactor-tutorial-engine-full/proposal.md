# Change: 完整抽象教程引擎（系统化、事件驱动、可控随机与 AI 行动）

## Why
当前教程逻辑分散在 UI/Board 与少量领域逻辑中，存在双源状态与环境依赖（如读取 window）。这使教程行为不可复用、不可审计，且难以扩展到更多游戏与更复杂的教学步骤。

## What Changes
- 新增引擎级 TutorialSystem，将教程状态下沉至 `G.sys.tutorial`，成为唯一权威来源。
- 教程推进改为**事件驱动**（advanceOnEvents），避免 UI 依赖命令序列。
- 统一动作拦截（allowedCommands / blockedCommands）进入系统层 beforeCommand。
- 引入教程随机策略（fixed/sequence）与 AI 行动队列。
- TutorialOverlay 改为直接读取 `G.sys.tutorial.step`，移除对 TutorialContext 的依赖。

## Impact
- Affected specs: tutorial-engine
- Affected code: engine/systems、engine/adapter、components/tutorial、games/*/tutorial.ts、games/*/Board.tsx
