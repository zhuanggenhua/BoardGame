# 便衣忍者交互不可见 Bug 调查

## 问题描述

用户在 Me First! 响应窗口中打出便衣忍者后，无法选择手牌中的随从卡。

## 根本原因

**`meFirstDisabledUids` 在 Me First! 响应窗口期间禁用了所有普通随从卡**，但便衣忍者创建的交互需要选择这些随从卡。

### 问题流程

1. Me First! 响应窗口打开 → `isMeFirstResponse = true`
2. 点击便衣忍者 → 进入基地选择模式（`specialNeedsBase: true`）
3. 点击基地 → 执行能力，创建交互（选择随从）
4. **但 `isMeFirstResponse` 仍然是 true** → `meFirstDisabledUids` 禁用了所有普通随从
5. 手牌中的随从卡被禁用 → 无法点击

### 代码位置

`src/games/smashup/Board.tsx` 第 504 行：

```typescript
const meFirstDisabledUids = useMemo<Set<string> | undefined>(() => {
    if (!isMeFirstResponse || !myPlayer) return undefined;
    const disabled = new Set<string>();
    for (const card of myPlayer.hand) {
        if (card.type === 'minion') {
            // beforeScoringPlayable 随从不禁用（影舞者等）
            const mDef = getMinionDef(card.defId);
            if (!mDef?.beforeScoringPlayable) {
                disabled.add(card.uid);  // ❌ 禁用了普通随从
            }
            continue;
        }
        // ... 禁用非 special 行动卡
    }
    return disabled.size > 0 ? disabled : undefined;
}, [isMeFirstResponse, myPlayer]);
```

## 修复方案

当有手牌选择交互（`isHandDiscardPrompt`）时，不应用 Me First! 的禁用规则，让交互系统自己控制哪些卡牌可选。

```typescript
const meFirstDisabledUids = useMemo<Set<string> | undefined>(() => {
    if (!isMeFirstResponse || !myPlayer) return undefined;
    // 有手牌选择交互时，不应用 Me First! 禁用规则（交互自己控制可选项）
    if (isHandDiscardPrompt) return undefined;  // ✅ 修复
    
    const disabled = new Set<string>();
    // ... 原有逻辑
}, [isMeFirstResponse, myPlayer, isHandDiscardPrompt]);
```

## Git 历史

- `8456a70`: 引入 `isHandDiscardPrompt` 概念（交互系统重构）
- `7cb4050`: 添加对随从的禁用逻辑（禁用非 `beforeScoringPlayable` 的随从）
- **但从未添加 `isHandDiscardPrompt` 的检查**

## 测试

已通过测试：
- ✅ 便衣忍者能力正确执行
- ✅ 交互正确创建（`targetType: 'hand'`）
- ✅ 手牌随从可以点击并响应交互
- ✅ ResponseWindowSystem 正确锁定窗口

## 状态

✅ **已修复** - 2025-01-XX
