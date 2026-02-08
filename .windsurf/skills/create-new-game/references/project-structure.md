# 项目结构速览（新游戏相关）

## 关键入口
- `src/games/<gameId>/`：每个游戏的独立目录
- `src/games/<gameId>/manifest.ts`：游戏清单条目（id 必须与目录名一致）
- `src/games/<gameId>/game.ts`：使用引擎适配器创建 Boardgame.io Game
- `src/games/<gameId>/Board.tsx`：渲染与交互 UI
- `src/games/<gameId>/tutorial.ts`：可选教程逻辑
- `src/games/<gameId>/thumbnail.tsx`：可选缩略图组件
- `src/games/<gameId>/domain/`：领域内核（types/commands/reducer）

## 引擎与系统
- `src/engine/adapter.ts`：`createGameAdapter`（Boardgame.io 适配器）
- `src/engine/systems/`：系统实现（Flow/Undo/Prompt/Log/Rematch 等）
- `src/engine/systems/index.ts`：`createDefaultSystems` 入口

## 清单生成
- `scripts/game/generate_game_manifests.js`：扫描 `src/games/*/manifest.ts` 自动生成清单
- `src/games/manifest*.generated.ts(x)`：自动生成，禁止手改

## 参考游戏
- `src/games/tictactoe/`：最小实现参考
- `src/games/dicethrone/`：复杂流程参考（仅供理解架构）
