# 大杀四方反馈修复：疯人院 / 修格斯 / 疯狂牌时序（2026-04-14)

- 反馈 ID：`69dbb91ee92e3f88b78cec62`
- 冲突键：`smashup::madness-hand-timing`
- 关联反馈 ID：`69dbb827e92e3f88b78cec60`
- 关联冲突键：`smashup::madness-remove-from-game`
- 结论：**已修复。修格斯结算后补抓的两张疯狂牌，会先进入手牌，再被疯人院基地效果看到并可被选中放入盒子。**

## 用户反馈要点

1. 修格斯效果后补的两张疯狂牌，是否会在疯人院基地效果之前就算作手牌。
2. 疯人院移除手牌时，本应可以选择疯狂牌，但实际选不到。

## 根因

问题不在疯人院的选项过滤本身，而在**交互解决后的 reaction queue 结算时机**：

- 修格斯交互处理器先产生 `MADNESS_DRAWN` 事件；
- 但 `createSmashUpEventSystem` 旧逻辑会在这些领域事件还没 reduce 进 `core` 之前，就提前调用 `maybeResolveReactionQueue(...)`；
- 结果导致排队中的 `base_the_asylum` 触发器看见的还是“抽牌前”的旧手牌快照；
- 疯人院因此被消费掉，但没有把新抽到的疯狂牌列进可选手牌。

## 修复

修改文件：`src/games/smashup/domain/systems.ts`

- 当交互处理器刚产出新的领域事件（`nextEvents.length > 0`）时，不再在同一轮 `afterEvents` 里立刻解析 reaction queue；
- 改为等这些事件先经 pipeline reduce 进最新 `core`，再在下一轮 afterEvents 里解析 reaction queue；
- 这样疯人院看到的就是“修格斯已补抓疯狂牌后”的最新手牌。

## 回归验证

### 1. 集成测试：修格斯 → 自抽疯狂 → 疯人院选牌

命令：

`npx vitest run src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts -t "修格斯打到疯人院后，自抽的疯狂卡应先进入手牌，再出现在疯人院选择里"`

结果：通过。

验证点：

- 场景改成基地已有 5 点己方战力，确保修格斯结算后总战力为 11，满足“少于 12”自抽 2 张疯狂牌；
- 对手响应“抽一张疯狂卡”后，玩家 0 的手牌中确实已有 2 张疯狂牌；
- 随后弹出的 `base_the_asylum` 交互里，确实能看到这 2 张疯狂牌作为可选项。

### 2. Elder Things 既有行为未回归

命令：

`npx vitest run src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts -t "base_the_asylum|Shoggoth POD"`

结果：通过。

覆盖点：

- 修格斯原有交互链仍可正常工作；
- 疯人院基础交互处理器仍能正常生成“选手牌 → 选随从”的链式交互。

## 对两条反馈的收口说明

### 反馈 69dbb91ee92e3f88b78cec62
现在可以确认：

- 修格斯后补的两张疯狂牌，会在疯人院基地效果执行前先进入手牌；
- 疯人院随后读取到的是最新手牌，而不是旧快照。

### 反馈 69dbb827e92e3f88b78cec60
现在可以确认：

- 疯人院并没有业务规则禁止选疯狂牌；
- 之前“选不到疯狂牌”是因为 reaction queue 提前结算，看到了抽牌前手牌；
- 修复后，后补进入手牌的疯狂牌会正常出现在疯人院可选列表中，并可继续进入后续“放置 +1 指示物”的流程。
