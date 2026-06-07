# 线上 open 反馈复核（2026-06-04）

## 范围

- 当前 worktree 的继续修复与本地复核
- 本轮不做生产部署，不回写 `boardgame.feedbacks` 状态
- 只覆盖这轮实际继续推进的 open 反馈：
  - `smashup / feedback-modal / 修格斯的力量的代价特殊计分貌似没有触发`
  - `smashup / feedback-modal / 大杀四方貌似一个基地随从过多不能选取最下面的随从`
  - `smashup / feedback-modal / 极客粉丝弃不了`
  - `smashup / feedback-modal / 极客的平衡是打敌人的牌，但只能选自己的牌且无法打出`
  - `dicethrone / player-command-failure / dice.map is not a function`
  - `dicethrone / online-ai-watchdog / dice.map is not a function`
  - `client / client-unhandled-rejection / Failed to start the audio device`
  - `client / client-window-error / Script error.`

## 结论

- 当前 worktree 下，上述 6 组 open 反馈都已有明确代码收口证据。
- 当前 worktree 下，上述 8 组 open 反馈都已有明确代码收口证据。
- 其中：
  - 两条 SmashUp 人类反馈，本轮确认不是“当前代码仍未覆盖”的活 bug，而是已有对位回归。
  - 两条极客手牌入口反馈，本轮先用真实手牌点击 E2E 打出了活 bug，再按最小 UI 入口修复收口。
  - DiceThrone `dice.map is not a function` 本轮继续补齐了前台奖励骰弹层、行动日志、Treant 奖励骰结算链路的脏态兼容与回归。
  - 两条 client 自动反馈属于浏览器/设备层噪音，本轮在自动反馈入口统一过滤，避免继续污染 open 列表。
- 本轮结论仍然只代表“当前 worktree 已覆盖”，**不代表生产已收口**。

## 1. SmashUp《力量的代价》特殊计分反馈

- 反馈原文：
  - `smashup / feedback-modal / 修格斯的力量的代价特殊计分貌似没有触发`
- 本轮判断原则：
  - 先验证用户原始链路是否已有真实回归，而不是先改能力本体。
- 对位回归：
  - `src/games/smashup/__tests__/meFirst.test.ts`
  - 用例：
    - `Me First! 窗口中打出《力量的代价》会真实结算亮手牌并给己方随从加力量`
- 覆盖点：
  - `Me First!` 响应窗口真实打出《力量的代价》
  - 触发 `ACTION_PLAYED`
  - 触发 `REVEAL_HAND`
  - 产生 2 次 `POWER_COUNTER_ADDED`
  - 响应窗口正常关闭
- 本轮验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/meFirst.test.ts --configLoader native --config vitest.config.core.ts -t "Me First! 窗口中打出《力量的代价》会真实结算亮手牌并给己方随从加力量"`
- 结果：
  - 通过
- 当前结论：
  - 这条反馈对应的“特殊计分/响应链未触发”在当前 worktree 未复现。
  - 当前更像历史反馈未回写，不是本轮仍需继续改 SmashUp 领域逻辑的活缺口。

## 2. SmashUp 基地底部随从点击反馈

- 反馈原文：
  - `smashup / feedback-modal / 大杀四方貌似一个基地随从过多不能选取最下面的随从`
- 对位回归：
  - `src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx`
  - 用例：
    - `随从选择模式下不应继续负向堆叠，底部随从仍可单独点击`
- 覆盖点：
  - 选择模式下不再继续负向堆叠
  - 底部随从样式 `marginTop = 0vw`
  - 可直接点击底部随从并命中 `onMinionSelect('m3', 0)`
- 本轮验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx --configLoader native --config vitest.config.ts`
- 结果：
  - 通过
- 当前结论：
  - 当前 worktree 已对位覆盖“基地随从过多时底部随从点不到”这条反馈的症状形状。

## 3. SmashUp 极客手牌入口反馈

### 3.1 粉丝弃不了

- 反馈原文：
  - `smashup / feedback-modal / 极客粉丝弃不了`
- 本轮判断原则：
  - 不只停留在领域层 `ACTIVATE_SPECIAL` 单测，要补真实“点手牌 -> 点基地”入口回归。
- 本轮真实发现：
  - 首版 E2E 直接复现了活 bug：
    - 真实点击手牌《粉丝》后，前端没有切到 `hand-special`
    - UI 直接吐出 `本回合随从额度已用完`
    - 《粉丝》仍留在手牌，无法进入弃牌摸 1 的 special 链
- 根因：
  - `src/games/smashup/Board.tsx`
  - 普通随从 UI 落点判断 `getDeployableBaseStateForCard(..., 'minion')` 没有与真实 `PLAY_MINION` 校验完全对齐
  - 在随从额度已满但手牌 special 仍合法的场景下，UI 误把《粉丝》判成“还能正常按随从落点处理”，从而错过 `shouldPreferHandSpecialSelection(...)` 分流
- 本轮修复：
  - `src/games/smashup/Board.tsx`
  - 普通随从 UI 落点判断统一改走真实 `validate(matchState, PLAY_MINION)` 结果
  - `shouldPreferHandSpecialSelection(...)` 改读当前 UI 归一化后的 `matchState`
- 对位浏览器回归：
  - `e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts`
  - 用例：
    - `粉丝在随从额度已满时，仍可从真实手牌点击后走 special 链弃掉并摸 1 张`
- 覆盖点：
  - 当前玩家 `minionsPlayed = minionLimit = 1`
  - 真实点击手牌里的《粉丝》
  - 不走普通随从落点 denied，而是切到 hand-special 链
  - 点击基地后《粉丝》进入弃牌堆并摸 1 张，不会错误部署到基地

### 3.2 平衡只能选自己的牌且无法打出

- 反馈原文：
  - `smashup / feedback-modal / 极客的平衡是打敌人的牌，但只能选自己的牌且无法打出`
- 本轮真实发现：
  - 真实手牌入口链路当前 worktree 是通的，但此前缺少浏览器级回归。
  - 首版 E2E 失败点来自测试断言拿错了 PromptOverlay 的真实 DOM 形态，不是业务逻辑本体失效。
- 对位浏览器回归：
  - `e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts`
  - 用例：
    - `平衡从真实手牌打出时，应展示对手手牌并可借打附着行动到己方随从`
- 覆盖点：
  - 真实从手牌打出《平衡》
  - 行动候选展示对手手牌中的《扩大力量》
  - 不把自己手里另一张行动错误展示为可选候选
  - 继续进入目标随从链，并成功把借来的行动附着到己方随从
  - 借来的牌从对手手牌移出，不落入对手弃牌堆

### 3.3 本轮验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/handSpecialSelection.test.ts src/games/smashup/__tests__/commandsValidation.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native --config vitest.config.core.ts -t "极客粉丝在随从额度已用完但 special 仍合法时，应优先走 hand-special 选择|supports hand-based special validation for geeks_fan during playCards only|粉丝可在你的回合从手牌弃掉并摸 1 张|平衡可从对手手牌额外打出附着到随从的行动，并按当前玩家身份生效|平衡可从对手手牌额外打出无目标行动，并在结算后进入拥有者弃牌堆"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts`

### 3.4 当前结论

- 当前 worktree 已真实修复《粉丝》手牌入口漏切 `hand-special` 的活 bug，并用浏览器级 E2E 锁住。
- 《平衡》当前 worktree 在真实手牌入口下未复现“只能选自己的牌且无法打出”，并已补齐浏览器级回归。
- 若生产仍报这两条同类问题，更大概率是生产未带上当前 worktree 修复或反馈状态未回写，而不是本地这条交互链仍然活着。

## 4. DiceThrone `dice.map is not a function`

- 反馈原文：
  - `dicethrone / player-command-failure / dice.map is not a function`
  - `dicethrone / online-ai-watchdog / dice.map is not a function`
- 本轮新增修复文件：
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/domain/customActions/treant.ts`
- 本轮修复点：
  - 前台奖励骰弹层 `bonusDice` 不再直接读取 `pendingBonusDiceSettlement.dice`
  - 关闭奖励骰面板时写日志的 `diceValues` 改为统一走 `getPendingBonusSettlementDice(...)`
  - Treant 的 `rooted`、`soulfire`、`mother-tree` 奖励骰读取统一走 `getPendingBonusSettlementDice(...)`
- 本轮新增回归：
  - `src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
    - `displayOnly 结算的旧脏 dice shape 不应在可见性判断里崩溃`
    - `旧脏 interactive pendingBonusDiceSettlement 不应在前台奖励骰弹层链路里崩溃`
  - `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts`
    - `rooted 在旧 pendingBonusDiceSettlement 脏 dice shape 下不应因 reduce/map 崩溃，而应拒绝非法结算`
- 本轮补充复核：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
    - `旧 pendingBonusDiceSettlement 脏 dice shape 不应让 AI 构建奖励骰动作时崩溃`
  - 扫描非测试业务代码后，`pendingBonusDiceSettlement.dice` 的业务层直接读取已只剩归一化入口：
    - `src/games/dicethrone/domain/index.ts`
    - `src/games/dicethrone/domain/rules.ts`
- 本轮验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx --configLoader native --config vitest.config.core.ts -t "displayOnly 结算的旧脏 dice shape 不应在可见性判断里崩溃|旧脏 interactive pendingBonusDiceSettlement 不应在前台奖励骰弹层链路里崩溃"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts --configLoader native --config vitest.config.core.ts -t "rooted 在旧 pendingBonusDiceSettlement 脏 dice shape 下不应因 reduce/map 崩溃，而应拒绝非法结算"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --config vitest.config.core.ts -t "旧 pendingBonusDiceSettlement 脏 dice shape 不应让 AI 构建奖励骰动作时崩溃"`
- 结果：
  - 全部通过
- 当前结论：
  - 当前 worktree 已继续收口 `pendingBonusDiceSettlement.dice` 历史脏 shape 导致的 `map/reduce` 崩溃面。
  - 这两条 open 当前更像“生产仍带旧状态/旧代码或反馈状态未回写”，不再是当前代码里明显还活着的同类缺口。

## 5. Client 自动反馈噪音过滤

### 4.1 音频设备启动失败

- 反馈原文：
  - `client / client-unhandled-rejection / Failed to start the audio device`
- 本轮修复：
  - `src/lib/feedback/clientAutoReport.ts`
  - 新增 `isKnownClientAudioDeviceNoise(...)`
  - 对 `InvalidStateError + Failed to start the audio device` 直接跳过自动上报
- 回归：
  - `src/lib/__tests__/clientAutoReport.test.ts`
    - `音频设备启动失败噪音会被过滤，不进入自动反馈`
  - `src/lib/__tests__/errorContext.autoReport.test.ts`
    - `音频设备启动失败的 unhandledrejection 不会自动上报，但会保留最近错误上下文`

### 4.2 `Script error.`

- 反馈原文：
  - `client / client-window-error / Script error.`
- 本轮修复：
  - `src/lib/feedback/clientAutoReport.ts`
  - 新增 `isGenericScriptErrorNoise(...)`
  - 统一过滤 `Script error` 与 `Script error.`
- 回归：
  - `src/lib/__tests__/clientAutoReport.test.ts`
    - `Script error. 浏览器通用噪音会被过滤，不进入自动反馈`
  - `src/lib/__tests__/errorContext.autoReport.test.ts`
    - `Script error. 的 window error 不会自动上报，但会保留最近错误上下文`

### 4.3 本轮验证

- `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts src/lib/__tests__/errorContext.autoReport.test.ts --configLoader native --config vitest.config.ts -t "音频设备启动失败噪音会被过滤，不进入自动反馈|Script error. 浏览器通用噪音会被过滤，不进入自动反馈|音频设备启动失败的 unhandledrejection 不会自动上报，但会保留最近错误上下文|Script error. 的 window error 不会自动上报，但会保留最近错误上下文"`

- 结果：
  - 4 条定向用例全部通过

- 当前结论：
  - 这两条 open 更适合按“自动反馈噪音过滤”处理，而不是继续追业务链路。

## 边界

- 本轮未执行：
  - 生产部署
  - `feedbacks` 集合状态回写
  - 批量关闭 open
- 本文只证明：
  - 当前 worktree 对上述 open 已有本地代码与回归证据
  - 下一步若要真正收口线上列表，仍需要把代码带到生产并复查新样本是否停止增长

## 下一步建议

1. 继续从当前仍未复核的 open 反馈中挑真正还活着的样本，不要重复修本文件已覆盖的这 6 组。
2. 等用户要求提交/上线时，再基于本轮 diff 做最小范围提交与后续生产验证。
