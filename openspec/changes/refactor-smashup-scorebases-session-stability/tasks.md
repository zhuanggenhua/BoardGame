## 0. 已完成迁移切片
- [x] 0.1 建立 `BASE_SCORED` / Munchkin 宝藏 reveal 后的提交屏障：正式 scoreBases session 进入 `awaiting-score-award-reduce`，After Scoring 从已归约 core 继续
- [x] 0.2 删除 `scoreOneBase()` 中 `BASE_SCORED` 后预测性生成 `onMinionDiscardedFromBase` 的逻辑
- [x] 0.3 将 `BASE_CLEARED` 后实际进入弃牌堆的随从作为清场弃牌触发来源，并保留清场前 LKI
- [x] 0.4 更新旧测试 helper，使 After Scoring 相关测试模拟“发出事件 → pipeline 正式 reduce → 继续 frame”的两轮语义
- [x] 0.5 跑通当前切片的计分主链、历史事故组、清场/换基地组、Disney/Munchkin/Dragons/Cthulhu/Kaiju/中国功夫等受影响测试集合
- [x] 0.6 建立 Before Scoring 入队提交屏障：普通触发和基地能力同 frame 入队，正式 reduce 后才进入 Me First / 后续计分
- [x] 0.7 建立 When Scoring 入队提交屏障：whenScoring trigger/marker 正式 reduce 后才继续发 `BASE_SCORED`
- [x] 0.8 建立 After Scoring 入队提交屏障：afterScoring trigger/marker 与 cleanup payload 先进入 scoring frame，反应窗口/强制交互结束后不再重复 `BASE_SCORED`

## 1. 特征测试与迁移契约
- [ ] 1.1 在改动旧链前补事务级特征测试：规则步骤单调、每个领域事件仅正式归约一次、暂停只由子 frame 表示
- [x] 1.2 补 `BASE_CLEARED` 后才生成 `onMinionDiscardedFromBase` 的回归：First Mate 被移走时无弃牌触发；真实清场后抽牌/洗牌能看到新弃牌区
- [ ] 1.3 补 reaction 候选合同：同一 builder 同时决定“是否可响应”和实际选项，覆盖 Me First / After Scoring / 基地限制

## 2. 计分事务唯一权威
- [ ] 2.1 将 SmashUp `scoring session` 收敛为 `smashup:score-bases` resolution frame 的完整规则步骤，明确当前基地、剩余基地、延迟动作与力量快照的唯一落点
- [ ] 2.2 重构 `onPhaseEnter/onPhaseExit/onAutoContinueCheck`：只通过已正式归约的 frame step 推进 `scoreBases`，不再依赖 `flowHalted + scoredBaseIndices + afterScoringInitialPowers` 等松散组合
- [x] 2.3a 将 `BASE_SCORED` / Munchkin 宝藏 reveal 切到提交屏障，禁止这一步后继续预演 After Scoring
- [x] 2.3b 将 Before Scoring trigger/marker 改为“发事件后暂停，正式 reduce 后继续”
- [x] 2.3c 将 When Scoring trigger/marker 改为“发事件后暂停，正式 reduce 后继续”
- [x] 2.3d 将 After Scoring trigger/marker 入队迁出内部 reduce，frame 只从已正式归约状态判断后续交互/响应
- [x] 2.3e 删除 `scoreOneBase()` 外层 `preScoreCore` 回退契约，使权威 core 不再需要“先内部 reduce 再恢复”
- [ ] 2.4a 把 deferred cleanup、replacement 的唯一所有权收回 scoring frame
- [x] 2.4b 把 reveal trigger 从 `postScoringEvents.reduce(...)` 投影迁移到 `BASE_REPLACED` 正式归约后的 frame step
- [ ] 2.4c 从 `SmashUpEventSystem.afterEvents()` 与 `InteractionSystem.resolveInteraction()` 移除 SmashUp 专属传播/补发
- [ ] 2.5 收敛各 afterScoring handler（至少覆盖大副、海盗湾、托尔图加、刚柔流寺庙、母舰、侦察兵链）到新 frame 契约，handler 不再判断全局续链

## 3. Reaction 与表现解耦
- [ ] 3.1 让 SmashUp reaction frame/session 成为唯一 responder 权威，移除 ResponseWindow 镜像、双向 pass 桥接和重复 guard
- [x] 3.2a 删除 `buildPreviewStateWithPendingDomainEvents()`，interaction 后续反应只从正式归约状态继续
- [x] 3.2b 删除 `mergePromptResultCoreWithPreEventState()`，handler 发出领域事件时不得再通过手工 core 合并避免双重归约
- [x] 3.2c 删除 `postProcessSystemEvents()` 基于 `_ppseInputEventsReduced` 的 sys 隐藏轮次通道，改为 pipeline 显式参数
- [x] 3.2d 将 reaction session 的 stale trigger pruning / optional 全让过 trigger consumption 切到暂停式事件提交，暂停路径不再先 reduce core 后回滚
- [x] 3.2e 将 reaction trigger / reaction command 的暂停式后处理改为只派生事件、不递归解决 reaction queue，避免同一 frame 在正式 reduce 前被二次消费
- [x] 3.2f 清理局部卡牌/基地投影：桌游桌抽牌后弃牌候选改由 `CARDS_DRAWN` 事件 payload 派生；Geeks extra-action handler 只保留执行产生的 sys 交互，不再返回模拟 core；Min Maxing 查看手牌不再把 reveal 事件预演进下一 prompt 上下文
- [x] 3.2g 将 Geeks Min Maxing / Non-Infinite Loop 的 extra-action 候选和执行校验改成显式临时校验态，不再通过 `grantExtraAction` / `CARD_TRANSFERRED` 事件 reduce 预演未来 core
- [x] 3.2h 删除 Geeks Mulligan reveal 与 Banned List 多对手续链的 prompt 上下文事件预演
- [x] 3.2i 删除 Geeks Griefer 多对手续链的 `simulateMatchState()`；ability runtime 在领域事件正式归约后恢复 continuation program
- [x] 3.2j 清理 Marvel/Avengers 中可安全迁移的 prompt 续链投影：Ultimates Heroic Landing、Spider-Verse deck selection/order、Avengers Hulk Smash artifact → replacement
- [x] 3.2k 扩展 ability runtime continuation 可注入 pipeline 当前随机源，并迁移 Marvel / Avengers / Marvel Villains 剩余 runtime 卡牌级投影：Cosmic Knowledge、Shield Rescue Mission、Hawkeye’s Arrows、Hawkeye、J.A.R.V.I.S.、Red Skull、Hail Hydra、Baron Strucker、Kree Prepare to Engage
- [x] 3.2l 迁移剩余 Anansi / Russian Fairy Tales 手写 interaction 卡牌级投影；对 transformation / draw 后 prompt / destroy 后 search 等链路，先收敛到正式 continuation 或等价 frame，不机械删除
- [ ] 3.3 移除 `_waitForPostScoringReduce`、`_waitForScoreBasesInteractionReduce`、`_waitForStartTurnInteractionReduce` 的规则续链职责
- [ ] 3.4 把 post-scoring reveal 动画延迟迁到客户端事件表现层；领域 frame、AI recovery 与恢复逻辑不再读取视觉 deadline

## 4. Validation
- [ ] 4.1 运行事务特征测试及既有事故回归：`scoreBases-mefirst-window`、`base-tortuga-recovery`、`deferred-finalization`、`multi-base-chain-recovery`、`afterScoring-rescoring`、`beforeScoring-window-stuck`
- [ ] 4.2 运行单基地、多基地、基地能力与随从触发、After Scoring 重算、延迟清场/换基地只触发一次的领域组合
- [ ] 4.3 运行复杂端到端/近端到端链路，并在 evidence 或测试输出中证明多基地 + After Scoring + First Mate + response window 真实链路稳定
- [ ] 4.4 运行 `npx eslint` 针对修改文件、必要时补 `npx tsc --noEmit`，并执行 `openspec validate refactor-smashup-scorebases-session-stability --strict --no-interactive`
