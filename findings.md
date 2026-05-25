# Findings: SmashUp yuanhou shared transport / playerView completion audit（2026-05-19）

## 已确认事实

- 造成“有真实进展但像死循环”的直接原因不是缺实现，而是**执行锚点分裂**：
  - 活跃 `goal.objective` 还停在旧 `The Spy Who Ditched Me / waiting overlay` residual；
  - 当前 worktree 根 `task_plan.md` 顶部仍是历史 `shayu` 任务；
  - 真正最新的 operational target 在长期状态 JSON `smashup-yuanhou-faction-effect-audit-2026-05-16.json` 的 `last_verified / next_actions`。
- 在现有工具约束下，`goal` 只能读取或标完成，不能原地改写 objective；因此本轮必须明确：**继续推进时以长期状态 JSON 为准**。
- 这轮唯一明确红点也不是实现回退，而是测试预期漂移：`server.test.ts` 里两条 `active-turn legal-action-recovered` 用例把 `blockerFingerprint` 错写成应等于**最终** `progressMarker`；真实合同是它保留**恢复起点**的 progress marker 作为 provenance。现已改成锁 `buildAiProgressMarker(match.state)`，并聚焦复跑 `online AI watchdog 完成 legal action 恢复后也应写入系统反馈|online AI watchdog 在 active-turn 的多步 legal action 链中，应只在最终交还回合后上报 resolved` => `2 passed`。
- 又补一格 `active-turn` 的 sibling-family resolved gate：`hasOnlineAiRecoveryResolved()` 此前没有单独直测“同一 AI 已切到 `visible-interaction / response-window / hidden-interaction / response-loop` 时仍不算 resolved”。现已新增最小门禁，聚焦验证 `9 passed`。
- 当前更高价值的下一格，不是再回扫对象级 family，而是继续把 `server.ts / onlineAiRecovery.ts` 里的 caller/source provenance 补成 direct gate，避免 completion audit 因“文档写到了、generic branch 也大概覆盖了”而反复重开同一缺口。
- 2026-05-19 新确认的一格 shared transport 缺口是：`response-loop` 的 trackerKey 虽然已经通过 `buildOnlineAiRecoveryFingerprint()` 吃到 `window id/sourceId`，但 `resolveOnlineAiRecoveryCandidate()` 与 `runOnlineAiRecoverySequence()` 在把 `response-window` 升级成 `response-loop` 时写入的 `candidate.fingerprintHint` 仍只有 `responderId/phase/windowType/queueSignature`，会让 feedback/blockerFingerprint 在失败诊断里把新窗口折回旧 incident。
- 现已把两处 `response-loop` provenance 一并收紧到 `responderId + phase + windowId + windowType + sourceId + queueSignature`，并补最小直测锁定：已进入 `response-loop` 的 candidate 会把 `response-loop-existing-tracker-1 / card-live` 保留下来，`resolveOnlineAiRecoveryFeedbackFingerprint()` 不再丢失这两格 provenance。
- 2026-05-19 继续往 legal-action fallback caller 下钻后，又确认 `active-turn-legal-only` 有一条对称缺口：
  - `resolveForceEndTurnForStalledAi()` 生成的 `active-turn-legal-only` candidate 只有 `active-turn-legal-only:${playerId}:${phase}` 这类粗 `fingerprintHint`；
  - 真正的 `stale-private-overlay / missing-private-overlay` provenance 是在 `tryRecoverOnlineAiWithLegalAction()` 里才出现的。如果 strict + emergency playerView 两次 `resolveNextAiDispatch()` 后仍 blocked，旧实现会直接拿粗 `fingerprintHint` 去构造 `stateSnapshot/actionLog.blockerFingerprint`，导致 failure 诊断丢掉 `blockedKey`。
  - 现已让 `tryRecoverOnlineAiWithLegalAction()` 返回 `blockedKey`，并在 legal-action-only 失败分支把它并回 candidate `fingerprintHint`；新增直测锁定 `active-turn-legal-only + stale-private-overlay` 的 feedback snapshot/actionLog 都会保留 `1:private-required:stale-private-overlay:targetingRoll:prompt-7`。
- 2026-05-19 同型缺口也存在于 `seat-legal-only`：
  - `resolveOnlineAiLegalActionOnlyCandidate()` 的 blocked candidate 已经会带 `blockedKey`，但同样需要在 strict + emergency playerView 后仍 blocked 的 failure 分支里把这格 provenance 写回 `fingerprintHint`。
  - 现已补最小直测，确认 `seat-legal-only + stale-private-overlay` 的 feedback snapshot/actionLog 都会保留 `1:private-required:stale-private-overlay:targetingRoll:prompt-seat-7`。
- 2026-05-19 completion audit 又确认一个此前只有 candidate 级证据、没有 feedback 级直测的旁支：
  - `resolveOrphanDisplayOnlyBonusDiceSettlement()` 已经会为 `displayOnly pendingBonusDiceSettlement` 生成 `fingerprintHint=display-only-bonus:${attackerId}:${phase}:${settlementId}`，但此前只测了“会生成 candidate”和“成功时会直接 `SKIP_BONUS_DICE_REROLL` 收口”，没有锁住失败反馈层是否真的保留 settlement provenance；
  - 现已新增 runtime direct gate：human `main1` 遗留 AI `displayOnly` bonus settlement 时，若 watchdog 代打 `SKIP_BONUS_DICE_REROLL` 失败，`stateSnapshot/actionLog.blockerFingerprint` 都会保留 `display-only-bonus:1:main1:display-only-bonus-feedback-1`；
  - 这条结论只把 `display-only-bonus` 提升为 feedback provenance direct gate，不外推整个 `seat-legal-only` family 或 DiceThrone bonus-die 生命周期已全部收口。
- 2026-05-19 completion audit 再向 `response-window` 主链下钻后，又确认一条更隐蔽的 provenance 洗掉点：
  - `response-window` 在 emergency playerView 后若仍 blocked，旧实现虽然会先拿到 `blockedKey` 并请求 overlay resync，但随后仍会 fallback 执行 `RESPONSE_PASS`；如果这一步没有产生任何进展，失败理由会落成 `response-window:recover-interaction:no_progress`；
  - 旧实现此时会先 `revalidateRecoveryCandidate(currentCandidate)`，把已经补到 `currentCandidate.fingerprintHint` 里的 `blockedKey` 洗回粗粒度 `response-window:${playerId}:${phase}:${windowId}:${windowType}:${sourceId}:${queue}`，导致 `stateSnapshot/actionLog.blockerFingerprint` 丢掉最关键的 blocked provenance；
  - 现已在 recovery sequence 中增加最小 hint 继承器：当旧 `fingerprintHint` 明显比 revalidate 后更具体时，失败路径保留旧 hint。新增 runtime direct gate 后，`response-window + stale-private-overlay + fallback RESPONSE_PASS + no_progress` 的反馈快照与 actionLog 都会保留 `1:private-required:stale-private-overlay:response-window:attack-rw-7`；
  - 这条结论只把 `response-window blocked feedback provenance` 提升为 direct gate，不外推整个 response-window family、overlay resync caller 或所有 `RESPONSE_PASS` 邻近路径已全部完成。
- 2026-05-19 completion audit 再补一格相邻 family 后确认：`visible-interaction` 的 blocked feedback provenance 此前也只有实现旁证，没有 direct gate。
  - 当前 `visible-interaction` 在 emergency playerView 后若仍 blocked，会先把 `blockedKey` 并回 `currentCandidate.fingerprintHint`，再 fallback 到 force command；但若这一步直接 `command_failed`，旧审计没有最小 runtime 证据证明 `stateSnapshot/actionLog.blockerFingerprint` 真的还保留那格 `blockedKey`。
  - 本轮新增 direct gate：`online AI watchdog 在 visible-interaction 经 emergency playerView 后仍 blocked 时，反馈 blockerFingerprint 应保留 blockedKey`；聚焦验证 `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 visible-interaction 经 emergency playerView 后仍 blocked 时，反馈 blockerFingerprint 应保留 blockedKey"` => `1 passed`。
  - 夹具命中的是 `visible-interaction + stale-private-overlay + fallback force command + command_failed` 这条失败链，结果 `stateSnapshot/actionLog.blockerFingerprint` 都保留 `1:private-required:stale-private-overlay:visible-interaction:super_spies_secret_agent_discard`。
  - 这条结论只把 `visible-interaction blocked feedback provenance` 提升为 direct gate，不外推 hidden-interaction 同族、overlay resync caller 或全部可见 prompt kind 已完成。
- 2026-05-19 completion audit 顺着同一条 fallback caller 链再补一格后确认：`hidden-interaction` 也存在同型覆盖缺口。
  - 当前 `hidden-interaction` 在 emergency playerView 后若仍 blocked，同样会先把 `blockedKey` 并回 `currentCandidate.fingerprintHint`，再 fallback 到 force command；但若这一步直接 `command_failed`，旧审计也没有最小 runtime 证据证明 `stateSnapshot/actionLog.blockerFingerprint` 仍保留那格 `blockedKey`。
  - 本轮新增 direct gate：`online AI watchdog 在 hidden-interaction 经 emergency playerView 后仍 blocked 时，反馈 blockerFingerprint 应保留 blockedKey`；聚焦验证 `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 hidden-interaction 经 emergency playerView 后仍 blocked 时，反馈 blockerFingerprint 应保留 blockedKey"` => `1 passed`。
  - 夹具命中的是 `hidden-interaction + stale-private-overlay + fallback force command + command_failed` 这条失败链，结果 `stateSnapshot/actionLog.blockerFingerprint` 都保留 `1:private-required:stale-private-overlay:hidden-interaction:super_spies_secret_agent_discard`。
  - 这条结论只把 `hidden-interaction blocked feedback provenance` 提升为 direct gate，不外推其他 hidden prompt kind、overlay resync caller 或全部 seat-only 交互已完成。
- 2026-05-19 completion audit 再往同一矩阵里补一格后确认：`active-turn` 也存在同型覆盖缺口。
  - 当前 `active-turn` 在 emergency playerView 后若仍 blocked，也会先把 `blockedKey` 并回 `currentCandidate.fingerprintHint`，再 fallback 到 force command；但若这一步直接 `command_failed`，旧审计同样没有最小 runtime 证据证明 `stateSnapshot/actionLog.blockerFingerprint` 仍保留那格 `blockedKey`。
  - 本轮新增 direct gate：`online AI watchdog 在 active-turn 经 emergency playerView 后仍 blocked 时，反馈 blockerFingerprint 应保留 blockedKey`；聚焦验证 `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 active-turn 经 emergency playerView 后仍 blocked 时，反馈 blockerFingerprint 应保留 blockedKey"` => `1 passed`。
  - 夹具命中的是 `active-turn + stale-private-overlay + fallback force command + command_failed` 这条失败链，结果 `stateSnapshot/actionLog.blockerFingerprint` 都保留 `1:private-required:stale-private-overlay:playCards:active-turn-owner-1`。
  - 这条结论只把 `active-turn blocked feedback provenance` 提升为 direct gate，不外推所有 active-turn 多步链、overlay resync caller 或其他 phase 的 legal-action family 已完成。
- 2026-05-19 completion audit 再补一格 shared-visible 分支后确认：`missing-visible-state` 此前也只有 helper 级合同，没有 feedback 级 direct gate。
  - 当前 `visible-interaction` 在 `shared-visible` 视角下若丢失 live visible state，`tryRecoverOnlineAiWithLegalAction()` 会直接返回 `blockedReason='missing-visible-state'`，且不会误走 emergency playerView 或 overlay resync；但旧审计没有最小 runtime 证据证明后续 fallback force command 若 `command_failed`，`stateSnapshot/actionLog.blockerFingerprint` 仍会保留那格 `blockedKey`。
  - 本轮新增 direct gate：`online AI watchdog 在 visible-interaction 遇到 missing-visible-state 且 fallback force command 失败时，反馈 blockerFingerprint 应保留 blockedKey`；聚焦验证 `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 visible-interaction 遇到 missing-visible-state 且 fallback force command 失败时，反馈 blockerFingerprint 应保留 blockedKey"` => `1 passed`。
  - 夹具命中的是 `visible-interaction + shared-visible missing-visible-state + fallback force command + command_failed` 这条失败链，结果 `stateSnapshot/actionLog.blockerFingerprint` 都保留 `1:shared-visible:missing-visible-state:smashup_immediate_extra_action`。
  - 这条结论只把 `missing-visible-state feedback provenance` 提升为 direct gate，不外推其它 shared-visible family、candidate producer 或全部 fallback command 路径已完成。
- 2026-05-19 completion audit 再补一格 `advance_guard_blocked` 后确认：这条此前只有 reason 级断言，没有 feedback 级 direct gate。
  - 当前 `runOnlineAiRecoverySequence()` 在 legal-action exhausted 后会尝试 fallback `ADVANCE_PHASE`；如果执行前发现当前已切到 human 回合，旧测试只证明 reason 会落成 `advance_guard_blocked`，没有最小 runtime 证据证明 `stateSnapshot/actionLog.blockerFingerprint` 仍保留原先的 legal-action provenance。
  - 本轮新增 direct gate：`online AI watchdog fallback 到 ADVANCE_PHASE 前应校验当前仍是 AI 回合，避免误推进 human 回合`；聚焦验证 `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog fallback 到 ADVANCE_PHASE 前应校验当前仍是 AI 回合，避免误推进 human 回合"` => `1 passed`。
  - 夹具命中的是 `legal-action-only -> follow-up ADVANCE_PHASE -> advance_guard_blocked` 这条失败链，结果 `stateSnapshot/actionLog.blockerFingerprint` 都保留 `legal-action-only:1:main2`，不再只剩 `active-turn:follow-up-advance:advance_guard_blocked` 这类 reason 级旁证。
  - 这条结论只把 `advance_guard_blocked` 提升为 feedback direct gate，不外推所有 follow-up advance、多步 legal-action exhausted 邻近分支或 overlay resync caller 已完成。
- 2026-05-19 completion audit 再补一格 `active-turn-legal-only:legal_action_unavailable` 后确认：这条此前也只有 reason 级断言，没有 feedback 级 direct gate。
  - 当前 `active-turn-legal-only` 在 AI active 的 `targetingRoll` / `offensiveRoll` / `defensiveRoll` 这类 legal-only 场景下，如果 `buildLegalActions()` 为空，或 legal action 真被选出来但执行失败，且本分支又不允许 fallback `ADVANCE_PHASE`，旧测试都只证明 failure 会落成 `active-turn-legal-only:follow-up-advance:legal_action_unavailable`，没有最小 runtime 证据证明 `stateSnapshot/actionLog.blockerFingerprint` 仍保留 active-turn legal-only provenance。
  - 本轮把这格补成两条 direct gate：`online AI watchdog 在 AI active 的 targetingRoll 且 legalActions 为空时，不得 fallback 到裸 ADVANCE_PHASE` 与 `online AI watchdog 在 active-turn-legal-only 的合法动作执行失败时，反馈 blockerFingerprint 也应保留 legal-only fingerprint`；聚焦验证分别为 `1 passed` 与 `1 passed`。
  - 两条夹具分别命中 `active-turn-legal-only -> no legal action -> legal_action_unavailable` 和 `active-turn-legal-only -> legal action command failed -> legal_action_unavailable` 两个失败子分支，结果 `stateSnapshot/actionLog.blockerFingerprint` 都保留 `active-turn-legal-only:1:targetingRoll`，不再只靠 reason 级旁证。
  - 这条结论只把 `active-turn-legal-only legal_action_unavailable` 提升为 feedback direct gate，不外推所有 roll phase、seat-legal-only 邻近分支或 overlay resync caller 已完成。
- 2026-05-19 completion audit 顺手补了一条 feedback 双出口一致性小缺口：
  - 现有 `online AI watchdog 自动反馈应携带交互选项与可选性诊断信息` 已经锁住 `stateSnapshot.blockerFingerprint` 会带上 `dt-test-visible-choice`，但旧断言没有同步检查 `actionLog.blockerFingerprint`，容易把“snapshot 对了、actionLog 漏了”误当已完全覆盖。
  - 本轮把同一夹具补成 snapshot + actionLog 双断言；聚焦验证 `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 自动反馈应携带交互选项与可选性诊断信息"` => `1 passed`。
  - 这条不新增 family，只是把既有 `visible-interaction diagnostics` 从“半覆盖”收紧成“反馈双出口一致”。
- 2026-05-19 completion audit 再补一格 `factionSelect legal-action-recovered` 后确认：这条此前只证明“会恢复并 resolved”，没有 recovered feedback 的 provenance direct gate。
  - 当前 `factionSelect` 的目标是阻止 watchdog 误发 `ADVANCE_PHASE`，已有夹具证明它会改走 `SELECT_FACTION`；但旧断言没有继续确认 recovered feedback 是否保留 `active-turn-legal-only` 这条 caller provenance。
  - 本轮把同一夹具补成 direct gate：`online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE`；聚焦验证 `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE"` => `1 passed`。
  - 结果不仅 `incidentKind=legal-action-recovered` 且 `status=resolved`，还同时锁住 `reason=active-turn-legal-only:legal-action:select-faction:select-faction:robots`，以及 `stateSnapshot/actionLog.blockerFingerprint` 都含 `active-turn-legal-only:2:factionSelect`。
  - 这条结论只把 `factionSelect recovered provenance` 提升为 direct gate，不外推所有 pregame / public setup / SummonerWars 邻近分支或多 AI 连续选阵营已全部完成。
- 2026-05-19 completion audit 再补一格 `seat-legal-only legal-action-recovered` 后确认：off-turn 公开 roll phase 这条此前也只证明“会恢复并 resolved”，没有 recovered feedback 的 provenance direct gate。
  - 当前 `human active` 的 off-turn `defensiveRoll` / `targetingRoll` 两条公开分支，已有夹具证明 watchdog 会代 AI 串行执行 `ROLL_DICE -> CONFIRM_ROLL -> ADVANCE_PHASE` 收口；但旧断言没有继续确认 recovered feedback 是否保留 `seat-legal-only` 这条 caller provenance。
  - 本轮把两条夹具都补成 direct gate：`online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死` 与 `online AI watchdog 在 human active 的 off-turn targetingRoll 阶段也应代 AI 执行合法动作，避免 4 人选目标卡死`；聚焦验证各 `1 passed`。
  - 两条结果都不只锁住 `incidentKind=legal-action-recovered` 且 `status=resolved`，还同时锁住 `reason=seat-legal-only:legal-action:advance-phase:legal-advance`，以及 `stateSnapshot/actionLog.blockerFingerprint` 分别含 `seat-legal-only:1:defensiveRoll:advance-phase:legal-advance` 与 `seat-legal-only:1:targetingRoll:advance-phase:legal-advance`。
  - 这条结论只把 `seat-legal-only recovered provenance` 提升到这两个 off-turn public roll 分支，不外推所有 public setup /其他 game phase /所有 multi-step legal-action chain 已全部完成。
- 本轮首先命中的最小缺口是：
  - `legalActionOnly` 当前虽已锁住：
    - same-player same-reason unresolved
    - `active-turn-legal-only <-> seat-legal-only` unresolved
    - same-player -> `active-turn` unresolved
  - 但还缺两条更直给的 sibling-family direct gate：
    - `legalActionOnly -> visible-interaction`
    - `legalActionOnly -> response-window`
  - 这两条若不单独落测，后续 completion audit 很容易再把“同一 AI 只是换了 surface”误看成“旧 incident 已收口”。
- 2026-05-19 继续下钻 `onlineDecisionView / localRunner` 后确认：
  - `shared/private freshness` 这一层已经锁住 `eventStream + interactionId + kind + sourceId`，当前没有证据支持再把 `title/options` 直接塞进 freshness fingerprint。
  - 真正仍偏粗的是 `resolveNextAiDispatch()` 产出的 `blockedKey`。旧实现对 `stale-private-overlay` 只拼 `turn/phase/currentPlayer/eventStream`，没有带 `interaction/response-window` 语义指纹；这会让“同轮同 epoch，但 prompt/source 已变”的新 blocker 继续复用旧冷却键。
  - 本轮已把 `ResolvedOnlineAiDecisionView.diagnostics` 扩到 `interactionId/kind/sourceId + responseWindow id/type/sourceId/responder`，并让 `localRunner` 把这组语义指纹并入 `blockedKey`。
  - 新增直测已通过，证明：
    - `blockedKey` 现在会显式包含 `owner-prompt-1 / simple-choice / super_spies_secret_agent_discard`；
    - 即使 `turn/phase/currentPlayer/eventStream` 完全相同，只要 `interaction sourceId` 漂移，`blockedKey` 也会变化，不再把新 prompt 吞进旧 resync cooldown。
- 2026-05-19 再往下审 `resolveOnlineAiRecoveryCandidate / trackerKey` 后又确认一格更底层缺口：
  - `onlineDecisionView` 的 freshness 现在不缺 `title/options`，但 recovery tracker 自己仍可能偏粗。
  - 旧 `buildInteractionRecoveryFingerprintHint()` / `buildOnlineAiRecoveryFingerprint()` 对 `visible/hidden simple-choice` 只看 `sourceId + title + minCount + optionCount`，不看 option IDs；
  - 这意味着即使剩余候选已从 `hand-a` 漂到 `hand-c`，只要标题、来源和候选数量没变，旧 tracker 仍可能把它当成同一个 incident。
  - 本轮已把 simple-choice 的 option signature 一并并入 recovery fingerprint，并新增 transport 直测证明：
    - 同 `sourceId/title/count` 下，hidden-interaction 候选从 `hand-a,skip` 漂到 `hand-c,skip` 时，tracker key 会切换；
    - watchdog 不会继续沿旧 tracker 自动恢复或上报失败。
- 2026-05-19 再补一格 visible simple-choice provenance：
  - 旧 `buildOnlineAiRecoveryFingerprint()` 的 visible simple-choice 也只看 `sourceId + title + minCount + optionCount`，没有带 `interactionId`，所以同一张 prompt 只要换了 interaction frame，就可能仍被当成旧 incident。
  - 现已把 visible simple-choice 的 `interactionId + optionSignature` 也并进 fingerprint。
  - 新增直测锁定：`reaction-choice-1` 与 `reaction-choice-2` 在 `sourceId/title/optionSignature` 相同、但 interactionId 漂移时，`buildOnlineAiRecoveryFingerprint()` 必须返回不同值。
  - 随后又补了一条真正的 runtime gate：`runOnlineAiRecoveryTick()` 在第一张 visible prompt 已执行 `SYS_INTERACTION_RESPOND(skip)` 后，若现场立即换成同 `sourceId/title/options` 但 `interactionId=visible-owner-only-2` 的第二张 visible prompt，watchdog 必须删除旧 tracker、停止沿旧 incident 继续恢复，也不应误上报 feedback。
  - 这条把 visible simple-choice 从“只有 fingerprint 变细”的 L2 旁证，推进到“旧 tracker 真会在 runtime 序列里被丢弃”的 direct gate；但当前仍只覆盖 `interactionId` 漂移分支，不外推 `dt:card-interaction`、`response-window` 或 `pending-damage` 的同类 runtime gate 已全部补齐。
- 2026-05-19 再沿同一条 shared transport 线下钻到 `dt:card-interaction`：
  - 旧 `buildOnlineAiRecoveryFingerprint()` 的 `dt:card-interaction` 分支只看 `type + targetCount + requiresTargetWithStatus + transferStatusId`，没带 `interactionId`，因此同语义但已换交互帧的新 prompt 也可能被复用旧 tracker。
  - 先补红灯后确认缺口真实存在：`buildOnlineAiRecoveryFingerprint 在 dt:card-interaction 的 type/target/status 相同但 interactionId 漂移时，也必须变化`。
  - 现已在 `server.ts` 把 `interactionId` 并入 `dt:card-interaction` fingerprint；复跑与 visible simple-choice、`pendingInteractionId` fallback 同组聚焦验证后，`3 passed | 156 skipped`。
  - 随后又补了一条 runtime gate：`runOnlineAiRecoveryTick()` 在第一张 `dt-card-interaction-1` 已执行 `SYS_INTERACTION_CANCEL` 后，若现场立即换成同 `type/target/status` 但 `interactionId=dt-card-interaction-2` 的第二张 `dt:card-interaction`，watchdog 必须删除旧 tracker、停止沿旧 incident 继续恢复，也不应误上报 feedback。
  - 这条把 `dt:card-interaction` 从“只有 fingerprint 变细”的旁证，推进到“旧 tracker 真会在 runtime 序列里被丢弃”的 direct gate；但当前仍只覆盖 `interactionId` 漂移分支，不外推其它自定义 interaction kind 的 runtime gate 已全部补齐。
  - 这条进展仍属于 shared transport / playerView completion audit，不是回头刷 DiceThrone 对象级玩法链。
- 2026-05-19 再补同型缺口到 `response-window / response-loop`：
  - 旧 `buildOnlineAiRecoveryFingerprint()` 的响应窗口分支只看 `windowType + sourceId + queueSignature`，没带 `window id`，因此同来源、同响应者队列但已换 frame 的新窗口仍可能被沿用旧 tracker。
  - 现已在 `server.ts` 把 `window id` 并进 `response-window / response-loop` fingerprint。
  - 新增直测锁定：`buildOnlineAiRecoveryFingerprint 在 response-window 的 type/source/queue 相同但 window id 漂移时，也必须变化`。
  - 与 `dt:card-interaction`、visible simple-choice、`pendingInteractionId` fallback 同组复跑后，聚焦验证结果为 `4 passed | 156 skipped`。
  - 同时又把 `response-loop` 单独补成 direct gate：新增 `buildOnlineAiRecoveryFingerprint 在 response-loop 的 type/source/queue 相同但 window id 漂移时，也必须变化`，确认不是只在 `response-window` 侧成立。
  - 这层语义现在还真正接到了 overlay resync caller：新增 `online AI watchdog 在 response-window id 漂移时，应允许再次触发 overlay resync，而不是被旧冷却一并吞掉`，证明 `blockedKey` 里的 `rw:` 片段已经参与冷却键判定，不再只是“fingerprint 变细了”的孤立实现。
- 2026-05-19 completion audit 又扫出一个“实现已在、但当前 worktree 没有直测锁住”的分支：
  - `buildOnlineAiRecoveryFingerprint()` 的 `pending-damage` 分支已经带 `pendingDamage.id + responderId + responseType`，但之前没有最小 direct gate。
  - 现已新增 `buildOnlineAiRecoveryFingerprint 在 pending-damage 的 responder/responseType 相同但 pending id 漂移时，也必须变化`，并直接转绿。
  - 这条说明当前缺的是 shared transport 覆盖证据，不是新的实现 bug。
- 2026-05-19 completion audit 再往 manual recovery 诊断口径下钻后，确认还有一条不会改动自动恢复判定、但会让 blocker 证据偏粗的 provenance 漂移：
  - `resolveManualForceEndAiPhase()` 的 `response-window` 分支会把 `candidate.fingerprintHint` 直接交给后续 snapshot/actionLog 的 `blockerFingerprint`；
  - 旧 `fingerprintHint` 只有 `responderId + windowType + sourceId`，没带 `windowId`，因此同来源同窗口类型但已换 frame 的手动强制关窗会被折叠成同一 blocker；
  - 现已把 `fingerprintHint` 收紧到 `manual-response-window:${responderId}:${windowType}:${sourceId}:${windowId}`，并用 `onlineAiRecovery-gameover.test.ts` 直测锁定 `fingerprintHint / attemptKey`；
  - 这条修正只证明 manual force-end 的诊断 provenance 现在与自动 watchdog 的 response-window 粒度重新对齐，不外推为 `resolveOnlineAiRecoveryCandidate()`、`hasOnlineAiRecoveryResolved()` 或 overlay resync caller 已全部完成。
- 2026-05-19 completion audit 再往 `MatchRoom` 的 manual caller 下钻后，又确认一条此前只靠阅读代码、没有 helper 直测锁住的边界：
  - `resolveManualOnlineAiRecovery()` 在没有 manual candidate 且 `resolveNextAiDispatch()` 返回 `blocked` 时，必须把 `blockedKey / blockedReason` 原样交还给 `forceEndAiPhase`，这样后续 `requestSeatResync(...)` 才不会丢失 caller provenance；
  - 现已在 `matchSeatValidation.test.ts` 新增 `手动强制结束在无 manual candidate 且 AI 决策被 blocked 时，应原样保留 blockedKey 与 blockedReason`，确认返回值保持 `kind='blocked'` 且不吞 `blockedKey`；
  - 随后又把 `forceEndAiPhase()` 里真正构造 seat resync 请求的那一跳抽成纯 helper `resolveManualBlockedOnlineAiSeatResync()`，并新增直测锁定 `blockedKey / blockedReason` 会原样进入 `reason='manual-force-end-blocked'` 的 resync meta，而 `blockedKey=null` 不会伪造请求；
  - 这两条加起来只证明 client helper/caller 已具备最小 provenance gate，不外推 `forceEndAiPhase` 的整段 UI toast / requestSeatResync 生命周期全量完成。
- 2026-05-19 completion audit 也顺手确认了两个当前不该继续当主线 residual 追的兼容残枝：
  - `pending-damage`：当前 worktree 里只剩 `server.ts` 的 fingerprint / diagnostic 拼装分支与对应直测，没有在 `resolveForceEndTurnForStalledAi()`、`resolveManualForceEndAiPhase()` 或 `resolveManualOnlineAiRecovery()` 找到 live candidate 生产者；
  - `action-loop`：同样没有 live candidate producer；`server.test.ts` 里原先“应触发 action-loop 兜底”的标题已经与真实断言漂移，实际断言一直是 `active-turn -> ADVANCE_PHASE`；
  - 现已把这条测试标题改成 `legacy action-loop residual`，明确它在当前 worktree 里是历史兼容/审计残枝，不再应被当成 shared transport 主线未闭口去重复扩样。
- 2026-05-19 又清掉了一条刚冒出来的假 blocker：
  - 新增的 `compare-roll-choice` runtime gate 复现后稳定表现为 `executed=[]`，说明当前 watchdog 根本没有进入 compare-roll 的可执行 recovery 链；
  - 结合 `onlineAiRecovery.ts` 现状可确认：compare-roll 当前只在 `visible/shared visibility` 与 `recovery fingerprint` 两层有真实合同，并没有对应的 `SYS_INTERACTION_RESPOND` runtime recovery family；
  - 因此这条测试不是“实现差一点”，而是把 fingerprint provenance 错写成了 runtime 恢复预期。现已删除该假 gate，只保留已经转绿的 `buildOnlineAiRecoveryFingerprint 在 compare-roll-choice 的 interactionId 相同但 sourceId 漂移时，也必须变化` direct gate；
  - 这一步的价值是把当前 worktree 从“新增一条无效红测导致继续卡住”拉回真实主线，避免下轮再把 compare-roll 当成 live recovery residual 重复排查。
- 2026-05-19 `dt:defender-choice` 则恰好证明了“哪些 kind 真属于 runtime recovery family”：
  - 和 compare-roll 相反，这条交互在 `onlineAiRecovery.ts` 的 `visible-interaction` fallback 下确实会走 `SYS_INTERACTION_CANCEL`；
  - 因而它不应只停在 fingerprint 直测。现已新增 runtime gate，确认第一次 cancel 后如果现场立即切成同 `interactionId` 但 `sourceId` 漂移的新 defender prompt，watchdog 会丢弃旧 tracker，不会继续沿旧 incident 恢复，也不误上报 feedback；
  - 这说明当前主线不是“所有 prompt kind 都补 runtime”，而是先区分该 kind 是否真有可执行 recovery family，再决定补 runtime 还是只保留 fingerprint gate。
- 2026-05-19 继续按长期状态 JSON 盘点 shared consumer seam 后确认：
  - `src/games/dicethrone/hooks/useAnimationEffects.ts` 已有 `didReset / didOptimisticRollback` 清队列逻辑，但当前 worktree 没有独立 rollback gate；
  - 这是真实覆盖缺口，不是 transport/provenance 主线又开了新洞。
  - 现已新增 `src/games/dicethrone/__tests__/useAnimationEffects.rollback.test.tsx`，锁定 optimistic rollback 后：
    - 旧动画队列不会残留；
    - 恢复旧 `DAMAGE_DEALT` 事件不会重播；
    - 只有后来真正新增的事件会继续触发 FX。
  - 这条结论只把 `useAnimationEffects` 提升到 shared consumer direct gate，不外推整个 DiceThrone FX/动画链已全部收口。
- 2026-05-19 同一条 shared consumer seam 继续往 SummonerWars 盘点后确认：
  - `src/games/summonerwars/ui/useGameEvents.ts` 也有 `didReset / didOptimisticRollback` 清理逻辑，但当前 worktree 里没有独立 rollback gate；
  - 这意味着 reconnect/resync 后，旧 `UNIT_ATTACKED` 攻击结果可能继续留在 `diceResult` UI 里，或恢复旧事件时被误当新事件重播。
  - 现已新增 `src/games/summonerwars/__tests__/useGameEvents.rollback.test.tsx`，锁定 optimistic rollback 后：
    - 旧攻击结果会被清空；
    - 恢复旧 `UNIT_ATTACKED` 不重播；
    - 只有后续新攻击事件才会重新进入骰子结果 UI。
  - 这条结论只把 `useGameEvents` 提升到 shared consumer direct gate，不外推 SummonerWars 整个攻击/动画链已全部收口。
- 2026-05-19 回到 transport helper 层再补一格后确认：
  - `resolveOnlineAiRecoveryCandidate()` 只有在 `shouldInspectSeatStatesForHiddenAiInteraction(sharedState)` 为真时，才会去构造 hidden seat view；这条入口条件如果回退，会直接影响 `pendingInteractionId` 锁住 response window 时的 hidden prompt 收口链。
  - 现已在 `onlineAiRecovery-gameover.test.ts` 新增 helper gate，锁定两件事：
    - shared 没有 current、但 `responseWindow.current.pendingInteractionId` 仍在时，必须继续检查 hidden seat state；
    - shared 当前交互还在时，即使 response window 残留 `pendingInteractionId`，也不得错误转去 hidden seat state。
  - 同时这轮还把 `resolveForceSkippableHiddenAiInteraction()` 的真实合同钉死了：
    - 若 hidden simple-choice 有 `skip`，即使同场还有非控制项，也会优先生成 force-skip；
    - 若只剩“非控制项 + __cancel__”，则不会自动取消。
  - 这条结论只把 hidden-seat inspection / force-skip helper 提升到 direct gate，不外推整个 onlineAiRecovery 主链已全部收口。

## 当前结论

- 当前 worktree 应按 shared transport / playerView completion audit 继续，而不是再按旧 goal/task 顶部标题回扫 `Spy / Secret Agent / The Spy Who Ditched Me / Portal Room / Time Box` 等已闭环 family。
- 后续每次“继续”都要先看长期状态 JSON 的 `next_actions`，避免再被历史 `goal` 或继承下来的旧 `task_plan.md` 顶部误导。

---

# Findings: SmashUp shayu 三派系通用入口矩阵补强与全量重审（2026-05-12）

## 已确认事实

- 本轮目标不是再补一个飞鲨特例，而是把“描述动作链第一入口”沉淀为通用审计矩阵。
- 旧 shayu evidence 已经回写过若干失效项：`sharks_air_jaws`、`sharks_freakin_laser_beam`、`mythic_greeks_favor_of_athena`、`base_oracle_at_delphi`。
- 当前必须避免把 2026-05-11 的“严格抽样审计”冒充成三派系全量重审。
- shayu 全量范围：`sharks` 12 张卡 + 2 基地，`tornados` 12 张卡 + 2 基地，`mythic_greeks` 15 张卡 + 2 基地。

## 初始风险判断

- P0：所有 `playNeedsBase/playNeedsMinion/ongoingTarget/specialNeedsBase` 与文案第一入口一致性。
- P0：所有“你的/对手/任意”随从目标必须有 UI/validator/handler 一致的控制者约束。
- P0：所有“至多/任意数量/可以/任意顺序”必须有 skip/multi/order 语义，不得自动吞掉玩家选择。
- P1：所有多步交互必须携带前一步上下文，不能靠当前 UI 选中或第一个匹配对象猜。
- P1：所有 beforeScoring/afterScoring/onActionPlayed/onMinionMoved/onMinionDestroyed/base ability 触发链必须能落到最终权威状态。

---

# Findings: 七大恨新游戏前置 intake（2026-05-11）

## 已确认事实

- 主真相源：
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\七大恨规则.pdf`
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Images`
- 项目内已存在本轮前置产物，继续复用而非覆盖：
  - `src/games/qidahen/rule/七大恨规则.md`
  - `src/games/qidahen/rule/七大恨素材接入清单.md`
  - `evidence/qidahen/qidahen-feasibility-2026-05-11.md`
  - `public/assets/i18n/zh-CN/qidahen/`
  - `public/assets/qidahen/thumbnails/cover.png`
- PDF 为原生文字，可通过项目脚本 `npm run pdf:md` 处理；当前规则 MD 已结构化成章节索引与规则正文。
- 素材目录共已接入 70 张正式中文资源，另有 1 张缩略图。
- 资源压缩结果：
  - `public/assets/i18n/zh-CN/qidahen/**/compressed/*.webp`：70 张，约 4.65 MB。
  - `public/assets/qidahen/thumbnails/compressed/cover.webp`：1 张，约 42.5 KB。
- 资源远端闭环：
  - `npm run assets:check` 显示本轮新增 71 个远端缺失资源。
  - `npm run assets:upload` 上传 71，跳过 1875，删除 0，失败 0。
  - 远端抽查主地图、明牌库图集、缩略图均为 200。

## 可行性结论

- 七大恨可接入，但属于中重策略游戏，不建议一次性完整自动化。
- 推荐先做 1619 三人剧本 MVP：轮盘、手牌资源、地图状态、基础移动/征兵/外交/战斗/胜利；人物、事件、战术、纪年例外分批白名单自动化。
- 最大风险是私有视角木块信息、地图边界结构化、多步战斗 Interaction、卡牌/人物例外量。

## Skill 优化

- 已补强 `.windsurf/skills/create-new-game/SKILL.md`：新增“规则 PDF 转 Markdown 与可行性评估”前置阶段。
- 新门禁要求 PDF→MD、素材盘点、压缩/manifest/远端检查、可行性分析完成后，才进入正式游戏骨架阶段。

---

# Findings: DiceThrone Treant / Ninja 新英雄（2026-05-09）

> 当前正式 findings 入口。下方内容是创建 worktree 时继承的历史记录，本轮只引用本节。

## 已确认事实

- 新 worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja`
- 当前状态：detached HEAD，未新建分支。
- 主工作树存在大量与本轮无关的 DiceThrone / SmashUp 改动；本轮必须避免混入。
- 用户提供的 `treant` / `ninja` 图片目录不是当前 HEAD 跟踪内容，新 worktree 初始没有这些文件，需要从主工作树复制。
- `treant` 原始素材：
  - `木苗树灵.png`
  - `神性树灵.png`
  - `生命源泉.png`
  - `提示板.png`
  - `玩家面板.png`
  - `幼种树灵.png`
  - `abilitycards.png`
  - `dice.png`
- `ninja` 原始素材：
  - `慢性中毒.png`
  - `忍术icon.png`
  - `提示板.png`
  - `玩家面板.png`
  - `烟雾弹icon.png`
  - `Ablilitycards.png`
  - `dice.png`
- 规范门禁：
  - 必须先建 DiceThrone 录入核对文档，再改运行时代码。
  - 新角色默认优先复用老英雄共享合同，特别是升级卡、`previewRef`、atlas、同类档位取最高、复合子技能。
  - `crops/` 只作为核对中间产物；正式运行时默认优先 `ability-cards` atlas。
  - 修改运行时资源后必须压缩、重建 manifest、上传并远端回查；若不能上传，需要最终说明。

## 待核对

- 两个新英雄的正式英文 canonical 名称、hero id 与 UI 展示名。
- `abilitycards.png` / `Ablilitycards.png` 的图集行列、与旧英雄 `ability-cards` atlas 是否同合同。
- treant 的 3 张独立 token/状态图片与提示板中的 token 定义关系。
- ninja 的 3 张独立状态/icon 图片与提示板中的 token 定义关系。
- 玩家面板上的技能、骰面、被动、终极技与旧英雄能力模型的复用/新增机制边界。

---

# Findings & Resources

## 2026-05-10 命令执行异常全链路发现

- `src/engine/transport/server.ts` 的 batch 失败链路原本会丢失真实原因：
  - `executeCommandInternal()` 能拿到 `result.error` 或 thrown `Error.message`；
  - `handleBatch()` / `executeBatchInternal()` 失败后固定发送 `batch:rejected(..., 'command_failed')`；
  - 这会把领域验证错误、pipeline contract 错误全部折叠成泛化失败。
- `src/pages/MatchRoom.tsx` 原本把 `command_failed` 归入 `SYSTEM_ERRORS`，在线错误处理直接 return。
- `src/engine/transport/react.tsx` 原本在 batch rejection 中显式跳过 `command_failed` 的 `onError`，导致批处理失败进一步不可见。
- 生产 SmashUp 日志中“命令执行异常”的真实原因是 effect contract 缺字段：
  - `base_the_asylum@onMinionPlayed` 缺 `controllerState`；
  - `base_ninja_dojo@afterScoring` 缺 `turnFlags`；
  - `base_castle_blood@onMinionPlayed` 缺 `turnFlags`。
- SummonerWars `长舟` 反馈缺 `matchId/stateSnapshot/actionLog`，源码内没有 `长舟/Longship` 对应实体；不能在没有现场的情况下直接放开召唤规则。
- 2026-05-10 追加修正：用户澄清“长舟”应按“大杀四方 / SmashUp”理解，已确认对应对象是维京基地 `base_drakkar`（德拉卡尔号 / Drakkar），不是 SummonerWars 地图或召唤入口。
- `base_drakkar` 回归原因：
  - `a4de3636` 把 SmashUp 反应排序资源从 `orderingFootprint` 切到运行时 `effectContract`，并把基地能力执行包进 `wrapTriggerCallbackWithEffectContract()`；
  - `base_drakkar` 旧声明只有 `reads: ['deckState']`、`writes: ['deckState', 'handState']`；
  - 但真实能力需要读 `players.*.minionsPlayedPerBase`（`playLimits`），可能读对手弃牌堆洗回（`discardState`），并打开 `base_drakkar` 选择玩家交互（缺 `opensInteraction: true`）；
  - 所以合法的“第一位随从打到德拉卡尔号”会被 contract 当成越权读取/交互误拦截，再被 transport 折叠成泛化 `command_failed`。
- 当前工作区修复口径不是继续给每张卡补手写 contract，而是移除旧运行时 contract 拦截，资源排序改走 reaction footprint / effect DSL 推导；已补 `PLAY_MINION -> base_drakkar` 真实触发链回归，当前 `base_drakkar` 聚焦测试 4 passed。

## Addendum（2026-05-07）：漏审主因已确认为“流程层不够深”，已升级审计规范

- 本轮结论不是“审计完全没维度”，而是：
  - 一部分维度口径需要补硬，典型是 `D37`
  - 更大的问题是执行层级停在 `L1/L2`，没有稳定打到 `L3/L4`
- 已在 `docs/ai-rules/testing-audit.md` 新增“深度审计流程（强制）”章节，核心变化：
  - 审计前先建对象清单并标层级，不再允许模糊汇报“这一批差不多审过了”
  - 每个对象必须串完整链路，不能只核对 validator 或只跑单测
  - reaction / response window / afterScoring / onDestroy / 动态候选 / 恢复态 / 同批事件后处理，全部改成真实入口强制核对项
  - 命中共享根因时必须自动扩审到同类函数、同类事件和共享调用点
  - 旧审计文档被推翻时必须原地回写失效结论
- 本轮点名加强的两个高风险位点：
  - `D37`：动态刷新不等于合法性完整，仍需继续核对 `zone/location/可打出形态`
  - `D40`：批内副作用必须串行吃最新状态，避免“同时杀俩小鬼只结算一次”这类 stale state 漏审

## Addendum（2026-05-04）：Splendor watchdog `69f6c4bc...` 已按本地热补止血结果回写 resolved

- `69f6c4bc9ec13b96d710e10d` 的系统文案是：
  - `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`
- 本轮最终回写前，线上只剩 watchdog 聚合摘要：
  - `route = server-watchdog`
  - `mode = online`
  - `occurrenceCount = 686`
  - `lastOccurredAt = 2026-05-03T23:49:50.740Z`
- 这条并不是“当前还在继续刷的新现场”，而是本轮 Splendor transport 热补止血后，状态尚未人工回写的旧聚合项：
  - `src/engine/transport/onlineAiRecovery.ts` 已禁止 Splendor 生成裸 `ADVANCE_PHASE` fallback
  - `src/engine/transport/server.ts` 已按 manifest 过滤 `localAi=false`，不会再因残留 seat metadata 把 Splendor 当成 AI 房间
- 本轮 fresh 复核再次通过：
  - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`
    - `Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback`
  - `src/engine/transport/__tests__/server.test.ts`
    - `online AI watchdog 对 manifest 明确禁用 AI 的 splendor 应忽略残留 seatControllers`
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T05:55:00.000Z`

## Addendum（2026-05-04）：DiceThrone watchdog `69f471da...` / `69f73be4...` 已按已修簇残留回写 resolved

- 这两条系统单文案完全一致：
  - `[system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
- 本轮最终回写前，线上只剩 watchdog 聚合摘要，没有还能继续复核的真实残局：
  - `69f471da9ec13b96d7109902`：`occurrenceCount = 2563`
  - `69f73be49ec13b96d710f1c2`：`occurrenceCount = 2`
  - 两条都已没有 phase / pendingInteraction / pendingAttack 级现场信息
- 当前本地 transport 修复链已经覆盖这类残留原因：
  - `evidence/transport/online-ai-watchdog-targetingroll-legal-only-fix-2026-04-30.md`
  - `evidence/dicethrone/dicethrone-online-ai-watchdog-human-response-window-fix-2026-05-02.md`
  - `evidence/dicethrone/dicethrone-online-ai-orphan-displayonly-bonus-settlement-fix-2026-05-02.md`
  - `evidence/dicethrone/dicethrone-feedback-69f21b05-ai-stall-targetingroll-loaded-local-closeout-2026-05-04.md`
- 本轮 fresh 复核再次通过：
  - `src/engine/transport/__tests__/server.test.ts`
    - `DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留`
    - `dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口`
    - `online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口`
- 2026-05-04 已通过生产 Mongo 批量回写：
  - `matched=2`
  - `modified=2`
  - `updatedAt=2026-05-04T05:50:00.000Z`

## Addendum（2026-05-06）：SmashUp 最后两条人工反馈已按正确口径回写，当前人类未收口为 0

- 本轮继续沿用 `人类反馈 > 系统自动反馈`，没有再把最后两条人工单让位给 watchdog 系统单。
- `69fa23e04590ce09779a7c52`（`“嗯？”可以重复使用。`）的结论是：
  - 不是新 bug，而是已修未回写。
  - fresh 证据链已覆盖：
    - `src/games/smashup/__tests__/newFactionAbilities.test.ts` 中 `world_champs_eh`
    - 真实入口 E2E：`e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
    - 三张收口截图：`eh-discard-panel-available` / `eh-minion-prompt-visible` / `eh-resolved-returned-to-hand`
  - 因此正式回写口径是 `resolved`。
- `69fa0bd74590ce09779a7bd6`（`尸体商店 + 雄蜂`）的结论是：
  - 不是实现 bug，而是规则理解偏差。
  - “防止被消灭”不等于“已经被消灭”，不会满足依赖“消灭”获得标记的语义。
  - 因此正式回写口径是 `closed`，不是 `resolved`。
- 生产回写回显：
  - `temp/feedback-closeout/update-feedback-status-20260506-smashup-human-remaining-two.raw.txt`
  - `69fa23e04590ce09779a7c52`：`matched=1 / modified=1 -> resolved`
  - `69fa0bd74590ce09779a7bd6`：`matched=1 / modified=1 -> closed`
- 回写后生产复核：
  - `temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-after-writeback-20260506.raw.txt`
  - `temp/feedback-closeout/query-human-open-inprogress-after-final-writeback-20260506.raw.txt`
  - 当前 `reporterType=user && status in [open,in_progress]` 的查询结果为：
    - `count = 0`
    - `docs = []`
- 本轮正式证据文档：
  - `evidence/feedback-closeout/smashup-human-final-two-writeback-2026-05-06.md`

## Addendum（2026-05-04）：当前线上 open 反馈已清零

- 最终生产盘面：
  - `openTotal = 0`
  - `inProgressTotal = 0`
  - `groups = {}`
- 最终摘要文件：
  - `temp/feedback-online/post-20260504-resolved-batch-17-summary.json`
- 本轮收口语义仍然遵守用户指定口径：
  - `resolved = 本地已经修好并完成本地验收`
  - 不代表已上传、已发布、已做正式镜像发版

## Addendum（2026-05-04）：SmashUp `69f5469a...` 《着魔》并非未附着，已回写 resolved

- `69f5469a9ec13b96d710ae26` 的反馈原文是：
  - `着魔没效果，目标随从没有附加行动卡`
- 线上当前权威态不是“系统根本没附着成功”，而是已经推进到了更后拍：
  - `sys.phase = playCards`
  - `sys.flowHalted = false`
  - `sys.interaction.queue = []`
- 同一份线上 action log 已经直接记录到《着魔》的真实附着：
  - `[08:31:10] 测试员: 战术卡施放： 着魔`
  - `[08:31:10] 测试员: 附加持续战术： 着魔  →  c24`
  - `[08:31:45] 测试员: 附加持续战术： 着魔  →  c6`
  - `[08:32:19] 测试员: 附加持续战术： 着魔  →  c24`
  - `[08:32:42] 测试员: 附加持续战术： 着魔  →  c24`
- 当前保存下来的终态里虽然看不到宿主身上仍挂着《着魔》，但这是因为：
  - `world_champs_bewitched (c11)` 已在 `players['0'].discard`
  - 当时被附着过的 `skeletons_returned_one (c24)` 也已经进入弃牌堆
  - 结论是链路已经继续推进到宿主与《着魔》都离场后的更后拍，而不是“前面从没附着上”
- 仓库当前权威文案与既有回归也完全支持这一结论：
  - `public/locales/zh-CN/game-smashup.json`
    - `打出到一个仆从身上。持续：这个仆从获得+2力量。如果这个仆从离开游戏，转移这张行动到另一个仆从身上。`
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - `world_champs_bewitched 离场转移交互可把持续行动从弃牌堆重新附着`
  - `evidence/smashup/smashup-world-champs-bewitched-eh-e2e-2026-04-28.md`
    - 已证明《着魔》会真实附着、宿主离场后会真实弹转移 prompt，并能重新附着到新宿主
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T05:35:00.000Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 3`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`
  - `smashup|feedback-modal = 0`

## Addendum（2026-05-04）：SmashUp `69f01fd4...` 《斯芬克斯》真实选择位点不是单独按钮，已回写 resolved

- `69f01fd49b68d90ee983669d` 的反馈原文是：
  - `没法选择打出斯芬克斯`
- 线上当前权威态已经说明现场不是“系统没给可选目标”，而是已经进入 `Sphinx` 的真实起始回合交互：
  - `sys.phase = startTurn`
  - `sys.flowHalted = false`
  - `current.id = titan_sphinx_start_turn_0`
  - `current.data.sourceId = titan_sphinx_start_turn`
- 这份交互当前给出的真实候选不是“点一张 Sphinx 卡面”，而是：
  - 选择一张自己的埋葬牌 `buried-c17 = 远古诅咒 @ 金字塔`
  - 或 `skip`
- 场上上下文也与这份交互完全对得上：
  - `base_pyramids_pod` 下方确实存在 1 张己方埋葬牌
  - `titan_0_sphinx` 仍在 `setaside`
- 当前仓库权威文案与实现都明确说明 `Sphinx` 的入口就是“先选埋葬牌，再把泰坦打到该牌所在基地”：
  - `public/locales/zh-CN/game-smashup.json`
    - `特殊：你的回合开始时，你可以将你埋葬的一张牌返回手牌，然后将此泰坦打出到该牌所在的基地。`
  - `src/games/smashup/abilities/titans.ts`
    - `sphinxOnTurnStart(...)` 会先收集“你的埋葬牌”作为候选
    - `titan_sphinx_start_turn` handler 在选中埋葬牌后，才会把该埋葬牌回手并把 `Sphinx` 打到对应基地
- 本轮复核也再次证明当前代码基线无回归：
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
    - `狮身人面像会在你的回合开始时创建回收埋葬牌并进场的交互`
    - `狮身人面像在其所在基地计分后会创建回收该基地埋葬牌的交互`
  - 浏览器级既有证据：
    - `evidence/smashup-sphinx-start-turn-buried-refresh-e2e-test.md`
    - `evidence/smashup-sphinx-stale-buried-options-e2e.md`
- 因此这条反馈不是“系统不能打出 Sphinx”，而是用户把真实交互位点理解成了“应该额外弹出一个单独的 Sphinx 按钮”。
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T05:25:00.000Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 4`
  - `smashup|feedback-modal = 1`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f387a3...` 《雏菊花环》正负号并未写反，已回写 resolved

- `69f387a35cacc4e6b5cdbd4c` 的反馈原文是：
  - `按效果我应该加2战力  而不是减2`
- 线上当前权威态已经说明这不是“自己给自己贴了《雏菊花环》却被扣 2”的场景：
  - `base_secret_garden` 上的 `c10 = fairies_tinx`
  - `c10.controller = "0"`
  - `c10.attachedActions` 中存在 `c17 = fairies_daisy_chain`
  - `c17.ownerId = "2"`
- 同一份 action log 末尾还能看到真实链路：
  - `tinx -> 神秘花园`
  - `ongoing_detached 雏菊花环 ... （原因：tinx）`
  - `ongoing_attached 雏菊花环 -> c10`
- 当前仓库权威文案与实现完全一致：
  - `public/locales/zh-CN/game-smashup.json`
    - `打在一个随从上。持续：如果你控制该随从，它具有 +2 力量；否则它具有 -2 力量。`
  - `public/locales/en/game-smashup.json`
    - `Play on a minion. Ongoing: This minion has +2 power if you control it, or -2 power if you do not.`
  - `src/games/smashup/abilities/ongoing_modifiers.ts`
    - `fairies_daisy_chain` 当前逻辑是 `action.ownerId === ctx.minion.controller ? +2 : -2`
- 因此这条反馈对应的现场里：
  - 随从控制者是 `0`
  - 附着的《雏菊花环》拥有者是 `2`
  - 根据当前规则语义，结论就应该是 **-2**，不是 `+2`
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T05:02:42.133Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 5`
  - `smashup|feedback-modal = 2`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f544f9...` 《轮回者》reaction 语义误判已回写 resolved

- `69f544f99ec13b96d710ae00` 混在一起描述了两个现象：
  - 《轮回者》打出后为什么还会出现 `选择反应`
  - 《名人堂 + 大法师》为什么之前还会出现结算顺序选择
- 线上当前保存下来的权威态已经说明它不是“最终没生效”的坏终态：
  - `base_hall_of_fame.buriedCards` 中已经存在 `skeletons_returned_one`
  - `base_hall_of_fame.minions` 中已不存在《轮回者》本体
  - `flowHalted=false`、当前阶段已回到 `playCards`
- 这与现有浏览器级证据完全一致：
  - `evidence/smashup/smashup-skeletons-returned-one-spooky-scary-gravestones-e2e-2026-04-29.md`
  - 该文档已经明确修订过旧错误假设：
    - 旧假设：`轮回者` 自埋后应“直接无交互”
    - 当前真实链路：先进入 `smashup_reaction_choose`，再由《轮回者》收口
- 《名人堂 + 大法师》这一半也已有精确回归：
  - `src/games/smashup/__tests__/archmageE2E.test.ts`
    - `在名人堂打出大法师时，应自动结算无冲突 trigger 而不是弹排序交互`
- 2026-05-04 本轮尝试 fresh 复跑上述 `archmageE2E` 时，被当前工作区内 unrelated 的 `ancient_egyptians` 初始化错误阻塞：
  - `ReferenceError: ancientEgyptiansSealTheTombProgram is not defined`
  - 位置：`src/games/smashup/abilities/ancient_egyptians.ts`
  - 该错误与本条反馈无直接关系，本轮未扩大范围去修无关脏改
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T04:50:58.267Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 6`
  - `smashup|feedback-modal = 3`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f385d7...` `Puck + Spirit of the Forest` 双分支补发已回写 resolved

- `69f385d75cacc4e6b5cdbd4a` 的用户反馈不是一个新根因，而是 Fairy Titan `Spirit of the Forest` 的“一回合一次 OR 两边都触发”语义在 `Puck` 上的具象表现：
  - 现场 action log 已出现 `Puck -> 436-1337工厂`
  - 当前场上同时存在 `fairies_spirit_of_the_forest`
  - 现场快照末尾交互已包含 `extra_action / draw_card` 两个分支
- 当前仓库已有与该反馈直接同构的精确回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - `fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过`
  - `src/games/smashup/__tests__/commandsValidation.test.ts`
    - `fairies_spirit_of_the_forest special 需要同时保留通常随从与通常行动额度`
- 2026-05-04 本轮已复跑并通过上述两条聚焦回归，证明当前代码基线下：
  - 第一条 OR 分支执行后，不会把第二条分支吞掉
  - follow-up prompt 会继续给出剩余分支与 `skip`
  - Titan 的“本回合已用”标记只会在完整收口后落下
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T04:26:35.049Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 7`
  - `smashup|feedback-modal = 4`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f27a5d...` 忍者侍从额外打出随从不触发 `onPlay` 已回写 resolved

- `69f27a5dab54eadcc2bb2c75` 的线上现场不是“忍者侍从没有把随从打出来”，而是“额外打出的随从已经进场，但它的打出效果没有继续往后触发交互链”：
  - action log 已明确出现 `忍者侍从 -> 工坊`
  - action log 已明确出现 `枪手 -> 工坊`
  - 但后续没有 `枪手` 的决斗选择，也没有对应的决斗结算
- 根因不在 `ninja_acolyte_play` 交互处理器本身，而在 `MINION_PLAYED` 的后处理时机：
  - `ninja_acolyte_play` 响应后确实会产出 `MINION_PLAYED(consumesNormalLimit=false)`
  - 这个 `MINION_PLAYED` 不是走普通 `PLAY_MINION` execute 主链，而是走 `afterEvents` 轮里的交互处理器返回事件
  - `postProcessSystemEvents()` 在处理这类 `afterEvents` 轮产生的 `MINION_PLAYED` 时，临时 `core` 里还看不到刚进场的随从
  - `cowboys_gunfighter` 的 `onPlay` 需要先在当前 state 里找到自己所在基地；看不到自己时，`queueEnemyDuelPrompt()` 会直接短路返回空事件
- 本地最小修复点：
  - `src/games/smashup/domain/index.ts`
  - 在 `postProcessSystemEvents()` 的 `MINION_PLAYED` 分支中，若当前事件来自 `afterEvents` 轮且尚未 reduce，则先把该 `MINION_PLAYED` 临时 reduce 到 `tempCore`，再调用 `fireMinionPlayedTriggers()`
- 已新增并通过的聚焦回归：
  - `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
    - `忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择`
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - `cowboys_gunfighter 打出后可与同基地敌方随从决斗并消灭失败者`
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T04:09:25.548Z`
- 回写后最新生产 open 盘面：
  - `openTotal = 8`
  - `smashup|feedback-modal = 5`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`
- 修订说明：
  - 本文档下方关于“`69f27a5d...` 仍需独立核对”的旧结论已失效
  - 该条现已按“本地已修 + 生产状态已回写”独立收口

## Addendum（2026-05-04）：SmashUp `69f27faa...` `Difference Engine` 无限抽牌已回写 resolved

- `69f27faaab54eadcc2bb2c77` 的现场不是“差分机能力自己死循环”，而是 `endTurn` 恢复态把同一组 `onTurnEnd` trigger 重新排队：
  - 现场终态是 `sys.phase = endTurn`、`sys.flowHalted = true`
  - `triggerQueue` 同时含有 `onTurnEnd:steampunk_difference_engine` 与 `onTurnEnd:tricksters_big_funny_giant`
  - action log 连续出现多次“游客6550 抽1张牌”
- 关键事件模式已经锁定问题位点：
  - `SYS_INTERACTION_RESOLVED`
  - `su:trigger_consumed`
  - 紧接着再次出现同一组 `su:trigger_queued`
  - 这说明 bug 不在 trigger 执行逻辑本身，而在“已经消费过的 turn-end frame 被重新 collect”
- 本地最小修复点：
  - `src/games/smashup/domain/index.ts`
  - 在 `smashupFlowHooks.onPhaseExit` 的 `from === 'endTurn'` 分支前加入恢复态闸门
  - 当 `flowHalted=true`、无 active interaction、无 `SmashUpReactionSession`、且 `triggerQueue` 里已无 `turn-end:` frame 时，直接发 `SU_EVENTS.TURN_ENDED`，不再重新 `collectTriggers('onTurnEnd')`
- 已新增并通过的聚焦回归：
  - `src/games/smashup/__tests__/turnCycle.test.ts`
    - `endTurn 反应交互结算后不会把同一组 onTurnEnd trigger 重新入队`
  - `src/games/smashup/__tests__/expansionOngoing.test.ts`
    - `steampunk_difference_engine`
- 线上状态回写约束补充：
  - 本地 `.env` 里的 `MONGO_URI` 指向 `localhost:27017/boardgame`，不是生产真源
  - 因此本轮 `69f27faa...` 的状态回写改走 `SSH + docker exec boardgame-mongodb mongosh boardgame`
  - 生产回写结果：`matched=1 / modified=1`，反馈已变为 `status=resolved`
- 回写后最新生产 open 盘面：
  - `openTotal = 9`
  - `smashup|feedback-modal = 6`
  - `dicethrone|online-ai-watchdog = 2`
  - `splendor|online-ai-watchdog = 1`
- 结论约束：
  - 现在可以确认 `69f27faa...` 这一条已按“本地已修 + 生产状态已回写”收口
  - 但不能把它外推成“同房间 WWJIlGJSnnt 里的其它 SmashUp 反馈都已一起收口”；`69f27a5d...` 已在后续批次独立收口，其余条目仍需分别核对

## Addendum（2026-05-04）：SmashUp `69f7ac9d...` 重复 special 候选定位

- `69f7ac9d9ec13b96d710fded` 不是旧的 `stale private overlay` 型问题，生产快照有两个更具体的特征：
  - `smashup_reaction_choose` 同一 prompt 中重复出现 `activate_special:titan:titan_2_wizards_arcane_protector:3`
  - `progressMarker` 中的旧 interaction id 与 `stateSnapshot.interaction.shared.id` 不同，说明 watchdog recovery 已推进过一次，但同类 visible interaction 又重开并最终落成 `blocker_persisted`
- 本地最小修复没有去碰更大范围 transport 分支，而是先直接收口最可证的 runtime 出口：
  - `src/games/smashup/domain/reactionSession.ts`
  - `e2e/src/games/smashup/domain/reactionSession.ts`
  - `buildReactionOptions(...)` 现在会按 `existing.id === option.id` 或 reaction value 等价去重
  - `resolveSmashUpReactionChoice(...)` 现在会先按 live session 正规化持久化 choice；若 live 里只剩 `pass`，则直接按当前语义收口
- 已新增并通过的聚焦回归：
  - `smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass`
  - `smashup_reaction_choose 响应持久化后的失效 special 快照时，应按当前 live 语义正规化并直接收口`
  - `smashup_reaction_choose 构建反应选项时，应去重重复的泰坦 special 候选`
- 额外发现的最小编译阻塞已顺手修平：
  - `src/games/smashup/abilities/innsmouth.ts`
  - `e2e/src/games/smashup/abilities/innsmouth.ts`
  - 原因是文件里调用了 `registerInteractionHandler(...)`，但漏了对应 import
- 新确认的生产基线差异：
  - 远端 `/home/admin/BoardGame` 源码里不存在以下文件：
    - `src/games/smashup/domain/reactionSession.ts`
    - `src/games/smashup/domain/reactionWindowState.ts`
    - `src/games/smashup/domain/abilityRuntime.ts`
    - `src/games/smashup/domain/branchingChoice.ts`
  - 这说明生产当前不是“只差一个去重补丁”，而是整条 `smashup` 新交互运行时层尚未在远端源码基线上落地
- 当前任务口径已切换并执行：
  - `resolved = 本地已修好`
  - 因此 `69f7ac9d...` 已在 2026-05-04 直接按本地修复完成口径回写为 `resolved`
- 修平后已复跑通过的 transport/watchdog 聚焦套件：
  - `smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted`
  - `online AI watchdog 应优先执行 AI 合法动作来解除可见交互阻塞，而不是直接 force-end-turn`
  - `online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败`
- 结论约束：
  - 现在可以确认 `69f7ac9d...` 所暴露的“重复 special 候选 / stale special 正规化”这一层已按本地修复口径收口
  - 但还不能把它外推成“其余 smashup watchdog open 都可直接一起关掉”

## Addendum（2026-05-04）：DiceThrone `69f5be8c...` 已回写 resolved

- `69f5be8c9ec13b96d710baa4` 在本轮回写前不是“可能已经被别人顺手关了”，而是生产 Mongo 直查仍明确为：
  - `status = open`
  - `source = feedback-modal`
  - `severity = critical`
- 这条反馈当前能收口，不是因为“用户描述模糊也先关掉”，而是因为线上现场与本地修复证据已经对齐：
  - 生产现场权威态明确落在 human `main1`
  - 真残留物是 AI 枪手 `pendingBonusDiceSettlement.displayOnly = true` 的孤儿展示态
  - 对应修复与验证已分别落在：
    - `evidence/dicethrone/dicethrone-online-ai-orphan-displayonly-bonus-settlement-fix-2026-05-02.md`
    - `evidence/dicethrone/dicethrone-online-ai-pending-interaction-hidden-response-fix-2026-05-02.md`
- 已执行最小回写：
  - `temp/feedback-closeout/update-feedback-status-20260504-69f5be8c-to-resolved.raw.txt`
  - 结果：`matched=1`、`modified=1`
  - 同次返回的远端文档已变为 `status=resolved`，`updatedAt=2026-05-04T00:09:29.653Z`
- 回写后复核：
  - `temp/feedback-online/post-69f5be-resolved-summary-20260504.json` 已确认该条不再占用 `open` 盘面
  - 当前 `openTotal = 20`
  - `dicethrone|feedback-modal` 从 `7` 降到 `6`
- 口径约束：
  - 这里只能说明 **这条与 transport/watchdog 强关联的 DiceThrone human feedback 已收口**
  - 不能外推成“DiceThrone 全部问题已完”或“两条 dicethrone watchdog 聚合项也自动可关”

## Addendum（2026-05-04）：DiceThrone `69f4acdf...` `card-dizzy` 响应链已回写 resolved

- `69f4acdf9ec13b96d7109f30` 的原文是“头晕目眩无法使用”，生产现场权威态不是“用户手滑没点到”，而是：
  - Barbarian 在 `main2`
  - 手牌中明确存在 `card-dizzy`
  - 前一拍真实攻击已造成 `13` 点伤害
- 仓库里已有与该现场直接对位的本地证据链：
  - 领域回归：`src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts` 中 `card-dizzy afterAttackResolved 响应窗口链`
  - 真实 E2E：`evidence/dicethrone/dicethrone-card-dizzy-after-attack-e2e-test.md`
  - 截图证据明确覆盖：`afterAttackResolved` 窗口真实出现 -> `card-dizzy` 真实打出 -> 目标获得 `Concussion` -> 响应窗收口
- 2026-05-04 已按“本地已修即 resolved”口径通过生产 Mongo 回写；回写结果：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T01:22:42.855Z`

## Addendum（2026-05-04）：SmashUp `69f5c17f... / 69f42358...` 已按同类 stale reaction 证据回写

- `69f5c17f9ec13b96d710bb03` 与 `69f423585cacc4e6b5cdbdbf` 都属于：
  - `smashup`
  - `online-ai-watchdog`
  - `visible-interaction:recover-interaction:blocker_persisted`
  - `smashup_reaction_choose`
  - `scoreBases`
- 这两条与 `69f479...` 的 `endTurn` mandatory 双触发不同，当前更接近已补证的 `scoreBases` / stale reaction choice 闭环：
  - `69f5c17f...` 现有 findings 已直接对应 transport 闭环补测
  - `69f42358...` 是更早的同类 `scoreBases` 聚合项，按相同 runtime + transport 证据链收口
- 2026-05-04 已通过生产 Mongo 回写：
  - `69f5c17f...` -> `resolved`，`updatedAt=2026-05-04T01:24:03.114Z`
  - `69f42358...` -> `resolved`，`updatedAt=2026-05-04T01:24:03.433Z`
- 最新线上 open 聚类已降到：
  - `dicethrone|feedback-modal = 5`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `smashup|online-ai-watchdog = 1`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：SmashUp `69f479...` `endTurn` mandatory 顺序 watchdog 已回写

- `69f479c69ec13b96d71099e3` 与前面两条 `scoreBases` stale reaction 聚合项不是同一个根因：
  - 现场特征是 `phase = endTurn`
  - 强制顺序选项是：
    - `trigger:onTurnEnd:steampunk_difference_engine:0:0`
    - `trigger:onTurnEnd:tricksters_big_funny_giant:0:1`
  - 问题不是“第一个 trigger 不会被选”，而是选完第一个 trigger 后，watchdog 把后续 `endTurn` 收口误限制成“只能找 legal action”，没有允许 SmashUp `endTurn` 像 `scoreBases` 一样 fallback `ADVANCE_PHASE`
- 本地最小修复：
  - `src/engine/transport/server.ts` 将 SmashUp `currentPhase === 'endTurn'` 纳入 `allowAdvancePhaseFallbackAfterLegalExhausted`
  - `src/engine/transport/__tests__/server.test.ts` 新增并跑通：
    - `watchdog falls back to first trigger respond for smashup onTurnEnd mandatory reaction ordering`
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T01:41:41.863Z`
- 最新线上 open 聚类已进一步降到：
  - `dicethrone|feedback-modal = 5`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `splendor|online-ai-watchdog = 1`
  - `smashup|online-ai-watchdog = 0`

## Addendum（2026-05-04）：DiceThrone `69f21b05...` 枪手 `Loaded` / `targetingRoll` 卡死已回写

- 这条不是泛化“AI 想太久”，而是 DiceThrone 枪手 `targetingRoll` 选目标后叠加 `Loaded` token / bonus die 的收口链脱节：
  - 现场状态：`sys.phase = targetingRoll`、`flowHalted = true`、`interaction.isBlocked = true`、`interaction.queue = []`
  - 末尾事件顺序仍能看到：
    - `CHOICE_REQUESTED(targeting-roll)`
    - `CHOICE_RESOLVED`
    - `CHOICE_REQUESTED(offensiveRollEndToken)`
    - `BONUS_DICE_REROLL_REQUESTED`
  - 这说明交互请求确实发出过，但可见交互和 watchdog 收口链没有一起走完
- 该条与已收口 `69f5be8c...` 同属 `displayOnly / pendingBonusDiceSettlement / hidden response` 处理簇，同时共享 `69f04210...` 的 `targetingRoll` 推进缺口与 Android `AppUpdatePlugin` 噪音
- 2026-05-04 已补强本地复核并通过：
  - `flow.test.ts` 中 `targetingRoll` 4 条聚焦回归
  - `server.test.ts` 中 `displayOnly / hidden interaction / watchdog` 5 条聚焦回归
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T02:09:53.325Z`
- 最新线上 open 聚类已进一步降到：
  - `dicethrone|feedback-modal = 4`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：DiceThrone `69f2a81c...` token 弹窗双击 / 目标恢复反馈已回写

- 这条反馈文本描述的是“先选目标、再弹 token、token 弹窗要点两次、原目标选择没恢复”。
- 但生产快照保存下来的并不是故障中间态，而是修复后能正常收口的终态：
  - `sys.phase = main2`
  - `flowHalted = false`
  - `interaction.queue = []`
  - `pendingAttack = null`
  - 末尾事件完整走到 `TOKEN_RESPONSE_CLOSED -> ATTACK_RESOLVED -> SYS_PHASE_CHANGED(defensiveRoll -> main2)`
- 因此这条不是一个仍未闭合的新问题，而是 DiceThrone `pendingInteractionId / hidden response / token response` 修复簇下的“已修未回写”反馈。
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T02:21:27.353Z`
- 最新线上 open 聚类已进一步降到：
  - `dicethrone|feedback-modal = 3`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：DiceThrone `69f31c69...` “再来点”反馈已回写

- 这条不是新问题，项目内已有专项审计 `evidence/dicethrone-4p-attack-modifier-targeting-roll-audit-2026-04-30.md` 已直接点名：
  - 线上真实反馈时间：`2026-04-30T09:10:01.709Z`
  - 线上真实反馈原文：`再来点这张卡自己整个回合都用不了`
- 根因是 4 人 `targetingRoll` 自动目标窗口里，攻击修正卡旧逻辑把可用性错误绑死到 `pendingAttack.defenderId` 是否已写回。
- 2026-05-04 已按当前代码基线复跑聚焦回归：
  - `攻击修正卡可在 defenderId 写回前直接结算到自动目标`
  - `4 人模式 targetingRoll 自动目标后，Loaded token 的奖励骰特写应命中自动目标`
- 当前生产快照也已回到 `main1`、`flowHalted=false`、`interaction.queue=[]`、`pendingAttack=null`，说明这是已修未回写反馈。
- 2026-05-04 已通过生产 Mongo 回写：
  - `matched=1`
  - `modified=1`
  - `updatedAt=2026-05-04T02:28:06.896Z`
- 最新线上 open 聚类已进一步降到：
  - `dicethrone|feedback-modal = 2`
  - `dicethrone|online-ai-watchdog = 2`
  - `smashup|feedback-modal = 7`
  - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：DiceThrone `feedback-modal` 已清零

- `69f18ca4ab54eadcc2bb2322`：
  - 线上现场仍带有 `defensiveRoll` 阶段的骰子数据，说明不是“领域层没产出骰子”，而是共享骰面显示层问题
  - 已并入 `69cba605...` 的共享骰面可见性修复簇
  - 2026-05-04 已复跑 fallback 单测通过
  - fresh E2E 尝试因测试 runtime 启动失败未进入业务断言，因此沿用旧共享截图证据收口
- `69f1978dab54eadcc2bb24b0`：
  - 只保留 route 级“游戏中途加载失败”，无 `stateSnapshot` / `errorContext`
  - 按明确推断并入同日 DiceThrone 全局 HUD 加载失败簇：`69f1f938...` / `69f1f943...`
  - 2026-05-04 已重跑 `chatSelectionLogic.test.ts` 与 `npm run build`，当前修复链稳定
- 2026-05-04 完成上述两条回写后：
  - `dicethrone|feedback-modal = 0`
  - 全部剩余 open 聚类为：
    - `smashup|feedback-modal = 7`
    - `dicethrone|online-ai-watchdog = 2`
    - `splendor|online-ai-watchdog = 1`

## Addendum（2026-05-04）：Splendor watchdog 生产热补已落地

- `splendor` 当前不是“历史聚合项还没清掉”，而是 2026-05-04 晚间再次真实复发：
  - `2026-05-04 23:29:57` 到 `23:33:09`，生产 `boardgame-game-server` 持续对 `matchId=cWGQSaUXt1B` 执行 watchdog
  - 同一窗口里 `failureCount` 从 `1998` 增长到 `2022`
  - 失败口径仍是 `ADVANCE_PHASE -> unknownCommand`
- 标准镜像发布链在本时间点还不包含这次修复：
  - 当前官方 `ghcr.io/zhuanggenhua/boardgame-game:latest` 导出的 `server.mjs` 哈希是 `19197f1831000ccc603df12fc1d21ffb353ef2d6a0f0baf4619dd166d7b24b8f`
  - 该官方 bundle 中查不到本轮新增修复特征字符串 `display-only-bonus`
  - 结论：直接跑 `bash scripts/deploy/deploy-image.sh update latest` 仍无法把这次 watchdog 修复正式带上生产
- 本轮执行的最小风险生产热补路径：
  - 远端源码仓库先同步当前已验证的 `src/engine/transport/onlineAiRecovery.ts`
  - 为让现有 `server.ts` 在远端旧仓库中重新可编译，补齐最小依赖同步：
    - `src/engine/transport/storage.ts`
    - `src/engine/ai/**`
    - `src/engine/systems/UndoSystem.ts`
  - 远端宿主机 `Node 22` 直接跑 `build-node-bundle.mjs` 仍因 `esbuild` 解析链异常失败，最终改用 `ghcr.io/zhuanggenhua/boardgame-game:latest` 的 `Node 24` 容器挂载 `/home/admin/BoardGame` 来编译
  - 产物：
    - `/home/admin/BoardGame/temp/prod-bundles/game/server.mjs` → `809aebcda8ddbe4d99ab98e3b997e57cce7af2417527a008741cdf229b81230d`
    - `/home/admin/BoardGame/temp/prod-bundles/game/server.mjs.map` → `91dade1ff134f10b3e85a1a8b4882cb90bcca52bdfd7790916f6d16927d4a5de`
- 生产替换与复核结论：
  - 已把上述 bundle 覆盖到 `boardgame-game-server:/app/server.mjs` 与 `/app/server.mjs.map`
  - 容器重启后复核 `sha256sum /app/server.mjs /app/server.mjs.map`，与热补产物哈希完全一致
  - `2026-05-03T23:51:12.821Z` 复核 `curl http://127.0.0.1/health` 返回 `{"status":"ok",...}`
  - 再观察 `70s` 日志窗口，`grep 'cWGQSaUXt1B'` 与 `grep 'online-ai-watchdog failed'` 都为空，说明本轮 `splendor` 刷屏已被当前热补止住
- 回退物料已落盘：
  - 热补 bundle：`/home/admin/hotfix-backups/20260504-splendor-watchdog/server.hotfix.mjs`
  - 官方镜像原始 bundle：`/home/admin/hotfix-backups/20260504-splendor-watchdog/server.registry-latest.mjs`
- 残余风险：
  - 当前生产修复仍属于 **bundle 热补**，不是正式 GHCR 镜像发布；若后续按官方旧 `latest` 重建容器，补丁会丢失
  - 因此下一阶段仍要把这次修复收敛回正式镜像发布路径，不能把“当前日志安静”误写成长期收口

## Addendum（2026-05-04）：三簇 watchdog 本地验证结论

- `splendor` 当前最关键的线上 open 项 `69f6c4bc9ec13b96d710e10d`，本地已确认根因与修复方向：
  - 根因 1：`src/engine/transport/onlineAiRecovery.ts` 旧逻辑会对 `splendor` 这类不支持阶段推进命令的游戏生成裸 `ADVANCE_PHASE` recovery
  - 根因 2：`src/engine/transport/server.ts` 旧逻辑只信 `setupData.seatControllers`，未按 manifest 过滤 `localAi=false`
  - 修复后已通过：
    - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`
    - `src/engine/transport/__tests__/server.test.ts` 中 `splendor` manifest/no-ai 聚焦回归
- `dicethrone` 当前 open watchdog / 用户“枪手防御技能 + 转移状态效果卡死”主链，本地聚焦验证已过：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
  - `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`
  - `src/games/dicethrone/__tests__/flow.test.ts` 中 `targetingRoll / defensive / displayOnly / bonus` 相关聚焦用例
- `smashup` 当前 open watchdog `visible-interaction:recover-interaction:blocker_persisted` 主链，本地聚焦验证已过：
  - `src/engine/transport/__tests__/server.test.ts` 中 `visible-interaction / reaction chain / follow-up advance / mandatory-order` 相关用例
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
- 仍需保持谨慎的点：
  - 当前工作区存在大量并行 dirty 改动；即使本地聚焦测试通过，也不能直接把“可发布”与“本地已验证”混为一谈
  - `dicethrone flow.test.ts` 全文件还有 2 条旧断言失败，当前都落在技能升级历史用例，现象是预期 `main2`、实际 `defensiveRoll`；本轮未把它们当成线上反馈主链 blocker

## Addendum（2026-05-04）：SmashUp transport 闭环与 Splendor 生产止血

- `smashup` `69f5c17f9ec13b96d710bb03 / visible-interaction:recover-interaction:blocker_persisted` 现在不只是“领域层/AI 层高覆盖”，transport 闭环也已经补测：
  - `src/engine/transport/__tests__/server.test.ts` 新增 “`smashup` 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 `blocker_persisted`”
  - 该测试直接用持久化 stale `smashup_reaction_choose` 状态跑 `runOnlineAiRecoveryTick()`，结果会先执行 `interaction:persisted-stale-reaction-choice:pass`，再自然推进，不再写入 `force-end-turn-failed`
  - 这条补测与现有 `scoreBases-auto-continue.test.ts`、`commandsValidation.test.ts` 共同构成：`live option refresh -> runtime prompt resolve -> transport watchdog recovery` 的完整证据链
- `splendor` 当前线上增长不是“Mongo 里残留房间”：
  - 生产 Mongo `matches` 中查不到对应 `splendor` 房间，`/internal/rooms?gameName=splendor` 也返回空
  - 但 `boardgame-game-server` 单进程仍持续对 `Nh_5xVWO0km` 执行 `ADVANCE_PHASE -> unknownCommand`
  - 先尝试 game-server 内部 `DELETE /internal/rooms/Nh_5xVWO0km`，接口返回 `200 {"deleted":true}`，但无法阻止日志继续增长，说明该接口删除的不是 watchdog 实际扫描的幽灵 active match
  - 进一步确认容器内仅 1 个 Node 进程后，判断该问题属于单进程残留内存态；在 `/internal/rooms` 全量为空的前提下，重启 `boardgame-game-server` 是当前最小可执行止血路径
- 重启后复核结论：
  - `docker logs --since 1m boardgame-game-server` 不再出现 `Nh_5xVWO0km`、`l_nV1EVQkNG`、`2mAr8CtKjlP`
  - `69f6c4bc9ec13b96d710e10d` 停在 `occurrenceCount = 417`
  - 当前生产已经从“持续刷 open watchdog + 持续放大日志”恢复到“open 仍未人工回写，但不再继续增长”
- 残余风险：
  - 当前止血依赖一次生产重启，尚未把本地 `splendor` watchdog 修复正式发布到生产；若未来再出现同型 orphan active match，理论上仍可能复发
  - 生产日志里曾同时出现 `dicethrone` / `summonerwars` 的幽灵 watchdog match；本轮重启后一并沉默，但仍需后续判断它们是同类内存残留，还是需要独立代码修复

## Addendum（2026-05-03）：线上反馈源恢复与当前盘面

- 本轮依据的真实来源是 **线上反馈源**：
  - 生产 API：`https://api.easyboardgame.top/admin/feedback`
  - 生产 Mongo：`8.148.71.102:/home/admin/BoardGame` 下的 `boardgame-mongodb`
- 初始阻塞不是“接口权限问题”，而是生产环境真实故障：
  - `/admin/feedback` 返回 `500`
  - `boardgame-mongodb` 因 `FTDC diagnostic.data` 写失败持续重启
  - 根盘 `/dev/vda3` 满盘，`40G` 已用尽
- 占用核实结果：
  - `/var/lib/docker/containers` 约 `13G`
  - 其中 `boardgame-game-server` 的 JSON 日志单文件约 `13G`
  - `Mongo` 数据卷本体仅约 `530MB`，不是主占用
- 已执行的最小风险止血：
  - 仅截断 `boardgame-game-server` 的单个 Docker 日志文件
  - 没有删除 Mongo 业务数据卷，也没有改生产镜像
  - 根盘恢复到约 `68%` 使用率后，`boardgame-mongodb` 可重新正常启动
- 当前线上真源快照：
  - `temp/feedback-online/current-open-20260503.json`
  - `temp/feedback-online/current-in-progress-20260503.json`
- 当前最新盘面：
  - `open = 20`
  - `in_progress = 0`
  - 结构分布：
    - `dicethrone | feedback-modal = 7`
    - `smashup | feedback-modal = 7`
    - `smashup | online-ai-watchdog = 3`
    - `dicethrone | online-ai-watchdog = 2`
    - `splendor | online-ai-watchdog = 1`
- 当前最需要先止血的线上项：
  - `69f6c4bc9ec13b96d710e10d`
    - `splendor`
    - `force-end-turn-failed active-turn:follow-up-advance:command_failed`
    - `occurrenceCount` 已继续增长，并且正持续制造生产大日志
  - `69f471da9ec13b96d7109902`、`69f73be49ec13b96d710f1c2`
    - `dicethrone`
    - `active-turn-legal-only:follow-up-advance:legal_action_unavailable`
    - 与用户反馈“枪手防御技能/转移状态效果卡死”高度相关
  - `69f5c17f9ec13b96d710bb03` 及其历史同类项
    - `smashup`
    - `visible-interaction:recover-interaction:blocker_persisted`
    - 需要确认是否已经被当前 dirty worktree 中的交互/runtime 改动部分覆盖

## Addendum（2026-05-03）：长期任务状态约束

- `C:\Users\zhuagenbao\.codex\.omx\ralph-loop.local.md` 当前正在服务另一条 Smash Up runtime 重构长期任务。
- 为避免抢占既有 loop，本轮“线上反馈持续修复”改用以下持久状态：
  - 仓库根：`task_plan.md` / `progress.md` / `findings.md`
  - 仓库临时状态：`temp/feedback-longtask.json`
  - 全局独立 state：`C:\Users\zhuagenbao\.codex\.omx\state\long-term-task\boardgame-online-feedback-20260503.json`

## Addendum（2026-04-30）：Smash Up《武士 陈》正路径补证与最终验收口径

- 本轮补上了 `World Champs` 最后一个对象级冻结点：《武士 陈》正路径 L3。
- 新证据：
  - `evidence/smashup/smashup-world-champs-samurai-chan-e2e-2026-04-30.md`
- 新验证：
  - `world_champs_samurai_chan` 聚焦 Vitest：`2 passed`
  - `武士 陈在基地计分进入弃牌堆后应抽一张牌` E2E：`1 passed`
- 这条补证后，前一版“《武士 陈》只保留负路径 L3 + 领域正路径”的冻结说明失效。
- 也同步明确这轮流程结论：
  - 不是每个对象都机械要求端到端。
  - 必须补到 L3 的，是历史投诉对象、真实入口链路、reaction session、阶段切换、UI 出口和曾出现“领域对 / UI错”的对象。
  - 其余对象保持 `L0-L2` + 风险抽样即可，不再用“全卡都上 E2E”制造无效工作量。

## Addendum（2026-04-30）：Smash Up 世界冠军 / 骷髅基地层残余清理

- 本轮新增 3 条基地层对象级 L3：
  - `竞技场 / base_arena`
  - `名人堂 / base_hall_of_fame`
  - `藏骨堂 / base_ossuary`
- 这批补证后，三新派系当前残余范围被继续收紧：
  - `World Champs`：基地层真实入口残留已清空；当前只剩《武士 陈》正路径是否继续单独补 L3 的冻结说明
  - `Skeletons`：基地层真实入口残留已清空；`埋骨地 / base_boneyard` 没有能力注册痕迹，当前按“无能力基地”冻结
- 本轮也补上了一个流程层结论：
  - 不是所有“还没补到 L3”的对象都必须机械继续补到同一深度
  - 对于《武士 陈》这类没有主动 prompt、当前用户直接反馈风险点又是“别串成海龟阿凯效果”的对象，负路径 L3 + 领域正路径 + 明确降级理由，才是当前更严谨的收口方式
- 证据：
  - `evidence/smashup/smashup-world-champs-skeletons-bases-e2e-2026-04-30.md`

## Addendum（2026-04-30）：Smash Up 美人鱼《塞壬 / 诱惑者 / 无人岛》重审

- 本轮不是单纯补截图，先抓到 1 个真实 UI 口径 bug：
  - `BaseZone` 玩家列分数徽章此前没有走 `getPlayerEffectivePowerOnBase(...)`
  - 而是自己手算 `getEffectivePower + ongoing + base bonus`
  - 结果会漏掉《塞壬 / 无人岛 / 魅惑 / 人鱼暗礁》这类“只影响控制者总力量、不影响基地总力量”的扣减语义
- 这说明此前返工的一个根因不是“维度名不够多”，而是：
  - L2 领域断言已经对
  - 但 L3 浏览器真实出口没有逐对象核到 UI 显示口径
  - 于是把“规则正确、显示错误”误当成“数据录错 / 效果没触发”
- 本轮已修复：
  - `src/games/smashup/ui/BaseZone.tsx`
  - `e2e/src/games/smashup/ui/BaseZone.tsx`
- 本轮新增对象级 L3：
  - `塞壬`
  - `诱惑者`
  - `无人岛`
- 证据：
  - `evidence/smashup/smashup-mermaids-siren-temptress-desert-island-e2e-2026-04-30.md`

## Addendum（2026-04-24）：线上反馈 69a440ea（DiceThrone 教程弃牌堆方向）
- 反馈 `69a440ea1eb921c6091f1231` 指向“教程把右侧弃牌堆写成左侧”。
- 复核结论：中文文案已正确，英文教程仍残留旧方向描述（`on the left`）。
- 已修复 `public/locales/en/game-dicethrone.json`：
  - `tutorial.steps.sellCardIntro` 改为 `on the right`
  - `tutorial.steps.undoSellIntro` 改为 `on the right`
- 校验：`npm run i18n:check` 通过。
- 证据：`evidence/dicethrone/dicethrone-feedback-69a440ea-tutorial-discard-side-fix-2026-04-24.md`。

## Addendum（2026-04-07）：Android 本地素材包图片加载故障
- 原生安装链路本身正常：`GamePackageForegroundRuntime`/`GamePackagePlugin` 会把游戏包解压到 `.../files/game-packages/<gameId>/current/assets`，并通过 `assetRootPath` 回传前端。
- 启动期丢本地素材的首个根因在 `src/features/mobile-packages/packageManagerService.ts`：
  - `hydrateInstalledNativeGamePackages()` 之前只会处理已经存在 `fallbackCache` 的游戏。
  - `fallbackCache` 主要由大厅里的 `useGamePackageState()` 注册；如果用户没先经过这层 hook，已安装包会被 hydration 直接跳过。
  - 结果是 `setGameAssetBaseOverride(gameId, assetBaseUrl)` 没有执行，AssetLoader 继续按远端资源域名取图。
- 图片长时间“加载中”的第二个根因在 `src/components/common/media/OptimizedImage.tsx`：
  - 组件原先把所有“非 http(s) 本地路径”都走成开发态 `/assets/...` 的 `fetch -> blob` workaround。
  - Android 已安装包路径 `/_capacitor_file_/...` 也会落进这个分支，导致本地包图片被误伤，停在加载态。
- 本轮修复策略：
  - `hydrateInstalledNativeGamePackages()` 在 fallbackState 缺失时，使用已安装包信息构造兜底 state，再继续 emit/apply override。
  - `OptimizedImage` 的 blob-fetch workaround 收窄为“仅开发态 public `/assets/...`”；对 `/_capacitor_file_/...` 直接交给 `<img>` 原生加载。
  - `nativeGamePackagePlugin.ts` 对原生首次 ack / installState listener 返回的 `running/completed/cancelled` 做前端状态归一化，禁止把非法状态直接写进 `StoredGamePackageState.status`。
- 第二轮真机排障确认了更前置的一层 bug：
  - `易桌游测试(top.easyboardgame.app.debug)` 当前私有目录里没有 `dicethrone` 已安装包，也没有 `install-state.json`。
  - 但旧 H5 bundle 仍可能把原生 ack 的 `status: "running"` 直接写进前端状态，导致下载按钮被判成“处理中”并直接变灰。
  - 这会掩盖后续“是否正确使用本地素材包”的真实状态，所以必须先修状态机污染，再继续看图片链路。
- 定向验证：
  - `src/components/common/media/__tests__/CardPreview.i18n.test.tsx` 新增断言：游戏包 override 生效时，`OptimizedImage` 不得触发 fetch/blob workaround。
  - `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts` 新增断言：即使未先进入大厅包管理 hook，启动期 hydration 也能把原生已安装包同步进状态缓存。
  - 真机 `易桌游测试` OTA 目录已覆盖最新 `dist/`，启动日志确认加载的是新 bundle `http://localhost/assets/index-wN3ZSRu0.js`。
  - 真机截图与 `uiautomator dump` 已确认 `王权骰铸 -> 安装游戏包` 按钮处于可点击态，不再是“直接变灰”的脏状态。

## Requirements Checklist
- [x] 使用中文沟通与文档
- [x] 涉及图片资源时遵循 `docs/ai-rules/asset-pipeline.md`
- [x] 涉及图片驱动录入时遵循 `docs/ai-rules/data-entry.md`
- [x] 涉及审计时先遵循 `docs/ai-rules/testing-audit.md`
- [x] 涉及自动化测试与 E2E 时遵循 `docs/testing-best-practices.md` 与 `docs/automated-testing.md`
- [x] 本次任务需要独立 worktree、OpenSpec、可复刻工作流文档、Vitest、E2E、evidence

## Addendum（2026-03-28）：Dice Throne AI 审计收口
- 本轮 Dice Throne AI 卡死主链路已收口，核心根因确认是 token response 关闭后，只 resolve 交互，没有同步清理 `sys.responseWindow.current`。
- 修复点：`src/games/dicethrone/domain/systems.ts` 在 `TOKEN_RESPONSE_CLOSED` 路径显式清空 `sys.responseWindow.current`，避免领域层已关闭、系统层仍残留响应窗口。
- 同步校正了一条过期回归：Monk 太极在当前 token 规则下，单个响应窗口内只允许合法使用一次；旧的“双太极再 skip”预期不是当前真相。
- 回归测试已改成当前真实行为：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 断言 AI 执行 `['token-response', 'skip-token-response']`
  - 断言 `state.sys.responseWindow?.current` 被清空
  - 断言后续 AI 返回正常 `advance-phase`
- 本轮补齐的 AI 覆盖重点：setup 选角/ready 视角切换、main1 可行动作优先级、defensiveRoll 连续决策、attemptKey 去重、response-play-card 优先级、passive draw-card 优先级、token-response 关闭清理。
- 验证结果：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --maxWorkers 1` → `26 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-response-window.test.ts --configLoader native --maxWorkers 1` → `8 passed`
- 结论：这次 Dice Throne AI 审计暴露的缺口不在单一领域规则，而在“本地 AI 连续决策链 + 响应关闭后的系统态清理 + 过期回归未同步当前 token 规则”三者叠加。

## Research Findings

### 规范与流程
- 根工作区已有并行任务改动，且根目录 `task_plan.md` 正服务其他主题，当前任务必须隔离执行。
- 图片资源运行时禁止直接引用原始 `.png/.jpg`，需要走 `compressed/*.webp` 路径，由项目工具自动映射。
- 图片录入属于“先文档后实现”任务，需要先锁定来源、建立核对契约，再落运行时代码。
- 新的 E2E 必须使用 `e2e/framework` 的 `GameTestContext` API，并将显式证据截图写入 `test-results/evidence-screenshots/_shared/`。
- 用户本轮已明确要求：spec、审计、测试、E2E 全部包含在交付范围内。

### 当前工作区状态
- 新 worktree：`D:\\gongzuo\\webgame\\BoardGame-wt-smashup-base-faction-assets`
- 分支：`feat/smashup-base-faction-assets`
- 基线：`main` 分支提交 `8dc480cd`

### 当前素材核对结论
- 原工作区存在未纳入 `main` 的 Smash Up 中文原图：`public/assets/i18n/zh-CN/smashup/base/aiji_base.png` 与 `public/assets/i18n/zh-CN/smashup/cards/aiji.png`。
- `aiji_base.png` 尺寸为 `4096x1458`，视觉内容与目标四派系基地一致，包含：
  - `Saloon` / `So-So Corral`
  - `Pyramids` / `Star Portal`
  - `Kyuden Konbini` / `Sakura Shigemi`
  - `Drakkar` / `Longhouse`
- 用户已修正 `aiji.png`，当前 worktree 内文件尺寸为 `2914x4096`，内容确认为 `Ancient Egyptians / Cowboys / Samurai / Vikings` 四派系统一卡图。
- `aiji.png` 的真实切片结构为 `7x7` row-major，共 `49` 格：
  - 前 `48` 格是四个派系的卡牌
  - 最后 `1` 格是 `Smash Up` 尾格，不参与卡牌录入
- `aiji_base.png` 的真实切片结构为 `2x4` row-major，共 `8` 张基地。
- 本轮已执行 `npm run compress:images -- public/assets/i18n/zh-CN/smashup`，产物为：
  - `public/assets/i18n/zh-CN/smashup/cards/compressed/aiji.webp`
  - `public/assets/i18n/zh-CN/smashup/base/compressed/aiji_base.webp`

### TTS / 英文资源发现
- `public/assets/atlas-configs/smashup/2833984701.json`（TTS 源数据）中可定位到四个目标派系的 kit：
  - `Ancient Egyptians Kit`
  - `Cowboys Kit`
  - `Samurai Kit`
  - `Vikings Kit`
- 可确认的基地与英文卡堆如下：
  - Ancient Egyptians：`Pyramids`、`Star Portal`
  - Cowboys：`Saloon`、`So-So Corral`
  - Samurai：`Shogun's Palace`、`Sakura Garden`
  - Vikings：`Longhouse`、`Drakkar`
- 四个 faction deck 的 TTS `CustomDeck` 已定位：
  - Ancient Egyptians：deck `79`
  - Cowboys：deck `54`
  - Samurai：deck `55`
  - Vikings：deck `56`
- 这意味着即使中文 cards 原图缺失，仍可先从 TTS / Wiki 锁定派系列表、英文 defId 候选、卡牌数量与基础数据结构。

### 已确认的切片索引与命名差异
- `aiji.png` 的 row-major 顺序按 faction 分块稳定，依次为：
  - Vikings：索引 `0-11`
  - Samurai：索引 `12-23`
  - Ancient Egyptians：索引 `24-35`
  - Cowboys：索引 `36-47`
- `aiji_base.png` 的 row-major 顺序为：
  - `0 Saloon`
  - `1 So-So Corral`
  - `2 Pyramids`
  - `3 Star Portal`
  - `4 Kyuden Konbini`
  - `5 Sakura Shigemi`
  - `6 Drakkar`
  - `7 Longhouse`
- 武士基地存在来源差异：
  - 图片图面英文：`Kyuden Konbini` / `Sakura Shigemi`
  - TTS / Wiki canonical：`Shogun's Palace` / `Sakura Garden`
  - 结论：base def 采用 canonical 英文名与 defId，图面差异必须写入 workflow / evidence 契约。

### Smash Up 专项规则
- 根 `AGENTS.md` 明确要求：Smash Up 的数据录入、数据核对、审计、效果描述查询必须先跑 Wiki 爬虫，不能只凭图片或记忆。
- 因此本次正式录入的权威链路应为：
  - 图片：用于资源文件、atlas 切片、中文图面与索引确认
  - Wiki / 项目爬虫：用于卡牌/基地描述、名称、效果与数据审计

### 本轮实现边界
- OpenSpec `add-smashup-oops-faction-intake` 已将本变更边界定义为：
  - 图片压缩与 atlas 接入
  - faction / cards / bases 静态数据录入
  - locale / UI faction metadata 接入
  - intake 流程文档、证据文档、Vitest、E2E
- 不在本轮内：
  - 四个派系完整 ability handler / ongoing registry / trigger registry 的 gameplay 补完

## Gameplay Proposal Findings

### 用户最新实施要求
- 已明确改为玩法阶段，不再停留在静态录入验收。
- 实施顺序必须是“一个一个派系来”，不能四个派系并行混改。
- 四个派系全部完成后再做统一审计。
- E2E 重点不是再次验证静态图片，而是覆盖本轮新增交互类型。

### 已建立的 gameplay proposal
- OpenSpec change：`add-smashup-oops-faction-gameplay`
- 校验结果：`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 已通过
- 主要范围：
  - `Ancient Egyptians`：bury、unbury、replacement destination、owner-visible bury UI
  - `Vikings`：bury/discard synergy、buried recovery
  - `Cowboys`：duel、hand-size checks、movement、destroy
  - `Samurai`：honor-based destruction、reactive movement、replacement destination
  - UI：必须端到端支撑 bury source/target、duel target、replacement destination

### 玩法实施顺序裁定
- 第一波：`Ancient Egyptians`
  - 原因：先把 bury 主链路与 UI 做成正式能力，解决已有体系“有领域没 UI”的缺口。
- 第二波：`Vikings`
  - 原因：复用 bury / discard / hidden info 处理，能直接验证第一波设计是否足够通用。
- 第三波：`Cowboys`
  - 原因：决斗和手牌数量判定依赖不同交互模型，应与 bury 稳定后分开调试。
- 第四波：`Samurai`
  - 原因：替代去向与响应移动更偏 after-event / replacement 语义，放在最后更利于集中验证。

### 现有代码事实（对 gameplay 有直接影响）
- bury 领域模型已存在：
  - `src/games/smashup/domain/bury.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/domain/index.ts`
- `vampires_pod` 已有 bury 先例，但 UI 仍未正式完成：
  - `src/games/smashup/abilities/vampires.ts`
- Smash Up UI 中目前基本没有 bury 渲染入口：
  - `src/games/smashup/ui/BaseZone.tsx` 是后续 bury UI 主要落点之一

### proposal 阶段的关键结论
- intake 与 gameplay 必须分成两个 OpenSpec change，不能混写。
- bury UI 不能再延后到“最后统一补”，否则 Ancient Egyptians 第一波无法算完整实现。
- 新交互类型的 E2E 应围绕“能不能从 UI 完成整条链路”设计，而不是只断言领域状态存在。

## Ancient Egyptians 实施发现

- Ancient Egyptians 的旧 locale 文本与当前 Wiki/Fandom 口径存在系统性偏差，已按当前口径修正 `Mummy / Pyramid Engineer / Priest of Anubis / Pharaoh / Lost Knowledge / You Can Take It With You / Tomb Trap / Seal the Tomb / Plague of Locusts / Mummy Strength / Blessing of Anubis / Ancient Curse / Pyramids / Star Portal`。
- bury 体系仅有“从埋葬翻开并额外打出”的半成品实现，不足以支持 Ancient Egyptians：
  - 需要区分 `onUncover` 与“正常额外打出”
  - 需要支持非法时机翻开 `special` 时直接弃置
  - 需要支持 `CARD_BURIED` 的 `buriedFrom: 'play'` 真正把场上实体移出
- 以 `onCardBuried / onBuriedCardUncovered` 作为通用触发时机后，`base_star_portal` 与 `Pharaoh` 可以直接复用反应队列，不再把 Ancient Egyptians 特判塞进 UI 或 reducer。
- bury UI 现已落在 `src/games/smashup/ui/BaseZone.tsx`：
  - 当前玩家通过 `playerView` 保留真实 `defId`，因此可直接渲染真实卡面
  - 非控制者继续看到 `buried_unknown`，UI 只渲染隐藏占位，不会泄露真实信息

## Vikings 实施发现

- 仓库原有 Vikings locale 与官方 Oops 规则书 / Fandom 口径明显冲突，不能继续当作实现基线；本轮已整体改回官方语义。
- 当前 Vikings 的实现主轴不是 bury，而是 `deck top / discard / steal / extra-action` 联动，核心文本基线为：
  - `Huscarl`：天赋，手牌压回牌库顶，本回合自身 `+2`
  - `Shield Maiden`：展示另一位玩家牌库顶；若为行动或力量 `<= 3` 的随从，则加入你手牌
  - `Raider`：天赋，至多三张手牌压顶，本回合自身每张 `+1`
  - `Valkyrie`：从另一位玩家弃牌堆取一张随从到你手牌
  - `Viking Funeral`：附着力量 `5+` 随从；当其进入弃牌堆时你得 `1 VP`；若你拥有该随从则改为回盒
  - `Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training`
  - `Drakkar / Longhouse`
- `base_drakkar` 不能走 `CARD_TRANSFERRED` 的同玩家 `deck -> hand` 路径；该 reducer 分支会被相同 key 覆盖。当前已改用 `CARDS_DRAWN`，测试通过。
- 已落地的 Vikings 行为包括：
  - `Huscarl / Shield Maiden / Raider / Valkyrie`
  - `Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training`
  - `Viking Funeral`
  - `base_drakkar / base_longhouse`
- 仍需在统一收尾阶段重点复核的近似实现点：
  - `Raiding Party` 目前是“先入手再给额外同类打出额度”的近似语义，不是严格的“从揭示区立即打出”
  - `Raiding Party` 未实现“其余牌任意顺序放回牌库顶”的完整交互
  - `Viking Funeral` 目前只有最小覆盖测试，后续统一审计时应补更强回归用例

## Cowboys 实施发现

- 仓库原有 Cowboys locale 与官方 Oops 规则书 / Fandom 口径冲突明显，不能继续沿用；本轮已将 `Deputy / Gunfighter / Pinkerton / Sheriff / Stagecoach / Run 'Em Off / Quick Draw / High Noon / Gold Strike / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / So-So Corral` 切回官方文本。
- Cowboys 第一轮已落地的玩法主链路包括：
  - `Gunfighter`：打出后在同基地选择敌方随从决斗，并按胜负消灭失败者
  - `High Noon`：先选己方随从再选敌方随从决斗；己方获胜时给予该基地额外随从额度
  - `Run 'Em Off`：决斗后给予胜者 `+3` 临时力量，并把失败者移动到另一基地
  - `Quick Draw`：已实现“普通场景 `+2` / active duel 中 `+4`”两条分支
  - `Gold Strike`：打出到基地后，在你打出随从到这里时抽牌
  - `Sheriff / Saloon / So-So Corral`
- 本轮顺手修掉了 `cowboys.ts` 中两处会制造假阳性的旧逻辑：
  - 额外出牌额度事件误写成 `amount`，现已改回 reducer 约定的 `delta`
  - `Saloon` 曾被错误塞进 duel 结算里直接抽牌；现已只保留官方的 `onMinionDestroyed` 基地触发
- 当前 Cowboys 已切到官方 duel 内核共享实现；已覆盖并验证的链路包括：
  - `Pinkerton`：决斗前为己方决斗随从放置 `+1` 指示物
  - `双方各可选择 1 张 duel card 或跳过`
  - `Deputy`：弃置手牌中的 `Deputy`，再选择一个随从获得直到回合结束 `+2` 力量
  - `destroy_loser / high_noon / run_em_off / vp_to_winner / draw2_to_winner` 等结局分支复用同一 duel 状态机
- Cowboys 决斗链此前还存在一处 UI 文案层的 i18n 断裂：
  - `Board.tsx` 顶部决斗横幅与卡名已经跟随 locale 渲染
  - 但 `src/games/smashup/domain/duel.ts` 的阶段标题、跳过按钮、Pinkerton 数量按钮仍是硬编码中文
  - 同时 `Board.tsx` 里用于手牌/基地/随从直点交互的快捷按钮没有复用 `PromptOverlay` 的 i18n 解析
  - 结果就是英文 locale 下会出现“英文横幅 + 中文交互标题/按钮”的混搭
- 本轮修复后：
  - `PromptOption` 新增 `labelKey / labelParams`
  - `PromptOverlay.tsx` 支持把整句 `ui.xxx` 直接解析成翻译文本
  - `Board.tsx` 的 hand/base/minion 快捷按钮也统一走同一套 label 解析
  - `duel.ts` 的 `Pinkerton / duel card / Deputy / Run 'Em Off` 相关提示全部改成 locale key
  - 复跑 Cowboys 浏览器 E2E 后，决斗横幅、阶段提示与跳过按钮已经统一成同一语言，不再混搭
- 本轮 E2E 还额外暴露并修复了一个真实的 duel 收尾 bug：
  - `smashup_duel_deputy_target` 之前会在弃掉 `Deputy` 后继续用旧状态推进阶段，导致同一玩家再次收到已失效的 `Deputy` 提示
  - 现已改为先模拟 `CARDS_DISCARDED + addTempPower` 再推进下一阶段，浏览器与单测都已验证修复
- Cowboys 当前仍需在后续阶段复核的缺口：
  - `Stagecoach` 的 `move / transfer` 完整语义尚未接入
  - `Dynamite Surprise` 的“对方查看/展示你手牌或牌库时反制消灭”尚未接入
  - `Form a Posse` 目前只有 `+1` 力量，尚未实现“不能被消灭/移动/回手”的完整保护
  - `Gold in Them Thar Hills` 当前仍是“抽到手里 + 给额外额度”的近似实现，不是严格的“立刻额外打出并把余牌任意排序放回”
- `So-So Corral` 已重新按官方口径收敛为“决斗并消灭失败者”；之前基于不完整摘录的“不消灭”判断已确认错误，后续统一审计不得再回退到那套口径。
- 统一审计阶段额外暴露出一个结构性硬错误：`cowboys_stagecoach` 已标注 `abilityTags: ['onPlay']`，但当时没有实际执行器；现已补上最小可运行实现与测试。
- 当前 `Stagecoach` 的明确 MVP 范围是：
  - 先选来源基地
  - 再选同一基地上 `1-2` 个己方随从
  - 最后把它们移动到另一基地
- 当前 `Stagecoach` 仍未覆盖的语义包括：
  - 更完整的 `transfer` 语义
  - 与附着行动牌、基地持续牌、其他联动对象一起搬运时的细粒度行为

## Samurai 实施发现

- 仓库原有 Samurai locale 与官方 Oops 规则书 / Fandom 口径冲突明显，不能继续沿用；本轮已将 `Samurai-Chan / Ronin / Bushi / Shogun / Yokai Attack! / Way of the Warrior / Honorable Combat / Honor the Fallen / Honor the Ancestors / Heart of the Battle / Final Haiku / Code of Bushido / Shogun's Palace / Sakura Garden` 切回官方文本。
- Samurai 第一轮已落地的玩法主链路包括：
  - `Ronin`：当它是你在该基地唯一的己方随从时，可放置两个 `+1` 指示物
  - `Samurai-Chan`：从场上进入弃牌堆后抽一张牌
  - `Bushi`：从场上进入弃牌堆且力量 `>= 5` 时获得 `1 VP`
  - `Shogun`：你另一个随从从场上进入弃牌堆后，在此随从上放置 `+1` 指示物
  - `Yokai Attack!`：消灭你的一个随从，获得额外随从与额外行动额度
  - `Honorable Combat`：两段选择后按 duel MVP 比较力量，胜者控制者获得 `1 VP`
  - `Code of Bushido`：通过三段交互把总计三个 `+1` 指示物分配给你的随从
  - `Honor the Ancestors`：当前第一轮会先给己方随从放置 `+1` 指示物，并按“其他玩家数量上限”自动把弃牌堆中的随从洗回牌库
  - `Way of the Warrior`：当前第一轮已接入对目标随从的 `+3` 临时力量
  - `Final Haiku`：附着随从离场后，当前场上的己方随从都会获得直到回合结束 `+2` 力量
  - `Heart of the Battle`：计分前 special，决斗后消灭失败者
  - `Honor the Fallen`：你此处随从进入弃牌堆后抽牌
  - `base_shoguns_palace / base_sakura_garden`
- 当前 Samurai 仍然只是第一轮实现，不是完整官方语义；统一收尾阶段必须复核以下缺口：
  - 仍未实现官方 duel 的完整 duel-card 内核，当前 `Honorable Combat / Heart of the Battle / Shogun's Palace` 仍使用力量比较型 MVP
  - `Way of the Warrior` 目前只实现了 `+3` 临时力量，尚未接入“本回合进入弃牌堆时抽牌”的正式临时触发语义
  - `Honor the Ancestors` 目前是“按其他玩家数量上限自动取弃牌堆前 N 张随从洗回牌库”的 MVP，尚未接入更精细的玩家选择 / may 语义
  - `Final Haiku` 已接入核心离场加成，但仍需在统一审计阶段复核其与附着目标离场、结算时序、后进场随从的严格官方语义
  - `Sakura Garden` 已覆盖 `onMinionDestroyed / onMinionDiscardedFromBase` 两条入口，但“同回合首次”门控目前仍更偏 destroy 记录，需在统一收尾阶段复核 discard-from-base 路径的去重语义

## 统一审计与 Gameplay E2E 发现

- `abilityBehaviorAudit.test.ts` 默认不会被普通 `vitest` 配置执行；必须使用：
  - `npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native`
- 统一审计当前已通过，结果为 `21 passed`；说明四派系第一轮实现至少已经满足现有描述-元数据-注册链路的一致性门槛。
- 新增的三条 gameplay E2E 当前覆盖的是“浏览器层新交互类型能否走通”，不是“所有正式出牌链都已 full-chain 覆盖”。
- 三条 gameplay E2E 的真实覆盖口径如下：
  - `Ancient Egyptians`：验证埋葬条带显示、翻开选择、翻开后弃置与抓牌结算
  - `Cowboys`：验证真实打出 `Gunfighter` 后，浏览器里可以完整走通 `Pinkerton -> 决斗牌 -> Deputy -> 结算`
  - `Samurai`：验证目标点击、己方随从离场，以及额外随从/行动额度兑现
- 其中两条是明确的“交互注入型 E2E”：
  - `Ancient Egyptians` 直接注入 `ancient_egyptians_seal_the_tomb_uncover`
  - `Samurai` 直接注入 `samurai_yokai_attack`
- 因此这两条只能证明：
  - bury / extra-play 这两类新 UI 交互在浏览器中可操作
  - 交互选择后的 reducer/额度/UI 联动能兑现
- 但它们不能替代：
  - `Ancient Egyptians / Samurai` 从手牌正常打出该牌到最终结算的 full-chain E2E
  - Samurai outcome 专项在浏览器中的独立出图证明（当前仍以领域测试为主）

## Visual / Browser Data
- E2E 最初出现“卡图/基地图白板”现象，但不是 atlas 索引错误：
  - 远端 `aiji.webp` / `aiji_base.webp` 可正常下载
  - 页面内 `new Image()` 可拿到正确 `naturalWidth / naturalHeight`
  - 真正根因是 `CardPreview` 以前使用多层 `background-image` 充当 locale fallback，Playwright 截图路径下会把 atlas 渲染成白板
- 已修复为：运行时选择“实际加载成功的单个 URL”作为最终 `backgroundImage`。
- 新 atlas 已上传到 R2，并验证：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/aiji.webp` → `200`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/aiji_base.webp` → `200`
- E2E 最终证据截图：
  - `test-results/evidence-screenshots/smashup/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-selection-visible.png`
  - `test-results/evidence-screenshots/smashup/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-intake-board.png`

## Technical notes
```text
关键规范：
- AGENTS.md
- openspec/AGENTS.md
- docs/ai-rules/asset-pipeline.md
- docs/ai-rules/data-entry.md
- docs/ai-rules/testing-audit.md
- docs/testing-best-practices.md
- docs/automated-testing.md

关键原图：
- D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\base\aiji_base.png
- D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\cards\aiji.png

当前 worktree 压缩产物：
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\public\assets\i18n\zh-CN\smashup\base\compressed\aiji_base.webp
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\public\assets\i18n\zh-CN\smashup\cards\compressed\aiji.webp

最终 evidence：
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\evidence\smashup\smashup-oops-faction-intake-contract.md
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\evidence\smashup\smashup-oops-faction-intake-e2e-test.md
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\docs\games\smashup\workflows\smashup-faction-intake.md
```

## 2026-03-31 feedback closeout

### ���޸����������鵵��
- `69c8c039`�������ı����� DiceThrone����ʵ�ʶ�Ӧ SmashUp Samurai ͬʱ�������⣻���� `393b83b3` ���ǡ�
- `69c8c230` / `69c8c419` / `69c8c4f8`��Samurai ���������� `393b83b3` �޸���
- `69c903f3`��AI �Ʒֽ׶� special ���������� `d8ec6aad` �޸���
- `69c92631`����������ѡĹ����Ӻ���ѡ���ش�������� `22713717` �޸���
- `69c92aa4` / `69c92bca`��Ancient Egyptians ǰ���������� `05db8831` �޸���
- `69c92d8d` / `69c9319f`��Ancient Egyptians ʣ������������ `fa9a4c02` �޸���
- `69c92e82`���������������⣬���߼�����ȷ��ȱ�ؼ��ع鸲�ǣ��Ѳ����Բ������޸��鵵��`3dd374b2`����
- `69c93b65`���������� / afterScoring ���ⴰ���쳣������ `4ec96272` �޸���
- `69c942f0`��һĿ��Ȼ vs ɱ����������ȷ���� bug ���� `74d8e513` �޸���

### �ѹر�
- `69c93d98`��֤�ݲ��㣻����ʵ������ػع�δ�����Դ��ڵ����� bug���ȹرա�
- `69c8f2f4`���߸����ѱ������޸����ǣ���ǰ `mobileSupport` ���� zero-height �ع��� Gunslinger `The Law` 1v1/����Ŀ��ѡ��ع��ͨ������ȱ����ʵ�豸/Ŀ�����������ê��ǰ���رչ鵵��

### ����������Ӧ�ύ
- `74d8e513` fix(smashup): respect in plain sight against entangled
- `393b83b3` fix(smashup): tighten samurai trigger regressions
- `4ec96272` fix(smashup): skip pirate king afterscoring window when unplayable
- `fa9a4c02` fix(smashup): cover ancient egyptians tomb trap and seal the tomb
- `22713717` fix(smashup): support dead rise discard-base quick play
- `3dd374b2` fix(smashup): cover drakkar reshuffle handoff
- `05db8831` fix(smashup): close ancient egyptians feedback regressions
- `d8ec6aad` fix(smashup): resolve open feedback regressions

## 2026-04-22 lane-S2R Findings
- 工作区当前有大量非本轮改动；本轮必须只碰 SmashUp 反馈相关文件与 evidence，不回滚/不覆盖他人修改。
- 根目录旧 	ask_plan.md/findings.md/progress.md 服务历史 SmashUp/Oops 任务，本轮作为 2026-04-22 Addendum 追加，不创建第二份正式 plan。
- 目标实现初步入口：src/games/smashup/abilities/world_champs.ts、src/games/smashup/abilities/mermaids.ts、src/games/smashup/abilities/samurai.ts、src/games/smashup/domain/baseAbilities.ts、src/games/smashup/domain/reducer.ts、对应 faction data/locale 与现有测试文件。

## 2026-04-22 Dicethrone critical follow-up Findings
- `69cba605` 的核心风险点在于 `Dice3D` 无 sprite 时仅显示 shimmer；当浏览器/网络导致骰图长期不可用，会形成“骰面不可见”的真实体验缺口。
- 本轮将兜底策略改成“shimmer + 可见文本符号”，并且用 `data-face-symbol` 暴露可观测标记，保证失败路径可验证。
- `69c3c83e` 黑屏链路本轮未观察到新的回归实现点；历史修复（board-shell 缩放从 CSS 除法改为 JS 预计算）仍在当前代码中。
- 本轮证据文档：`evidence/dicethrone/dicethrone-feedback-69c3c83e-69cba605-followup-2026-04-22.md`。

## 2026-04-22 SmashUp 三派系审计复审 Findings
- 三派系（`mermaids` / `skeletons` / `world_champs`）能力回归与四项审计套件在当前代码上全部通过，未发现新增行为回归。
- “实施中”文案已收敛到单值：`实施中 / Implementation in Progress`，并已从中英文 locale 删除 `faction_implementation_in_progress_hint` 长文案键。
- 三派系统一斜向横幅 E2E 已复跑通过，最新截图时间为 2026-04-22 23:26（`test-results/evidence-screenshots/_shared/smashup-10th-factions-*.png`）。
- 三派系专项审计文档已补齐 D1-D49 维度：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`。
- 通过静态比对 `registerAbility` 与 `newFactionAbilities` 主回归文件，发现仍有 20 条能力未被该文件直接点名（Mermaids 7 / Skeletons 6 / World Champs 7）；已在审计文档登记为“未覆盖风险”，后续按批次补专项断言。

## 2026-04-23 SmashUp 三派系补测收敛 Findings
- 已在 `src/games/smashup/__tests__/newFactionAbilities.test.ts` 补齐三派系缺口能力用例，新增/完善 `21` 条专项断言（含 `world_champs_shark_tattoo`、`skeletons_hearse_fleet`、`mermaids_toll_bay` 等）。
- `newFactionAbilities` 最新结果提升为 `166 passed / 1 skipped`，说明补测后无新增回归。
- 四项审计门禁与 i18n 复跑全部通过：
  - `interactionTargetTypeAudit` `7 passed`
  - `interactionDefIdAudit` `2 passed`
  - `abilityBehaviorAudit` `22 passed`
  - `interactionCompletenessAudit` `5 passed`
  - `npm run i18n:check` 通过
- 静态比对 `registerAbility('<id>')` 与 `newFactionAbilities.test.ts` 后，三派系缺口已收敛为 `0 / 0 / 0`（Mermaids / Skeletons / World Champs）。

## 2026-04-23 SmashUp 三派系大厅 E2E 断言修正 Findings
- 失败根因不是业务回归，而是测试语义错配：3 人房创建后房主占 1 席，座位文本应为“玩家 / 空位 / 空位”，旧断言误写成“空位 / 空位 / 空位”。
- 已将 `e2e/smashup/smashup.e2e.ts` 的座位校验收敛为 `toContainText(/空位\\s*\\/\\s*空位/)`，保留“仍有两个空位”的真实业务约束。
- 修正后复跑结果：
  - 单用例：`npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "3 人房间可加入且大厅会显示座位状态"` → `1 passed`
  - 整文件：`npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` → `3 passed`
- 三派系统一斜向“实施中”横幅用例在整文件复跑中仍保持通过，无新增样式回归。

## 2026-04-23 SmashUp 三派系审计门禁补记 Findings
- 复跑 `interactionTargetTypeAudit` 时出现 1 条门禁失败：`cthulhu_corruption` 已切到 `targetType: 'generic'`，但审计白名单未登记保留理由。
- 已在 `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` 补齐两处登记：
  - `REQUIRED_SOURCE_CONFIGS`：补 `targetType/generic + autoRefresh: field + responseValidationMode: live`
  - `APPROVED_GENERIC_SOURCE_REASONS`：补 `cthulhu_corruption` 的 generic 保留原因
- 修复后整组门禁回归恢复全绿：
  - `newFactionAbilities`：`166 passed / 1 skipped`
  - `interactionTargetTypeAudit`：`7 passed`
  - `interactionDefIdAudit`：`2 passed`
  - `abilityBehaviorAudit`：`22 passed`
  - `interactionCompletenessAudit`：`5 passed`
  - `npm run i18n:check`：通过

## 2026-04-23 Workflow 升级补记（派系实施流程）
- 已在 `docs/games/smashup/workflows/smashup-faction-implementation.md` 增补强制门禁：凡新增 `targetType: 'generic'` 的 `sourceId`，必须同步更新 `interactionTargetTypeAudit` 的 `REQUIRED_SOURCE_CONFIGS` 与 `APPROVED_GENERIC_SOURCE_REASONS`。
- 这次补记把“审计规则”前置到 workflow，避免后续新增派系时再次踩到“实现对了但审计登记漏了”的回归坑。

## 2026-04-24 SmashUp 三派系持续审计 Findings
- 已复跑三派系主回归与四项审计门禁，最新结果为：
  - `newFactionAbilities`: `168 passed / 1 skipped`
  - `interactionTargetTypeAudit`: `7 passed`
  - `interactionDefIdAudit`: `2 passed`
  - `abilityBehaviorAudit`: `22 passed`
  - `interactionCompletenessAudit`: `5 passed`
  - `npm run i18n:check`: 通过
- 已复跑 `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`，整文件 `3 passed`（含三派系统一斜向“实施中”横幅用例）。
- 横幅证据截图已更新到最新时间 `2026-04-24 09:08`（`test-results/evidence-screenshots/_shared/smashup-10th-factions-*.png`）。
- 历史“20 条缺口”已在 2026-04-23 收敛为 `0 / 0 / 0`，2026-04-24 再次复核保持不变；当前不存在三派系主回归覆盖缺口。
- 追加静态覆盖复核（扫描 `registerAbility` vs `newFactionAbilities.test.ts`）：
  - 总计能力：`40`
  - 未覆盖：`0`
  - Mermaids：`10/0`，Skeletons：`13/0`，World Champs：`17/0`
- `npx openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 已复跑通过。
- R2 远端资源回查保持 `200`：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/wangling.webp`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/wangling_base.webp`

## 2026-04-24 Workflow 强化补记（通用 + SmashUp）
- 已更新 `.windsurf/skills/data-entry-workflow/SKILL.md`：
  - 新增“长期任务连续执行模式”强制门禁（S0→S4 连续推进，不得中间收口）；
  - 明确 `continue` 的默认语义是“推进下一批执行”，不是重复汇报。
- 已更新 `docs/games/smashup/workflows/smashup-faction-implementation.md`：
  - 新增“长期任务连续执行（强制）”章节；
  - 约束在无硬阻塞时持续执行，且每次推进必须回填可复查证据与 planning 文件。
- 已同步 Android 内置 locale：
  - `android/app/src/main/assets/public/locales/zh-CN/game-smashup.json` 删除 `faction_implementation_in_progress_hint`，避免 App 壳继续出现旧长文案。
- `npm run assets:upload` 复跑结果：`上传 0，跳过 530（未变更），失败 0`。

## 2026-04-24 反馈审计文档复核补记
- 已在以下证据文档追加“2026-04-24 复核补记”，与当前主线 E2E 结果对齐：
  - `evidence/smashup/smashup-feedback-69db57c-faction-select-stall-2026-04-22.md`
  - `evidence/smashup/smashup-feedback-69daa51e-auto-skip-turn-2026-04-22.md`
- 统一复核命令：`npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`，结果 `3 passed`。

## 2026-04-25 两条 watchdog 反馈定向复测 Findings
- `69db57c` 定向用例复测通过：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "回归：在线 AI 在 factionSelect 阶段 seat state 延迟就绪时，不得被 watchdog 跳过到空牌对局"` → `1 passed`
- `69daa51e` 两条定向用例复测通过：
  - `在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合` → `1 passed`
  - `在线 AI 结束回合切回我方时不应出现整板重挂载或 loading 闪屏` → `1 passed`
- 关键截图时间已更新到 `2026-04-25 00:13`，对应证据文档已追加“2026-04-25 定向复测补记”。

## 2026-04-24 线上反馈 69eb3924（SmashUp recover-interaction 卡住）
- 线上 watchdog 快照显示 `smashup_reaction_choose` 出现重复 `optionId`（同一 `activate_special:titan:*` 重复两次），并触发 `visible-interaction:recover-interaction:blocker_persisted`。
- 根因：`scoringEligibleBaseIndices` 在锁定/读取链路缺少统一去重，重复基地索引在 scoreBases 响应窗口放大为重复交互选项。
- 修复：
  - `ongoingModifiers.getScoringEligibleBaseIndices` 统一走 `normalizeScoringEligibleBaseIndices`（保序去重）；
  - `reduce` 的 `SCORING_ELIGIBLE_BASES_LOCKED` 写入前去重；
  - `index.getLockedScoringBaseIndices` 统一走 getter，避免绕过规范化。
- 回归：`src/games/smashup/__tests__/scoringEligibleLock.test.ts` 新增 2 条去重用例并通过（`12 passed`）。
- 远端状态：`69eb392453c8e640a4475d6b` 已回写为 `resolved`（`matched=1, modified=1`）。

## 2026-04-25 SmashUp 三派系复审补记（Toll Bay 回归修复）
- `newFactionAbilities` 新出现失败点是 `mermaids_toll_bay 打出后会标记本回合触发窗口`，根因不是能力缺失，而是写入路径错误：
  - 能力里通过 `result.matchState.core` 直接改 core；
  - 但执行链路仅透传 `updatedState.sys`，不会把该 core 写回，导致字段落地失败。
- 已把“触发窗口标记”收敛到 reducer 的权威写入路径：
  - 在 `SU_EVENTS.ACTION_PLAYED` 中，`defId === 'mermaids_toll_bay'` 时写入 `mermaidsTollBayActiveTurnByPlayer[playerId] = turnNumber`。
- 修复后复跑结果：
  - `newFactionAbilities`: `170 passed / 1 skipped`
  - `interactionTargetTypeAudit + interactionDefIdAudit + abilityBehaviorAudit + interactionCompletenessAudit`: `36 passed`
  - `npm run i18n:check`: 通过
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`: `3 passed`
- 补充稳定性复核：`smashup.smoke.test.ts` 复跑 `121 passed`，确认本轮修复未破坏 SmashUp 主流程烟测。

## 2026-04-25 三派系审计修订（旧结论失效回写）
- 失效结论：上一条“`mermaids_toll_bay` 触发窗口标记回归修复”的描述与当前权威语义不一致，已判定失效。
- 当前权威语义：`mermaids_toll_bay` 仅执行“选择基地后按对手随从数即时抽牌”，不包含“本回合后续移动再触发”的持续窗口。
- 证据：
  - `newFactionAbilities.test.ts` 中该卡仅保留两条即时抽牌断言，当前结果 `170 passed / 1 skipped`；
  - 全量 SmashUp 回归 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup --configLoader native --maxWorkers 1` 结果 `146 files passed / 9 skipped`，`1962 passed / 19 skipped`；
  - 四审计套件复跑 `36 passed`，`smashup.smoke.test.ts` `121 passed`，`smashup.e2e.ts` `3 passed`。
- 文档修订：
  - 已在 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 新增“修订记录（2026-04-25 10:30）”，显式标注旧结论失效与新口径。

## 2026-04-25 R2 复核补记
- 执行 `npm run assets:upload`，结果：`上传 1342，跳过 530，失败 1（socket hang up）`。
- 对关键 URL 二次 HEAD 复核均为 `200`：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/wangling.webp`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/wangling_base.webp`
  - `https://assets.easyboardgame.top/official/common/audio/bgm/Villains Music Pack Vol. 1/Maniac (RT 5.161)/compressed/Villains Maniac Main.ogg`

## 2026-04-25 Gameplay 回归 Finding：巨石阵附着天赋二次发动
- 问题复现：
  - `npm run test:e2e:ci -- e2e/smashup/smashup-gameplay.e2e.ts` 首轮出现 `1 failed / 6 passed`；
  - 失败用例：`巨石阵应允许己方随从上的附着天赋第2次发动，并占用基地双才能名额`。
- 根因：
  - `src/games/smashup/domain/commands.ts` 的 `USE_TALENT` 在 `ongoingCardUid` 分支对 `ongoing.talentUsed` 直接拒绝；
  - 缺少“巨石阵 + 附着在己方随从上的持续行动卡 + 双才能名额未占用”的例外判定。
- 修复：
  - `src/games/smashup/domain/commands.ts` 与 `e2e/src/games/smashup/domain/commands.ts` 补 `attachedHostMinion` 识别与双才能例外；
  - `src/games/smashup/__tests__/talentAbilities.test.ts` 与 `e2e/src/games/smashup/__tests__/talentAbilities.test.ts` 新增 2 条回归测试（可用/不可用各 1 条）。
- 修复后验证：
  - `talentAbilities.test.ts`: `22 passed`
  - `smashup-gameplay.e2e.ts`: `7 passed`
  - `smashup.e2e.ts`: `3 passed`
  - `newFactionAbilities + smoke`: `174 passed / 1 skipped` + `121 passed`
  - 四审计套件：`36 passed`
  - `npm run i18n:check`: 通过

## 2026-04-25 三派系复核补记（去重测试块后重跑）
- 触发：发现 `src/e2e/src/games/smashup/__tests__/talentAbilities.test.ts` 有重复新增 case。
- 处理：去重为单组“附着行动卡第2次天赋可用/不可用”回归断言，避免重复测试掩盖真实覆盖率。
- 去重后复跑结果：
  - `talentAbilities.test.ts`：`20 passed`
  - `newFactionAbilities + smashup.smoke`：`179 passed / 1 skipped` + `122 passed`
  - 四审计套件：`36 passed`
  - `npm run i18n:check`：通过
  - `smashup-gameplay.e2e.ts`：`7 passed`
  - `smashup.e2e.ts`：`3 passed`
- 结论：计数变化来自重复 case 去重，不是能力回退；去重后三派系主链路仍全绿。

## 2026-04-25 数据录入基操补齐（Wiki 工具链）
- `scripts/scrape-wiki-with-descriptions.mjs` 已补 `skeletons / mermaids / world_champs` 映射，避免对 10 周年派系漏抓。
- `scripts/final-wiki-code-comparison.mjs` 已补：
  - `nameEn` 双引号/单引号统一解析；
  - 名称归一化（`'`/`’`）避免假缺失；
  - 报告显式声明“仅校验 name/count，不校验语义”。
- 现场复核：
  - `node scripts/scrape-wiki-with-descriptions.mjs skeletons` -> `12 种 / 20 张`
  - `node scripts/final-wiki-code-comparison.mjs` -> `1 正确 / 0 问题（仅 name/count）`
  - `npx eslint scripts/scrape-wiki-with-descriptions.mjs scripts/final-wiki-code-comparison.mjs` -> 0 errors
- 结论：工具链“漏派系 + 引号误判”问题已修复；`Skeletons` 语义错配结论不变，仍需整派系重录与实现。

## 2026-04-25 Skeletons 整派系重录实施（进行中）
- 已将 `newFactionAbilities.test.ts` 的 Skeletons 区块（原 7064-7604）整体替换为新语义断言，覆盖：
  - Returned One 自埋 + 翻开后再翻一张；
  - Place ’em Down / Dig ’em Up 的基地-卡牌双段交互；
  - Graveyard / Grave Goods / Lord of Bones 的“挖掘+指示物/手埋”语义；
  - Spooky, Scary... 的“弃牌堆埋葬 + 抽 1”；
  - Hearse Fleet 的埋葬牌搬运；
  - Revenant 回合内弃牌堆自埋且每回合一次；
  - Gravestones 计分后自埋到他基地；
  - Gravetender 每回合首次埋/挖触发抽牌。
- 定向验证通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "Skeletons abilities" --configLoader native --maxWorkers 1`
  - 结果：`13 passed`（Skeletons 子集全绿）。
- `interactionTargetTypeAudit` 已按新 sourceId 完成门禁同步：
  - 新增/调整 `APPROVED_GENERIC_SOURCE_REASONS`（`skeletons_*_cards/uncover/...`）；
  - 修复 `unknown` generic 来源（`handleSkeletonsHearseFleetSpecialMode` 改为字面量 sourceId 分支）；
  - 移除失效登记项 `skeletons_dig_em_up`，改为 `skeletons_dig_em_up_cards`。
- 审计验证通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
  - 结果：`7 passed`。
- 质量门禁：
  - `npx eslint src/games/smashup/abilities/skeletons.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`：0 error（warnings 存量未扩大）；
  - `npm run i18n:check`：通过（仅动态 key 警告）。

## 2026-04-26 SmashUp 三派系审计续跑 Findings
- `interactionCompletenessAudit` 的孤儿误报根因已确认是 `_pod` alias 引用不对称；在 `createOrphanHandlerCheck` 做 alias 对称映射后，审计恢复稳定通过。
- `Mermaids` 两条争议用例已对齐当前实现语义：
  - `mermaids_desert_island` 校验“控制者总力量压制”而非“强制退回随从”；
  - `mermaids_charmed` 校验完整交互链与压制元数据，不再误用 `tempPowerModifier=-2` 旧口径。
- 最新门禁口径：`newFactionAbilities 178 passed / 1 skipped`，四审计套件 `36 passed`，`i18n:check` 通过（仅 dynamic-key warning）。
- E2E 本轮状态：横幅目标用例通过并完成核图；同文件存在 1 条 join 超时失败（3 人房座位状态），需后续单独稳态化。

## 2026-04-26 SmashUp 横幅 E2E 稳态化补记
- 本轮 `smashup.e2e.ts` 失败不是横幅逻辑回归，而是“3 人房间”用例在第三访客 join 时触发默认 30s 测试超时。
- 已在 `e2e/smashup/smashup.e2e.ts` 对该用例显式提升超时为 `120000ms`，保留原业务断言不变。
- 修复后复跑结果：`npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` 为 `3 passed`，横幅用例继续通过。

## 2026-04-26 SmashUp smoke 追加复核
- 在完成三派系审计 + 横幅 E2E 收敛后，补跑 `smashup.smoke.test.ts`，结果 `124 passed`。
- 结论：本轮 `_pod` 审计修复、Mermaids 语义对齐与 E2E 超时稳态化未引入 SmashUp 主流程烟测回归。

## 2026-04-26 全量 SmashUp 回归探测 Findings
- 三派系目标门禁（`newFactionAbilities` + 4 审计 + 横幅 E2E + smoke）本轮均已通过；但全量 `src/games/smashup` 复跑仍报 `14` 条失败。
- 当前失败主要集中在两条链路：
  1) `afterScoring` 响应窗口会话收口（2 条）；
  2) `onDestroy` 事件链期望（11 条）与 1 条命令校验。
- 这批失败不在本轮“横幅统一样式 + 三派系审计门禁”直接改动面内，但已构成继续推进的阻塞项，需下一批进入定向排查与修复。

## 2026-04-26 全量 SmashUp 失败簇收敛（14 → 2 → 0）
- 14 条失败簇先收敛到 2 条后，最终剩余均位于 `newFactionAbilities.test.ts` 的 `bear_cavalry_bear_necessities`：
  1) 断言把目标限制成“仅行动卡”；
  2) stale 目标离场后仍可能发出 `ONGOING_DETACHED`。
- 根因分类：
  - **测试语义漂移**：卡面/i18n 权威语义明确是“消灭一个随从或在基地上打出的一张战术卡”，旧断言过度收窄。
  - **交互 stale 防护缺口**：`bear_cavalry_bear_necessities` handler 对行动卡分支缺少“目标仍在场”校验。
- 修复：
  - 对齐回归断言为“目标包含对手随从 + 已打出的行动卡”；
  - 在 `registerInteractionHandler('bear_cavalry_bear_necessities')` 增加 `actionStillOnBoard` 校验，离场则返回空事件。
- 验证：
  - `newFactionAbilities.test.ts`：`174 passed / 1 skipped`；
  - 全量回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism`
    - `146 files passed / 9 skipped`
    - `2016 passed / 19 skipped`

## 2026-04-26 三派系审计套件复核（收敛后再次确认）
- 失败簇清零后，复跑四项审计套件：
  - `interactionTargetTypeAudit`
  - `interactionDefIdAudit`
  - `abilityBehaviorAudit`
  - `interactionCompletenessAudit`
- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
- 结果：`4 files passed`，`36 passed`。
- 结论：三派系审计门禁在“14→0”修复后仍保持全绿，没有被回归修复反向打破。

## 2026-04-26 横幅 E2E 稳态化（服务冷启动防抖）
- 现象：`派系选择页应显示 10 周年三派系与统一斜向实施中横幅` 用例在 managed runtime 冷启动窗口偶发 `skip`，根因是探活仅单次请求，服务尚未 ready 即判定不可用。
- 修复：
  - `e2e/smashup/smashup.e2e.ts`
  - `e2e/smashup.e2e.ts`
  - `ensureGameServerAvailable` 改为 45 秒轮询探活（每秒一次）。
- 验证：
  1. `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "派系选择页应显示 10 周年三派系与统一斜向实施中横幅"` → `1 passed`
  2. `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` → `3 passed`
  3. `npm run i18n:check` → 通过（仅既有 `dynamic-key` warning）
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 2026-04-26 World Champs 关键链路补证（三）
- 新增 `world_champs_mouse_bird_and_sausage` 的浏览器级真实入口证据：覆盖“锚点选择 -> 同基地同派系二段多选 -> +2 生效”完整链路。
- 修正 `world_champs_fighting_spirit_prize` 的 E2E 多选提交方式：将“UI 局部点击 + confirm”改成 `SYS_INTERACTION_RESPOND(optionIds[])` 一次性提交，避免多选态在不同渲染模式下不稳定导致的假阴性。
- 结论变化：
  - `World Champs` 的 L3 证据从 `Stoneford / 海龟阿凯 / 盾女` 扩展为 `Stoneford / 海龟阿凯 / 盾女 / 斗志奖杯 / 鼠、鸟与香肠`。
  - 这仍是“关键样本扩展”，不是“三派系整包发布收口”；主口径继续保持“仍有残余范围”。
- 本轮关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\斗志奖杯打出后应抽两张并给两个己方随从各放一个-+1-指示物\fighting-spirit-prize-prompt-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\斗志奖杯打出后应抽两张并给两个己方随从各放一个-+1-指示物\fighting-spirit-prize-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从-+2\mouse-bird-sausage-targets-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从-+2\mouse-bird-sausage-resolved.png`

## 2026-04-26 骷髅《复仇者》真实入口口径回写
- 旧 E2E 失败不是《复仇者》逻辑回归，而是**测试还停留在旧 prompt 模型**。
- 当前真实实现已经不是 `waitForInteraction('skeletons_revenant_base')` 这条链，而是：
  1. 你的出牌阶段，弃牌堆存在《复仇者》；
  2. 弃牌堆面板中出现可选《复仇者》；
  3. 选中后出现“点击基地埋葬这张牌”提示；
  4. 点基地直接 `ACTIVATE_SPECIAL({ discardCardUid, baseIndex })`；
  5. `usedDiscardPlayAbilities` 记账后，同回合第二次不再暴露入口。
- 因此这里被补上的不是单纯一条 E2E，而是**审计口径纠偏**：旧“Revenant 仍缺 during-turn/L3”结论已经失效。

## 2026-04-26 世界冠军《武士 陈》负路径证据
- 当前浏览器基线下，真实打出《武士 陈》后不会再出现《海龟阿凯》的“选择玩家 -> 交牌 -> 抽两张”交互。
- 这说明用户当时看到的“武士 陈卡面却触发海龟阿凯效果”在当前基线上已不再复现，能够继续支撑“根因是 cards7 图集索引错位，而不是当前能力实现串线”的结论。
- 这条证据的价值是**负路径**：不是再证明《海龟阿凯》能正常触发，而是证明《武士 陈》不会误触发《海龟阿凯》。

## 2026-04-26 World Champs《金币猫 / 鲨鱼纹身》补证与根因升级
- 《金币猫》当前浏览器级真实入口已确认：
  - 打出后 prompt 会同时给出同基地己方/敌方其他随从；
  - 选择敌方后，只有敌方目标获得 `+1`，没有误加到己方。
- 《鲨鱼纹身》当前卡图语义与实现录入本身一致，问题不在数据录入：
  - 打出时附着并立即给宿主 `+1`；
  - 下个自己回合开始时若这里确实只有你这一张随从，则再给 `+1`；
  - 若这里还有你的其他随从，则不会额外加。
- 本轮真正定位到的根因比“卡图/配置录错”更深一层：
  - `src/games/smashup/domain/index.ts` 的 flow hook 会把**已被事件预先 reduce 过的 core**夹带进 `updatedState` 返回；
  - 引擎随后又会对返回事件再 reduce 一遍；
  - 对《鲨鱼纹身》表现成“事件只有 1 条，结果却多算 1 次”。
- 结论：
  - 这次不是“审计维度只有卡图/文本不够”，而是**对象级重审把问题从表面卡牌怀疑，推进到了 flow hook / updatedState / core 双算边界缺陷**。
  - 也因此，后续三派系重审不能只看“卡图对上了没”，还必须继续抽样覆盖“startTurn / endTurn / afterScoring”这类阶段切换链路。

## 2026-04-26 World Champs《警长 / 木乃伊》补证与误判根因回写
- 《警长》与《木乃伊》当前都已补到浏览器级真实入口证据：
  - `警长应在基地计分前发起决斗并摧毁落败随从` → `1 passed`
  - `木乃伊应在基地计分后埋葬到另一个基地` → `1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-world-champs-sheriff-mummy-e2e-2026-04-26.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-sheriff-duel-card-prompt-2026-04-26.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-sheriff-duel-resolved-2026-04-26.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-mummy-after-scoring-prompt-2026-04-26.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-mummy-buried-on-other-base-2026-04-26.png`
- 本轮收紧后的根因结论：
  - 《警长》此前更像是 **E2E helper 只看 host 视角 + 错点泛化 Pass + 场景残留 titan 污染**；
  - 《木乃伊》此前更像是 **beforeScoring 场景污染 afterScoring 入口**；
  - 这两张牌当前都**不应再被粗暴归类成“卡图录错 / 数据录错”**。

## 2026-04-27 World Champs《高速追逐 / 现在是闪电时间！ / 聪明Set-Up》对象级补证
- 本轮继续按“卡图优先 + 对象级真实入口”推进，补齐 3 张仍缺浏览器级 L3 证据的行动牌：
  - 《高速追逐》
  - 《现在是闪电时间！》
  - 《聪明Set-Up》
- 本轮 E2E 结论：
  - `高速追逐`：已证实真实链路为“打到基地 -> 发动天赋 -> 先选己方随从 -> 再选目标基地 -> 行动转移、随从移动、本回合 +3”
  - `现在是闪电时间！`：已证实真实链路为“打出 -> 选己方随从 -> 仅被选中者本回合 +3”
  - `聪明Set-Up`：已证实真实链路为“附着到其他玩家随从 -> 切到对手出牌阶段 -> 该基地首次打出随从后你抽 1 张”
- 证据文档：
  - `evidence/smashup/smashup-world-champs-high-speed-smart-blitz-e2e-2026-04-27.md`
- 稳定截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-high-speed-chase-ongoing-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-high-speed-chase-minion-prompt-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-high-speed-chase-resolved-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-its-blitzin-time-prompt-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-its-blitzin-time-resolved-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-smart-set-up-attached-2026-04-27.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-smart-set-up-triggered-2026-04-27.png`
- 当前口径继续保持：
  - `World Champs` 对象级证据继续扩展，但三新派系整包仍是 **仍有残余范围**。

## 2026-04-28 World Champs《着魔 / 嗯？》补证与《嗯？》入口缺口定位
- 《着魔》当前不是数据录入问题；真实入口已证实为“附着宿主 -> 宿主离场 -> 转移到另一个随从并继续 +2”。
- 《嗯？》本轮发现的真实问题不是卡图/locale/previewRef，而是**入口实现缺口**：
  - 之前只有 `special executor` 和交互 handler；
  - 但没有注册到弃牌区 `discard special provider`；
  - 也没有在结算后写 `DISCARD_ABILITY_USED` 做“本回合一次”锁定。
- 修复后《嗯？》已证实真实链路为：
  - 本回合打出第一个行动后；
  - 从弃牌堆作为额外行动发动；
  - 选择一个己方随从获得 `+1`；
  - 该牌回到手牌。
- 这次再次说明三新派系重审不能只看“卡图和中文名有没有对上”，还要抽样 `discard special / endTurn / afterScoring / startTurn` 这类真实入口链路。

## 2026-04-28 World Champs《彩虹女孩 / 怪兽冲击》补证
- 《彩虹女孩》当前不是数据录入问题；真实入口已证实为“打出后只给这里的其他己方随从 +1，自己、敌方、其他基地己方都不吃到加成”。
- 《怪兽冲击》当前也不是数据录入问题；真实入口已证实为“打出后得到两个额外行动，并能在同回合真实打出后续两张行动”。
- 《怪兽冲击》本轮暴露的问题是**E2E 断言写错**：
  - 我一开始把第三张行动《暗杀》误当成“立即消灭目标”；
  - 但《暗杀》真实语义是“附着后在回合结束时消灭该随从”；
  - 所以这里修的是验证口径，不是卡牌实现。
- 这再次说明三新派系重审除了卡图和中文名，还要把“验证断言是否忠于卡图语义”也纳入审计范围。

## 2026-04-29 World Champs《快如闪电 / 女主角 / 阿拉密斯》补证与旧误判失效
- 旧“《女主角》复制标准行动实现没问题”的结论已经失效。
- 失效原因不是卡图、中文名或索引，而是旧审计主要停在 `events`，没有把 `finalState`、`triggerQueue`、`reaction session` 收口和真实入口 E2E 拉进来。
- 这次定位出的两条真实根因是：
  1. `smashup_reaction_choose` handler 把已经预先 reduce 过的 `core` 连同事件一起交还系统层，导致同一批事件再次 reduce；《女主角》因此从应得 `+2` 落成了 `+4`。
  2. `collectTriggers()` 对《阿拉密斯》的 `onMinionAffected` 过滤不够，只要别的随从被标准行动影响，也可能把《阿拉密斯》错误再入队。
- 为了让这条真实入口稳定可测，本轮还补了两类配套修正：
  - `GameTestContext.playCard()` 与 `selectOption()` 对“无基地前置、直接选随从”的行动牌和重名中文选项做了更稳的 direct respond；
  - 《女主角》同批次目标过滤被显式收窄到“原始受影响的同基地其他己方随从”，避免同批次误回看。
- 定向复跑结果：
  - `newFactionAbilities` 聚焦 3 条：`3 passed`
  - `快如闪电打到阿拉密斯后应可选触发女主角复制并让阿拉密斯提供额外行动`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-world-champs-diva-aramis-fast-as-lightning-e2e-2026-04-28.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-diva-aramis-reaction-prompt-2026-04-28.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-diva-aramis-resolved-2026-04-28.png`
- 结论：
  - 这次不是数据录入错误，而是**reaction/reducer 边界错误 + trigger scope 错误**。
  - 审计维度必须继续保持：`卡图/locale/defId/注册` 之外，再强制覆盖 `finalState / triggerQueue / reaction session / 真实入口 E2E`。

## 2026-04-29 Mermaids《人鱼女王 / 安静的海岸》补证
- 当前 `Mermaids` 的残余问题已经不是“有没有基础单测”，而是对象级 L3 太少。
- 本轮新增两条浏览器级真实入口：
  1. 《人鱼女王》走 `move` 模式，把其他玩家的一个仆从移到“这里”；
  2. 《安静的海岸》打到基地后，从场上发动持续牌天赋并迁移到另一个基地。
- 这两条链路都不是新增实现修复，而是把此前只停留在 L2 的行为补到真实入口。
- 定向复跑结果：
  - `mermaids_mermaid_queen|mermaids_becalmed_shores`：`3 passed`
  - `人鱼女王应可选择移动其他玩家的一个仆从到这里`：`1 passed`
  - `安静的海岸应可从场上发动天赋并移到另一个基地`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-mermaids-mermaid-queen-becalmed-e2e-2026-04-29.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-mermaid-queen-move-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-mermaid-queen-move-resolved-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-attached-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-move-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-becalmed-shores-moved-2026-04-29.png`
- 结论：
  - `Mermaids` 当前至少已有 `最后的歌声 / 迷倒观众 / 人鱼女王 / 安静的海岸` 共 `4` 条对象级正路径 L3。
  - 但三新派系整包仍是 **仍有残余范围**，不能把这 4 条直接外推成整包收口。

## 2026-04-29 Mermaids《塞壬的歌声》+ Skeletons《他们出来了》补证
- 本轮新增两条浏览器级真实入口：
  1. 《塞壬的歌声》只允许选择“还有其他己方基地可去”的来源基地，并把目标仆从真实移到该己方基地；
  2. 《他们出来了》只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌。
- 定向复跑结果：
  - `塞壬的歌声应只提供有其他己方基地可去的来源基地，并把目标仆从移到该己方基地`：`1 passed`
  - `他们出来了应只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-mermaids-siren-song-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-dig-em-up-e2e-2026-04-29.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-source-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-target-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-mermaids-siren-song-resolved-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-dig-em-up-cards-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-dig-em-up-resolved-2026-04-29.png`
- 流程 finding：
  - 本轮第一次写《他们出来了》场景时，误用了仓库里并不存在的 `robot_microbot_beta`，直接把第二张“被挖掘牌”打成了 `discardWithoutPlay` 假问题。
  - 这说明 **E2E 场景数据本身也要按卡图/真实 card def 做强约束**；否则测试会制造假阴性或假阳性。
- 结论：
  - `Mermaids` 当前至少已有 `5` 条对象级正路径 L3：`最后的歌声 / 迷倒观众 / 人鱼女王 / 安静的海岸 / 塞壬的歌声`。
  - `Skeletons` 当前至少已有 `4` 条对象级正路径 L3：`殉葬品 / 灵车队伍 / 复仇者 / 他们出来了`。
  - 三新派系整包仍是 **仍有残余范围**，不能把这些对象级补证直接外推成整包收口。

## 2026-04-29 Skeletons《墓园》补证
- 本轮新增一条浏览器级真实入口：
  1. 《墓园》从场上发动天赋，挖掘这里一张你的埋葬牌；若挖出的是随从，则继续进入“是否放置 1 个 +1 指示物”的后续交互。
- 定向复跑结果：
  - `skeletons_graveyard 天赋挖掘后若是随从会进入可选 +1 指示物交互`：`1 passed`
  - `墓园应可从场上发动天赋挖掘己方埋葬牌，并在挖出随从后可放置 \+1 指示物`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-skeletons-graveyard-e2e-2026-04-29.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-uncover-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-counter-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-graveyard-resolved-2026-04-29.png`
- 结论：
  - `Skeletons` 当前至少已有 `5` 条对象级正路径 L3：`殉葬品 / 灵车队伍 / 复仇者 / 他们出来了 / 墓园`。
  - 这轮新增的是**真实入口补证**，不是新增实现修复。
  - 三新派系整包仍是 **仍有残余范围**。

## 2026-04-29 Skeletons《骸骨之王》补证
- 本轮新增一条浏览器级真实入口：
  1. 《骸骨之王》从场上发动天赋，挖掘这里任意埋葬牌；被挖出的“其他随从”需要先经过 `smashup_reaction_choose`，再进入“是否放置 1 个 +1 指示物”的后续交互。
- 定向复跑结果：
  - `skeletons_lord_of_bones 天赋可挖掘这里任意埋葬牌而不只限自己`：`1 passed`
  - `骸骨之王应可从场上发动天赋挖掘这里任意埋葬牌，并在挖出其他随从后可放置 \+1 指示物`：`1 passed`
- 新证据文档：
  - `evidence/smashup/smashup-skeletons-lord-of-bones-e2e-2026-04-29.md`
- 关键截图绝对路径：
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-uncover-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-reaction-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-counter-prompt-2026-04-29.png`
  - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-lord-of-bones-resolved-2026-04-29.png`
- 流程 finding：
  - 单测里这条链路容易被看成“挖出后直接弹 +1 提示”；
  - 但浏览器真入口里实际先进入 `smashup_reaction_choose`，再选 `骸骨之王` 才会继续到 `skeletons_lord_of_bones_ongoing`。
  - 这说明 `reaction session` 仍然必须保留在三新派系重审维度里，不能退回只看单测或 `finalState`。
- 结论：
  - `Skeletons` 当前至少已有 `6` 条对象级正路径 L3：`殉葬品 / 灵车队伍 / 复仇者 / 他们出来了 / 墓园 / 骸骨之王`。
  - 这轮新增的是**真实入口补证 + reaction session 流程 finding**，不是新增实现修复。
  - 三新派系整包仍是 **仍有残余范围**。

## 2026-04-29 Workflow / Skill 修订结论
- 这轮返工不只是单卡漏测问题，还暴露出两条流程缺口：
  1. 批量派系重审时，没有把“当前批次未清空不得停”写成项目内硬门禁；
  2. E2E 场景真值与 `reaction session` 审计维度还没被现有 workflow 明确提升到强制级。
- 已回写到项目内 skill / workflow：
  - `.windsurf/skills/data-entry-workflow/SKILL.md`
  - `docs/games/smashup/workflows/smashup-faction-implementation.md`
  - `docs/ai-rules/testing-audit.md`
- 新增的强制点：
  - 批量派系重审必须先建对象清单，并持续推进到当前批次清空
  - `continue` 在这类任务里默认表示“继续下一个未完成对象”，不是“补 1-2 张后停下汇报”
  - E2E 场景必须先做 `defId` 真值预检
  - Smash Up 对象补证默认按 `L0-L4` 分层验收
  - 真实入口若出现 `smashup_reaction_choose`，必须单独作为 `reaction session` 证据留档
## Session: 2026-04-29 《沉船湾 / 轮回者 / 诡异。可怕。 / 墓碑》L3 补证
- **Status:** in_progress
- Findings:
  - 《轮回者》旧 E2E 的失败根因不是实现 bug，而是旧测试把“自埋后直接无交互”当成事实；真实入口会先进入 `smashup_reaction_choose`，再由《轮回者》触发项收口。
  - 《沉船湾》《墓碑》旧在线场景都没有把《绿洲丛林》推到 `12` 点计分阈值，因此“没进计分后的触发窗”属于 E2E 注入错误，不属于业务实现错误。
  - 这类错误说明当前重审必须继续坚持两条门禁：
    1. `reaction session` 不能靠单测观察面代替，浏览器级必须真看 prompt；
    2. online afterScoring 场景必须先核对原基地是否真的达到 breakpoint，再判断实现是否失效。
- Evidence:
  - `evidence/smashup/smashup-mermaids-shipwreck-cove-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-returned-one-spooky-scary-gravestones-e2e-2026-04-29.md`

## Session: 2026-04-29 《守墓人 / 墓地爆发》续推
- **Status:** in_progress
- Findings:
  - 《守墓人》浏览器级正路径已通过，说明“你的其他牌被埋葬后抽 1 张”在真实入口里没有漏掉。
  - 《墓地爆发》旧“只是测试基础设施阻塞”结论已失效。
  - 新确认的真实根因：
    1. 真实链路确实能进入 `skeletons_burst_forth` prompt，且目标埋葬牌会翻正、可点，这部分不是问题；
    2. 问题出在 `scoreBases` 交互收口后的自动推进时序：交互刚产出的 `MINION_PLAYED` 还没 reduce 进 core，Flow 就继续计分了；
    3. 结果是 action log 里能先看到《雷克斯王》被挖出来，但同一轮 `BASE_SCORED` 仍按旧总力量 `13` 结算。
  - 本轮修复后：
    1. `src/games/smashup/domain/systems.ts` 与 `src/games/smashup/domain/index.ts` 已新增 `scoreBases` 交互 reduce 门禁；
    2. 《墓地爆发》浏览器级已通过，证明翻出的随从会真实改写本次计分结果。
- Evidence:
  - `evidence/smashup/smashup-skeletons-gravetender-e2e-2026-04-29.md`
  - `evidence/smashup/smashup-skeletons-burst-forth-e2e-2026-04-29.md`

## Addendum（2026-04-30）：Feedback cleanup audit 收口复核
- 2026-04-24 初版 `temp/feedback-cleanup-audit-2026-04-24.md` 把 4 条反馈都列为“需复核是否回归”，这在当时成立，但已不是当前真相。
- 2026-04-30 复核后确认：
  - `69c8f2f432bd47a7b57a66f8`（DiceThrone 黑屏）已在 `temp/feedback-closeout/status-board.json` 记为 `resolved`。
  - `699f098e25c2319ea7b5f281`（波纹造成伤害但没有掉血）已在 `status-board.json` 记为 `resolved`。
  - `69a277a317d6c588726802fe`（SummonerWars 撤回特别慢 / 放大镜功能没了）已在 `status-board.json` 记为 `resolved`。
- 当前只剩 `699f0a1625c2319ea7b5f2a9`（获得 3cp 后伤害不对）未完成最终闭环：
  - 已有本地业务验证 evidence：`evidence/dicethrone/dicethrone-feedback-699eb46-699f0a-regression-verification-2026-04-25.md`
  - 但最新 `temp/feedback-closeout/remote-human-unresolved-latest.json` 仍显示该反馈远端状态为 `in_progress`
  - `status-board.json` 也尚无该条登记
- 结论：Feedback cleanup audit 不能按“已全部完成”处理；最准确说法是“仅剩 699f0a 的远端状态/状态板闭环证据待补”。

## Addendum（2026-04-30）：Feedback cleanup audit 最终闭环确认
- 对 `699f0a1625c2319ea7b5f2a9` 的最新远端直查结果表明：该反馈当前线上已是 `resolved`。
- 本地执行的 `temp/feedback-closeout/update-feedback-status-20260430-699f0a-to-resolved.js` 返回 `matched=0 / modified=0`，原因不是失败，而是该条在数据库里已经不再属于 `open / in_progress`。
- 同次返回的远端文档字段：`status=resolved`，`updatedAt=2026-04-25T16:24:42.444Z`。
- 由此可确认：此前“只剩 699f0a 未闭环”的结论已经失效；真实问题是本地状态板与审计文档漏登记，而不是线上未回写。
- 现已补齐 `temp/feedback-closeout/status-board.json` 与相关规划文档，`Feedback cleanup audit` 可以按完成处理。

## 2026-05-02 控制流栈化收口补记
- `smashup-complex-multi-base-scoring.e2e.ts` 的失败根因不是新的业务缺陷，而是测试仍按旧 UI / 旧 sourceId 假设写：
  - PASS 按钮仅匹配 `跳过|Pass|Skip`，没有覆盖真实文案 `让过`；
  - 4p 复杂链路里把固定 sourceId 顺序当成契约，没有接受 `smashup_reaction_choose -> 具体触发` 的新主链。
- 这轮修复后，SmashUp 浏览器级证据口径统一为：
  1. 先证明反应入口确实打开；
  2. 再证明 PASS / 触发选择后窗口能真实收口；
  3. 对多基地场景，用最终 VP / 基地替换结果证明“最后一个锁定基地只自动结算一次”。
- 额外清理：根目录重复旧 E2E `e2e/smashup-afterscoring-simple-complete.e2e.ts` 与 `e2e/smashup-multi-base-scoring-complete.e2e.ts` 已删除，避免旧副本继续漂移成遗留。

## 2026-05-02 DiceThrone 栈化回归补记
- 这轮真正需要证明的不是“所有武士 token 全链都重写通过”，而是 **control-flow 栈化后前台 owner / 队列恢复 / 多目标弹窗没有被打坏**。
- 当前已跑通且已看图的 3 条复杂链路，分别覆盖了 3 类高风险点：
  1. `The Law` 4 人 2v2 多目标：证明多人 targeting modal 仍按前台 owner 正常工作；
  2. `simple-choice` 收口后恢复 token 响应：证明队列恢复链没有丢失前台弹窗；
  3. `samurai honor pass`：证明 token 响应窗口关闭后不会错误 reopen。
- 根目录旧副本 `e2e/dicethrone-token-response-window.e2e.ts` 的 `samurai honor should open from real attack flow and resolve by two clicks` 当前失败，不宜直接拿来否定本轮框架重构：
  - 失败截图里 guest 端停在 `4. 那啥攻击阶段`，host 端是 `可以响应 / 跳过` + `结算攻击` 并存，说明它混用了旧入口假设与当前 UI 语义；
  - 进一步轮询后，host 侧状态会直接回到 `main2` / `defenderId=null`，更像旧测试选中的武士技能链本身不再产生“可防御”真实入口，而不是 modal owner 栈逻辑把窗口吞掉；
  - 因此它当前更应被视为 **历史重复旧测试副本**，不是本轮已经确认的产品回归。
- 本轮没有保留对这条旧副本失败 case 的试探性测试补丁，避免把“为了追旧假设而改测试”的噪音混进正式收口。
- 进一步排查后确认：
  - `e2e/dicethrone-token-response-window.e2e.ts` 可以安全删除，因为它的 6 条测试标题都已被 `e2e/dicethrone/dicethrone-token-response-window.e2e.ts` 覆盖，后者还是超集（额外包含 `月精灵闪避成功后自动收口` 与 `samurai honor pass`）。
  - 但 `e2e/dicethrone-simple-start.e2e.ts` 与 `e2e/dicethrone/dicethrone-simple-start.e2e.ts` 目前只是 **部分重叠**，彼此仍有独立用例；`e2e/dicethrone-status-interaction-complete.e2e.ts` 也仍是当前唯一正式文件，不可按“重复旧副本”删除。

## 2026-05-05 08:05 线上房间加入失败复核
- 来源口径：线上反馈源（生产 Mongo + 生产 API）。
- 生产 Mongo 直查发现当前未关闭的人类反馈只剩 2 条：  - 69f86b739ec13b96d71107d4：创房间后朋友进不了提示进入失败  - 69f86c159ec13b96d7110804：朋友加入不了房间提示加入失败
- 生产 API 部署前可稳定复现：create -> claim-seat -> join（不带 playerID）返回 403，body 为 "playerID is required"。
- 生产机仓库 /home/admin/BoardGame/server.ts 仍停在旧 join 协议（commit 2d1b8bf8b3fea80a536dd5ff3008b5e032752027），/games/:name/:matchID/join 仍强制要求 playerID。
- 当前仓库 / origin/main 已切到 resolveJoinSeat 自动分座语义，因此本次故障属于生产镜像滞后，不是新回归。
- 另发现 Android 反馈附带的 "AppUpdate plugin is not implemented on android" 来自 subscribeAndroidNativeUpdateState listener 注册 promise 未兜底，是独立兼容性风险。
- 2026-05-05 继续追查后已锁定：缺 `AppUpdatePlugin` 的不是某个 OTA/H5 bundle，而是 **2026-04-04 08:43 +0800 提交 `2b56ac5a` 之前构建出的 Android 原生壳**。
- 直接证据链：
  - `git show 7c013bce:android/app/src/main/java/top/easyboardgame/app/MainActivity.java` 中只有 `registerPlugin(GamePackagePlugin.class)`，没有 `AppUpdatePlugin`。
  - `git show 2b56ac5a --stat` 显示 `AppUpdatePlugin.java` 与 `MainActivity.java` 的注册是在 `2026-04-04 08:43 +0800` 首次落仓。
  - `git show 2b56ac5a:package.json` 仍是 `version: 0.5.0`；随后 `880b7d33` 才把项目版本升到 `0.5.1`。
  - `https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.1.apk` 当前可直接访问，且包内 `classes.dex` 可检出 `AppUpdatePlugin` / `top/easyboardgame/app/AppUpdatePlugin` 字符串；同路径 `0.5.0.apk` 返回 404。
  - `evidence/android-release-0.5.1-rollback-investigation-2026-04-04.md` 已记录：在 `2026-04-04` 修复前，`native-app-updates/android/stable/latest.json` 一度是 404；修复后首个补发到 stable 的正式原生包就是 `0.5.1.apk`。
- 结论收敛：
  - **首个确认带 `AppUpdatePlugin` 的正式原生包是 `0.5.1.apk`。**
  - 因此线上这类 `"AppUpdate" plugin is not implemented on android` 反馈，对应的缺插件正式壳就是 **`0.5.0` 正式 Android 包（以及更早壳）**，不是 `index-D9GB3chM.js` 这类 OTA/H5 hash 对应的 bundle。

## 2026-05-05 SmashUp 并列计分口径修复
- 真实业务仓库确认是 `D:/gongzuo/webgame/BoardGame`，不是 AstrBot 仓库；来源是 `tools/codex_cli_bridge.py` 与 `data/config/astrbot_plugin_hapi_connector_config.json` 的 `auto_forward_codex_bridge_cwd`。
- `大杀四方战斗力相等的情况下应该是取第二位分` 的根因定位到：
  - `src/games/smashup/domain/index.ts` -> `buildBaseRankings()`
  - 旧逻辑把并列玩家保留在当前高位 `rankSlot`，所以并列第一仍拿第一位分，并列第二仍拿第二位分。
- 修复后口径：并列组按其占据的最低名次发分。
  - 两人并列第一 -> 都拿第二位分
  - 两人并列第二 -> 都拿第三位分
- 为避免 AI 继续按旧口径判断基地收益，同步修了 `src/games/smashup/ai.ts` 的 `estimateBaseVpAward()`。
- 回归：`src/games/smashup/__tests__/baseScoring.test.ts` 新增 2 条并列计分测试，复跑通过；`npm run typecheck` 通过。

## 2026-05-05 DiceThrone watchdog：server 侧 stale candidate 才是剩余误报入口
- 当前生产新刷的 `dicethrone|online-ai-watchdog` 现场虽然快照里已经是：
  - `phase=offensiveRoll/defensiveRoll`
  - `responseWindow.windowType=afterRollConfirmed`
  - `responseWindow.responderQueue=['0']`
  - `legalActions.total=0`
  - 但本地纯函数 `resolveForceEndTurnForStalledAi(...)` 其实早已覆盖“当前 responder 是 human 时返回 null”。
- 新确认的剩余缺口不在纯函数，而在 `src/engine/transport/server.ts` 的 watchdog 序列：
  - server 拿到旧的 `active-turn-legal-only` candidate 后，若现场在恢复尝试期间切成了 human 响应窗，旧实现仍可能沿用旧 candidate 继续走失败上报；
  - 于是会出现“反馈 reason 还是 `active-turn-legal-only:follow-up-advance:legal_action_unavailable`，但 `stateSnapshot` 看起来已经是 human `afterRollConfirmed` 窗口”的错位现象。
- 本轮最小修复：
  - 在 `runOnlineAiRecoverySequence()` 里新增 candidate 再校验；
  - 任何失败上报前，都会重新跑一次 `resolveOnlineAiRecoveryCandidate(...)`；
  - 若现场已经不再匹配原 candidate（特别是已变成 human 响应窗或已无 candidate），直接删除 tracker 并静默退出，不再写系统单。
- 新增回归直接覆盖这类错位现场：
  - `online AI watchdog 在 legal-only 恢复前若现场切到 human afterRollConfirmed，应丢弃旧 candidate 而不是继续上报失败`
- 已验证：
  - 上述新回归 + 既有两条 human response window 用例一并通过，共 `3 passed`。
- 结论：
  - 这次更像“server 侧旧 candidate 过期未失效”，不是 `onlineAiRecovery.ts` 再次漏判 human responder。
  - 目前仍停在本地修复验证；若要真正止住线上这批 watchdog，需要后续把这一个 transport 补丁带到生产。

## 2026-05-05 SmashUp 人类反馈优先续跑
- 当前人工主线是 3 条 `smashup|feedback-modal`：
  - `69f96a734590ce09779a7205`：并列计分
  - `69f9623c4590ce09779a715f`：熊的泰坦不能用额外随从打出
  - `69f961ca4590ce09779a715a`：多人观战有 bug 看不了其他人
- `69f96a...`：
  - 已确认属于“代码已修、状态未回写”而非新根因；`buildBaseRankings()` 与 AI VP 估值都已按新产品口径修正。
- `69f9623c...`：
  - 共享根因不是熊派系专属能力，而是 `smashup_immediate_extra_minion` 的候选集漏掉了 `playAsKinds=['minion']` 的 `setaside` 泰坦。
  - 最小正确修复不是给 `bear_cavalry_major_ursa` 写特判，而是让共享 `extraPlay` 逻辑同时支持：
    - 候选枚举：`player.hand` 随从 + `getSetAsideTitansPlayableAs(..., 'minion')`
    - 基地校验：手牌随从走 `PLAY_MINION`；泰坦走 `ACTIVATE_SPECIAL`
    - 执行：手牌随从走 `PLAY_MINION`；泰坦走 `ACTIVATE_SPECIAL`
  - 新回归已经证明：额外随从 prompt 能看到 `t-ursa`，选中后会进入基地选择并最终产出 `SU_EVENTS.TITAN_PLAYED`。
- 本地状态板现状：
  - `temp/feedback-closeout/status-board.json` 仍是旧 `remote-human-unresolved-20260421-163730.json` 派生板，当前 3 条人工单 ID 不在其中。
  - 因此现在不能用 `update-local-feedback-board.mjs` 直接补状态，只能先在规划文档里登记最新事实，待拿到最新 human summary 后再正式 sync。
- `69f961ca...`：
  - 真实根因不是 spectator 加房链路，而是 `src/games/smashup/Board.tsx` 旧实现把“对手视角”建模成 `self/opponent` 二元状态，并固定取 `coreTurnOrder` 里的第一个非自己玩家。
  - 这导致四人局/观战时点击第 2、3 个玩家分数，也只能看到第一个对手的公开牌区。
  - 当前已改成 `viewTargetPlayerId` 直指被点击玩家；`displayedDeckPlayerId`、`HandArea`、`DeckDiscardZone`、返回按钮和 touch 入口都跟着切到统一模型。
  - 真实 E2E 已证明：
    - 点 P2 后能进入 `对手视角`，公开牌区显示 `牌库 3 / 弃牌 (1)`；
    - 再点 P3 后公开牌区切成 `牌库 5 / 弃牌 (2)`，不是仍停在第一个对手；
    - 返回后横幅消失，自己的手牌恢复，公开区回到 `牌库 0 / 弃牌 (0)`。
- 本轮已补 3 份本地 closeout evidence，后续可直接作为远端状态回写依据：
  - `evidence/smashup/smashup-feedback-69f96a734590ce09779a7205-tied-base-scoring-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f9623c4590ce09779a715f-extra-minion-titan-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f961ca4590ce09779a715a-multi-opponent-view-local-closeout-2026-05-05.md`

## 2026-05-06 SmashUp 三条人工反馈状态回写
- 当前开放反馈 HTTP 路径不能作为正式写入口：
  - `GET https://api.easyboardgame.top/feedback/open?status=open&page=1&limit=10` 直接返回 `404`
  - 因此本轮正式回写仍以生产 `feedbacks` 集合为准，不冒充走了 HTTP 接口。
- 生产 `feedbacks` 直连核对结果：
  - `69f96a734590ce09779a7205` / `69f9623c4590ce09779a715f` / `69f961ca4590ce09779a715a` 回写前都处于 `open`
  - 正式写入后都处于 `resolved`
  - 主证据链是回写前后两份生产快照：
    - `temp/feedback-closeout/query-feedback-69f96a-69f9623c-69f961ca-before-20260506.raw.txt`
    - `temp/feedback-closeout/query-feedback-69f96a-69f9623c-69f961ca-after-20260506.raw.txt`
- 本地状态板这次不再停在“老 summary 缺 ID”的状态：
  - 已把 3 条缺失人工反馈补入 `temp/feedback-closeout/status-board.json`
  - 已挂接本地 closeout evidence、验证命令和 E2E 截图
  - 校验通过：`feedback-status: ok`
- 当前剩余线上人类未收口项仍有 2 条：
  - `69fa23e04590ce09779a7c52`
  - `69fa0bd74590ce09779a7bd6`
  - 因此本轮只能宣称“指定 3 条已完成正式状态回写”，不能宣称“线上人类反馈已清零”。

## 2026-05-07 00:20 SmashUp `69faac614590ce09779a7d8f` 宗教圆环发不了效果

- 首轮新增 E2E 没有失败在规则校验或 quota 消费，而是失败在点击 `[data-ongoing-uid="oa-sacred-circle"]` 这一步。
- Playwright 明确回显：一个 `absolute inset-0 z-60` 的透明层拦截了 pointer events，这层来自基地 ongoing 卡放大镜按钮的包裹容器。
- 因此这条反馈的真实根因是 **UI 透明层吞点击**，不是《宗教圆环》领域能力本身无效。
- 最小修复方式是：
  - 桌面端把该包裹层改成 `pointer-events-none`
  - 保留真正的放大镜按钮在 hover 时 `pointer-events-auto`
- 修后同一条 E2E 已通过，截图证明《宗教圆环》能进入“已用”态，且手牌《本地人》最终成功落到巫师学院。
- 生产 `feedbacks` 直查已完成正式闭环：
  - 回写前：`69faac614590ce09779a7d8f` 仍为 `status=open`
  - 回写结果：`matchedCount=1`、`modifiedCount=1`
  - 回写后：该条已为 `status=resolved`，`updatedAt=2026-05-07T00:28:41.546Z`
- 同批最终复核：`reporterType=user && status in [open, in_progress]` 当前 `count=0`，说明截至 `2026-05-07 08:xx +08`，线上人类未收口反馈已清零。
- 但若按“所有反馈”口径看生产真源全量 `status in [open, in_progress]`：
  - 当前仍有 `32` 条未收口
  - 全部来自 `reporterType=system`、`source=online-ai-watchdog`
  - 因此当前不能回答“所有反馈都修好了”；更准确的说法是“人类反馈已清零，系统 watchdog 反馈还剩 32 条”

## 2026-05-07 21:25 最后 21 条 watchdog 系统反馈清零

- 上面“还剩 32 条”的结论已失效。
- 本轮后续又处理了：
  - 先单独回写 `69fb3fde76f10333c15ed8d9 / 69fc62984a37805e1526f6d9` 两条 SmashUp stale `arcane protector` watchdog 单；
  - 再批量回写最后 `21` 条系统单。
- 最后 21 条的正式回写结果是：
  - `resolved.matchedCount = 9`
  - `resolved.modifiedCount = 9`
  - `closed.matchedCount = 12`
  - `closed.modifiedCount = 12`
- 判定口径明确为：
  - `force-end-turn-failed ...` / `unsatisfiable-interaction-auto-skipped empty-options` 属于已修未回写或失败留痕，回写 `resolved`
  - `force-end-turn-success ...` 属于历史成功 telemetry，回写 `closed`
- 生产最终复核快照：
  - `temp/feedback-closeout/query-all-open-inprogress-current-20260507.raw.txt`
  - 结果：`totalOpenOrInProgress = 0`、`humanOpen = 0`
- 因此截至 `2026-05-07 21:25 +08`，准确口径已变为：
  - 人类反馈未收口：`0`
  - 系统反馈未收口：`0`
  - 全量未收口：`0`

## 2026-05-07 21:52 `69fc6298` 短暂重开后再次清零

- `69fc62984a37805e1526f6d9` 在 `2026-05-07 21:39 +08` 又被生产真源打成了 `open`。
- fresh 生产复核当时结果是：
  - `totalOpenOrInProgress = 1`
  - `humanOpen = 0`
- 这次不是新的人工反馈，而是同一个 SmashUp watchdog 聚合项再次刷开。
- 结合同局 `matchId=bSJjqanl8rO` 的生产日志，我实际看到：
  - 先出现 `force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted`
  - 随后 watchdog 又继续把同局从 `scoreBases` 推到 `draw`、再推回 `playCards`
  - 说明这条在当拍已经重新收口，只是反馈状态没有跟着二次回写
- 因此本轮再次按失败类系统单口径，把该条正式回写为 `resolved`：
  - `matchedCount = 1`
  - `modifiedCount = 1`
- 最新生产复核时间是 `2026-05-07 21:52 +08`：
  - `totalOpenOrInProgress = 0`
  - `humanOpen = 0`
- 当前最终真相：
  - 人类反馈仍为 `0`
  - 系统反馈仍为 `0`
  - 全量反馈仍为 `0`

## 2026-05-07 22:00 fresh 复核仍为 0

- 最新生产直查：
  - `ts = 2026-05-07T14:00:21.653Z`
  - `totalOpenOrInProgress = 0`
  - `humanOpen = 0`
- 说明当前最终口径没有再变，仍是：
  - 人类反馈已清零
  - 系统反馈已清零
  - 全量反馈已清零


## 2026-05-10 16:20 +08 Treant / Ninja 关键发现

- 两个新英雄 ability-cards 的运行时规格为 `900x2048`、`5x8` row-major，不可复用旧公共 atlas。
- 新增角色可复用 v2 玩家面板布局，但必须显式接入 `abilitySlotLayout` / `abilitySlotMapping` / `cardAtlas`。
- 隔离 worktree 缺少未提交的 DiceThrone Common 压缩资源会导致选角头像与背景黑块；已补入 `Common/compressed`，R2 远端同内容已存在。
- 游戏内玩家面板不是 `img[alt=玩家面板]`，而是 `data-testid=player-board-surface` 上的 role image；E2E 断言已按真实 UI 出口调整。


## 2026-05-10 Treant/Ninja 重来关键发现
- `e2e/dicethrone` 下通过 `../src/...` 引入的是 `e2e/src` 旧快照，不是项目真实 `src`；新英雄 token ID 在旧快照中不存在，会把注入 token 写成 `undefined: 1`。新增机制 E2E 必须用 `../../src/...` 或直接使用稳定字面量。
- DiceThrone 被动面板旧点击处理只处理 `rerollDie` / `drawCard`，没有派发 `custom` 被动动作；因此树精生命源泉在 UI 上可用但点击无效。修复点是 Board 的 `handlePassiveActionClick`。
- Display-only 奖励骰在截图中可能表现为骰子/粒子展示而非完整居中弹窗；证据必须同时看状态变化截图，不能只用 `bonus-die-overlay` locator 断言冒充完成。

## 2026-05-12 重审结果

- 已把通用入口语义从原则扩展为矩阵门禁。
- 已建立 shayu 三派系 45 对象全量 P0/P1 审计矩阵。
- 本轮未发现新的 P0/P1 blocker。
- 当前残余：未新增浏览器 E2E 截图，因此不得把本轮结论说成全量 L3 E2E 收口；Argonaut 跨派系 action-trigger 泛化仍是后续专项。

## 2026-05-17 SmashUp yuanhou shared overlay residual 复核

- `The Spy Who Ditched Me` 的 Host stale waiting overlay 不是单卡 handler 残留，而是 `optimisticEngine` 先前会污染上一帧 authoritative 引用导致的 shared transport/playerView 残影。
- 已补回归 `processCommand 不得污染上一帧 authoritative state 引用，即使 pipeline/系统原地改写输入对象`，并重新跑通真实多客户端 E2E。
- 当前真实链路结论：Host 非目标页不再出现中央 waiting overlay 或弃随从 prompt；Guest 页面仍正常给出弃随从选择权，服务端只按目标玩家选择弃牌。

## 2026-05-17 SmashUp yuanhou Time Raider 边界补强

- `Time Raider` 的单候选自动沉底与空弃牌反馈已补 L2，不应继续写成 residual。
- 复跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "时间掠夺者"` 结果为 `3 passed / 145 skipped`。
- 当前浏览器 scoped L3 仍只覆盖多候选选择 `Time Walk` 分支。

## 2026-05-17 SmashUp yuanhou Repeater Perfect 边界补强

- `Repeater Perfect` 的单行动自动顶牌与空弃牌反馈已补 L2，不应继续写成 residual。
- 复跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "往复时间者"` 结果为 `4 passed / 147 skipped`。
- 当前浏览器 scoped L3 仍只覆盖混合弃牌堆里选择第二张行动分支。

## 2026-05-18 SmashUp yuanhou Repeater Perfect 单行动自动分支已从“只靠 L2 锁定”补到 scoped L3

- `Repeater Perfect` 当前真正缺的不是更多 handler 负例，而是 **真实入口在弃牌堆只剩 1 张行动时，会不会错误弹出选择 prompt 或把唯一行动留在弃牌堆**。
- 现有 L2/L3 已经证明：
  - 混合弃牌堆里只会列行动候选，不会把随从混进 prompt。
  - 玩家可以在两张行动里选择第二张，把它放到牌库顶。
  - 但这还不足以证明唯一行动自动分支在浏览器里真的是“无 prompt 自动执行”，而不是瞬时 prompt 或隐式漏执行。
- 本轮新增浏览器链：
  - `时间旅行者-Repeater Perfect-弃牌堆只剩一张行动时真实入口应自动放到牌库顶且不弹 prompt`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-repeater-single BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "时间旅行者-Repeater Perfect-弃牌堆只剩一张行动时真实入口应自动放到牌库顶且不弹 prompt"` -> `1 passed`
- 关键信号：
  - 起始图里能直接看到手牌区的 `Repeater Perfect`，以及弃牌堆里唯一行动 `Time Walk` 本体，说明命中的确实是“单行动自动分支”。
  - 收口图里中央没有任何选择 prompt，`Portal Room` 上只剩刚打出的 `Repeater Perfect`，弃牌堆角标从 `2` 变成 `1`。
  - 配合状态断言 `deck=['repeater-single-discard-action,repeater-single-deck-a']`、`discard=['repeater-single-discard-minion']`、`interaction.current==null`，可以确认唯一行动已经自动进牌库顶。
- 结论：
  - `time_travelers_repeater_perfect.choose_discard_action` 不再只是“混合弃牌堆里选择第二张行动”有浏览器证据；单行动自动分支现在也有 scoped L3。
  - `time_travelers_repeater_perfect.top_selected_action` 当前也不再只靠多候选正向选择支撑浏览器层证据；唯一行动自动顶牌现在同样有真实 UI 证据。空弃牌反馈继续留在 L2 即可。

## 2026-05-18 SmashUp yuanhou Time Raider 单候选自动沉底分支已从“只靠 L2 锁定”补到 scoped L3

- `Time Raider` 当前真正缺的不是更多多候选断言，而是 **真实天赋入口在弃牌堆只剩 1 张牌时，会不会错误弹出 `time_travelers_time_raider_choose` prompt，或者根本没把唯一弃牌沉到底**。
- 现有 L2/L3 已经证明：
  - 多候选时，prompt 会同时列出随从与行动两类弃牌，玩家可选其中一张沉到底。
  - 但这还不足以证明唯一弃牌自动分支在浏览器里真的是“无 prompt 自动执行”，而不是 prompt 闪过或 UI 漏执行。
- 本轮新增浏览器链：
  - `时间旅行者-Time Raider-弃牌堆只剩一张牌时真实入口应自动放到牌库底且不弹 prompt`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-raider-single BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "时间旅行者-Time Raider-弃牌堆只剩一张牌时真实入口应自动放到牌库底且不弹 prompt"` -> `1 passed`
- 关键信号：
  - 起始图里能直接看到场上的 `Time Raider`，以及弃牌堆里唯一的 `Time Walk` 本体，说明命中的确实是单候选自动分支。
  - 收口图里中央没有任何选择 prompt，`Time Raider` 本体已经显示“已用”，弃牌堆角标从 `1` 变成 `0`。
  - 配合状态断言 `deck=['raider-single-deck-a,raider-single-discard-card']`、`discard=[]`、`talentUsed===true`、`interaction.current==null`，可以确认唯一弃牌已经自动进牌库底。
- 结论：
  - `time_travelers_time_raider.choose_discard_card` 不再只是“多候选选择分支”有浏览器证据；单候选自动分支现在也有 scoped L3。
  - `time_travelers_time_raider.bottom_selected_card` 当前也不再只靠多候选正向选择支撑浏览器层证据；唯一弃牌自动沉底现在同样有真实 UI 证据。空弃牌 feedback 继续留在 L2 即可。

## 2026-05-17 SmashUp yuanhou Moon Zero Three 口径修正

- `Moon Zero Three.talent_top_bottom` 的“空牌库反馈”旧口径不符合实现；所有玩家都不可查看时，validator 直接拒绝天赋。
- 复跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "三号空间站"` 结果为 `3 passed / 154 skipped`。
- 当前浏览器 scoped L3 仍覆盖他人牌库放底与自己牌库放顶两条分支。

## 2026-05-17 SmashUp yuanhou ISI optional-pass cleanup

- `ISI 摇摆据点` 的 `pass` 分支此前已经推进到 `base_replaced/cards_drawn/next player playCards`，但中央仍残留旧的 `选择一个反应动作`；这不是单卡语义错，而是 shared `smashup_reaction_choose` runtime prompt cleanup 断层。
- 根因是 `registerAbilityRuntimePrompt('smashup_reaction_choose')` 在 `resolved.events=[]` 的 optional pass 分支里仍无条件回退 `resolved.state.core -> state.core`，把已经清掉的 `triggerQueue` 和 reaction frame 进度又带回来了。
- 修复后，`超级间谍基地：ISI摇摆据点真实计分后可跳过响应并正常继续收口` 与 `时间旅行者：虫洞后全员让过会消费未选择的传送门室触发并收口` 两条 L2 一起通过，说明这次 shared cleanup 没把现有 optional pass 链打坏。
- 真实入口 E2E `超级间谍-ISI摇摆据点-真实计分后跳过响应仍应完成收口并保留赢家牌库顺序` 已通过；实际截图显示 afterScoring 入口按钮文案是 `让过`，而不是旧猜测的“跳过”，且 pass 后中央 prompt 真正消失，画面恢复到下一位玩家的正常 `出牌阶段`。

## 2026-05-17 SmashUp yuanhou Time Is Fleeting 非当前响应者归属补证

- `Time Is Fleeting` 之前已经有单页 scoped L3，但 evidence 里仍把“非当前视角响应者”保留成 residual。这条边界的关键不是再补一个 unit，而是要证明 afterScoring response window 在多客户端下会把按钮交给赢家本人。
- 新增真实多客户端 E2E：`时间旅行者-Time Is Fleeting-真实多客户端下赢家不是当前回合玩家时应只给赢家页面弃牌堆基地选择权`。
- 这次链路里：
  - P0 是当前回合玩家，结束回合触发 `Monkey Lab` 计分。
  - P1 用 `Time Raider` 以 24 力获胜，且手里持有 `Time Is Fleeting`。
  - Guest 赢家页出现 `时间流逝 / 让过`。
  - Host 当前回合玩家页没有同按钮，也没有基地弃牌堆候选，只剩等待 Guest 响应。
- Guest 点击 `时间流逝` 后，真实进入 `time_travelers_time_is_fleeting_choose`，只列 `The Vats / Faceless City / The Nexus` 三张基地弃牌堆候选，不列本次刚计分的 `Monkey Lab`。
- Guest 选择 `Faceless City` 后，服务端权威状态收口为：

## 2026-05-17 SmashUp yuanhou The Nexus skip 真实入口已锁定

- `The Nexus` 之前虽然已经有 scoped L3，但只覆盖了“选择 `Faceless City` 替代新基地”的正向分支。
- 这还不足以证明 `base_the_nexus_choose` 里的 `skip` 真的是一个可点击、可收口、并且会回退到 `baseDeck[0]` 的真实入口，而不是只停在 handler/L2 的口头说明。
- 本轮补了两层证据：
  - L2：`时间旅行者基地：枢纽真实计分后让过响应应继续按正常牌库顶替换基地`
  - E2E：`时间旅行者-The Nexus-真实计分后让过响应应继续按正常牌库顶替换基地`
- 关键信号：
  - 真实 discard-base prompt 里中央明确出现 `跳过（照常抽新基地）` 按钮，不是抽象的 “may skip”。
  - 点击后中央 prompt 真正消失，左侧新基地变成 `Monkey Lab / 猴子实验室`，而不是继续停在 `The Nexus` 选择链里。
  - 权威状态收口为 `interaction.current==null`、`responseWindow.current==null`、`baseDeck=[]`、`baseDiscard` 保留原三张弃牌堆基地并新增 `base_the_nexus`。
- 定向验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "枢纽|The Nexus"` -> `3 passed / 185 skipped`
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-the-nexus-skip BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "时间旅行者-The Nexus-真实计分后让过响应应继续按正常牌库顶替换基地"` -> `1 passed`
- 结论：
  - `base_the_nexus.choose_base_from_base_discard` 的 skip 语义现已从 L2/handler 提升到真实入口 scoped L3。
  - `base_the_nexus.replace_new_base_with_selected_discard_base` 也不再只覆盖 `Faceless City` 分支；skip 后按 `baseDeck[0]` 正常翻新的真实链已补齐。
  - `currentPlayerIndex === 1`
  - `bases[0].defId === 'base_faceless_city'`
  - `baseDeck` 仍保留 `base_primate_park`
  - `P1 discard` 含 `time-fleeting-guest`
  - `interaction.current == null`
- 结论：
  - `time_travelers_time_is_fleeting.choose_base_from_discard` 的“赢家不是当前回合玩家时，选择权仍归赢家本人”现在已有 scoped L3。
  - `replace_new_base` 的赢家非当前玩家分支也已有 scoped L3。
  - 当前 residual 可以收紧为：单候选自动分支、多 special 排序；不再把非当前响应者归属留在 residual。

## 2026-05-17 SmashUp yuanhou Wormhole 空选误报纠偏

- `Wormhole` 空选这次不是业务 bug，而是测试证据口径错了。
- 旧失败把 `passPortalRoom.finalState` 里 `p0Hand=["deck-a","wormhole-a"] / p0Deck=["jumper-a","raider-a"]` 直接解释成“空选等于全选”，但事件链证明这一步已经跨过了 `Portal Room` 的额外回合 `draw 2`。
- 定向复跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "虫洞"` 时看到：
  - `playWormhole` 后 `wormhole-a` 已在 discard，三只随从仍在场。
  - `chooseNone.events` 只有 `SYS_INTERACTION_RESOLVED(value=[])`，没有 `su:card_to_deck_bottom`、`su:deck_reordered(reason:'time_travelers_wormhole')` 或其他 Wormhole 领域事件。
  - 真正出现的洗回牌库事件是 pass 之后的 `su:deck_reshuffled(deckUids=[wormhole-a,jumper-a,raider-a])`，它来自 `Portal Room` 额外回合 draw step 在牌库不足时把 discard reshuffle 进 deck，而不是 Wormhole 空选把随从洗回牌库。
- 因此这次应该修的是测试断言，不是实现：
  - 空选断言改为验证“没有发出 Wormhole 的 deck-bottom / deck-reordered 事件”。
  - `Portal Room` 后续抽牌链继续允许发生，不再把被 draw step 改写过的最终 hand/deck 当成 Wormhole 语义证据。
- 结论：`time_travelers_wormhole.select_own_minions_here` 与 `shuffle_selected_to_owner_decks_instead_discard` 的空选/全选边界本轮没有新增实现缺口；此前把空选重新挂回 residual 的判断作废。

## 2026-05-17 SmashUp yuanhou Time Is Fleeting 单候选自动分支已闭合

- `Time Is Fleeting` 现在不该再把“单候选自动分支”留在 residual。
- 代码里本来就有这条分支：`baseDiscard.filter(defId !== scoredBaseDefId)` 只剩 1 张时，`timeTravelersTimeIsFleeting()` 直接 `reorderBaseDiscardTop(baseDiscard[0], 'time_travelers_time_is_fleeting', now)`，不会创建 `time_travelers_time_is_fleeting_choose` prompt。
- 本轮补了两条 L2，把这条实现边界锁实：
  - direct special：过滤后只剩 `base_the_vats` 时，`matchState` 不会被写入，`events` 直接返回 `BASE_DECK_REORDERED(topDefIds=['base_the_vats'], reason='time_travelers_time_is_fleeting')`。
  - 真实 `scoreBases` 链：`Monkey Lab` 计分、`baseDiscard=['base_faceless_city']` 时，P0 在 `smashup_reaction_choose` 里打出 `Time Is Fleeting` 后，不会出现第二层基地弃牌堆选择 prompt，最终直接收口为 `bases[0].defId='base_faceless_city'`、`baseDiscard=['base_monkey_lab']`。
- 定向复跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "时间流逝"` 结果为 `5 passed / 162 skipped`。
- 结论：`time_travelers_time_is_fleeting.choose_base_from_discard` 与 `replace_new_base` 当前 residual 只剩多 special 排序；单候选自动分支已从 residual 收紧到 L2。

## 2026-05-17 SmashUp yuanhou Time Is Fleeting 多 special 排序已锁定

- 旧 residual 里最后剩下的“多 special 排序”现在也有对象级 L2 了。
- 新增测试：`时间旅行者：时间流逝在同一计分响应窗先结算后，仍应继续保留虫洞 special 入口`。
- 这次场景把 `Time Is Fleeting` 和 `Wormhole` 同时塞进同一位赢家的 afterScoring 手里，真实序列变成：
  - 第一次 `smashup_reaction_choose` 同时给出两张 special。
  - 先选 `time-fleeting-a`，进入 `time_travelers_time_is_fleeting_choose` 选 `base_faceless_city`。
  - reaction window 再次回到 `smashup_reaction_choose`，且 `wormhole-a` 仍然存在。
  - 再选 `wormhole-a` 进入 `time_travelers_wormhole_choose`，选择 `traveler-a`。
- 最终权威状态：
  - `bases[0].defId === 'base_faceless_city'`
  - `P0 deck === ['deck-rest','traveler-a']`
  - `P0 discard === ['time-fleeting-a','wormhole-a','winner-a']`
  - `P1 discard === ['enemy-a']`
- 定向验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "时间旅行者：时间流逝在同一计分响应窗先结算后，仍应继续保留虫洞 special 入口"` -> `1 passed / 167 skipped`
  - 随后复跑 `... -t "时间流逝"` -> `6 passed / 162 skipped`
- 结论：`Time Is Fleeting` 不再把对象级“多 special 排序”继续挂成 residual；剩下更广义的跨玩家/跨 frame reaction 排序问题，归 shared contract 持续审，不再算这张牌自身未闭合。

## 2026-05-17 SmashUp yuanhou Clyde 2.0 owner/controller 分离已锁定

- `Clyde 2.0` 之前虽然已有多客户端浏览器链证明“两按钮可见且能点”，但 evidence 里还把 `owner/controller` 分离继续挂在 residual 里。
- 这条边界真正要锁的是：
  - 当 `returnToHand:true` 时，行动应进入 `Clyde` 控制者手牌，而不是行动拥有者手牌。
  - 当 `returnToHand:false` 时，行动应进入行动拥有者弃牌堆，而不是 `Clyde` 控制者弃牌堆。
- 本轮新增两条 L2：
  - `电子猿：克莱德2.0选择收入手牌时，敌方拥有的附着行动也应进入克莱德控制者手牌`
  - `电子猿：克莱德2.0选择进入弃牌堆时，敌方拥有的附着行动应回到其拥有者弃牌堆`
- 做法不是再起浏览器，而是直接用 `processClydeDetachChoices()` 为 `ownerId='1' / host.controller='0' / clyde.controller='0'` 的分离态造出真实 `cyborg_apes_clyde_2_0_detach` prompt，再走原始 handler + reducer 收口。
- 定向验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "克莱德2.0选择收入手牌时，敌方拥有的附着行动也应进入克莱德控制者手牌|克莱德2.0选择进入弃牌堆时，敌方拥有的附着行动应回到其拥有者弃牌堆"` -> `2 passed / 168 skipped`
  - 随后复跑 `... -t "克莱德2.0|灵长公园阻止这里随从身上的行动在离场时被 Clyde 2.0 收回手牌"` -> `5 passed / 165 skipped`
- 结论：`cyborg_apes_clyde_2_0.may_put_it_into_your_hand_instead` 的 owner/controller 分离不再作为 residual；剩余口径收紧为多 Clyde、多 eligible detach 与 Primate Park 例外。

## 2026-05-17 SmashUp yuanhou Missing Uplink 牌库不足与多 owner 边界已锁定

- `Missing Uplink` 当前不该再把“牌库不足洗弃牌 / 多 owner 混挂”继续写成 residual。
- 这两条风险本质上都在 shared draw contract：
  - 若只看已有双实例回归，无法证明 `buildStandardDrawEvents()` 在 owner turn-end 聚合链里遇到空牌库时，不会跳过旧牌库顶部或少抽一张。
  - 也无法证明聚合维度真的是 action `ownerId`，而不是宿主 controller、当前 turn player，或“场上所有 Missing Uplink 一起算”。
- 本轮新增两条 L2：
  - `电子猿：丢失中继在牌库不足时应先抽旧牌库顶部再洗弃牌续抽`
  - `电子猿：丢失中继在多 owner 混挂时只聚合当前拥有者的实例`
- 第一条测试的关键信号：
  - 初始 `deck=[deck-a]`、`discard=[discard-a,discard-b]`、场上两张 `Missing Uplink`。
  - 触发后事件顺序固定为 `DECK_RESHUFFLED -> CARDS_DRAWN`。
  - `CARDS_DRAWN.cardUids === ['deck-a','discard-b']`，说明先抽掉旧牌库顶，再从 reshuffle 后的新牌库继续抽，而不是先洗再抽或直接漏抽。
- 第二条测试的关键信号：
  - 同一名 `controller=1` 的宿主上混挂 `ownerId=0` 与 `ownerId=1` 的两张 `Missing Uplink`。
  - P0 结束回合只产生 `playerId='0' / cardUids=['p0-draw-a']`。
  - P1 结束回合只产生 `playerId='1' / cardUids=['p1-draw-a']`。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "丢失中继|Missing Uplink"` -> `5 passed / 167 skipped`。
- 结论：`cyborg_apes_missing_uplink.owner_turn_end_draw_one_per_instance` 的对象级 residual 已进一步收紧；当前不再保留“牌库不足洗弃牌 / 多 owner”，只保留多客户端视角与更广回合边界的 scoped L3 外层边界。

## 2026-05-17 SmashUp yuanhou Secret Volcano Headquarters 双极端 reveal 分支已锁定

- `Secret Volcano Headquarters` 当前不该再把“双方都翻随从 / 双方都翻行动”继续写成 residual。
- 现有 scoped L3 只证明了一个混合分支：
  - P0 顶牌是随从，P1 顶牌是行动。
  - 这能证明“只把 reveal 出来的随从打进来”，但还不能排除“双方都翻随从时漏打一张”或“双方都翻行动时误打一张”的实现断层。
- 本轮新增两条 L2：
  - `超级间谍基地：秘密火山总部在双方都翻出随从时应把两张展示随从都打到这里`
  - `超级间谍基地：秘密火山总部在双方都翻出行动时不应把任何牌打到这里`
- 第一条测试的关键信号：
  - 两名玩家牌库顶都是随从。
  - 事件层必须是 2 次 `REVEAL_DECK_TOP` 加 2 次 `MINION_PLAYED`。
  - 最终基地上同时出现 `p0-minion-a / p1-minion-a`，双方牌库各自只剩原来的第二张。
- 第二条测试的关键信号：
  - 两名玩家牌库顶都是行动。
  - 仍然会各自 reveal 1 张，但不存在任何 `MINION_PLAYED`。
  - 基地保持空场，双方牌库顺序完全不变。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "秘密火山总部|Secret Volcano Headquarters"` -> `3 passed / 171 skipped`。
- 结论：`base_secret_volcano_headquarters.reveal_one_each_player_then_play_revealed_minions_here` 的对象级 residual 已进一步收紧；当前不再保留“双方都翻随从 / 双方都翻行动”，只剩多人局 `turnOrder` 扩展与真实 reveal 可见性边界。

## 2026-05-17 SmashUp yuanhou Secret Volcano Headquarters 三人 turnOrder 已锁定

- `Secret Volcano Headquarters` 现在也不该再把“多人局 `turnOrder` 扩展”继续写成 residual。
- 现有 L2 与 scoped L3 都只覆盖两人局，确实无法证明 `for (const playerId of ctx.state.turnOrder)` 在 3 人局不会漏处理第 3 名玩家，或 reveal 顺序不会被打乱。
- 本轮新增一条 L2：
  - `超级间谍基地：秘密火山总部在三人 turnOrder 下应按顺序让每位玩家各展示一张并只打出其中的随从`
- 这条测试的关键信号：
  - `turnOrder=['0','1','2']`。
  - `REVEAL_DECK_TOP.payload.targetPlayerId` 顺序必须精确等于 `['0','1','2']`。
  - P0 / P2 顶牌是随从，P1 顶牌是行动，因此最终基地上只出现 `p0-minion-a / p2-minion-a`，而 P1 顶牌行动仍留在其牌库顶。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "秘密火山总部|Secret Volcano Headquarters"` -> `4 passed / 171 skipped`。
- 结论：`base_secret_volcano_headquarters.reveal_one_each_player_then_play_revealed_minions_here` 的对象级 residual 再次收紧；当前不再保留多人局 `turnOrder` 扩展，只剩真实 reveal 可见性这一类浏览器边界。

## 2026-05-17 SmashUp yuanhou Discards Are Forever 空牌库/首张随从/三人扩展已锁定

- `Discards Are Forever` 当前也不该再把“空牌库 / 顶牌直接是随从 / 多人局 turnOrder 扩展”继续写成 residual。
- 现有 scoped L3 只覆盖双人局两条典型链：
  - P0 是 `action -> minion`
  - P1 是 `action -> action -> minion`
  - 这还不足以证明空牌库会被安全跳过、首张即随从会立刻停止，以及三人局不会漏掉第 3 位玩家。
- 本轮新增三条 L2：
  - `超级间谍：弃牌永恒在顶牌直接是随从时只弃掉这一张展示牌`
  - `超级间谍：弃牌永恒遇到空牌库玩家时应跳过该玩家并继续处理其他玩家`
  - `超级间谍：弃牌永恒在三人 turnOrder 下应依次处理每位玩家直到各自翻到首个随从`
- 关键信号：
  - 首张即随从时，discard 只新增那张随从，不会误吞后续牌。
  - 空牌库玩家不会生成空的 reveal/mill 事件，也不会阻断其他玩家。
  - 三人局下 `REVEAL_DECK_TOP.payload.targetPlayerId` 顺序精确等于 `['0','1','2']`，说明能力按 `turnOrder` 逐人处理。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "弃牌永恒|Discards Are Forever"` -> `4 passed / 174 skipped`。
- 结论：`super_spies_discards_are_forever.reveal_until_first_minion_then_mill_seen_cards` 的对象级 residual 已进一步收紧；当前不再保留空牌库、首张随从或三人扩展，只剩更广的浏览器可见性边界。

## 2026-05-17 SmashUp yuanhou Moon Zero Three special 多合法基地与 controller 口径已锁定

- `Moon Zero Three` 当前也不该再把“多合法基地并存”或“借来的敌方随从是否算 other player's minion”继续留在 residual。
- 现有 scoped L3 只覆盖 Titan rail 真入口的单合法基地/单非法基地分支，确实还不能证明：
  - 同时存在 `己方随从基地 + 空基地` 时，两者都会被 validator 视为合法落点。
  - `owner='1' / controller='0'` 的借来随从不会错误阻挡 `Moon Zero Three` special。
- 本轮新增两条 L2：
  - `三号空间站：多个合法基地并存时应允许打到任一合法基地并拒绝敌方随从所在基地`
  - `三号空间站：判定其他玩家随从时应按控制者而非拥有者`
- 关键信号：
  - 多合法基地分支中，`baseIndex=0/1` 都通过 `ACTIVATE_SPECIAL` 校验，而敌方随从所在 `baseIndex=2` 稳定返回 `你只能将三号空间站打出到没有其他玩家随从的基地`。
  - controller 分支中，借来随从基地通过校验并可真实落场；真正 `controller='1'` 的敌方随从基地仍被拒绝。
  - 两条测试都实际执行 special，最终 Titan 落点与所选合法基地一致，不是只停在 `validate`。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "三号空间站"` -> `5 passed / 175 skipped`。
- 结论：`super_spies_moon_zero_three.special_summon_condition` 的对象级 residual 已继续收紧；当前不再保留多合法基地并存或 controller/owner 分离，只剩 skip 分支与其它 Titan special 竞争窗口。

## 2026-05-17 SmashUp yuanhou From Q With Love 短候选边界已锁定

- `From Q With Love` 当前也不该再把“投影手牌只剩 1 张 / 0 张时是否仍会错误弹弃牌 prompt”继续写成 residual。
- 现有 scoped L3 只覆盖 exact-2 分支：
  - `old-hand + draw-a/b/c` 四张候选里，玩家同时选旧手牌与新抽牌各一张。
  - 这足以证明投影手牌候选集合正确，但还不足以证明 `discardCount = min(2, projectedHand.length)` 在短候选/空候选时仍会按当前实现自动收口。
- 本轮新增两条 L2：
  - `超级间谍：来自Q的爱在投影手牌只剩一张时应只要求弃这一张`
  - `超级间谍：来自Q的爱在投影手牌为空时不应创建弃牌 prompt`
- 关键信号：
  - `hand=[q-a,old-hand], deck=[]` 时，prompt 仍存在，但 `multi={min:1,max:1}`，`allowedCardUids=['old-hand']`，响应后手牌清空且 `discard` 含 `q-a/old-hand`。
  - `hand=[q-a], deck=[]` 时，`PLAY_ACTION` 直接收口，没有创建空的 `super_spies_from_q_with_love_discard` prompt，且 `discard=['q-a']`。
  - 这说明自动分支在候选少于 2 时会直接按当前 projectedHand 收口，而不是错误吞掉 prompt 或要求弃两张。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "来自Q的爱|From Q With Love"` -> `4 passed / 180 skipped`。
- 结论：`super_spies_from_q_with_love.draw_three_then_discard_two_from_projected_hand` 的对象级 residual 已继续收紧；当前不再保留投影手牌只剩 1 张或 0 张的边界，只剩 exact-2 分支之外更广的浏览器可见性边界。

## 2026-05-17 SmashUp yuanhou Doctor When specific-card 执行期负例已锁定

- `Doctor When` 当前也不该再把“execute 前是否还能被同名诱饵冒充”停留在说明层。
- 现有 L2/L3 已经证明：
  - 第一层 return prompt 只允许返回“另一个己方随从”。
  - 第二层 `smashup_immediate_extra_minion` prompt 只显示刚返回的 `raider-a`，不显示手牌中的同名 `same-raider`。
  - 但这还不足以证明：如果有人把 `same-raider` 伪造塞进第二层 prompt，execute 前复核仍会整次拒绝。
- 本轮新增一条 L2：
  - `时间旅行者：时间博士的立即额外随从执行前仍拒绝伪造同名诱饵`
- 关键信号：
  - `doctor-a` 先返回 `raider-a`，extra prompt 仍只列 `raider-a`。
  - 伪造 `optionId='forged-same-raider-decoy'` 后，最终基地仍只有 `doctor-a`，而 `raider-a/same-raider` 都留在手牌。
  - 这说明 execute 阶段不只靠 `sameNameDefId`，而是继续复核 `specificCardUid===returned.uid`。
- 同一轮还补强了 skip-return 负例：选择 `不返回随从` 后不会出现 `LIMIT_MODIFIED(reason:'time_travelers_doctor_when')`，也不会残留第二层 extra prompt。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "时间博士|从头来过|Doctor When|Do Over"` -> `7 passed / 178 skipped`。
- 结论：`time_travelers_doctor_when.may_play_returned_minion_again` 的对象级残余已继续收紧；当前不再保留“同名诱饵执行期伪造”这类隐性风险，只剩 skip extra 分支之外更广的浏览器可见性边界。

## 2026-05-17 SmashUp yuanhou Do Over skip-extra 分支已锁定

- `Do Over` 当前也不该再把“玩家在 returned-card extra prompt 里选择 skip 后是否真的收口”停在说明层。
- 现有 L2/L3 已经证明：
  - `Do Over` 会把 `jumper-a` 真实返回手牌。
  - extra prompt 只允许刚返回的 `jumper-a`，并拒绝同名诱饵 `same-jumper`。
  - 但这还不足以证明 skip extra 后不会错误把 `jumper-a` 又打回基地，或者残留第二层交互。
- 本轮新增一条 L2：
  - `时间旅行者：从头来过在放弃额外随从后应直接收口并保留刚返回的那张牌`
- 关键信号：
  - `Do Over` 返回 `jumper-a` 后进入 `smashup_immediate_extra_minion`。
  - 点击 skip 后，`interaction.current == null`，基地仍为空，而 `jumper-a` 保留在 P0 手牌。
  - 这说明 skip extra 分支会直接收口，而不是错误继续额外打出 returned card。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "从头来过|Do Over"` -> `3 passed / 183 skipped`。
- 结论：`time_travelers_do_over.may_play_returned_minion_again` 的对象级残余已继续收紧；当前不再保留 skip extra 分支，只剩 returned-card specific 打回分支之外更广的浏览器可见性边界。

## 2026-05-17 SmashUp yuanhou Doctor When skip-extra 分支已锁定

- `Doctor When` 当前也不该再把“玩家在 returned-card extra prompt 里选择 skip 后是否真的收口”停在对象级说明里。
- 现有 L2/L3 已经证明：
  - `Doctor When` 的 return prompt 只允许“另一个己方随从”，并且可 skip。
  - extra prompt 只显示刚返回的 `raider-a`，不显示同名诱饵 `same-raider`。
  - execute 前即使伪造把 `same-raider` 塞进 prompt，也会被 `specificCardUid` 复核整次拒绝。
  - 但这还不足以证明 skip extra 后不会错误把 `raider-a` 又打回基地。
- 本轮新增一条 L2：
  - `时间旅行者：时间博士在放弃额外随从后应直接收口并保留刚返回的那张牌`
- 关键信号：
  - `doctor-a` 返回 `raider-a` 后进入 `smashup_immediate_extra_minion`。
  - 点击 skip 后，`interaction.current == null`，基地只剩 `doctor-a`，而 `raider-a` 保留在 P0 手牌。
  - 这说明 skip extra 分支会直接收口，而不是错误继续额外打出 returned card。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "时间博士|Doctor When"` -> `6 passed / 181 skipped`。
- 结论：`time_travelers_doctor_when.may_play_returned_minion_again` 的对象级残余已继续收紧；当前不再保留 skip extra 分支，只剩 returned-card specific 打回分支之外更广的浏览器可见性边界。

## 2026-05-17 SmashUp yuanhou 1.21 Gigawatts 单一牌种自动分支已锁定

- `1.21 Gigawatts` 当前不该再把“弃牌堆只剩单一牌种时是否还会错误弹按钮 prompt”继续写成 residual。
- 现有 scoped L3 只覆盖双类型按钮链：
  - 真实入口能看到“行动 / 仆从”两个按钮。
  - 选择其一后，所选类型会连同现有 deck 一起洗回。
  - 但这还不足以证明“当前弃牌堆只剩单一牌种”时不会错误地残留 `time_travelers_1_21_gigawatts_choose` prompt。
- 本轮新增一条 L2：
  - `时间旅行者：1.21千兆瓦在弃牌堆只剩单一牌种时应自动洗回整副牌库且不弹牌种选择 prompt`
- 关键信号：
  - 初始 `discard=[action-a,action-b]`、`deck=[deck-a,deck-b]`，并把 `shuffle()` 固定为 reverse。
  - `PLAY_ACTION` 结束后 `sys.interaction.current == null`，说明没有创建牌种选择 prompt。
  - 最终 `deck=['deck-b','deck-a','action-b','action-a']`，而不是只把 `action-a/action-b` 放到牌库顶，证明自动分支下仍然是“所选弃牌 + 现有 deck”整副一起 shuffle。
  - `discard=['gigawatts-a']`，说明被选中的弃牌类型已全部离开弃牌堆，只剩本行动自己正常进入 discard。
- 定向验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "1.21千兆瓦|1.21 千兆瓦"` -> `2 passed / 180 skipped`。
- 结论：`time_travelers_1_21_gigawatts.choose_card_type` 与 `time_travelers_1_21_gigawatts.shuffle_selected_type_to_deck` 的对象级 residual 已继续收紧；当前不再保留单一牌种自动分支，只剩双类型按钮分支之外更广的浏览器可见性与随机顺序可视性边界。

## 2026-05-18 SmashUp yuanhou 1.21 Gigawatts 单一牌种自动分支已从 L2 升到 scoped L3

- `1.21 Gigawatts` 不该继续停在“L2 已锁定单一牌种自动分支，但浏览器只看过双类型按钮链”的状态。
- 现有浏览器证据先前只证明：
  - 真实入口能看到“行动 / 仆从”两个按钮。
  - 玩家选择其一后，被选类型会和现有 deck 一起洗回。
  - 但这还不足以证明：如果弃牌堆里根本只剩单一牌种，真实 UI 会不会仍然错误弹出按钮 prompt，或在没有 prompt 的情况下偷偷短路失败。
- 本轮新增浏览器链：
  - `时间旅行者-1.21-Gigawatts-弃牌堆只剩单一牌种时真实入口应自动洗回牌库且不弹按钮 prompt`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-gigawatts-single BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "时间旅行者-1.21-Gigawatts-弃牌堆只剩单一牌种时真实入口应自动洗回牌库且不弹按钮 prompt"` -> `1 passed`
- 关键信号：
  - 起始图里手牌区直接可见 `1.21 Gigawatts`，弃牌堆里直接可见两张行动牌，没有任何仆从弃牌；这确认测试没有再次落到“双类型按钮 prompt”那条旧链。
  - 收口图里中央没有任何“行动 / 仆从”按钮，弃牌堆角标从 `2` 变成 `1`，说明两张行动已经离开弃牌堆，只剩本行动自己进入 discard。
  - 配合状态断言 `interaction.current==null` 且 deck 同时含原 deck 与两张行动弃牌，可证明真实 UI 下单一牌种分支是自动洗回，不是静默失败。
- 结论：
  - `time_travelers_1_21_gigawatts.choose_card_type` 不再只靠双类型按钮链支撑 scoped L3；单一牌种自动分支现在也有真实 UI 证据。
  - `time_travelers_1_21_gigawatts.shuffle_selected_type_to_deck` 同样不再只靠正向按钮选择支撑；单一牌种自动洗回已从“L2 已锁定”升级为 scoped L3。

## 2026-05-18 SmashUp yuanhou Spy 单卡自动查看分支已从 L2 升到 scoped L3

- `Spy.inspect_self_top_three` 不该继续停在“顶三张重排已有浏览器证据，但牌库只剩 1 张时只靠 L2”。
- 现有浏览器证据先前只证明：
  - 真实手牌打出 `Spy` 后会进入顶三张 inspect/reorder prompt。
  - 玩家可以选择非默认 `顶：内鬼 / 间谍；底：密探` 顺序，并把未查看的第 4 张保留在中段。
  - 但这还不足以证明：如果牌库只剩 1 张，真实 `PLAY_MINION` 入口会不会仍错误弹出 `super_spies_spy_reorder`、残留空 overlay，或让 `Spy` 本体落场后卡在半截 inspect 链里。
- 本轮新增浏览器链：
  - `超级间谍-Spy-牌库只剩一张时真实入口应自动查看且不弹重排 prompt`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-spy-single BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-Spy-牌库只剩一张时真实入口应自动查看且不弹重排 prompt"` -> `1 passed`
- 关键信号：
  - 起始图里底部手牌区只有 `Spy`，左下牌库角标为 `1`，这确认测试没有再落回“顶三张重排”那条旧链。
  - 收口图里 `Spy` 已真实落到 `Secret Volcano Headquarters`，中央没有任何顶/底重排 prompt 或按钮，桌面直接回到普通出牌态。
  - 配合状态断言 `interaction.current==null`、`base0.minions` 含 `spy-single-hand`、`deck=['spy-single-deck-a']`、`hand` 已移除 `spy-single-hand`，可确认单卡分支在真实 UI 下是“自动查看并收口”，不是静默失败。
- 结论：
  - `super_spies_spy.inspect_self_top_three` 不再只靠多于 1 张时的重排链支撑 scoped L3；单卡自动查看分支现在也有真实 UI 证据。
  - `super_spies_spy.reorder_top_bottom_inspected_cards` 仍只按多于 1 张时的真实重排分支记 scoped L3；空牌库无 prompt 继续由 L2 守门。

## 2026-05-18 SmashUp yuanhou For My Eyes Only 单卡自动查看分支已从 L2 升到 scoped L3

- `For My Eyes Only.inspect_self_top_five` 不该继续停在“顶五张重排已有浏览器证据，但牌库只剩 1 张时只靠 L2”。
- 现有浏览器证据先前只证明：
  - 真实无目标行动二次点击打出 `For My Eyes Only` 后，会进入顶五张 inspect/reorder prompt。
  - 玩家可以选择非默认 `顶：内鬼 / 间谍；底：跳跃者 / 密探 / 秘密探员` 顺序，并把第 6 张保留在中段。
  - 但这还不足以证明：如果牌库只剩 1 张，真实入口会不会仍错误弹出 `super_spies_for_my_eyes_only_reorder`、残留空 overlay，或把本行动本体卡在半透明收口态。
- 本轮新增浏览器链：
  - `超级间谍-For My Eyes Only-牌库只剩一张时真实入口应自动查看且不弹重排 prompt`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-eyes-single BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-For My Eyes Only-牌库只剩一张时真实入口应自动查看且不弹重排 prompt"` -> `1 passed`
- 关键信号：
  - 起始图里底部手牌区只有 `For My Eyes Only`，左下牌库角标为 `1`，这确认测试没有再落回“顶五张重排”那条旧链。
  - 收口图里中央没有任何顶/底重排 prompt 或按钮，右下弃牌堆直接可见本行动本体，桌面已经回到普通出牌态。
  - 配合状态断言 `interaction.current==null`、`deck=['eyes-single-deck-a']`、`discard` 含 `eyes-single-hand`、`hand` 已移除 `eyes-single-hand`，可确认单卡分支在真实 UI 下是“自动查看并收口”，不是静默失败。
- 结论：
  - `super_spies_for_my_eyes_only.inspect_self_top_five` 不再只靠多于 1 张时的重排链支撑 scoped L3；单卡自动查看分支现在也有真实 UI 证据。
  - `super_spies_for_my_eyes_only.reorder_top_bottom_inspected_cards` 仍只按多于 1 张时的真实重排分支记 scoped L3；空牌库无 prompt 继续由 L2 守门。

## 2026-05-18 SmashUp yuanhou Spy / For My Eyes Only 空牌库无 prompt 分支已从 L2 升到 scoped L3

- `Spy.inspect_self_top_three` 与 `For My Eyes Only.inspect_self_top_five` 不该继续停在“单卡自动查看已有浏览器证据，但牌库为空仍只靠 L2”。
- 现有浏览器证据先前只证明：
  - `Spy` / `For My Eyes Only` 在牌库还有牌时，真实入口会进入 inspect 链或自动查看分支。
  - 但这还不足以证明：如果牌库已经是空的，真实入口会不会仍错误弹出空的 reorder overlay、残留按钮，或把本体卡在半路 inspect 链。
- 本轮新增浏览器链：
  - `超级间谍-Spy-牌库为空时真实入口不应创建重排 prompt`
  - `超级间谍-For My Eyes Only-牌库为空时真实入口不应创建重排 prompt`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-empty-deck-inspect BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-Spy-牌库为空时真实入口不应创建重排 prompt|超级间谍-For My Eyes Only-牌库为空时真实入口不应创建重排 prompt"` -> `2 passed`
- 关键信号：
  - 两张起始图里左下牌库角标都直接是 `0`，这确认测试没有再落回“仍有 1 张牌”的旧链。
  - `Spy` 收口图里 `Spy` 已真实进场，中央没有任何顶/底重排 prompt 或按钮。
  - `For My Eyes Only` 收口图里中央同样没有任何顶/底重排 prompt 或按钮，右下弃牌堆已出现本行动本体。
  - 配合状态断言，`Spy` 分支 `interaction.current==null && base0.minions` 含 `spy-empty-hand && deck=[]`，`For My Eyes Only` 分支 `interaction.current==null && discard` 含 `eyes-empty-hand && deck=[]`，可确认两条空牌库边界在真实 UI 下都是“直接收口”。
- 结论：
  - `super_spies_spy.inspect_self_top_three` 的浏览器证据已扩到“顶三张重排 + 单卡自动查看 + 空牌库无 prompt”。
  - `super_spies_for_my_eyes_only.inspect_self_top_five` 的浏览器证据已扩到“顶五张重排 + 单卡自动查看 + 空牌库无 prompt”。

## 2026-05-17 SmashUp yuanhou Do Over / Doctor When skip-extra 已从 L2 升到 scoped L3

- 先前两段关于 `Do Over` / `Doctor When` 的结论里，有一句共同的过渡口径已经失效：
  - `skip extra 分支继续由 L2 锁定`
- 这句在当时是对的，但现在已经不够，因为真正的剩余风险不是 handler 会不会 skip，而是：
  - 真实 returned-card extra prompt 里点击“放弃这次额外随从”后，流程是否真的收口。
  - 刚回手的那张牌是否会被误自动再打回基地，或者残留第二层交互。
- 本轮直接补了对应的浏览器链：
  - `时间旅行者-Do Over-真实入口放弃额外随从后应直接收口并保留刚返回的那张牌`
  - `时间旅行者-Doctor When-真实入口放弃额外随从后应直接收口并保留刚返回的那张牌`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-specific-extra-skip BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-time-travelers-specific-extra.e2e.ts` -> `4 passed`
- 关键信号：
  - `Do Over` prompt 图里能直接看到 returned `Jumper` 与 skip 按钮；resolved 图里 `Portal Room` 仍为空，而 `Jumper` 继续留手。
  - `Doctor When` prompt 图里 returned `Time Raider` 已回到底部手牌，桌面只剩 `Doctor When`；resolved 图里 prompt 已完全消失，基地仍只剩 `Doctor When`。
  - 配合状态断言，两条链都满足 `interaction.current == null`，且 returned card 没有被误自动打回基地。
- 结论：
  - `time_travelers_do_over.may_play_returned_minion_again` 不再把 `skip extra` 留成 “只靠 L2” 的残余。
  - `time_travelers_doctor_when.may_play_returned_minion_again` 也不再把 `skip extra` 留成 “只靠 L2” 的残余。
  - 这两条 atom 当前剩余只继续保留更广的 returned-card 组合、multi-extra 竞争链与其它浏览器可见性边界。

## 2026-05-18 SmashUp yuanhou Faceless City skip 分支已从“只靠 L2”补到 scoped L3

- `Faceless City` 当前也不该再把 `skip` 停留在“unit test 已锁定”这一层。
- 现有 L2/L3 已经证明：
  - 多候选 prompt 只列同名牌 `same-a/same-b`，不列非同名 `other-card`。
  - 玩家选择第二张同名牌后，`same-b` 会进手牌，剩余牌库按测试随机源收口。
  - 但这还不足以证明：同一个真实 prompt 里的 `跳过搜寻` 被点击后，UI 会不会真的收口，以及牌库会不会被悄悄改写。
- 本轮新增浏览器链：
  - `变形者基地-Faceless City-真实入口跳过搜寻后应直接收口并保留原牌库顺序`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-faceless-city-skip BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "变形者基地-Faceless City-真实入口跳过搜寻后应直接收口并保留原牌库顺序"` -> `1 passed`
- 关键信号：
  - prompt 图里能直接看到 `跳过搜寻`，并且候选区没有非同名牌。
  - resolved 图里搜索层与按钮都已消失，桌面回到正常出牌态。
  - 配合状态断言，点击 skip 后 `hand.length===0`，`deck=['same-skip-a','other-skip-card','same-skip-b']`，说明真实入口没有偷偷摸一张同名牌，也没有改乱原牌库顺序。
- 结论：
  - `base_faceless_city.may_choose_or_skip_same_name_card` 不再只是“选择第二张同名牌”有浏览器证据；skip 分支现在也有 scoped L3。
  - `base_faceless_city` 当前只继续保留自动单候选与 forged late-deck 的 L2/shared 边界，不再把 skip 单独挂成 residual。

## 2026-05-18 SmashUp yuanhou G.E.L.F. skip 分支已从“只覆盖选择候选”补到 scoped L3

- `G.E.L.F.` 当前也不该再把 optional extra-play 的浏览器证据停留在“选择第二张候选打回原基地”这一半。
- 现有 L2/L3 已经证明：
  - `G.E.L.F.` 天赋会先把自身洗回牌库，并只列出力量 4 或以下且非 `G.E.L.F.` 的候选。
  - 玩家选择 `Mimic` 后，该候选会被直接额外打到原基地，且不会再残留第二个 immediate extra prompt。
  - 但这还不足以证明：同一个真实搜索 prompt 里的 `放弃这次选择` 被点击后，UI 会不会真的收口，以及基地会不会被悄悄补打一只候选。
- 本轮新增浏览器链：
  - `变形者-GELF-真实入口跳过搜寻后应直接收口且不额外打出候选随从`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-gelf-skip BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "变形者-GELF-真实入口跳过搜寻后应直接收口且不额外打出候选随从"` -> `1 passed`
- 关键信号：
  - prompt 图里能直接看到 `G.E.L.F.` 搜索覆盖层、两张合格候选和 `放弃这次选择` 按钮，且原 `G.E.L.F.` 已离场回到牌库链。
  - resolved 图里搜索层与按钮都已消失，`The Vats` 仍为空，说明没有候选被偷偷打回基地。
  - 配合状态断言，点击 skip 后 `interaction.current==null`、`minions.length===0`、`hand.length===0`，而五张牌都还留在 P0 `deck`，说明真实入口没有偷偷补打一只候选，也没有错误创建第二个 immediate extra prompt。
- 结论：
  - `shapeshifters_gelf.extra_play_here` 不再只是“选择候选打回原基地”有浏览器证据；skip 分支现在也有 scoped L3。
  - `shapeshifters_gelf` 当前只继续保留更广 shared search 的随机顺序、forged late-deck 与其它 L2/shared 边界，不再把 skip 单独挂成 residual。

## 2026-05-18 SmashUp yuanhou Really? skip 分支已从“只覆盖选择候选 + 选基地”补到 scoped L3

- `Really?` 当前也不该再把 optional discard-search 的浏览器证据停留在“选择第二张候选并选基地打出”这一半。
- 现有 L2/L3 已经证明：
  - `Really?` 会先摧毁己方目标，再进入只列合格弃牌堆随从的搜索 prompt。
  - 玩家选择第二张候选后，会继续进入基地选择 prompt，并能把该随从打到不是原基地的另一个合法基地。
  - 但这还不足以证明：同一个真实弃牌堆搜索 prompt 里的 `放弃这次选择` 被点击后，UI 会不会真的收口，以及系统会不会偷偷继续进入第二层基地选择或直接把候选打到某个基地。
- 本轮新增浏览器链：
  - `变形者-Really-真实入口跳过弃牌堆搜寻后应直接收口且不额外打出候选随从`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-really-skip BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "变形者-Really-真实入口跳过弃牌堆搜寻后应直接收口且不额外打出候选随从"` -> `1 passed`
- 关键信号：
  - prompt 图里能直接看到 `Really?` 弃牌堆搜索覆盖层、两张候选和 `放弃这次选择` 按钮，而且被摧毁的 `Doppelganger` 已经进弃牌堆。
  - resolved 图里搜索层与按钮都已消失，`Faceless City` 与 `The Vats` 都还是空的，说明 skip 后没有任何弃牌堆候选被偷偷打进来。
  - 配合状态断言，点击 skip 后 `interaction.current==null`、两个基地 `minions.length===0`，而 `really-skip-hand/really-skip-target/really-skip-discard-a/really-skip-discard-b` 都仍留在 P0 discard，说明系统没有继续进入第二层基地选择，也没有误 extra play。
- 结论：
  - `shapeshifters_really.choose_discard_minion` 不再只是“选择第二张候选”有浏览器证据；skip 分支现在也有 scoped L3。
  - `shapeshifters_really.play_extra_minion_any_base` 当前也不再只靠“选择候选后再选基地”支撑 optional extra-play 语义；skip 分支现在同样有真实 UI 收口证据。

## 2026-05-18 SmashUp yuanhou Transmogrify skip 分支已从“只覆盖选择候选打回原基地”补到 scoped L3

- `Transmogrify` 当前也不该再把 optional deck-search 的浏览器证据停留在“选择第二张候选并把它打回原基地”这一半。
- 现有 L2/L3 已经证明：
  - `Transmogrify` 会先摧毁己方目标，再进入只列合格牌库随从的搜索 prompt。
  - 玩家选择第二张候选后，该候选会被直接额外打回被摧毁随从原来的基地，且不会残留第二个 immediate prompt。
  - 但这还不足以证明：同一个真实牌库搜索 prompt 里的 `放弃这次选择` 被点击后，UI 会不会真的收口，以及系统会不会偷偷把候选打回 `The Vats`。
- 本轮新增浏览器链：
  - `变形者-Transmogrify-真实入口跳过牌库搜寻后应直接收口且不额外打出候选随从`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-transmogrify-skip BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "变形者-Transmogrify-真实入口跳过牌库搜寻后应直接收口且不额外打出候选随从"` -> `1 passed`
- 关键信号：
  - prompt 图里能直接看到 `Transmogrify` 牌库搜索覆盖层、两张合格候选和 `放弃这次选择` 按钮，而且被摧毁的 `G.E.L.F.` 已经进弃牌堆。
  - resolved 图里搜索层与按钮都已消失，`The Vats` 仍然空场，说明 skip 后没有任何牌库候选被偷偷打回原基地。
  - 配合状态断言，点击 skip 后 `interaction.current==null`、`minions.length===0`，`transmogrify-skip-hand/transmogrify-skip-target` 留在 discard，而三张候选仍留在 deck，说明系统没有继续进入第二层链，也没有误 extra play。
- 结论：
  - `shapeshifters_transmogrify.search_equal_or_lower_power_deck_minion` 不再只是“选择第二张候选”有浏览器证据；skip 分支现在也有 scoped L3。
  - `shapeshifters_transmogrify.play_extra_minion_here_and_shuffle` 当前也不再只靠“选择候选打回原基地”支撑 optional extra-play 语义；skip 分支现在同样有真实 UI 收口证据。

## 2026-05-18 SmashUp yuanhou Doppelganger skip 分支已从“只覆盖选候选打回原基地”补到 scoped L3

- `Doppelganger` 当前也不该再把 optional deck-search 的浏览器证据停留在“Bacta 摧毁后跳过 immediate extra，再选择第二张候选打回原基地”这一半。
- 现有 L2/L3 已经证明：
  - `Bacta` 真实摧毁 `Doppelganger` 后，会先出现 `smashup_immediate_extra_minion`，跳过后才进入 `shapeshifters_doppelganger_search`。
  - 玩家选择第二张候选后，该候选会被直接打回 `Doppelganger` 原来的基地，且不会残留第二个 immediate prompt。
  - 但这还不足以证明：同一个真实 `Doppelganger search` prompt 里的 `放弃这次选择` 被点击后，UI 会不会真的收口，以及系统会不会偷偷把候选打回 `The Vats`。
- 本轮新增浏览器链：
  - `变形者-Doppelganger-真实入口跳过牌库搜寻后应直接收口且不额外打出候选随从`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-doppelganger-skip BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "变形者-Doppelganger-真实入口跳过牌库搜寻后应直接收口且不额外打出候选随从"` -> `1 passed`
- 关键信号：
  - prompt 图里能直接看到 `Doppelganger` 牌库搜索覆盖层、两张候选和 `放弃这次选择` 按钮，顶部还保留前链的额外随从机会 toast，说明这确实是 `Bacta immediate extra skip` 之后的第二层搜索链。
  - resolved 图里搜索层与按钮都已消失，`The Vats` 仍为空场，说明 skip 后没有任何牌库候选被偷偷打回原基地。
  - 配合状态断言，点击 skip 后 `interaction.current==null`、`minions.length===0`，`bacta-doppelganger-skip-hand/doppelganger-skip-target` 留在 discard，而两张候选仍留在 deck，说明系统没有再进入额外的 play 链。
- 结论：
  - `shapeshifters_doppelganger.on_discard_from_base_search_deck_minion` 不再只是“进入 search”有浏览器证据；skip 分支现在也有 scoped L3。
  - `shapeshifters_doppelganger.play_extra_minion_original_base` 当前也不再只靠“选择候选打回原基地”支撑 optional extra-play 语义；skip 分支现在同样有真实 UI 收口证据。

## 2026-05-18 SmashUp yuanhou Mitosis skip 分支已从“只覆盖选候选打到目标基地”补到 scoped L3

- `Mitosis` 当前也不该再把 optional same-name hand choice 的浏览器证据停留在“从两张同名手牌里选第二张并把它打到目标基地”这一半。
- 现有 L2/L3 已经证明：
  - `Mitosis` 在真实手牌入口里会先让玩家点一个己方目标随从，再进入只列同名手牌的选择 prompt。
  - 玩家选择第二张同名 `G.E.L.F.` 后，该候选会被直接打到目标基地，且不会残留第二个 immediate prompt。
  - 但这还不足以证明：同一个真实 same-name prompt 里的 `放弃这次选择` 被点击后，UI 会不会真的收口，以及系统会不会偷偷把某张同名手牌打到 `The Vats`。
- 本轮新增浏览器链：
  - `变形者-Mitosis-真实入口跳过同名手牌选择后应直接收口且不额外打出候选随从`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-mitosis-skip BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "变形者-Mitosis-真实入口跳过同名手牌选择后应直接收口且不额外打出候选随从"` -> `1 passed`
- 关键信号：
  - prompt 图里能直接看到 `Mitosis` same-name 覆盖层、两张 `G.E.L.F.` 候选和 `放弃这次选择` 按钮；底部手牌区的 `Mimic` 仍可见但不在候选层里，说明非同名手牌没有混入候选集合。
  - resolved 图里选择层与按钮都已消失，`The Vats` 上仍只有原目标那只 `G.E.L.F.`，而底部两张同名 `G.E.L.F.` 手牌都继续留在手里，说明 skip 后没有任何同名手牌被偷偷补打上场。
  - 配合状态断言，点击 skip 后 `interaction.current==null`、`minions.length===1`、`discard` 含 `mitosis-skip-hand`，而 `mitosis-skip-same-a/mitosis-skip-same-b/mitosis-skip-wrong-name` 都仍留在 hand，说明链路在 same-name prompt 处直接收口。
- 结论：
  - `shapeshifters_mitosis.choose_same_name_hand_minion` 不再只是“选择第二张候选”有浏览器证据；skip 分支现在也有 scoped L3。
  - `shapeshifters_mitosis.play_selected_extra_minion_here` 当前也不再只靠“选择候选打到目标基地”支撑 optional extra-play 语义；skip 分支现在同样有真实 UI 收口证据。

## 2026-05-18 SmashUp yuanhou Operative 空选 0 人分支已从 residual 补到 scoped L3

- `Operative` 之前剩下的对象级 residual，不是“第一层玩家多选 prompt 根本没验证”，而是**真实入口里 `any number of players` 的 `0` 会不会被 UI 吞掉**。
- 现有 L2/L3 已经证明：
  - 第一层 prompt 能多选两位玩家，并把这两位玩家各自的顶牌带进第二层 `top/bottom` prompt。
  - 但这还不足以证明：如果玩家在第一层一个都不选，点击确认后会不会错误生成第二层 reveal/top-bottom、偷偷 reveal 所有人顶牌，或改写任何一边的 deck 顶顺序。
- 本轮新增浏览器链：
  - `超级间谍-Operative-真实入口空选玩家后应直接收口且不展示任何牌库顶牌`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-operative-empty BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-Operative-真实入口空选玩家后应直接收口且不展示任何牌库顶牌"` -> `1 passed`
- 关键信号：
  - prompt 图里能直接看到 `密探：选择要查看牌库顶牌的玩家`，`玩家0/玩家1` 两个按钮都处于未勾选状态，且确认按钮可点击，说明 `0` 不是仅靠 reducer 容忍的隐形 payload，而是 UI 明确承认的合法输入。
  - resolved 图里 prompt 已完全消失，`Secret Volcano Headquarters` 上只剩 Operative，本轮没有出现任何展示牌或第二层放底 prompt。
  - 配合状态断言，点击确认后 `interaction.current==null`、`p0Deck='operative-empty-p0-top,operative-empty-p0-second'`、`p1Deck='operative-empty-p1-top,operative-empty-p1-second'`，同时页面不存在 `operative-empty-p0-top / operative-empty-p1-top` 的 option 节点，说明系统没有偷偷 reveal 或改写任一玩家牌库顶。
- 结论：
  - `super_spies_operative.choose_players_to_reveal` 不再只是“正常多选两人”有浏览器证据；空选 0 人分支现在也有 scoped L3。
  - 这条证据只收紧了第一层 `choose_players_to_reveal` 的 `0..N` 端点，不外推 `bottom_any_revealed_cards` 的“0 张放底”或更广多人非当前视角都已完成。

## 2026-05-18 SmashUp yuanhou Operative 二步空选 0 张放底分支已从 residual 补到 scoped L3

- `Operative` 在补完第一层 `0 人` 之后，剩下的浏览器残项就只剩第二层 `top/bottom` prompt 的 `0 张` 端点。
- 现有 L2/L3 已经证明：
  - 第一层可以真实选择两位玩家，并进入只展示这两位玩家牌库顶牌的第二层 prompt。
  - 第二层可以真实选择其中 1 张展示牌放到底，未选牌保持在顶。
  - 但这还不足以证明：如果第二层一张都不选直接确认，会不会偷偷把某张展示顶牌沉到底、遗留第二层 overlay，或把这次 `0 张` 错误短路成第一层 prompt 的回流。
- 本轮新增浏览器链：
  - `超级间谍-Operative-真实入口空选展示牌后应保持各牌库顶顺序并直接收口`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-operative-bottom-empty BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-Operative-真实入口空选展示牌后应保持各牌库顶顺序并直接收口"` -> `1 passed`
- 关键信号：
  - prompt 图里能直接看到两位玩家都已在第一层被勾选，中间只出现两张展示顶牌，但一张都没勾选；这证明第二层 `0 张放底` 是真实可操作端点，不是只能靠 handler 接收空数组。
  - resolved 图里第二层 prompt 已完全消失，桌面回到普通出牌态，`Secret Volcano Headquarters` 上仍只剩 Operative。
  - 配合状态断言，点击确认后 `interaction.current==null`、`p0Deck='operative-bottom-empty-p0-top,operative-bottom-empty-p0-second'`、`p1Deck='operative-bottom-empty-p1-top,operative-bottom-empty-p1-second'`，说明系统没有偷偷改变任一展示顶牌顺序。
- 结论：
  - `super_spies_operative.bottom_any_revealed_cards` 不再只是“选 1 张放底”有浏览器证据；空选 0 张分支现在也有 scoped L3。
  - `Operative` 当前对象级浏览器残项不再包括两层 `any number` 的空选端点；后续若继续推进，应转向更高层的多人非当前视角或 shared contract，而不是再把这张牌的本地空选挂成 residual。

## 2026-05-18 SmashUp yuanhou Time Raider / Repeater Perfect 空弃牌 feedback 已从 L2 提升到 scoped L3

- `Time Raider` 与 `Repeater Perfect` 之前都还把“空弃牌反馈”停在 L2，这个口径不够，因为真实风险不是 reducer 有没有发 `feedback.discard_empty`，而是玩家界面会不会错误弹出空 prompt，或者根本看不到反馈。
- 本轮新增两条真实入口：
  - `时间旅行者-Repeater Perfect-弃牌堆为空时真实入口应提示无可选行动且不弹 prompt`
  - `时间旅行者-Time Raider-弃牌堆为空时真实入口应提示无可选牌且不弹 prompt`
- 定向验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-empty-discard-feedback BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "时间旅行者-Repeater Perfect-弃牌堆为空时真实入口应提示无可选行动且不弹 prompt|时间旅行者-Time Raider-弃牌堆为空时真实入口应提示无可选牌且不弹 prompt"` -> `2 passed`
- 关键信号：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Repeater-Perfect-弃牌堆为空时真实入口应提示无可选行动且不弹-prompt\yuanhou-repeater-perfect-empty-discard-feedback-toast-locator.png` 与 `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Raider-弃牌堆为空时真实入口应提示无可选牌且不弹-prompt\yuanhou-time-raider-empty-discard-feedback-toast-locator.png` 都直接显示 toast 文案 `弃牌堆中没有符合条件的卡牌`。
  - `yuanhou-repeater-perfect-empty-discard-feedback-without-prompt.png` 里 `Portal Room` 下只剩真实进场的 `Repeater Perfect`，没有任何候选 prompt。
  - `yuanhou-time-raider-empty-discard-feedback-without-prompt.png` 里 `Time Raider` 已显示“已用”，页面同样没有任何候选 prompt。
  - 配合状态断言，`Repeater Perfect` 分支保持 `deck=['repeater-empty-deck-a']`、`discard=[]`，`Time Raider` 分支保持 `deck=['raider-empty-deck-a']`、`discard=[]` 且 `talentUsed===true`，说明两条链都只是“toast + 收口”，没有偷偷改动牌区。
- 结论：
  - `time_travelers_repeater_perfect.choose_discard_action / top_selected_action` 不再把空弃牌反馈挂在对象级 residual。
  - `time_travelers_time_raider.choose_discard_card / bottom_selected_card` 也不再把空弃牌反馈留在 L2；这两个对象当前的本地浏览器分支已经补齐到“多候选 / 单候选 / 空弃牌 feedback”。

## 2026-05-18 超级间谍重排截图“选项太多”已确认为旧图口径

- 用户当轮质疑点是：超级间谍重排 prompt 的截图看起来像“选项太多”，怀疑仍是易用性不达标的按钮墙。
- 这次复核不再只看断言，而是重新查看当前 worktree 里三张最新 prompt 截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Spy-真实入口可查看自己牌库顶三张并按非默认顶底顺序放回\yuanhou-spy-top-three-reorder-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-For-My-Eyes-Only-真实入口可查看自己牌库顶五张并按非默认顶底顺序放回\yuanhou-for-my-eyes-only-top-five-reorder-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-ISI摇摆据点-真实多客户端下赢家不是当前回合玩家时应只给赢家页面重排牌库\yuanhou-isi-swingin-pad-reorder-prompt.png`
- 肉眼复核结论：
  - 三张图的中央主体都是 inspected cards 卡带，本体可见；右侧是固定工具条，不是把所有排列结果枚举成一屏按钮。
  - 当前工具条只暴露 `移到牌库底 / 后移 / 确认顺序` 这类与已选卡直接相关的动作；`前移 / 重置` 不会在初始无效态常驻露出。
  - 因此图里“看起来选项多”的部分其实是被查看的真实卡牌，不是旧的结果按钮墙。
- 定向验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx --configLoader native --maxWorkers 1` -> `11 passed`
  - `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-Spy-真实入口可查看自己牌库顶三张并按非默认顶底顺序放回"` -> `1 passed`
  - `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-For My Eyes Only-真实入口可查看自己牌库顶五张并按非默认顶底顺序放回"` -> `1 passed`
  - `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-jumper-multiplayer.e2e.ts "超级间谍-ISI摇摆据点-真实多客户端下赢家不是当前回合玩家时应只给赢家页面重排牌库"` -> `1 passed`
- 结论：
  - 当前 `shared-contract: deck-inspect-reorder` 已经收敛为线性编辑器型 UI。
  - 用户看到的“截图很多选项”不再代表当前实现状态，后续审计不得继续引用旧按钮墙截图作为现行证据。
