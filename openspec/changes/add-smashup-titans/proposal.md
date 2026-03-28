# Change: 为大杀四方增加官方泰坦机制

## Why
当前仓库对大杀四方泰坦只有零散痕迹：规则文档已经提到“泰坦放在牌库旁”，个别能力也在用 `activeTitan` 之类的临时字段推断泰坦是否存在，但领域模型、命令事件链、计分清场、UI 展示、卡牌数据都没有正式实现。这会导致两类问题：

- 现有涉及“泰坦数量/是否在基地”的代码建立在不存在的正式状态之上，行为不可靠。
- 仓库中已经实现的多个官方派系实际上有对应泰坦，但目前无法按规则游玩。

官方规则还要求泰坦具备和随从/行动都不同的行为：它们是独立牌种，不进入手牌/牌库/弃牌堆，只能在卡牌明确允许时打出，玩家同一时刻最多控制 1 个泰坦，标准基地上发生双泰坦时会触发 clash，计分清场时会回到牌库旁而不是弃牌堆。这些规则都需要一套一等公民的领域建模，不能继续靠 `any` 字段拼接。

## What Changes
- 为大杀四方引入正式的泰坦数据模型、卡牌定义和运行时状态，替代散落的 `activeTitan` 假设。
- 增加泰坦的命令/事件/归约链路，覆盖打出、移动、离场回牌库旁、冲突决胜、指示物与能力使用状态。
- 将泰坦整合进基础流程：选派系后的 set-aside 初始化、基地计分与清场、目标选择、力量计算与得分资格。
- 在 UI 中展示泰坦，并让“可选择任意 card/titan”的效果能正确显示和选择泰坦；己方可用泰坦显示在牌库右侧，在基地上优先显示于持续行动上方一排，没有持续行动时显示于基地上方。
- 明确“可被视作随从打出”是出牌语义而不是牌种变更：某些效果可以把泰坦纳入“选择一个随从打出”的候选，但该卡在运行时仍必须保持 `titan` 类型。
- 为房间创建增加通用的扩展多选配置 UI，由 manifest 声明选项、默认选中、支持标签回显与逐项取消；大杀四方通过该机制默认启用 TITANS 扩展，并允许房主关闭。
- 首批接入仓库中已实现且有官方泰坦的派系数据与能力：
  - 吸血鬼 `Ancient Lord`
  - 巫师 `Arcane Protector`
  - 捣蛋鬼 `Big Funny Giant`
  - 幽灵 `Creampuff Man`
  - 克苏鲁仆从 `Cthulhu`
  - 印斯茅斯 `Dagon`
  - 巨蚁 `Death on Six Legs`
  - 狼人 `Great Wolf Spirit`
  - 熊骑兵 `Major Ursa`
  - 海盗 `The Kraken`
- 同步更新大杀四方规则文档，明确本项目对泰坦的实现范围和通用规则。

## Out of Scope
- Big in Japan 四个新派系本身的完整实现。
- 目前仓库尚未实现的 TITANS Event Kit 其它派系泰坦。
- 与泰坦无关的旧规则清理或全面平衡性重做。

## Impact
- 影响 specs: 新增 `smashup-titans`
- 影响代码：
  - `src/games/manifest.types.ts`
  - `src/components/lobby/CreateRoomModal.tsx`
  - `src/components/lobby/GameDetailsModal.tsx`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/events.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/manifest.ts`
  - `src/games/smashup/domain/abilityHelpers.ts`
  - `src/games/smashup/domain/ongoingModifiers.ts`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/data/factions/*.ts`
  - `src/games/smashup/ui/*`
  - `src/games/smashup/__tests__/*`
  - `e2e/*smashup*`
  - `src/games/smashup/rule/*.md`
- 风险：
  - 泰坦会触及力量计算、计分资格、基地清场、目标选择这几条核心链路。
  - 当前已有的“假泰坦”引用必须一次性收敛，否则会形成双轨状态。
