# DiceThrone Ninja 升级卡真实手牌 E2E（2026-05-17）

> 2026-06-05 当前有效口径：本文只证明 8 张 Ninja 升级卡的真实手牌打出与替换合同成立，不代表升级后每个技能本体的当前对象级 `L3/L4` 已经在本文内完成。Ninja 升级技能家族的当前有效结论，应继续以 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/ninja录入核对.md` 的最新矩阵为准。

## 范围与结论

本证据覆盖 Ninja 8 张升级卡的真实手牌入口：

- `upgrade-blink-2`
- `upgrade-going-forward-2`
- `upgrade-slash-2`
- `upgrade-shadow-step-2`
- `upgrade-smoke-screen-2`
- `upgrade-shadow-fang-2`
- `upgrade-poison-blade-2`
- `upgrade-death-blossom-2`

结论：8 张升级卡均已从真实在线对局手牌区通过拖拽打出，并验证 CP、手牌、`abilityLevels` 与 `upgradeCardByAbilityId` 写入。该结论只证明升级卡打出与替换合同成立，不证明升级后每个技能本体的所有骰面/分支都已逐技能 L3。

## 执行命令

```powershell
npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者升级卡应通过真实手牌逐张升级到正确技能"
```

结果：2026-05-17 实测 `1 passed`。

## 断言覆盖

每张升级卡都在独立重置后的 Ninja 初始基线状态中执行：

- 主阶段手牌区存在目标升级卡。
- 目标手牌 DOM `data-can-drag="true"`。
- 拖拽打出后 CP 从 5 变为 3。
- 手牌清空。
- `abilityLevels[abilityId]` 变为 2。
- `upgradeCardByAbilityId[abilityId].cardId` 等于本次打出的升级卡 ID。

## 截图与肉眼观察

| 对象 | 截图 | 观察 |
| --- | --- | --- |
| `upgrade-blink-2` before | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\01-upgrade-blink-2-before-drag.png` | 真实 Ninja 主阶段界面中可见 `瞬身 II` 手牌本体，CP 为 5。 |
| `upgrade-blink-2` after | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\01-upgrade-blink-2-after-play.png` | 手牌已消耗，CP 为 3，右下防御技能位可见 `瞬身 II` 升级卡叠层。 |
| `upgrade-going-forward-2` after | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\02-upgrade-going-forward-2-after-play.png` | 断言证明 `going-forward` 等级为 2、CP 为 3、手牌为 0；截图保留真实玩家板升级后状态。 |
| `upgrade-slash-2` after | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\03-upgrade-slash-2-after-play.png` | 断言证明 `slash` 等级为 2、CP 为 3、手牌为 0；截图保留真实玩家板升级后状态。 |
| `upgrade-shadow-step-2` after | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\04-upgrade-shadow-step-2-after-play.png` | 真实玩家板中可见多张已替换技能卡图，CP 为 3；断言证明 `shadow-step` 等级为 2 且手牌清空。 |
| `upgrade-smoke-screen-2` after | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\05-upgrade-smoke-screen-2-after-play.png` | 断言证明 `smoke-screen` 等级为 2、CP 为 3、手牌为 0；截图保留真实玩家板升级后状态。 |
| `upgrade-shadow-fang-2` after | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\06-upgrade-shadow-fang-2-after-play.png` | 断言证明 `shadow-fang` 等级为 2、CP 为 3、手牌为 0；截图保留真实玩家板升级后状态。 |
| `upgrade-poison-blade-2` after | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\07-upgrade-poison-blade-2-after-play.png` | 断言证明 `poison-blade` 等级为 2、CP 为 3、手牌为 0；截图保留真实玩家板升级后状态。 |
| `upgrade-death-blossom-2` after | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\08-upgrade-death-blossom-2-after-play.png` | 真实玩家板中可见 `死亡盛放 II` 升级卡图，CP 为 3；断言证明 `death-blossom` 等级为 2 且手牌清空。 |

## Completion audit

| 对象 | 目标技能 | L3 入口 | 状态结论 |
| --- | --- | --- | --- |
| `upgrade-blink-2` | `blink` | 真实手牌可拖拽并打出 | `abilityLevels.blink=2` |
| `upgrade-going-forward-2` | `going-forward` | 真实手牌可拖拽并打出 | `abilityLevels.going-forward=2` |
| `upgrade-slash-2` | `slash` | 真实手牌可拖拽并打出 | `abilityLevels.slash=2` |
| `upgrade-shadow-step-2` | `shadow-step` | 真实手牌可拖拽并打出 | `abilityLevels.shadow-step=2` |
| `upgrade-smoke-screen-2` | `smoke-screen` | 真实手牌可拖拽并打出 | `abilityLevels.smoke-screen=2` |
| `upgrade-shadow-fang-2` | `shadow-fang` | 真实手牌可拖拽并打出 | `abilityLevels.shadow-fang=2` |
| `upgrade-poison-blade-2` | `poison-blade` | 真实手牌可拖拽并打出 | `abilityLevels.poison-blade=2` |
| `upgrade-death-blossom-2` | `death-blossom` | 真实手牌可拖拽并打出 | `abilityLevels.death-blossom=2` |

历史边界与当前阅读门禁：

- 本文件只证明升级卡真实手牌打出和替换合同。Ninja 升级技能对象级 L3 与关键 L4 的当前有效结论，应以 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/ninja录入核对.md` 的最新矩阵为准；不得继续把本文件单独读成“升级技能本体仍普遍缺 L3”。
- `smoke_bomb` 失败骰面分支已另见 `evidence/dicethrone/dicethrone-ninja-smoke-bomb-failure-e2e-2026-05-17.md`；该 token 分支证据不证明升级后每个技能本体都已逐技能 L3。
