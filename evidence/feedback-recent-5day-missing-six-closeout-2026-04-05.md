# 最近 5 天反馈缺口 6 条补证收口 2026-04-05

## 范围

- 目标：补齐 [recent-5day-feedback-doc-audit-2026-04-05.md](D:/gongzuo/webgame/BoardGame/evidence/recent-5day-feedback-doc-audit-2026-04-05.md) 中原先缺少明确文档映射的 `6` 条线上真实反馈。
- 数据口径：
  - 真实状态来源仍是生产 `feedbacks` 集合
  - 本文档不使用本地开发库、本地导出 JSON 或网页 fallback HTML 作为正式状态源
- 本轮工作性质：
  - 补“反馈 ID -> 现有实现 / 测试 / evidence”的直接证据映射
  - 不新增业务代码
  - 不在本轮重复改线上状态

## 真实状态口径

- 这些反馈的正式状态均已存在于生产 `feedbacks` 集合中。
- 当前对照到的线上现态：
  - `69d0b99accdbf2785a55ac7f` `resolved`
  - `69ce8ab6094b1acda250fa01` `closed`
  - `69ce88da094b1acda250f9ff` `closed`
  - `69ce86f6094b1acda250f9d3` `resolved`
  - `69ce6e10094b1acda250f862` `closed`
  - `69cca92ec3e278ba205eb091` `closed`
- 这些状态不是本地伪结果；前序收口轮次已通过生产机 `mongosh` 直连 `boardgame.feedbacks` 完成真实读写，本轮只补文档证据闭环。

## 逐条补证

### `69d0b99accdbf2785a55ac7f` `smashup` `resolved`

- 用户原文：`ai开了`
- 判定：
  - 这不是 Smash Up 规则实现问题，而是线上房间错误套用了本地默认 AI 的共享大厅问题。
  - 现实现已明确堵住“未显式配置 seatControllers 也自动变 AI”的链路，因此可支撑 `resolved`。
- 直接证据：
  - `src/pages/onlineAiSeats.ts`
    - `loadOnlineAiSeatState(...)` 只信任 `setupData.seatControllers`
    - 未显式配置时不会再套用本地默认 AI
  - `src/pages/__tests__/matchSeatValidation.test.ts`
    - 用例：`未显式配置在线 AI 座位时，不得套用本地默认 AI`
  - `evidence/feedback-69d0d5bfccdbf2785a55af79-closeout-2026-04-05.md`
    - 同类根因的单条 closeout 已写明：线上房间不应回退到本地默认 AI
- 结论：
  - 这条反馈虽然此前缺少 ID 级文档，但根因、修复点和回归测试都已存在，现补为直接证据闭环。

### `69ce8ab6094b1acda250fa01` `smashup` `closed`

- 用户原文：`冠军怎么只触发一次效果，两边都是冠军`
- 判定：
  - 这条反馈对应的是计分后响应 / 基地冠军并列场景。
  - 当前仓库已同时覆盖“并列冠军各自拿到 Prompt”和“双方都有 afterScoring 卡牌时支持多轮响应”两条关键风险链，因此更适合作为 `closed` 的已澄清 / 已失效反馈处理。
- 直接证据：
  - `src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts`
    - 用例：`并列冠军时应为每位冠军各生成一个 Prompt`
    - 同文件也直接覆盖 `base_ninja_dojo: 计分后冠军消灭随从`
  - `src/games/smashup/data/factions/giant-ants.ts`
    - `giant_ant_we_are_the_champions` 已显式声明 `specialTiming: 'afterScoring'`
  - `src/games/smashup/__tests__/afterscoring-card-registration.test.ts`
    - 用例：`giant_ant_we_are_the_champions 应该走统一 afterScoring trigger`
  - `src/games/smashup/__tests__/afterScoring-window-multi-round.test.ts`
    - 用例：`两个玩家都有 afterScoring 卡牌，支持多轮响应`
  - `evidence/smashup-we-are-the-champions-timing-fix.md`
  - `evidence/smashup-response-window-complete.md`
- 结论：
  - “双方都是冠军却只触发一次”的核心风险点，当前已有直接测试和专项 evidence 覆盖；缺的是反馈 ID 级 closeout，而不是实现缺口。

### `69ce88da094b1acda250f9ff` `smashup` `closed`

- 用户原文：`怎么先结算决斗才算木乃伊之力`
- 判定：
  - 这是古埃及 `Mummy Strength / 木乃伊之力` 的旧时序理解问题。
  - 现规则语义已经明确收口为：先选随从，再按该随从所在基地是否有埋葬牌决定 `+4 / +2`，不是“先选模式”也不是“先看别的结算顺序”。
- 直接证据：
  - `src/games/smashup/abilities/ancient_egyptians.ts`
    - 文案与实现都已收口为“选择你的一个随从；若其所在基地有埋葬牌，则 +4，否则 +2”
  - `src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts`
    - 用例：`walks the real RESPOND chain with target-first selection without throwing a command exception`
  - `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
    - 用例：`Mummy Strength 先选随从，再按所选随从所在基地是否有埋葬牌决定 +4 或 +2`
  - `evidence/smashup-ancient-egyptians-audit-2026-03-29.md`
    - 明确写出旧结论失效，并把时序修正为 `target-first`
- 结论：
  - 这条反馈应视为历史错误实现 / 理解争议已被专项审计和回归测试彻底澄清，因此按 `closed` 收口合理。

### `69ce86f6094b1acda250f9d3` `smashup` `resolved`

- 用户原文：`弹窗获得一次额外随从机会，但实际没有加`
- 判定：
  - 从生产动作链看，这条对应 `cowboys_gold_in_them_thar_hills / 那山里有金子` 的额外出牌额度兑现。
  - 当前仓库已有直接回归证明“额外随从”不是只显示提示，而是会真实进入选基地并直接落牌的链路，因此可支撑 `resolved`。
- 直接证据：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - 用例：`cowboys_gold_in_them_thar_hills 选择额外无目标行动时会立刻打出该牌`
    - 用例：`cowboys_gold_in_them_thar_hills 选择额外随从时会先选基地再直接打出`
  - `evidence/feedback-smashup-cowboys-open-recheck-2026-04-04.md`
    - 已把上面两条直接测试列为 reopen 后重核依据
  - `evidence/smashup-cowboys-audit-2026-03-30.md`
    - 明确记载 `gold_in_them_thar_hills` 的额外随从兑现链
  - `evidence/smashup-oops-faction-gameplay-e2e-test.md`
    - 浏览器证据里明确写出：页面顶部出现 `获得1次额外随从机会`，且额外额度已兑现
- 结论：
  - 这条不是“只有提示没额度”的现行问题，当前实现和测试都证明额度已真实生效，只是之前缺少该 feedback ID 的单独收口文档。

### `69ce6e10094b1acda250f862` `smashup` `closed`

- 用户原文：`墓穴陷阱埋葬后不见了`
- 判定：
  - 这条更像“埋葬后的展示位置 / 表现理解”问题，而不是当前引擎把牌蒸发。
  - 古埃及埋葬牌在实现上会进入基地的 `buriedCards` / 埋葬条带，不会以普通明置在场战术的样式继续留在台面。
- 直接证据：
  - `evidence/smashup-ancient-egyptians-audit-2026-03-29.md`
    - 明确审计了 `Bury this card` 必须落到基地，且旧“离手但没进任何 buriedCards、等于蒸发”的问题已被修正
  - `src/games/smashup/__tests__/buryEngine.test.ts`
    - 多条用例覆盖埋葬牌进入 / 离开 `buriedCards` 链路
  - `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
    - 用例：`Tomb Trap 翻开后可消灭所选的力量≤4随从`
  - `evidence/smashup-oops-faction-gameplay-e2e-test.md`
    - 明确写出：翻开前 `Pyramids` 基地下方清楚显示一张埋葬条带，说明埋葬牌进入了正确的 bury strip，而不是消失
- 结论：
  - 当前实现已证明 `Tomb Trap` 会进入埋葬区并可后续翻开结算；这条反馈按 `closed` 处理更合理，原因是现实现与可视证据均不支持“埋葬后消失”的结论。

### `69cca92ec3e278ba205eb091` `smashup` `closed`

- 用户原文：`海盗的泰坦似乎没法打出在替换的基地上`
- 判定：
  - 这是海盗泰坦 `海怪克拉肯 / The Kraken` 在基地计分后、替换基地补发链路上的历史疑问。
  - 当前仓库已有单测和 E2E 直接证明：计分后替换基地交互存在，而且补发 `BASE_REPLACED` 后泰坦会真正落到新基地。
- 直接证据：
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
    - 用例：`海怪克拉肯不在场时，计分后会为有己方随从的玩家创建进替换基地交互`
    - 用例：`海怪克拉肯的替换基地进场交互在补发计分后事件时会真正把泰坦落到新基地`
  - `evidence/smashup-alien-terraform-e2e-test.md`
    - 章节：`海怪克拉肯：计分后进替换基地`
    - 文档明确写出：结算图里替换基地已出现，海怪克拉肯也落在新基地上方
- 结论：
  - 这条反馈对应的链路当前已被直接测试和浏览器证据覆盖，按 `closed` 收口成立；缺口只是之前没有把这条 feedback ID 单独挂接到证据。

## 收口结论

- 上述 `6` 条现在都已经有了“反馈 ID -> 现有实现 / 测试 / evidence”的直接映射。
- 因此 [recent-5day-feedback-doc-audit-2026-04-05.md](D:/gongzuo/webgame/BoardGame/evidence/recent-5day-feedback-doc-audit-2026-04-05.md) 中原先的“缺少明确文档映射”缺口可以清零。
- 更准确的现态应表述为：
  - 最近 `5` 天真实反馈在线上状态层面已经全部收口；
  - 最近 `5` 天真实反馈在仓库证据层面也已补齐这 `6` 条的直接文档映射。
