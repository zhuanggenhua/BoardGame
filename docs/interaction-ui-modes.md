# 交互 UI 渲染模式详解

## 核心概念

交互的 UI 渲染方式由 `targetType` 字段决定：
- **场景直选模式**：在棋盘/手牌区直接点击目标（高亮显示候选）
- **弹窗模式**：显示 `PromptOverlay` 弹窗，列出所有选项

## targetType 字段

在 `createSimpleChoice` 时声明：

```typescript
const interaction = createSimpleChoice(
    id, playerId, title, options,
    { 
        sourceId: 'base_tortuga', 
        targetType: 'minion',  // ← 决定 UI 渲染方式
    }
);
```

## 支持的 targetType

| targetType | UI 模式 | 适用场景 | 示例 |
|-----------|---------|---------|------|
| `'base'` | 场景直选 | 高亮棋盘上的候选基地，点击基地完成选择 | 托尔图加移动随从到替换基地 |
| `'minion'` | 场景直选 | 高亮棋盘上的候选随从，点击随从完成选择 | 粗鲁少妇选择消灭目标 |
| `'hand'` | 场景直选 | 高亮手牌区的候选卡牌，点击卡牌完成选择 | 弃牌、选择打出的卡牌 |
| `'ongoing'` | 场景直选 | 高亮棋盘上的候选持续行动卡，点击行动卡完成选择 | 选择移除的 ongoing 卡 |
| `'discard_minion'` | 弹窗 | 从弃牌堆选择随从（无法在场景中直选） | 僵尸领主从弃牌堆打出随从 |
| `'generic'` 或 `undefined` | 弹窗 | 通用选择（是/否、多个不同类型的选项） | 海盗王确认是否移动 |

## UI 层判定逻辑

### Board.tsx 中的判定

```typescript
// 1. 基地选择交互检测
const isBaseSelectPrompt = useMemo(() => {
    if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
    const data = currentInteraction?.data as Record<string, unknown> | undefined;
    
    // 优先使用 targetType 字段（数据驱动）
    if (typeof data?.targetType === 'string') {
        return data.targetType === 'base';
    }
    
    // 兼容旧模式：至少有一个有效 baseIndex≥0 的选项
    // ...
}, [currentPrompt, currentInteraction, playerID]);

// 2. 随从选择交互检测
const isMinionSelectPrompt = useMemo(() => {
    if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
    const data = currentInteraction?.data as Record<string, unknown> | undefined;
    
    // 多选交互：仅当 targetType === 'minion' 时走棋盘点选
    if (currentPrompt.multi) return data?.targetType === 'minion';
    
    // 单选交互：targetType === 'minion'
    if (data?.targetType === 'minion') return true;
    
    // 显式声明了非 minion 的 targetType → 不走棋盘随从点选
    if (typeof data?.targetType === 'string') return false;
    
    // 兼容旧模式：所有选项都包含 minionUid
    // ...
}, [currentPrompt, currentInteraction, playerID]);

// 3. 手牌选择交互检测
const isHandDiscardPrompt = useMemo(() => {
    if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
    const data = currentInteraction?.data as Record<string, unknown> | undefined;
    
    // 优先使用 targetType 字段
    if (data?.targetType === 'hand') return true;
    
    // 兼容旧模式：所有选项都包含 cardUid
    // ...
}, [currentPrompt, currentInteraction, playerID]);

// 4. 弃牌堆随从选择交互检测
const isDiscardMinionPrompt = useMemo(() => {
    if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
    const data = currentInteraction?.data as Record<string, unknown> | undefined;
    return data?.targetType === 'discard_minion';
}, [currentPrompt, playerID, currentInteraction]);
```

### 渲染逻辑

```typescript
// 场景直选模式：隐藏 PromptOverlay，在场景中高亮候选
const shouldShowPromptOverlay = !isBaseSelectPrompt && 
                                !isMinionSelectPrompt && 
                                !isHandDiscardPrompt && 
                                !isOngoingSelectPrompt;

return (
    <>
        {/* 场景直选：基地高亮 */}
        {isBaseSelectPrompt && (
            <BaseZone 
                selectableBaseIndices={selectableBaseIndices}  // 高亮候选基地
                onBaseClick={handleBaseSelect}                 // 点击基地完成选择
            />
        )}
        
        {/* 场景直选：随从高亮 */}
        {isMinionSelectPrompt && (
            <BaseZone 
                selectableMinionUids={selectableMinionUids}    // 高亮候选随从
                onMinionClick={handleMinionSelect}             // 点击随从完成选择
            />
        )}
        
        {/* 场景直选：手牌高亮 */}
        {isHandDiscardPrompt && (
            <HandArea 
                selectableCardUids={selectableCardUids}        // 高亮候选手牌
                onCardClick={handleCardSelect}                 // 点击卡牌完成选择
            />
        )}
        
        {/* 弹窗模式：显示 PromptOverlay */}
        {shouldShowPromptOverlay && currentPrompt && (
            <PromptOverlay 
                prompt={currentPrompt}
                onSelect={handlePromptSelect}
            />
        )}
    </>
);
```

## 完整示例

### 示例1：托尔图加移动随从（场景直选）

```typescript
// 游戏层：创建交互
const minionOptions = otherMinions.map((m, i) => ({
    id: `minion-${i}`,
    label: m.label,
    value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
    // ← 框架层自动推断为 'field'
}));

const interaction = createSimpleChoice(
    `base_tortuga_${ctx.now}`, runnerUpId,
    '托尔图加：选择移动一个其他基地上的随从到替换基地', 
    [{ id: 'skip', label: '跳过', value: { skip: true } }, ...minionOptions],
    { 
        sourceId: 'base_tortuga', 
        targetType: 'minion',  // ← UI 层走场景直选模式
    }
);

// UI 层：场景直选
// 1. Board.tsx 检测到 targetType === 'minion'
// 2. isMinionSelectPrompt = true
// 3. 隐藏 PromptOverlay
// 4. 在 BaseZone 中高亮候选随从（scout1, king1）
// 5. 用户点击随从 → dispatch INTERACTION_RESPOND
```

**用户体验**：
- ✅ 看到棋盘上的随从高亮（发光边框）
- ✅ 点击随从直接完成选择
- ✅ 不需要打开弹窗

### 示例2：海盗王确认移动（弹窗模式）

```typescript
// 游戏层：创建交互
const interaction = createSimpleChoice(
    `pirate_king_move_${ctx.now}`, first.controller,
    `海盗王：是否移动到即将计分的「${baseName}」？`,
    [
        { id: 'yes', label: '移动到该基地', value: { move: true, uid: first.uid } },
        { id: 'no', label: '留在原地', value: { move: false } },
    ],
    'pirate_king_move',
    // ← 未声明 targetType，默认为 'generic'
);

// UI 层：弹窗模式
// 1. Board.tsx 检测到 targetType === undefined
// 2. isBaseSelectPrompt = false, isMinionSelectPrompt = false
// 3. shouldShowPromptOverlay = true
// 4. 显示 PromptOverlay 弹窗
// 5. 用户点击按钮 → dispatch INTERACTION_RESPOND
```

**用户体验**：
- ✅ 看到弹窗显示两个按钮："移动到该基地" / "留在原地"
- ✅ 点击按钮完成选择
- ✅ 不需要在场景中点击

### 示例3：弃牌（场景直选 + 多选）

```typescript
// 游戏层：创建交互
const cardOptions = player.hand.map((c, i) => ({
    id: `card-${i}`,
    label: c.name,
    value: { cardUid: c.uid, defId: c.defId },
    // ← 框架层自动推断为 'hand'
}));

const interaction = createSimpleChoice(
    `discard_${ctx.now}`, playerId,
    '弃置2张手牌', 
    cardOptions,
    { 
        sourceId: 'discard_cards', 
        targetType: 'hand',      // ← UI 层走场景直选模式
        multi: { min: 2, max: 2 },  // ← 多选模式
    }
);

// UI 层：场景直选 + 多选
// 1. Board.tsx 检测到 targetType === 'hand'
// 2. isHandDiscardPrompt = true
// 3. 隐藏 PromptOverlay
// 4. 在 HandArea 中高亮所有手牌
// 5. 用户点击2张卡牌（显示选中状态）
// 6. 点击"确认"按钮 → dispatch INTERACTION_RESPOND
```

**用户体验**：
- ✅ 看到手牌区所有卡牌高亮
- ✅ 点击卡牌切换选中状态（显示勾选标记）
- ✅ 选够2张后点击"确认"按钮
- ✅ 不需要打开弹窗

## 操作选项的处理

### 问题：场景直选模式下，操作选项（skip/done/cancel）如何可达？

**解决方案**：浮动按钮

```typescript
// Board.tsx 中提取操作选项
const minionSelectExtraOptions = useMemo(() => {
    if (!isMinionSelectPrompt || !currentPrompt) return [];
    
    // 使用排除法：没有目标字段 → 操作选项
    return currentPrompt.options.filter(opt => {
        const v = opt.value as any;
        // 排除目标选项（有 minionUid 字段）
        if (v?.minionUid !== undefined) return false;
        // 保留操作选项（skip/done/cancel 等）
        return true;
    });
}, [isMinionSelectPrompt, currentPrompt]);

// 渲染浮动按钮
{minionSelectExtraOptions.length > 0 && (
    <div className="fixed bottom-4 right-4 flex gap-2">
        {minionSelectExtraOptions.map(opt => (
            <SmashUpGameButton 
                key={opt.id}
                onClick={() => handlePromptSelect(opt.id)}
            >
                {opt.label}
            </SmashUpGameButton>
        ))}
    </div>
)}
```

**用户体验**：
- ✅ 场景中高亮候选随从（点击选择）
- ✅ 右下角显示"跳过"按钮（点击跳过）
- ✅ 两种操作方式都可达

## 最佳实践

### 1. 优先使用场景直选

**原因**：
- 更直观（直接点击目标）
- 减少弹窗层级
- 更符合桌游体验

**适用场景**：
- 选择基地 → `targetType: 'base'`
- 选择随从 → `targetType: 'minion'`
- 选择手牌 → `targetType: 'hand'`

### 2. 弹窗用于复杂选择

**适用场景**：
- 是/否确认 → `targetType: 'generic'` 或不声明
- 多种不同类型的选项 → `targetType: 'generic'`
- 从弃牌堆/牌库选择 → `targetType: 'discard_minion'`

### 3. 操作选项必须可达

**规则**：
- 场景直选模式下，操作选项（skip/done/cancel）必须通过浮动按钮可达
- 使用排除法过滤操作选项（排除有目标字段的选项）
- 禁止硬编码操作选项的字段名（如只匹配 `skip`，会遗漏 `done`）

## 总结

### 当前 UI 渲染模式

| 场景 | targetType | UI 模式 | 用户操作 |
|------|-----------|---------|---------|
| 托尔图加移动随从 | `'minion'` | 场景直选 | 点击棋盘上的随从 |
| 海盗王确认移动 | `undefined` | 弹窗 | 点击弹窗中的按钮 |
| 弃牌 | `'hand'` | 场景直选 | 点击手牌区的卡牌 |
| 粗鲁少妇消灭随从 | `'minion'` | 场景直选 | 点击棋盘上的随从 |
| 僵尸领主从弃牌堆打出 | `'discard_minion'` | 弹窗 | 点击弹窗中的卡牌 |

### 关键优势

✅ **数据驱动**：`targetType` 字段决定 UI 模式，无需修改 UI 代码  
✅ **场景直选优先**：90% 的选择走场景直选，更直观  
✅ **操作选项可达**：浮动按钮确保 skip/done/cancel 始终可达  
✅ **向后兼容**：未声明 `targetType` 时自动降级为弹窗模式
