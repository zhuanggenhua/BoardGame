# Smash Up 拜亚基审计 2026-04-04

## 审计范围

- 卡牌：`elder_thing_byakhee`
- 实现入口：`src/games/smashup/abilities/elder_things.ts`
- 回归测试：`src/games/smashup/__tests__/elderThingAbilities.test.ts`
- 文案同步：`public/locales/zh-CN/game-smashup.json`、`public/locales/en/game-smashup.json`

## 权威来源

- 本地图片：`public/assets/i18n/zh-CN/smashup/cards/compressed/cards2.webp` 中 `CARDS2` 索引 `36`
- 本轮临时裁图：`temp/byakhee-card-crop.png`

## 审计结论

### 2026-04-07 修订

- 本轮按用户明确要求，已将原版 `elder_thing_byakhee` 统一改为与 POD / Wiki 相同的口径：`每位在这里有随从的其他玩家抽一张疯狂卡。`
- 当前结论不再以 2026-04-04 的本地图旧口径作为实现约束，而是以“原版 / POD 统一语义”为本轮交付目标。

### elder_thing_byakhee

- 旧卡面文字：`如果其他玩家有随从在这个基地抽一张疯狂卡。`
- 当前代码 / locale 口径：`每位在这里有随从的其他玩家抽一张疯狂卡。`
- 当前结论：原版实现已按用户要求改为“每位符合条件的其他玩家各抽 1 张疯狂卡”，并与 POD 版保持一致。

## 修订记录

- 失效结论：上一版文档曾按 Wiki 口径认定“原实现为真实 bug”，该结论在“本地图片优先”规则下失效。
- 失效原因：上一版错误地把 Wiki 作为第一真相源，未先看本地卡图。
- 处理：已恢复实现、恢复 locale、恢复测试预期，并保留本次规范修订。
- 新失效结论：上一个版本中“原版应由拜亚基控制者自己抽 1 张疯狂卡”的结论已失效。
- 新失效原因：本轮根据用户明确要求，原版与 POD 版需要统一为“其他玩家抽疯狂卡”的语义。
- 新处理：已同步修改实现、locale 与单元测试。

## 当前实现核对

- `src/games/smashup/abilities/elder_things.ts`
  - 当前逻辑：遍历该基地上有随从的每位其他玩家，并让其各抽 1 张疯狂卡。
- `src/games/smashup/__tests__/elderThingAbilities.test.ts`
  - 当前断言：效果触发时，基地上的每位其他玩家分别收到 1 条 `MADNESS_DRAWN` 事件。
- `public/locales/zh-CN/game-smashup.json`
  - 已改为“每位在这里有随从的其他玩家抽一张疯狂卡。”
- `public/locales/en/game-smashup.json`
  - 已改为 `Each other player with a minion here draws a Madness card.`

## 验证证据

- 运行：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/elderThingAbilities.test.ts --configLoader native --maxWorkers 1`
- 结果：
  - `21 passed`
- 关键验证点：
  - 有对手随从时，由对应对手收到 `MADNESS_DRAWN`
  - 多位对手都在该基地时，会分别收到各自的 `MADNESS_DRAWN`
  - 基地无其他玩家随从或疯狂牌库为空时，不产生疯狂抽牌事件

## 额外发现 / 未覆盖风险

- 原版 `elder_thing_byakhee` 与 `elder_thing_byakhee_pod` 现已统一为“每位在这里有随从的其他玩家抽一张疯狂卡”。
- 项目内 Wiki 爬虫对 `elder_things` / `cthulhu` 返回 `0` 张卡，说明爬虫已落后；但在“本地图片优先”规则下，这不再影响本次结论。
