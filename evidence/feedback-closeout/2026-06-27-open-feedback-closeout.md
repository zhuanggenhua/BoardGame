# 2026-06-27 线上反馈收口证据

本文件对应批次：`temp/feedback-closeout/2026-06-27T01-17-05-889Z/summary.json`

## 6a3ec70e6ee79f45eb0a7691

- 游戏：`smashup`
- 用户反馈：`让过不了啊`
- 结论：关闭（不是现存 bug）
- 归类：当前真实反馈快照本体是“强制触发二选一”，不是“可让过但按钮坏了”

证据：

- 真实状态直注入 E2E 已通过：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-feedback-6a3ec70-pass-blocked-repro.e2e.ts "真实反馈状态直注入后，必须先看清让过属于哪层 UI"`
- 现场截图：
  - `test-results/evidence-screenshots/smashup/smashup-feedback-6a3ec70-pass-blocked-repro.e2e/真实反馈状态直注入后，必须先看清让过属于哪层-UI/01-反馈6a3ec70-真实状态直注入现场.png`
- 诊断包 `temp/feedback-closeout/2026-06-27T01-17-05-889Z/6a3ec70e6ee79f45eb0a7691.md` 与直注入现场共同显示：当前阶段是 `scoreBases`，当前交互是统一触发选择器 `smashup_reaction_choose`，选项只有：
  - 海盗湾 `base_pirate_cove`
  - 大副 `pirate_first_mate`
- 当前真实现场同时满足：
  - `MeFirstOverlay` 可见，但 `me-first-pass-button` 不可见
  - `PromptOverlay` 的卡牌/全屏 prompt 不可见
  - 真正承接点击的是屏幕中央两个按钮：`海盗湾`、`大副`
- `src/games/smashup/domain/baseAbilities.ts` 中海盗湾明确注册为 `afterScoring` 基地能力。
- `src/games/smashup/abilities/pirates.ts` 中大副明确注册为 `afterScoring` 触发。
- `src/games/smashup/rule/ENGINE_GUIDE.md` 明确说明：多个强制触发会先进入 `smashup_reaction_choose` 排序，再进入各自交互。
- `src/games/smashup/domain/reactionSession.ts` 显示 `pass` 是在可选响应窗口里与其他可选项一起生成的；当前这条诊断包里的统一触发选择器没有 `pass`，符合“强制触发未处理完前不能直接让过”的规则。
- 额外源码对账表明：旧版 `src/games/smashup/ui/MeFirstOverlay.tsx` 的确会在 `smashup_reaction_choose` 场景额外渲染中间壳层，并尝试通过 `getSmashUpReactionChoicePassOptionId(...)` 暴露 `me-first-pass-button`；这说明用户此前看到的“中间让过”入口，历史上确实可能来自 `MeFirstOverlay` 这一层，而不是底层真实交互本体。
- 定向验证通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts --configLoader native -t "集成: base_pirate_cove 海盗湾 \\(afterScoring\\)"`

结论口径：

- 这条真实快照里不是“让过按钮坏了”，而是海盗湾和大副两个强制计分后效果都还没处理完，所以当前本来就不允许直接让过。
- 但旧版 `MeFirstOverlay` 确实存在“在 `smashup_reaction_choose` 场景额外制造一个中间让过入口”的通用风险；当前代码已改成只保留状态提示，不再在这层额外造可点击让过按钮。

## 6a3e9e8b6ee79f45eb0a75bd

- 游戏：`dicethrone`
- 用户反馈：`[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted`
- 结论：关闭（当前树已恢复）
- 归类：系统自动反馈，对应链路在当前代码下已能继续推进

证据：

- 诊断包显示该条属于 `online-ai-watchdog`，错误语义是“可见交互恢复后仍残留阻塞”。
- 现有定向回归已覆盖同类链路：`src/engine/transport/__tests__/server.test.ts`
- 定向验证通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在 human active 的 off-turn targetingRoll 阶段也应代 AI 执行合法动作，避免 4 人选目标卡死"`
- 该测试已证明 watchdog 在 `targetingRoll` 可继续执行合法动作并推进到后续阶段，不再停在原阻塞点。

结论口径：

- 这是旧现场触发的系统自动反馈，但当前代码已经具备恢复链，不再作为现存 bug 继续挂在未收口队列。

## 6a3ea7726ee79f45eb0a7601

- 游戏：`dicethrone`
- 用户反馈：`投出的是6，但是是抽卡`
- 结论：已修复
- 归类：真实牌面 / 录入实现不一致

证据：

- 重复项 `6a3ea7426ee79f45eb0a75fe` 自带内嵌截图，已提取到：
  - `temp/feedback-closeout/6a3ea742-feedback-inline-screenshot.jpg`
- 截图中卡面正文明确写的是：
  - `陨石：获得火焰精通至上限`
  - `否则：抽 1 张牌`
- 反馈代表项诊断包 `temp/feedback-closeout/2026-06-27T01-17-05-889Z/6a3ea7726ee79f45eb0a7601.md` 记录的真实结果是：
  - 投掷值为 `6`
  - 实际骰面为 `meteor / 陨石`
  - 旧实现却走到了“抽 1 张牌”
- 修复前源码与文案确实录错了：
  - `src/games/dicethrone/heroes/pyromancer/cards.ts`
  - `public/locales/zh-CN/game-dicethrone.json`
  - `public/locales/en/game-dicethrone.json`
  - `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts`
- 本轮已改成按真实牌面执行：
  - 陨石面：把火焰精通直接补到当前上限
  - 非陨石面：抽 1 张牌
- 定向回归已通过：
  - `npx vitest run src/games/dicethrone/__tests__/pyromancer-behavior.test.ts`
- 新增回归断言已覆盖：
  - `pyro-infernal-embrace-roll` 掷出陨石面时补满火焰精通
  - 非陨石面时抽 1 张牌且不授予火焰精通

结论口径：

- 这条不是玩家看错，而是我们把 `炼狱之拥` 的真实牌面录入/实现错了。
- 玩家反馈与截图是对的；此前“规则理解偏差”的关闭结论无效，必须改回真实 bug 收口。

## 6a3ea9e06ee79f45eb0a7614

- 游戏：`dicethrone`
- 用户反馈：`眩晕debuff未生效`
- 结论：已修复
- 归类：真实规则语义 / 录入实现不一致

证据：

- 反馈截图已核对：`temp/feedback-closeout/2026-06-27T01-36-43-559Z/images/6a3ea9e06ee79f45eb0a7614-01.jpg`
- 诊断包日志显示当时真实现象是：AI 2 号位吃到“眩晕”后，下一回合仍正常经过维持、收入、主要阶段（1），随后才在后续阶段移除该状态；这和玩家反馈“眩晕 debuff 未生效”一致，不是空口误报。
- 旧关闭理由错误地把这条反馈建立在我们仓内一套互相冲突的旧实现上：
  - 状态说明曾写成“跳过下一个进攻掷骰阶段和主要阶段”；
  - 阶段逻辑曾写成“仅下回合跳过进攻掷骰”；
  - 出牌校验又单独拦“处于眩晕状态无法出牌”。
- 本轮已统一为真实语义：火法师这条“眩晕”改为当前攻击结算后立即移除，并让当前攻击者立刻再攻击一次；不再错误留到下回合作为“跳过进攻掷骰”的状态。
- 已同步修正的位置：
  - `src/games/dicethrone/heroes/pyromancer/abilities.ts`
  - `src/games/dicethrone/heroes/pyromancer/tokens.ts`
  - `src/games/dicethrone/domain/sharedTokens.ts`
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/commandValidation.ts`
  - `public/locales/zh-CN/game-dicethrone.json`
  - `public/locales/en/game-dicethrone.json`
  - `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts`
- 定向回归已通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/daze-action-blocking.test.ts --configLoader native`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/pyromancer-tokens.test.ts src/games/dicethrone/__tests__/pyromancer-upgrade-logic.test.ts --configLoader native`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts src/games/dicethrone/__tests__/daze-extra-attack-simple.test.ts --configLoader native -t "daze|rage|陨石|眩晕"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-execution.test.ts --configLoader native`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/shared-state-consistency.test.ts --configLoader native`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/pyromancer-coverage.test.ts --configLoader native`

结论口径：

- 这条不是玩家理解偏差，而是我们把火法师“眩晕”的真实规则语义录错并实现错了。
- 现已按真实语义统一修正实现、文案和回归测试，之前的关闭结论无效，必须改回真实 bug 收口。
