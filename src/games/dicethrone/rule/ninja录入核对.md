# Dice Throne 忍者录入核对

> 2026-05-30 重审范围：只审**忍者全部升级技能**，不再沿用旧“代表链通过 = 录入正确”的口径。
>
> 主真相源：
> - `public/assets/i18n/zh-CN/dicethrone/images/ninja/Ablilitycards.png`
> - `temp/ninja-upgrade-crops/goingforward2_precise.png`
> - `temp/ninja-upgrade-crops/slash2_precise2.png`
> - `temp/ninja-upgrade-crops/shadowstep2_precise.png`
> - `temp/ninja-upgrade-crops/smokescreen2.png`
> - `temp/ninja-upgrade-crops/shadowfang2.png`
> - `temp/ninja-upgrade-crops/poisonblade2_precise.png`
> - `temp/ninja-upgrade-crops/deathblossom2_full.png`
> - `temp/ninja-upgrade-crops/blink2_precise.png`
>
> 对照实现：
> - `src/games/dicethrone/heroes/ninja/abilities.ts`
> - `src/games/dicethrone/heroes/ninja/cards.ts`
> - `src/games/dicethrone/domain/customActions/ninja.ts`

## 2026-05-30 当前结论

- `一往无前 II` 和 `刀尖舔血` 是**同一技能的两个分支**。当前代码**不是**这样做的；`GOING_FORWARD_2` 仍是单一路线，属于录入错误，并且连主路线实现也错了。
- 忍者升级技能不是“只有个别数值差一点”，而是多张升级卡都存在**一卡多分支被录成单一路线**的问题。
- 旧文档里凡是写“L3 已测所以升级技能已对齐”的结论，对忍者升级技能都不再成立；E2E 只能证明“当前实现能跑”，不能反证“卡图语义录对了”。

## 升级技能重审矩阵

| 基础技能 | 卡图主路线 | 卡图下挂分支 | 当前实现 | 应有结构 | 结论 |
|---|---|---|---|---|---|
| `一往无前 II` | `4 手里剑`；投 `2` 骰并造成等于点数和的伤害；可重掷其中 `1` 颗；若最终总和 `<=6`，本次攻击变为不可防御 | `刀尖舔血`：`3 手里剑`；投 `1` 骰，造成等于点数的真实伤害 | `GOING_FORWARD_2` 直接复用基础版 `7` 伤害，无投骰、无重掷、无不可防御、无分支 | `going-forward` 应保留基础技能 ID，并在升级版内部新增 `variants`：主路线 + `刀尖舔血` 分支；主路线另需自定义投骰结算 | **录入错 + 实现错** |
| `斩击 II` | `3/4/5 忍刀` 分别造成 `4/6/8` 伤害；若投出 `3` 个相同数字，获得 `1` 忍术 | 无独立下挂分支 | `SLASH_2` 仍写成 `6/7/8`，且缺少“3 同点获得忍术” | 保持 `slash` 基础技能 ID，升级版 `variants` 应改成 `4/6/8`，并补 3 同点附加效果 | **录入错 + 实现错** |
| `暗影步 II` | `4 面具`；获得烟雾弹；施加 `2` 慢性中毒；造成 `5` 不可防御伤害 | `勒杀`：`3 面具`；获得 `3` 忍术；对 `1` 名对手施加 `2` 慢性中毒 | `SHADOW_STEP_2` 写成烟雾弹 + `2` 慢性中毒 + `7` 不可防御伤害；完全缺 `勒杀` | `shadow-step` 升级版应含主路线与 `勒杀` 两个 `variants` | **录入错 + 实现错** |
| `烟雾阵 II` | `1 忍刀 + 2 手里剑 + 1 面具`；`1` 名玩家获得烟雾弹和 `3` 忍术；对 `1` 名对手施加慢性中毒 | `九字切`：`3 手里剑 + 2 面具`；对 `2` 名对手各造成 `4` 真实伤害，可选同一名对手两次 | `SMOKE_SCREEN_2` 只有主路线，缺 `九字切` | `smoke-screen` 升级版应含主路线与 `九字切` 两个 `variants`；`九字切` 还需要目标选择实现 | **录入错 + 实现错** |
| `影牙 II` | 大顺子；获得烟雾弹；获得 `2` 忍术；造成 `8` 伤害 | `诳惑`：`2 忍刀 + 2 面具`；获得烟雾弹；造成 `2` 不可防御伤害 | `SHADOW_FANG_2` 只有 `2` 忍术 + `9` 伤害，缺烟雾弹，也缺 `诳惑` | `shadow-fang` 升级版应含主路线与 `诳惑` 两个 `variants` | **录入错 + 实现错** |
| `毒刃 II` | 小顺子；投 `1` 骰；若投出忍刀则施加 `1` 慢性中毒；若投出手里剑或面具则施加 `2` 慢性中毒；造成 `5` 伤害 | 无独立下挂分支 | `POISON_BLADE_2` 写成 `1` 慢性中毒 + `6` 不可防御伤害 | `poison-blade` 升级版应改成奖励骰分支结算，不应改成固定不可防御 | **录入错 + 实现错** |
| `死亡盛放 II` | `3 忍刀 + 2 手里剑`；投 `5` 骰；造成 `1×忍刀 + 2×手里剑` 伤害；若有 `1` 面具则本次攻击不可防御；若有 `2` 面具则施加慢性中毒；可重掷至多 `2` 颗 | 无独立下挂分支 | `DEATH_BLOSSOM_2` 直接复用基础版；基础版面具效果还是给忍术 | 升级版要换成新的奖励骰合同，不能复用基础版 | **录入错 + 实现错** |
| `瞬身 II` | 防御投掷 `3` 骰；造成 `1×忍刀` 伤害；若投出手里剑，造成 `2` 伤害；若投出 `2` 个面具，获得烟雾弹；可重掷至多 `2` 颗 | 无独立下挂分支 | 2026-06-03 确认旧实现只接了 3 骰与结算，漏了“可重掷至多 2 颗”；现已在 `blink` 防御触发合同中补 `rollLimit: 2`，由 `handleAbilityActivated` 统一消费 | 保持 `blink` 基础技能 ID；升级版通过 `trigger.rollLimit=2` 明确声明共享防御重投窗口，并由真实防御 UI 验证“保留 1 颗、重投另外 2 颗” | **录入基本对、共享实现曾漏；已修复并补合同测试/E2E** |

## 需要立即撤销的旧结论

- 旧文档里关于下列对象的“已对齐 / 已收口 / L3 已证明”结论全部失效：
  - `going-forward-2`
  - `slash-2`
  - `shadow-step-2`
  - `smoke-screen-2`
  - `shadow-fang-2`
  - `poison-blade-2`
  - `death-blossom-2`
- 原因不是“测试没跑”，而是**素材语义本身就录错了**。

## 当前最重要的结构裁定

- `一往无前 II / 刀尖舔血`
  - 这是同一基础技能 `going-forward` 的两个分支。
  - 运行时应是**一个升级卡替换一个基础技能**，升级后的能力定义内部带 `variants`。
  - 不能拆成两张独立升级卡，也不能只保留上半主路线。
- `暗影步 II / 勒杀`
  - 同理，应是 `shadow-step` 升级后的双分支。
- `烟雾阵 II / 九字切`
  - 同理，应是 `smoke-screen` 升级后的双分支。
- `影牙 II / 诳惑`
  - 同理，应是 `shadow-fang` 升级后的双分支。

## 关联证据

- 全量升级重审汇总：`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
