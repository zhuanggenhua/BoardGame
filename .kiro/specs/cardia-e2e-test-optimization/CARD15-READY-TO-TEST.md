# 发明家调试材料已准备完成 ✅

## 📦 已创建的文件

| 文件名 | 用途 | 何时使用 |
|--------|------|----------|
| `CARD15-DEBUG-GUIDE.md` | 完整调试指南 | 第一次调试或需要详细步骤 |
| `CARD15-QUICK-DEBUG.md` | 速查卡 | 快速查找命令和预期结果 |
| `CARD15-INJECT-STATE.json` | 注入状态 JSON | 复制粘贴到控制台 |
| `CARD15-FINAL-STATUS.md` | 问题分析 | 理解根本原因和解决方案 |
| `CARD15-DEBUG-MATERIALS-READY.md` | 材料总览 | 了解所有文档的用途 |

---

## 🚀 快速开始（3 步）

### 1. 启动服务器
```bash
npm run dev
```

### 2. 打开浏览器并创建对局
- 打开两个浏览器窗口：http://localhost:3000
- 分别登录不同账号
- 创建 Cardia 游戏房间并加入

### 3. 开始调试
- 打开 `CARD15-QUICK-DEBUG.md`（速查卡）
- 按照步骤执行
- 记录结果

---

## 📋 调试清单

### 准备阶段
- [ ] 服务器已启动（`npm run dev`）
- [ ] 两个浏览器窗口已打开
- [ ] 在线对局已创建
- [ ] P1 控制台已打开（F12）

### 注入状态
- [ ] 使用调试面板 UI：点击 "Debug" → "State" → "Toggle Input" → 粘贴 JSON → "Apply"
- [ ] 或使用控制台：执行调试面板 API 代码（见 CARD15-DEBUG-GUIDE.md）
- [ ] 看到状态更新完成

### 打出卡牌
- [ ] P1 打出发明家（影响力 15）
- [ ] P2 打出精灵（影响力 16）
- [ ] 进入能力阶段（P1 失败）

### 第一次交互
- [ ] 交互前：记录 `inventorPending` 和 `modifierTokens`
- [ ] 选择第一张卡牌并确认
- [ ] 交互后：记录 `inventorPending` 和 `modifierTokens`
- [ ] 检查第一个修正标记的值（应该是 3）

### 第二次交互
- [ ] 交互前：记录 `inventorPending` 和 `modifierTokens`
- [ ] 选择第二张卡牌并确认
- [ ] 交互后：记录 `inventorPending` 和 `modifierTokens`
- [ ] 检查第二个修正标记的值（当前是 3，应该是 -3）

### 记录结果
- [ ] 第一次交互后 `inventorPending` 的值
- [ ] 第一次交互后第一个修正标记的值
- [ ] 第二次交互前 `inventorPending` 的值
- [ ] 第二次交互后 `inventorPending` 的值
- [ ] 第二次交互后第二个修正标记的值
- [ ] 第二次交互处理器日志中的 `hasPendingFlag` 值

---

## 🔍 关键检查命令

### 一键检查状态
```javascript
const s = window.__BG_TEST_HARNESS__.state.get();
console.log('inventorPending:', s.core.inventorPending);
console.log('修正标记:', s.core.modifierTokens.filter(t => t.source === 'ability_i_inventor'));
```

### 搜索关键日志（Ctrl+F）
- `[Inventor] Interaction handler called`
- `[CardiaEventSystem]`
- `MODIFIER_TOKEN_PLACED`

---

## 🎯 预期结果 vs 当前结果

### 第一次交互后
| 项目 | 预期 | 当前 |
|------|------|------|
| `inventorPending` | `{ playerId: '0', ... }` | ✅ 正确 |
| `modifierTokens count` | `1` | ✅ 正确 |
| 第一个修正标记值 | `3` | ✅ 正确 |

### 第二次交互后
| 项目 | 预期 | 当前 |
|------|------|------|
| `inventorPending` | `undefined` | ❓ 待确认 |
| `modifierTokens count` | `2` | ✅ 正确 |
| 第二个修正标记值 | `-3` | ❌ 错误（是 `3`） |

---

## 🐛 当前问题

**症状**：第二次交互放置的是 +3 而不是 -3

**根本原因**：第二次交互处理器被调用时，`state.core.inventorPending` 为 `undefined`

**判断逻辑**：
```typescript
const isFirstInteraction = !state.core.inventorPending;
// 如果 inventorPending 为 undefined，则 isFirstInteraction = true
// 导致错误地认为这是第一次交互，放置 +3
```

**需要确认**：第二次交互处理器日志中的 `hasPendingFlag` 值
- 如果是 `false`，说明状态传递有问题 → 使用方案 E
- 如果是 `true`，说明判断逻辑有问题 → 检查代码

---

## 💡 解决方案（方案 E）

**核心思路**：第一次交互时不清理 `inventorPending`，只在第二次交互时清理

**修改点**：
```typescript
if (isFirstInteraction) {
    // 第一次交互：放置 +3，保持 inventorPending（不清理）
    return {
        state,  // 不修改 state，保持 inventorPending
        events: [{ type: MODIFIER_TOKEN_PLACED, payload: { value: 3, ... } }],
    };
} else {
    // 第二次交互：放置 -3，清理 inventorPending
    return {
        state: { ...state, core: { ...state.core, inventorPending: undefined } },
        events: [{ type: MODIFIER_TOKEN_PLACED, payload: { value: -3, ... } }],
    };
}
```

**为什么这样可以工作**：
1. 第一次交互后，`inventorPending` 仍然存在
2. `CardiaEventSystem` 检测到 `inventorPending`，创建第二次交互
3. 第二次交互响应时，`state.core.inventorPending` 仍然存在（因为第一次没有清理）
4. 所以 `isFirstInteraction = false`，正确放置 -3

---

## 📊 调试结果记录表

请在测试后填写：

### 第一次交互
- `inventorPending` 交互前：__________
- `inventorPending` 交互后：__________
- 第一个修正标记值：__________
- 日志中的 `isFirstInteraction`：__________
- 日志中的 `hasPendingFlag`：__________

### 第二次交互
- `inventorPending` 交互前：__________
- `inventorPending` 交互后：__________
- 第二个修正标记值：__________
- 日志中的 `isFirstInteraction`：__________
- 日志中的 `hasPendingFlag`：__________（**最关键**）

---

## 📚 文档导航

- **快速开始** → `CARD15-QUICK-DEBUG.md`
- **详细步骤** → `CARD15-DEBUG-GUIDE.md`
- **注入状态** → `CARD15-INJECT-STATE.json`
- **问题分析** → `CARD15-FINAL-STATUS.md`
- **材料总览** → `CARD15-DEBUG-MATERIALS-READY.md`

---

## ⏱️ 预计时间

- 准备和启动：2 分钟
- 注入状态和打牌：1 分钟
- 第一次交互调试：2 分钟
- 第二次交互调试：2 分钟
- 记录和分析：3 分钟
- **总计：约 10 分钟**

---

## ✅ 准备就绪

所有材料已准备完成，可以开始手动测试了！

**推荐流程**：
1. 打开 `CARD15-QUICK-DEBUG.md`（速查卡）
2. 打开 `CARD15-INJECT-STATE.json`（准备复制）
3. 启动服务器并创建对局
4. 按照速查卡执行测试
5. 记录结果（特别是 `hasPendingFlag` 的值）
6. 根据结果决定下一步行动

祝调试顺利！如果遇到问题，随时查看 `CARD15-DEBUG-GUIDE.md` 的详细指导。🚀
