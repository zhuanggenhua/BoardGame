# DiceThrone Ninja 主阶段行动卡真实手牌 E2E（2026-05-17）

## 范围与结论

本证据只覆盖 Ninja 三张主阶段专属行动卡的真实手牌入口：

- `ninja-card-training` / 训练
- `ninja-card-poison-dart` / 毒镖
- `ninja-card-knife-fan` / 刀扇

结论：三张卡均已从真实在线对局手牌区通过拖拽打出，并验证手牌消耗、CP 消耗和权威状态写入。该结论不能外推到 Ninja 升级卡或基础/升级技能本体。

## 执行命令

```powershell
npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算"
```

结果：2026-05-17 实测 `1 passed`。

## 截图与肉眼观察

### 训练

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\01-training-before-drag.png`

观察：

- 真实 Ninja 玩家板与手牌区可见，不是独立预览页。
- 手牌中可见 `训练！` 卡牌本体，处于主阶段，CP 为 3。
- E2E 同时断言该手牌 DOM `data-can-drag="true"`，避免只可见但不可打的假阳性。

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\02-training-after-play-ninjutsu.png`

观察：

- `训练！` 已离开手牌并进入右侧弃牌/已打出区域。
- 左侧状态区可见忍术 token，画面反馈与断言 `ninjutsu=1` 一致。
- CP 仍为 3，符合 0CP 主阶段行动卡。

### 毒镖

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\03-poison-dart-before-drag.png`

观察：

- 手牌中可见 `毒镖！` 卡牌本体，CP 为 3。
- E2E 同时断言该手牌可拖拽。

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\04-poison-dart-after-play-delayed-poison.png`

观察：

- `毒镖！` 已离开手牌并进入右侧弃牌/已打出区域。
- 顶部 Treant 状态区可见慢性中毒图标，数量反馈为 2。
- CP 从 3 降到 1，断言同时证明对手 `delayed_poison=2`、手牌为 0。

### 刀扇

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\05-knife-fan-before-drag.png`

观察：

- 手牌中可见 `刀扇！` 卡牌本体，文本显示对手受到 1 点不可防御伤害。
- E2E 同时断言该手牌可拖拽，且测试仍复用既有合同测试覆盖 `offensiveRoll` 阶段不可作为攻击修正打出。

截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\06-knife-fan-after-play-direct-damage.png`

观察：

- `刀扇！` 已离开手牌并进入右侧弃牌/已打出区域。
- 顶部 Treant 生命从 30 变为 29，符合 1 点直接不可防御伤害。
- CP 从 3 降到 1，断言同时证明手牌为 0 且 `pendingDamage` 未打开。

## Completion audit

| 对象 | L3 入口 | 主效果 | 消耗/清理 | 结论 |
| --- | --- | --- | --- | --- |
| `ninja-card-training` | 主阶段真实手牌可拖拽并打出 | `ninjutsu=1` | 0CP，手牌清空 | 通过 |
| `ninja-card-poison-dart` | 主阶段真实手牌可拖拽并打出 | 对手 `delayed_poison=2` | CP 3->1，手牌清空 | 通过 |
| `ninja-card-knife-fan` | 主阶段真实手牌可拖拽并打出 | 对手 HP 30->29 | CP 3->1，手牌清空，`pendingDamage` 未打开 | 通过 |

残余范围：

- Ninja 升级卡真实手牌 L3 已另见 `evidence/dicethrone/dicethrone-ninja-upgrade-real-hand-e2e-2026-05-17.md`；升级后技能本体所有骰面/分支仍不能由本文件外推。
- Ninja 多个基础/升级技能本体仍只有静态/代表链证据，不能宣称 Ninja 全量完成。
- `smoke_bomb` 失败骰面分支已另见 `evidence/dicethrone/dicethrone-ninja-smoke-bomb-failure-e2e-2026-05-17.md`；该 token 分支证据不改变本文件只覆盖三张主阶段行动卡的范围。
