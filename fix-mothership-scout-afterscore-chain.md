# Bug 修复：母舰 + 侦察兵 afterScoring 交互链断裂

## 问题描述

用户报告：母舰基地计分后，选择收回另一个随从（不是侦察兵），侦察兵的 afterScoring 交互没有弹出。

## 根本原因

当多个 afterScoring 交互被创建时（基地能力 + 随从 trigger），`_deferredPostScoringEvents`（延迟的 BASE_CLEARED 事件）只被存到**最后一个交互**中。

### 问题流程

1. 母舰基地计分，触发两个 afterScoring 能力：
   - 母舰基地能力：冠军可以收回力量≤3的随从 → 创建交互 A
   - 侦察兵 trigger：可以返回手牌 → 创建交互 B

2. `scoreBase` 函数中的代码（第 370 行）：
   ```typescript
   const interaction = ms!.sys.interaction!.current ?? ms!.sys.interaction!.queue[ms!.sys.interaction!.queue.length - 1];
   ```
   **取最后一个交互（B），把 `_deferredPostScoringEvents` 存到 B 中**

3. 交互 A（母舰）解决时：
   - 没有 `_deferredPostScoringEvents`
   - 无法传递给下一个交互
   - BASE_CLEARED 提前执行，侦察兵被清除

4. 交互 B（侦察兵）弹出时：
   - 侦察兵已经不在基地上了
   - 交互无法正常工作

## 修复方案

将 `_deferredPostScoringEvents` 存到**第一个交互**中，而不是最后一个：

```typescript
// 【修复】如果有多个 afterScoring 交互（如母舰 + 侦察兵），必须存到第一个交互中
// 这样第一个交互解决时会传递给下一个，最后一个解决时才会补发 BASE_CLEARED
const firstInteraction = ms!.sys.interaction!.current ?? ms!.sys.interaction!.queue[0];
```

### 修复后的流程

1. `_deferredPostScoringEvents` 存到交互 A（母舰）中
2. 交互 A 解决时，`systems.ts` 中的逻辑检测到还有后续交互（B）
3. 将 `_deferredPostScoringEvents` 传递给交互 B
4. 交互 B 解决时，没有后续交互了，补发 BASE_CLEARED
5. 侦察兵在交互 B 期间仍然在基地上，可以正常选择是否返回手牌

## 修改文件

- `src/games/smashup/domain/index.ts` 第 370 行

## 测试验证

创建了测试文件 `src/games/smashup/__tests__/mothership-scout-afterscore-bug.test.ts`，包含两个测试：

### 测试1：基础场景（2个交互）
- 母舰 + 1个侦察兵
- 验证交互链式传递和 BASE_CLEARED 延迟

### 测试2：复杂场景（4个交互）
- 母舰 + 2个侦察兵 + 1个大副
- 验证多个交互的完整链式传递：
  1. 母舰交互：收回弱随从，传递 `_deferredPostScoringEvents` 给侦察兵1
  2. 侦察兵1交互：返回手牌，传递给侦察兵2
  3. 侦察兵2交互：留在基地，传递给大副
  4. 大副交互：移动到其他基地，最后补发 BASE_CLEARED
- 验证所有随从在交互期间都在基地上
- 验证最终状态：侦察兵1在手牌，侦察兵2在弃牌堆，大副在新基地

**如果这个复杂场景通过，其他所有多交互场景都应该没问题。**

## 教训

**多交互场景必须考虑延迟事件的传递链路**：
- 不能假设只有一个交互
- 延迟事件必须存到第一个交互中，确保链式传递
- 最后一个交互解决时才补发延迟事件

## 相关代码

- `src/games/smashup/domain/index.ts` - scoreBase 函数
- `src/games/smashup/domain/systems.ts` - 交互解决时的延迟事件处理
- `src/games/smashup/domain/baseAbilities.ts` - 母舰基地能力
- `src/games/smashup/abilities/aliens.ts` - 侦察兵 afterScoring trigger

## 文档更新

已更新 `AGENTS.md`，添加了这个 bug 修复的记录和教训。
