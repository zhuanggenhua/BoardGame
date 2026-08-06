## Context

牧师静态数据已经存在，玩法实现应沿用现有 Munchkin 与 Smash Up 共享能力，不新增平行规则引擎。高风险点集中在计分后清场替代、附着行动持续效果、临时力量修正、随机弃牌堆回收和从其他玩家弃牌堆暂借行动。

## Goals / Non-Goals

- Goals: 逐对象接入牧师 12 张卡牌与 2 个基地，保留显式玩家选择，证明最终手牌、牌库、弃牌堆、基地仆从、力量合计和触发队列状态。
- Non-Goals: 不重做公共怪物 / 宝藏机制，不把其他 Munchkin 派系的未完成状态一起收口，不新增独立 UI 壳层。

## Decisions

- 牧师能力单独放在 `munchkin_clerics.ts`；注册入口仍由 `munchkin.ts` 统一调用。
- 优先复用现有 `createSimpleChoice`、`queueInteraction`、`registerTrigger`、`registerProtection`、`registerPowerModifier`、after-scoring 清场和牌库事件 helper。
- 任何随机选择只由领域随机源执行；任何玩家决定都用显式 interaction，设置 `autoResolveIfSingle: false`。
- 需要展示其他玩家弃牌堆行动的能力，先建立临时展示 / 选择链，再把未使用牌按原拥有者返回，不能复制到当前玩家弃牌堆。

## Risks / Trade-offs

- 计分后移动代替弃牌会与既有清场队列耦合，必须同时验证触发顺序和附着行动去向。
- “失去能力”和“不计入基地力量”分别属于能力压制与力量合计消费合同，不能用一个通用布尔标记替代两套语义。
- 随机回收类效果的数量不足边界需要按牌面和现有牌库事件合同核对，测试不能只覆盖满数量成功路径。

## Migration Plan

1. 先实现四张随从，补注册、标签和 L2 测试。
2. 再实现八张行动与两个基地，逐对象补 L2。
3. 选择至少一条新的牧师交互链补真实入口 E2E，按对象矩阵补齐其余 L3/L4 或登记残余。
4. 回写牧师 evidence，不改变其他派系的完成结论。
