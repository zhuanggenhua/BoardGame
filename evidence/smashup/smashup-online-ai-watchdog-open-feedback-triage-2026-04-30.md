# SmashUp 线上 AI 自动反馈复核（2026-04-30）

- 时间：2026-04-30
- 范围：生产库中仍为 `open` 的 Smash Up watchdog 自动反馈
- 来源口径：生产 Mongo `feedbacks` 集合（`source=online-ai-watchdog` / `contactInfo=system:online-ai-watchdog`）
- 生产机：`admin@8.148.71.102`
- 生产仓库 HEAD：`2d1b8bf8b3fea80a536dd5ff3008b5e032752027`

## 生产中仍开的两条 Smash Up 自动反馈

1. `69ef240e039f95a4fe91c293`
   - 内容：`[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted`
   - 关键快照：
     - `phase=scoreBases`
     - `sourceId=smashup_reaction_choose`
     - 选项包含 **重复** `activate_special:titan:titan_2_wizards_arcane_protector:1`
     - `legalActions.total=3`，其中前两项 actionId 也重复
   - 结论：这是“计分基地索引重复 → 反应选项重复 → watchdog 反复看到同一 blocker”的历史链路。

2. `69ef22c6039f95a4fe91c1c7`
   - 内容：`[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted`
   - 关键快照：
     - `phase=scoreBases`
     - `sourceId=smashup_reaction_choose`
     - 选项为 `activate_special:titan:titan_1_wizards_arcane_protector:0` + `pass`，**无重复选项**
   - 结论：更像 live 校验交互把刷新后的 options 写回 resolved 事件，导致下游误判“不是原 blocker”的历史链路。

## 当前本地代码对应证据

### A. 重复计分基地索引/重复反应选项已在本地修过

- 本地代码：`src/games/smashup/domain/ongoingModifiers.ts:720-760`
  - `getScoringEligibleBaseIndices()` 已统一走 `normalizeScoringEligibleBaseIndices()`
- 回归测试：`src/games/smashup/__tests__/scoringEligibleLock.test.ts:180-208`
  - 覆盖“锁定列表包含重复索引时应保序去重”
  - 覆盖 `SCORING_ELIGIBLE_BASES_LOCKED` 写入时去重
- 历史证据：`evidence/smashup/smashup-feedback-69eb3924-reaction-recover-blocker-fix-2026-04-24.md`

### B. live 校验交互快照污染已在本地修过

- 本地代码：`src/engine/systems/SimpleChoiceSystem.ts:276-299`
  - live 校验只用于合法性判断
  - `SYS_INTERACTION_RESOLVED.payload.interactionData` 保留原始 `current.data`
- watchdog 回归：`src/engine/transport/__tests__/server.test.ts:3780-3905`
  - 覆盖“沿用原始 interactionData 快照，避免下游把 blocker 重新挂回”
- 历史证据：`evidence/_shared/engine-watchdog-69ecff249087da2a55c922a5-fix-2026-04-26.md`

### C. Smash Up 计分交互恢复后的 follow-up 收口也已被本地门禁覆盖

- 回归测试：`src/engine/transport/__tests__/server.test.ts:5849-6000`
  - 覆盖“交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE”

## 生产代码与本地代码差异证据

### 生产 `SimpleChoiceSystem` 仍是旧实现

生产机 `src/engine/systems/SimpleChoiceSystem.ts` 仍可见：

```ts
const interactionDataForEvent = responseValidationMode === 'live'
    ? { ...current.data, options: availableOptions }
    : current.data;
```

这正是已在本地修掉的旧逻辑。

### 生产 Smash Up ongoingModifiers 中未检出 `normalizeScoringEligibleBaseIndices`

生产机 `src/games/smashup/domain/ongoingModifiers.ts` 中未检出 `normalizeScoringEligibleBaseIndices`，说明重复索引去重修复也尚未上生产。

## 本轮实际验证命令

1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoringEligibleLock.test.ts --configLoader native --maxWorkers 1`
   - 结果：`12 passed`

2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 -t "online AI watchdog 处理 live 校验交互时，应沿用原始 interactionData 快照，避免下游把 blocker 重新挂回"`
   - 结果：`1 passed`

3. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 -t "online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"`
   - 结果：`1 passed`

## 结论

- 这两条 Smash Up `open` 自动反馈更像**生产环境仍停留在旧代码**导致的历史单，不是当前本地 HEAD 新发现的未修根因。
- 对应根因在本地已经分别被：
  - `scoringEligibleBaseIndices` 去重修复
  - `SimpleChoiceSystem` live 校验快照修复
  - `scoreBases` follow-up 收口回归
  覆盖。
- 下一步若要真正清线上单，应该优先：
  1. 把含上述修复的版本部署到生产；
  2. 再按线上复核/替代复核决定是否将这两条反馈回写为 `resolved`。

## 2026-05-20 shared transport follow-up

- 本轮没有回扫旧 `The Spy Who Ditched Me Host/非目标页 waiting overlay` 对象级链路，而是继续下钻到 shared transport / playerView 的 `hasOnlineAiRecoveryResolved()` 与 `runOnlineAiRecoverySequence()` 交界。

### 已新增并落地的真修

- `response-window / response-loop` 的 resolved gate 现在会先比较 live response-window fingerprint 与 `candidate.fingerprintHint`。
  - 含义：如果窗口已经换成新的 `window id / sourceId / responderQueue` incident，即使当前响应者还是同一 AI，也会把旧 candidate 视为已 resolved，不再让旧 tracker 续命。
- `visible-interaction / hidden-interaction` 的 resolved gate 现在也会先比较 live interaction fingerprint 与 `candidate.fingerprintHint`。
  - 含义：如果 prompt 已切成同一玩家的新 incident，不再只因为 `playerId` 还相同就把旧 candidate 继续判成 unresolved。

### 本轮新增的直测结论

- `online AI watchdog 的 active-turn resolved 判定在同一 AI 仍处于 active-turn 时，不应提前判定为 resolved`
- `online AI watchdog 的 response-window resolved 判定在 live window 已切到新 fingerprint 时，应视为旧 incident 已 resolved`
- `online AI watchdog 的 response-loop resolved 判定在 live window 已切到新 fingerprint 时，应视为旧 incident 已 resolved`
- `online AI watchdog 的 visible-interaction resolved 判定在 live prompt 已切到新 fingerprint 时，应视为旧 incident 已 resolved`
- `online AI watchdog 的 hidden-interaction resolved 判定在 live prompt 已切到新 fingerprint 时，应视为旧 incident 已 resolved`
- `online AI watchdog 在 hidden-interaction 候选 fingerprint 漂移到新的 owner-only current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败`

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 的 response-window resolved 判定在 live window 已切到新 fingerprint 时，应视为旧 incident 已 resolved|online AI watchdog 的 response-loop resolved 判定在 live window 已切到新 fingerprint 时，应视为旧 incident 已 resolved"`
   - 结果：`1 file passed, 2 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 的 visible-interaction resolved 判定在 live prompt 已切到新 fingerprint 时，应视为旧 incident 已 resolved|online AI watchdog 的 hidden-interaction resolved 判定在 live prompt 已切到新 fingerprint 时，应视为旧 incident 已 resolved"`
   - 结果：`1 file passed, 2 passed`
3. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 hidden-interaction 候选 fingerprint 漂移到新的 owner-only current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败"`
   - 结果：`1 file passed, 1 passed`
4. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 169 passed`

## 2026-05-20 shared transport follow-up 2

- 本轮继续沿 `hasOnlineAiRecoveryResolved()` 下钻，没有回扫旧 `The Spy Who Ditched Me ... waiting overlay` objective，也没有重打已闭的 response-window / response-loop / visible / hidden fingerprint drift。

### 新坐实的真残口

- `active-turn` 的 resolved gate 旧逻辑会对这类 candidate 默认返回 `true`。
  - 结果是：同一 AI 仍停在 `active-turn`，但 legal action 让 marker 动了一下时，watchdog 就可能提前报成 recovered。
  - 这就是一种典型“看起来像一直在绕”的来源：现场其实还在同一 stalled surface，但日志/反馈已经先宣称成功。

### 本轮修复

- `src/engine/transport/server.ts`
  - 为 `candidate.reason === 'active-turn'` 增加显式 resolved 判定。
  - 现在会重新调用 `resolveOnlineAiRecoveryCandidate()`；只有当 nextCandidate 不存在、换到别的玩家、或不再是 `active-turn` 时，才把旧 incident 视为 resolved。
- `src/engine/transport/__tests__/server.test.ts`
  - 新增 direct gate：`online AI watchdog 的 active-turn resolved 判定在同一 AI 仍处于 active-turn 时，不应提前判定为 resolved`

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 的 active-turn resolved 判定在同一 AI 仍处于 active-turn 时，不应提前判定为 resolved|online AI watchdog 的 seat-legal-only resolved 判定在同一 AI 仍处于 response-window 时，不应提前判定为 resolved|online AI watchdog 在 active-turn 卡死时应持续推进直到交还给真人回合（或遇到 blocker/步数上限）|online AI watchdog 完成 legal action 恢复后也应写入系统反馈"`
   - 结果：`1 file passed, 4 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 171 passed`

### 本轮边界

- 这次补掉的是 `active-turn` 的假收口，不外推 `resolveOnlineAiRecoveryCandidate()` / `runOnlineAiRecoveryTick()` 顶层 continuity、tracker replacement 或 playerView/evidence 边界已经全部完成。
- 下一步若继续推进，应优先去找“旧 tracker 还活着，但 live incident 已切面”的更外层 caller seam；不要再回头把 `active-turn resolved`、visible/hidden resolved、或 response-window/response-loop resolved 这些已闭 family 重说成开放残项。

### 本轮边界

- `hidden-interaction` 的 tracker-level fingerprint drift 本轮已证明**不是新的 runtime 真洞**，而是此前缺少一条 owner-only / playerView 直测；因此后续不应再把这格当作开放 residual。
- 当前仍未能证明整个 watchdog / playerView / evidence 主线已经全部完成；后续若继续推进，应优先去找 `resolveOnlineAiRecoveryCandidate()` 外层 caller provenance、follow-up handoff 或 playerView/evidence 边界里的下一条最小真残口。

## 2026-05-20 shared transport follow-up 3

- 本轮先停掉“继续围着旧 goal 文案回扫 `The Spy Who Ditched Me Host/非目标页 waiting overlay`”的错误锚点，改按当前主仓真实红灯推进：`server.test.ts` 里 delayed `legal-action-recovered` feedback 的两条回归。

### 新坐实的真残口

- `tryRecoverOnlineAiWithLegalAction()` 把 `legal-action-recovered` 从即时上报改成 sequence 尾部统一上报后，修掉了 `response-window` 多步链“先执行合法非 pass 动作却提前写 resolved”这条真洞，但把两类 plain `visible-interaction` 成功链误吞掉了：
  - `online AI watchdog 在额外战术交互卡住后，不应自动 ADVANCE_PHASE 跳过 AI 回合`
  - `online AI watchdog 应优先执行 AI 合法动作来解除可见交互阻塞，而不是直接 force-end-turn`
- 真正的边界不是“所有交互恢复后都立刻报 resolved”，也不是“所有 resolved 都等到 sequence 最后再说”，而是：
  - `response-window` 多步链只报最终那一步；
  - plain `visible/hidden interaction` 若本轮已经解除交互阻塞、且 seat view 下没有新的 hidden/visible prompt，就应在本轮尾部补回 `legal-action-recovered`；
  - `visible -> hidden` 链式交互与 `interaction -> follow-up ADVANCE_PHASE` 仍必须继续收口，不能被这个 resolved 分支截断。

### 本轮修复

- `src/engine/transport/server.ts`
  - 在 `runOnlineAiRecoverySequence()` 新增 `readCurrentAiSeatViewInteractionRecoveryFingerprintHint()`，用 AI seat 自己的 playerView 判断该步后是否还存在新的 owner-only / visible prompt。
  - 收窄 plain interaction 收口条件：只有当
    - 原始 candidate 本来就是 `visible-interaction` / `hidden-interaction`
    - 该步前没有 `response-window`
    - 该步后 seat view 里也看不到新的 hidden/visible prompt
    - 当前 authoritative nextCandidate 只剩同一 AI 的 `active-turn`
    才把这次 sequence 视为“交互已解除，可上报 `legal-action-recovered`”。
  - 这保证了：
    - `extra-action` / `visible simple-choice` 单步成功会补回 resolved feedback；
    - `response-window` 非 pass 多步链仍只报最后一步；
    - `shared visible -> owner-only hidden` 仍在同一 sequence 里继续吃第二个 `RESPOND`；
    - `interaction -> follow-up ADVANCE_PHASE` 仍继续执行，不会被提前截断。

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在额外战术交互卡住后，不应自动 ADVANCE_PHASE 跳过 AI 回合|online AI watchdog 应优先执行 AI 合法动作来解除可见交互阻塞，而不是直接 force-end-turn|online AI watchdog 在 response window 先执行非 pass 合法动作时，不应误触发强制关窗或提前写 resolved 反馈|online AI watchdog 在 shared visible prompt 后若切到 owner-only hidden prompt 且 marker 不变，也应在同一恢复序列内继续收口|online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"`
   - 结果：`1 file passed, 5 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 171 passed`

### 本轮边界

- 这次补掉的是 `runOnlineAiRecoverySequence()` 的 delayed `legal-action-recovered` feedback seam，不外推整个 shared transport / playerView / completion-audit 主线已经全部完成。
- 当前活跃 `goal.objective` 仍是旧 `The Spy Who Ditched Me ... waiting overlay` 文案，已经滞后于真实代码面；后续继续推进时，必须以长期状态 JSON 的 `last_verified / next_actions` 和当前主仓红灯为锚，不能再按这个旧 objective 回扫。

## 2026-05-20 shared transport follow-up 4

- 本轮继续沿 `hasOnlineAiRecoveryResolved()` 下钻，没有回扫旧 `The Spy Who Ditched Me ... waiting overlay` objective，也没有重打已闭的 visible/hidden、response-window/response-loop、compare-roll、multistep 与 delayed `legal-action-recovered` family。
- 新抓到的真残口是 `legalActionOnly` 的 resolved gate 仍过粗：旧逻辑只要 `nextCandidate.playerId === candidate.playerId` 就一律判成 unresolved，不区分“同一 legal-only surface 还没收口”和“同一 AI 已切到新的 legal-only phase / 新 incident”。
  - 这会让 watchdog 在同一 AI 已从旧 `active-turn-legal-only` surface 切到新的 legal-only phase 时，还继续沿旧 tracker 续命；外观上就很像“明明有推进，却还在原地死循环”。
  - 但同一 AI 从 `seat-legal-only` 继续进入 `response-window / response-loop` 时，仍属于同一 stalled chain，不能被误判成 resolved。

### 本轮修复

- `src/engine/transport/server.ts`
  - 收紧 `hasOnlineAiRecoveryResolved()` 的 `candidate.legalActionOnly === true` 分支：
    - `nextCandidate` 不存在或玩家已切走：`resolved=true`
    - `nextCandidate` 仍是同一玩家，且进入 `response-window / response-loop`：仍视为同一 stalled chain，`resolved=false`
    - `nextCandidate` 仍是 `legalActionOnly`，但 `reason` 或 `fingerprintHint` 已变化：视为旧 incident 已 resolved
    - `nextCandidate` 仍是同一 `legalActionOnly` reason 且 fingerprint 不变：`resolved=false`
- `src/engine/transport/__tests__/server.test.ts`
  - 新增 direct gate：`online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 已切到新的 legal-only phase 时，应视为旧 incident 已 resolved`
  - 补齐对称 direct gate：`online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 仍处于同一 legal-only surface 时，不应提前判定为 resolved`

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 已切到新的 legal-only phase 时，应视为旧 incident 已 resolved|online AI watchdog 的 active-turn resolved 判定在同一 AI 仍处于 active-turn 时，不应提前判定为 resolved|online AI watchdog 的 seat-legal-only resolved 判定在同一 AI 仍处于 response-window 时，不应提前判定为 resolved|online AI watchdog 的 display-only-bonus resolved 判定在同一 orphan settlement 仍存在时，不应提前判定为 resolved|online AI watchdog 的 response-window resolved 判定在 live window 已切到新 fingerprint 时，应视为旧 incident 已 resolved|online AI watchdog 的 response-loop resolved 判定在 live window 已切到新 fingerprint 时，应视为旧 incident 已 resolved"`
   - 结果：`1 file passed, 6 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 173 passed`
3. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 仍处于同一 legal-only surface 时，不应提前判定为 resolved|online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 已切到新的 legal-only phase 时，应视为旧 incident 已 resolved|online AI watchdog 的 seat-legal-only resolved 判定在同一 AI 仍处于 response-window 时，不应提前判定为 resolved"`
   - 结果：`1 file passed, 3 passed`
4. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 174 passed`

### 本轮边界

- 这次补掉的是 `legalActionOnly` resolved gate 的 same-player/new-phase 续命 seam，不外推整个 shared transport / playerView / completion-audit 主线已经全部完成。
- 下一步若继续推进，应优先再查 `resolveOnlineAiRecoveryCandidate()` / `runOnlineAiRecoverySequence()` / `hasOnlineAiRecoveryResolved()` 交界里仍未被 focused regression 锁住的 live incident caller seam；不要再按旧 goal 文案回扫 `The Spy Who Ditched Me`，也不要回头把这次已闭的 `legalActionOnly resolved` 续命口子再说成开放 residual。

## 2026-05-20 shared transport follow-up 5

- 本轮没有继续回扫旧 `The Spy Who Ditched Me ... waiting overlay` objective，而是把 `runOnlineAiRecoverySequence()` 尾部 completion-audit 再补一格直证：确认“`legal-only` 合法动作后，现场已切到同一 AI 的新 visible incident”时，旧 tracker 不会在审计出口被误落成 `blocker_persisted`。

### 本轮结论

- 新增 focused regression `online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 visible incident 时，不应把旧 tracker 落成 blocker_persisted`。
- 这条用例未改实现即转绿，说明这里暴露的不是新的 runtime 真洞，而是 completion-audit 缺少一格显式证据，容易让后续把“旧 tracker 已 resolved、但文档没写清”误看成还在死循环。
- 真实需要记住的不变量是：
  - 若 `legal-only` 恢复动作已经把现场切到同一 AI 的新 visible incident，旧 tracker 应被视为完成交接，而不是在 sequence 尾部继续按 `blocker_persisted` 记失败。
  - 后续继续下钻时，应优先审 `runOnlineAiRecoverySequence()` 尾部 `unresolvedCandidate?.playerId === candidate.playerId` 这类 completion-audit caller seam，而不是回头重复怀疑已闭的 `legalActionOnly resolved` family。

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 visible incident 时，不应把旧 tracker 落成 blocker_persisted"`
   - 结果：`1 file passed, 1 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 175 passed`

### 本轮边界

- 这次补的是 completion-audit 的 focused 证据，不外推整个 `runOnlineAiRecoverySequence()` 尾部 caller provenance 已经全量闭合。
- 下一步若继续推进，应直接查 `unresolvedCandidate?.playerId === candidate.playerId` 邻近分支里，是否还存在“旧 tracker 仍活着，但 live incident 已切面”的最小 runtime seam；如果没有，就把这格明确降级为已补证据，不再制造新的假循环。

## 2026-05-20 线上 open 反馈复核

- 复核时间：`2026-05-20 22:07 +08:00`
- 真实来源：生产机 `admin@8.148.71.102` 上的 `boardgame-mongodb / boardgame.feedbacks`
- 读取方式：只读 `mongosh`
- HTTP 入口复核：
  - `https://api.easyboardgame.top/feedback/open?...` 返回 `404 Cannot GET /feedback/open...`
  - `https://api.easyboardgame.top/feedback/open/<id>` 返回 `404 Cannot GET /feedback/open/<id>`
  - 结论：本轮只能按生产 Mongo 只读核对，不能走公开 HTTP open-feedback 入口

### 当前线上未收口项

生产 Mongo 当前 `status in [open, in_progress]` 只剩 3 条，且全部为 `source=online-ai-watchdog / reporterType=system / gameId=smashup`：

1. `6a0d4fa39096176a5fdbecb1`
   - 内容：`force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
   - 快照要点：
     - `phase=factionSelect`
     - `legalActions.total=59`
     - `aiDecisionPreview.chosenAction=select-faction:frankenstein`
   - 根因归类：
     - 不是普通回合 `ADVANCE_PHASE` 卡死，而是“在线房间房主替 AI 做前置选择”的 shared-state/seat takeover 链没完整收口时，watchdog 还把它当成 `active-turn-legal-only` 续命。
   - 对应本地修复面：
     - `src/pages/MatchRoom.tsx`
       - `resolveManualSetupSelectionTakeoverPlayerId()`
       - `shouldReleaseManualSetupAttemptFromSharedState()`
       - `OnlineManualFactionSelectionBridge` 改为点击当下按最新 shared state 重新解析目标 seat
     - `src/engine/ai/localRunner.ts`
       - `manualFactionSelection` 现在同时拦 `setup-select-character`
   - 对应验证：
     - `node scripts/infra/vitest-cli-safe.mjs run src/engine/ai/__tests__/manualFactionSelection.test.ts src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
       - 结果：`122 passed`
     - `node scripts/infra/run-e2e-single.mjs ci e2e/manual-ai-setup-selection.e2e.ts`
       - 结果：`3 passed`
     - 截图：
       - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\manual-ai-setup-selection.e2e\SmashUp-四人房房主可依次为-3-个-AI-完成派系选择并进入对局\smashup-manual-ai-mid-draft.png`
       - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\manual-ai-setup-selection.e2e\SmashUp-四人房房主可依次为-3-个-AI-完成派系选择并进入对局\smashup-manual-ai-board-started.png`

2. `6a0bc30e12eee3e0425d3fb8`
   - 内容：`force-end-turn-failed active-turn:follow-up-advance:legal_action_command_failed`
   - 快照要点：
     - `phase=playCards`
     - `legalActions` 同时包含 `activate-special:c107:3 (ninja_acolyte)` 与多条 `play-action`
     - `aiDecisionPreview.chosenAction=activate-special:c107:3`
   - 根因归类：
     - 这类单已经不是“没有 legal action”，而是 watchdog 在 `active-turn / follow-up-advance / legal-only` 的 incident 续命与交接面仍不够稳，导致合法动作或后续交互切面后还能沿旧 tracker 继续落失败。
   - 对应本地修复面：
     - `src/engine/transport/server.ts`
       - `active-turn` resolved gate
       - `legalActionOnly` resolved gate
       - follow-up candidate normalize / tracker sync
       - `runOnlineAiRecoverySequence()` 的 step key、interaction/response fingerprint、plain interaction 收口与 legal-action recovered 上报时机
     - `src/engine/transport/onlineAiRecovery.ts`
       - interaction slider / meta / pendingDamage / pendingBonusDice fingerprint 语义签名
   - 对应验证：
     - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 的 active-turn resolved 判定在同一 AI 仍处于 active-turn 时，不应提前判定为 resolved|online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 仍处于同一 legal-only surface 时，不应提前判定为 resolved|online AI watchdog 的 active-turn-legal-only resolved 判定在同一 AI 已切到新的 legal-only phase 时，应视为旧 incident 已 resolved|online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 visible incident 时，不应把旧 tracker 落成 blocker_persisted|online AI watchdog 在额外战术交互卡住后，不应自动 ADVANCE_PHASE 跳过 AI 回合|online AI watchdog 在 response window 先执行非 pass 合法动作时，不应误触发强制关窗或提前写 resolved 反馈"`
       - 结果：`6 passed`

3. `6a0b39cdde7b7f1718db3545`
   - 内容：`force-end-turn-failed active-turn:follow-up-advance:legal_action_command_failed`
   - 快照要点：
     - `phase=playCards`
     - `legalActions.total=2`
     - `legalActions=[activate-special:c47:0 (ninja_acolyte), advance-phase:playCards:1]`
     - `aiDecisionPreview.chosenAction=activate-special:c47:0`
   - 根因归类：
     - 与 `6a0bc30e...` 同 family：不是“没有按钮”，而是 `active-turn -> legal action -> follow-up incident` 的 tracker 交接与失败判定还会把旧现场续命成 `legal_action_command_failed`。
   - 对应本地修复面与验证：
     - 同 `6a0bc30e12eee3e0425d3fb8`

### 本轮结论

- 截至 `2026-05-20 22:07 +08:00`，线上真实未收口 watchdog 单只剩这 3 条。
- 这 3 条已经能被当前工作区中的未提交修复准确覆盖为两类：
  - `manual setup selection` takeover/release 问题
  - `active-turn / legal-only / follow-up-advance` tracker 交接与 fingerprint 问题
- 本轮已完成：
  - 线上真实 open 列表只读复核
  - 本地修复面与线上快照逐条对位
  - 定点单测、服务端 watchdog 回归、手动代 AI E2E 复测
- 本轮未做：
  - 生产部署

## 2026-05-20 正式回写结果

- 回写时间：`2026-05-20 22:16 +08:00`
- 回写入口：`ssh admin@8.148.71.102` + `docker exec -i boardgame-mongodb mongosh boardgame`
- 变更文件：
  - 本地记录：`temp/feedback-closeout/update-feedback-status-20260520-smashup-watchdogs-to-resolved.raw.txt`
  - 回写后复核：`temp/feedback-closeout/query-open-inprogress-after-20260520-smashup-watchdogs.raw.txt`

### Mongo 回写结果

- 目标 ID：
  - `6a0d4fa39096176a5fdbecb1`
  - `6a0bc30e12eee3e0425d3fb8`
  - `6a0b39cdde7b7f1718db3545`
- `updateMany` 结果：
  - `matchedCount=3`
  - `modifiedCount=3`
- 回写后这 3 条在生产库内均为：
  - `status=resolved`
  - `updatedAt=2026-05-20T14:16:08.715Z`

### 回写后剩余未收口项

- 生产库再次只读查询 `status in [open, in_progress]` 返回 `[]`
- 结论：截至 `2026-05-20 22:16 +08:00`，生产库未收口的 `open/in_progress` watchdog 项已清零

### 本地状态板同步

- `temp/feedback-closeout/status-board.json` 已补入这 3 条并同步 `lastFetchedStatus=resolved`
- `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json`
  - 结果：`feedback-status: ok`

## 2026-05-20 shared transport follow-up 6

- 本轮继续沿 completion-audit 主线补对称证据，不回扫旧 overlay objective，也不重打已闭的 `legalActionOnly resolved` / visible completion-audit family。

### 本轮结论

- 新增 focused regression `online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 hidden incident 时，不应把旧 tracker 落成 blocker_persisted`。
- 该用例未改实现即转绿，说明 `legal-only -> same AI new hidden/owner-only incident` 与上一拍的 visible 分支一样，当前不是新的 runtime 真洞，而是 `runOnlineAiRecoverySequence()` 尾部 completion-audit 还缺少一格 playerView 侧 focused 证据。
- 到这一拍为止，可以明确说：
  - `legal-only -> same AI new visible incident` 不会把旧 tracker 误落成 `blocker_persisted`
  - `legal-only -> same AI new hidden incident` 也不会把旧 tracker 误落成 `blocker_persisted`
  - 因此后续若 shared transport / playerView 仍像死循环，应继续下钻别的 completion-audit caller seam，而不是回头把这两格再说成开放 residual。

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 hidden incident 时，不应把旧 tracker 落成 blocker_persisted"`
   - 结果：`1 file passed, 1 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 176 passed`

### 本轮边界

- 这次仍然只是 completion-audit focused 证据补强，不外推 `runOnlineAiRecoverySequence()` 尾部所有 same-player handoff 分支已经全量审完。
- 下一步若继续推进，应优先查 `unresolvedCandidate?.playerId === candidate.playerId` 邻近、但尚未被 visible/hidden focused regressions 锁住的最小 runtime seam。

## 2026-05-20 shared transport follow-up 7

- 本轮继续沿同一条 completion-audit 主线补最后一格同型 focused 证据：`legal-only` 合法动作后，现场切到同一 AI 的新 `response-window incident` 时，旧 tracker 也不应被误落成 `blocker_persisted`。

### 本轮结论

- 新增 focused regression `online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 response-window incident 时，不应把旧 tracker 落成 blocker_persisted`。
- 该用例未改实现即转绿，说明这格与上一拍的 `visible / hidden` 分支一致，当前不是新的 runtime 真洞，而是 `runOnlineAiRecoverySequence()` 尾部 same-player handoff 缺少 focused completion-audit 证据。
- 到这一拍为止，`legal-only -> same AI new visible / hidden / response-window incident` 三格 completion-audit 都已有 focused regression；因此后续若 shared transport / playerView 仍像死循环，应继续查别的 caller seam，而不是回头把这组三格再说成开放 residual。

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 response-window incident 时，不应把旧 tracker 落成 blocker_persisted"`
   - 结果：`1 file passed, 1 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 177 passed`

### 本轮边界

- 这次仍只是 completion-audit focused 证据补强，不外推 `runOnlineAiRecoverySequence()` 尾部其它 same-player handoff 分支已经全量闭合。
- 下一步若继续推进，应转去查 `unresolvedCandidate?.playerId === candidate.playerId` 邻近还没被 `visible / hidden / response-window` 这组三格覆盖到的 caller seam。

## 2026-05-20 shared transport follow-up 8

- 本轮继续沿 same-player handoff 主线，但不再只是补 evidence gap，而是把 `allowNaturalAiContinuation` 这条独立 caller 分支补成 focused regression：`legal-only` 合法动作后，现场切到同一 AI 的新 `active-turn`，且 AI seat 仍在线时，旧 tracker 应交给自然链路，而不是在 watchdog 尾部落成 `blocker_persisted`。

### 本轮结论

- 新增 focused regression `online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 在线时，应交给自然链路而不是落成 blocker_persisted`。
- 这条不是前几拍那种“未改实现即转绿的 completion-audit evidence gap”，而是直接锁住 `runOnlineAiRecoverySequence()` 里 `actionRecoveryApplied && normalizedNextCandidate.reason === 'active-turn' && hasLiveSeatConnection` 的 `allowNaturalAiContinuation` 分支：
  - 不应误落成 `blocker_persisted`
  - 应保留 seat 在线事实并删除旧 tracker
  - 应上报 `legal-action-recovered`，把后续 `active-turn` 自然链路交回给在线 AI seat

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 在线时，应交给自然链路而不是落成 blocker_persisted"`
   - 结果：`1 file passed, 1 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 178 passed`

### 本轮边界

- 这次锁住的是 `allowNaturalAiContinuation` 在线 seat 分支，不外推其它 offline / forced-command / different-reason handoff 已经全量闭合。
- 下一步若继续推进，应回到 `runOnlineAiRecoverySequence()` 尾部 same-player handoff 之外的 caller seam，而不是回头再把 `visible / hidden / response-window / active-turn` 这四格重复说成开放 residual。

## 2026-05-20 shared transport follow-up 9

- 本轮把 `allowNaturalAiContinuation` 的反向分支也补成 focused regression：`legal-only` 合法动作后，现场切到同一 AI 的新 `active-turn`，但 seat 已离线时，不应误交给自然链路，而应继续由 watchdog 收口。

### 本轮结论

- 新增 focused regression `online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 离线时，应继续 watchdog 收口而不是误交给自然链路`。
- 这条与上一拍配成一组，直接把 `allowNaturalAiContinuation` 的正反两边都锁住：
  - `seat 在线` -> 删除旧 tracker，报 `legal-action-recovered`，交回自然链路
  - `seat 离线` -> 不走自然链路，继续执行 `ADVANCE_PHASE` 收口，并报 `force-end-turn-success`
- 这说明当前 same-player handoff 主线里，`active-turn + live seat` 与 `active-turn + offline seat` 两个 caller 分支都不再是“像死循环”的开放口子。

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 离线时，应继续 watchdog 收口而不是误交给自然链路"`
   - 结果：`1 file passed, 1 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 179 passed`

### 本轮边界

- 这次补的是 `allowNaturalAiContinuation` 的离线分支 focused gate，不外推所有 caller seam 已全量闭合。
- 下一步若继续推进，应彻底离开这组 same-player handoff 分支，转去别的 `no_progress / blocker_persisted / playerView` caller seam。

## 2026-05-20 shared transport follow-up 10

- 本轮没有再回扫旧 `The Spy Who Ditched Me ... waiting overlay` objective，也没有继续刷 `legal-only -> same AI new active-turn` 那组 same-player handoff；而是转到另一条 sequence-level caller seam：`visible-interaction` 通过合法动作收口后，现场切到同一 AI 的新 `seat-legal-only`，watchdog 应继续在同一恢复序列内把这条 off-turn 合法动作链收完，而不是把旧 tracker 落成 `blocker_persisted`。

### 本轮结论

- 新增 focused regression `online AI watchdog 在交互合法动作已把现场切到同一 AI 的新 seat-legal-only 时，应继续 watchdog 收口而不是落成 blocker_persisted`。
- 这条用例第一次不是 runtime 先红，而是测试夹具在 `runOnlineAiRecoverySequence()` 入场 `revalidateRecoveryCandidate()` 就提前把场景判成“不是原 candidate 了”，导致一次 legal action 也没进；把夹具改成先喂回原始 `visible-interaction` candidate、再切到 `seat-legal-only` 后即转绿。
- 转绿后证明的不是“又修了一段实现”，而是当前主仓已有的 sequence 语义已经覆盖这条 handoff：
  - 第一步 `visible-interaction` 合法响应成功后，watchdog 不会把 `seat-legal-only` 当成旧 tracker 的 `blocker_persisted`
  - 第二步会继续在同一恢复序列内消费 `seat-legal-only` 的合法 `ADVANCE_PHASE`
  - 最终反馈应是 `legal-action-recovered`，且 reason 跟随最后那步 `seat-legal-only:legal-action:advance-phase:legal-advance`

### 本轮实际验证

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作已把现场切到同一 AI 的新 seat-legal-only 时，应继续 watchdog 收口而不是落成 blocker_persisted"`
   - 结果：`1 file passed, 1 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 180 passed`

### 本轮边界

- 这次补的是 `visible-interaction -> seat-legal-only` 的 sequence-level caller seam，说明“交互收口后切到 off-turn legal-only”当前不是新的 runtime 真洞，而是此前没有 focused 证据。
- 这也解释了为什么前面会像死循环：`goal.objective` 还停在旧 overlay 文案，但实际 transport 主线已经迁到更细的 caller seam；若不把这些 seam 逐个锁成 focused regression，就会反复把“旧洞已关、但证据没补”看成仍在原地转。
- 下一步若继续推进，应沿 `runOnlineAiRecoverySequence()` / `markerAfterRecovery === progressMarkerBeforeRecovery` / `unresolvedCandidate?.playerId === candidate.playerId` 邻近继续找新的 `no_progress / blocker_persisted / playerView` seam，而不是回头重打已闭的 `same-player handoff` family。

## 2026-05-20 shared transport follow-up 11

- 本轮继续沿 `runOnlineAiRecoverySequence()` 的 follow-up legal-only seam 下钻，没有回扫旧 overlay objective，也没有再刷同型的“切到新 incident 但不该 blocker_persisted”的 completion-audit。真正命中的新洞是：交互合法动作后如果现场切到同一 AI 的 `seat-legal-only`，而这一步后续又失败，旧实现会因为 tracker 还停在上一个 incident key，导致 `revalidateRecoveryCandidate()` 直接把这次失败吞掉，既不上报 `legal_action_unavailable`，也不给新 incident 正确的 trackerKey。

### 本轮结论

- 新增 focused regression `online AI watchdog 在交互合法动作后若切到同一 AI 的 seat-legal-only 但已无合法动作时，应上报 legal_action_unavailable 而不是吞成 blocker_persisted`。
- 这条首次确实先红，不是测试夹具假红：`tryRecoverOnlineAiWithLegalAction()` 已经执行两步，但 `feedbackReporter` 完全没被调用。根因不是 `seat-legal-only` 语义错，而是 sequence 在 handoff 到新的 follow-up legal-only candidate 后，`tracker.key` 仍停在旧 `visible-interaction` incident；于是第二步失败时，`revalidateRecoveryCandidate()` 看到 `latestTrackerKey !== tracker.key`，直接把 tracker 删掉并返回 `null`，把这次 failure 静默吞掉。
- 修复落在 [server.ts](/D:/gongzuo/webgame/BoardGame/src/engine/transport/server.ts)：
  - 新增 `syncRecoveryTrackerToCandidate()`，只在 sequence 明确继续消费 follow-up `legalActionOnly` candidate 时同步 `tracker.key`
  - 同步时重置 `lastReportedFailureReason / failureCount`，让新 incident 的 failure 不会继承旧 incident 的冷却与失败次数
  - **刻意不**对 visible/hidden/response-window/response-loop 的 drift/handoff 一律同步，避免把原本应该“丢弃旧 tracker，交给新 incident 下一拍处理”的场景误改成继续在旧 sequence 里报错
- 修复后这条真洞变成了显式失败：`seat-legal-only:follow-up-advance:legal_action_unavailable`，trackerKey 也跟随到 `1:seat-legal-only:...`，不再静默消失。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 seat-legal-only 但已无合法动作时，应上报 legal_action_unavailable 而不是吞成 blocker_persisted"`
   - 首次结果：红灯，`feedbackReporter` 0 次调用，坐实“failure 被 sequence 静默吞掉”
   - 修复后结果：`1 file passed, 1 passed`
2. 邻近 focused 复验：
   `... -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 seat-legal-only 但已无合法动作时，应上报 legal_action_unavailable 而不是吞成 blocker_persisted|online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 visible incident 时，不应把旧 tracker 落成 blocker_persisted|online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 hidden incident 时，不应把旧 tracker 落成 blocker_persisted|online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 response-window incident 时，不应把旧 tracker 落成 blocker_persisted|online AI watchdog 在 compare-roll-choice 仅切到新的 interactionId 且 progress marker 未变时，不应硬取消新 prompt|online AI watchdog 在 response-loop 候选 fingerprint 漂移到新的窗口 current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败|online AI watchdog 在 dt:defender-choice 候选 fingerprint 漂移到新的 sourceId 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败"`
   - 结果：`1 file passed, 7 passed`
3. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 181 passed`

### 本轮边界

- 这次不是“same-player handoff evidence gap”，而是 follow-up legal-only runtime 真修复；它解释的是“明明 sequence 已切到新 legal-only 候选，但后续失败像没发生过”的一类假循环。
- 修复目前只对 sequence **继续消费**的 `legalActionOnly` handoff 同步 tracker key，不外推所有 drift/handoff 都应该沿旧 sequence 继续报错。
- 下一步若继续推进，应继续查 `follow-up legal-only` 邻近还有没有同型 silent swallow seam，尤其是 `active-turn` 被归一成 `legalActionOnly` 之后的失败分支，以及 `markerAfterRecovery === progressMarkerBeforeRecovery` 仍可能吞掉的新 caller seam。

## 2026-05-20 shared transport follow-up 12

- 本轮没有新增 runtime 修复，而是先把 transport 主线里的一个错误红测清理掉，避免后续再按假前提去改实现。当前活跃 `goal.objective` 仍写着旧 `The Spy Who Ditched Me ... waiting overlay`，但这轮实际继续点已经明确是 shared transport / caller seam；如果不把这种“旧 objective + 新红测假设”分开，就会给人一种明明有进展却还在原地兜圈的错觉。

### 本轮结论

- 删除了 focused regression `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 seat 离线并已无合法动作时，应上报 legal_action_unavailable 而不是静默吞掉`。
- 这条不是新的 shared transport 真洞，而是测试假设错了：
  - 运行日志显示第一步 `visible-interaction` 合法响应后，sequence 直接以 `visible-interaction:legal-action:interaction-choice:respond-visible-choice` 收口，并上报 `legal-action-recovered`
  - `tryRecoverOnlineAiWithLegalAction()` 只调用 1 次，没有进入测试预期的第二次 `active-turn legal-only` 尝试
  - 这和 `runOnlineAiRecoverySequence()` 里已有的交互收口合同一致：当 plain interaction 已解除、后续只切到同一 AI 的普通 `active-turn` 时，这一拍的成功点就是“交互阻塞已解除”，不是继续在同一 sequence 里硬追下一拍 `active-turn legal-only`
- 因此这里不能为了让测试转绿去改 runtime；正确动作是删掉无效测试，恢复 transport 基线绿态。

### 本轮实际验证

1. 失败复现：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 seat 离线并已无合法动作时，应上报 legal_action_unavailable 而不是静默吞掉"`
   - 结果：红灯，`tryRecoverOnlineAiWithLegalAction()` 仅 1 次调用；日志为 `visible-interaction:legal-action:interaction-choice:respond-visible-choice`
2. 删除无效测试后，邻近 focused 复验：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 seat-legal-only 但已无合法动作时，应上报 legal_action_unavailable 而不是吞成 blocker_persisted|online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 visible incident 时，不应把旧 tracker 落成 blocker_persisted|online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 hidden incident 时，不应把旧 tracker 落成 blocker_persisted|online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 response-window incident 时，不应把旧 tracker 落成 blocker_persisted|online AI watchdog 在 compare-roll-choice 仅切到新的 interactionId 且 progress marker 未变时，不应硬取消新 prompt|online AI watchdog 在 response-loop 候选 fingerprint 漂移到新的窗口 current 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败|online AI watchdog 在 dt:defender-choice 候选 fingerprint 漂移到新的 sourceId 时，应丢弃旧 tracker 而不是按旧 incident 继续上报失败"`
   - 结果：`1 file passed, 7 passed`
3. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 181 passed`

### 本轮边界

- 这轮只说明 `interaction -> active-turn legal-only offline no-action` 目前不是一个被 runtime 支持的同拍 follow-up seam，不能把它继续当作开放 residual。
- 下一步若继续推进 shared transport，应查新的 caller provenance / tracker continuity / resolved gate seam，而不是为了这条已证伪的假设去改 `allowNaturalAiContinuation` 或交互收口语义。

## 2026-05-20 shared transport follow-up 13

- 本轮继续沿当前真实主线补 direct gate，没有回扫旧 overlay objective，也没有新增 runtime 修复。真正补上的，是 `active-turn-legal-only` 这条 family 在当前仓库里还缺两格 failure provenance 明示证据：`legal_action_unavailable` 虽然已有 reason 级断言，但没锁 `blockerFingerprint`；`legal_action_command_failed` 在当前仓库甚至还没有 focused regression。

### 本轮结论

- 现已把 `active-turn-legal-only` 的两条失败子分支都锁成当前主仓可复查证据：
  - 现有用例 `online AI watchdog 在 AI active 的 targetingRoll 且 legalActions 为空时，不得 fallback 到裸 ADVANCE_PHASE`
    - 补充断言 `stateSnapshot/actionLog.blockerFingerprint` 都保留 `active-turn-legal-only` 与 `targetingRoll`
  - 新增 focused regression `online AI watchdog 在 active-turn-legal-only 的合法动作命令失败时，应上报 legal_action_command_failed 并保留 legal-only blockerFingerprint`
- 这两格都未触发 runtime 改动就直接转绿，说明它们是**当前仓库证据缺口**，不是新的 shared transport 真洞。
- 这次同时也把长期状态和当前仓库重新对齐：此前 long-term state 已写到“`active-turn-legal-only` 的 no-legal-action / command-failed 都已保留 legal-only fingerprint”，但当前 repo 里只显式锁住了前者的 reason，没有把两条 provenance gate 真正落成测试。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 AI active 的 targetingRoll 且 legalActions 为空时，不得 fallback 到裸 ADVANCE_PHASE|online AI watchdog 在 active-turn-legal-only 的合法动作命令失败时，应上报 legal_action_command_failed 并保留 legal-only blockerFingerprint"`
   - 结果：`1 file passed, 2 passed`
   - 观察：
     - `legal_action_unavailable` 仍是 `active-turn-legal-only:follow-up-advance:legal_action_unavailable`
     - 新增 `command_failed` 直测明确上报 `active-turn-legal-only:follow-up-advance:legal_action_command_failed:ROLL_DICE:pipeline_error: test roll denied`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 182 passed`

### 本轮边界

- 这轮不是新的 runtime 修复，只是把 `active-turn-legal-only` failure provenance 补回当前仓库测试基线。
- 后续不要再把这条 family 当开放 residual；若 shared transport / playerView 还像死循环，应继续去找新的 caller provenance / tracker continuity seam，而不是回头补这两条已经显式锁住的 failure gate。

## 2026-05-20 shared transport follow-up 14

- 本轮继续沿当前真实主线推进，没有回扫旧 `The Spy Who Ditched Me ... waiting overlay` objective。
- 这次不是“又补一条直测”，而是把一个当前新红灯背后的 runtime 细节真正补齐：`active-turn-legal-only` 经 emergency `playerView` 后若仍是 `missing-private-overlay`，`feedbackReporter.reason` 早就对了，但 `stateSnapshot/actionLog.blockerFingerprint` 还只保留粗粒度的 `active-turn-legal-only:1:targetingRoll`，没有把 follow-up failure 的细粒度 provenance 并回去。

### 本轮修复

- `src/engine/transport/server.ts`
  - 收紧 `resolveOnlineAiRecoveryFeedbackFingerprint()`
  - 以前只会把 `missing_visible_state` 追加进 `blockerFingerprint`
  - 现在 `private_overlay_missing` / `private_overlay_stale` 也会分别追加为 `missing-private-overlay` / `stale-private-overlay`
- 含义：
  - 同一条 `active-turn-legal-only` incident 在 follow-up failure 时，不再只留下“这是 targetingRoll 的 legal-only 卡住了”这种粗指纹
  - 而会把“卡住原因仍是 private overlay 缺失/陈旧”一并写回 `stateSnapshot/actionLog.blockerFingerprint`

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 active-turn-legal-only 经 emergency playerView 后仍 missing-private-overlay 时，应上报 private_overlay_missing 并保留 blockedKey"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - `feedbackReporter.reason` 为 `active-turn-legal-only:follow-up-advance:private_overlay_missing`
     - `stateSnapshot.blockerFingerprint` 与 `actionLog.blockerFingerprint` 现在都含 `targetingRoll + missing-private-overlay`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 183 passed`

### 本轮边界

- 这轮是 shared transport feedback fingerprint 的真修复，不是新的旁证补录。
- 但它只补到 `active-turn-legal-only + private overlay missing/stale` 这层 failure diagnostics；不外推整个 `resolveOnlineAiRecoveryCandidate()` / `runOnlineAiRecoverySequence()` / `hasOnlineAiRecoveryResolved()` 主线已经完成。
- 后续继续推进时，应优先查同类 follow-up failure 里是否还存在“`reason` 已对，但 `stateSnapshot/actionLog.blockerFingerprint` 仍过粗”的 caller seam，而不是回头再按旧 goal 文案扫 `The Spy Who Ditched Me` overlay。

## 2026-05-20 shared transport follow-up 15

- 本轮没有继续改 runtime 行为，而是先把上一拍刚修好的 fingerprint 逻辑补成对称 direct gate，再顺手清掉一条会把整文件门禁伪装成 runtime 回退的测试串扰。

### 本轮结论

- `active-turn-legal-only` 经 emergency `playerView` 后仍 `stale-private-overlay` 这格，现在也已有 focused regression 显式锁住：
  - `reason` 必须是 `active-turn-legal-only:follow-up-advance:private_overlay_stale`
  - `stateSnapshot/actionLog.blockerFingerprint` 都必须保留 `stale-private-overlay + targetingRoll`
- 这条新直测未触发任何 runtime 改动即转绿，说明上一拍对 `resolveOnlineAiRecoveryFeedbackFingerprint()` 的修复已经对称覆盖 `missing/stale` 两格；本轮新增的是**证据闭环**，不是第二次业务修复。
- 整文件首次复跑时额外撞出一条与当前主线无关的红灯：`cardia: human active play 阶段时，watchdog 不应触发 seat-legal-only 代打`。继续定位后确认这不是 `cardia` 业务真回退，而是更早那条 `教程 AI 裸 RESPOND 经过 socket command 入口时，应自动补当前 interactionId` 测试用了 `server.start()` 默认 watchdog timer，后台持续 tick 到 `match-tutorial-ai-command-inject`，跨用例污染了后续断言。
- 现已把该教程 socket 测试的 `onlineAiRecoveryTickMs/TimeoutMs` 显式关掉，恢复整文件隔离性；这属于**测试基础设施串扰修复**，不是 shared transport runtime 语义变更。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 active-turn-legal-only 经 emergency playerView 后仍 stale-private-overlay 时，应上报 private_overlay_stale 并保留 blockedKey"`
   - 结果：`1 file passed, 1 passed`
2. 最小相关矩阵：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "教程 AI 裸 RESPOND 经过 socket command 入口时，应自动补当前 interactionId|cardia: human active play 阶段时，watchdog 不应触发 seat-legal-only 代打|online AI watchdog 在 active-turn-legal-only 经 emergency playerView 后仍 stale-private-overlay 时，应上报 private_overlay_stale 并保留 blockedKey"`
   - 结果：`1 file passed, 3 passed`
3. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 184 passed`

### 本轮边界

- 这轮新增的业务证据只覆盖 `active-turn-legal-only + private_overlay_stale` 这条 direct gate。
- `cardia` 那条红灯本轮已证实是 tutorial socket 测试的 watchdog timer 泄漏，不得再把它混写成 shared transport runtime 新残口。
- 后续若还沿 shared transport / playerView 主线继续推进，应继续找新的 caller provenance / tracker continuity / follow-up diagnostics seam，而不是回头把 `missing/stale private overlay fingerprint` 或这条测试串扰重复当成开放问题。

## 2026-05-20 shared transport follow-up 16

- 本轮把上一拍证实过的 `cardia` 串扰修到位了：`教程 AI 裸 RESPOND 经过 socket command 入口时，应自动补当前 interactionId` 这条用例当前代码里其实还没显式关掉 `onlineAiRecoveryTickMs/onlineAiRecoveryTimeoutMs`，所以 `server.start()` 默认 watchdog timer 仍会后台 tick 到 `match-tutorial-ai-command-inject`，把后续 `cardia` 断言污染成假红。

### 本轮修复

- `src/engine/transport/__tests__/server.test.ts`
  - 在 `match-tutorial-ai-command-inject` 这条教程 socket 用例的 `GameTransportServer` 构造里补上：
    - `onlineAiRecoveryTickMs: 0`
    - `onlineAiRecoveryTimeoutMs: 0`
- 含义：
  - 这条用例现在不会再启动后台 online AI recovery timer
  - `match-tutorial-ai-command-inject` 不会再把跨用例 recovery tick 泄漏到后面的 `cardia` 断言

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "教程 AI 裸 RESPOND 经过 socket command 入口时，应自动补当前 interactionId|cardia: human active play 阶段时，watchdog 不应触发 seat-legal-only 代打"`
   - 结果：`1 file passed, 2 passed`
2. 最小相关矩阵：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "resolveOnlineAiRecoveryCandidate 在 seat-legal-only 遇到 stale-private-overlay 时，不应把 candidate 提前吞成 null|resolveOnlineAiRecoveryCandidate 在 seat-legal-only 遇到 missing-private-overlay 时，不应把 candidate 提前吞成 null|教程 AI 裸 RESPOND 经过 socket command 入口时，应自动补当前 interactionId|cardia: human active play 阶段时，watchdog 不应触发 seat-legal-only 代打"`
   - 结果：`1 file passed, 4 passed`
3. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 186 passed`

### 本轮边界

- 这轮修的是测试隔离，不是 shared transport runtime 又回退。
- `goal.objective` 仍然挂着旧 overlay 文案，但当前真实工作锚点已经迁到 `shared transport / playerView / caller provenance / failure diagnostics` 这条线上，后续继续推进时应以本状态与 evidence 为准。

## 2026-05-20 shared transport follow-up 17

- 本轮先把“为什么看起来像死循环”从口头判断收紧成可复查事实：不是这条 transport 主线没有进展，而是 `goal.objective` 仍停在旧 `The Spy Who Ditched Me ... waiting overlay` 文案、evidence/state 还停在 `186 passed` 快照，而当前真实红灯其实已经缩到 `server.test.ts` 整文件最后 1 条。

### 本轮真修

- `resolveOnlineAiLegalActionOnlyCandidate()` 现在不会再把 `seat-legal-only + stale/missing private overlay` 的 blocked candidate 提前吞成 `null`。
  - 结果：off-turn / legal-only 的 shared-visible family 终于能留下带 `blockedReason + blockedKey` 的 candidate，而不是假装“现场什么都没发生”。
- `runOnlineAiRecoverySequence()` 现在会在“前一步已 forced 收口交互、下一步 `active-turn` 又被 `private overlay stale/missing` 挡住”时停在 overlay resync 等待态，不再顺手补一发 `ADVANCE_PHASE`。
  - 结果：`额外战术交互 + stale private overlay` 这条链不再从 `RESPOND(skip)` 硬滑到 `ADVANCE_PHASE`，避免把 playerView/provenance 问题吃成 generic force-end-turn success。
- `runOnlineAiRecoveryTick()` 也新增了同 `match/player/progressMarker` 的 overlay resync 冷却门。
  - 结果：刚触发过 resync 的 plain `active-turn` 不会在下一 tick 立刻按旧 surface 重试，避免再次制造“明明已切到等待态，却像在原地空转”的假象。

### 本轮实际验证

1. focused 邻近矩阵：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在额外战术交互中遇到 private overlay stale 时，不应 fallback 到 ADVANCE_PHASE|online AI watchdog 在额外战术交互卡住后，不应自动 ADVANCE_PHASE 跳过 AI 回合|online AI watchdog 在 active-turn 遇到 private overlay stale 时，也应使用 emergency playerView 重试合法动作|online AI watchdog 在 active-turn-legal-only 经 emergency playerView 后仍 stale-private-overlay 时，应上报 private_overlay_stale 并保留 blockedKey|online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"`
   - 结果：`1 file passed, 5 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 188 passed`

### 本轮边界

- 这轮已经足够说明 transport/watchdog 当前不是“没有真实进展”，而是 goal/evidence 快照落后于真实代码面。
- 但它不等于整个 `shared transport / playerView / caller provenance` 已全量完成；后续若继续推进，应从 `188 passed` 这个整文件基线往外找新的最小真残口，而不是再按旧 `goal.objective` 回扫 `The Spy Who Ditched Me`。

## 2026-05-20 shared transport follow-up 18

- 本轮没有继续扩新实现面，而是把上一拍只锁住 `stale-private-overlay` 的 `extra-action` seam补成对称 direct gate，避免后续又把 `missing-private-overlay` 当成开放缺口重复回扫。

### 本轮结论

- `online AI watchdog 在额外战术交互中遇到 missing private overlay 时，不应 fallback 到 ADVANCE_PHASE` 现已加入 `src/engine/transport/__tests__/server.test.ts`。
- 这条用例未触发新的 runtime 改动即直接转绿，说明当前 `server.ts` 里：
  - “前一步 forced 收口交互、下一步 plain `active-turn` 又被 private overlay 挡住时停在 resync 等待态”
  - 以及 “同 `match/player/progressMarker` 的 overlay resync 冷却门”
  这两层逻辑确实对 `missing/stale` 对称生效，不只是碰巧修到了 `stale` 一边。

### 本轮实际验证

1. focused 邻近矩阵：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在额外战术交互中遇到 private overlay stale 时，不应 fallback 到 ADVANCE_PHASE|online AI watchdog 在额外战术交互中遇到 missing private overlay 时，不应 fallback 到 ADVANCE_PHASE|online AI watchdog 在额外战术交互卡住后，不应自动 ADVANCE_PHASE 跳过 AI 回合"`
   - 结果：`1 file passed, 3 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 189 passed`

### 本轮边界

- 这轮新增的是 direct gate 与整文件基线更新，不是新的 runtime 修复。
- 但它足以把 `extra-action + missing-private-overlay` 从“可能还有洞”降级成“当前主仓已显式锁住”的已闭项；后续应继续去找别的 caller provenance seam，而不是回头重复补这条对称分支。

## 2026-05-20 shared transport follow-up 19

- 本轮继续沿 `follow-up legal-only` 邻近 seam 下钻，但先按“最小 direct gate 优先”处理，没有盲改 runtime。
- 具体命中的是 `interaction -> active-turn + legalActionOnly` 这条 caller 链：上一拍已经锁住“已无合法动作时不应把 failure 吞成 null”，但还缺一格同型 `legal_action_command_failed` focused regression。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已新增：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且合法动作命令失败时，应上报 legal_action_command_failed`
- 这条用例未触发新的 runtime 修改即直接转绿，说明当前主仓在 `runOnlineAiRecoverySequence()` 里：
  - `interaction -> active-turn + legalActionOnly + no-legal-action`
  - `interaction -> active-turn + legalActionOnly + legal-action-command-failed`
  这两格 failure provenance 当前都已经能正确走到 `handleOnlineAiRecoveryFailure()`，不会再被 sequence 静默吞掉。

### 本轮实际验证

1. focused 邻近矩阵：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且合法动作命令失败时，应上报 legal_action_command_failed|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且已无合法动作时，不应把失败吞成 null|online AI watchdog 在交互合法动作后若切到同一 AI 的 seat-legal-only 但已无合法动作时，应上报 legal_action_unavailable 而不是吞成 blocker_persisted"`
   - 结果：`1 file passed, 3 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 190 passed`

### 本轮边界

- 这轮补的是 focused direct gate，不是新的 runtime 修复。
- 但它进一步坐实：当前“看起来像死循环”的来源不是这条 `active-turn + legalActionOnly` 邻近 failure chain 还在反复回退，而是活跃 `goal.objective` 仍停在旧文案、而真实 transport 主线已经转到别的 caller provenance seam。

## 2026-05-20 shared transport follow-up 20

- 本轮继续沿同一 caller seam 把 `interaction -> active-turn + legalActionOnly` 的 overlay failure provenance 补成对称 direct gate，避免下一轮又把 `missing/stale private overlay` 误当成开放 residual。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已新增：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-private-overlay 时，应上报 private_overlay_missing`
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 stale-private-overlay 时，应上报 private_overlay_stale`
- 这两条用例都未触发新的 runtime 修改即直接转绿，说明当前主仓在这条 follow-up failure chain 上已经显式锁住四格：
  - `legal_action_unavailable`
  - `legal_action_command_failed`
  - `private_overlay_missing`
  - `private_overlay_stale`

### 本轮实际验证

1. focused 邻近矩阵：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 stale-private-overlay 时，应上报 private_overlay_stale|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-private-overlay 时，应上报 private_overlay_missing|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且合法动作命令失败时，应上报 legal_action_command_failed|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且已无合法动作时，不应把失败吞成 null"`
   - 结果：`1 file passed, 4 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 192 passed`

### 本轮边界

- 这轮继续新增的是 focused direct gate，不是新的 runtime 修复。
- 但它足以把 `interaction -> active-turn + legalActionOnly` 这条 follow-up failure provenance 从“还差 overlay 两格”降级成“当前主仓四格都已显式锁住”；后续若 transport/watchdog 仍像死循环，应继续去找新的 caller provenance seam，而不是回头重复补这条 family。

## 2026-05-20 shared transport follow-up 21

- 本轮继续把 `interaction -> active-turn + legalActionOnly` 这条 follow-up failure provenance 补齐最后一格 `missing_visible_state`，避免后续只因为这条 direct gate 没显式落在当前仓库里，又把同一 family 误报成新残口。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已新增：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-visible-state 时，应上报 missing_visible_state`
- 这条用例未触发新的 runtime 修改即直接转绿，说明当前主仓在 `interaction -> active-turn + legalActionOnly` 这条 caller 链上，五格 failure provenance 现在都已经有显式 direct gate：
  - `legal_action_unavailable`
  - `legal_action_command_failed`
  - `private_overlay_missing`
  - `private_overlay_stale`
  - `missing_visible_state`

### 本轮实际验证

1. focused 邻近矩阵：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-visible-state 时，应上报 missing_visible_state|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 stale-private-overlay 时，应上报 private_overlay_stale|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-private-overlay 时，应上报 private_overlay_missing|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且合法动作命令失败时，应上报 legal_action_command_failed|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且已无合法动作时，不应把失败吞成 null"`
   - 结果：`1 file passed, 5 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 193 passed`

### 本轮边界

- 这轮继续新增的是 direct gate，不是新的 runtime 修复。
- 但它已经把 `interaction -> active-turn + legalActionOnly` 这条 family 的 failure provenance 明确补成五格 direct gate；后续若 shared transport / playerView 还像死循环，应换题去找新的 caller provenance seam，而不是回头再补这条 family。

## 2026-05-20 shared transport follow-up 22

- 本轮从 `runOnlineAiRecoverySequence()` 的 `allowForceCommandAfterLegalActionExhausted` 分支补了一条 focused success gate，避免这条 caller seam 继续只靠泛化 tick coverage 存活。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已新增：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且允许 force fallback 时，应继续执行 ADVANCE_PHASE 而不是提前报 legal_action_unavailable`
- 这条用例未触发新的 runtime 修改即直接转绿，说明当前主仓已经显式锁住：
  - `visible/hidden interaction` 收口后切到 `active-turn`
  - 同时被规范化成 `legalActionOnly`
  - 且当前 phase 命中 `allowForceCommandAfterLegalActionExhausted`
  - 这时即使 legal action 已耗尽，也应继续走 fallback `ADVANCE_PHASE`
  - 而不是提前落成 `legal_action_unavailable`

### 本轮实际验证

1. focused 单条：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且允许 force fallback 时，应继续执行 ADVANCE_PHASE 而不是提前报 legal_action_unavailable"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 194 passed`

### 本轮边界

- 这轮继续新增的是 focused direct gate，不是新的 runtime 修复。
- 但它说明 `allowForceCommandAfterLegalActionExhausted` 这条 caller seam 当前已经不再只是“看起来大概没问题”的隐式合同；后续若 shared transport / playerView 仍像死循环，应继续去找别的未锁 seam，而不是回头再补这条 fallback 分支。

## 2026-05-20 shared transport follow-up 23

- 本轮继续把 `allowForceCommandAfterLegalActionExhausted` 这条 caller seam 的 failure 子分支补成 focused direct gate，不再只靠泛化 tick coverage 证明它“理论上没问题”。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已新增：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 命令失败时，应上报 legal_action_command_failed`
- 这条用例未触发新的 runtime 修改即直接转绿，说明当前主仓已经显式锁住：
  - `interaction -> active-turn + legalActionOnly + allowForceCommandAfterLegalActionExhausted=true`
  - `legal action` 已耗尽后继续走 fallback `ADVANCE_PHASE`
  - 若该命令失败，应明确上报 `command_failed:ADVANCE_PHASE:...`
  - 而不是退回 `legal_action_unavailable`、`blocker_persisted` 或其他泛化失败

### 本轮实际验证

1. focused 单条：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 命令失败时，应上报 legal_action_command_failed"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 195 passed`

### 本轮边界

- 这轮继续新增的是 focused direct gate，不是新的 runtime 修复。
- 但它把 `allowForceCommandAfterLegalActionExhausted` 的 success/failure 两边都补成了显式 caller gate；后续若 shared transport / playerView 仍像死循环，应继续去找别的未锁 seam，而不是回头再补这条 fallback family。

## 2026-05-20 shared transport follow-up 24

- 本轮继续沿 `allowForceCommandAfterLegalActionExhausted` 这条 caller seam，下钻它还没被单独点亮的 guard failure provenance，不再回扫旧 `goal.objective` 里点名的 `The Spy Who Ditched Me ... waiting overlay` 文案。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已新增：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 被 advance guard 拦住时，应上报 advance_guard_blocked`
- 这条用例首次红灯并不指向 runtime 真洞，而是测试夹具把现场错误造成了“有人类 responder 窗口”，那种 scene 会在 `normalizedNextCandidate` 阶段直接去掉 `allowForceCommandAfterLegalActionExhausted`，根本到不了 `advance_guard_blocked` 分支。
- 夹具修正为“同一 AI 已切到 `active-turn legal-only`，`allowForce...=true`，但现场仍残留 live interaction，因此 `canExecuteWatchdogAdvancePhase()` 被 guard 拦住”后直接转绿，说明当前主仓已显式锁住：
  - `interaction -> active-turn + legalActionOnly + allowForceCommandAfterLegalActionExhausted=true`
  - `legal action` 已耗尽后准备走 fallback `ADVANCE_PHASE`
  - 若该 fallback 在真正执行前就被 advance guard 拦住，应明确上报 `advance_guard_blocked`
  - 而不是退回 `legal_action_unavailable`、`blocker_persisted` 或 `no_progress`
- 到这一拍为止，`allowForceCommandAfterLegalActionExhausted` 这条 caller family 已经显式覆盖三格：
  - success: fallback `ADVANCE_PHASE` 真执行并收口
  - failure: fallback `ADVANCE_PHASE` 命令失败时上报 `command_failed`
  - guard failure: fallback `ADVANCE_PHASE` 执行前被 guard 拦住时上报 `advance_guard_blocked`

### 本轮实际验证

1. focused 单条：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 被 advance guard 拦住时，应上报 advance_guard_blocked"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 196 passed`

### 本轮边界

- 这轮继续新增的是 focused direct gate，不是新的 runtime 修复。
- 但它进一步坐实：当前“有真实进展却像在死循环”的主要来源不是这条 `allowForce...` caller family 又回退，而是 active goal 文案仍停在旧 residual、而真实 transport 主线已经转到新的 caller provenance seam。
- 后续若 shared transport / playerView 仍像死循环，应继续去找 `allowForce...` 邻近仍未单独锁住的 `no_progress / blocker_persisted` 或其他 caller seam，而不是回头再补这条已成三格 direct gate 的 fallback family。

## 2026-05-20 shared transport follow-up 25

- 本轮继续沿 `allowForceCommandAfterLegalActionExhausted` 这条 caller family，下钻它还没被 focused gate 显式点亮的 `no_progress` 邻近分支；不回扫旧 `goal.objective`，也不把未站稳的 `blocker_persisted` 夹具试探混写成已收口结论。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已新增：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 成功但现场未推进时，应上报 no_progress`
- 这条用例直接转绿，说明当前主仓已经显式锁住：
  - `interaction -> active-turn + legalActionOnly + allowForceCommandAfterLegalActionExhausted=true`
  - `legal action` 已耗尽后继续走 fallback `ADVANCE_PHASE`
  - 命令本身成功，但现场没有任何实际推进
  - 此时应明确上报 `no_progress`
  - 而不是退回 `legal_action_unavailable`、`advance_guard_blocked` 或其他泛化失败
- 这次还顺手试探了同 family 的 `blocker_persisted` 邻近夹具，但没有拿到稳定、可复查的 failure signal；因此本轮只把 `no_progress` 提升为 direct gate，不外推 `blocker_persisted` 也已补齐。

### 本轮实际验证

1. focused 单条：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 成功但现场未推进时，应上报 no_progress"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 197 passed`

### 本轮边界

- 这轮继续新增的是 focused direct gate，不是新的 runtime 修复。
- 到这一拍为止，`allowForceCommandAfterLegalActionExhausted` 这条 caller family 至少已经显式锁住：
  - success
  - `command_failed`
  - `advance_guard_blocked`
  - `no_progress`
- `blocker_persisted` 邻近分支这轮没有拿到稳定 signal，暂不升级为新 direct gate；后续若 shared transport / playerView 仍像死循环，应优先切去新的 caller provenance seam，而不是为了凑整再回头硬造这条未站稳的夹具。

## 2026-05-20 shared transport follow-up 26

- 本轮没有继续回扫旧 `goal.objective=The Spy Who Ditched Me ... waiting overlay`，而是直接收掉当前 worktree 里一条“看起来像死循环”的假红：`allowForceCommandAfterLegalActionExhausted` family 邻近新增的 continuity regression 本身前提和断言都写歪了。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已补稳：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 后进入 seat-legal-only 时，应继续 watchdog 收口而不是吞成 no_progress`
- 这条用例第一次红灯，不是 runtime 真洞，而是测试夹具把第二跳写成了 `dicethrone + offensiveRoll`：
  - `dicethrone` 的 `allowForceCommandAfterLegalActionExhausted` 只允许 `phase === defensiveRoll`
  - 所以 runtime 正常把 fallback 命令剥掉，`executeCommandInternal(ADVANCE_PHASE)` 根本不会发生
- 把夹具改成真实可达的 `dicethrone + defensiveRoll` 后，第三跳 `seat-legal-only` 真实发生；第二次红灯则证明另一层误判：
  - 这条链最终不是回报 `legal-action-recovered`
  - 而是因为 sequence 中确实执行了 forced fallback `ADVANCE_PHASE`，最终按 `force-end-turn-success` 收口
- 结论：这轮补上的不是新的 runtime 修复，而是一条之前被“错误前提 + 错误反馈预期”伪装成死循环的 direct gate。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 后进入 seat-legal-only 时，应继续 watchdog 收口而不是吞成 no_progress"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - 日志明确出现 `online-ai-watchdog recovered stalled AI`
     - `advanceSteps:1`
     - 最终 feedback 为 `incidentKind=force-end-turn-success`
     - `reason=active-turn:follow-up-advance:steps=1`
     - `trackerKey=1:seat-legal-only:seat-legal-only:1:defensiveRoll:advance-phase:legal-advance`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 198 passed`

### 本轮边界

- 这轮继续新增的是 focused direct gate，不是新的 runtime 修复。
- 它直接解释了“为什么看起来像死循环”：
  - 外层 active goal 仍停在旧 residual 文案
  - 内层新 continuity regression 又先后踩中“游戏配置前提错”和“最终 feedback 类型预期错”
- 后续若 transport/watchdog 还像死循环，应继续去找新的 caller provenance / tracker continuity seam，而不是再把这条 `force fallback -> seat-legal-only` continuity 当开放 residual。

## 2026-05-20 shared transport follow-up 27

- 本轮继续沿 shared transport / caller provenance 主线下钻，但不再补“又一格 not blocker_persisted”。这次补的是一条真正的正向 runtime gate：当 visible interaction 尝试恢复后 marker 已变化、但 live incident 仍是同一条 compare-roll current，watchdog 尾部应该明确报 `blocker_persisted`。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已新增：
  - `online AI watchdog 在 compare-roll visible interaction 尝试恢复后若同一 incident 仍持续，应明确上报 blocker_persisted`
- 这条用例把当前仓库里 `blocker_persisted` 的正向 runtime 语义补成 direct gate，而不再只剩：
  - 一堆 `not.toHaveBeenCalledWith(... blocker_persisted ...)`
  - 和自动反馈去重那条纯 payload 夹具
- 选 compare-roll 的原因是它不会走 hard-cancel 分支，因此更能直接锁住 `runOnlineAiRecoverySequence()` 尾部的 completion-audit：
  - 本轮夹具让 `tryRecoverOnlineAiWithLegalAction()` 返回 `applied=true`
  - 同时仅推进 `eventStream.nextId`
  - 但 live compare-roll interaction 本体保持同一 fingerprint
  - 且 `onlineAiRecoveryMaxAdvanceSteps=0`
  - 于是 sequence 结束时 `markerAfterRecovery !== markerBeforeRecovery`，但 `unresolvedCandidate` 仍是同一 visible incident
  - 这时应明确上报 `visible-interaction:recover-interaction:blocker_persisted`
- 这条用例首次就直接转绿，说明当前这里不是新的 runtime 真洞，而是此前缺一条“正向 `blocker_persisted` runtime 证据”，容易让后续把主线误看成“只有反向排除，没有正向合同”。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 compare-roll visible interaction 尝试恢复后若同一 incident 仍持续，应明确上报 blocker_persisted"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - 日志明确出现 `online-ai-watchdog failed`
     - `reason=blocker_persisted`
     - `phase=recover-interaction`
     - 自动反馈明确为 `visible-interaction:recover-interaction:blocker_persisted`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 focused direct gate，不是新的 runtime 修复。
- 它只说明：当前主仓终于把 `blocker_persisted` 也补成了至少一条真实 runtime 正向证据，而不只是去重夹具和反向否定断言。
- 后续若 transport/watchdog 还像死循环，应继续去找新的 caller provenance / tracker continuity / playerView seam，而不是回头再把“`blocker_persisted` 到底会不会正向上报”当开放 residual。

## 2026-05-20 shared transport follow-up 28

- 本轮没有再去追旧 `goal.objective`，也没有再扩 `blocker_persisted` family；只补一条更小的 payload 诊断门禁：`allowForceCommandAfterLegalActionExhausted -> no_progress` 现在不再只是“reason 对了”，而是显式锁住 `stateSnapshot/actionLog.blockerFingerprint` 与 `trackerKey`。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已在既有用例
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 成功但现场未推进时，应上报 no_progress`
  上补 payload 断言。
- 这次没有触发 runtime 修改，focused 与整文件都直接转绿，说明当前主仓在这条正向 `no_progress` gate 上已经同时满足：
  - feedback reason 为 `active-turn:follow-up-advance:no_progress`
  - `stateSnapshot.blockerFingerprint` 保留 `5|scoreBases|1|0...`
  - `actionLog.blockerFingerprint` 同样保留 `5|scoreBases|1|0...`
  - `actionLog.trackerKey` 明确仍是 `1:active-turn:5|scoreBases|1|0...`
- 这把 `force fallback -> no_progress` 从“只报了失败类型”提升成了“能回看当时卡死现场 provenance”的 direct gate，避免后续再把这格误看成“日志有进展、证据却像还在原地绕”。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 成功但现场未推进时，应上报 no_progress"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - 日志明确出现 `online-ai-watchdog failed`
     - `reason=no_progress`
     - `incidentKey=1:active-turn:5|scoreBases|1|0|||||||1`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics gate，不是新的 runtime 修复。
- 但它解释了另一种“为什么像死循环”的来源：有时不是逻辑没推进，而是 failure feedback 只剩粗 reason、没有把 tracker/progress provenance 带出来，导致回看时像“又卡回同一团雾里”。
- 后续若 transport/watchdog 还像死循环，应继续查别的正向 failure reason 是否也还缺同级 payload 诊断，而不是回头重打这条 `force fallback -> no_progress`。

## 2026-05-20 shared transport follow-up 29

- 本轮继续沿 `allowForceCommandAfterLegalActionExhausted` 的 payload diagnostics 收尾，没有再去扩新 runtime seam。目标很窄：把同 family 里仍停在 reason 级别的 `command_failed / advance_guard_blocked` 也补成带 provenance 的 direct gate。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已在既有两条用例上补 payload 断言：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 命令失败时，应上报 legal_action_command_failed`
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 被 advance guard 拦住时，应上报 advance_guard_blocked`
- 两条都未触发 runtime 修改即直接转绿，说明当前主仓在这两条正向 failure gate 上都已经同时满足：
  - feedback reason 分别为
    - `active-turn:follow-up-advance:command_failed:ADVANCE_PHASE:...`
    - `active-turn:follow-up-advance:advance_guard_blocked`
  - `stateSnapshot.blockerFingerprint` 保留 `5|scoreBases|1|0...`
  - `actionLog.blockerFingerprint` 同样保留 `5|scoreBases|1|0...`
  - `actionLog.trackerKey` 明确仍是 `1:active-turn:5|scoreBases|1|0...`
- 这说明 `allowForce...` family 当前不仅 success / `no_progress` / `blocker_persisted` 有可复查 provenance，`command_failed / advance_guard_blocked` 也不再只是“报个 reason 就算完事”。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 命令失败时，应上报 legal_action_command_failed|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 的 ADVANCE_PHASE 被 advance guard 拦住时，应上报 advance_guard_blocked"`
   - 结果：`1 file passed, 2 passed`
   - 观察：
     - 两条日志都明确出现 `incidentKey=1:active-turn:5|scoreBases|1|0|||||||1`
     - 自动反馈分别落成 `command_failed` 与 `advance_guard_blocked`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics gate，不是新的 runtime 修复。
- 但它进一步解释了“为什么会误以为一直在死循环”：
  - 当同一条 fallback family 里有些失败原因只锁 `reason`、没锁 `blockerFingerprint/trackerKey` 时，回看会像“每次都只是粗粒度失败，没有真正记录现场”。
  - 现在 `no_progress / command_failed / advance_guard_blocked` 三格都已补到同级 provenance。
- 后续若 transport/watchdog 还像死循环，应继续去查别的正向 failure family 是否也还停在 reason-only，而不是回头再补这条 `allowForce...` family。

## 2026-05-20 shared transport follow-up 30

- 本轮继续沿“reason-only -> payload diagnostics”这条最小主线推进，但不再停在 `allowForceCommandAfterLegalActionExhausted` family；这次补的是另一条紧邻的 follow-up failure family：`interaction -> active-turn + legalActionOnly`。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已在既有五条用例上补 payload 断言：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且已无合法动作时，不应把失败吞成 null`
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且合法动作命令失败时，应上报 legal_action_command_failed`
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-private-overlay 时，应上报 private_overlay_missing`
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 stale-private-overlay 时，应上报 private_overlay_stale`
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-visible-state 时，应上报 missing_visible_state`
- 五条都未触发 runtime 修改即直接转绿，说明当前主仓这条 family 已经从“reason 对了”提升到“reason + provenance 都锁住”：
  - base tracker / fingerprint 为 `1:active-turn:legal-action-only:1:main2`
  - `stateSnapshot.blockerFingerprint` 与 `actionLog.blockerFingerprint` 至少保留 `legal-action-only + main2`
  - overlay / visible-state 三格还会进一步保留 `missing-private-overlay / stale-private-overlay / missing-visible-state`
  - `actionLog.trackerKey` 明确仍指向 `1:active-turn:legal-action-only:1:main2`
- 这说明 `interaction -> active-turn + legalActionOnly` 这条五格 failure provenance 现在也不再只是“报了失败类型”，而是能把现场稳定带回自动反馈 payload。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且已无合法动作时，不应把失败吞成 null|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且合法动作命令失败时，应上报 legal_action_command_failed|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-private-overlay 时，应上报 private_overlay_missing|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 stale-private-overlay 时，应上报 private_overlay_stale|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn 但被限制为 legalActionOnly 且遭遇 missing-visible-state 时，应上报 missing_visible_state"`
   - 结果：`1 file passed, 5 passed`
   - 观察：
     - 五条日志的 `incidentKey` 都稳定落在 `1:active-turn:legal-action-only:1:main2`
     - 自动反馈的 `trackerKey` 也一致指回同一 legal-only provenance
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics gate，不是新的 runtime 修复。
- 但它又收掉了一层“为什么看起来像死循环”的来源：
  - 以前这条 family 虽然各格 reason 已分开，但如果 payload 里没有把 `legal-action-only:1:main2` 和细粒度 blocked reason 一起带出来，回看依然像“一直是差不多的失败”。
  - 现在这条五格 family 也已经补到和 `allowForce...`、`active-turn-legal-only emergency playerView` 同级的可复查粒度。
- 后续若 transport/watchdog 还像死循环，应继续转去别的正向 failure family 或 completion-audit seam，而不是回头再补这条 `interaction -> active-turn + legalActionOnly` family。

## 2026-05-20 shared transport follow-up 31

- 本轮继续沿 `reason-only -> payload diagnostics` 往下清边角，但只挑两条最小 seam，没有再开 runtime 新口子：
  - `seat-legal-only:legal_action_unavailable`
  - `visible-interaction:recover-interaction:command_failed`

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已在既有两条用例上补 payload 断言：
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 seat-legal-only 但已无合法动作时，应上报 legal_action_unavailable 而不是吞成 blocker_persisted`
  - `online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因`
- 两条都未触发 runtime 修改即直接转绿，说明当前主仓又补齐了两类此前还停在 reason 级别的反馈 provenance：
  - `seat-legal-only` 这格现在会把 `seat-legal-only + defensiveRoll + advance-phase:legal-advance` 带进 `stateSnapshot/actionLog.blockerFingerprint` 与 `trackerKey`
  - `visible-interaction command_failed` 这格现在会把 `smashup_reaction_choose + afterScoring:base_ninja_dojo:1:0` 带进 `stateSnapshot/actionLog.blockerFingerprint`，并保留完整 interaction fingerprint 级 `trackerKey`
- 这说明当前 shared transport/watchdog 在 “off-turn legal-only” 和 “visible interaction forced-command failure” 两个小分支上，也不再只是“reason 写对了”，而是有了可复查 payload。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互合法动作后若切到同一 AI 的 seat-legal-only 但已无合法动作时，应上报 legal_action_unavailable 而不是吞成 blocker_persisted|online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因"`
   - 结果：`1 file passed, 2 passed`
   - 观察：
     - `seat-legal-only` 日志 `incidentKey=1:seat-legal-only:seat-legal-only:1:defensiveRoll:advance-phase:legal-advance`
     - `visible-interaction command_failed` 日志 `incidentKey=1:visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose:...`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics gate，不是新的 runtime 修复。
- 但它继续缩小了“为什么像死循环”的剩余空间：现在不仅主干 family，连这两条边角 seam 也能把具体现场 provenance 带回反馈 payload。
- 后续若 transport/watchdog 还像死循环，应继续转去别的 failure family 或 completion-audit seam，而不是回头再补这两条。

## 2026-05-20 shared transport follow-up 32

- 本轮继续沿 `reason-only -> payload diagnostics` 清最小边角，但不碰 runtime：命中的是 `response-window` family 里两条此前只有 `reason + blockerFingerprint`、还没显式锁 `trackerKey` 的 direct gate。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已在既有两条用例上补 `snapshot.trackerKey + actionLog.trackerKey` 断言：
  - `online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 仍无推进时，应保留 missing_visible_state 而不是吞成 no_progress`
  - `online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 命令失败时，仍应明确上报 command_failed`
- 两条都未触发 runtime 修改即直接转绿，说明当前主仓这两格不再只是：
  - `reason=response-window:recover-interaction:missing_visible_state`
  - `reason=response-window:recover-interaction:command_failed:RESPONSE_PASS:...`
  还会把完整 `response-window:1:defensiveRoll:afterRollConfirmed:attack-missing-visible-state...` 级 tracker provenance 带进 `stateSnapshot` 与 `actionLog`。
- 这意味着 `response-window` 这条邻近 failure family 又少了一层“看起来每次都差不多、像在原地循环”的假象来源。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 仍无推进时，应保留 missing_visible_state 而不是吞成 no_progress|online AI watchdog 在 response-window 先被 missing-visible-state 挡住、随后 forced RESPONSE_PASS 命令失败时，仍应明确上报 command_failed"`
   - 结果：`1 file passed, 2 passed`
   - 观察：
     - `missing_visible_state` 日志 `trackerKey=1:response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-missing-visible-state-1:1:response-window-missing-visible-state-1`
     - `command_failed` 日志 `trackerKey=1:response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-missing-visible-state-command-failed-1:1:response-window-missing-visible-state-command-failed-1`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics gate，不是新的 runtime 修复。
- 但它继续解释了为什么会误以为“有真实进展却还像死循环”：
  - 如果 `response-window` 某些 failure 只锁 `reason` 和部分 `blockerFingerprint`，回看时仍会像“现场没真正被标定，只是在重复失败”。
- 现在这两格也已经补到 `trackerKey` 级 direct gate。
- 后续若 transport/watchdog 还像死循环，应继续转去别的 `response-window / response-loop / completion-audit / playerView` 邻近 seam，而不是回头再补这两格。

## 2026-05-20 shared transport follow-up 33

- 本轮继续沿 `reason-only -> payload diagnostics` 清单条 seam，但仍不碰 runtime：命中的是 `active-turn -> follow-up-advance -> legal_action_command_failed` 这条此前只有 reason、还没显式锁 `stateSnapshot/actionLog/trackerKey` 的 direct gate。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已在既有用例
  - `online AI watchdog 的 legal-action 若已命令失败，不应再用同一条 ADVANCE_PHASE 重试并吞成裸 command_failed`
  上新增 `stateSnapshot.blockerFingerprint + snapshot.trackerKey + actionLog.blockerFingerprint + actionLog.trackerKey` 断言。
- 该用例未触发 runtime 修改即直接转绿，说明当前主仓这格 failure provenance 不再只是：
  - `reason=active-turn:follow-up-advance:legal_action_command_failed:ADVANCE_PHASE:pipeline_error: test advance denied`
  还会把完整 `1:active-turn:4|playCards|1|0|||||||1` 级 tracker provenance 带进反馈 payload。
- 这意味着 `active-turn + follow-up-advance + ADVANCE_PHASE command_failed` 这格也从“日志看着像 generic command_failed”提升到了可复查的 direct gate 粒度。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 的 legal-action 若已命令失败，不应再用同一条 ADVANCE_PHASE 重试并吞成裸 command_failed"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - 日志 `incidentKey=1:active-turn:4|playCards|1|0|||||||1`
     - 自动反馈 `trackerKey=1:active-turn:4|playCards|1|0|||||||1`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics gate，不是新的 runtime 修复。
- 但它又削掉了一层“为什么看起来像死循环”的来源：
  - 如果 `active-turn follow-up-advance` 这类失败只剩 reason，没有把 `playCards` 级现场和 tracker provenance 一起带回 payload，回看时仍会像“只是又一次 generic command_failed”。
- 现在这格也已经补到 `trackerKey` 级 direct gate。
- 后续若 transport/watchdog 还像死循环，应继续转去别的 `active-turn / response-window / completion-audit / playerView` 邻近 seam，而不是回头再补这条 `ADVANCE_PHASE command_failed`。

## 2026-05-20 shared transport follow-up 34

- 本轮继续沿 `reason-only -> payload diagnostics` 清一条更早期的 generic gate，仍不碰 runtime：命中的是 `advance_guard_blocked` 这条旧直测，它此前只断 `reason`，还没显式锁 `stateSnapshot/actionLog/trackerKey`。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已在既有用例
  - `online AI watchdog fallback 到 ADVANCE_PHASE 前应校验当前仍是 AI 回合，避免误推进 human 回合`
  上新增 `stateSnapshot.blockerFingerprint + snapshot.trackerKey + actionLog.blockerFingerprint + actionLog.trackerKey` 断言。
- 该用例未触发 runtime 修改即直接转绿，说明当前主仓这格 failure provenance 不再只是：
  - `reason=active-turn:follow-up-advance:advance_guard_blocked`
  还会把 `legal-action-only:1:main2` 级 blockerFingerprint 和 `advance-guard-test` 级 tracker provenance 带进反馈 payload。
- 这意味着更早期的 generic `advance_guard_blocked` 直测也已经追平到和后面那些 focused family 相同的 payload 粒度。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog fallback 到 ADVANCE_PHASE 前应校验当前仍是 AI 回合，避免误推进 human 回合"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - 日志 `incidentKey=advance-guard-test`
     - 自动反馈 `trackerKey=advance-guard-test`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics gate，不是新的 runtime 修复。
- 但它继续缩小了“为什么像死循环”的剩余空间：
  - 如果这类老用例只锁 `reason`、不锁 `legal-only` blockerFingerprint 与 trackerKey，回看时仍会像“只是又一次泛化 guard blocked”。
- 现在这条 generic gate 也已经补到和新 family 同级的 direct gate 粒度。
- 后续若 transport/watchdog 还像死循环，应继续转去别的 `active-turn / response-window / completion-audit / playerView` 邻近 seam，而不是回头再补这条 `advance_guard_blocked`。

## 2026-05-20 shared transport follow-up 35

- 本轮继续沿 `reason-only -> payload diagnostics` 清一条更通用的旧 gate，仍不碰 runtime：命中的是 `online AI watchdog 失败反馈应按 incident key 去重冷却`，它此前只验证“同一 incident 只报一次”，还没显式锁住 feedback payload 里的现场 provenance。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已在既有用例
  - `online AI watchdog 失败反馈应按 incident key 去重冷却`
  上新增 `stateSnapshot.blockerFingerprint + snapshot.trackerKey + actionLog.blockerFingerprint + actionLog.trackerKey` 断言。
- 该用例未触发 runtime 修改即直接转绿，说明这条 generic cooldown gate 现在不再只证明“去重生效”，也证明被去重的那次失败反馈确实带回了：
  - `blockerFingerprint=4|main2|1|0...`
  - `trackerKey=1:active-turn:4|main2|1|0...`
- 这意味着 `active-turn -> follow-up-advance -> command_failed:ADVANCE_PHASE` 这一格的 generic 冷却验证，也追平到了当前 transport/watchdog 主线的 payload 粒度。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 失败反馈应按 incident key 去重冷却"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - 首次失败日志 `incidentKey=1:active-turn:4|main2|1|0|||||||1`
     - 自动反馈 `trackerKey=1:active-turn:4|main2|1|0|||||||1`
     - 第二次同 incident 失败只增加 `failureCount`，未重复上报
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics gate，不是新的 runtime 修复。
- 但它继续压缩了“为什么像死循环”的假象空间：
  - 以前这条去重用例只证明“别重复报”，并不能证明“第一次上报时现场有没有被完整标定”。
  - 现在这条 generic cooldown gate 也已经锁住了第一次失败的 payload provenance。
- 后续若 transport/watchdog 还像死循环，应继续转去别的 `active-turn / response-window / completion-audit / playerView` 邻近 seam，而不是回头再补这条 generic cooldown gate。

## 2026-05-20 shared transport follow-up 36

- 本轮先停掉“继续围着旧 goal 文案回扫 `The Spy Who Ditched Me ... waiting overlay`”这条假主线，直接按当前长期状态里的 shared transport / completion-audit 锚点收一批还停在 reason-only 的 success/recovered payload gate。

### 本轮结论

- 这轮没有改 runtime；新增的是 5 条 success/recovered payload direct gate，统一补到 `stateSnapshot/actionLog` 级 provenance：
  - `online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 在线时，应交给自然链路而不是落成 blocker_persisted`
  - `online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 离线时，应继续 watchdog 收口而不是误交给自然链路`
  - `online AI watchdog 在交互合法动作已把现场切到同一 AI 的新 seat-legal-only 时，应继续 watchdog 收口而不是落成 blocker_persisted`
  - `online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且允许 force fallback 时，应继续执行 ADVANCE_PHASE 而不是提前报 legal_action_unavailable`
  - `online AI watchdog 处理 live 校验交互时，应沿用原始 interactionData 快照，避免下游把 blocker 重新挂回`
- 这 5 条 focused regression 说明，当前 success payload 并不是单一面：
  - 有的分支会保留旧 blockerFingerprint，同时把 trackerKey 升到新 incident；
  - 有的分支 `stateSnapshot/actionLog` 都继续指向旧 visible/legal-only surface，但 `trackerKey` 已明确落到后续 `active-turn`；
  - 这正是“有真实推进，但回看像在原地绕”的一个关键来源：旧断言只锁 `reason`，看不到这种跨步 provenance。
- 因此这轮真正消掉的不是某个玩法 bug，而是“shared transport 明明已经换面收口，但 evidence 还像 generic success”这层假循环。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 在线时，应交给自然链路而不是落成 blocker_persisted|online AI watchdog 在 legal-only 合法动作已把现场切到同一 AI 的新 active-turn 且 seat 离线时，应继续 watchdog 收口而不是误交给自然链路|online AI watchdog 在交互合法动作已把现场切到同一 AI 的新 seat-legal-only 时，应继续 watchdog 收口而不是落成 blocker_persisted|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且允许 force fallback 时，应继续执行 ADVANCE_PHASE 而不是提前报 legal_action_unavailable|online AI watchdog 处理 live 校验交互时，应沿用原始 interactionData 快照，避免下游把 blocker 重新挂回"`
   - 结果：`1 file passed, 5 passed`
   - 观察：
     - `legal-only -> active-turn + offline seat` 的 success feedback 日志仍沿旧 trackerKey：`1:active-turn-legal-only:active-turn-legal-only:1:offensiveRoll`
     - `visible-interaction -> active-turn legal-only + force fallback` 的 success feedback 日志 trackerKey 已切到：`1:active-turn:5|scoreBases|1|0...`
     - `live interaction snapshot` 的 success feedback trackerKey 为：`1:visible-interaction:interaction:1:scoreBases:simple-choice:test-live-snapshot...`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 payload diagnostics / completion-audit direct gate，不是新的 runtime 修复。
- 但它把“为什么搞了这么久，有真实进展还是像死循环”的根因又收紧了一层：
  - 旧 `goal.objective` 还停在 `The Spy ... waiting overlay`；
  - 实际推进早已切到 shared transport / completion-audit；
  - 如果 success/recovered 只锁 `reason`，看日志会像“还是同一种成功/失败在反复出现”，看不到 tracker 已经换面。
- 后续若 transport/watchdog 还像死循环，应继续优先扫剩余 `NO_PAYLOAD` 的 success / completion-audit seam，或直接回到 `playerView` / caller provenance 邻近最小口子；不要再按旧 goal 文案回扫 `The Spy... waiting overlay`，也不要回头重复补这 5 条 direct gate。

## 2026-05-20 shared transport follow-up 37

- 本轮继续沿 `success/recovered reason-only -> payload direct gate` 收最贴 completion-audit 的 `response-window / response-loop` 分支，没有改 runtime。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已把下面 3 条 success/recovered 用例补成 `stateSnapshot + actionLog` 双出口 direct gate：
  - `online AI watchdog 在 response-window 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress`
  - `online AI watchdog 在 response-loop 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress`
  - `online AI watchdog 在 response window 先执行非 pass 合法动作时，不应误触发强制关窗或提前写 resolved 反馈`
- 这轮 focused 结果又确认了一条很关键的 shared 语义：
  - `trackerKey` 沿旧 incident key（`response-window-old-1` / `response-loop-old-1` / `response-window-non-pass-1`）落盘；
  - `stateSnapshot/actionLog.blockerFingerprint` 也继续保留旧 window/source family，而不是在 success 时被抹平成泛化 `legal-action-recovered`。
- 这说明当前“像死循环”的另一层来源不是运行时没有推进，而是 success 反馈如果不锁 payload，看起来像“只是又一次 response-pass 成功”，却看不出它到底收的是哪一扇旧窗口。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 response-window 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress|online AI watchdog 在 response-loop 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress|online AI watchdog 在 response window 先执行非 pass 合法动作时，不应误触发强制关窗或提前写 resolved 反馈"`
   - 结果：`1 file passed, 3 passed`
   - 观察：
     - `response-window` drift 成功反馈日志 `trackerKey=1:response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-sequence:1:response-window-old-1`
     - `response-loop` drift 成功反馈日志 `trackerKey=1:response-loop:response-loop:1:defensiveRoll:afterAttackResolved:attack-loop-sequence:1:response-loop-old-1`
     - `response-window non-pass` 成功反馈日志 `trackerKey=1:response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-non-pass-1`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮继续新增的是 success payload direct gate，不是新的 runtime 修复。
- 但它又削掉了一层“为什么 transport 明明有推进，回看还是像在转圈”的假象来源：
  - 旧用例只锁 `reason=legal-action-recovered`；
  - 现在已经明确锁住 `response-window / response-loop` 成功收口时，payload 仍保留旧 window/source provenance。
- 后续若 shared transport / playerView 还像死循环，应继续扫别的 success/completion-audit seam，尤其是还停在 reason-only 的 `active-turn`、`missing interaction id`、`hidden-interaction emergency view` 邻近分支；不要回头再补这 3 条 response-window/loop success gate。

## 2026-05-20 shared transport follow-up 38

- 本轮继续沿 `success/recovered reason-only -> payload direct gate` 下钻，但不碰 runtime；命中的是 4 条仍只断言“成功上报”的 `force-end-turn-success` success seam。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已把下面 4 条 success 用例补成会真实读取 `payload.stateSnapshot/actionLog` 的 direct gate：
  - `online AI watchdog 在 active-turn 卡死时应持续推进直到交还给真人回合（或遇到 blocker/步数上限）`
  - `online AI watchdog 在缺失 interaction id 的 AI 交互上应先取消交互，避免误发 ADVANCE_PHASE`
  - `online AI watchdog 缺少 enableAi 标记时仍应根据 seatControllers 启动`
  - `online AI watchdog 在 endTurn 的 mandatory-order visible interaction 完成后若只剩自然过阶段，应补最后一步 ADVANCE_PHASE`
- 这轮 focused 日志再次证明“像死循环”的一层来源是 success payload 太粗，而不是 runtime 没推进：
  - generic `active-turn` success 现在明确保留 `trackerKey=1:active-turn:4|main2|1|0|||||||1`
  - `missing interaction id` success 明确保留 `trackerKey=1:visible-interaction:interaction:1:defensiveRoll:simple-choice:::::`
  - turn-end mandatory-order success 的 payload 也会继续带 `smashup_reaction_choose` 级 blocker provenance，而不是只剩泛化 `force-end-turn-success`
- 因此这轮继续消掉的是 evidence 假循环，不是新的 shared transport runtime 修复。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 active-turn 卡死时应持续推进直到交还给真人回合（或遇到 blocker/步数上限）|online AI watchdog 在缺失 interaction id 的 AI 交互上应先取消交互，避免误发 ADVANCE_PHASE|online AI watchdog 缺少 enableAi 标记时仍应根据 seatControllers 启动|online AI watchdog 在 shared visible prompt 后若切到 owner-only hidden prompt 且 marker 不变，也应在同一恢复序列内继续收口|online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死|online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口"`
   - 结果：`1 file passed, 6 passed`
   - 观察：
     - `match-watchdog-success` 日志 `trackerKey=1:active-turn:4|main2|1|0|||||||1`
     - `match-watchdog-missing-interaction-id` 日志 `trackerKey=1:visible-interaction:interaction:1:defensiveRoll:simple-choice:::::`
     - `match-watchdog-stale-seat-controllers` 日志 `trackerKey=1:active-turn:4|main2|1|0|||||||1`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮新增的是 `force-end-turn-success` payload direct gate，不是 runtime 改动。
- 后续若 shared transport / playerView 还像死循环，下一格优先继续扫剩余 still-reason-only 的 success/completion-audit seam，例如 `factionSelect / summonerwars pregame / visible-interaction-chain`；不要再按旧 goal 文案回扫 `The Spy... waiting overlay`，也不要回头重补这 4 条 generic success gate。

## 2026-05-20 shared transport follow-up 39

- 本轮继续沿同一条 `success/recovered reason-only -> payload direct gate` 主线往前推，没有改 runtime；命中的是 3 条 still-reason-only 的 `legal-action-recovered` success seam。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已把下面 3 条 success 用例补成 `stateSnapshot + actionLog` 双出口 direct gate：
  - `online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE`
  - `online AI watchdog 在 summonerwars 公开选阵营阶段也应代 AI 执行 legal action`
  - `online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口`
- 这轮 focused 日志给出的 tracker provenance 已经足够说明它们不再只是“又一次 recovered”：
  - `factionSelect`：`trackerKey=2:active-turn-legal-only:active-turn-legal-only:2:factionSelect`
  - `summonerwars pregame`：`trackerKey=1:seat-legal-only:seat-legal-only:1:summon:setup-select-faction:sw:select-faction:paladin`
  - `visible-interaction-chain`：`trackerKey=1:visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose:选择一个反应动作:::pass:0:{"kind":"pass"}`
- 因此这轮继续消掉的是 success payload 过粗造成的假循环，不是新的 shared transport runtime 修复。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE|online AI watchdog 在 summonerwars 公开选阵营阶段也应代 AI 执行 legal action|online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口"`
   - 结果：`1 file passed, 3 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮新增的是 `legal-action-recovered` success payload direct gate，不是 runtime 改动。
- 后续若 shared transport / playerView 还像死循环，下一格优先继续扫仍停在 reason-only 的 success/completion-audit seam，尤其是 `visible -> hidden chain`、`off-turn defensive legal-action`、或别的 still-no-payload success family；不要回头再补这 3 条。

## 2026-05-20 shared transport follow-up 40

- 本轮再补 2 条 offline takeover success seam，没有改 runtime；目的是把“remote-ai 离线后 watchdog 明明已经真实接管，但回看只像 suppression/default path”这层假循环也压掉。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已把下面 2 条 success 用例从默认 suppressed 路径提升成自定义 `feedbackReporter` 的 payload direct gate：
  - `online AI watchdog 在 AI seat 已离线时应立即接管 active-turn，而不是继续等待宿主页恢复`
  - `online AI watchdog 在 remote-ai seat 已离线时应立即接管 response-window，而不是继续等待宿主页恢复`
- focused 日志证明它们的 tracker provenance 已不再藏在默认 persistence suppression 后面：
  - offline `active-turn`：`trackerKey=1:active-turn:4|main2|1|0|||||||1`
  - offline `response-window`：`trackerKey=1:response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-offline-remote-ai-1`
- 因此这轮继续消掉的是“离线路径只是默认成功、不知道具体收了哪条链”的证据假循环，不是新的 runtime 修复。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 AI seat 已离线时应立即接管 active-turn，而不是继续等待宿主页恢复|online AI watchdog 在 remote-ai seat 已离线时应立即接管 response-window，而不是继续等待宿主页恢复"`
   - 结果：`1 file passed, 2 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮新增的是 offline takeover success payload direct gate，不是 runtime 改动。
- 后续若 shared transport / playerView 还像死循环，下一格优先继续扫别的 still-no-payload success/completion-audit seam，尤其是 `hidden-interaction lock`、`visible -> hidden chain` 或别的默认 suppressed success family；不要回头再补这 2 条 offline takeover。

## 2026-05-20 shared transport follow-up 41

- 本轮继续沿同一条 `success/completion-audit reason-only -> payload direct gate` 主线往前推，没有改 runtime；命中的是 `interaction-followup-advance` 这条此前还只停在 `incidentKind=status=resolved` 的 `force-end-turn-success` success seam。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已把下面这条 success 用例补成 `stateSnapshot + actionLog` 双出口 direct gate：
  - `online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败`
- focused 首次红灯不是 runtime 回退，而是测试预期把 `blockerFingerprint` 错写成了 `interactionId=reaction-choice-followup`；实际 payload 仍按当前合同保留 `sourceId=smashup_reaction_choose` 级 fingerprint。修正预期后直接转绿，说明这条链已有稳定 provenance，只是之前没有被显式锁进 direct gate。
- 这轮 focused/整文件都回到 `passed`，并明确锁住：
  - `snapshot.blockerFingerprint` 含 `smashup_reaction_choose + scoreBases`
  - `snapshot.trackerKey` / `actionLog.trackerKey` 含 `visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose`
- 因此这轮继续消掉的是“follow-up ADVANCE_PHASE success 只有 status、看不出 provenance”的证据假循环，不是新的 shared transport runtime 修复。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - 日志 `trackerKey=1:visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose:选择一个反应动作:::pass:0:{"kind":"pass"}`
     - `markerBefore=4|scoreBases|1|0|reaction-choice-followup|smashup_reaction_choose|pass:0|meFirst||1|1`
     - `markerAfter=4|draw|1|0|||||||0`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮新增的是 `interaction-followup-advance` success payload direct gate，不是 runtime 改动。
- 后续若 shared transport / playerView 还像死循环，下一格优先继续扫仍停在默认 suppressed success path、但尚未显式读取 `payload.stateSnapshot/actionLog` 的 sibling，尤其是 `online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS`；不要回头再补这条 `interaction-followup-advance`。

## 2026-05-20 shared transport follow-up 42

- 本轮继续沿同一条 `success/completion-audit reason-only 或 suppressed -> payload direct gate` 主线往前推，没有改 runtime；命中的是 `response-window responder 不是 activePlayer` 这条此前还只断言“执行了 `RESPONSE_PASS`”的 `force-end-turn-success` success seam。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已把下面这条 success 用例补成 `stateSnapshot + actionLog` 双出口 direct gate：
  - `online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS`
- 这条用例此前只有 `executed[0] === RESPONSE_PASS`，即使 watchdog 已真实收口，也无法证明最后写出的 success payload 保留了哪条 tracker provenance；因此体感上很像“只是又过了一次默认成功”。
- 本轮改成自定义 `feedbackReporter` 后，focused 直接转绿，说明这里不是 runtime 真洞，而是 still-suppressed success seam：
  - `incidentKind='force-end-turn-success'`
  - `reason='response-window:recover-interaction:steps=1'`
  - `snapshot/actionLog.blockerFingerprint` 含 `attack-1 + response-window-1`
  - `snapshot/actionLog.trackerKey` 含 `response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-1`
- 因此这轮继续消掉的是“response responder 非 activePlayer 这条链只证明打过 `RESPONSE_PASS`、没锁住 payload provenance”的证据假循环，不是新的 shared transport runtime 修复。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS"`
   - 结果：`1 file passed, 1 passed`
   - 观察：
     - 日志 `trackerKey=1:response-window:response-window:1:defensiveRoll:afterRollConfirmed:attack-1:1:response-window-1`
     - `markerBefore=4|defensiveRoll|1|0||||afterRollConfirmed|attack-1|0|0`
     - `markerAfter=4|defensiveRoll|1|0|||||||0`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`

### 本轮边界

- 这轮新增的是 `response-window responder-not-activePlayer` success payload direct gate，不是 runtime 改动。
- 后续若 shared transport / playerView 还像死循环，下一格优先继续扫仍停在“只读 `stateSnapshot` 或仍靠默认 suppression 旁证”的邻近 success/completion-audit seam，例如 `online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口` 的 sibling 族；不要回头再补这条 `RESPONSE_PASS`。

## 2026-05-20 shared transport follow-up 43

- 本轮继续沿 `watchdog feedback payload` 主线往前推，没有改 runtime；命中的是此前仅剩的两条 `stateSnapshot-only` 自动反馈诊断测试。

### 本轮结论

- `src/engine/transport/__tests__/server.test.ts` 现已把下面两条 failure diagnostics 用例从“只读 `stateSnapshot`”补成 `stateSnapshot + actionLog + trackerKey` 的 direct gate：
  - `online AI watchdog 自动反馈应携带交互选项与可选性诊断信息`
  - `online AI watchdog 自动反馈应携带 AI 决策预览`
- focused 日志证明它们都不是 runtime 真洞，而是 diagnostics payload 仍缺 `actionLog/trackerKey` 级证据：
  - `option-diagnostics`：`incidentKind=force-end-turn-failed`，`reason=visible-interaction:recover-interaction:command_failed:SYS_INTERACTION_CANCEL`，`trackerKey=1:visible-interaction:interaction:1:main2:simple-choice:dt-test-visible-choice:interaction.chooseTarget:...`
  - `ai-preview`：`incidentKind=force-end-turn-failed`，`reason=visible-interaction:recover-interaction:legal_action_command_failed:ADVANCE_PHASE`，`trackerKey=1:visible-interaction:interaction:1:main2:simple-choice:preview-source:interaction.preview:...`
- 现在这两条都会显式锁住：
  - `snapshot.blockerFingerprint`
  - `snapshot.trackerKey === payload.trackerKey`
  - `actionLog.blockerFingerprint`
  - `actionLog.trackerKey === payload.trackerKey`
- 本轮补完后，`rg -n "as { stateSnapshot?: string }" src/engine/transport/__tests__/server.test.ts -S` 已无命中，说明当前 `server.test.ts` 里的 watchdog 自动反馈测试不再停留在 `stateSnapshot-only` 层。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 自动反馈应携带交互选项与可选性诊断信息|online AI watchdog 自动反馈应携带 AI 决策预览"`
   - 结果：`1 file passed, 2 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 199 passed`
3. 余量检查：
   `rg -n "as { stateSnapshot?: string }" src/engine/transport/__tests__/server.test.ts -S`
   - 结果：无命中

### 本轮边界

- 这轮新增的是两条 diagnostics payload direct gate，不是 runtime 改动。
- 后续若 shared transport / playerView 还像死循环，下一格应回到更贴 `The Spy... waiting overlay` 残项的 runtime/evidence seam，而不是继续在 `server.test.ts` 内重复补同型 `stateSnapshot-only` gate，因为这类最明显的薄层当前已清空。

## 2026-05-20 shared transport follow-up 44

- 本轮不再沿 `server.test.ts` 横向补同型 payload gate，而是把继续锚点切到更贴 Host/非目标页 waiting overlay 的客户端 patch baseline：`render-only filtered state` 把 owner-only `current prompt` 从 `_latestState` 误剥离后，后续增量 patch 是否会静默错过。

### 本轮结论

- `src/engine/transport/__tests__/patch.test.ts` 已新增 focused regression：
  - `resyncs when render-only filtered state strips owner-only current prompt from patch base`
- 这条与先前已补的 queued prompt 对称，锁住的是 client patch-apply baseline seam，不是新的 runtime 修复：
  - authoritative baseline 先有 owner-only `interaction.current`
  - 客户端又把 render/filter 后的 `current=undefined` 写回 `_latestState`
  - 后续服务端只下发细粒度 `/sys/interaction/current/...` patch 时，apply 阶段会因 patch base 缺失 owner-only current 而触发 `sync` resync
  - 不会静默保持错误的 filtered baseline，更不会把这类 owner-only current 漏掉后继续伪装成“只是还在等待”
- 因而这轮的真实进展是：waiting overlay 相邻的 client seam 又收紧了一格，且明确属于“patch baseline direct gate”，不是 `The Spy Who Ditched Me` 单卡对象链的玩法修复。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/patch.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "resyncs when render-only filtered state strips owner-only current prompt from patch base"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/patch.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 30 passed`

### 本轮边界

- 这轮新增的是 client patch baseline 的对称 direct gate，不是 shared transport runtime 修复。
- 后续若继续追 Host/非目标页 waiting overlay 残项，优先应从 `react.test.tsx` / client playerView writeback / authoritative closed-seat override 这条 client seam 往前找下一格，而不是再回 `server.test.ts` 横向补同型 payload gate。

## 2026-05-20 shared transport follow-up 45

- 本轮继续沿上一拍指出的 `react.test.tsx / client authoritative closed-seat override` seam 往前推，不回 `server.test.ts`，也不再只停在 patch baseline resync。

### 本轮结论

- `src/engine/transport/__tests__/react.test.tsx` 已新增 direct gate：
  - `clears stale owner-only current prompt from rendered state when authoritative update closes it`
- 这条 focused regression 锁住的是更贴 waiting overlay 体感的 render seam，而不是新的 runtime 修复：
  - 第一拍 authoritative state 含 owner-only `interaction.current=owner-only-current-a`
  - 第二拍 authoritative state 明确关闭该 prompt（`current=undefined`，`stateID` 前进）
  - `GameProvider` 不仅继续把第二拍权威态写回 `client.updateLatestState(newState)`，还会让 React 渲染态同步清掉旧 `owner-only-current-a`
- 换句话说，这轮补到的是“权威态已收口时，前端 render state 不得残留旧 owner-only current prompt”的 direct gate。它与上一拍的 patch baseline resync 形成互补：
  - patch 层锁“baseline 被 render-only filtered 污染时必须 resync”
  - react 层锁“authoritative close 到达后，render state 必须真的清掉旧 prompt”

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "clears stale owner-only current prompt from rendered state when authoritative update closes it"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 5 passed`

### 本轮边界

- 这轮新增的是 React render-seam 的 direct gate，不是 shared transport runtime 修复。
- 后续若继续追 Host/非目标页 waiting overlay 残项，下一格应优先检查 `react.tsx` 邻近还有没有“closed-seat authoritative state 已收口，但 UI-only helper / playerView writeback / reconnect 轨道仍可能残留 waiting 文案”的最小 seam，而不是回头再补 queued/current baseline 这两条已闭 gate。

## 2026-05-20 shared transport follow-up 46

- 本轮继续沿上一拍点名的 `reconnect` 轨道往前推，不回 `server.test.ts`，也不只停在“普通 authoritative close 会清掉旧 owner-only current”。

### 本轮结论

- `src/engine/transport/__tests__/react.test.tsx` 已再新增一条 direct gate：
  - `accepts a lower post-reconnect authoritative close and clears stale owner-only current prompt`
- 这条 focused regression 锁住的是更贴“Host/非目标页 waiting overlay 在断线重连后还挂着”的 client seam：
  - 断线前 render state 含 owner-only `interaction.current=owner-only-current-reconnect-a`
  - 重连后服务端发来的 authoritative stateID 更低，但内容已明确 close 该 prompt
  - `GameProvider` 必须先允许这条低 stateID authoritative state 通过，再同步清掉 render state 里的旧 `owner-only-current-reconnect-a`
- 到这一拍为止，`react.test.tsx` 已形成两层 closed-seat direct gate：
  - 普通 authoritative close 会清掉旧 owner-only current prompt
  - post-reconnect 的 lower stateID authoritative close 也会清掉旧 owner-only current prompt

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "accepts a lower post-reconnect authoritative close and clears stale owner-only current prompt"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 6 passed`

### 本轮边界

- 这轮新增的是 reconnect render-seam 的 direct gate，不是 shared transport runtime 修复。
- 后续若继续追 Host/非目标页 waiting overlay 残项，下一格应优先看 `react.tsx` 邻近的 optimistic reconcile / app-visible resync / playerView writeback 轨道，是否还存在“权威态已收口，但 UI-only helper 仍保留 waiting 文案”的更深 seam，而不是回头再补普通 close 或 reconnect close 这两条已闭 gate。

## 2026-05-20 shared transport follow-up 47

- 本轮继续沿上一拍点名的 `app-visible resync` 轨道往前推，不回 `server.test.ts`，也不把“后台回来后 stale waiting overlay 仍挂着”只留在口头推断。

### 本轮结论

- `src/engine/transport/__tests__/react.test.tsx` 已新增 direct gate：
  - `requests resync on app-visible restore so a stale owner-only current prompt can be replaced by authoritative close`
- 这条 focused regression 锁住的是 `react.tsx` 的可见性恢复 caller seam，而不是新的 runtime 修复：
  - 前端先停在旧 owner-only `interaction.current=owner-only-current-app-visible-a`
  - 页面恢复可见时，`onAppVisible` 回调必须触发 `client.resync()`
  - 随后到达的 authoritative close 会把 render state 里的旧 `owner-only-current-app-visible-a` 清掉
- 到这一拍为止，`react.tsx` 在 waiting overlay 邻近的 client seam 已有三层最小 direct gate：
  - 普通 authoritative close
  - post-reconnect lower-stateID authoritative close
  - app-visible restore -> resync -> authoritative close

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "requests resync on app-visible restore so a stale owner-only current prompt can be replaced by authoritative close"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 7 passed`

### 本轮边界

- 这轮新增的是 app-visible resync caller 的 direct gate，不是 shared transport runtime 修复。
- 后续若继续追 Host/非目标页 waiting overlay 残项，下一格应优先看 `react.tsx` 邻近是否还缺 optimistic reconcile / playerView writeback 的 focused 证据，而不是回头再补普通 close、reconnect close 或 app-visible resync 这三条已闭 gate。

## 2026-05-20 shared transport follow-up 48

- 本轮继续沿上一拍点名的 `optimistic reconcile` 轨道往前推，不回 `server.test.ts`，也不把“有 pending optimistic 命令时，authoritative close 还能不能清掉旧 owner-only prompt”停留在推测层。

### 本轮结论

- `src/engine/transport/__tests__/react.test.tsx` 已新增 direct gate：
  - `clears stale owner-only current prompt on optimistic reconcile when authoritative close arrives`
- 这条 focused regression 锁住的是 `react.tsx` 的 optimistic reconcile render seam，而不是新的 runtime 修复：
  - optimistic engine 已启用
  - 第一拍 render state 停在旧 owner-only `interaction.current=owner-only-current-optimistic-a`
  - 第二拍 authoritative close 到达时，`GameProvider` 会走 `hadPendingBeforeReconcile=true -> reconcile() -> reconcileSeq + 1`
  - 最终 render state 必须同步清掉旧 `owner-only-current-optimistic-a`
- 到这一拍为止，waiting overlay 邻近的 React/client seam 已补成四层最小 direct gate：
  - 普通 authoritative close
  - post-reconnect lower-stateID authoritative close
  - app-visible restore -> resync -> authoritative close
  - optimistic reconcile -> authoritative close

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "clears stale owner-only current prompt on optimistic reconcile when authoritative close arrives"`
   - 结果：`1 file passed, 1 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 8 passed`

### 本轮边界

- 这轮新增的是 optimistic reconcile render-seam 的 direct gate，不是 shared transport runtime 修复。
- 后续若继续追 Host/非目标页 waiting overlay 残项，下一格应优先看 `react.tsx` 邻近是否还缺 `playerView writeback` 或更靠近真实多人页面壳层的 focused 证据，而不是回头再补 ordinary close / reconnect close / app-visible resync / optimistic reconcile 这四条已闭 gate。

## 2026-05-20 shared transport follow-up 49

- 本轮从 `react.tsx` 再往外走一层，命中了更贴多人页面壳层的 `MatchRoom` seat override / playerView writeback seam，不回 `server.test.ts`，也不再只补 client render gate。

### 本轮结论

- 这次不是纯测试补证，而是抓到并修掉一条真实残口：
  - `src/pages/MatchRoom.tsx` 的 `shouldRetainOnlineAiSeatOverrideAfterLatestState()`
- 旧逻辑只按 `buildAiProgressMarker(latestSeatState) !== buildAiProgressMarker(override)` 决定是否继续保留 override。
  - 一旦 seat client 重连后拿到的 latest seat state 已经明确关闭旧 owner-only prompt，但因为 `eventStream.nextId` 回到较低值，marker 仍不同，旧 override 会被错误保留。
  - 结果就是 `resolveOnlineAiEffectiveSeatState()` 继续返回陈旧 override，页面壳层会像还在等待旧 prompt 一样残留 waiting overlay。
- 本轮修复：
  - 在 `MatchRoom.tsx` 新增 `hasSeatScopedBlockingSurface(...)`
  - 当 override 里仍有 `interaction.current / interaction.queue / responseWindow.current`，但 latest seat state 已明确没有任何 seat-scoped blocking surface 时，直接释放 override，不再让较低 `nextId` 把旧 prompt 阴影保留下来。

### 本轮实际验证

1. focused 邻近矩阵：
   `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "seat latest state 在重连后即使 nextId 更低，只要已明确关闭旧 owner-only prompt，也不应继续沿用 override 阴影状态|latest seat state 尚未追平 confirmed override 时，必须继续保留 override 作为桥接态|latest seat state 已追平 confirmed override 时，不应继续沿用 override 阴影状态"`
   - 结果：`1 file passed, 3 passed`
2. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 118 passed`

### 本轮边界

- 这轮是 `MatchRoom` seat override / playerView writeback helper 的真实修复，不是 shared transport runtime 修复，也不是只补 focused 证据。
- 后续若继续追 Host/非目标页 waiting overlay 残项，下一格应优先查更靠真实多人页面链路的 page-shell / HUD / prompt presenter 是否还存在 stale waiting 文案，而不是回头再补 `react.tsx` 或 `MatchRoom` 这条已闭的 override retain/release seam。

## 2026-05-20 shared transport follow-up 50

- 本轮没有再横向扩 `server.test.ts`，而是专门验证“PromptOverlay 已消失但 `Board` 仍像卡住”的另一个候选：`interaction.isBlocked` 会不会在 patch / render 两层残留。

### 本轮结论

- `src/engine/transport/__tests__/patch.test.ts` 已新增 direct gate：
  - `applies authoritative isBlocked close patch when a hidden owner-only blocker is released`
- `src/engine/transport/__tests__/react.test.tsx` 已新增 direct gate：
  - `clears stale hidden-interaction isBlocked from rendered state when authoritative update unblocks it`
- 这两条都直接转绿，说明：
  - transport patch 在 authoritative `isBlocked:true -> false` 时会真实下发并应用 `/sys/interaction/isBlocked`
  - `GameProvider` 渲染态在收到权威 unblocked 更新后，也会把旧 `isBlocked:true` 清掉
- 因此当前 waiting 文案 residual 不再优先怀疑 `client.ts state:patch` 或 `react.tsx setState/refreshInteractionOptions`；更像是共享主视图本身仍在给 `Board` 一个 blocked shared state，或更外层 presenter/page-shell 还在沿用这份 blocked 权威态。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/patch.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "applies authoritative isBlocked close patch when a hidden owner-only blocker is released"`
   - 结果：`1 file passed, 1 passed`
2. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "clears stale hidden-interaction isBlocked from rendered state when authoritative update unblocks it"`
   - 结果：`1 file passed, 1 passed`
3. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/patch.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 31 passed`
4. 整文件门禁：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 9 passed`

### 本轮边界

- 这轮不是新的 runtime 修复，而是把 `isBlocked` 这条 waiting overlay 邻近 seam 从“可能残留”降成“patch/render 已闭”。
- 后续若继续追 Host/非目标页 waiting overlay，应优先看 shared state / playerView 为什么仍给 `Board.tsx` 一个 `G.sys.interaction.isBlocked === true`，而不是回头再补 transport patch 或 `GameProvider` render 这两层。

## 2026-05-20 shared transport follow-up 51

- 本轮不再凭旧截图印象把中央“正在等待 {{player}}”直接等同于 `PromptOverlay` 真残口，而是先补一条更硬的底层合同，确认普通 owner-only `simple-choice` 根本不会把 `current prompt` 泄给非 owner。

### 本轮结论

- `src/engine/systems/__tests__/InteractionSystem.test.ts` 已新增 direct gate：
  - `普通 simple-choice 对非 owner 只应暴露 blocked，不应透出 current prompt`
- focused 直接转绿，说明当前 `InteractionSystem.playerView()` 对普通 `simple-choice` 的合同仍是：
  - owner 看到 `interaction.current`
  - 非 owner 只拿到 `interaction.isBlocked === true`
  - 非 owner 不会拿到 `interaction.current`
- 这意味着如果 SmashUp 多人页中央还出现带玩家名的“正在等待 {{player}}”，它不再优先指向“owner-only prompt 被普通 playerView 泄露”这条假设；后续排查应收窄到：
  - 某条本就对双方可见的 prompt 没被真实关闭
  - page-shell / seat view / `playerID` 归属错位，把页面带到了错误视角

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/systems/__tests__/InteractionSystem.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "普通 simple-choice 对非 owner 只应暴露 blocked，不应透出 current prompt"`
   - 结果：`1 file passed, 1 passed`

### 本轮边界

- 这轮不是 runtime 修复，而是把“普通 simple-choice 会不会直接把 current 露给非 owner”这条底层假设打成 direct gate。
- 后续若继续追 Host/非目标页中央 waiting 文案，应优先查 `PromptOverlay` 真实承接到的是不是某条合法 shared-visible prompt，或 `MatchRoom` / `BoardBridge` / 页面 seat view 有没有把 `playerID` 归属带歪；不要再把普通 owner-only `simple-choice` playerView 泄露当开放项。

## 2026-05-20 shared transport follow-up 52

- 当前仓库里并没有旧 `smashup-yuanhou-*.e2e.ts` worktree 产物可直接复跑，所以这轮不再拿历史多人截图当唯一锚点，而是在当前主仓补一条更贴 UI 现象的组件级 direct gate：中央 `waiting_for_player` 文案到底依赖什么状态出现。

### 本轮结论

- `src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx` 已新增 direct gate：
  - `非 owner 只有拿到可见 current prompt 时才会出现中央 waiting_for_player 文案`
- focused 转绿后，当前主仓已经能直接证明：
  - 当页面拿到一个可见的 `interaction.current`，且 `current.playerId !== playerID` 时，`PromptOverlay` 中央会渲染 `waiting_for_player`
  - 当 `interaction` 变为 `undefined` 时，这行中央等待文案会直接消失
- 这条 direct gate 和上一拍 `InteractionSystem.playerView()` 的 non-owner guard 结合起来，缩小后的排查面更明确：
  - 中央 `waiting_for_player` 文案不可能由“仅 `isBlocked=true`、但没有 `current`”单独产生
  - 如果多人页中央还出现这行文案，必须继续查“某条 shared-visible current 没关掉”或“页面拿错了 `playerID` / seat view”

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "非 owner 只有拿到可见 current prompt 时才会出现中央 waiting_for_player 文案"`
   - 结果：`1 file passed, 1 passed`

### 本轮边界

- 这轮不是 runtime 修复，而是把“中央等待文案出现所需的最小 UI 前提”打成当前主仓可复查的 direct gate。
- 后续若继续追 Host/非目标页 waiting overlay，应优先查 shared visible prompt 生命周期或 page-shell 视角归属，不要再把“只有 blocked 没有 current 也会弹中央等待文案”当开放假设。

## 2026-05-20 shared transport follow-up 53

- 这轮终于把当前最像“真根因”的一格从猜测打成了红灯再转绿：`playerID=null` 的 spectator 视角过去确实会直接拿完整 shared state，而不是任何过滤后的公共视图。

### 本轮真修

- `src/engine/ai/playerView.ts`
  - 旧逻辑只有 `playerId !== null` 才会走 domain/system `playerView`
  - 结果：`applyPlayerViewToState(..., null)` 会把完整 `state` 原样回给 spectator
  - 现已改为：`playerId === null` 时也走统一过滤流水线，只是内部改用 sentinel `__spectator__`
- 含义：
  - spectator 不再直接看到 owner-only `interaction.current / queue`
  - `InteractionSystem.playerView()` 会把它降成 `current=undefined + queue=[] + isBlocked=true`
  - 这正好和上一拍 `PromptOverlay waiting_for_player` direct gate 拼上：如果某个页面真的掉成 spectator，再也不能因为“完整 shared state 里还挂着 owner-only current”而冒出中央等待文案

### 本轮新增 direct gate

- `src/engine/ai/__tests__/playerView.test.ts`
  - `spectator 视角不应直接看到 owner-only current 与 queue 交互`
- `src/engine/transport/__tests__/server.test.ts`
  - `sync 发出的 state:sync 对 spectator 也必须过滤 owner-only prompt，不得退回完整 shared state`
  - `broadcastState 发给 spectator 的 state:update/state:patch 也必须过滤 owner-only prompt`

### 本轮实际验证

1. focused 红灯转绿：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/ai/__tests__/playerView.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "spectator 视角不应直接看到 owner-only current 与 queue 交互"`
   - 结果：`1 file passed, 1 passed`
2. 相关整文件：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/ai/__tests__/playerView.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 3 passed`
3. transport 出口 focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "sync 发出的 state:sync 对 spectator 也必须过滤 owner-only prompt，不得退回完整 shared state|broadcastState 发给 spectator 的 state:update/state:patch 也必须过滤 owner-only prompt"`
   - 结果：`1 file passed, 2 passed`

### 本轮边界

- 这次是真修，但只修到“spectator 不再直接拿完整 shared state”这一格。
- 它还不能单独证明 `MatchRoom / BoardBridge / effectivePlayerID` 的真实多人页面一定正在错误掉成 spectator；那是下一步要继续核实的 caller seam。
- 后续若 Host/非目标页 waiting overlay 仍存在，应优先检查：
  - 页面是不是在某个时刻把 `playerID` 归零成 `null`
  - `effectivePlayerID = urlPlayerID ?? storedPlayerID ?? undefined` 是否让真实座位页退回 spectator route
  - 是否还有别的合法 shared-visible prompt 生命周期没有收口

## 2026-05-20 shared transport follow-up 54

- 这轮没有再去补外围 transport gate，而是把 `MatchRoom` 自己那段最可疑的 route 计算抽成纯 helper，直接锁“有 stored seat 时绝不能误退成 spectator/null playerID”。

### 本轮结论

- `src/pages/MatchRoom.tsx`
  - 新增 `resolveMatchRoomRouteIdentity(...)`
  - 把 `hasStoredSeat / isSpectatorRoute / effectivePlayerID / statusPlayerID / transportPlayerID` 从组件内的散逻辑收束成纯函数
- 这条 helper 当前显式锁住 3 个不变量：
  - `storedPlayerID` 存在且 URL 缺失时，仍必须保留 seat 身份
  - 即使显式带 `spectate=1`，只要本地还有 `storedPlayerID`，也不能把真实 seat 页压成 spectator
  - 只有无 URL、无 stored seat、且允许 spectate 路由时，才应退回 `transportPlayerID=null`
- 含义：
  - 现在至少可以排除“当前组件静态逻辑本身就会在有 seat 时无条件退成 spectator”
  - 如果真实多人页仍掉成 `playerID=null`，下一步就该查生命周期问题：`storedPlayerID` 是否短暂消失、`localStorageTick` 是否没刷新上来、或 reconnect/storage 恢复时 route 被错误重算

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "有 stored seat 且 URL 缺失时，必须继续使用 seat 身份而不是误退 spectator/null playerID|即使显式带 spectate=1，只要本地仍有 stored seat，也不能把真实 seat 页压成 spectator|只有无 URL、无 stored seat、且允许 spectate 路由时，才应退回 spectator/null playerID"`
   - 结果：`1 file passed, 3 passed`

### 本轮边界

- 这轮不是新的 runtime 修复，而是把 `MatchRoom` 的 route identity 合同补成 focused gate。
- 它不能单独证明真实页面一定曾经掉成过 spectator；只能证明“如果掉了，不是这段静态公式在有 `storedPlayerID` 时主动把你送过去”。
- 后续若继续追 Host/非目标页 waiting overlay，应优先检查 `storedPlayerID/localStorageTick` 的生命周期、reconnect 后的 route 重算时机，或别的 shared-visible prompt 生命周期，而不是回头再读这段 helper。

## 2026-05-20 shared transport follow-up 55

- 这轮把 `storedPlayerID/localStorageTick` 邻近的最小存储链也钉住了，避免后续再把“同页根本没收到凭据刷新事件”当成空泛怀疑。

### 本轮结论

- `src/pages/__tests__/matchSeatValidation.test.ts`
  - 新增 `persistMatchCredentials 会立刻写入 localStorage，并通知同页监听器刷新 stored seat`
  - 新增 `clearMatchCredentials 会立刻清空 localStorage，并通知同页监听器避免页面继续沿用旧 seat`
- 含义：
  - `persistMatchCredentials(...)` 与 `clearMatchCredentials(...)` 当前都会在 same-tab 主动派发 `match-credentials-changed`
  - 所以如果真实多人页还会掉成 `playerID=null`，当前不应优先怀疑“凭据写入了，但同页压根没收到刷新事件”
  - 真正更值得继续追的是 `MatchRoom` 自己在 reconnect / `validateStoredMatchSeat()` / localStorage 解析失败时，是否会把 `storedMatchCreds` 短暂读成 `null`

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "persistMatchCredentials 会立刻写入 localStorage，并通知同页监听器刷新 stored seat|clearMatchCredentials 会立刻清空 localStorage，并通知同页监听器避免页面继续沿用旧 seat"`
   - 结果：`1 file passed, 2 passed`

### 本轮边界

- 这轮不是新的 runtime 修复，而是把 same-tab credential refresh 也补成 direct gate。
- 它不能证明 `storedMatchCreds` 在真实页面里永远不会短暂变成 `null`；只能证明“单靠 `persist/clear` helper 自身不派发事件”不是当前第一嫌疑。
- 后续若继续追 Host/非目标页 waiting overlay，应优先检查：
  - `validateStoredMatchSeat()` 清凭据的时机
  - reconnect / `matchStatus` 更新期间 `storedMatchCreds` 是否会短暂读空
  - localStorage 中原始 JSON 是否可能被写坏或被别处 prune/clear

## 2026-05-20 shared transport follow-up 56

- 这轮把 `MatchRoom` 真正会掉成 spectator 的 caller path 不只是“测出来”，而是直接加了保守缓冲：旧凭据 missing-seat/seat-empty 不再首拍就清，必须连续两次稳定坏快照才会清本地 seat。

### 本轮真修

- `src/pages/MatchRoom.tsx`
  - 新增 `pendingSeatValidationClearKeyRef`
  - `validateStoredMatchSeat()` 返回 `shouldClear=true` 时，旧逻辑是首拍立即 `clearMatchCredentials(matchId)`，然后页面立刻退回 `effectivePlayerID=null / isSpectatorRoute=true`
  - 现已改为：
    - 第一次稳定坏快照只记录 `matchId + statusPlayerID + reason + stored.playerID`
    - 只有第二次相同坏快照再次出现时才真正清凭据
    - 一旦中途恢复正常、进入 loading/empty players/autoJoin grace，待清理 key 会被清空
- 设计含义：
  - 一次性的 stale `matchStatus.players` 快照不再足以把真实 seat 页打回 spectator
  - 但若缺 seat/空 seat 状态持续稳定存在，最终仍会清理本地脏凭据，不会永久卡死在旧 seat 身份

### 本轮新增 / 更新的 component gate

- 新文件：`src/pages/__tests__/MatchRoom.routeIdentity.test.tsx`
  - `无 URL playerID 但 localStorage 已有 seat 时，首帧不应把 GameProvider 挂成 spectator/null`
  - `最近刚写入的 stored seat 即使 matchStatus 暂时缺少该座位，也不应立刻清空凭据并退回 spectator`
  - `过期 stored seat 且 matchStatus 持续缺少该座位时，必须连续两次稳定坏快照后才清空凭据并退回 spectator`
  - `stale seat 在中间恢复正常后必须重置 pending clear，后续新的坏快照仍需重新累计两拍`

### 本轮实际验证

1. 整文件：
   `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/MatchRoom.routeIdentity.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 4 passed`
2. 关键观察：
   - 首帧 stored seat 场景日志直接打印 `effectivePlayerID:'0' / isSpectatorRoute:false`
   - stale seat 场景第一拍仍保持 `effectivePlayerID:'0' / isSpectatorRoute:false`
   - 触发第二次相同坏快照后，日志才切到 `effectivePlayerID:null / isSpectatorRoute:true`
   - 若中间恢复为包含该 seat 的正常 players 快照，待清理标记会重置；后续新的坏快照仍需重新累计两拍

### 本轮边界

- 这次是真修，但只缓冲了 `MatchRoom` 基于 `validateStoredMatchSeat()` 的本地 seat 清理路径。
- 它不能证明 Host/非目标页 waiting overlay 全部收口，因为仍可能存在：
  - 合法 shared-visible prompt 生命周期没收口
  - 别的 page-shell / playerView 路径把页面带歪
  - 真正持续的 missing-seat/seat-empty 仍会在二次确认后回退到 spectator
- 后续若继续推进，优先级应转到：
  - 真实多人链路里 `matchStatus.players` 为什么会缺 seat
  - 是否还有不经 `validateStoredMatchSeat()` 的别的 `playerID=null` caller

## 2026-05-20 shared transport follow-up 57

- 这轮先回答“是不是死循环”：不是完全空转，但前期确实有一段被旧 `goal.objective` 的 `The Spy Who Ditched Me Host/非目标页 waiting overlay` 文案带着横向补了太多邻近 gate，导致进度表现得像在绕同一个点。
- 当前可复查的真实进展已经收窄成三条 runtime / caller 事实：
  - `playerID=null` 的 spectator 视角过去会绕过 `playerView` 拿完整 shared state；现在 `src/engine/ai/playerView.ts` 已改成 spectator 也走统一过滤。
  - `MatchRoom` 静态 route identity 已证明：只要有 stored seat，就不应因为 URL 缺 `playerID` 或 `spectate=1` 退成 spectator。
  - `validateStoredMatchSeat()` 这条真正会清本地 seat 的 caller 已从单拍清理改成两拍确认，避免一次 stale `matchStatus.players` 把真实 seat 页打回 spectator。

### 本轮复验

1. `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/MatchRoom.routeIdentity.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 4 passed`
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/ai/__tests__/playerView.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 3 passed`
3. `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "resolveMatchRoomRouteIdentity|match-credentials-changed lifecycle|seat latest state 在重连后即使 nextId 更低，只要已明确关闭旧 owner-only prompt，也不应继续沿用 override 阴影状态"`
   - 结果：`1 file passed, 6 passed / 117 skipped`

### 当前边界

- 这些不是最终 E2E 收口。它们证明了 shared transport/playerView 与 MatchRoom seat fallback 的几个核心风险已经被修掉或锁住，但还没有真实多人浏览器截图证明 Host/非目标页 waiting overlay 在原场景完全消失。
- 下一步不应继续横向补 `server.test.ts` 同型 payload gate；应直接回到更贴真实 UI 的最小链路：
  - 查 `matchStatus.players` 是否可能持续两拍缺 seat，以及缺 seat 的来源。
  - 查是否还有绕过 `validateStoredMatchSeat()` 的 `GameProvider.playerId=null` caller。
  - 若上述静态链路无新洞，补一个真实多人 E2E/组件链路，证明 owner-only prompt 收口后 Host/非目标页没有中央 `waiting_for_player` overlay。

## 2026-05-20 shared transport follow-up 58

- 继续沿真实 waiting overlay 必要条件收窄：如果非 owner view 在 owner-only prompt 关闭后仍停在 `isBlocked=true`，即使 `current` 已被过滤，也可能残留等待态。当前主仓已有对应 gate，本轮单独复验。

### 本轮复验

1. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "owner-only 交互关闭后，broadcastState 必须把非 owner shared view 的 isBlocked 明确收口为 false"`
   - 结果：`1 file passed, 1 passed / 201 skipped`

### 结论

- 这条证明 transport broadcast 层在 owner-only prompt 关闭后会把非 owner shared view 的 `interaction.isBlocked` 显式收口为 `false`。
- 它不是最终浏览器证明；它只说明 waiting overlay 若仍残留，下一步应查页面层是否仍持有旧 view、是否处于 spectator/错误 playerId、或是否有合法 shared-visible prompt 没收口，而不是继续怀疑 broadcast 层没有发 unblock。

## 2026-05-20 shared transport follow-up 59

- 本轮停止继续横向补 `server.test.ts` 同型 payload gate，改补更贴 UI 残留的 transport -> SmashUp PromptOverlay 链路证据：非 owner 页面先看到一个 shared-visible prompt 的中央 `waiting_for_player`，随后收到 authoritative close 后，提示层必须从实际 DOM 中消失。

### 本轮新增 gate

- `src/engine/transport/__tests__/react.test.tsx`
  - 新增 `removes SmashUp waiting prompt from rendered UI when authoritative close reaches the non owner page`
  - 测试把 `GameProvider` 的 render state 直接接到 `SmashUp PromptOverlay`，第一拍注入 `current.playerId='1'` 的 visible prompt，P0 页面出现 `正在等待 {{player}}`；第二拍注入 `current=undefined / queue=[] / isBlocked=false` 的权威关闭态，断言 `client.updateLatestState()` 接收关闭态且 DOM 中不再存在 waiting 文案。
  - 同时把 `InteractionSystem` mock 改成 partial mock，保留 `refreshInteractionOptions` spy，但让 `PromptOverlay` 使用真实 `asSimpleChoice()`。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "removes SmashUp waiting prompt"`
   - 结果：`1 file passed, 1 passed / 10 skipped`
2. 整文件：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 11 passed`
3. 前一轮补记整文件：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 202 passed`

### 当前边界

- 这条比纯 transport JSON 断言更接近用户看到的 waiting overlay，因为它验证了权威关闭态能让真实 `PromptOverlay` DOM 卸载 waiting 文案。
- 它仍不是最终多人浏览器截图：没有真实创建 Host/Guest 两个页面，也没有覆盖 `The Spy Who Ditched Me` 原始多人链路。下一步如果继续收口，应优先补多人 E2E 或等价截图证据；在此之前不能宣布 goal 完成。

## 2026-05-20 shared transport follow-up 60

- 本轮继续补真实多人浏览器证据：使用真实 Host/Guest 两个页面、在线房间、服务端状态注入，让 Host 拥有一个 owner-only prompt，并验证 Guest 非目标页在 prompt 打开期间和权威关闭后都没有中央 `waiting_for_player` 残留。

### 本轮新增 E2E gate

- `e2e/smashup/smashup-phase-transition-simple.e2e.ts`
  - 新增 `在线双人非目标页在 prompt 打开与权威关闭后都不应残留 waiting overlay`
  - 第一拍注入 `interaction.current.playerId='0'` 的 prompt：Host 页面能看到并操作 `确认` 按钮；Guest 页面权威状态被过滤成 `currentId:null / isBlocked:true`，DOM 中没有 `正在等待 Host-SU-E2E`。
  - 第二拍注入权威关闭态：Guest 页面收到 `currentId:null / isBlocked:false`，DOM 中仍没有 waiting 文案。
- `e2e/helpers/smashup-skip-setup.ts`
  - 状态注入专用在线房间 helper 改为 `skipImageGate:true`，避免此类测试卡在“加载素材 9/10”。
  - 派系选择标题等待补充 `选择你的派系`，兼容当前中文文案。

### 本轮实际验证

1. `PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4274 PW_PORT=4274 PW_E2E_GAME_SERVER_PORT=20210 PW_GAME_SERVER_PORT=20210 GAME_SERVER_PORT=20210 PW_E2E_API_SERVER_PORT=21210 PW_API_SERVER_PORT=21210 API_SERVER_PORT=21210 PW_RUNTIME_SCOPE=smashup-waiting-overlay-close BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线双人非目标页在 prompt 打开与权威关闭后都不应残留 waiting overlay"`
   - 结果：`1 passed`
2. 截图：
   - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线双人非目标页在-prompt-打开与权威关闭后都不应残留-waiting-overlay\在线双人非目标页在-prompt-打开与权威关闭后都不应残留-waiting-overlay-online-waiting-overlay-open-filtered-nontarget.png`
   - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线双人非目标页在-prompt-打开与权威关闭后都不应残留-waiting-overlay\在线双人非目标页在-prompt-打开与权威关闭后都不应残留-waiting-overlay-online-waiting-overlay-after-authoritative-close.png`

### 本轮看图结论

- 两张截图均为 Guest 非目标页真实浏览器画面，能看到对局棋盘、计分板、对手回合提示与底部手牌/弃牌区域，没有中央 waiting overlay，也没有 `正在等待 Host-SU-E2E` 文案。
- `open-filtered-nontarget` 截图对应 prompt 打开期间：服务端状态断言 Guest 视角 `currentId:null / isBlocked:true`，画面上没有可操作 prompt 或 waiting overlay。
- `after-authoritative-close` 截图对应权威关闭后：服务端状态断言 Guest 视角 `currentId:null / isBlocked:false`，画面仍无 waiting overlay。

### 当前边界

- 这条已经是多人浏览器证据，不再停在组件/transport 单测。
- 它仍是 synthetic owner-only prompt 状态注入，不是 `The Spy Who Ditched Me` 从真实卡牌入口打出的完整链路；因此可以把 Host/非目标页 waiting overlay 残留风险大幅降级，但不能把整个 yuanhou effect atom goal 标记完成。

## 2026-05-20 shared transport follow-up 61

- 本轮直接回应“是不是死循环”：没有继续回扫旧 `goal.objective=The Spy Who Ditched Me ... waiting overlay`，而是按当前长期状态里的 shared transport / completion-audit 锚点，扫出 3 条仍停在 `reason` 或 `stateSnapshot` 级的 success/recovered payload 薄口。
- 这轮没有改 runtime；只把已有成功恢复分支补成 `stateSnapshot + actionLog` 双出口 direct gate，确认反馈 payload 会保留 blocker provenance 与 `trackerKey`。

### 本轮补强 gate

- `src/engine/transport/__tests__/server.test.ts`
  - `online AI watchdog 完成 legal action 恢复后也应写入系统反馈`
    - 旧断言只看 `reason` 与 `stateSnapshot` 存在。
    - 新断言解析 `stateSnapshot/actionLog`，确认二者都保留 `4|main2|1|0`，且 `trackerKey` 与 payload 顶层一致。
  - `online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死`
    - 新增 `stateSnapshot/actionLog.blockerFingerprint` 对 `seat-legal-only` 与 `defensiveRoll` 的断言。
  - `online AI watchdog 在 human active 的 off-turn targetingRoll 阶段也应代 AI 执行合法动作，避免 4 人选目标卡死`
    - 新增 `stateSnapshot/actionLog.blockerFingerprint` 对 `seat-legal-only` 与 `targetingRoll` 的断言。

### 本轮实际验证

1. focused 两条联跑：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 完成 legal action 恢复后也应写入系统反馈|online AI watchdog 在 human active 的 off-turn defensiveRoll 阶段也应代 AI 执行合法动作，避免防御骰卡死|online AI watchdog 在 human active 的 off-turn targetingRoll 阶段也应代 AI 执行合法动作，避免 4 人选目标卡死"`
   - 结果：`1 file passed, 2 passed / 200 skipped`
   - 注：过滤词中的 defensiveRoll 用例标题未命中，随后单独补跑。
2. focused 防御骰单条：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死"`
   - 结果：`1 file passed, 1 passed / 201 skipped`
3. 整文件：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 202 passed`

### 当前边界

- 这是 completion-audit 证据补强，不是新的玩法 runtime 修复，也不是 `The Spy Who Ditched Me` 原卡真实入口 E2E。
- 后续不要再把这三条 `legal-action-recovered / seat-legal-only` success 分支当成 “只有 reason、缺 payload provenance” 的开放残口；继续时应找别的 still-reason-only/suppressed success seam，或回到真实多人原卡链路。

## 2026-05-21 waiting overlay revalidation

- 本轮没有继续横向扩 `server.test.ts` 或再造新的 synthetic seam，而是先把 active goal 里最贴脸的 waiting overlay 多人门禁在**当前主仓**重新复跑，确认这条 shared transport / playerView / page-shell 证据在后续一轮轮 owner-context / queued-trigger 修复后没有回归。

### 本轮复验

1. `PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4274 PW_PORT=4274 PW_E2E_GAME_SERVER_PORT=20210 PW_GAME_SERVER_PORT=20210 GAME_SERVER_PORT=20210 PW_E2E_API_SERVER_PORT=21210 PW_API_SERVER_PORT=21210 API_SERVER_PORT=21210 PW_RUNTIME_SCOPE=smashup-waiting-overlay-close BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线双人非目标页在 prompt 打开与权威关闭后都不应残留 waiting overlay"`
   - 结果：`1 passed`

2. 当前仓复跑截图：
   - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线双人非目标页在-prompt-打开与权威关闭后都不应残留-waiting-overlay\在线双人非目标页在-prompt-打开与权威关闭后都不应残留-waiting-overlay-online-waiting-overlay-open-filtered-nontarget.png`
   - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线双人非目标页在-prompt-打开与权威关闭后都不应残留-waiting-overlay\在线双人非目标页在-prompt-打开与权威关闭后都不应残留-waiting-overlay-online-waiting-overlay-after-authoritative-close.png`

### 本轮结论

- 当前主仓里，Guest 非目标页在 prompt 打开期间仍保持 `currentId:null / isBlocked:true` 且**没有**中央 waiting overlay；权威关闭后保持 `currentId:null / isBlocked:false` 且**仍没有**中央 waiting overlay。
- 这说明 active goal 里点名的 Host/非目标页 waiting overlay synthetic 多人浏览器证据在当前仓没有被后续 shared 变更打坏。

### 当前边界

- 这次是**当前仓复验仍绿**，不是新的玩法 runtime 修复。
- 它仍然只是 synthetic owner-only prompt 状态注入，不是 `The Spy Who Ditched Me` 从真实卡牌入口打出的完整多人链；因此可以确认当前 shared transport/playerView/page-shell 证据未回退，但不能把整个 goal 标记完成。
- 后续若继续贴着旧 objective 往前推，下一格应优先找“当前仓能真实打出的 owner-only prompt 链”或对应 worktree 里的 `super_spies` 真卡入口，而不是重复把这条 synthetic waiting-overlay 门禁当成未验证项。

## 2026-05-22 response-window same-sequence handoff revalidation

- 本轮继续按长期 state 的 shared transport / completion-audit 锚点推进，没有回扫旧 `The Spy Who Ditched Me ... waiting overlay` 文案。
- 这次命中的是一条测试合同纠偏：`response-window` 先走 `RESPONSE_PASS` 后，同一 AI 若立刻落到 `active-turn` 的合法动作，当前 runtime 会在同一恢复序列里继续消费后续合法动作，但不承诺额外写 `legal-action-recovered` resolved feedback payload。

### 本轮新增 gate

- `src/engine/transport/__tests__/server.test.ts`
  - 新增 `online AI watchdog 在 response-window 先 RESPONSE_PASS 后若同一 AI 紧接给出 active-turn legal action，应在同一恢复序列内继续收口且不误落成失败反馈`
  - 测试构造 `responseWindow.current.id='response-loop-handoff-1'`，第一步 AI dispatch 返回 `RESPONSE_PASS`，执行后窗口重开成 `response-loop-handoff-2`；第二步 strict view 被 `stale-private-overlay` 阻挡；emergency playerView 后第三步返回 `ADVANCE_PHASE`。
  - 断言真实执行链为 `['RESPONSE_PASS', 'ADVANCE_PHASE']`，最终 `activePlayerId='0'`，并且不会把这次收口误写成 `force-end-turn-failed`。

### 本轮实际验证

1. focused：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 response-window 先 RESPONSE_PASS 后若同一 AI 紧接给出 active-turn legal action，应在同一恢复序列内继续收口且不误落成失败反馈"`
   - 结果：`1 file passed, 1 passed / 204 skipped`
2. 整文件：
   `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
   - 结果：`1 file passed, 205 passed`
3. diff 检查：
   `git diff --check -- src/engine/transport/__tests__/server.test.ts`
   - 结果：passed，仅 LF/CRLF warning。

### 当前边界

- 这是 completion-audit 直测补强，不是新的 runtime 修复。
- 当前证明的是 `response-window -> response-loop emergency-view -> active-turn legal action` 能在同一恢复序列继续收口，并且不会误报失败；它不证明所有 `response-window` recovery 分支都已全量覆盖。
- 后续若 shared transport / playerView 还像死循环，应继续找别的 caller provenance 或真实多人卡牌链路，不要再把这条 same-sequence handoff 当开放 residual。
