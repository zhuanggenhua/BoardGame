# Project Context

## Purpose
开发一个 AI 驱动的现代化桌游平台，核心解决“桌游教学”与“轻量级联机”需求，并支持 UGC 制作简单原型。支持从规则文档自动生成游戏逻辑，并兼容主流桌游模拟器 (TTS) 的美术资源。

## Tech Stack
- **Frontend**: React 19 (Vite, TypeScript), Tailwind CSS 4
- **Game Engine**: Boardgame.io 0.50
- **Realtime**: Socket.io (Lobby/Match)
- **Backend**: Node.js (Koa 游戏服务 + NestJS 认证/社交), MongoDB
- **Infrastructure**: Docker / Docker Compose

## Project Conventions

### Code Style
- Functional Components + Hooks
- TypeScript Strong Typing (avoid `any`)
- Tailwind CSS Utility Classes
- Chinese UI/Comments as primary language

### Architecture Patterns
- **Game Logic**: Pure functions (State Machine) via Boardgame.io
- **UI Components**: Atomic Design, localized game boards in `src/games/<game>/`
- **State Sync**: WebSocket (Socket.io) for multiplayer

### Testing Strategy
- Vitest（游戏/接口）与 Playwright（E2E）
- GameTestRunner（游戏领域层测试）
- Manual UI verification
- ESLint for static analysis

### Git Workflow
- Feature branches (e.g., `feature/tutorial-system`)
- Squash commits for clean history
- Conventional Commits (feat, fix, docs, etc.)

## Domain Context
- **Boardgame.io State (G)**: Serializable JSON object representing game state.
- **Context (ctx)**: Metadata like current player, turn, phase.
- **Moves**: Functions that modify G.
- **Phases**: Game flow segments (e.g., Setup, Play, End).

## Important Constraints
- UI must be responsive (Desktop/Tablet).
- All games must support both local and online multiplayer.
- Tutorial system must be generic enough to support different game types.
- Support lightweight UGC prototypes with minimal setup.

## External Dependencies
- Boardgame.io
- React / ReactDOM
- Tailwind CSS
- Vite
