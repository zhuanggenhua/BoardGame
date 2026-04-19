# Smash Up Ancient Egyptians 审计（2026-03-29）

## 2026-04-03 修订记录：旧“已收口”结论失效
- 失效项：
  - 原文档中的 `Mummy Strength` 结论曾写成“`+4` 模式可作用于存在任意埋葬牌的基地”。
- 失效原因：
  - 这条结论没有按 `D1` 和 `D5` 逐字审语义与交互顺序，错误地把规则里的“先选随从，再根据该随从所在基地是否有埋葬牌决定 `+4/+2`”审成了“先选效果模式，再选目标”。
  - 换句话说，旧审计只看到了数值条件，没检查“条件依附于目标还是依附于玩家前置决策”。
- 当前修正：
  - `src/games/smashup/abilities/ancient_egyptians.ts`
    - 删除 `ancient_egyptians_mummy_strength_mode` 这段错误的前置模式交互。
    - 改为单段 `ancient_egyptians_mummy_strength_target` 交互：先选己方随从，再在 handler 中按所选随从所在基地是否存在埋葬牌决定 `+4` 或 `+2`。
  - `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
    - 改为显式验证两条分支：埋葬基地目标得 `+4`，非埋葬基地目标得 `+2`。
  - `src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts`
    - 改为走真实 `RESPOND` 链验证“先选随从”的交互顺序。
- 结论修订：
  - 本文档不再接受“Ancient Egyptians 已完成首轮审计收口”这种无条件表述。
  - 现状态应理解为：**古埃及审计文档存在，但曾发生漏审；后续引用本文件时，必须同时包含本修订记录。**

## 审计定位
- 本文档是 `Oops, You Did It Again` 四派系逐派系审计的第 1 轮，先审 `Ancient Egyptians`。
- 本轮已完成 `Ancient Egyptians` 首轮审计收口，当前文档用于沉淀规则依据、修复点、验证结果与收口结论。

## 审计范围
- 派系数据定义：`src/games/smashup/data/factions/ancient_egyptians.ts`
- 派系能力实现：`src/games/smashup/abilities/ancient_egyptians.ts`
- 埋葬共享链路：
  - `src/games/smashup/domain/bury.ts`
  - `src/games/smashup/domain/playLegality.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/Board.tsx`
- 已补回归：
  - `src/games/smashup/__tests__/buryEngine.test.ts`
  - `src/games/smashup/__tests__/properties/coreProperties.test.ts`

## 规则依据
- 旧的“四个新派系审计”不覆盖古埃及；它实际审的是科学怪人、狼人、吸血鬼、巨蚁：
  - `evidence/smashup-four-new-factions-audit-2026-02-22.md`
- 本轮用于核对古埃及埋葬语义的外部规则来源：
  - `https://smashup.fandom.com/wiki/Ancient_Egyptians`
  - `https://smashup.fandom.com/wiki/Burying`
  - `https://www.alderac.com/wp-content/uploads/2024/05/SU_OOPS-YOU-DID-IT-AGAIN_RULEBOOK.pdf`

## 已确认结论

### 结论 1：古埃及不在旧“四新派系审计”范围内
- 旧审计文件标题与范围已明确写明只覆盖：
  - `frankenstein`
  - `werewolves`
  - `vampires`
  - `giant_ants`
- 因此，古埃及本轮必须单独建立审计结论，不能引用旧文档冒充“已审过”。

### 结论 2：`Bury this card` 不是无目标埋葬，必须落到基地
- 命中卡牌：
  - `You Can Take It With You`
  - `Tomb Trap`
  - `Blessing of Anubis`
  - `Seal the Tomb`
- 已确认这些卡现在都显式声明 `playNeedsBase: true`：
  - `src/games/smashup/data/factions/ancient_egyptians.ts:70`
  - `src/games/smashup/data/factions/ancient_egyptians.ts:103`
  - `src/games/smashup/data/factions/ancient_egyptians.ts:126`
  - `src/games/smashup/data/factions/ancient_egyptians.ts:137`

### 结论 3：此前确实存在实现缺陷，现已修到共享链路
- 根因：
  - 普通行动卡默认可以直接打出，不会自动进入“选基地”流程。
  - 但古埃及这几张牌的 `onPlay` 实现依赖 `baseIndex` 才知道要埋到哪个基地。
- 旧行为：
  - 未传 `targetBaseIndex` 时，牌会离开手牌，但不会进入任何基地的 `buriedCards`，等于“蒸发”。
- 已修复到共享层：
  - 数据层新增 `playNeedsBase` / `actionPlayNeedsBase`
  - helper 新增 `actionLikeNeedsPlayBase`
  - 前端出牌流程要求先选基地
  - 校验层拒绝无 `targetBaseIndex` 的普通行动卡

## 已补回归
- `src/games/smashup/__tests__/properties/coreProperties.test.ts:459`
  - 覆盖：声明 `playNeedsBase` 的普通行动卡缺少 `targetBaseIndex` 时必须校验失败。
- `src/games/smashup/__tests__/buryEngine.test.ts:21`
  - 覆盖：`You Can Take It With You` 正常打出后必须埋到所选基地，不能无目标消失。
- `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
  - 覆盖：
    - `Priest of Anubis` 只在“你自己有埋葬牌”时获得 +2。
    - `Pyramid Engineer` 只允许翻开这里你的一张埋葬牌。
    - `Pharaoh` 在计分前只提示翻开这里你的一张埋葬牌。
    - `Ancient Curse` 在目标有 `+1` 指示物时提供“是否移除”的可选交互，跳过不生效。
    - `Pharaoh` 在计分前翻开普通行动时，会直接弃置而不是违规打出。
    - `Lost Knowledge` 埋葬模式会排除自己，并在选手牌后再单独选择目标基地。
    - `Mummy` 在基地结算后可改为埋到另一个基地，而不是进入弃牌堆。
    - `Plague of Locusts` 只让所选基地上的其他玩家随从获得 `-1`。
    - `Mummy Strength` 先选随从，再按所选随从所在基地是否有埋葬牌决定 `+4 / +2`。
    - `Seal the Tomb` 的翻开模式只提供同一基地且属于你的埋葬牌。
  - `src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts`
    - 覆盖：
      - `Mummy Strength` 真实 `RESPOND` 链必须是“先选随从”，不能先弹“选模式”交互。
- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - 覆盖：
    - `Pyramids` 改为“你的回合中、每回合一次”的主动基地能力入口。
    - 同回合第二次使用会被命令校验拦截。

## 本轮新增已确认修复

### 修复 1：`Priest of Anubis` 只认己方埋葬牌
- 规则语义是 “if you have a card buried here”。
- 旧实现把“这里存在任意埋葬牌”都算作满足条件。
- 现已改为只认该随从控制者自己的埋葬牌。

### 修复 2：`Pyramid Engineer` 只允许翻开“你的一张”埋葬牌
- 旧实现会把同一基地上对手的埋葬牌也列进可翻开候选。
- 现已收紧为只构造自己控制的 buried 选项。

### 修复 3：`Pharaoh` 补齐 `beforeScoring` 翻开链路
- 旧实现只有“翻开后抽 1 张”的 `onBuriedCardUncovered`，缺少“计分前你可以翻开这里你的一张埋葬牌”这半条触发。
- 现已补 `beforeScoring` trigger 与对应 interaction handler。

### 修复 4：`Lost Knowledge` 的埋葬路径改为“先选手牌，再选基地”
- 规则侧要求你埋葬一张手牌时，要把它埋到一个基地，而不是默认绑死当前上下文基地。
- 旧实现曾依赖 `ctx.baseIndex`，会把“在哪个基地埋”错误地偷换成当前结算基地。
- 现已改为：
  - 先选要埋的手牌
  - 再单独选择目标基地
  - 并排除当前打出的 `Lost Knowledge` 自己，不再把自己混入可埋手牌

### 修复 5：`Seal the Tomb` 的埋葬模式排除当前打出的自己
- `onPlay` 时读取手牌候选，如果不排除当前行动牌，容易把正在打出的自己也列进“可再埋葬”的候选。
- 现已过滤 `ctx.cardUid`。

### 修复 6：`Pyramids` 已从错误的 `onTurnStart` 迁到主动基地能力入口
- 规则语义是 “During your turn, once each turn, you may bury a card from your hand here.”
- 旧实现把它做成了回合开始时自动/半自动提示，时点不对，也不具备共享的“主动基地能力”语义。
- 现已补齐共享链路：
  - 新增 `USE_BASE_ABILITY` 命令、`BASE_ABILITY_USED` 事件和 `usedBaseAbilitiesThisTurn`
  - `base_pyramids` 改为玩家在自己回合出牌阶段主动点击基地使用
  - 同回合第二次使用会被校验层显式拦截

### 修复 7：古埃及多步交互 handler 存在返回契约错位，现已修正
- 审计新增用例时发现：
  - `Mummy Strength`
  - `Seal the Tomb`
  - `Lost Knowledge` 的模式切换 handler
  曾直接把能力执行器返回的 `matchState` 结构透传给交互系统。
- 但交互系统消费 `InteractionHandler` 时只读取 `result.state`。
- 旧行为下，这类二段交互在真实链路里可能丢失后续 prompt。
- 现已统一改为返回 `state`，并把能力执行器结果显式适配到 handler 契约。

### 修复 8：`Ancient Curse` 改为真正的 “you may remove”
- 规则文本是 “You may remove a +1 power counter from this minion.”
- 旧实现只要目标随从带有 `+1` 指示物，就会强制移除 `1` 个，没有玩家选择。
- 现已改为：
  - 目标有 `+1` 指示物时弹出确认交互；
  - 选择跳过时不移除；
  - 只有确认时才移除 `1` 个。

### 修复 9：埋葬引擎补齐“计分前翻开普通行动时直接弃置”
- FAQ 语义：普通（非 `special`）行动牌如果在基地计分前被翻开，不能在该时点被打出，应直接弃置。
- 旧实现会把这类被翻开的普通行动继续走 `ACTION_PLAYED / ONGOING_ATTACHED / onPlay` 链路，属于时机违规。
- 现已修到共享层 `bury.ts`：
  - `special` 仍按原本窗口规则判断；
  - 普通行动只允许在 `startTurn` 揭开窗口或 `playCards` 阶段被打出；
  - 若在 `scoreBases / beforeScoring` 之类非法时机翻开，则直接产生 `discardWithoutPlay`。

## 本轮验证
- 已运行：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newOngoingAbilities.test.ts src/games/smashup/__tests__/buryEngine.test.ts src/games/smashup/__tests__/properties/coreProperties.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --environment node`
- 结果：
  - `4` 个测试文件通过
  - `237` 条测试通过
- 说明：
  - 这里使用 `--environment node`，因为该工作区默认 Vitest/jsdom worker 之前出现过本地依赖缺失问题；本轮验证的是古埃及相关领域链路，不依赖浏览器渲染。

## 工具链失效证据
- 本地 Smash Up Wiki 抓取链路当前不可作为权威输入：
  - `node scripts/scrape-wiki-with-descriptions.mjs`
  - 运行后对 `ancient_egyptians` 等派系抓取结果为 `0` 种卡牌 / `0` 张
- 因此本轮古埃及审计没有采用该缓存结果作为规则真相，而是改以外部规则页和 FAQ 直接核对。

## 审计收口结论
- 已覆盖古埃及本轮应收口的核心链路：
  - `bury / uncover / target base / visibility / replacement destination`
  - `Mummy / Priest of Anubis / Pharaoh / Pyramid Engineer`
  - `You Can Take It With You / Tomb Trap / Ancient Curse / Lost Knowledge / Plague of Locusts / Mummy Strength / Blessing of Anubis / Seal the Tomb`
  - `Pyramids / Star Portal`
- 本轮未再发现新的高优先级规则偏差。
- 共享链路里与古埃及直接相关的两类历史问题也已收口：
  - 普通行动自埋牌缺少目标基地时会“蒸发”
  - 普通行动在 `beforeScoring` 被翻开时会被违规打出

## 本轮状态
- 状态：`Ancient Egyptians 审计文档已建立，但 2026-04-03 已确认存在漏审并完成一轮修订`
- 下一步：
  - 后续若再引用“古埃及已审计”，必须连同本修订记录一起看。
  - 如要重新宣称“已收口”，必须基于本次修订后的结论重新做收口判断。
