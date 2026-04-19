# 王权骰铸 - 响应窗口隐身模式

## 问题描述
**用户反馈**：当对方开启"手动响应"时，己方会看到"对手思考中"提示，这会暴露对方手里有响应牌，破坏了游戏的信息隐藏机制。

**音效问题**：响应窗口打开时，双方都会听到音效，这也会暴露对方有响应牌。

## 解决方案
**静默模式**：响应窗口期间不显示"对手思考中"提示，且只有响应者才播放音效，完全隐藏对手是否有响应牌的信息。

### 修改 1：UI 提示隐藏
**文件**：`src/games/dicethrone/Board.tsx`

**修改前**：
```typescript
// 等待对方思考（isFocusPlayer 已在上方定义）
const isWaitingOpponent = !isFocusPlayer;
const thinkingOffsetClass = 'bottom-[12vw]';
```

**修改后**：
```typescript
// 等待对方思考（isFocusPlayer 已在上方定义）
// 响应窗口期间不显示"对手思考中"提示，避免暴露对方有响应牌
const isWaitingOpponent = !isFocusPlayer && !isResponseWindowOpen;
const thinkingOffsetClass = 'bottom-[12vw]';
```

### 修改 2：音效隐藏
**文件**：`src/games/dicethrone/audio.config.ts`

**新增代码**：
```typescript
// RESPONSE_WINDOW_OPENED / RESPONSE_WINDOW_CLOSED：只有响应者才播放音效
// 避免暴露对方有响应牌的信息（信息隐藏原则）
if (type === 'RESPONSE_WINDOW_OPENED' || type === 'RESPONSE_WINDOW_CLOSED') {
    const payload = (event as AudioEvent & { payload?: { responderQueue?: string[] } }).payload;
    const responderQueue = payload?.responderQueue ?? [];
    const isResponder = currentPlayerId && responderQueue.includes(currentPlayerId);
    // 只有自己在响应者队列中时才播放音效
    if (!isResponder) return null;
    // 回退到框架默认音效
}
```

## 工作原理

### 修改前的行为
1. 响应窗口打开
2. 轮到对方响应
3. 己方看到"对手思考中"提示 ❌ **暴露对方有响应牌**
4. 己方听到响应窗口打开音效 ❌ **暴露对方有响应牌**
5. 对方选择响应或跳过

### 修改后的行为
1. 响应窗口打开
2. 轮到对方响应
3. 己方**不显示任何提示** ✅ **完全隐藏信息**
4. 己方**不播放任何音效** ✅ **完全隐藏信息**
5. 对方选择响应或跳过
   - 如果对方打出响应牌 → 己方看到卡牌效果并听到卡牌音效
   - 如果对方跳过 → 己方不知道对方是否有响应牌

### 用户体验
- **己方视角**：响应窗口期间画面和音效保持正常，不会有任何提示
- **对方视角**：如果自己是响应者，会看到"你的回合"提示、听到响应窗口打开音效、看到"跳过"按钮
- **信息隐藏**：完全隐藏对手是否有响应牌的信息，符合卡牌游戏的信息隐藏机制

## 验证结果

### TypeScript 编译检查
✅ **通过** - `npx tsc --noEmit` 无错误

### ESLint 检查
✅ **通过** - 无错误（只有 6 个警告，都是之前就存在的未使用变量）

## 相关功能

### autoResponse 功能（已恢复）
- **绿色"显示响应"（autoResponseEnabled = true）**：显示响应窗口，需要手动确认
- **灰色"自动跳过"（autoResponseEnabled = false）**：自动跳过响应窗口，不拦截游戏流程
- **持久化**：设置保存在 localStorage（`dicethrone:autoResponse`）
- **默认值**：默认开启（显示响应窗口）

### 响应窗口隐身模式（本次修改）
- **UI 隐藏**：响应窗口期间不显示"对手思考中"提示
- **音效隐藏**：只有响应者才播放响应窗口音效
- **信息隐藏**：完全隐藏对手是否有响应牌的信息

## 设计理念

### 信息隐藏原则
在卡牌游戏中，手牌信息是隐藏的。如果对手看到"对手思考中"提示或听到响应窗口音效，就能推断出：
1. 对手手里有响应牌
2. 对手正在考虑是否使用

这违反了信息隐藏原则。

### 解决方案
响应窗口期间不显示任何提示、不播放任何音效，让对手无法判断：
- 对手是否有响应牌
- 对手是否在思考
- 对手是否开启了"手动响应"

只有当对手实际打出响应牌时，己方才能看到效果和听到音效。

## 音效设计细节

### 响应窗口音效
- **打开音效**：`ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.popup_a_001`
- **关闭音效**：`ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_close_001`

### 播放规则
- **响应者**：听到打开/关闭音效（提示自己可以响应）
- **非响应者**：不播放任何音效（避免暴露对方有响应牌）

### 实现方式
在 `feedbackResolver` 中检查 `responderQueue`，只有当 `currentPlayerId` 在队列中时才播放音效。

## 结论
✅ **响应窗口隐身模式已实现**，完全隐藏对手是否有响应牌的信息（UI + 音效），符合卡牌游戏的信息隐藏机制。

## 相关文件
- `src/games/dicethrone/Board.tsx` - UI 提示隐藏
- `src/games/dicethrone/audio.config.ts` - 音效隐藏
- `src/games/dicethrone/ui/GameHints.tsx` - 提示组件（无需修改）
- `evidence/POD-AUTORESPONSE-RECOVERY.md` - autoResponse 功能恢复详情
