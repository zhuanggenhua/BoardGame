# DiceThrone 单个骰子特写无法关闭问题修复

## 问题描述

用户反馈：DiceThrone 游戏中，单个骰子特写（如 Watch Out、Get Fired Up 等卡牌触发的单骰事件）显示后，点击任何地方都无法关闭。

## 根因分析

### 调用链检查

1. **UI 层**：`BonusDieOverlay` 组件使用 `SpotlightContainer` 包装
   - 单个骰子模式：传递 `onClose` 回调
   - `SpotlightContainer` 默认允许点击背景和内容关闭（`disableBackdropClose=false`, `closeOnContentClick=true`）

2. **状态管理**：`useCardSpotlight` Hook 管理骰子特写状态
   - `showBonusDie` 控制显示/隐藏
   - `handleBonusDieClose` 处理关闭逻辑

3. **问题根源**：`useCardSpotlight` 的 useEffect 依赖 `eventStreamEntries`
   ```typescript
   useEffect(() => {
       // ... 处理新事件
       if (pendingStandaloneBonusDie) {
           setBonusDieValue(pendingStandaloneBonusDie.value);
           setBonusDieFace(pendingStandaloneBonusDie.face);
           // ... 设置其他状态
           setShowBonusDie(true);  // 重新显示！
       }
   }, [eventStreamEntries, ...]);
   ```

### 问题流程

1. 用户点击关闭 → `handleBonusDieClose()` → `setShowBonusDie(false)`
2. 但骰子状态（`bonusDieValue`, `bonusDieFace` 等）仍然保留
3. 任何导致 `eventStreamEntries` 变化的事件（如其他玩家操作、回合推进）
4. useEffect 重新执行 → 检测到 `bonusDieValue !== undefined` → 判定为 `pendingStandaloneBonusDie`
5. 再次调用 `setShowBonusDie(true)` → 骰子特写又弹出来了

## 解决方案

修改 `handleBonusDieClose` 函数，在关闭时清除所有骰子状态：

```typescript
const handleBonusDieClose = useCallback(() => {
    spotlightLogger.info('bonus-close', { /* ... */ });
    setShowBonusDie(false);
    
    // 清除所有骰子状态，防止 useEffect 重新触发时又弹出
    setBonusDieValue(undefined);
    setBonusDieFace(undefined);
    setBonusDieEffectKey(undefined);
    setBonusDieEffectParams(undefined);
    setBonusDiceList(undefined);
    setBonusDieSummaryEffectKey(undefined);
    setBonusDieSummaryEffectParams(undefined);
    setBonusDieShowTotal(undefined);
    setBonusDieDisplayOnly(undefined);
    setBonusDieCharacterId(undefined);
}, [bonusDiceList?.length, bonusDieCharacterId, bonusDieEffectKey, bonusDieFace, bonusDieSummaryEffectKey, bonusDieValue]);
```

## 修改文件

- `src/games/dicethrone/hooks/useCardSpotlight.ts`：修改 `handleBonusDieClose` 函数，清除所有骰子状态
- `src/games/dicethrone/ui/BonusDieOverlay.tsx`：添加 `closeOnContentClick={!isInteractive}` 到多骰模式的 SpotlightContainer

## 问题扩展

在测试过程中发现，不仅单个骰子特写无法关闭，**多骰模式在非交互状态下也无法点击内容关闭**。

### 多骰模式问题

多骰模式（如神佑 Divine Blessing）有三种状态：
1. **可重掷**（`displayOnly=false`, `canReroll=true`）：需要玩家选择，禁用背景和内容点击 ✓
2. **无资源重掷**（`displayOnly=false`, `canReroll=false`）：仅展示结果，应允许点击关闭 ❌
3. **对手展示**（`displayOnly=true`）：仅展示结果，应允许点击关闭 ✓（自动关闭）

问题在于状态 2：虽然 `disableBackdropClose=false`（允许点击背景），但 `closeOnContentClick` 默认为 `true`，导致点击骰子内容时会关闭，但这与 `disableBackdropClose=false` 的语义不一致。

### 解决方案

添加 `closeOnContentClick={!isInteractive}` 参数：
- 当 `isInteractive=true`（可重掷）：禁用内容点击关闭
- 当 `isInteractive=false`（无资源或展示）：允许内容点击关闭

这样三种状态的行为都正确了。

## 验证方法

1. 启动游戏：`npm run dev`
2. 进入 DiceThrone 对局
3. 触发单个骰子特写（如使用 Watch Out 或 Get Fired Up 卡牌）
4. 点击骰子特写的任意位置或空白处
5. 验证骰子特写立即关闭且不再重新弹出

## 教训

### 状态管理原则

1. **关闭 UI 时必须清除完整状态**：不能只设置 `show=false`，必须清除所有相关状态
2. **useEffect 依赖检查**：当 useEffect 依赖外部状态时，必须考虑状态清理的完整性
3. **状态驱动 UI**：UI 的显示/隐藏应该由完整的状态决定，而不是单一的布尔标志

### 排查方法

1. **调用链全面检查**：从 UI 组件 → 事件处理 → 状态管理 → useEffect 依赖
2. **状态生命周期追踪**：检查状态的创建、更新、清除是否完整
3. **useEffect 依赖分析**：检查 useEffect 的依赖数组，确认哪些变化会触发重新执行

## 相关代码

- `src/games/dicethrone/ui/BonusDieOverlay.tsx`：骰子特写 UI 组件
- `src/games/dicethrone/ui/SpotlightContainer.tsx`：通用特写容器
- `src/games/dicethrone/hooks/useCardSpotlight.ts`：卡牌和骰子特写状态管理
- `src/games/dicethrone/Board.tsx`：游戏主界面，传递 `onBonusDieClose` 回调
