# Dice Throne `target: 'select'` 四人模式审计

## 审计范围

- `src/games/dicethrone/domain/executeCards.ts`
- `src/games/dicethrone/domain/execute.ts`
- `src/games/dicethrone/domain/rules.ts`
- `src/games/dicethrone/domain/customActions/common.ts`
- `src/games/dicethrone/domain/commonCards.ts`
- `src/games/dicethrone/__tests__/flow.test.ts`
- `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`
- `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts`

## 结论等级

- 已修复共享误判，仍有 Loaded 展示体验待决

## 权威来源

- 卡牌描述快照：
  - `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts:537`
  - `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts:539`
  - `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts:542`
  - `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts:546`
- 引擎内“当前只有一个投掷方”的权威约束：
  - `src/games/dicethrone/domain/core-types.ts:125`
  - `src/games/dicethrone/domain/customActions/common.ts:61`

## 逐项结论

### 1. `card-surprise` / `card-unexpected` / `card-flick`

- 描述语义：
  - `Surprise`: Change any 1 die to any value.
  - `Unexpected`: Change any 2 dice to any values.
  - `Flick`: Increase or decrease 1 die value by 1.
- 定义入口：
  - `src/games/dicethrone/domain/commonCards.ts:163`
  - `src/games/dicethrone/domain/commonCards.ts:183`
  - `src/games/dicethrone/domain/commonCards.ts:217`
- 实际问题：
  - 这三张牌都写成 `action.target = 'select'`，但共享规则层把所有 `target: 'select'` 一律解释成“4 人模式需要先选 defender”。
  - 触发点在 `src/games/dicethrone/domain/rules.ts:1196` 与 `src/games/dicethrone/domain/executeCards.ts:208-248`。
  - 真正的骰子归属其实已经由 `resolveDiceOwnerId()` 直接绑定到当前 `rollerId`，并不需要再选玩家，见 `src/games/dicethrone/domain/customActions/common.ts:51-61`、`src/games/dicethrone/domain/customActions/common.ts:120-165`。
- 命中维度：
  - D1 语义保真
  - D5 交互完整
  - D23 共享抽象假设冲突
- 判定结论：
  - High。四人模式下会错误弹出 `selectPlayer`，属于共享抽象误判，不是单卡特例。
- 修复回写：
  - 已在 `src/games/dicethrone/domain/rules.ts` 去掉 `target: 'select' => 必须先选 defender` 的共享误判。
  - 现在会直接进入各自 custom action 生成的改骰交互，不再先套一层错误的 `selectPlayer`。
- 证据层级：
  - L1 结构证据
  - L4 治理证据

### 2. `card-get-away`

- 描述语义：
  - Remove 1 status effect from any player.
- 定义入口：
  - `src/games/dicethrone/domain/commonCards.ts:255`
- 实际问题：
  - 它同样使用 `action.target = 'select'`，因此也会被 `cardNeedsSelectedDefender()` 误判成“先选敌方 defender”。
  - 但后续真实 handler `remove-status-1` 本来会创建 `selectStatus`，并把 `targetPlayerIds` 设为 `Object.keys(state.players)`，也就是全场任意玩家，见 `src/games/dicethrone/domain/customActions/common.ts:227-236`。
  - 这说明前置的 `selectPlayer` 不但多余，而且会把“任意玩家”错误缩成“仅敌方玩家”。
- 命中维度：
  - D1 语义保真
  - D2 边界完整
  - D23 共享抽象假设冲突
- 判定结论：
  - High。这个问题比改骰牌更严重，因为它会丢失合法目标集合。
- 修复回写：
  - 共享修复后，`card-get-away` 会直接进入 `remove-status-1` 生成的 `selectStatus`，目标集合恢复为全场玩家。
- 证据层级：
  - L1 结构证据
  - L4 治理证据

### 3. 选择结果与真实骰子目标脱钩

- 实现入口：
  - `src/games/dicethrone/domain/execute.ts:907-922`
  - `src/games/dicethrone/domain/customActions/common.ts:51-61`
- 实际问题：
  - `RESOLVE_INTERACTION` 选完玩家后，`execute.ts` 会用 `resolve-card-effects-on-selected-opponent` 重放原卡效果。
  - 但骰子类 custom action 真正读的是 `rollerId` 和 `attackerId`，不是刚刚选中的玩家。
  - 对这些改骰牌来说，被选中的玩家只被拿去作为后续 `afterCardPlayed` 响应窗口的 `selectedTargetId`，并没有参与“该改谁的骰子”。
- 命中维度：
  - D3 数据流闭环
  - D12 写入-消耗对称
  - D17 隐式依赖
- 判定结论：
  - Medium。修复前 UI 额外交互和真正效果目标并不自洽。
- 修复回写：
  - 由于不再走前置 `resolve-card-effects-on-selected-opponent`，这条脱钩已随共享修复一并解除。
- 证据层级：
  - L1 结构证据
  - L4 治理证据

### 4. 测试已把错误行为固化

- 现状：
  - `flow.test.ts` 明确断言四人模式下 `card-flick` 会先弹 `selectPlayer`，并要求 `resolveCustomActionId = 'resolve-card-effects-on-selected-opponent'`：
    - `src/games/dicethrone/__tests__/flow.test.ts:1140-1144`
  - 同文件还把相同模式用于 `card-palm-strike` / `moon-shadow-strike` 这类本来就应该选敌方目标的卡：
    - `src/games/dicethrone/__tests__/flow.test.ts:3193-3231`
  - `response-window-interaction-lock.test.ts` 继续断言这些改骰牌在响应窗口里走 `targetOpponentDice = true` 的路径：
    - `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts:102-105`
    - `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts:131`
    - `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts:261-264`
- 判定结论：
  - Medium。后续修共享逻辑时，测试必须同步回写，否则会把错误交互继续当成正确口径。
- 修复回写：
  - 已回写 `src/games/dicethrone/__tests__/flow.test.ts`，把 `card-flick` 四人模式断言从“先选玩家”改成“直接进入改骰 multistep-choice”。
  - 同时新增 `card-get-away` 四人模式断言，防止后续再把“任意玩家状态牌”误修回 defender 选择。

### 5. 枪手 `loaded` 为什么会弹选择，为什么后续又消失

- 规则入口：
  - `src/games/dicethrone/domain/flowHooks.ts:135-162`
  - `src/games/dicethrone/domain/choiceEffects.ts:129-144`
  - `src/games/dicethrone/domain/customActions/gunslinger.ts:45-126`
- 审计结论：
  - 这里弹出的不是“重新选攻击目标”，而是 `offensiveRollEndToken` 的可选使用分支。
  - `loaded` 在攻击掷骰阶段结束后会进入一个 yes/no 选择：
    - `use-loaded`
    - `skip`
  - 因为这是“是否消耗 token 强化本次攻击”的规则选择，所以它不是本轮修掉的那类错误 `selectPlayer`。
- “为什么选择后又消失”：
  - 基础版 `loaded`（无重掷）会生成 `displayOnly` 的单骰结算：
    - `src/games/dicethrone/domain/effects.ts:340-388`
    - `src/games/dicethrone/domain/customActions/gunslinger.ts:96-126`
  - 前端对 `displayOnly` 奖励骰特写默认 3000ms 自动关闭：
    - `src/games/dicethrone/ui/BonusDieOverlay.tsx:21`
    - `src/games/dicethrone/ui/BonusDieOverlay.tsx:110-114`
  - 因此用户看到的“选完 token 后又消失”，当前代码层面更接近“展示型奖励骰自动收口”，不是再次选目标，也不是本轮发现的 response-window 栈串错。
- 风险判断：
  - Medium。规则层没有发现错误 reopen 同一 token 选择的证据，但这套 UI 对玩家来说确实容易被误解为“弹一下就没了”。
  - 如果产品要减少这类弹窗，需要单独重构 `offensiveRollEndToken` 的交互承载方式，而不是继续把它混进 defender 选择修复里。
- 本轮追加修复：
  - 已在 `src/games/dicethrone/Board.tsx` 与 `src/games/dicethrone/ui/BoardOverlays.tsx` 增加前景交互门禁：
    - 只要 `choice.hasChoice` 仍在前景，就压住 `BonusDieOverlay`，避免出现“choice 动画还没走完，奖励骰已经顶上来”的重叠展示。
  - 这次修的是 UI handoff，不是把 `Loaded` 的规则分支删掉。
- 证据层级：
  - L1 结构证据
  - L4 治理证据

## 合法例外

- 并非所有四人模式下的 `selectPlayer` 都有问题。
- 当前审计确认，下列场景仍然合理保留“先选敌方目标”：
  - 明确对对手生效的 action / status / damage 卡，例如：
    - `src/games/dicethrone/heroes/monk/cards.ts:240`
    - `src/games/dicethrone/heroes/monk/cards.ts:241`
    - `src/games/dicethrone/heroes/moon_elf/cards.ts:55`
  - custom action 元数据显式声明 `requiresSelectedDefender: true` 的能力/卡牌，例如：
    - `src/games/dicethrone/domain/customActions/moon_elf.ts:702-712`
    - `src/games/dicethrone/domain/customActions/gunslinger.ts:749`
    - `src/games/dicethrone/domain/customActions/samurai.ts:421-425`

## 横向审查结果

- 当前代码库里，卡牌定义层直接使用 `action.target = 'select'` 的正式入口只有 4 张：
  - `card-surprise`
  - `card-unexpected`
  - `card-flick`
  - `card-get-away`
- 其中前 3 张是用户提到的“改骰子牌”，第 4 张是同根因的状态牌。
- 没有发现其他英雄卡继续沿用这条“`target: 'select'` + 通用卡执行器”组合。

## 验证证据

- 已核对的关键代码证据：
  - `src/games/dicethrone/domain/rules.ts:1196`
  - `src/games/dicethrone/domain/executeCards.ts:243-248`
  - `src/games/dicethrone/domain/customActions/common.ts:51-61`
  - `src/games/dicethrone/domain/customActions/common.ts:227-236`
  - `src/games/dicethrone/domain/execute.ts:907-922`
- 本轮已运行的针对性验证：
  - `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/games/dicethrone/__tests__/flow.test.ts -t "4 人模式下队友在 afterRollConfirmed 响应窗口打出 card-flick|4 人模式下非当前 responder 队友打出 card-flick|card-get-away"`
  - `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/games/dicethrone/__tests__/cross-hero.test.ts -t "loaded choice should create single-die display settlement|upgrade quick-draw makes loaded enter rerollable bonus die settlement"`
  - `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/games/dicethrone/__tests__/flow.test.ts -t "4 人模式 targetingRoll 手选目标后的 Loaded reroll 不应再次 reopen 同一 token 选择"`
  - `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx -t "前景交互存在时应压住奖励骰覆盖层"`

## 共享根因与残余范围

- 共享根因：
  - `EffectAction.target = 'select'` 被同时承担了“需要先选 defender”和“后续交互自己决定对象”两套语义。
- 残余范围：
  - 只要未来继续新增 `target: 'select'` 的通用卡牌，并且仍走 `executeCards.ts` 这一层，就会复发同类问题。
  - 现有测试若再新增类似断言，必须继续区分“选 defender”与“custom action 自主交互”。
  - 枪手 `loaded` 仍有一个纯体验层残余：`displayOnly` 奖励骰自动关闭容易让人误判成弹窗栈异常。

## 修订记录

- 2026-05-04：首次建立该专项审计文档，结论为“仍有残余范围”。
- 2026-05-04：回写共享修复结果，确认 `card-surprise` / `card-unexpected` / `card-flick` / `card-get-away` 不再误走 defender 选择；补记枪手 `loaded` 的规则选择与 displayOnly 自动收口结论。
- 2026-05-04：补充 UI handoff 修复，压住 `choice` 前景期间的奖励骰覆盖层，消除 `Loaded` 选择与奖励骰展示重叠的问题。
