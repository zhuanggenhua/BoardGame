# 最近 5 天反馈缺口 6 条补证 2026-04-05

## 范围

- 目标：补齐 `evidence/recent-5day-feedback-doc-audit-2026-04-05.md` 中原先缺少明确文档映射的 `6` 条线上真实反馈。
- 本文档只做“反馈 ID -> 现有实现 / 测试 / evidence”的补证，不代表本轮再次改代码。
- 本轮也没有再次执行正式状态写回；这些反馈在生产 `feedbacks` 集合中已处于 `resolved` 或 `closed`，本次补的是仓库证据闭环。

## 汇总结论

| feedbackId | game | 当前线上状态 | 归类 | 结论 |
| --- | --- | --- | --- | --- |
| `69d0b99accdbf2785a55ac7f` | `smashup` | `resolved` | 真 bug 已被共享大厅链路修复 | 未显式配置在线 AI 座位时被错误套用本地默认 AI；当前实现已堵住该链路。 |
| `69ce8ab6094b1acda250fa01` | `smashup` | `closed` | 历史问题已被时机/多轮响应修复覆盖 | “双方都是冠军却只触发一次”对应的 afterScoring 注册与双边响应链已有直接证据。 |
| `69ce88da094b1acda250f9ff` | `smashup` | `closed` | 历史问题已修，当前规则已澄清 | `Mummy Strength` 现已固定为“先选随从，再按其所在基地判 +4/+2”。 |
| `69ce86f6094b1acda250f9d3` | `smashup` | `resolved` | 真 bug 已修 | `那山里有金子` 的“额外随从”链路已有直接回归，额度会兑现并真实落牌。 |
| `69ce6e10094b1acda250f862` | `smashup` | `closed` | UI/规则理解问题 | `Tomb Trap` 埋葬后不会以普通在场行动牌样式停留在明面；相关埋葬与翻开链路已有审计和测试。 |
| `69cca92ec3e278ba205eb091` | `smashup` | `closed` | 历史问题已修 | 海怪克拉肯“计分后进替换基地”已有 smoke + E2E 双证据，当前实现可正常打到替换基地。 |

## 逐条补证

### `69d0b99accdbf2785a55ac7f`

- 用户反馈：`ai开了`
- 当前线上状态：`resolved`
- 归类：真 bug 已被共享在线房间座位链路修复
- 生产侧现象：
  - `actionLog` 已出现 `AI 2 号位 开始回合`、`随从登场：影舞者`、`战术卡施放：献祭`
  - 这说明线上房间在未显式配置 AI 时，2 号位被自动接管
- 现有实现 / 测试 / evidence：
  - `src/pages/onlineAiSeats.ts`
    - 当前只信任 `setupData.seatControllers`
    - 未显式配置时一律回落为 `human`
  - `src/pages/__tests__/matchSeatValidation.test.ts`
    - 用例：`未显式配置在线 AI 座位时，不得套用本地默认 AI`
  - `evidence/feedback-69d0d5bfccdbf2785a55af79-closeout-2026-04-05.md`
    - 同类根因、同条共享链路、同一回归测试
- 判定：
  - 这条不是 Smash Up 规则实现缺陷，而是在线房间错误套用了本地默认 AI。
  - 现有共享修复已经直接覆盖该症状，维持 `resolved` 合理。

### `69ce8ab6094b1acda250fa01`

- 用户反馈：`冠军怎么只触发一次效果，两边都是冠军`
- 当前线上状态：`closed`
- 归类：历史问题已被 afterScoring 时机与多轮响应修复覆盖
- 生产侧现象：
  - `actionLog` 关联 `base_ninja_dojo`
  - 日志出现基地能力导致的消灭链，说明反馈落点在计分后冠军响应窗口
- 现有实现 / 测试 / evidence：
  - `src/games/smashup/data/factions/giant-ants.ts`
    - `giant_ant_we_are_the_champions` 已显式声明 `specialTiming: 'afterScoring'`
  - `src/games/smashup/__tests__/afterscoring-card-registration.test.ts`
    - 覆盖 afterScoring 注册正确性
  - `src/games/smashup/__tests__/afterScoring-window-multi-round.test.ts`
    - 用例：`两名玩家都有 afterScoring 卡牌，支持多轮响应`
  - `src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts`
    - 用例：`并列冠军时应为每位冠军各生成一个 Prompt`
  - `evidence/smashup-we-are-the-champions-timing-fix.md`
  - `evidence/smashup-response-window-complete.md`
- 判定：
  - “双方都是冠军却只触发一次”的核心风险点，已被“正确 afterScoring 注册 + 双边多轮响应 + 并列冠军 prompt”三层证据覆盖。
  - 当前更像历史问题已失效，因此维持 `closed`。

### `69ce88da094b1acda250f9ff`

- 用户反馈：`怎么先结算决斗才算木乃伊之力`
- 当前线上状态：`closed`
- 归类：历史问题已修，当前规则与交互顺序已澄清
- 生产侧现象：
  - `actionLog` 里有 `木乃伊之力`
  - 同局还出现基地消灭与临时力量变化，说明用户在真实对局中感知到顺序异常
- 现有实现 / 测试 / evidence：
  - `src/games/smashup/abilities/ancient_egyptians.ts`
    - 已移除错误的“先选模式”实现，改为目标优先
  - `src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts`
    - 用例：`walks the real RESPOND chain with target-first selection without throwing a command exception`
  - `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
    - 覆盖：有埋葬牌时 `+4`，否则 `+2`
  - `evidence/smashup-ancient-egyptians-audit-2026-03-29.md`
    - 已明确回写旧结论失效，并写明当前正确口径是“先选随从，再按该随从所在基地判定”
- 判定：
  - 这条反馈对应的旧错误交互顺序已经被修掉，当前实现和审计口径一致。
  - 维持 `closed` 合理。

### `69ce86f6094b1acda250f9d3`

- 用户反馈：`弹窗获得一次额外随从机会，但实际没有加`
- 当前线上状态：`resolved`
- 归类：真 bug 已修
- 生产侧现象：
  - `actionLog` 关联 `那山里有金子`
  - 后续能看到 `微型机修理者` 登场，说明这条反馈对应牛仔“额外随从/额外战术”兑现链
- 现有实现 / 测试 / evidence：
  - `src/games/smashup/abilities/cowboys.ts`
    - 已有 `cowboys_gold_in_them_thar_hills` 多段 handler
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - 用例：`cowboys_gold_in_them_thar_hills 选择额外无目标行动时会立刻打出该牌`
    - 用例：`cowboys_gold_in_them_thar_hills 选择额外随从时会先选基地再直接打出`
  - `evidence/feedback-smashup-cowboys-open-recheck-2026-04-04.md`
  - `evidence/smashup-cowboys-audit-2026-03-30.md`
- 判定：
  - “弹窗写了额外随从，但额度没兑现”的真实风险点，已经被专项回归直接覆盖。
  - 这条保留 `resolved` 合理。

### `69ce6e10094b1acda250f862`

- 用户反馈：`墓穴陷阱埋葬后不见了`
- 当前线上状态：`closed`
- 归类：UI/规则理解问题
- 生产侧现象：
  - `actionLog` 明确出现 `战术卡施放：墓穴陷阱`
  - 之后对局继续推进，没有卡住
- 现有实现 / 测试 / evidence：
  - `evidence/smashup-ancient-egyptians-audit-2026-03-29.md`
    - 已写清古埃及埋葬牌必须落基地、不会“蒸发”
  - `src/games/smashup/__tests__/buryEngine.test.ts`
    - 覆盖古埃及埋牌必须进入目标基地的埋葬区
  - `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
    - 用例：`Tomb Trap 翻开后可消灭所选的力量≤4随从`
- 判定：
  - `Tomb Trap` 埋葬后的正确表现不是继续以普通明置行动牌留在场上，而是进入埋葬区，之后再被翻开结算。
  - 现有实现与测试都支持这一点，因此维持 `closed`。

### `69cca92ec3e278ba205eb091`

- 用户反馈：`海盗的泰坦似乎没法打出在替换的基地上`
- 当前线上状态：`closed`
- 归类：历史问题已修
- 生产侧现象：
  - 该局日志包含海盗 / 古埃及相关动作，符合“基地计分后替换基地进场”的链路背景
- 现有实现 / 测试 / evidence：
  - `src/games/smashup/abilities/titans.ts`
    - 已有海怪克拉肯“打出到替换基地”的交互实现
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
    - 用例：`海怪克拉肯不在场时，计分后会为有己方随从的玩家创建进替换基地交互`
    - 用例：`海怪克拉肯的替换基地进场交互在补发计分后事件时会真正把泰坦落到新基地`
  - `evidence/smashup-alien-terraform-e2e-test.md`
    - 章节：`海怪克拉肯：计分后进替换基地`
    - 人工结论已写明：替换基地完成后，海怪克拉肯真实落在新基地上方
- 判定：
  - 这条反馈命中的链路目前已有 smoke + E2E 双证据，不再是未实现状态。
  - 维持 `closed` 合理。

## 本轮收口口径

- 本轮处理的是线上真实反馈的文档闭环，不是本地导出快照。
- 本轮没有重新改线上状态，只补仓库中的 ID 级 closeout 证据。
- 这 `6` 条现在都已有明确文档映射，可供 `recent-5day-feedback-doc-audit-2026-04-05.md` 直接引用。
