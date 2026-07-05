# DiceThrone 全角色卡牌类型与时机重审

> 日期：2026-07-05  
> 目标：重审 DiceThrone 所有已接入角色的专属卡牌类型、使用时机与 ability-cards 图集索引，重点防止“红色即时牌被误录成主阶段牌”以及“索引越界后运行时取模显示错卡面”回归。

## 范围

| 范围 | 数量 | 结果 |
| --- | ---: | --- |
| 运行时卡牌条目（含各角色通用牌副本） | 428 | 已导出 |
| 专属卡牌 | 194 | 已全部生成轻量裁图并采样 |
| 专属卡牌未定位图面 | 0 | 已清零 |
| 类型/时机强疑似项 | 0 | 已清零 |
| 图集索引警告 | 0 | 已清零 |

逐角色专属卡数量：

| 角色 | 专属卡数量 |
| --- | ---: |
| 工匠 | 15 |
| 野蛮人 | 15 |
| 咒缚海盗 | 16 |
| 枪手 | 14 |
| 武僧 | 15 |
| 月精灵 | 15 |
| 忍者 | 15 |
| 圣骑士 | 15 |
| 炎术士 | 15 |
| 武士 | 14 |
| 影贼 | 15 |
| 树精 | 15 |
| 战术家 | 15 |

## 真相源

| 类型 | 路径 |
| --- | --- |
| 运行时卡牌数据 | `src/games/dicethrone/heroes/*/cards.ts` |
| 通用牌索引 | `src/games/dicethrone/domain/commonCards.ts` |
| 正式图集注册 | `src/games/dicethrone/ui/cardAtlas.ts` |
| 正式卡图 | `public/assets/i18n/zh-CN/dicethrone/images/*/compressed/ability-cards.webp` |
| 正式图集配置 | `src/assets/atlas-configs/dicethrone/ability-cards*.atlas.json` |
| 本轮导出表 | `temp/dicethrone-intake/audit/all-hero-card-timing/runtime-audit-hero-card-type-timing.tsv` |
| 本轮轻量裁图 | `temp/dicethrone-intake/audit/all-hero-card-timing/crops/` |

## 结论

1. **红色即时牌回归**：全角色专属卡重新导出后，未再发现新的“疑似红色牌但运行时不是即时”的强疑似项。工匠 `这玩意儿真棒！` 与 `万能电流！` 当前均为 `action / instant`。
2. **响应型升级牌例外**：工匠 `电弧盾（upgrade-artificer-shock-bot-2）` 是受击响应型升级牌，合同为 `upgrade / instant`，不是类型/时机错误。
3. **发现并修复的真实问题**：忍者/树精新规格图集只有 0-34 共 35 个 frame，但实现里存在 35/36/37 越界索引。运行时逐帧图集会对越界索引取模，导致显示错卡面。

## 修复项

| 对象 | 修复前 | 修复后 | 现实影响 |
| --- | --- | --- | --- |
| 忍者 `雾隐（ninja-card-vanish）` | slot 35 | slot 30 | 防止运行时取模显示为错误卡图 |
| 忍者 `道场（ninja-card-dojo）` | slot 36 | slot 31 | 防止运行时取模显示为错误卡图 |
| 树精/忍者通用牌 `意不意外?!（card-unexpected）` | slot 37 | slot 32 | 防止新规格图集通用牌显示为错误卡图 |

同步更新：

| 文件 | 内容 |
| --- | --- |
| `src/games/dicethrone/heroes/ninja/cards.ts` | 修正 `雾隐`、`道场` 图集索引 |
| `src/games/dicethrone/domain/commonCards.ts` | 修正树精/忍者 `card-unexpected` 通用牌索引 |
| `src/games/dicethrone/rule/ninja真相源表.md` | 回写忍者槽位合同 |
| `src/games/dicethrone/rule/treant真相源表.md` | 回写树精通用牌槽位合同 |
| `src/games/dicethrone/__tests__/treant-ninja-intake.test.ts` | 新增忍者 `雾隐` / `道场` 槽位断言，并更新 `card-unexpected` 断言 |
| `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` | 更新共享新规格索引断言 |

## 审计脚本结果

命令：

```powershell
npx tsx temp/dicethrone-intake/audit/all-hero-card-timing/audit-all-heroes.mts
```

输出：

```text
cards=428
heroSpecific=194
heroSpecificWithCrop=194
heroSpecificUnread=0
suspiciousHeroSpecific=0
warnings=0
```

## 残余口径

- 本文只证明“卡牌类型 / 使用时机 / ability-cards 图集索引”这一层的全角色重审结果。
- 本文不等于每张卡的完整机制 L4 审计；涉及奖励骰、响应窗口、技能结算、最终血量/token/状态的对象仍以各自机制审计和 E2E 证据为准。
- 武僧 `连段冲拳②` 的结算正确性属于技能机制链，不属于本文件的卡牌类型/时机矩阵；需要继续按技能使用时状态、使用后权威状态和真实入口 E2E 单独收口。
