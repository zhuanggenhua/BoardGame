# 山屋惊魂作祟 3「灰尘」死亡叛徒掩埋不可搜尸 E2E 证据

## 本轮锁定

- 问题对象：灰尘剧本下，永久叛徒死亡并变成狂热病患后，其物品 / 预兆是否已经按剧本规则掩埋，且同房间存活探索者不能从真实页面搜刮该尸体。
- 真相来源：`docs/games/betrayal/haunts/03-the-dust.md` 的“死亡叛徒变狂热病患并掩埋遗物”规则、领域代表链“灰尘永久叛徒最终死亡变狂热病患时会掩埋全部 23 张运行持有牌”，以及当前工作区真实入口 Playwright 用例 `e2e/betrayal/the-dust-dead-traitor-burial-no-loot.e2e.ts`。
- 目标入口 / 环境：`D:\gongzuo\webgame\BoardGame`，Playwright chromium，1600x900 真实牌桌页面 `/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&seed=the-dust-dead-traitor-burial-no-loot`，通过测试 helper 注入灰尘 + 死亡叛徒 + 同房狂热病患代表态。
- 验收口径：灰尘进度条可见；死亡玩家在死亡列表、永久叛徒列表和狂热病患列表中；死亡叛徒原持有物已清空；同房狂热病患 token 可见；底部交易入口不能显示“搜尸”；尸体持有牌选择区不存在，且不生成疾病交换等待态。

## 执行命令

```powershell
npx eslint e2e\betrayal\the-dust-dead-traitor-burial-no-loot.e2e.ts e2e\betrayal\betrayalTestHelpers.ts
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-dead-traitor-burial-no-loot.e2e.ts "死亡叛徒"
```

结果：

- ESLint：0 errors。
- E2E：`1 passed`。

## 截图与肉眼核验

| 顺序 | 截图 | 我实际看到什么 | 验收判断 |
| ---: | --- | --- | --- |
| 1 | `01-灰尘死亡叛徒遗物掩埋不可搜尸.jpg` | 画面处于剧本 3「灰尘」作祟中；当前玩家达里尔·海拉在门厅；同房间死亡叛徒 token 和狂热病患 token 同时可见；底部没有“搜尸”入口，只显示普通交易入口不可用 | 通过：死亡叛徒已经变成狂热病患，遗物未留作可搜刮尸体 |

## 自动断言覆盖

- 灰尘进度条显示剧本 3 / 灰尘。
- 当前玩家是达里尔·海拉，当前房间为门厅。
- 死亡玩家在死亡列表、永久叛徒列表和狂热病患列表中。
- 死亡叛徒尸体 token 与狂热病患 token 同房间展示。
- 死亡叛徒原持有物为空，证明遗物已掩埋而非留在尸体上。
- 底部交易入口不包含“搜尸”，尸体持有牌选择区不存在。
- 全程不生成疾病交换等待态，也没有前端致命错误。

## 不外推边界

- 本证据只证明灰尘剧本下“死亡叛徒变狂热病患后遗物掩埋 + 同房玩家不能搜尸”的真实页面代表链。
- 本证据不证明灰尘非叛徒搜尸链；非叛徒搜尸另见 `evidence/betrayal-the-dust-non-traitor-corpse-loot/e2e-test.md`。
- 本证据不证明兔脚回滚后搜尸 / 掩埋组合、不证明全部死亡来源、不证明特殊搜尸用途，也不证明灰尘全部规则完成。
