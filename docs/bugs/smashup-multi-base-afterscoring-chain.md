# SmashUp 多基地同时计分时 afterScoring 交互链中断问题

## 问题描述

当多个基地同时达到临界点需要计分时，如果某个基地的 `afterScoring` 能力创建了交互（如海盗湾、忍者道场），会导致后续基地的计分被跳过。

## 复现场景

用户截图显示：
- 右边基地（索引2）先计分，`afterScoring` 创建交互
- 中间基地（索引1）应该在交互解决后继续计分，但被跳过了
- 左边基地（索引0）也被跳过

## 根因分析

### 当前流程（修复前）

1. **onPhaseExit('scoreBases')**：
   - 检测到 3 个基地达标
   - 创建 `multi_base_scoring` 交互让玩家选择先计分的基地
   - `halt=true` 等待玩家选择

2. **玩家选择基地 → multi_base_scoring handler**：
   ```typescript
   // 1. 计分玩家选择的基地
   const result = scoreOneBase(...);
   
   // 如果 beforeScoring/afterScoring 创建了交互 → 先处理交互，剩余基地后续再计分
   if (currentState.sys.interaction?.current) {
       return { state: currentState, events: result.events }; // ❌ 直接返回，没有处理剩余基地
   }
   ```

3. **问题**：
   - 当第一个基地的 `afterScoring` 创建交互时（如海盗湾亚军移动随从），handler 立即返回
   - **没有创建新的 `multi_base_scoring` 交互来继续计分剩余基地**
   - 交互解决后，流程不会自动回到计分逻辑
   - 剩余基地永远不会被计分

## 解决方案

在 `registerMultiBaseScoringInteractionHandler` 中，当检测到 afterScoring 创建交互时，**自动将剩余基地的 `multi_base_scoring` 交互加入队列**。

### 修复后的流程

```typescript
// 如果 beforeScoring/afterScoring 创建了交互 → 先处理交互，剩余基地后续再计分
if (currentState.sys.interaction?.current) {
    // 【修复】如果还有剩余基地需要计分，创建新的 multi_base_scoring 交互并加入队列
    // 这样 afterScoring 交互解决后，队列中的 multi_base_scoring 会自动弹出，继续计分流程
    if (remainingIndices.length >= 1) {
        const candidates = remainingIndices.map(i => {
            const base = updatedCore.bases[i];
            if (!base) return null;
            const baseDef = getBaseDef(base.defId);
            const totalPower = getTotalEffectivePowerOnBase(updatedCore, base, i);
            return {
                baseIndex: i,
                label: `${baseDef?.name ?? `基地 ${i + 1}`} (力量 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
            };
        }).filter(Boolean) as { baseIndex: number; label: string }[];

        if (candidates.length >= 1) {
            const interaction = createSimpleChoice(
                `multi_base_scoring_${timestamp}_remaining`, playerId,
                remainingIndices.length === 1 ? '计分最后一个基地' : '选择先记分的基地',
                buildBaseTargetOptions(candidates, updatedCore) as any[],
                { sourceId: 'multi_base_scoring', targetType: 'base' },
            );
            currentState = queueInteraction(currentState, interaction);
        }
    }
    return { state: currentState, events };
}
```

### 完整流程示例

假设 3 个基地同时达标（海盗湾、忍者道场、丛林）：

1. **第一次选择**：
   - UI 显示 3 个基地卡图
   - 玩家选择丛林（左边，无 afterScoring）
   - 丛林计分完成
   - 系统自动创建新的 `multi_base_scoring` 交互（剩余：海盗湾、忍者道场）

2. **第二次选择**：
   - UI 显示 2 个基地卡图（海盗湾、忍者道场）
   - 玩家选择海盗湾（右边）
   - 海盗湾计分，afterScoring 创建交互（P1 亚军移动随从）
   - **同时**，系统自动创建新的 `multi_base_scoring` 交互并加入队列（剩余：忍者道场）

3. **响应海盗湾交互**：
   - P1 选择移动随从或跳过
   - 交互解决

4. **第三次选择**（自动弹出）：
   - UI 显示 1 个基地卡图（忍者道场）
   - 玩家选择忍者道场（中间）
   - 忍者道场计分，afterScoring 创建交互（消灭随从）
   - **没有剩余基地**，不创建新的选择交互

5. **响应忍者道场交互**：
   - 玩家选择消灭哪个随从或跳过
   - 交互解决
   - 所有基地计分完成

## 测试结果

测试用例 `src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` 验证了修复：

```
BASE_SCORED 事件数量: 3
所有事件: [
  'SYS_PHASE_CHANGED',
  'su:scoring_eligible_bases_locked',
  'RESPONSE_WINDOW_OPENED',
  'RESPONSE_WINDOW_CLOSED',
  'SYS_INTERACTION_RESOLVED',
  'su:base_scored',           // 基地0（丛林）计分
  'su:base_cleared',
  'su:base_replaced',
  'SYS_INTERACTION_RESOLVED',
  'su:base_scored',           // 基地2（海盗湾）计分
  'SYS_INTERACTION_RESOLVED',
  'SYS_INTERACTION_RESOLVED',
  'su:base_scored'            // 基地1（忍者道场）计分
]
玩家分数: { p0: 7, p1: 4 }
```

所有 3 个基地都成功计分，玩家获得了正确的分数。

## UI 显示

多基地选择交互使用 `PromptOverlay` 组件，`targetType: 'base'` 会显示基地卡图供玩家点击选择。

## 相关代码

- `src/games/smashup/domain/index.ts` - `registerMultiBaseScoringInteractionHandler`（已修复）
- `src/games/smashup/domain/index.ts` - `onPhaseExit('scoreBases')`
- `src/games/smashup/domain/index.ts` - `scoreOneBase`
- `src/games/smashup/domain/baseAbilities.ts` - afterScoring 基地能力
- `src/games/smashup/ui/PromptOverlay.tsx` - 基地选择 UI

## 状态

✅ 已修复并通过测试
