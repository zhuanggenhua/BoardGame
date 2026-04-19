# 王权骰铸 - 自动响应文本修正

## 问题描述
AutoResponseToggle 组件的文本和实际行为不一致，导致用户困惑。

### 原始实现的问题
- **代码注释**：绿色（开启）= 显示响应窗口，灰色（关闭）= 自动跳过
- **UI 文本**：`enabled = true` 显示"自动响应"，`enabled = false` 显示"手动响应"
- **实际逻辑**：`autoResponseEnabled = true` 时不自动跳过（需要手动确认）

### 语义混乱
- `autoResponseEnabled = true` 应该表示"自动响应"，但实际上是"手动响应"
- `autoResponseEnabled = false` 应该表示"手动响应"，但实际上是"自动跳过"

## 解决方案
修正文本，使其与实际行为一致。

### 修改内容

#### 1. AutoResponseToggle.tsx 注释
**修改前**：
```typescript
/**
 * - 绿色（开启）= 显示响应窗口，需要手动确认
 * - 灰色（关闭）= 自动跳过响应窗口，不拦截游戏流程
 */
```

**修改后**：
```typescript
/**
 * - 绿色（开启）= 手动响应，显示响应窗口，需要手动确认
 * - 灰色（关闭）= 自动跳过，自动跳过响应窗口，不拦截游戏流程
 */
```

#### 2. AutoResponseToggle.tsx UI 文本
**修改前**：
```typescript
{enabled ? t('hud.autoResponse') : t('hud.manualResponse')}
```

**修改后**：
```typescript
{enabled ? t('hud.manualResponse') : t('hud.autoResponse')}
```

#### 3. 中文 i18n 文本
**修改前**：
```json
"autoResponseEnabled": "自动响应已启用",
"autoResponseDisabled": "自动响应已禁用",
"autoResponse": "自动响应",
"manualResponse": "手动响应"
```

**修改后**：
```json
"autoResponseEnabled": "手动响应已启用",
"autoResponseDisabled": "自动跳过已启用",
"autoResponse": "自动跳过",
"manualResponse": "手动响应"
```

#### 4. 英文 i18n 文本
**修改前**：
```json
"autoResponseEnabled": "Auto Response Enabled",
"autoResponseDisabled": "Auto Response Disabled",
"autoResponse": "Auto Response",
"manualResponse": "Manual Response"
```

**修改后**：
```json
"autoResponseEnabled": "Manual Response Enabled",
"autoResponseDisabled": "Auto Skip Enabled",
"autoResponse": "Auto Skip",
"manualResponse": "Manual Response"
```

## 修正后的语义

### enabled = true（绿色）
- **显示文本**："手动响应"
- **Tooltip**："手动响应已启用"
- **实际行为**：显示响应窗口，需要手动确认
- **图标**：⚡ Zap（绿色）

### enabled = false（灰色）
- **显示文本**："自动跳过"
- **Tooltip**："自动跳过已启用"
- **实际行为**：自动跳过响应窗口，300ms 后自动调用 responsePass()
- **图标**：⚡ ZapOff（灰色）

## 实际逻辑验证

### Board.tsx 中的自动跳过逻辑
```typescript
// 自动跳过逻辑：当响应窗口打开且自己是响应者时，如果是自动跳过模式（!autoResponseEnabled），自动跳过
React.useEffect(() => {
    // 灰色"自动跳过" = 自动跳过，不拦截
    // 绿色"手动响应" = 显示响应窗口，等待手动选择
    if (autoResponseEnabled || !isResponseWindowOpen || !currentResponderId || currentResponderId !== rootPid) return;
    // 延迟一小段时间确保 UI 状态同步
    const timer = setTimeout(() => {
        engineMoves.responsePass(currentResponderId);
    }, 300);
    return () => clearTimeout(timer);
}, [autoResponseEnabled, isResponseWindowOpen, currentResponderId, rootPid, engineMoves]);
```

**逻辑分析**：
- `if (autoResponseEnabled || ...)` → 如果 `autoResponseEnabled = true`，则 return（不自动跳过）
- 否则执行 `responsePass()` → 自动跳过

**结论**：
- `autoResponseEnabled = true` → 不自动跳过 → **手动响应** ✅
- `autoResponseEnabled = false` → 自动跳过 → **自动跳过** ✅

## 验证结果

### TypeScript 编译检查
✅ **通过** - `npx tsc --noEmit` 无错误

### 语义一致性
✅ **一致** - 文本、注释、实际行为完全一致

## 用户体验

### 开启"手动响应"（绿色）
- 看到绿色按钮，显示"手动响应"
- Tooltip 显示"手动响应已启用"
- 响应窗口打开时，显示"你的回合"提示和"跳过"按钮
- 需要手动选择响应或跳过

### 开启"自动跳过"（灰色）
- 看到灰色按钮，显示"自动跳过"
- Tooltip 显示"自动跳过已启用"
- 响应窗口打开时，300ms 后自动跳过
- 无需手动操作，游戏流程不中断

## 结论
✅ **文本已修正**，与实际行为完全一致，用户不会再困惑。

## 相关文件
- `src/games/dicethrone/ui/AutoResponseToggle.tsx` - 组件代码和注释
- `public/locales/zh-CN/game-dicethrone.json` - 中文文本
- `public/locales/en/game-dicethrone.json` - 英文文本
- `src/games/dicethrone/Board.tsx` - 自动跳过逻辑
