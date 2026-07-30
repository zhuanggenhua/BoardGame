# 烈火术士点燃 II / 炙热之魂反馈复核（2026-07-29）

## 原始反馈

- 反馈内容：`火焰术士技能引燃II下面的技能炙热之魂投出相应点数发动不了`
- 命中对象：烈火术士 `点燃 II` 下半段 `炙热之魂`
- 反馈骰面：`[4,4,5,4,5]`，按烈火术士骰面为 `3 岩浆 + 2 火魂`

## 真相源

- 主图源：`public/assets/i18n/zh-CN/dicethrone/images/pyromancer/compressed/ability-cards.webp`
- 本轮临时裁图：
  - 索引图：`temp/dicethrone-intake/pyromancer/ability-card-slots-10x8/contact-10x8-indexed.png`
  - `燃烧之灵 II`：`temp/dicethrone-intake/pyromancer/ability-card-slots-10x8/r0c9-slot-09-x4.png`
  - `点燃 II / 炙热之魂`：`temp/dicethrone-intake/pyromancer/key-crops/ignite-2-col0-extended-y512-1120-x6.png`
- 对照源：历史项目记录、旧 wiki snapshot、旧 locale 只能作为冲突线索；本轮规则裁定以中文正式图集为准。

## 图面结论

| 对象 | 图面位置 | 图面结论 | 合同状态 |
| --- | --- | --- | --- |
| 燃烧之灵 II | 图集 10x8 `0,9` / atlas index 9 | 2/3/4 火魂阶梯；3 火魂额外施加灼烧；4 火魂额外提升火焰精通堆叠上限；获得 `2 × 火魂数` 火焰精通，并对所有对手造成 `1 × 火魂数` 附属伤害。图面没有“炙热之魂”分支。 | locked |
| 点燃 II | 图集 10x8 `1,0` / atlas index 10 | 大顺子：获得 2 火焰精通、施加灼烧，然后造成 `5 + 每有 1 火焰精通造成 2 伤害`。 | locked |
| 炙热之魂 | 点燃 II 下半张 | 触发条件为 `2 岩浆 + 2 火魂`；效果为火焰精通堆叠上限提升 1、获得 5 火焰精通、施加灼烧。 | locked |

## 实现对照

- `src/games/dicethrone/heroes/pyromancer/abilities.ts`：
  - `IGNITE_2` 保留 `heat-of-soul` 分支；
  - `heat-of-soul` 触发为 `{ magma: 2, fiery_soul: 2 }`；
  - 效果走 `ignite-heat-of-soul-resolve`。
- `src/games/dicethrone/domain/customActions/pyromancer.ts`：
  - `ignite-heat-of-soul-resolve` 提升火焰精通上限、授予 5 火焰精通、给对手施加灼烧。
- `public/locales/zh-CN/game-dicethrone.json` 与 `public/locales/en/game-dicethrone.json`：
  - `炙热之魂 / Heat of Soul` 描述为 `2 岩浆 + 2 火魂` 触发；
  - 不再把该分支写入 `燃烧之灵 II`。

## 旧记录裁定

- 旧项目记录中“`Burning Soul II` 包含 `Blazing Soul` / 施加击倒 / 5 火魂”的说法与本轮正式图面冲突。
- 这些记录只能保留为历史失信对照，不能作为本轮规则真相或测试期望。

## 验证位点

- `src/games/dicethrone/__tests__/pyromancer-upgrade-logic.test.ts`：校验 `点燃 II` 升级后保留 `炙热之魂`，触发条件为 `2 岩浆 + 2 火魂`。
- `src/games/dicethrone/__tests__/pyromancer-hot-streak-2-bug.test.ts`：校验玩家反馈骰面可触发 `heat-of-soul`，旧的 `2 火 + 2 火魂` 不再触发。
- `src/games/dicethrone/__tests__/pyromancer-behavior.test.ts`：校验 `ignite-heat-of-soul-resolve` 的实际效果。
