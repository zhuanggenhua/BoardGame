# Change: add qidahen pregame scenario screen

## Why
当前《七大恨》把“剧本待选人物/军备”直接渲染在对局地图右上角。真实运行截图已经证明这会遮挡地图主视图，同时让教程/直进流程把“开局配置”和“局内操作”混成一页，用户不知道应该先完成剧本配置还是先开始走回合。

## What Changes
- 为《七大恨》增加独立的剧本前置选择页，在进入正式棋盘前完成剧本待选人物与待选军备。
- 统一在线建房、教程/直进对局两条入口：已有开局配置时直接消费，没有时进入前置页补齐。
- 剧本选择页成为唯一的剧本配置入口；进入正式棋盘后，不再重复渲染剧本摘要/待决项面板占用地图视野。

## Impact
- Affected specs: `qidahen-scenario-pregame-flow`
- Affected code: `src/games/qidahen/Board.tsx`, `src/games/qidahen/roomSetup.ts`, 对局入口与 E2E 流程
