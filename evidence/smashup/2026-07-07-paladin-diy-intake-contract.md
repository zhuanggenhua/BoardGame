# Paladin DIY 派系 intake 合同

## 范围

- gameId: `smashup`
- factionId: `paladins`
- 本轮目标：按葫芦娃 DIY 派系同类做法接入静态卡组、基地、atlas、派系选择入口与可玩行为 handler。
- 本轮结论：圣骑士已从静态 intake 推进到可玩级别；关键天赋、持续、决斗、计分前特殊、泰坦与基地联动均有定向测试覆盖。

## 真相源表

| 类型 | 路径 | 覆盖对象 | 结论 |
| --- | --- | --- | --- |
| 卡牌高清 atlas | `D:\新建文件夹\paladin-minions-actions-atlas.png` | 12 张随从/战术运行时卡图 | 正式运行时资源来源 |
| 卡牌预览 atlas | `D:\新建文件夹\paladin-minions-actions-atlas-preview.jpg` | 12 张随从/战术标题、类型、力量、效果文本 | 文字与索引主真相源 |
| 基地预览 atlas | `D:\新建文件夹\paladin-bases-atlas-preview.jpg` | 2 张基地标题、断点、VP、效果文本 | 基地文字与索引主真相源 |

## 图集合同

| atlas | 运行时路径 | 网格 | 顺序 | 备注 |
| --- | --- | --- | --- | --- |
| Paladin cards | `smashup/cards/paladin_cards` | `3 x 4` | row-major，索引 0-11 | 预览图为 1800x2026；高清 PNG 为 4096x4611，同一构图 |
| Paladin bases | `smashup/base/paladin_bases` | `1 x 2` | row-major，索引 0-1 | 预览图为 1800x637 |

## 卡牌合同

| index | defId | 类型 | 名称 | 力量/目标 | 图面效果摘要 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `paladins_roland` | 随从 | 罗兰 | 5 | 天赋：本随从战斗力大于 8 且场上无炽天使时，打出神圣炽天使到这里 | 可玩 handler + 测试 |
| 1 | `paladins_devout_pastor` | 随从 | 虔诚的牧师 | 4 | 天赋：若这里没有你的泰坦，抓一张牌然后弃一张牌 | 可玩 handler + 测试（2026-07-24 重审补齐玩家选择弃牌断言） |
| 2 | `paladins_senior_mentor` | 随从 | 年迈导师 | 2 | 天赋：在这里一个没有战斗力指示物的随从上放置一个 +1 指示物 | 可玩 handler + 测试 |
| 3 | `paladins_novice_knight` | 随从 | 新手骑士 | 2 | 持续：这里你的随从每回合首次使用天赋后，在本随从上放置 +1 指示物 | 可玩 handler + 测试 |
| 4 | `paladins_durandal` | 战术 | 杜尔南圣剑 | 打出到你的随从 | 持续：赋予天赋，若本回合使用过天赋且无炽天使，可打出炽天使到这里 | 可玩 handler + 测试 |
| 5 | `paladins_knights_duel` | 战术 | 骑士决斗 | 你的随从 + 同基地其他玩家随从 | 决斗，消灭失败者；若你赢，在该随从上放置 +1 指示物 | 可玩 handler + 测试 |
| 6 | `paladins_battle_cry` | 战术 | 战呼 | 全局本回合 | 你的随从 +1，使用过天赋的你的随从额外 +1，直到回合结束 | 可玩 handler + 测试 |
| 7 | `paladins_holy_light_blessing` | 战术 | 圣光加身 | 打出到你的随从 | 持续：赋予天赋，本随从战斗力 +3 直到回合结束 | 可玩 handler + 测试 |
| 8 | `paladins_expel` | 战术 | 驱离 | 随从或基地上的战术 | 消灭一个打出在随从或基地上的战术 | 可玩 handler + 测试 |
| 9 | `paladins_spread_the_oracle` | 战术 | 传播圣言 | 打出到你的随从 | 持续：赋予天赋，本回合可额外打出一张战术 | 可玩 handler + 测试 |
| 10 | `paladins_climb_the_holy_stairs` | 战术 | 登圣长阶 | 打出到你的随从 | 持续：使用天赋后放置 +1；若力量 ≥4 且无炽天使，可打出炽天使并返回本战术 | 可玩 handler + 测试 |
| 11 | `paladins_heavenly_soldiers_descend` | 战术 | 神兵天降 | 计分前特殊 | 额外打出一个随从到这里并使用其天赋 | 可玩 handler + 测试 |

## 基地合同

| index | defId | 名称 | 断点 | VP | 图面效果 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `base_paladins_monastery` | 修道院 | 25 | 5/3/2 | 每当一个泰坦被打出到这里时，该泰坦的拥有者抓一张牌 | 可玩 handler + 测试 |
| 1 | `base_paladins_roncesvalles_gorge` | 龙塞沃峡谷 | 24 | 4/3/2 | 每当一个泰坦在这里赢得冲突时，该泰坦的拥有者获得 1VP | 可玩 handler + 测试 |

## 泰坦合同

| defId | 名称 | 来源 | 状态 |
| --- | --- | --- | --- |
| `paladins_seraphim` | 神圣炽天使 | 用户补充独立泰坦图 `D:\新建文件夹\神圣炽天使.png` | 已注册泰坦定义；使用独立 1x1 泰坦图；登场抽 2 / 按本回合己方已用天赋随从加指示物 / 消灭这里战斗力 4 或更低随从 / 己方回合结束移除 |

## 验证证据

- `npx tsc --noEmit --pretty false`：通过。
- `npm run test:watch -- src/games/smashup/__tests__/abilities/paladins.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts`：47 tests passed。
- `npm run assets:validate -- --id i18n/zh-CN/smashup`：通过。
- R2 精准上传 `paladin_bases.webp`、`paladin_cards.webp`、`paladin_seraphim.webp`；复查 `npm run assets:check -- --id i18n/zh-CN/smashup` 后 Paladin 新增资源差异为 0。
- 2026-07-08 炽天使专项审查补充：
  - 修复 `paladins_durandal` / `paladins_climb_the_holy_stairs` 贴附天赋打出炽天使时，宿主随从未计入“本回合使用过天赋能力的随从数”的问题；回归测试断言两条贴附天赋路径都会给炽天使正确放置指示物。
  - 修复炽天使登场抽 2 使用空随机源的问题；当牌库为空且弃牌堆可洗回时不再崩溃，回归测试覆盖弃牌堆洗回后抽牌。
  - 修复修道院泰坦进场抽 1 的同源空随机风险；回归测试覆盖牌库为空且弃牌堆存在时，泰坦进场仍能正常抽到牌。
  - 校正 `public/assets/i18n/zh-CN/smashup/assets-manifest.json` 头部 `id/basePrefix`，保持与当前 `assets:validate -- --id i18n/zh-CN/smashup` 脚本合同一致，避免局部 manifest 校验失败。
  - 按用户补充要求修正炽天使“消灭这里一个战斗力 4 或更低随从”为玩家选择目标：无目标不处理，单目标自动结算，多目标弹出 `paladins_seraphim` 选择 prompt；回归测试覆盖玩家指定目标后只消灭所选随从。
- 2026-07-24 虔诚的牧师专项漏审复盘：
  - 用户原始症状：圣骑士 4 费随从虔诚的牧师发动“抓一张牌然后弃一张牌”天赋后，系统直接把刚抓到的牌弃掉，看起来像点击穿透。
  - 结论：不是点击穿透，是旧实现把“抓牌后玩家从手牌选择一张弃掉”误实现成“自动弃掉刚抽到的牌”。本轮已改为先抓牌，再进入手牌选择交互；玩家可以弃旧手牌，也可以弃刚抽到的牌。
  - 旧审计问题：本文档原先把虔诚的牧师标为“可玩 handler + 测试”，但该状态只证明存在实现和测试，没有证明关键交互语义正确。旧测试还把错误语义固化为断言：发动后要求刚抽到的牌不在手牌、进入弃牌堆。
  - 漏审归因：属于“旧测试已经失效”和“测试断言过窄”的组合；缺少“抽牌后真实手牌候选包含旧手牌与新抽牌”“弃牌必须由玩家选择”“响应后只弃所选牌”的原子断言。
  - 测试语义对账 / 本轮补测口径：`src/games/smashup/__tests__/abilities/paladins.test.ts` 中虔诚的牧师用例已改为初始存在旧手牌、牌库顶存在新牌；发动后先断言两张牌都在手牌且弃牌堆为空，再响应选择旧手牌，最终断言只弃所选旧手牌。
  - 本轮实现口径：`src/games/smashup/abilities/paladins.ts` 中虔诚的牧师改为基于抽牌后的真实手牌生成选择项，并注册专用弃牌响应处理；只有无 matchState 的兜底路径才自动弃投影手牌第一张。
  - 同类扩审记录：本轮先用 `buildStandardDrawEvents` / `CARDS_DISCARDED` / `draw.*discard` / `抓.*弃` 在 `src/games/smashup` 做关键词扩搜；命中大量其他派系的抽牌、弃牌、随机弃牌、从弃牌堆抓牌或弃后抓牌路径，语义并不等同于虔诚的牧师“抓一后从手牌选一弃一”。本节只收口虔诚的牧师反馈，不把全量 Smash Up 抽弃链路声明为已审计。
  - 验证命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/paladins.test.ts --configLoader native` 通过；`npx eslint src/games/smashup/abilities/paladins.ts src/games/smashup/__tests__/abilities/paladins.test.ts` 通过；中英文 `paladins_devout_pastor_discard_title` i18n key 已做 JSON parse 轻量校验。

## 未覆盖风险

- 神圣炽天使已补独立泰坦卡图；当前实现按图面文字执行。多个战斗力 4 或更低随从存在时，已改为由炽天使控制者选择目标。
- 虔诚的牧师已补玩家选择弃牌回归测试；该补充不等于全量 Smash Up “抓牌然后弃牌”类能力审计完成，后续若要写全量收口，需要另起同类能力清单并逐条判定是否属于玩家选择弃牌语义。
- 仍未执行全量 Smash Up 回归；本轮完成圣骑士定向行为测试，工作区内其它未提交改动不属于本轮收口范围。`assets:check` 仍提示 `pretty_pretty.webp` 远端差异，该项不是本轮 Paladin/炽天使资源。
