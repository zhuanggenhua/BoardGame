# Change: 升级 Splendor 本地 AI 的目标评估与可见态 lookahead

## Why
当前 `splendor` 本地 AI 仍主要依赖 Splendor 私有的 scorer 工厂与浅层投影逻辑。它没有复用公共 `lookahead` trace 契约，且对目标卡、贵族连续权重、预留收益、溢出丢弃和困难难度前瞻的处理不够稳定。

## What Changes
- 将 `splendor` 的本地 AI 接入公共 `createLookaheadLocalAiPolicy`
- 为 `hard` / `expert` 难度增加基于可见态的动作投影与 follow-up 评估
- 重做目标卡、贵族、预留、拿宝石、丢弃和终局阶段相关启发式
- 保留现有 `legalActions`、`playerView`、pending-resolution 与难度路由，不引入私有 `PASS` 或第二套动作协议

## Impact
- Affected specs: `splendor-ai`
- Affected code: `src/games/splendor/ai.ts`, `src/games/splendor/__tests__/ai.test.ts`
