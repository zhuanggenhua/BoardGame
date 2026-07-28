# 山屋惊魂作祟 3「灰尘」兔脚死亡回滚 / 掩埋 E2E 证据

## 本轮锁定

- 问题对象：灰尘剧本下，永久叛徒死亡并生成狂热病患后，若仍处于头骨死亡保护的兔脚重掷窗口，兔脚成功是否回滚死亡 / 狂热病患并保留遗物；兔脚仍失败是否保持死亡 / 狂热病患并掩埋遗物，且同房玩家不能搜尸。
- 真相来源：灰尘子账本中“死亡叛徒变狂热病患并掩埋遗物”规则、领域测试“灰尘永久叛徒头骨失败生成狂热病患后，兔脚重掷成功会回滚死亡和狂热病患化 / 仍失败会保持死亡和狂热病患化”，以及当前工作区真实入口 Playwright 用例 `e2e/betrayal/the-dust-rabbit-foot-death-burial.e2e.ts`。
- 目标入口 / 环境：`D:\gongzuo\webgame\BoardGame`，Playwright chromium，1600x900 真实牌桌页面 `/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-rabbit-foot-death-burial`。
- 验收口径：先由灰尘冲动伤害分配到骷髅并触发头骨死亡保护失败；死亡保护骰盘回看层中兔脚可选中并点击具体骰子；成功分支回滚死亡、移除狂热病患并保留头骨 / 兔脚 / 地图；仍失败分支保留死亡和狂热病患、死亡叛徒遗物被掩埋、没有尸体持有牌选择区。

## 执行命令

```powershell
npx eslint e2e\betrayal\the-dust-rabbit-foot-death-burial.e2e.ts e2e\betrayal\betrayalTestHelpers.ts
node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "兔脚重掷.*狂热病患|灰尘兔脚成功回滚永久叛徒狂热病患"
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-rabbit-foot-death-burial.e2e.ts "兔脚"
```

结果：

- ESLint：0 errors。
- 领域回归：`11 passed / 400 skipped`。
- E2E：`2 passed`。

## 截图与肉眼核验

| 顺序 | 截图 | 我实际看到什么 | 验收判断 |
| ---: | --- | --- | --- |
| 1 | `01-兔脚死亡保护重掷前.jpg` | 头骨死亡保护已经失败，死亡保护骰盘仍在；兔脚处于可作为重掷来源的窗口 | 通过：死亡和狂热病患生成后，兔脚仍可在同一死亡保护窗口响应 |
| 2 | `02-兔脚成功回滚死亡.jpg` | 兔脚重掷后死亡保护结果变为“阻止死亡” | 通过：兔脚成功改变死亡保护结果 |
| 3 | `03-兔脚成功后遗物保留.jpg` | 玩家仍活着；狂热病患 token 不存在；当前持有区保留头骨、兔脚、地图 | 通过：成功分支回滚死亡和狂热病患，且不掩埋遗物 |
| 4 | `04-兔脚仍失败保持死亡.jpg` | 兔脚重掷后死亡保护仍为“正常死亡” | 通过：失败分支没有回滚死亡 |
| 5 | `05-兔脚仍失败后遗物掩埋不可搜尸.jpg` | 同房间显示死亡叛徒 token 和狂热病患 token；底部没有“搜尸”入口；当前持有区没有死亡叛徒遗物 | 通过：仍失败分支保持死亡 / 狂热病患，并掩埋遗物 |

## 自动断言覆盖

- 灰尘进度条显示剧本 3 / 灰尘。
- 死亡保护前，玩家持有头骨、兔脚、地图。
- 灰尘冲动伤害进入一般伤害分配，玩家主动把伤害分配到骷髅。
- 头骨失败后，死亡玩家进入死亡列表并生成同房狂热病患。
- 兔脚在死亡保护骰盘回看层可选中，并要求点击具体骰子。
- 兔脚成功后：死亡玩家从死亡列表移除，狂热病患移除，头骨 / 兔脚 / 地图保留，终局为空。
- 兔脚仍失败后：死亡玩家仍在死亡列表，狂热病患仍在门厅，死亡叛徒持有物清空，尸体持有牌选择区不存在，终局为空。
- 全程没有前端致命错误。

## 不外推边界

- 本证据只证明“灰尘永久叛徒 + 头骨失败 + 兔脚成功 / 仍失败”这组真实页面代表链。
- 本证据不证明全部兔脚重掷来源、不证明所有事件副作用 + 兔脚组合、不证明非叛徒死亡搜尸链，也不证明全部死亡来源或灰尘全部规则完成。
- 死亡叛徒不可搜尸基础链另见 `evidence/betrayal-the-dust-dead-traitor-burial-no-loot/e2e-test.md`；非叛徒可搜尸链另见 `evidence/betrayal-the-dust-non-traitor-corpse-loot/e2e-test.md`。
