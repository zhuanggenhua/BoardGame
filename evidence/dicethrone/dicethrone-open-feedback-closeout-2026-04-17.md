# DiceThrone 剩余开放反馈收口（2026-04-17）

## 目标
- 收口当前数据库里剩余的 3 条非测试 DiceThrone 开放反馈
- 区分“当前仍需改代码的真实缺陷”与“历史误判/旧 incident，现已被测试与证据覆盖”的反馈

## 对应反馈
- `69d311af73bdf3d33ce99714`：`打出死亡之眼，日志是执法者，没有触发升级，映射或者配置有问题`
- `69d3054689362375dcb13890`：`左轮连射打出了没升级`
- `69d9ff5a7bee880f344af235`：`ai卡死`

## 结论
1. `69d311af...` 与 `69d30546...` 当前不再是现存实现缺陷；它们对应的是枪手复合升级牌的旧语义混淆：
   - `upgrade-deadeye-2` / `upgrade-fan-the-hammer-2` 是整张升级卡；
   - `执法者` / `枪托击打` 是升级后基础技能内部的 `variant`，不是被“误打出的另一张手牌”；
   - 当前测试和 E2E 证据都已证明升级本身正常生效。
2. `69d9ff5a... ai卡死` 的用户体感已被现有 watchdog 链路覆盖；本轮再次复跑在线 AI `main2` 卡死收口用例，通过后未复现“持续卡死 / 失败提示”。
3. 因此这 3 条反馈都可以按 `resolved` 收口；其中前两条属于历史误判已被后续修复/证据覆盖，后一条属于 AI 收口链路已通过当前版本验证。

## 真相源与现有证据
### A. 死亡之眼 / 执法者
- 规则与录入裁定：
  - `src/games/dicethrone/rule/枪手卡牌录入核对.md`
  - 其中明确写明：`upgrade-deadeye-2` 是复合升级卡，`执法者` 是升级后 `deadeye` 的技能变体，不是独立手牌。
- 自动化与 E2E 证据：
  - `src/games/dicethrone/__tests__/cross-hero.test.ts`
  - `evidence/dicethrone/dicethrone-hero-ability-cards-e2e-test.md`
  - `evidence/dicethrone/dicethrone-gunslinger-deadeye-upgrade-atlas-e2e-test.md`
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-upgrade-deadeye-action-log.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-the-law-action-log.png`
- 已有结论：日志已正确区分“打出升级卡：死亡之眼 II”与“发动技能：执法者”；升级卡挂在技能槽，不进弃牌堆。

### B. 左轮连射 II / 枪托击打
- 规则与录入裁定：
  - `src/games/dicethrone/rule/枪手卡牌录入核对.md`
  - 其中明确写明：`upgrade-fan-the-hammer-2` 是复合升级卡，`枪托击打` 是升级后 `fan-the-hammer` 的技能变体，不是独立手牌。
- 自动化与 E2E 证据：
  - `src/games/dicethrone/__tests__/cross-hero.test.ts`
  - `evidence/dicethrone-fan-the-hammer-upgrade-e2e-test-2026-04-06.md`
  - `evidence/dicethrone/dicethrone-hero-ability-cards-e2e-test.md`
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\temp-dicethrone-ability-atlas-regression.e2e\gunslinger-fan-the-hammer-upgraded-slot-should-still-deal-8-damage-when-selected-in-UI\gunslinger-fan-the-hammer-upgraded-slot-before-select.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\temp-dicethrone-ability-atlas-regression.e2e\gunslinger-fan-the-hammer-upgraded-slot-should-still-deal-8-damage-when-selected-in-UI\gunslinger-fan-the-hammer-upgraded-slot-after-select.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-pistol-whip-action-log.png`
- 已有结论：升级后选择 `左轮速射 II` 时，运行时预期伤害为 8；`枪托击打` 只作为技能变体记录到日志，不是“升级没生效”。

### C. AI 卡死
- 引擎/链路证据：
  - `evidence/engine/watchdog-open-feedback-closeout-2026-04-17.md`
  - `evidence/engine/online-ai-watchdog-strong-audit-2026-04-12.md`
  - `evidence/dicethrone/dicethrone-ai-response-window-watchdog-e2e-test.md`
- 本轮复跑截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-DiceThrone-main2-阶段持续卡死时，服务端-watchdog-应自动多步收口到我方回合且不再弹失败提示\19-online-ai-main2-stalled-before-watchdog.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-DiceThrone-main2-阶段持续卡死时，服务端-watchdog-应自动多步收口到我方回合且不再弹失败提示\20-online-ai-main2-stalled-after-watchdog.png`
- 我实际看到：
  - 两张图里页面都处于稳定可见状态，没有出现 “AI 强制结束失败 / 自动跳过失败” 一类提示。
  - 肉眼上两张图的差异不大，**单靠截图本身不足以独立证明控制权已切回真人**；本条收口主要依赖同一 E2E 用例内的状态断言：watchdog 收口后 `activePlayerId` 回到 `0`，且阶段回到真人回合可继续推进的 `upkeep/income/main1`。
- 收口判断：
  - 对“当前版本是否仍会卡死并弹失败提示”这个反馈目标，已达到验收标准；
  - 对“仅靠截图能否独立证明完整回合切换”这个问题，不应夸大，状态断言才是主证据。

## 本轮补充验证
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native --maxWorkers 1 -t "upgrade-deadeye-2 从正常牌库抽到手后，打出仍应走升级而不是其他效果|upgrade-fan-the-hammer-2 从正常牌库抽到手后，打出仍应走升级而不是同槽位其他卡效果|upgrade-fan-the-hammer-2 升级后，实际选择左轮速射应造成 8 点伤害"`
  - 结果：3 个目标用例通过。
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 在 DiceThrone main2 阶段持续卡死时，服务端 watchdog 应自动多步收口到我方回合且不再弹失败提示"`
  - 结果：1 个 E2E 用例通过。

## 状态回写建议
- `69d311af73bdf3d33ce99714` → `resolved`
- `69d3054689362375dcb13890` → `resolved`
- `69d9ff5a7bee880f344af235` → `resolved`

## 风险说明
- 这 3 条反馈的收口口径都是“当前版本已被现有实现 + 自动化 + 证据覆盖”，不是说 DiceThrone 后续永远不可能再出现新型 AI 卡死或新型升级展示问题。
- 若未来再次出现“日志名像技能变体 / 用户误以为升级没生效”的反馈，应优先按“复合升级卡 vs 技能变体”语义重新核对，而不是先假定领域升级执行错了。
