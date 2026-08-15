## Context
SmashUp 的计分阶段是跨多基地、多类触发源、多轮 interaction、多轮 reaction 的长事务。重构前，同一条规则链由多个系统共同判断：计分函数内部会临时 reduce 未来事件，外层再回滚 core；interaction handler 会拼接 deferred events；ReactionSession 和通用 ResponseWindow 同时表达 responder；Flow 还需要等待私有 `_waitFor...Reduce` flag。

这种结构的现实风险不是“代码不好看”，而是事实顺序会被破坏。例如 `onMinionDiscardedFromBase` 曾在 `BASE_CLEARED` 前由 `BASE_SCORED` 预测生成，导致 After Scoring 移走的随从也会收到从未发生的弃牌触发。

## Goals / Non-Goals
- Goals:
  - `scoreBases` 当前步骤、当前基地、deferred cleanup/replacement、remaining bases 和 reaction responder 都只有一个权威宿主。
  - core 的权威变化只来自 pipeline 正式归约领域事件，且每个领域事件只正式改变一次 core。
  - 可选响应判断与实际候选按钮使用同一 ReactionSession option builder。
  - 清场反应只从正式 `BASE_CLEARED` 事实产生。
  - UI 动画延迟、pipeline 轮次、测试 helper 不能成为规则状态机的一部分。
- Non-Goals:
  - 不改变 SmashUp 规则语义本身。
  - 不强制其它游戏迁移到 SmashUp scoring session。
  - 不删除通用 ResponseWindowSystem；它仍可被其它游戏使用。

## Decisions

### Decision 1: `smashup:score-bases` resolution frame 是计分事务唯一权威
SmashUp scoring session 挂在 `smashup:score-bases` resolution frame 的 metadata 和 step 上。它拥有 locked base refs、completed base refs、current base ref、当前 step、deferred post-scoring events/actions。

所有继续当前基地、恢复 afterScoring、finalize cleanup、刷新下一座基地的动作都从该 frame 读取，不再通过 `flowHalted`、散落 marker、handler continuation 或通用 response window 拼接。

### Decision 2: 事件提交屏障替代影子 reduce
当下一步依赖某个领域事件的结果时，driver 只发事件并把 session step 置为等待态；pipeline 正式 reduce 后，下一轮 driver 从已落地 core 继续。

这覆盖：
- Before Scoring trigger/marker → Me First。
- When Scoring trigger/marker → `BASE_SCORED`。
- `BASE_SCORED` / Munchkin treasure reveal → After Scoring。
- After Scoring trigger/marker → After Scoring response / cleanup。
- `BASE_CLEARED` / `BASE_REPLACED` → discard/reveal reactions。

### Decision 3: deferred cleanup/replacement 只由 scoring frame 持有和补发
当前基地的 `BASE_CLEARED` / `BASE_REPLACED` payload 写入 scoring frame deferred payload。afterScoring interaction handler 只返回自身业务事件，不负责判断是否最后一个交互，也不负责补发清场或选择下一基地。

finalizer 可以构造本地 cleanup batch view 来把“依赖清场/换基地后状态”的 deferred actions 物化为领域事件，但这个 view 不得刷新 session 的下一基地候选。下一基地必须等 cleanup 事件正式归约后，从权威 core 重新计算。

基地完成后 session 不再进入 `awaiting-post-reduce` 这类“等待下一轮 pipeline”的规则步骤。提交屏障由 Flow 的 `halt:true` 事件落地语义承担；session 只表达真实规则步骤，完成当前基地后回到 `idle`，随后从正式归约后的 core 刷新剩余基地。

### Decision 4: SmashUp ReactionSession 是唯一 responder 权威
Me First / After Scoring 的 current responder、pass、行动后新一轮、关闭条件和候选生成都属于 SmashUp ReactionSession/frame。通用 ResponseWindow 不再镜像或驱动这些 live reaction。

`hasSmashUpResponderDrivenReactionOptions()` 是“是否有可响应内容”和“实际按钮有哪些”的共同入口。probe state 只在本地调用栈中临时装入被 probe 的 ReactionSession，让 `validate()` 能看到同一窗口上下文；probe 不写回 MatchState，也不创建真实 prompt、pass 或 trigger consumption。

### Decision 5: 清场先成为事实，再产生清场反应
`onMinionDiscardedFromBase`、leave-play 和 discard 触发只能在 `BASE_CLEARED` 正式归约后，根据实际进入弃牌堆的对象产生，并携带必要 LKI。

这保证：
- After Scoring 移走的 First Mate 不会收到原基地清场弃牌触发。
- 抽牌/洗牌类弃牌触发看到的是已经更新后的弃牌区。

### Decision 6: 旧直调计分入口退出生产合同
生产 `scoreBases` phase hook 只调用 session-first 入口。内部执行器要求 active scoring session/baseRef；无 session 调用是内部契约错误。测试层如需单基地计分，必须通过真实 Flow + pipeline helper 建立 scoring session，而不是直调生产计分函数。

## Verification Strategy
- 静态合同测试：禁止 `RESPONSE_PASS` live bridge、ResponseWindow 镜像、preview-core/merge-core、`_waitFor...Reduce`、`awaiting-post-reduce`、standaloneCore、导出 `scoreOneBase` 等旧入口回归。
- 事务测试：覆盖 Before/When/After Scoring 提交屏障、deferred finalization、multi-base chain recovery、After Scoring rescoring、First Mate 清场事实触发。
- 类型与规格验证：`npx tsc --noEmit --pretty false`、`openspec validate refactor-smashup-scorebases-session-stability --strict --no-interactive`、`npm run spec:lint`。
