# Change: 接入纸牌帮扩展规则与变体选择

## Why
当前 The Gang 运行时只承诺基础版规则，TTS Workshop 中已经存在可还原的扩展模式、挑战和牌型变体脚本。用户希望优先把规则脚本核对并补齐，同时复用当前牌桌 UI 提供扩展选择入口。

## What Changes
- 增加 The Gang 规则配置，支持德州扑克、七张梭哈、香蕉分牌三种游戏模式。
- 增加 TTS Lua 挑战注册表对应的扩展选择入口，并按当前模式过滤不兼容挑战。
- 接入已核对的发牌、跳轮、额外公共牌、个人公共牌、特殊牌和牌型评估变体。
- 将工具、专家、保险柜和提醒类 UI 规则记录为后续范围，不在本次冒充完整交付。
- 复用当前 The Gang Board 视觉风格增加折叠扩展面板，不替换主牌桌 UI。

## Impact
- Affected specs: `the-gang`
- Affected code: `src/games/the-gang/domain/**`, `src/games/the-gang/Board.tsx`, `src/games/the-gang/game.ts`, `src/games/the-gang/manifest.ts`, `public/locales/**/game-the-gang.json`
- Affected docs: `docs/games/the-gang/expansions-rules-contract.md`

