# DiceThrone 火法 Burn 图片标准用户故事

## 用户原始要求

2026-05-12，用户要求重新审计 DiceThrone 火法 Burn，并明确：

- 图片是唯一标准。
- 图片优先于 Wiki。
- 需求要留档。

## 图片真相源

- `public/assets/i18n/zh-CN/dicethrone/images/pyromancer/compressed/tip.webp`

## 看图结论

图中 Burn 区块写明：

- 名称：燃烧
- 类型：负面效果，不可叠加
- 英文提示：Does not stack
- 正文：持续效果。有此标记的玩家在他的每个维持阶段受到 2 伤害。

## 验收口径

- Burn 不应叠加，状态上限应按 1 处理。
- Burn 每个维持阶段固定造成 2 点伤害。
- Burn 不应因维持阶段自动移除。
- UI 文案不得写成“按层数伤害，然后移除 1 层”。
- 施加 Burn 的所有路径不得绕过 stackLimit 写出 2 层以上。

## 关联证据

- `evidence/dicethrone/dicethrone-pyromancer-burn-description-audit-2026-05-12.md`
