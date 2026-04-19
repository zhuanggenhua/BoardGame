# Smash Up Oops 四派系审计汇总（2026-03-30）

## 汇总范围
- `Ancient Egyptians`
- `Vikings`
- `Cowboys`
- `Samurai`

## 单派系 evidence
- `evidence/smashup/smashup-ancient-egyptians-audit-2026-03-29.md`
- `evidence/smashup/smashup-vikings-audit-2026-03-29.md`
- `evidence/smashup/smashup-cowboys-audit-2026-03-30.md`
- `evidence/smashup/smashup-samurai-audit-2026-03-30.md`
- 浏览器交互留证：`evidence/smashup/smashup-oops-faction-gameplay-e2e-test.md`

## 本轮统一结论

### 结论 1：四派系已按约定顺序完成专项审计
- 顺序为：
  - `Ancient Egyptians`
  - `Vikings`
  - `Cowboys`
  - `Samurai`
- 没有跳过任一派系的专项 evidence，也没有把问题压到“最后统一审计再说”。

### 结论 2：本轮真正命中的共享链路缺陷共有四类
- 埋葬/翻开共享链路：
  - `Bury this card` 缺少目标基地会蒸发；
  - 普通行动在 `beforeScoring` 翻开时会被违规打出。
- 主动基地能力共享链路：
  - `Pyramids`、`Longhouse` 不应做成 `onTurnStart` 自动弹窗。
- 混合来源卡牌迁移共享链路：
  - `Stagecoach` 需要支持随从、泰坦、基地持续行动、埋葬牌。
- inspection/reveal 共享链路：
  - `Dynamite Surprise` 需要在 `REVEAL_HAND / REVEAL_DECK_TOP` 入口给出可打出响应。

### 结论 3：统一浏览器交互门禁已补齐
- 已运行三条代表性 E2E：
  - `Ancient Egyptians`：埋葬条带与翻开
  - `Cowboys`：官方决斗链路
  - `Samurai`：消灭己方随从后发放额外额度
- 其中：
  - `Cowboys` 是完整浏览器 full-chain；
  - `Ancient Egyptians / Samurai` 是“注入当前交互后完成浏览器点击”的 UI 证明。

## 各派系收口摘要

### Ancient Egyptians
- 收口重点：
  - `Bury this card` 必须选基地；
  - `Priest of Anubis / Pyramid Engineer / Pharaoh / Lost Knowledge / Seal the Tomb / Pyramids / Ancient Curse`；
  - 普通行动翻开时机非法则直接弃置。

### Vikings
- 收口重点：
  - `Huscarl / Shield Maiden / Valkyrie / Drakkar` 改为可跳过；
  - `Raider` 改为 `0..3`；
  - `Longhouse` 改为主动基地能力；
  - `Raiding Party` 改为直接额外打出，并修正转移/重排顺序。

### Cowboys
- 收口重点：
  - `Gold in Them Thar Hills`
  - `Form a Posse`
  - `High Noon`
  - `Stagecoach`
  - `Dynamite Surprise`

### Samurai
- 收口重点：
  - `Yokai Attack!`
  - `Way of the Warrior`
  - `Final Haiku`

## 统一验证
- 领域回归：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --config temp/smashup/vitest-smashup-node.config.ts --configLoader native`
  - 结果：`2 passed`，`138 passed, 1 skipped`
- 浏览器 E2E：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "Oops Ancient Egyptians 埋葬条带与翻开交互应在浏览器中可完成"`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "Oops Samurai 额外出牌效果应在浏览器中兑现额外随从与行动额度"`
  - 结果：`3 passed`
- 类型检查：
  - `npm run typecheck`
  - 结果：通过

## 本轮环境说明
- 本地统一 E2E 首次运行被 Vite PostCSS 链路阻断：
  - 缺少 `@alloc/quick-lru`
  - 页面直接停在 Vite overlay，`__BG_TEST_HARNESS__` 无法注入
- 已用最小风险方式恢复当前工作区运行环境：
  - `npm install @alloc/quick-lru@5.2.0 --no-save`
- 该步骤未改业务代码，仅用于恢复当前工作区浏览器测试环境。

## 残留风险
- `Ancient Egyptians / Samurai` 的浏览器证据仍以交互注入型 E2E 为主，不是从手牌正常打出直到最终结算的全链路证明。
- Smash Up Wiki 抓取缓存当前仍不可靠，后续若继续扩审其他派系，不能直接把本地空缓存当成规则真相。

## 总结状态
- 状态：`Oops 四派系已完成首轮专项审计 + 统一汇总审计`
- 结论：当前没有未收口的高优先级规则缺口。
