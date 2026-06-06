# Change: 幻想国度官方计分引擎

## Why
- `fantasyrealms` 当前已经具备双人变体核心回合和官方 53 张基础卡表，但分数仍只是“基础分预估”，没有真实实现官方计分语义。
- 这会直接卡住两个核心结果：一是玩家无法围绕真实组合做决策；二是双人结束态无法裁出官方胜者。
- 规则真相源已经明确给出计分顺序与关键 FAQ：野牌变身、`Book of Changes` 改花色、各类 `Clears` 解罚、封印/减分结算顺序，以及平分时按总基础分更低者获胜。

## What Changes
- 新增 `fantasyrealms-scoring` capability，正式定义当前版本的官方计分引擎。
- 在领域层实现官方计分求值，包括：
  - 53 张基础卡的正式加分/减分/封印语义
  - 野牌 (`Shapeshifter / Mirage / Doppelganger`) 变身求值
  - `Book of Changes` 改花色求值
  - `Clears` / 解罚先于封印与减分生效
  - `Necromancer` 终局取弃牌堆第 8 张牌求值
- 在双人结束态返回正式胜者或平局，并携带最终分数。
- 更新 Board，把当前“基础分预估 / 正式官方计分待后续 change”改成真实官方计分展示。

## Impact
- Affected specs:
  - 新增 `fantasyrealms-scoring`
- Affected code:
  - `src/games/fantasyrealms/domain/**`
  - `src/games/fantasyrealms/Board.tsx`
  - `src/games/fantasyrealms/__tests__/**`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/**`

## Scope Notes
- 本 change 目标是把当前官方基础卡表真正变成可结算的游戏系统，而不是继续停留在“有牌库、能抽弃、不能算分”。
- 当前仍不覆盖多人基础版（3~6 人）的正式流程切换；本轮只在已有双人 runtime 上实现官方计分与胜者裁定。
