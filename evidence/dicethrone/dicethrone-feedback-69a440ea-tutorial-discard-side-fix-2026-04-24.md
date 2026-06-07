# DiceThrone 线上反馈修复：69a440ea（教程弃牌堆方向写反）

> 2026-06-06 当前有效口径：本文只对应反馈 `69a440ea1eb921c6091f1231` 这一条教程文案方向修复记录，不是当前 DiceThrone 全部教程文案、全部多语言说明都已彻底收口的证明，也不是新英雄补审出口。阅读时只能把它当作单条 i18n 文案修复记录。

## 反馈信息
- feedbackId: `69a440ea1eb921c6091f1231`
- gameId: `dicethrone`
- 原始反馈：教程把“右侧弃牌堆”写成了“左侧弃牌堆”。

## 根因
- 中文教程文案已是“右侧弃牌堆”，但英文教程仍保留旧方向描述，导致多语言下口径不一致：
  - `tutorial.steps.sellCardIntro` 使用了 `on the left`
  - `tutorial.steps.undoSellIntro` 使用了 `on the left`

## 修复内容
- 文件：`public/locales/en/game-dicethrone.json`
- 变更：
  - `sellCardIntro`: `on the left` -> `on the right`
  - `undoSellIntro`: `on the left` -> `on the right`

## 验证
- `npm run i18n:check` 通过（`no missing keys detected`）。
- 关键词复核：
  - `public/locales/en/game-dicethrone.json` 中 `sellCardIntro`、`undoSellIntro` 均为 `on the right`
  - `public/locales/zh-CN/game-dicethrone.json` 对应项保持“右侧弃牌堆”

## 结论
- 本条反馈对应的教程方向文案已修正，英文与中文口径一致为“右侧弃牌堆”。

---

**当前阅读说明**：本文只能证明“教程弃牌堆左右方向写反”这条专项文案问题曾被修复，不能外推为当前所有教程步骤、多语言文案或 DiceThrone 当前整体审计都已收口。
