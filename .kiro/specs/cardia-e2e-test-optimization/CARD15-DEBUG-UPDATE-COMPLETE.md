# 发明家调试指南更新完成 ✅

## 更新内容

已将所有调试文档从使用 `window.__BG_TEST_HARNESS__.state.patch()` 更新为使用**调试面板 API**（`applyCoreStateDirect`），与 E2E 测试保持一致。

---

## 更新的文件

### 1. CARD15-DEBUG-GUIDE.md
**更新内容**：步骤 1（注入测试状态）

**新方法**：
- **方法 1（推荐）**：使用调试面板 UI
  1. 点击右下角 "Debug" 按钮
  2. 切换到 "State" 标签
  3. 点击 "Toggle Input"
  4. 粘贴 `CARD15-INJECT-STATE.json` 的内容
  5. 点击 "Apply"

- **方法 2（备选）**：使用控制台执行调试面板 API 代码

### 2. CARD15-QUICK-DEBUG.md
**更新内容**：步骤 4（注入状态）

**新方法**：同上，提供了简化的说明

### 3. CARD15-READY-TO-TEST.md
**更新内容**：调试清单中的"注入状态"部分

**新方法**：
- 使用调试面板 UI：点击 "Debug" → "State" → "Toggle Input" → 粘贴 JSON → "Apply"
- 或使用控制台：执行调试面板 API 代码

### 4. CARD15-DEBUG-MATERIALS-READY.md
**更新内容**：CARD15-INJECT-STATE.json 的使用方法

**新方法**：同上

---

## 为什么要更新？

### 旧方法的问题
```javascript
// ❌ 旧方法：直接使用 TestHarness
window.__BG_TEST_HARNESS__.state.patch(STATE_JSON);
```

**问题**：
- `__BG_TEST_HARNESS__` 是测试专用 API，不是调试面板的标准接口
- 与 E2E 测试使用的方法不一致
- 可能在某些环境下不可用

### 新方法的优势
```javascript
// ✅ 新方法：使用调试面板 API
const input = document.querySelector('[data-testid="debug-state-input"]');
input.value = JSON.stringify(state.core);
document.querySelector('[data-testid="debug-state-apply"]').click();
```

**优势**：
- 使用标准的调试面板 UI 和 API
- 与 E2E 测试中的 `applyCoreStateDirect` 保持一致
- 更可靠，更易于维护
- 支持 UI 操作（推荐）和控制台操作（备选）

---

## 使用指南

### 推荐方式：调试面板 UI

**步骤**：
1. 打开游戏页面
2. 点击右下角的 "Debug" 按钮（或按 `Ctrl+Shift+D`）
3. 切换到 "State" 标签页
4. 点击 "Toggle Input" 按钮
5. 打开 `CARD15-INJECT-STATE.json`，复制内容
6. 粘贴到调试面板的输入框
7. 点击 "Apply" 按钮

**优点**：
- 简单直观
- 不需要写代码
- 可以看到状态更新的实时反馈

### 备选方式：控制台 API

**步骤**：
1. 打开浏览器控制台（F12）
2. 复制 `CARD15-DEBUG-GUIDE.md` 中的完整代码
3. 粘贴到控制台并执行

**优点**：
- 可以自动化整个流程
- 适合需要多次注入状态的场景
- 可以在脚本中使用

---

## 与 E2E 测试的一致性

### E2E 测试中的用法
```typescript
// e2e/helpers/cardia.ts
export const applyCoreStateDirect = async (page: Page, coreState: unknown) => {
    await ensureDebugStateTab(page);
    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    await toggleBtn.click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};
```

### 手动调试中的用法
```javascript
// 控制台中执行
const debugPanel = document.querySelector('[data-testid="debug-panel"]');
if (!debugPanel || !debugPanel.style.display || debugPanel.style.display === 'none') {
  document.querySelector('[data-testid="debug-toggle"]').click();
  await new Promise(r => setTimeout(r, 500));
}
document.querySelector('[data-testid="debug-tab-state"]').click();
await new Promise(r => setTimeout(r, 200));
document.querySelector('[data-testid="debug-state-toggle-input"]').click();
await new Promise(r => setTimeout(r, 200));
const input = document.querySelector('[data-testid="debug-state-input"]');
input.value = JSON.stringify(state.core);
document.querySelector('[data-testid="debug-state-apply"]').click();
```

**一致性**：
- 都使用相同的 `data-testid` 选择器
- 都通过调试面板的 UI 元素操作
- 都使用 `JSON.stringify` 序列化状态
- 都点击 "Apply" 按钮应用状态

---

## 调试面板 API 参考

### 关键元素

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 调试按钮 | `debug-toggle` | 打开/关闭调试面板 |
| 调试面板 | `debug-panel` | 调试面板容器 |
| State 标签 | `debug-tab-state` | 切换到状态标签页 |
| 输入切换按钮 | `debug-state-toggle-input` | 显示/隐藏输入框 |
| 状态输入框 | `debug-state-input` | 输入状态 JSON |
| 应用按钮 | `debug-state-apply` | 应用状态 |
| 状态显示 | `debug-state-json` | 显示当前状态 |

### 辅助函数（来自 e2e/helpers/cardia.ts）

```typescript
// 确保调试面板打开
export const ensureDebugPanelOpen = async (page: Page) => {
    const panel = page.getByTestId('debug-panel');
    if (await panel.isVisible().catch(() => false)) return;
    await page.getByTestId('debug-toggle').click();
    await expect(panel).toBeVisible({ timeout: 5000 });
};

// 切换到状态标签页
export const ensureDebugStateTab = async (page: Page) => {
    await ensureDebugPanelOpen(page);
    const stateTab = page.getByTestId('debug-tab-state');
    if (await stateTab.isVisible().catch(() => false)) {
        await stateTab.click();
    }
};

// 读取当前状态
export const readCoreState = async (page: Page): Promise<Record<string, unknown>> => {
    await ensureDebugStateTab(page);
    const raw = await page.getByTestId('debug-state-json').innerText();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return (parsed?.core ?? (parsed as Record<string, unknown>)?.G?.core ?? parsed) as Record<string, unknown>;
};

// 注入状态
export const applyCoreStateDirect = async (page: Page, coreState: unknown) => {
    await ensureDebugStateTab(page);
    const toggleBtn = page.getByTestId('debug-state-toggle-input');
    await toggleBtn.click();
    const input = page.getByTestId('debug-state-input');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill(JSON.stringify(coreState));
    await page.getByTestId('debug-state-apply').click();
    await expect(input).toBeHidden({ timeout: 5000 }).catch(() => {});
};
```

---

## 快速参考

### 打开调试面板
```javascript
document.querySelector('[data-testid="debug-toggle"]').click();
```

### 切换到 State 标签
```javascript
document.querySelector('[data-testid="debug-tab-state"]').click();
```

### 读取当前状态
```javascript
const raw = document.querySelector('[data-testid="debug-state-json"]').innerText;
const state = JSON.parse(raw);
console.log(state);
```

### 注入状态（完整流程）
```javascript
// 1. 打开调试面板
document.querySelector('[data-testid="debug-toggle"]').click();
await new Promise(r => setTimeout(r, 500));

// 2. 切换到 State 标签
document.querySelector('[data-testid="debug-tab-state"]').click();
await new Promise(r => setTimeout(r, 200));

// 3. 打开输入框
document.querySelector('[data-testid="debug-state-toggle-input"]').click();
await new Promise(r => setTimeout(r, 200));

// 4. 填入状态
const input = document.querySelector('[data-testid="debug-state-input"]');
input.value = JSON.stringify(yourState);

// 5. 应用状态
document.querySelector('[data-testid="debug-state-apply"]').click();
```

---

## 总结

✅ 所有调试文档已更新为使用调试面板 API
✅ 与 E2E 测试保持一致
✅ 提供了 UI 操作（推荐）和控制台操作（备选）两种方式
✅ 包含完整的 API 参考和快速参考

现在可以使用标准的调试面板方式进行手动测试了！🚀
