# SmashUp：尸体商店句号分句裁定（2026-05-23）

## 用户原始要求

- 用户明确要求：`它是句号，不是必须消灭成功哦`

## 覆盖对象

- 游戏：`smashup`
- 卡牌：`frankenstein_body_shop`、`frankenstein_body_shop_pod`
- 相关交互：
  - `frankenstein_body_shop`
  - `frankenstein_body_shop_distribute`
  - 与第一句“消灭”发生替代/防止/改为移动的链路（如 `giant_ant_drone_prevent_destroy`、`pirate_buccaneer_move`）

## 覆盖原因

- 当前实现把第二句“放置等同于该随从力量的 +1 力量指示物到你的随从上，你可以任意分配它们”错误绑定到“第一句最终成功消灭”。
- 用户明确裁定：这里是两个句号分开的效果；在没有 `if you do / 若如此 / 以此法 / 然后若其被如此消灭` 等显式依赖词时，不能默认第二句必须等第一句成功。

## 实现口径

- `尸体商店` 选定目标并尝试执行第一句后，第二句仍应独立结算。
- 若第一句被替代为“防止消灭”“改为移动”“返回”等，只要本次目标与力量快照已成立，第二句仍按该目标力量数继续分配。
- 第二句的分配目标仍遵循原有限制：分配到“你的其他随从”。

## 验收标准

- 选择 `pirate_buccaneer`（4 力量）作为目标时：
  - 先出现 `pirate_buccaneer_move`
  - 完成移动后仍进入 `frankenstein_body_shop_distribute`
  - 最终可完成 4 次分配
- 选择会触发 `giant_ant_drone_prevent_destroy` 的目标时：
  - 选择防止消灭后，目标仍留场
  - 仍进入 `frankenstein_body_shop_distribute`
  - 分配数量按目标力量继续结算

## 不覆盖范围

- 本文不改写其他卡牌的一般性规则；仅约束 `尸体商店` 及后续审计时对“句号分句是否引入隐式 if-you-do”的判断。
