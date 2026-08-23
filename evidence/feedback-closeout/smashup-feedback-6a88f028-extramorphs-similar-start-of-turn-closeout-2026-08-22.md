# Smash Up 本地反馈补充收口：异形变体同类“回合开始已在场”扩审

- 反馈 ID：`6a88f028aacaa8f27ab581a1`
- 本轮口径：本地数据库反馈补充扩审
- 用户追问：`你找了同类问题吗？所有带有类似描述的，说明都有问题呀`
- 原始反馈对象：Smash Up / 异形变体 / 破胸者（`extramorphs_chestbreaker`）
- 本轮补充对象：抱头虫（`extramorphs_head_grabber`）、从轨道核平（`extramorphs_nuke_it_from_orbit`）

## 原始症状保真

用户原始反馈说破胸者有两处规则实现不完整：

1. 不是随时能用，必须是本回合开始时已经在基地上。
2. 发动后自身必须进入牌库底。

本轮用户进一步指出不能只修破胸者；所有描述里带类似“本回合开始时已在场 / 已附着”限制的对象都要一起查。

## 真相源

规则录入合同仍以 `evidence/smashup/2026-07-25-excellent-movies-teens-intake-contract-draft.md` 为本轮真相源：

- `Chestbreaker`：`Talent: If this minion was on a base at the start of the turn, place it on the bottom of your deck...`
- `Head Grabber`：中文候选为“若此牌在你的佣兵上，或本回合开始时此牌在一个佣兵上，摧毁该佣兵...”
- `Nuke It From Orbit`：`Talent: If this card was on a base at the start of the turn, destroy this base and all other cards on it. Replace it normally. Place this card in the box.`
- `Egg Field`、`Game Over, Dude!`、`Brood Hive` 只共享“从牌库顶额外打出佣兵”机制，没有“本回合开始时已在场/已附着”前提。

## 同类扩审矩阵

| 对象 | 类似描述命中 | 本轮结论 |
| --- | --- | --- |
| `extramorphs_chestbreaker` / 破胸者 | 命中：本回合开始时已在基地；自身放牌库底；牌库顶额外佣兵 | 已在上一轮修复，并保留本轮回归测试。 |
| `extramorphs_head_grabber` / 抱头虫 | 命中：在己方佣兵上可用；否则必须本回合开始时已附着；牌库顶额外佣兵 | 旧实现不区分刚附到敌方佣兵，已补校验；刚附到己方佣兵仍按牌面允许。 |
| `extramorphs_nuke_it_from_orbit` / 从轨道核平 | 命中：本回合开始时已在基地；摧毁基地所有牌；补新基地；本卡放入盒中 | 旧实现缺发动前提、缺放入盒中、缺补新基地；本轮已补齐。 |
| `extramorphs_egg_field` / 卵场 | 只命中“牌库顶额外佣兵”，没有回合开始限制 | 不属于同一限制 bug；保留既有额外佣兵测试。 |
| `extramorphs_game_over_dude` / 完蛋了，伙计！ | 只命中“牌库顶额外佣兵”，没有回合开始限制 | 不属于同一限制 bug；保留既有额外佣兵测试。 |
| `base_brood_hive` / 育巢 | 只命中“牌库顶额外佣兵”，触发点是计分前基地能力 | 不属于同一限制 bug；已有 `beforeScoring` 基地能力测试覆盖。 |

## 实现修复与数据驱动重构

修改 `src/games/smashup/domain/types.ts`：

- 给可激活能力补充细前提字段 `activatableAbilities.useRequirement`，把“本回合开始时已在场 / 已附着”从运行时名单迁回牌数据。

修改 `src/games/smashup/data/factions/excellent_movies_teens.ts`：

- `extramorphs_chestbreaker` 和 `extramorphs_nuke_it_from_orbit` 声明 `sourceInPlayAtStartOfTurn`。
- `extramorphs_head_grabber` 声明 `attachedToOwnMinionOrSourceInPlayAtStartOfTurn`。
- `extramorphs_egg_field` 不声明该前提，作为“只共享额外打出牌库顶佣兵、不共享回合开始限制”的边界对象。

修改 `src/games/smashup/domain/activationMetadata.ts`：

- 能力去重键纳入 `sourceScope` 和 `useRequirement`，避免不同细前提的同窗口能力互相覆盖。
- 新增统一读取与消费 helper：`getBoardTalentUseRequirement`、`shouldTrackActivationPlayedThisTurn`、`buildActivationPlayedThisTurnMetadata`、`wasActivationSourcePlayedThisTurn`。

修改 `src/games/smashup/domain/actionCounter.ts`：

- 真实打出持续行动时不再查硬编码卡牌名单，改为按 `buildActivationPlayedThisTurnMetadata(pending.defId)` 从牌数据决定是否记录“本回合刚入场”。

保留 `src/games/smashup/domain/reduce.ts` 的生命周期消费：

- 在玩家回合开始时清理自己控制的持续行动 `metadata.playedThisTurn`，让“本回合刚打出不能用、下个自己回合开始后可以用”的生命周期成立。

修改 `src/games/smashup/abilities/excellent_movies_teens.ts`：

- 破胸者、抱头虫、从轨道核平的发动前提都通过 `getBoardTalentUseRequirement(ctx.defId)` 读取牌数据，再结合来源是否本回合刚入场判断可用性。
- 抱头虫天赋改为精确查找当前 `ongoingCardUid` 所附着的宿主，不再用同 `defId` 的第一张牌兜底。
- 抱头虫保留牌面例外：刚附到自己的佣兵上仍可用；刚附到其他玩家佣兵上不能同回合马上用。
- 从轨道核平增加发动前校验：本回合刚打到基地上不能使用。
- 从轨道核平合法发动后会摧毁该基地所有佣兵、弃置其它基地持续行动、将本卡移出游戏，并用基地牌库顶正常补新基地。
- 卵场检索并额外打出抱头虫时，也通过 `buildActivationPlayedThisTurnMetadata(located.card.defId)` 写入来源状态，避免通过卵场绕过限制。

修改 `src/games/smashup/config/configReviewAdapter.ts`：

- 配置审查输出新增 `requires:<useRequirement>`，后续审查能直接看到牌数据声明的发动细前提。

修改 `src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts`：

- 新增配置驱动断言：破胸者、抱头虫、从轨道核平必须由 `activatableAbilities.useRequirement` 声明细前提；卵场必须没有该前提。
- 新增抱头虫刚附到敌方佣兵时不能同回合发动的负向测试。
- 新增抱头虫刚附到己方佣兵时仍可发动的正向测试。
- 新增从轨道核平刚打到基地时不能同回合发动的负向测试。
- 新增从轨道核平合法发动后摧毁、补基地、放入盒中的正向测试。
- 新增破胸者刚打出不能同回合发动，以及发动后自身进入牌库底的回归断言。

## 验证

- 首跑红测：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native`
  - 结果：3 个新增同类断言失败，分别命中抱头虫敌方同回合误放行、从轨道核平同回合误放行、从轨道核平缺放入盒中/补基地。
- 修复后复跑同一命令：
  - 结果：1 file passed，66 tests passed。
  - stderr 中的抱头虫 / 从轨道核平 `su:use_talent` 验证失败是新增负向测试的预期拒绝，不是测试失败。
- 补充复验：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/bases/excellent-movies-teens-bases.test.ts --configLoader native`
  - 结果：1 file passed，11 tests passed；育巢仍只覆盖计分前额外打出牌库顶佣兵，不带本次回合开始限制。
- 状态镜像校验：`node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json`
  - 结果：`feedback-status: ok`。
- Lint：`npx eslint src/games/smashup/abilities/excellent_movies_teens.ts src/games/smashup/domain/actionCounter.ts src/games/smashup/domain/reduce.ts src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts`
  - 结果：0 errors，14 warnings；剩余警告均在 `reduce.ts` 的既有 `any` 类型位置，本轮已清掉 `actionCounter.ts` 未使用导入警告。
- 数据驱动重构后复跑：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native`
  - 结果：1 file passed，67 tests passed。
- 配置审查复跑：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/configReviewAdapter.test.ts --configLoader native`
  - 结果：1 file passed，6 tests passed。
- 重构后 Lint：`npx eslint src/games/smashup/domain/activationMetadata.ts src/games/smashup/domain/types.ts src/games/smashup/data/factions/excellent_movies_teens.ts src/games/smashup/domain/actionCounter.ts src/games/smashup/abilities/excellent_movies_teens.ts src/games/smashup/config/configReviewAdapter.ts src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts`
  - 结果：0 errors，2 warnings；剩余警告是 `src/games/smashup/domain/types.ts` 既有未用参数 `state` / `baseIndex`，不是本轮重构错误。
- 同类硬编码复查：`rg "START_OF_TURN_GATED|buildOngoingPlayMetadata|wasOngoingPlayedThisTurn|metadata: \\{ playedThisTurn: true \\}" src/games/smashup`
  - 结果：旧硬编码入口未命中；本轮只保留测试构造、通用生命周期字段和 `activationMetadata` 统一 helper。

## 漏审复盘

上一轮只按反馈正文中的“破胸者”做了单点修复，没有把根因扩展成“描述带本回合开始已在场/附着前提的异形变体天赋”。因此抱头虫和从轨道核平这种同族、同前提、同牌库顶/场上持续行动生命周期的对象漏审。

本轮已按规则描述语义、能力实现点、持续行动生命周期、牌库顶额外佣兵机制和基地能力测试横向搜索。当前命中并已修复的同类对象是抱头虫和从轨道核平；卵场、完蛋了伙计、育巢确认只共享牌库顶额外佣兵机制，不共享本次“回合开始已在场/附着”限制。

用户指出“数据驱动不是配置它效果可用的时机吗”后，已补做结构回代：触发大窗口和发动细前提现在都由 `activatableAbilities` 表达；运行时只读取配置并维护来源生命周期，不再维护异形变体专属硬编码名单。此前漏审的机制原因不只是“测试不够”，而是旧实现把细前提散在具体效果代码和运行时记录点，配置审查看不到“什么时候可用”的完整合同。
