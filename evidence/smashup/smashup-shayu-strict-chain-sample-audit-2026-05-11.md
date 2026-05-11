# SmashUp shayu 高风险样本全链路严格审计（2026-05-11）

## 结论边界

- 本轮是**抽样严格审计**，不是 shayu 三派系全量重审。
- 本轮覆盖 5 个高风险样本：`sharks_freakin_laser_beam`、`tornados_trade_winds`、`mythic_greeks_favor_of_athena`、`sharks_week_of_sharks`、`base_oracle_at_delphi`。
- 证据层级：L1 结构审计 + L2 行为链路测试；本轮未新增真实浏览器 E2E 截图，因此不声明 L3/E2E 收口。
- 使用的通用维度：D1 规则语义、D3 全链路、D5 交互模式、D8 数据接线、D51 交互语义单一真相、交互入口语义审计。

## 本轮发现与修复

### F1：`playNeedsMinion` 缺目标控制者约束，导致 UI/validator/handler 双重真相

**通用根因**：描述写“你的一个随从/仆从”，但数据只有 `playNeedsMinion: true`，没有声明目标随从控制者；UI 和 validator 允许任意随从，handler 再自行过滤己方随从。

**修复**：新增通用字段，不按卡名特判。

- `src/games/smashup/domain/types.ts`
  - `PlayTargetMinionController = 'self' | 'opponent' | 'any'`
  - `ActionCardDef.playTargetMinionController`
  - `FusionCardDef.actionPlayTargetMinionController`
- `src/games/smashup/domain/utils.ts`
  - `actionLikePlayTargetMinionController(...)`
- `src/games/smashup/domain/playLegality.ts`
  - `playNeedsMinion` validator 按 `self/opponent/any` 拦截非法目标。
- `src/games/smashup/Board.tsx`
  - 手选随从高亮/可落点按同一字段过滤，避免 UI 显示可选但提交失败。
- 数据补齐：
  - `sharks_air_jaws` → `self`
  - `sharks_freakin_laser_beam` → `self`
  - `mythic_greeks_favor_of_ares` → `self`
  - `mythic_greeks_favor_of_dionysus` → `self`
  - 扩审命中旧对象：`samurai_way_of_the_warrior`、`samurai_way_of_the_warrior_pod` → `self`

**自动审计补充**：`src/games/smashup/__tests__/abilityBehaviorAudit.test.ts`

- `standard 行动卡的直接入口字段必须匹配描述动作链的第一选择对象`
- `需要直接选择随从的行动卡必须声明目标随从控制者约束`

### F2：`mythic_greeks_favor_of_athena` 自动选择第一张行动牌，漏掉玩家选择与回顶排序

**文案**：展示牌库顶 5 张；你可以将其中一张行动牌加入手牌，并按任意顺序将其余牌放回牌库顶。

**旧实现问题**：`revealAndPickFromDeck(...)` 自动拿第一张行动牌，并按固定顺序回顶；没有“你可以选择哪张行动牌”和“任意顺序回顶”的交互。

**修复**：`src/games/smashup/abilities/mythic_greeks.ts`

- 新增 `athenaPickPromptProgram`：展示后让玩家选择一张行动牌或跳过。
- 新增 `athenaOrderPromptProgram`：逐步选择放回牌库顶的顺序。
- 保留展示事件 `inspectDeck` + `revealDeckTop`，并支持牌库不足 5 张时先把弃牌堆洗回牌库。

### F3：`base_oracle_at_delphi` 只展示牌库顶，未按行动牌入手

**文案**：在你打出一个仆从至本基地后，展示你牌库顶的牌。如果是行动牌，将它加入手牌；否则放回牌库顶。

**旧实现问题**：只调用 `peekDeckTop(...)` 产生展示事件，不判断卡牌类型，也不把行动牌加入手牌。

**修复**：`src/games/smashup/abilities/mythic_greeks.ts`

- `peek.card.type === 'action'` 时追加 `CARDS_DRAWN`，把展示的行动牌加入当前玩家手牌。
- 非行动牌仅展示，保留在牌库顶。

## 抽样对象逐项链路

### 1. `sharks_freakin_laser_beam`（激光束）

- 文案入口：选择你的一个仆从。
- 数据字段：`playNeedsMinion: true` + `playTargetMinionController: 'self'`。
- UI/validator：Board 与 `validateActionPlaySemantics` 都按 `self` 过滤。
- handler：`sharksFreakinLaserBeam` 使用己方源随从的当前战力，打开同基地低于/等于源战力的消灭目标 prompt。
- 最终态验证：行为测试证明对手随从作为第一入口被 validator 拒绝；合法己方源随从进入 prompt，且高战力目标不在候选中，低战力目标被消灭。

### 2. `tornados_trade_winds`（信风）

- 文案入口：选择两个战力 3 或更少的仆从。
- 数据字段：无 `playNeedsMinion`，打出行动后由 ability prompt 承载第一个随从选择；该模式可接受，因为第一真实用户选择仍是 `targetType: 'minion'` prompt，不是基地。
- handler：第一 prompt 选 3- 随从；第二 prompt 排除同一随从、同一基地、战力>3 随从。
- 最终态验证：行为测试证明真实出牌后进入第一随从 prompt，第二候选只包含另一基地的 3- 随从，最终两个随从交换基地。

### 3. `mythic_greeks_favor_of_athena`（雅典娜的恩惠）

- 文案入口：展示牌库顶 5 张 → 可选择其中一张行动牌 → 其余按任意顺序回顶。
- 旧漏审：自动拿第一张行动牌，未给玩家选择；未给玩家排序。
- 修复后链路：出牌 → 展示顶 5 → `mythic_greeks_favor_of_athena_pick` 选行动/跳过 → `mythic_greeks_favor_of_athena_order` 逐张决定回顶顺序 → reducer 通过 `CARDS_DRAWN` / `CARD_TO_DECK_TOP` 落权威状态。
- 最终态验证：行为测试选择第二张行动牌入手，并把剩余四张按指定顺序回顶。

### 4. `sharks_week_of_sharks`（鲨鱼周）

- 文案入口：打出到基地；持续，如果你在这里有仆从，回合结束额外抽一张；每回合只能使用一个“鲨鱼周”。
- 数据字段：`ongoingTarget: 'base'` + `playNeedsBase: true`。
- handler：`sharksWeekOfSharksTrigger` 遍历所有基地的 `sharks_week_of_sharks`，按 owner Set 每拥有者每回合只触发一次，且要求该基地有其控制的随从。
- 最终态验证：行为测试构造同一玩家两个基地各有一张“鲨鱼周”且各有己方随从，endTurn 只额外抽 1 张。

### 5. `base_oracle_at_delphi`（特尔斐神谕）

- 文案入口：玩家打出随从到本基地后触发。
- 注册入口：`registerBaseAbility('base_oracle_at_delphi', 'onMinionPlayed', ...)`。
- handler：展示当前玩家牌库顶；行动牌入手；非行动牌保留在牌库顶。
- 最终态验证：行为测试覆盖两个分支：行动牌顶牌被加入手牌；随从顶牌不入手且仍为牌库顶。

## 验证命令

- `npx eslint src/games/smashup/abilities/mythic_greeks.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts src/games/smashup/data/factions/samurai.ts src/games/smashup/data/factions/samurai_pod.ts src/games/smashup/Board.tsx src/games/smashup/domain/types.ts src/games/smashup/domain/utils.ts src/games/smashup/domain/playLegality.ts src/games/smashup/data/factions/sharks.ts src/games/smashup/data/factions/mythic_greeks.ts`
  - 结果：0 errors；存在既有 warnings（Board hooks/Date.now、playLegality any、types unused args），本轮未新增 error。
- `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts`
  - 结果：16 passed。
- `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "直接入口字段|控制者约束"`
  - 结果：2 passed。
- `npm run typecheck -- --pretty false`
  - 结果：通过（npm 提示 `--pretty` 为未知 npm config，但实际执行 `tsc --noEmit` 通过）。
- `git diff --check -- <本轮相关文件>`
  - 结果：通过；仅 CRLF 工作区提示。

## 剩余风险

- 这不是 shayu 全量审计，不能替代所有卡/基地 L3 E2E。
- 本轮没有真实浏览器截图，因此不能声称“端到端 UI 已全覆盖”。
- 新增的控制者约束审计是通用启发式：已避免卡名特判，但未来仍应继续扩展到“对手随从 / 任意数量 / 至多 N / 可选跳过”等更多入口矩阵。
