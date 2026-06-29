# Change: 重构《七大恨》联机牌桌流程

## Why
《七大恨》当前把开局 setup、剧本决定、联机视角和行动交互拆散在多处：建房阶段会提前写死剧本结果，联机房间缺少同级的“剧本介绍 + 投票 + 前置”局内壳层；正式棋盘仍按当前行动势力展示手牌；一级行动、二级行动和地图点击同时暴露，用户无法判断当前真正该点哪里。这样会直接破坏联机可玩性与首轮上手体验。

## What Changes
- 为《七大恨》增加局内“剧本介绍 + 投票 + 前置”壳层：在线房间先在 match 内完成剧本介绍与全员投票，投票结算后再进入剧本待决人物/军备选择，并阻断正式牌桌主操作直到 setup 完成。
- 为《七大恨》补齐联机 `playerView` 与牌桌视角语义，私有手牌和可操作信息只按当前玩家座位展示，不再跟着当前行动势力串位。
- 重构《七大恨》正式棋盘的行动壳：先选一级行动，再显示二级交互与明确 CTA，减少“全盘到处都能点”的状态。
- 补《七大恨》从主页/房间到首回合核心动作的端到端验证与截图证据，并同步更新新游戏 workflow / UI 规则，防止下个游戏重复犯同类错误。

## Impact
- Affected specs: `qidahen-online-board-flow`
- Affected code:
  - `src/games/qidahen/Board.tsx`
  - `src/games/qidahen/domain/index.ts`
  - `src/games/qidahen/domain/types.ts`
  - `src/games/qidahen/domain/initialCoreSetup.ts`
  - `src/games/qidahen/domain/scenarioVoteState.ts`
  - `src/games/qidahen/QidahenPregameScenarioGate.tsx`
  - `src/games/qidahen/roomSetup.ts`
  - `src/components/lobby/CreateRoomModal.tsx`
  - `e2e/qidahen/online-inmatch-setup.e2e.ts`
  - `.codex/skill/create-new-game/SKILL.md`
  - `docs/ai-rules/ui-ux.md`
