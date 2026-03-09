# 发明家调试速查卡

## 快速开始

### 1. 启动服务器
```bash
npm run dev
```

### 2. 打开两个浏览器窗口
- 窗口 1（P1）：http://localhost:3000
- 窗口 2（P2）：http://localhost:3000

### 3. 创建在线对局
- 两个窗口分别登录不同账号
- 创建 Cardia 游戏房间
- 两个玩家加入

### 4. 注入状态（使用调试面板）

**方法 1：使用调试面板 UI（推荐）**
1. 在 P1 窗口中，点击右下角的 "Debug" 按钮打开调试面板
2. 切换到 "State" 标签页
3. 点击 "Toggle Input" 按钮显示输入框
4. 复制 `CARD15-INJECT-STATE.json` 的内容并粘贴到输入框
5. 点击 "Apply" 按钮

**方法 2：使用控制台（备选）**
```javascript
// 在 P1 控制台（F12）执行：
const state = {
  // 粘贴 CARD15-INJECT-STATE.json 的内容
};

// 使用调试面板 API 注入
const debugPanel = document.querySelector('[data-testid="debug-panel"]');
if (!debugPanel || !debugPanel.style.display || debugPanel.style.display === 'none') {
  document.querySelector('[data-testid="debug-toggle"]').click();
}
await new Promise(r => setTimeout(r, 500));
document.querySelector('[data-testid="debug-tab-state"]').click();
await new Promise(r => setTimeout(r, 200));
document.querySelector('[data-testid="debug-state-toggle-input"]').click();
await new Promise(r => setTimeout(r, 200));
const input = document.querySelector('[data-testid="debug-state-input"]');
input.value = JSON.stringify(state);
document.querySelector('[data-testid="debug-state-apply"]').click();
```

### 5. 打出卡牌
- P1 打出发明家（15）
- P2 打出精灵（16）
- P1 失败，进入能力阶段

### 6. 激活能力并调试

#### 第一次交互前
```javascript
console.log('=== 第一次交互前 ===');
console.log('inventorPending:', window.__BG_TEST_HARNESS__.state.get().core.inventorPending);
console.log('modifierTokens:', window.__BG_TEST_HARNESS__.state.get().core.modifierTokens);
```

#### 选择第一张卡牌并确认

#### 第一次交互后
```javascript
console.log('=== 第一次交互后 ===');
const s1 = window.__BG_TEST_HARNESS__.state.get();
console.log('inventorPending:', s1.core.inventorPending);
console.log('modifierTokens count:', s1.core.modifierTokens.length);
console.log('第一个修正标记值:', s1.core.modifierTokens[0]?.value);
```

#### 第二次交互前
```javascript
console.log('=== 第二次交互前 ===');
const s2 = window.__BG_TEST_HARNESS__.state.get();
console.log('inventorPending:', s2.core.inventorPending);
console.log('modifierTokens count:', s2.core.modifierTokens.length);
```

#### 选择第二张卡牌并确认

#### 第二次交互后
```javascript
console.log('=== 第二次交互后 ===');
const s3 = window.__BG_TEST_HARNESS__.state.get();
console.log('inventorPending:', s3.core.inventorPending);
console.log('modifierTokens count:', s3.core.modifierTokens.length);
const tokens = s3.core.modifierTokens.filter(t => t.source === 'ability_i_inventor');
console.log('修正标记值:', tokens.map(t => t.value));
```

---

## 关键日志搜索

在控制台中按 Ctrl+F 搜索：

1. `[Inventor] Interaction handler called` - 查看交互处理器调用
2. `[CardiaEventSystem]` - 查看事件系统日志
3. `MODIFIER_TOKEN_PLACED` - 查看修正标记放置事件

---

## 预期结果

### 第一次交互后
- `inventorPending`: `{ playerId: '0', timestamp: ... }`
- `modifierTokens count`: `1`
- 第一个修正标记值: `3`

### 第二次交互后
- `inventorPending`: `undefined`
- `modifierTokens count`: `2`
- 修正标记值: `[3, -3]` 或 `[-3, 3]`

---

## 当前问题

**症状**：两个修正标记都是 +3

**原因**：第二次交互处理器被调用时，`state.core.inventorPending` 为 `undefined`

**需要确认**：
1. 第二次交互处理器的日志中，`hasPendingFlag` 的值是什么？
2. 如果是 `false`，说明状态传递有问题

---

## 一键检查命令

```javascript
const state = window.__BG_TEST_HARNESS__.state.get();
console.log('阶段:', state.core.phase);
console.log('inventorPending:', state.core.inventorPending);
console.log('修正标记数量:', state.core.modifierTokens.length);
console.log('发明家修正标记:', state.core.modifierTokens.filter(t => t.source === 'ability_i_inventor'));
```

---

## 记录结果

完成测试后，请记录：

1. 第一次交互后 `inventorPending` 的值：__________
2. 第一次交互后第一个修正标记的值：__________
3. 第二次交互前 `inventorPending` 的值：__________
4. 第二次交互后 `inventorPending` 的值：__________
5. 第二次交互后第二个修正标记的值：__________
6. 第二次交互处理器日志中的 `hasPendingFlag`：__________

---

## 完整文档

详细步骤和问题排查，请参考：
- `CARD15-DEBUG-GUIDE.md` - 完整调试指南
- `CARD15-INJECT-STATE.json` - 注入状态 JSON
- `CARD15-FINAL-STATUS.md` - 问题分析和解决方案
