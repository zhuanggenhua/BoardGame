# SmashUp - 牌库顶展示 UI Bug

## 问题描述

用户反馈：打出"盘旋机器人"（Hoverbot）后，牌库顶展示区域没有刷新，操作日志也没有更新。

## 根本原因

### 1. RevealOverlay 缺少 currentPlayerId prop

**位置**：`src/games/smashup/Board.tsx:1690`

**问题**：
```tsx
<RevealOverlay
    entries={eventStreamEntries}
/>
```

`RevealOverlay` 组件需要 `currentPlayerId` prop 来判断当前玩家是否有权限查看展示的卡牌，但调用时没有传递。

**修复**：
```tsx
<RevealOverlay
    entries={eventStreamEntries}
    currentPlayerId={rootPid}
/>
```

### 2. REVEAL_DECK_TOP 事件不生成操作日志

**位置**：`src/games/smashup/actionLog.ts`

**问题**：
`REVEAL_DECK_TOP` 事件没有在 `formatSmashUpActionEntry` 的 switch 语句中处理，因此不会生成操作日志条目。

**设计原因**：
- `REVEAL_DECK_TOP` 是纯 UI 事件，不修改 core 状态
- 按照原设计，这类事件不应该出现在操作日志中（操作日志只记录"有意义的玩家操作"）

**用户期望 vs 设计**：
- 用户期望：看到"P1 查看牌库顶"的日志条目
- 当前设计：REVEAL_DECK_TOP 只触发 RevealOverlay 浮层，不记录日志

## 影响范围

所有使用 `peekDeckTop` / `revealDeckTop` 的能力：
- 盘旋机器人（Hoverbot）
- 学徒（Neophyte）
- 聚集秘术（Mass Enchantment）
- 传送门（Portal）
- 行尸（Walker）
- 外星人侦察舰（Alien Scout Ship）

## 修复方案

### 方案 A：只修复 RevealOverlay prop（推荐）

**优点**：
- 最小改动
- 符合当前设计（REVEAL_DECK_TOP 是纯 UI 事件）
- RevealOverlay 浮层已经提供了足够的视觉反馈

**缺点**：
- 操作日志中不会有"查看牌库顶"的记录
- 刷新页面后无法回溯这些事件

**实现**：
只修复 Board.tsx 中的 prop 传递（已完成）

### 方案 B：同时添加操作日志支持

**优点**：
- 操作日志更完整
- 刷新后可以看到历史展示记录

**缺点**：
- 需要修改 actionLog.ts
- 可能导致日志过于冗长（每次查看牌库顶都记录）
- 与"操作日志只记录有意义的玩家操作"的设计原则冲突

**实现**：
```typescript
case SU_EVENTS.REVEAL_DECK_TOP: {
    const payload = event.payload as {
        targetPlayerId: PlayerId | PlayerId[];
        viewerPlayerId: PlayerId | 'all';
        cards: { uid: string; defId: string }[];
        reason?: string;
    };
    const targetIds = Array.isArray(payload.targetPlayerId) 
        ? payload.targetPlayerId 
        : [payload.targetPlayerId];
    const targetLabel = targetIds.map(id => `P${id}`).join(', ');
    const segments: ActionLogSegment[] = [i18nSeg('actionLog.revealDeckTop', {
        player: targetLabel,
        count: payload.cards.length,
    })];
    if (payload.reason) {
        segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
    }
    pushEntry(event.type, segments, actorId, entryTimestamp, index);
    break;
}
```

## 决策

采用方案 A（只修复 RevealOverlay prop）。

**理由**：
1. RevealOverlay 浮层已经提供了足够的视觉反馈（15 秒自动消失，点击关闭）
2. 保持操作日志简洁，只记录真正改变游戏状态的操作
3. REVEAL_DECK_TOP 是高频事件，记录日志会导致日志过于冗长

## 测试

### 手动测试步骤

1. 创建在线对局（Robots vs Aliens）
2. P1 打出"盘旋机器人"（Hoverbot）
3. 验证：
   - ✅ RevealOverlay 浮层正确显示牌库顶卡牌
   - ✅ 浮层显示正确的玩家标签（P1 的牌库顶）
   - ✅ 点击浮层可以关闭
   - ✅ 15 秒后自动消失
   - ⚠️ 操作日志中不会有"查看牌库顶"的记录（符合设计）

### E2E 测试

```typescript
test('盘旋机器人展示牌库顶', async ({ page }) => {
    const { p1, p2 } = await setupOnlineMatch(page, {
        gameId: 'smashup',
        factions: { '0': ['robots', 'aliens'], '1': ['ninjas', 'pirates'] },
    });

    // P1 打出盘旋机器人
    await p1.playMinion('robot_hoverbot', 0);

    // 验证 RevealOverlay 显示
    const overlay = p1.page.locator('[data-testid="reveal-overlay"]');
    await expect(overlay).toBeVisible();

    // 验证显示的是 P1 的牌库顶
    await expect(overlay.locator('h2')).toContainText('P0 的牌库顶');

    // 点击关闭
    await overlay.click();
    await expect(overlay).not.toBeVisible();
});
```

## 状态

- [x] 修复 RevealOverlay prop 传递
- [ ] 添加 E2E 测试（可选）
- [ ] 用户验证

## 相关文件

- `src/games/smashup/Board.tsx` - Board 组件
- `src/games/smashup/ui/RevealOverlay.tsx` - 牌库顶展示浮层
- `src/games/smashup/actionLog.ts` - 操作日志格式化
- `src/games/smashup/abilities/robots.ts` - 盘旋机器人能力
- `src/games/smashup/domain/abilityHelpers.ts` - peekDeckTop / revealDeckTop 辅助函数
