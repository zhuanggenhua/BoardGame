# Change: 接入 Smash Up 萌奇金兽人派系玩法

## Why

- 兽人的 12 张卡牌、2 个基地、图集索引和双语文案已经完成静态 intake，但当前运行时没有能力注册、持续效果消费或真实入口证据。
- 兽人同时覆盖持续力量修正、低力量目标摧毁 / 牌库底转移、附着行动保护、计分前特殊响应、基地计分奖励和多步目标选择，正好命中现有 Smash Up 交互、触发器、保护和计分清场合同的未收口范围。
- 需要按对象逐项实现和审计，避免把静态卡面接入误报成兽人派系可玩完成。

## What Changes

- 为兽人 4 张随从接入剑王持续力量、粉碎者天赋入口、重击者目标摧毁和呆瓜兽人行动保护。
- 为兽人 8 张行动接入计分前特殊压制、排名奖励、基地 / 玩家 / 随从多步选择、力量限制牌库底转移、跨宿主附着转移、逐次可选保护和附着行动保护。
- 为要塞、坑洞接入计分奖励和基地范围行动保护。
- 补对象级 L2 测试、每个需要玩家决定的流程的真实入口 E2E、截图审计和 evidence 回写。
- 所有目标、模式、支付物、顺序与是否发动的决策，即使只有一个合法候选，也必须保留真实手动选择。

## Scope

- 本 change 只覆盖 `munchkin_orcs` 的 12 张卡牌和 2 个基地。
- 复用现有 Munchkin 怪物 / 宝藏牌库、Smash Up 保护、力量修正、计分响应和牌库底事件；不重新改写真相源。
- 牧师、勇士和其他 Munchkin 派系不属于本 change 的完成条件。

## Impact

- Affected specs: `smashup-faction-batch-workflow`、`smashup-ability-runtime`、`smashup-ongoing-effect-authoring`。
- Affected code: 兽人能力 owner、统一持续力量 / protection / restriction 注册、计分响应与牌库底转移消费点、兽人静态能力标签及相关测试。
- Affected evidence: `evidence/smashup/munchkin-new-faction-flow-audit-2026-08-01.md` 与兽人真实入口截图。

## Acceptance Boundary

- 只有 12 张兽人卡牌和 2 个基地均有独立 L2 结论，并且每个存在交互或流程态的对象有 L3/L4 结论后，才可把兽人派系标记为对象级完成。
- 未经 proposal approval，不开始兽人运行时代码实现；提案批准前只允许完成设计、规则合同和验证矩阵准备。
- 任一单候选选择被自动吞掉、最终权威状态缺失或截图看不见目标本体，都必须保留 `blocked` / `scoped-debt`，不得升级完成口径。
