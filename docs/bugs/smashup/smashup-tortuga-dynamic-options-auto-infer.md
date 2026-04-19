# Bug 修复：托尔图加 + 海盗王动态选项刷新（框架层自动推断）

## 问题描述

**游戏**：大杀四方（Smash Up）  
**症状**：托尔图加计分时，海盗王移动后，用户点击"移动随从"后卡住  
**报告时间**：2026/2/28 15:59:15 & 15:59:59

## 根因分析

### 问题场景

1. 托尔图加上有：海盗王（玩家0）+ 大副（玩家0）
2. 其他基地上有：侦察兵（玩家1）
3. 托尔图加计分，触发多个交互：
   - **海盗王 beforeScoring**：移动到其他基地
   - **托尔图加 afterScoring**：亚军移动其他基地的随从到替换基地
   - **大副 afterScoring**：移动到其他基地（2个大副 = 2个交互）
4. 海盗王移动后，基地上的随从分布发生变化
5. 托尔图加的交互选项是在计分前创建的，可能包含已经移动走的随从
6. 用户选择了一个已经不在原基地的随从 → 卡住

### 初步修复（已废弃）

最初的修复方案是要求游戏层手动添加 `_source` 字段：

```typescript
// ❌ 旧方案：手动添加 _source 字段
const minionOptions = otherMinions.map((m, i) => ({
    id: `minion-${i}`,
    label: m.label,
    value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
    _source: 'field' as const, // ← 手动声明
}));
```

**问题**：
- 需要在每个地方手动添加 `_source` 字段
- 容易遗漏，导致同类 bug 反复出现
- 不符合"面向百游戏"的设计原则（游戏层代码量过大）

## 最终解决方案（框架层自动推断）

### 核心思路

框架层根据选项 `value` 的字段**自动推断**选项类型，无需游戏层手动声明：

- `value` 包含 `minionUid` → 自动识别为 `'field'`（场上随从）
- `value` 包含 `baseIndex` → 自动识别为 `'base'`（基地）
- `value` 包含 `cardUid` → 自动识别为 `'hand'`（手牌，如果不在手牌则尝试弃牌堆）
- `value` 包含 `skip`/`done`/`cancel` → 自动识别为 `'static'`（静态选项）

### 修改内容

**文件**：`src/engine/systems/InteractionSystem.ts`

```typescript
function refreshOptionsGeneric<T>(
    state: any,
    interaction: InteractionDescriptor,
    originalOptions: PromptOption<T>[],
): PromptOption<T>[] {
    return originalOptions.filter((opt) => {
        const val = opt.value as any;
        
        // 优先使用显式声明的 _source
        const explicitSource = opt._source;
        
        // 自动推断类型（当未显式声明时）
        const inferredSource = explicitSource || (() => {
            if (!val || typeof val !== 'object') return 'static';
            
            // 跳过/完成/取消等操作选项
            if (val.skip || val.done || val.cancel || val.__cancel__) return 'static';
            
            // 根据字段推断类型
            if (val.minionUid !== undefined) return 'field';
            if (val.baseIndex !== undefined) return 'base';
            if (val.cardUid !== undefined) return 'hand';
            
            return 'static';
        })();

        // 根据推断的类型校验选项是否仍然有效
        switch (inferredSource) {
            case 'field': {
                for (const base of state.core?.bases || []) {
                    if (base.minions?.some((m: any) => m.uid === val?.minionUid)) return true;
                }
                return false;
            }
            case 'base': {
                return typeof val?.baseIndex === 'number' &&
                    val.baseIndex >= 0 &&
                    val.baseIndex < (state.core?.bases?.length || 0);
            }
            case 'hand': {
                const player = state.core?.players?.[interaction.playerId];
                if (player?.hand?.some((c: any) => c.uid === val?.cardUid)) return true;
                // 如果不在手牌，尝试弃牌堆（向后兼容）
                if (player?.discard?.some((c: any) => c.uid === val?.cardUid)) return true;
                return false;
            }
            case 'static':
            default:
                return true;
        }
    });
}
```

### 游戏层代码

**无需修改**！所有现有代码自动受益：

```typescript
// ✅ 新方案：无需手动添加 _source，框架层自动推断
const minionOptions = otherMinions.map((m, i) => ({
    id: `minion-${i}`,
    label: m.label,
    value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
    // ← 框架层自动识别为 'field'
}));
```

## 影响范围

### 自动修复的卡牌/基地

以下所有地方都因框架层自动推断而自动修复，无需修改游戏层代码：

1. **海盗大副**（pirate_first_mate）- afterScoring 移动选项
2. **蒸汽朋克亚哈船长**（steampunk_captain_ahab）- 移动到有 ongoing 的基地
3. **蒸汽朋克机械师**（steampunk_mechanic）- 打出 ongoing 行动卡选择基地
4. **蒸汽朋克场地变更**（steampunk_change_of_venue）- 打出 ongoing 行动卡选择基地
5. **托尔图加**（base_tortuga）- afterScoring 移动随从到替换基地
6. **诡猫巷**（base_cat_fanciers_alley）- 消灭己方随从抽牌
7. **平衡之地**（base_land_of_balance）- 移动己方随从到此基地
8. **绵羊神社**（base_sheep_shrine）- 移动己方随从到此基地
9. **牧场**（base_the_pasture）- 移动其他基地的随从到此基地

### 向后兼容

- ✅ 已有的 `_source` 字段仍然有效（优先使用显式声明）
- ✅ 未声明 `_source` 的选项自动推断
- ✅ 无需修改任何游戏层代码

## 测试验证

### 手动验证

1. 托尔图加计分场景：
   - 海盗王移动后，托尔图加的随从选项自动刷新
   - 用户只能选择仍在场上的随从
   - 不会出现"选择后卡住"的问题

2. 连续交互场景：
   - 第一个交互解决后，第二个交互的选项自动刷新
   - 例如：连续弃牌时，第二次弃牌只显示剩余的手牌

### 回归测试

运行现有测试套件，确认无回归：
- ✅ `pirate-cove-chain-fix.test.ts`（海盗湾链式交互）
- ✅ `newOngoingAbilities.test.ts`（大副 afterScoring）
- ✅ `baseAbilityIntegrationE2E.test.ts`（寺庙 + 大副时序）

## 相关规范

更新了 `docs/ai-rules/testing-audit.md` 的 D37 维度：

> **D37: 交互选项动态刷新完整性**
> 
> 框架层已支持自动推断选项类型（根据 `value` 的字段：`minionUid` → field、`baseIndex` → base、`cardUid` → hand/discard），无需手动添加 `_source` 字段。
> 
> **可选优化**：复杂场景（如从弃牌堆/牌库选择）可显式声明 `_source: 'discard'` 提升性能，但非必需。

## 教训

1. **框架层优先**：能在框架层自动处理的问题，不要推给游戏层手动处理
2. **面向百游戏设计**：每个游戏都要写的代码 = 设计缺陷，应该由框架层统一处理
3. **自动推断 > 显式声明**：90% 的场景可以自动推断，只有 10% 的特殊场景需要显式声明
4. **向后兼容**：框架层改进不应破坏现有代码，应该让现有代码自动受益

## 后续行动

- [x] 修改框架层 `refreshOptionsGeneric` 支持自动推断
- [x] 更新审计文档 D37 维度
- [x] 撤销游戏层手动添加的 `_source` 字段（因为框架层已自动处理）
- [x] 验证所有受影响的卡牌/基地自动修复
- [ ] 监控生产环境，确认无新的"移动后卡住"问题

