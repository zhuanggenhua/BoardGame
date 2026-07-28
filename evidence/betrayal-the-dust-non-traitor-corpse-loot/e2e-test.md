# 山屋惊魂作祟 3「灰尘」非叛徒搜尸 E2E 证据

## 本轮锁定

- 问题对象：灰尘剧本下，非叛徒死亡后是否继续保留尸体遗物，并允许同房间存活探索者通过真实页面搜刮 1 件物品 / 预兆。
- 真相来源：`docs/games/betrayal/haunts/03-the-dust.md` 的死亡叛徒变狂热病患 / 掩埋规则、非叛徒死亡反向边界领域测试，以及当前工作区真实入口 Playwright 用例 `e2e/betrayal/the-dust-non-traitor-corpse-loot.e2e.ts`。
- 目标入口 / 环境：`D:\gongzuo\webgame\BoardGame`，Playwright chromium，1600x900 真实牌桌页面 `/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&seed=the-dust-non-traitor-corpse-loot`，通过测试 helper 注入灰尘 + 非叛徒尸体 + 同房搜尸代表态。
- 验收口径：灰尘进度条可见；死亡非叛徒不在永久叛徒名单和狂热病患名单中；尸体保留地图 / 书本；同房存活探索者点击“搜尸”后必须点尸体 token 并选择具体卡牌；搜走地图后当前探索者获得地图、尸体只剩书本，且本回合不能从同一尸体继续搜第二张。

## 执行命令

```powershell
npx eslint e2e\betrayal\the-dust-non-traitor-corpse-loot.e2e.ts e2e\betrayal\betrayalTestHelpers.ts
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-non-traitor-corpse-loot.e2e.ts "灰尘非叛徒"
```

结果：

- ESLint：0 errors。
- E2E：`1 passed`，用例耗时约 9.9 秒，总运行约 19.2 秒。

## 截图与肉眼核验

| 顺序 | 截图 | 我实际看到什么 | 验收判断 |
| ---: | --- | --- | --- |
| 1 | `01-灰尘非叛徒尸体可搜刮.jpg` | 画面处于剧本 3「灰尘」作祟中；当前玩家达里尔·海拉在门厅；同房间丽贝卡·艾伦博士显示为尸体；底部按钮显示“搜尸”；状态提示“点交易可搜刮尸体：1具” | 通过：非叛徒死亡后保留尸体并进入可搜尸入口 |
| 2 | `02-灰尘选择尸体和地图.jpg` | 玩家点击尸体后出现尸体持有牌选择区；地图被选中，搜尸动作尚未结算 | 通过：真实页面要求先选尸体和具体持有物，不能默认拿第一张 |
| 3 | `03-灰尘搜尸后限制本回合二次搜刮.jpg` | 结算后日志显示从尸体拿走地图；当前玩家持有地图；尸体只剩书本；搜尸入口回到禁用交易态，本回合不能继续搜该尸体 | 通过：每回合每具尸体只搜刮 1 件，且不会触发灰尘疾病交换等待态 |

## 自动断言覆盖

- 灰尘进度条显示剧本 3 / 灰尘。
- 当前玩家是达里尔·海拉，死亡玩家丽贝卡·艾伦博士仍在死亡列表。
- 死亡非叛徒不在永久叛徒列表，也不在狂热病患列表。
- 尸体初始持有地图和书本；当前玩家初始不持有地图。
- 点击“搜尸”后必须点击同房尸体 token，再点击具体尸体卡牌。
- 搜尸后当前玩家获得地图，尸体只剩书本，`corpseLootedByPlayerIdsThisTurn` 记录该尸体已被搜刮。
- 全程不生成疾病交换等待态，也没有前端致命错误。

## 不外推边界

- 本证据只证明灰尘剧本下“非叛徒死亡保留遗物 + 同房存活探索者搜尸”的真实页面代表链。
- 本证据不证明灰尘永久叛徒死亡掩埋的真实页面全排列、不证明兔脚回滚后搜尸 / 掩埋组合、不证明全部死亡来源或全部特殊作祟尸体用途完成。
- 通用第一剧本搜尸链另见 `evidence/betrayal-first-scenario-corpse-loot/`；灰尘非叛徒搜尸的领域反向边界见 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 中“灰尘非叛徒死亡时不会掩埋遗物”。
