# Change: 收敛 SmashUp 计分结算链并稳定多重 afterScoring 场景

## Why
SmashUp 原 `scoreBases` 结算链曾同时由计分函数、Flow hook、交互 handler、reaction queue、通用 response window 和若干私有等待 flag 共同推进。该结构会把“当前结算到哪一步”“谁能响应”“清场是否已经发生”拆成多处状态，导致重复计分、漏清场、afterScoring 卡死、First Mate 弃牌触发提前产生等时序型回归。

本 change 的目标是把计分阶段收敛为商业级长事务：规则推进只由 `smashup:score-bases` scoring frame/session 决定，权威 core 只由 pipeline 正式归约领域事件改变；允许只读 query/probe view，但禁止把投影结果写回 MatchState、session 续链或真实 reaction/interaction。

## What Changes
- `scoreBases` 由 scoring session 作为唯一结算权威，覆盖当前基地、剩余基地、完成基地、deferred cleanup/replacement、After Scoring 响应与恢复。
- `BASE_SCORED`、Before Scoring、When Scoring、After Scoring marker/reaction、Munchkin 宝藏 reveal 都通过“发领域事件 → 暂停 → 正式归约后继续”的提交屏障推进。
- `BASE_CLEARED` 正式造成清场后，才产生 discard/leave-play 触发；不会再在 `BASE_SCORED` 后预测某个随从将被弃掉。
- deferred cleanup、replacement、reveal reaction、afterScoring handler 续链统一回到 scoring frame；具体 handler 只返回本步业务结果。
- SmashUp Me First / After Scoring 的 responder、pass、候选生成和关闭条件只由 ReactionSession/frame 决定，不再镜像到通用 ResponseWindow 或由通用窗口事件反推 pass。
- 删除旧直调/standalone 计分路径：生产 `scoreOneBase` 不再导出，无 scoring session 的计分执行会作为内部契约错误暴露；测试 helper 改走真实 Flow + pipeline。
- 保留的 projection 只限本地只读 query/probe/batch view：用于合法性探测、候选生成和同批事件派生，不写回权威状态，不创建真实续链。

## Completed State
- 生产扫描已确认 SmashUp live reaction 路径无 `RESPONSE_PASS` / `ResponseWindowSystem` 桥、无 responseWindow 镜像、无 `_waitFor...Reduce` 私有轮次 flag、无 `awaiting-post-reduce` session 轮次等待态、无视觉 delay 规则状态、无 preview-core/merge-core 入口、无 `simulateMatchState()`。
- 生产扫描已确认 `scoreBases` 无 `hasAuthoritativeScoringSession` 分支、无 `standaloneCore` inline clear/replacement reduce、无导出的 `scoreOneBase` 直调入口。
- After Scoring 的可响应判断与实际按钮共用 `hasSmashUpResponderDrivenReactionOptions()`；probe state 会携带本地只读 ReactionSession 上下文供 `validate()` 使用，但不写回权威 MatchState。

## Impact
- Affected specs:
  - `smashup-scoring-session`
  - `interaction-system`
- Affected code:
  - `src/engine/types.ts`
  - `src/engine/pipeline.ts`
  - `src/engine/systems/FlowSystem.ts`
  - `src/engine/systems/InteractionSystem.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/domain/reactionSession.ts`
  - `src/games/smashup/domain/reactionChoiceInteraction.ts`
  - `src/games/smashup/domain/scoringFinalization.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/game.ts`
  - `src/games/smashup/ai.ts`
  - SmashUp scoring / reaction / afterScoring 回归测试
