# 发明家调试材料准备完成

## 已创建的文档

### 1. CARD15-DEBUG-GUIDE.md（完整调试指南）
**用途**：详细的手动测试步骤和问题排查指南

**内容**：
- 问题概述和根本原因分析
- 完整的手动测试步骤（从启动服务器到记录结果）
- 关键日志搜索指南
- 问题排查清单
- 调试结果记录表

**适合**：第一次调试或需要详细指导时使用

---

### 2. CARD15-INJECT-STATE.json（注入状态 JSON）
**用途**：可以直接复制粘贴到控制台的状态 JSON

**使用方法**：
```javascript
// 方法 1：使用调试面板 UI（推荐）
// 1. 点击右下角 "Debug" 按钮
// 2. 切换到 "State" 标签
// 3. 点击 "Toggle Input"
// 4. 粘贴 JSON 内容
// 5. 点击 "Apply"

// 方法 2：使用控制台（备选）
const state = { /* 粘贴 JSON 内容 */ };
// 使用调试面板 API 注入（见 CARD15-DEBUG-GUIDE.md）
```

**状态说明**：
- P1 手牌：发明家（影响力 15）
- P2 手牌：精灵（影响力 16）
- P1 场上：外科医生（影响力 3）
- P2 场上：木偶师（影响力 10，有 1 个印戒）
- 当前阶段：play（打牌阶段）
- 当前玩家：P1

---

### 3. CARD15-QUICK-DEBUG.md（速查卡）
**用途**：快速参考，包含所有关键命令和预期结果

**内容**：
- 快速开始步骤（6 步）
- 关键日志搜索词
- 预期结果对照表
- 一键检查命令
- 结果记录表

**适合**：已经熟悉流程，需要快速查找命令时使用

---

### 4. CARD15-FINAL-STATUS.md（问题分析）
**用途**：当前问题的详细分析和解决方案

**内容**：
- 当前进展（已解决 vs 剩余问题）
- 根本原因分析
- 问题链路追踪
- 解决方案（方案 E）

**适合**：理解问题本质和设计解决方案时使用

---

## 调试流程概览

```
1. 启动服务器（npm run dev）
   ↓
2. 打开两个浏览器窗口
   ↓
3. 创建在线对局
   ↓
4. 在 P1 控制台注入状态（使用 CARD15-INJECT-STATE.json）
   ↓
5. 打出卡牌（P1: 发明家，P2: 精灵）
   ↓
6. 激活发明家能力
   ↓
7. 第一次交互：选择第一张卡牌
   ├─ 交互前：检查 inventorPending 和 modifierTokens
   ├─ 确认选择
   └─ 交互后：检查 inventorPending 和 modifierTokens
   ↓
8. 第二次交互：选择第二张卡牌
   ├─ 交互前：检查 inventorPending 和 modifierTokens
   ├─ 确认选择
   └─ 交互后：检查 inventorPending 和 modifierTokens
   ↓
9. 记录结果并分析
```

---

## 关键检查点

### ✅ 第一次交互后应该看到：
- `inventorPending`: `{ playerId: '0', timestamp: ... }`
- `modifierTokens count`: `1`
- 第一个修正标记值: `3`
- 控制台日志：`[Inventor] First interaction: placing +3 modifier and setting pending flag`

### ❌ 第二次交互后当前看到（问题）：
- `inventorPending`: 可能是 `undefined`（应该被清理）
- `modifierTokens count`: `2`
- 修正标记值: `[3, 3]`（应该是 `[3, -3]`）
- 控制台日志：`[Inventor] First interaction: ...`（应该是 `Second interaction`）

### ✅ 第二次交互后应该看到（预期）：
- `inventorPending`: `undefined`
- `modifierTokens count`: `2`
- 修正标记值: `[3, -3]` 或 `[-3, 3]`
- 控制台日志：`[Inventor] Second interaction: placing -3 modifier and clearing pending flag`

---

## 需要记录的关键信息

完成测试后，请记录以下信息（用于确定解决方案）：

### 第一次交互
1. 交互后 `inventorPending` 的值：__________
2. 交互后第一个修正标记的值：__________
3. 控制台日志中的 `isFirstInteraction`：__________
4. 控制台日志中的 `hasPendingFlag`：__________

### 第二次交互
5. 交互前 `inventorPending` 的值：__________
6. 交互后 `inventorPending` 的值：__________
7. 交互后第二个修正标记的值：__________
8. 控制台日志中的 `isFirstInteraction`：__________
9. 控制台日志中的 `hasPendingFlag`：__________

**最关键的信息**：第二次交互处理器被调用时，`hasPendingFlag` 的值是什么？
- 如果是 `false`，说明 `state.core.inventorPending` 为 `undefined`（状态传递问题）
- 如果是 `true`，说明判断逻辑有问题

---

## 下一步行动

根据调试结果，我们将：

1. **如果 `hasPendingFlag` 为 `false`**（状态传递问题）：
   - 实施方案 E：第一次交互时不清理 `inventorPending`，只在第二次交互时清理
   - 修改交互处理器的逻辑

2. **如果 `hasPendingFlag` 为 `true`**（判断逻辑问题）：
   - 检查判断逻辑：`const isFirstInteraction = !state.core.inventorPending;`
   - 可能需要使用其他方式判断（如 `interactionId`）

---

## 快速命令参考

### 注入状态
```javascript
window.__BG_TEST_HARNESS__.state.patch(STATE_JSON);
```

### 检查状态
```javascript
const s = window.__BG_TEST_HARNESS__.state.get();
console.log('inventorPending:', s.core.inventorPending);
console.log('modifierTokens:', s.core.modifierTokens.filter(t => t.source === 'ability_i_inventor'));
```

### 搜索日志
- `[Inventor] Interaction handler called`
- `[CardiaEventSystem]`
- `MODIFIER_TOKEN_PLACED`

---

## 文档使用建议

1. **第一次调试**：
   - 阅读 `CARD15-DEBUG-GUIDE.md`（完整指南）
   - 使用 `CARD15-INJECT-STATE.json`（注入状态）
   - 参考 `CARD15-QUICK-DEBUG.md`（快速命令）

2. **后续调试**：
   - 直接使用 `CARD15-QUICK-DEBUG.md`（速查卡）
   - 需要时查看 `CARD15-FINAL-STATUS.md`（问题分析）

3. **理解问题**：
   - 阅读 `CARD15-FINAL-STATUS.md`（根本原因）
   - 查看 `CARD15-DEBUG-GUIDE.md` 的"问题排查"部分

---

## 预计时间

- 启动服务器和创建对局：2 分钟
- 注入状态和打出卡牌：1 分钟
- 第一次交互调试：2 分钟
- 第二次交互调试：2 分钟
- 记录结果和分析：3 分钟
- **总计：约 10 分钟**

---

## 准备就绪

所有调试材料已准备完成，可以开始手动测试了！

**建议顺序**：
1. 先快速浏览 `CARD15-QUICK-DEBUG.md`（了解流程）
2. 打开 `CARD15-INJECT-STATE.json`（准备复制状态）
3. 启动服务器并开始测试
4. 遇到问题时查看 `CARD15-DEBUG-GUIDE.md`（详细指导）
5. 完成后记录结果并分析

祝调试顺利！🚀
