# 忍者渗透功能修复 - E2E 测试

## 问题描述

用户反馈："渗透打在基地上，高亮的为什么是随从"，后续澄清："我根本选择基地啊"。

## 根本原因

**卡牌定义错误**：`ninja_infiltrate` 的 `ongoingTarget` 被错误设置为 `'minion'`，导致无法打出到基地上。

## 修复内容

### 1. 卡牌定义修复（核心修复）

**文件**：`src/games/smashup/data/factions/ninjas.ts`（第 125-135 行）

**问题**：`ninja_infiltrate` 的 `ongoingTarget` 被错误设置为 `'minion'`，应该是 `'base'`。

**修复**：
```typescript
// ❌ 修复前
{
    id: 'ninja_infiltrate',
    type: 'action',
    subtype: 'ongoing',
    name: '渗透',
    nameEn: 'Infiltrate',
    faction: 'ninjas',
    abilityTags: ['ongoing'],
    ongoingTarget: 'minion',  // ❌ 错误
    count: 2,
    previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 22 },
},

// ✅ 修复后
{
    id: 'ninja_infiltrate',
    type: 'action',
    subtype: 'ongoing',
    name: '渗透',
    nameEn: 'Infiltrate',
    faction: 'ninjas',
    abilityTags: ['ongoing'],
    ongoingTarget: 'base',  // ✅ 正确
    count: 2,
    previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 22 },
},
```

### 2. Board.tsx 修复

**文件**：`src/games/smashup/Board.tsx`（第 1792 行）

**问题**：当 `isOngoingSelectPrompt` 为 true 时（渗透选择战术），`isMinionSelectMode` 没有被明确设置为 false，可能导致随从被错误高亮。

**修复**：
```typescript
// ❌ 修复前
isMinionSelectMode={(selectedCardMode === 'ongoing-minion' && ongoingMinionTargetUids.size > 0) || (isMinionSelectPrompt && selectableMinionUids.size > 0)}

// ✅ 修复后
isMinionSelectMode={!isOngoingSelectPrompt && ((selectedCardMode === 'ongoing-minion' && ongoingMinionTargetUids.size > 0) || (isMinionSelectPrompt && selectableMinionUids.size > 0))}
```

### 3. 添加 E2E 测试数据属性

为了支持 E2E 测试，添加了以下 data 属性：

**BaseZone.tsx**：
- `data-ongoing-uid={oa.uid}` - 基地上的 ongoing 卡
- `data-base-index={baseIndex}` - 基地卡片

**HandArea.tsx**：
- `data-card-uid={card.uid}` - 手牌卡片

## E2E 测试

### 测试场景（正常流程）

**测试**：渗透打在基地上后，应该能选择并消灭基地上的战术卡

**流程**：
1. 玩家打出渗透到基地上
2. 基地上有两个战术卡
3. 弹出选择提示："选择要消灭的战术"
4. 战术卡被高亮（紫色边框 + ring-2 + 摇摆动画）
5. 玩家点击其中一个战术卡
6. 该战术卡被消灭
7. 渗透自身被打出到基地上

**预期截图**：
- 选择前：显示选择提示，两个战术卡被高亮
- 选择后：一个战术卡被消灭，渗透在基地上

### 测试状态

**当前状态**：测试代码已完成，但测试环境有问题导致无法运行

**问题**：
- 测试环境页面导航超时
- 可能是测试服务器启动问题
- 需要修复测试环境后重新运行

**下一步**：
1. 修复测试环境问题
2. 重新运行测试获取截图
3. 更新证据文档添加截图

## 渗透的完整交互流程

1. **玩家打出渗透到基地**
   - 点击手牌中的渗透
   - 点击目标基地

2. **ninjaInfiltrateOnPlay 执行**
   - 收集基地上的 ongoing 战术卡（排除渗透自身）
   - 如果没有目标：直接返回
   - 如果只有一个目标：自动消灭
   - 如果有多个目标：创建选择交互

3. **UI 渲染**（多个目标时）
   - `isOngoingSelectPrompt = true`
   - `selectableOngoingUids` 包含可选的战术卡 UID
   - BaseZone 高亮基地上的战术卡（紫色边框 + ring-2 + 摇摆动画）
   - 显示选择提示："选择要消灭的战术"

4. **玩家点击战术卡**
   - BaseZone 调用 `onOngoingSelect(oa.uid)`
   - Board.tsx 的 `handleOngoingSelect` 找到对应的 option
   - 分发 `INTERACTION_COMMANDS.RESPOND`

5. **交互解决**
   - `ninjaInfiltrateDestroy` handler 执行
   - 发射 `ONGOING_DETACHED` 事件
   - 战术卡被消灭

## 相关文件

### 修复的代码文件
- `src/games/smashup/Board.tsx` - 修复 isMinionSelectMode 逻辑（第 1792 行）
- `src/games/smashup/data/factions/ninjas.ts` - 修复 ongoingTarget（核心修复，第 125-135 行）
- `src/games/smashup/ui/BaseZone.tsx` - 添加 data-ongoing-uid 和 data-base-index
- `src/games/smashup/ui/HandArea.tsx` - 添加 data-card-uid

### 测试文件
- `e2e/smashup-ninja-infiltrate.e2e.ts` - E2E 测试（正常流程）
- `e2e/smashup-debug-helpers.ts` - 调试辅助函数（applyCoreStateDirect）
- `e2e/helpers/smashup.ts` - SmashUp 测试辅助函数

### 实现文件
- `src/games/smashup/abilities/ninjas.ts` - 渗透实现（ninjaInfiltrateOnPlay，第 147-180 行）
- `src/games/smashup/abilities/ninjas.ts` - 渗透交互处理器（ninjaInfiltrateDestroy，第 706-715 行）

## 注意事项

1. **渗透只能消灭基地上的战术卡**（`base.ongoingActions`），不能消灭附着在随从上的战术卡（`minion.attachedActions`）
2. **渗透自身会被排除**在可选目标之外（`if (o.uid === ctx.cardUid) continue`）
3. **只有一个目标时自动消灭**，不需要玩家选择
4. **没有目标时直接返回**，不创建交互

## 总结

渗透功能的核心问题已修复（`ongoingTarget: 'base'`），用户现在可以：
1. 将渗透打出到基地上
2. 选择并消灭基地上的战术卡
3. UI 高亮正确（不再错误高亮随从）

E2E 测试代码已完成，等待测试环境修复后运行并获取截图。
