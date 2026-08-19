# DiceThrone 奖励骰操作日志确认时机修复证据（2026-08-18）

## 结论等级

- 结论：`目标真实入口 E2E 已验证`
- 对象：奖励骰还没点确认时，操作日志提前显示最终效果；奖励骰被修改后，最终确认日志没有按改后骰面重新出现。
- 当前边界：本文件只覆盖奖励骰操作日志时机与最终结果重写，不代表 DiceThrone 全量黄金链或全部英雄奖励骰流程已完整验收。

## 原始症状

- 用户原话目标：奖励骰子还没点确认，日志就有结果；重投后奖励骰结果也没有重新出现日志。
- 保真断言：
  - 奖励骰待确认时，只能记录“掷出了哪些奖励骰”，不能把当前骰面当成最终效果结果。
  - 奖励骰被重投或改骰后，最终日志必须等骰主确认时再出现，并按确认时的最终骰面写结果。

## 根因分层

| 层级 | 本轮证据 |
| --- | --- |
| 现实故障现象 | 玩家还没点奖励骰确认，操作日志已经出现最终结果；修改 / 重投后，最终结果日志没有重新按最终骰面出现。 |
| 直接触发条件 | 行动日志格式化器把奖励骰掷出事件同时当作“掷出记录”和“最终效果结果”来显示。 |
| 错误执行动作 | 待确认批次里的 `BONUS_DIE_ROLLED` 和卡牌投骰日志提前消费了 `bonusDie.effect.*.result`；确认事件 `BONUS_DICE_SETTLED` 没有承载最终效果文案参数。 |
| 根本机制 | 奖励骰事件的现实含义没有被区分：`BONUS_DIE_ROLLED` 应表示“骰子已掷出但未收口”，`BONUS_DICE_SETTLED` 才表示“玩家确认后的最终结果”。旧日志消费点把两者混用，导致确认前提前出结果，确认后反而没有最终结果。 |

## 本轮改动

| 文件 | 改动 | 现实效果 |
| --- | --- | --- |
| `src/games/dicethrone/game.ts` | 待确认奖励骰批次不再生成卡牌投骰最终结果日志；`BONUS_DIE_ROLLED` 待确认时只显示骰面；新增 `BONUS_DICE_SETTLED` 最终日志分支。 | 确认前日志只显示“奖励骰掷出”，确认后才显示“奖励骰确认结果”。 |
| `src/games/dicethrone/domain/events.ts` | 奖励骰确认事件增加最终效果文案 key 和参数。 | 行动日志能从确认事件拿到最终结果描述。 |
| `src/games/dicethrone/domain/executeTokens.ts` | 生成 `BONUS_DICE_SETTLED` 时携带最终骰面对应的效果文案 key 和参数。 | 修改 / 重投 pending 骰面后，最终日志按确认时骰面输出。 |
| `public/locales/zh-CN/game-dicethrone.json` / `public/locales/en/game-dicethrone.json` | “奖励骰结果”改为“奖励骰掷出”，新增“奖励骰确认结果”。 | 玩家能区分“已掷出”和“已确认结算”。 |
| `src/games/dicethrone/__tests__/actionLogFormat.test.ts` | 新增确认前 / 确认后日志格式断言。 | 单测锁住不提前写最终效果、确认后按最终骰面写结果。 |
| `e2e/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e.ts` | 扩展万箭齐发真实页面 E2E，打开操作日志面板并截图确认前 / 确认后日志。 | 真实 UI 覆盖玩家能看到的日志面板。 |

## 关键截图与观察

### 奖励骰确认前日志

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-bonus-dice-e2e-screenshots.e2e\万箭齐发：弹一手修改奖励骰后按改后弓面数加伤并施加缠绕\06A-万箭齐发-确认前日志只显示奖励骰掷出不显示最终结果.jpg`

观察：
- 日志中可见“奖励骰掷出”，显示了 5 颗奖励骰。
- 日志中没有“奖励骰确认结果”。
- 日志中没有“2 个弓面 / 3 个弓面：伤害 +X，并施加缠绕”这类最终效果结果。

结论：达到“奖励骰未确认前不提前写最终效果”的验收点。

### 奖励骰确认后日志

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-bonus-dice-e2e-screenshots.e2e\万箭齐发：弹一手修改奖励骰后按改后弓面数加伤并施加缠绕\07A-万箭齐发-确认后日志按改后奖励骰写最终结果.jpg`

观察：
- 日志中可见“奖励骰确认结果”。
- 最终结果显示为“2 个弓面：伤害 +2，并施加缠绕”，对应弹一手把一颗弓面改成非弓面后的最终骰面。
- 后续日志显示对防御方施加缠绕，说明最终效果在确认后收口。

结论：达到“确认后按改后奖励骰写最终结果”的验收点。

## 验证命令

- `npx vitest run src/games/dicethrone/__tests__/actionLogFormat.test.ts -t "奖励骰等待确认时|奖励骰出现" --reporter verbose`
  - 结果：`1 passed / 2 passed / 13 skipped`。
- `npm run typecheck`
  - 结果：通过。
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-bonus-dice-e2e-screenshots.e2e.ts "万箭齐发：弹一手修改奖励骰后按改后弓面数加伤并施加缠绕"`
  - 结果：`1 passed`。
- `npx vitest run src/games/dicethrone/__tests__/actionLogFormat.test.ts --reporter verbose`
  - 结果：`1 passed / 15 passed`。
- `npx vitest run src/lib/__tests__/i18n-check.test.ts --reporter verbose`
  - 结果：`1 passed / 40 passed`。
- `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('public/locales/zh-CN/game-dicethrone.json','utf8')); JSON.parse(fs.readFileSync('public/locales/en/game-dicethrone.json','utf8')); console.log('locale json ok')"`
  - 结果：`locale json ok`。
- `npx vitest run src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts --reporter verbose`
  - 结果：`1 passed / 4 passed`。

## 同类扩审记录

- 搜索维度：`BONUS_DIE_ROLLED`、`BONUS_DICE_REROLL_REQUESTED`、`BONUS_DICE_SETTLED`、`CARD_ROLL_RESULT`、`summaryEffectKey`、`summaryEffectParams`。
- 命中判断：
  - 问题不是万箭齐发单卡文案错误，而是奖励骰“掷出事件”和“确认事件”的日志职责混用。
  - 多骰汇总类奖励骰依赖 `summaryEffectKey / summaryEffectParams`，单骰类奖励骰依赖单颗最终骰的 `effectKey / effectParams`；本轮把最终日志统一挂到确认事件。
  - 重投合同测试确认奖励骰重投后仍等待骰主确认；最终日志也只从同一个确认事件读取。
- 未扩大范围：
  - 本轮没有修改奖励骰实际伤害结算公式；真实副作用仍由右侧骰盘确认后统一收口。
  - 当前工作区还有其它已有脏改，本证据不把它们算作本轮奖励骰日志时机修复成果。
