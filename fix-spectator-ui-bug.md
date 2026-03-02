# 修复观战模式 UI 不显示问题

## 问题描述
观战模式下，弃牌堆图标、牌库图标、手牌区域完全不显示（右下角空白）。

## 根本原因
```typescript
// Board.tsx 第 95 行
const myPlayer = playerID ? core.players[playerID] : undefined;

// Board.tsx 第 1732 行
{
    myPlayer && (  // ❌ 观战模式下 myPlayer 为 undefined，整个区域不渲染
        <div>
            <HandArea ... />
            <DeckDiscardZone ... />
        </div>
    )
}
```

观战模式下 `playerID` 为 `null`，导致 `myPlayer` 为 `undefined`，条件渲染失败。

## 修复方案
```typescript
// 观战模式下默认显示玩家 0 的视角
const myPlayer = playerID ? core.players[playerID] : core.players['0'];
```

## 修复位置
- `src/games/smashup/Board.tsx` 第 95 行

## 额外修复
移除了所有 `renderer` 类型 `CardPreview` 上的 `object-cover` / `object-contain` 类（共 9 处），因为 `SmashUpCardRenderer` 返回的是 `<div>` 而不是 `<img>`，这些 CSS 类对 `div` 无效。

修复位置：
- `src/games/smashup/ui/DeckDiscardZone.tsx` (2 处)
- `src/games/smashup/ui/BaseZone.tsx` (4 处)
- `src/games/smashup/ui/FactionSelection.tsx` (2 处)
- `src/games/smashup/ui/CardMagnifyOverlay.tsx` (1 处)

## 文档更新
更新 `AGENTS.md`，明确说明：
- 项目默认全部使用联机模式（online），本地模式已废弃
- 观战模式下应默认显示玩家 0 的视角

## 测试
观战模式下访问游戏，确认右下角能正常显示牌库和弃牌堆图标。
