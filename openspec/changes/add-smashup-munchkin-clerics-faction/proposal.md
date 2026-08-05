# Change: 接入 Smash Up 萌奇金牧师派系玩法

## Why

- 新 6 扩“新小白”中的牧师已经完成卡牌、基地、图片索引与双语文案的静态 intake，但 12 张卡牌和 2 个基地仍没有完整玩法实现。
- 牧师引入弃牌堆随机回收、计分后替代清场、亡灵怪物处理、附着行动压制、临时力量修正等多条既有引擎未逐对象核销的能力链。
- 需要把这些能力接入现有 Smash Up 共享交互、触发器、持续修正和计分清场合同，并用领域测试、真实入口 E2E 与截图审计证明玩家选择不会被单候选自动吞掉。

## What Changes

- 为牧师 4 张随从接入天赋、计分后特殊和亡灵怪物 / 弃牌堆回收能力。
- 为牧师 8 张行动接入基地持续、弃牌堆回收、附着行动、力量修正、附着行动摧毁和跨玩家行动临时选择链。
- 为圣洁酒店、抓鬼接入计分后清场替代、怪物分类与怪物牌库底处理。
- 补齐牧师对象级 L2 行为测试、至少一条新的真实入口交互 E2E、截图图面审计和 evidence 回写。
- 所有需要玩家选择的对象、目标、模式、顺序或是否发动的步骤，即使只有一个合法候选，也保留真实手动选择和确认。

## Scope

- 本 change 只覆盖 `munchkin_clerics`，不把牧师代表链外推为 Munchkin 整批完成。
- 既有静态数据、atlas、locale 和公共怪物 / 宝藏基础机制作为前置输入复用，不重新改写其真相源。
- 盗贼、法师、木精灵、兽人、勇士与 Munchkin 批次统一收口不属于本 change 的完成条件。

## Impact

- Affected specs: `smashup-faction-batch-workflow`、`smashup-ability-runtime`、`smashup-ongoing-effect-authoring`。
- Affected code: `src/games/smashup/abilities/munchkin_clerics.ts`、`src/games/smashup/abilities/munchkin.ts`、牧师静态能力标签、Smash Up 能力 / 持续效果共享消费点及相关测试。
- Affected evidence: `evidence/smashup/munchkin-new-faction-flow-audit-2026-08-01.md` 与牧师真实入口截图。

## Acceptance Boundary

- 只有 12 张牧师卡牌和 2 个基地逐对象完成 L2，并且每个存在交互或流程态的对象有 L3/L4 结论后，才可把牧师派系标记为对象级完成。
- 若某张牌仍缺少真实入口、最终权威状态或负向路径证据，必须在 evidence 中标记 `blocked` 或 `scoped-debt`，不得写成牧师派系完成。
