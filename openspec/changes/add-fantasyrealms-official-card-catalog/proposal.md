# Change: 幻想国度官方基础卡表接入

## Why
- `fantasyrealms` 的双人变体 runtime 已经切到真实牌库，但当前官方 53 张基础卡只是先落在 `src/games/fantasyrealms/data/cards.ts` 里，缺少正式的 OpenSpec capability、真相源合同和定向验证。
- 这会让后续完整计分、野牌变身、中文文案补录时缺少稳定数据底座，也违反了项目数据录入规范里“先建契约，后写代码”的基本门禁。
- 当前仓库内已经有明确真相源：`temp/新游戏幻想国度/Fantasy_Realms_Cards.xlsx` 与 `temp/新游戏幻想国度/规则.txt`。这一步应该先把基础卡表层收口，而不是把“已接入代码”误表述成“完整官方玩法已完成”。

## What Changes
- 新增 `fantasyrealms-card-catalog` capability，正式定义幻想国度基础卡表层的边界。
- 为 53 张基础卡补正式录入合同文档，明确：
  - 主真相源与对照源
  - `Suit / Name / Value / Text` 到运行时字段的映射
  - 英文花色到中文花色的固定映射
  - `id` 的确定性生成口径
  - 当前未完成项：逐卡中文卡名、逐卡中文效果文案、完整官方计分语义
- 用定向测试锁住官方卡表的关键不变量：
  - 总数 53
  - `id` 唯一
  - 11 个花色分布正确
  - `createRuntimeDeck()` 返回克隆对象，不污染静态源数据
- 同步修正文档口径，避免继续把“完整 53 张正式卡数据仍未实现”写成当前状态。

## Impact
- Affected specs:
  - 新增 `fantasyrealms-card-catalog`
- Affected code:
  - `src/games/fantasyrealms/data/cards.ts`
  - `src/games/fantasyrealms/foundation.ts`
  - `src/games/fantasyrealms/__tests__/**`
  - `src/games/fantasyrealms/rule/**`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/**`

## Scope Notes
- 本 change 只收口“官方基础卡表层”，不在这一轮实现：
  - 完整官方计分引擎
  - 野牌变身与 `Book of Changes` 的正式语义
  - 双人结束后的胜者裁定
  - 逐卡中文卡名 / 中文效果文案
- 本 change 的交付标准是：`fantasyrealms` 的运行时牌库已经建立在可追溯、可验证、可继续扩展的官方基础卡表合同之上。
