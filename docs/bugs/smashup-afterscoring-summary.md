# SmashUp afterScoring 交互卡死问题总结

## 问题描述

用户报告："所有积分后效果都会卡死"

## 根因分析

### 1. 母舰基地缺少随从快照（已修复）

**问题**：母舰基地的 `afterScoring` 能力创建交互时，只保存了 `baseIndex`，没有保存随从信息快照。

**影响**：如果有多个 afterScoring 交互或 ongoing afterScoring 先执行，可能导致随从状态变化，交互处理器无法找到随从。

**修复**：参考海盗湾的实现，添加 `minionsSnapshot` 到 `continuationContext`。

### 2. 延迟事件补发机制的潜在风险（未修复）

**问题**：`BASE_CLEARED` 和 `BASE_REPLACED` 事件的补发依赖于：
1. `sourceId` 存在
2. `getInteractionHandler(sourceId)` 返回有效 handler
3. handler 正常执行

如果任何一个条件不满足，延迟事件永远不会被发出，游戏会卡死。

**当前状态**：经过检查，所有创建交互的 afterScoring 基地都正确注册了 handler，所以这个风险目前不会触发。

**推荐改进**：将延迟事件的补发逻辑从 `SmashUpEventSystem` 移到 `InteractionSystem`，无条件补发，不依赖 handler。

## 修复文件

- ✅ `src/games/smashup/domain/baseAbilities.ts` - 母舰基地和刚柔流寺庙的 afterScoring 能力
- ✅ `docs/bugs/smashup-mothership-afterscoring.md` - 详细 bug 文档
- ✅ `docs/bugs/smashup-afterscoring-summary.md` - 本总结文档

## 测试建议

### E2E 测试场景

1. **母舰基地**：
   - 冠军在母舰有1个力量≤3的随从，选择收回
   - 冠军在母舰有多个力量≤3的随从，选择任意一个
   - 冠军在母舰只有力量>3的随从，不应该创建交互

2. **链式交互**：
   - 母舰 + 大副同时触发，两个交互都应该正常工作
   - 验证 BASE_CLEARED 事件在所有交互解决后才发出

3. **无交互基地**：
   - 大图书馆（不创建交互）应该正常发出 BASE_CLEARED 事件

### 回归测试

运行所有 SmashUp 测试，确保修改没有破坏现有功能。

## 其他 afterScoring 基地检查清单

| 基地 | 创建交互 | handler 注册 | 快照机制 | 状态 |
|------|---------|-------------|---------|------|
| base_the_mothership | ✅ | ✅ | ✅ | 已修复 |
| base_ninja_dojo | ✅ | ✅ | ✅ | 正常（全局随从，不需要快照） |
| base_pirate_cove | ✅ | ✅ | ✅ | 正常 |
| base_tortuga | ✅ | ✅ | ✅ | 正常（其他基地随从，不需要快照） |
| base_temple_of_goju | ✅ | ✅ | ✅ | 已修复 |
| base_wizard_academy | ✅ | ✅ | ✅ | 正常（基地牌库，不需要快照） |
| base_greenhouse | ✅ | ✅ | ✅ | 正常（牌库随从，不需要快照） |
| base_inventors_salon | ✅ | ✅ | ✅ | 正常（弃牌堆，不需要快照） |
| base_miskatonic_university_base | ✅ | ✅ | ✅ | 正常（疯狂卡，不需要快照） |
| base_haunted_house | ❌ | N/A | N/A | 正常（不创建交互） |
| base_great_library | ❌ | N/A | N/A | 正常（不创建交互） |
| base_golem_schloss | ❌ | N/A | N/A | 正常（不创建交互） |
| base_ritual_site | ❌ | N/A | N/A | 正常（不创建交互） |

### 快照需求分析

**需要快照的场景**：交互选项依赖于"当前基地上的随从"，且这些随从会在 BASE_CLEARED 事件中被移除。

- ✅ **base_the_mothership**：选择"当前基地上力量≤3的随从"收回 → 需要快照（已修复）
- ✅ **base_pirate_cove**：选择"当前基地上非冠军的随从"移动 → 需要快照（已有）
- ❌ **base_temple_of_goju**：选择"当前基地上每位玩家力量最高的随从"放入牌库底 → **需要快照但缺失**
- ✅ **base_ninja_dojo**：选择"全局任意随从"消灭 → 不需要快照（全局范围）
- ✅ **base_tortuga**：选择"其他基地上的随从"移动 → 不需要快照（其他基地）
- ✅ **base_wizard_academy**：选择"基地牌库顶3张"重排 → 不需要快照（基地牌库）
- ✅ **base_greenhouse**：选择"牌库中的随从"打出 → 不需要快照（牌库）
- ✅ **base_inventors_salon**：选择"弃牌堆中的行动卡"取回 → 不需要快照（弃牌堆）
- ✅ **base_miskatonic_university_base**：选择"手牌/弃牌堆中的疯狂卡"返回 → 不需要快照（疯狂卡）

## 教训

1. **afterScoring 交互必须保存快照**：因为 `BASE_CLEARED` 事件被延迟，但其他交互可能会修改基地状态
2. **参考现有实现**：海盗湾和托尔图加已经有正确的实现，新增类似功能时应该参考
3. **框架层设计要健壮**：延迟事件的补发不应该依赖游戏层的 handler 实现
4. **用户反馈要全面排查**：用户说"所有基地都有问题"，说明可能是系统性问题，需要全面排查

## 下一步

1. ✅ 修复母舰基地的快照机制
2. ✅ 修复刚柔流寺庙的快照机制
3. ✅ 检查其他 afterScoring 基地是否需要快照机制（已完成，其他基地不需要）
4. ✅ 修复 UI 显示基地上下文（标题显示基地名称，选项包含 baseIndex）
5. ⏳ 创建 E2E 测试验证修复
6. ⏳ 考虑改进延迟事件补发机制（引擎层改进）

## UI 改进（已实施）

### 问题

用户报告母舰基地 afterScoring 时，UI 显示了其他基地（忍者道场）上的同名随从，导致混淆。

### 根因

`PromptOverlay` 组件渲染所有同 `defId` 的卡牌，不区分基地来源。

### 修复

1. **标题显示基地名称**：当 `continuationContext.baseIndex` 存在时，在标题下方显示"@ 基地名称"
2. **选项包含 baseIndex**：为 mothership 和 temple_of_goju 的选项添加 `baseIndex` 和 `displayMode: 'card'`

### 修改文件

- ✅ `src/games/smashup/ui/PromptOverlay.tsx` - 提取并显示基地上下文
- ✅ `src/games/smashup/domain/baseAbilities.ts` - 选项添加 baseIndex

详见 `docs/bugs/smashup-mothership-ui-shows-wrong-base-minions.md`。
