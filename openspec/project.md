# Project Context

## Purpose
开发一个 AI 驱动的现代化桌游平台，核心解决“桌游教学”与“轻量级联机”需求，并支持 UGC 制作简单原型。支持从规则文档自动生成游戏逻辑，并兼容主流桌游模拟器 (TTS) 的美术资源。

## Tech Stack
- **Frontend**: React 19 (Vite 7, TypeScript), Tailwind CSS 4
- **Game Engine**: 自研引擎（DomainCore + Pipeline + Systems 架构）
- **Realtime**: Socket.io（GameTransportServer 游戏状态同步 + Lobby/Match 实时通信）
- **Backend**: Node.js (Koa 游戏服务 + NestJS 认证/社交), MongoDB
- **Infrastructure**: Docker / Docker Compose

## Project Conventions

### Code Style
- Functional Components + Hooks
- TypeScript Strong Typing (avoid `any`)
- Tailwind CSS Utility Classes
- Chinese UI/Comments as primary language

### Architecture Patterns
- **Game Logic**: Pure functions (DomainCore: setup/validate/execute/reduce/playerView) + Pipeline 执行管线
- **UI Components**: Atomic Design, localized game boards in `src/games/<game>/`
- **State Sync**: WebSocket (Socket.io) for multiplayer, GameTransportServer/Client 架构

### Testing Strategy
- Vitest（游戏/接口）与 Playwright（E2E）
- GameTestRunner（游戏领域层测试）
- Manual UI verification
- ESLint for static analysis

### Git Workflow
- Feature branches (e.g., `feature/tutorial-system`)
- Squash commits for clean history
- Conventional Commits (feat, fix, docs, etc.)

### New Game OpenSpec Conventions
- 新游戏或完整接入新 `gameId` 时，必须先建立该游戏的 OpenSpec change；不得只改 `design-system`、`src/games/<gameId>/` 或截图证据而不落 proposal / tasks / spec。
- 新游戏 foundation change 必须包含“附加能力矩阵”，至少覆盖：`action-log`、`undo-system`、`game-ai-system`、`tutorial-engine`、`debug-config`。
- `gameplay / scoring / runtime-entry / board-ui` 属于游戏本体；上述矩阵项默认属于本体后的附加能力，除非用户明确要求纳入本轮主交付。
- 例外澄清：`完整 game-ai-system` 仍默认属于本体后的附加能力；但若某游戏存在多人 / 建房 / waiting / spectator 等链路，本体阶段必须至少具备一种**可重复的人机测试路径**（例如房间内 AI 座位加入、在线 AI 座位加入、既有测试 helper，或其它不改变产品漏斗的正式路径），否则不算“可稳定验证的游戏本体”。
- 上述“可重复测试路径”**不等于**可以为了测试便利新增首页按钮、详情捷径、房间外独立入口或其它用户可见产品流。若现有 `创建房间/加入 AI`、既有测试模式、既有 debug/helper 已能承接验证，就必须优先复用；只有用户明确要求新增入口，或现有入口确实无法表达该能力时，才允许把它升级成产品功能。
- 附加能力矩阵中的每项都必须明确标记为：`实施本轮`、`本轮明确跳过`、或 `仅保留底层接口，UI 暂不交付`；不允许留空。
- 若某项跳过，proposal 或 design 必须写明原因、影响范围，以及计划在哪条后续 change 补回。
- `tasks.md` 必须同时记录实施项与显式跳过项，保证 PR 前能回看“这一批到底有意不做了什么”。
- 准备提 PR、请求合并或宣称“游戏已可交付”前，若游戏本体已经确认完成，必须回到该矩阵再次确认；若用户改变决定，需要先更新对应 OpenSpec 文档，再继续实施或收口。

## Domain Context
- **MatchState<TCore>**: 游戏状态，包含 `core`（领域状态）和 `sys`（系统状态）。
- **DomainCore**: 游戏领域内核接口（setup/validate/execute/reduce/playerView/isGameOver）。
- **Command**: 玩家操作指令（type + playerId + payload）。
- **GameEvent**: 领域事件（type + payload），由 execute 产生，由 reduce 消费。
- **Pipeline**: 执行管线，串联 validate → execute → reduce → systems。

## Important Constraints
- UI must be responsive (Desktop/Tablet).
- All games must support both local and online multiplayer.
- Tutorial system must be generic enough to support different game types.
- Support lightweight UGC prototypes with minimal setup.

## External Dependencies
- React / ReactDOM
- Tailwind CSS
- Vite
- Socket.io
- framer-motion
