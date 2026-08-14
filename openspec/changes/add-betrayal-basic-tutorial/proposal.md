# Change: 为山屋惊魂补基础教程能力

## Why

- 当前 `betrayal` 已经具备真实角色选择、恶兆前运行时、第一剧本 `Crimson Jack Returns` 的领域规则链，以及两条真实 E2E：`basic-flow` 与 `first-scenario`。但教程本体仍是空白，玩家还没有一条“为什么这么做、从哪里入手”的正式教学入口。
- 现有仓库已经支持 `TutorialCollection`、标准教程路由 `/play/:gameId/tutorial` 与 `/play/:gameId/tutorial/:tutorialId`，因此 `betrayal` 的缺口不是教程基础设施，而是这款游戏自己的章节规划、教程 manifest、真实锚点与最小验证。
- `betrayal` 当前最适合先做“多短章基础教程”，而不是一条超长教程：因为基础恶兆前主循环、第一剧本触发和英雄线收尾都已有真实页面与真实命令链，可以直接复用；而叛徒视角、更多剧本和更复杂规则面仍适合后续子教程单独补。

## What Changes

- 为 `betrayal` 新增教程目录（`TutorialCollection`），至少包含一条默认基础教程，并为后续子教程预留标准深链入口。
- 在 `betrayal` 引擎与运行时链里接入现有教程系统，使教程步骤建立在真实命令白名单、真实领域事件推进和必要的固定局面策略之上。
- 为 `betrayal` 当前正式页面补最小必要的真实教程锚点，覆盖：
  - 角色选择确认
  - 恶兆前五个主动作入口
  - 左下持有区 / 放大查看
  - 中央房间主视区 / 移动目标
  - 帮助入口
  - 第一剧本 haunt 关键动作入口
- 实现第一轮基础教程章节，范围只承诺：
  - 角色选择与基础目标
  - 恶兆前主循环（移动 / 探索 / 使用 / 结束回合）
  - 第一剧本触发与英雄目标
  - 第一剧本英雄线收尾
- 补齐教程结构测试、锚点测试与最小 E2E / 证据文档，证明 `betrayal` 教程不是只存在 manifest 文件。

## Impact

- Affected specs:
  - `tutorial-engine`
  - `betrayal-tutorials`
- Affected code:
  - `src/games/betrayal/game.ts`
  - `src/games/betrayal/Board.tsx`
  - `src/games/betrayal/tutorial.ts`
  - `src/games/betrayal/__tests__/*`
  - `e2e/betrayal/*`（仅在需要新增教程验证时）
  - `public/locales/*/game-betrayal.json`
  - `src/games/manifest.client.generated.tsx`（由生成脚本派生）
  - `docs/games/betrayal/records/betrayal-tutorial-coverage-matrix.md`
