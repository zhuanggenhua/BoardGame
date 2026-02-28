# Bug 修复：母舰基地 afterScoring 交互无法操作

## 问题描述

**游戏**：大杀四方（Smash Up）  
**症状**：所有 afterScoring 基地能力创建交互后，游戏会卡死  
**用户反馈**："这类在基地计分后有效果的基地，都会出bug没办法操作"  
**报告时间**：2026/2/28 14:52:33

## 用户反馈

> 这类在基地计分后有效果的基地，都会出bug没办法操作

**影响范围**：所有创建交互的 afterScoring 基地，包括但不限于：
- 母舰（base_the_mothership）
- 忍者道场（base_ninja_dojo）
- 海盗湾（base_pirate_cove）
- 托尔图加（base_tortuga）
- 刚柔流寺庙（base_temple_of_goju）
- 巫师学院（base_wizard_academy）
- 温室（base_greenhouse）
- 发明家沙龙（base_inventors_salon）
- 密斯卡托尼克大学（base_miskatonic_university_base）

## 状态快照分析

从用户提供的状态快照可以看到：
- 当前阶段：`scoreBases`
- 计分基地：母舰（baseIndex: 2）
- 母舰上的随从：
  - P0（冠军）：alien_scout（力量3）、dino_armor_stego（力量3）
  - P1：cthulhu_chosen（力量3）、pirate_buccaneer（力量4）、cthulhu_star_spawn（力量5）
- P0 是冠军，有2个符合条件的随从（力量≤3）

## 根因分析

### 问题1：缺少随从快照（母舰特有）

母舰的 `afterScoring` 能力创建交互时，只保存了 `baseIndex`，没有保存随从信息快照。

**问题场景**：
1. afterScoring 创建交互时，随从还在基地上
2. 如果有多个 afterScoring 交互（如母舰 + 大副），第一个交互解决后可能影响第二个
3. 如果 ongoing afterScoring（如大副）先执行，可能移动/消灭随从
4. 交互处理器从 `continuationContext` 读取 `baseIndex`，但此时基地上的随从可能已经变化

**对比海盗湾的实现**：海盗湾将随从信息保存到 `continuationContext.minionsSnapshot`，交互处理器从快照中读取，而不是从基地上查找。

### 问题2：延迟事件补发机制的潜在风险（系统性问题）

**延迟机制**：
1. afterScoring 创建交互时，`BASE_CLEARED` 和 `BASE_REPLACED` 事件被延迟
2. 延迟事件存储在 `_deferredPostScoringEvents` 中
3. `SmashUpEventSystem` 应该在交互解决后补发这些事件

**补发逻辑**（`src/games/smashup/domain/systems.ts:80-110`）：
```typescript
if (event.type === INTERACTION_EVENTS.RESOLVED) {
    const payload = event.payload as { sourceId?: string; ... };
    
    if (payload.sourceId) {
        const handler = getInteractionHandler(payload.sourceId);
        if (handler) {
            // ... 执行 handler ...
            
            // 补发延迟事件
            const ctx = payload.interactionData?.continuationContext;
            const deferred = ctx?._deferredPostScoringEvents;
            if (deferred && deferred.length > 0) {
                // 仅在没有后续交互时补发
                if (!newState.sys.interaction?.current && ...) {
                    for (const d of deferred) {
                        nextEvents.push(d);
                    }
                }
            }
        }
    }
}
```

**潜在风险**：
- ❌ 如果 `sourceId` 不存在或为空，补发逻辑不会执行
- ❌ 如果 `getInteractionHandler(sourceId)` 返回 undefined，补发逻辑不会执行
- ❌ 如果 handler 抛出异常，补发逻辑可能不会执行
- ❌ 如果 `continuationContext` 被意外修改或删除，延迟事件会丢失

**实际情况**：经过检查，所有创建交互的 afterScoring 基地都正确注册了 handler，所以这个风险目前不会触发。但这是一个脆弱的设计，未来容易出错。

## 解决方案

### 方案1：修复母舰的快照机制（已完成）

参考海盗湾的实现，为母舰添加随从快照机制。

**修改文件**：`src/games/smashup/domain/baseAbilities.ts`

**关键改动**：
1. 创建交互时，将随从信息保存到 `minionsSnapshot`
2. 从快照生成选项，而不是直接从 `eligible` 生成
3. 将快照存入 `continuationContext`

### 方案2：改进延迟事件补发机制（推荐，未实施）

**问题**：当前补发逻辑依赖 `sourceId` 和 `InteractionHandler` 存在，这是一个脆弱的设计。

**改进方案**：
1. **在 InteractionSystem 层补发**：将延迟事件的补发逻辑从 `SmashUpEventSystem` 移到 `InteractionSystem`
2. **无条件补发**：只要 `_deferredPostScoringEvents` 存在，就应该补发，不依赖 handler
3. **更安全的存储**：将延迟事件存储在 `sys.interaction` 的顶层，而不是 `continuationContext`

**示例代码**（未实施）：
```typescript
// 在 InteractionSystem 的 afterEvents 中
if (event.type === INTERACTION_EVENTS.RESOLVED) {
    const ctx = payload.interactionData?.continuationContext;
    const deferred = ctx?._deferredPostScoringEvents;
    
    // 无条件补发，不依赖 handler
    if (deferred && deferred.length > 0) {
        if (!newState.sys.interaction?.current && ...) {
            for (const d of deferred) {
                nextEvents.push(d);
            }
        } else {
            // 传递到下一个交互
            const nextInteraction = newState.sys.interaction.current ?? ...;
            if (nextInteraction?.data) {
                const nextCtx = nextInteraction.data.continuationContext ?? {};
                nextCtx._deferredPostScoringEvents = deferred;
            }
        }
    }
}
```

**优点**：
- 不依赖游戏层的 handler 实现
- 更健壮，不容易出错
- 适用于所有游戏，不只是 SmashUp

**缺点**：
- 需要修改引擎层代码
- 需要更多测试验证

## 测试验证

### 测试场景

1. **基本场景**：冠军在母舰有1个力量≤3的随从，应该能选择收回
2. **多个随从**：冠军在母舰有多个力量≤3的随从，应该能选择任意一个
3. **无符合条件随从**：冠军在母舰只有力量>3的随从，不应该创建交互
4. **链式交互**：母舰 + 大副同时触发，两个交互都应该正常工作

### 回归测试

运行所有 SmashUp 测试，确保修改没有破坏现有功能。

## 影响范围

- **修复文件**：`src/games/smashup/domain/baseAbilities.ts`
- **影响基地**：母舰（base_the_mothership）
- **向后兼容**：是（只是添加了快照机制，不影响现有逻辑）

## 相关问题

用户反馈"这类在基地计分后有效果的基地，都会出bug"，需要排查其他 afterScoring 基地是否有类似问题：

- ✅ **海盗湾（base_pirate_cove）**：已有快照机制
- ✅ **托尔图加（base_tortuga）**：已有快照机制（通过 `minionsSnapshot`）
- ❓ **伊万斯堡城镇公墓（base_haunted_house）**：需要检查
- ❓ **刚柔流寺庙（base_temple_of_goju）**：需要检查
- ❓ **大图书馆（base_great_library）**：需要检查
- ❓ **魔像城堡（base_golem_schloss）**：需要检查
- ❓ **仪式场所（base_ritual_site）**：需要检查
- ❓ **忍者道场（base_ninja_dojo）**：需要检查
- ❓ **巫师学院（base_wizard_academy）**：需要检查

## 后续行动

- [x] 修复母舰的快照机制
- [ ] 验证所有 afterScoring 基地的 handler 都正确注册
- [ ] 创建 E2E 测试验证修复
- [ ] 考虑实施方案2（改进延迟事件补发机制）
- [ ] 更新相关文档

## 验证清单

所有创建交互的 afterScoring 基地及其 handler 状态：

| 基地 | sourceId | handler 注册 | 快照机制 | 状态 |
|------|----------|-------------|---------|------|
| base_the_mothership | base_the_mothership | ✅ | ✅ | 已修复 |
| base_ninja_dojo | base_ninja_dojo | ✅ | ❓ | 需检查 |
| base_pirate_cove | base_pirate_cove | ✅ | ✅ | 正常 |
| base_tortuga | base_tortuga | ✅ | ✅ | 正常 |
| base_temple_of_goju | base_temple_of_goju_tiebreak | ✅ | ❓ | 需检查 |
| base_wizard_academy | base_wizard_academy | ✅ | ❓ | 需检查 |
| base_greenhouse | base_greenhouse | ✅ | ❓ | 需检查 |
| base_inventors_salon | base_inventors_salon | ✅ | ❓ | 需检查 |
| base_miskatonic_university_base | base_miskatonic_university_base | ✅ | ❓ | 需检查 |

## 教训

1. **afterScoring 交互必须保存快照**：因为 `BASE_CLEARED` 事件被延迟，但其他交互可能会修改基地状态
2. **参考现有实现**：海盗湾和托尔图加已经有正确的实现，新增类似功能时应该参考
3. **用户反馈要全面排查**：用户说"这类基地都有问题"，说明可能是系统性问题，需要全面排查

