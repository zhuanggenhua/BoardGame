# localStorage 服务端错误修复

## 问题描述

在测试 Daze 机制时，服务端执行 `ADVANCE_PHASE` 命令时崩溃：

```
ReferenceError: localStorage is not defined
    at getAutoResponseEnabled (src/games/dicethrone/ui/AutoResponseToggle.tsx:64:20)
    at checkAfterAttackResponseWindow (src/games/dicethrone/domain/flowHooks.ts:163:41)
```

## 根本原因

`getAutoResponseEnabled()` 函数直接访问 `localStorage`，但在服务端环境（Node.js）中没有 `localStorage` 对象。

**调用链路**：
1. 服务端执行 `ADVANCE_PHASE` 命令
2. `FlowSystem.beforeCommand` → `executePhaseAdvance`
3. `flowHooks.onPhaseExit` → `checkAfterAttackResponseWindow`
4. `getAutoResponseEnabled()` → 访问 `localStorage` → 💥 崩溃

## 修复方案

在 `getAutoResponseEnabled()` 中添加环境检查：

```typescript
// ❌ 旧代码（会在服务端崩溃）
export const getAutoResponseEnabled = (): boolean => {
    const stored = localStorage.getItem(AUTO_RESPONSE_KEY);
    return stored === null ? true : stored === 'true';
};

// ✅ 新代码（服务端安全）
export const getAutoResponseEnabled = (): boolean => {
    // 服务端环境没有 localStorage，默认开启（显示响应窗口）
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return true;
    }
    const stored = localStorage.getItem(AUTO_RESPONSE_KEY);
    return stored === null ? true : stored === 'true';
};
```

## 修复位置

**文件**: `src/games/dicethrone/ui/AutoResponseToggle.tsx`

**修改内容**:
- 添加 `typeof window === 'undefined'` 检查（服务端环境）
- 添加 `typeof localStorage === 'undefined'` 检查（兼容性）
- 服务端环境返回默认值 `true`（开启响应窗口）

## 为什么这样修复

1. **服务端需要执行游戏逻辑**：`flowHooks.onPhaseExit` 在服务端执行，用于判断是否需要打开响应窗口
2. **localStorage 是客户端特性**：只有浏览器环境才有 `localStorage`
3. **默认值合理**：服务端默认开启响应窗口（`true`），与客户端默认行为一致

## 影响范围

- ✅ 服务端不再崩溃
- ✅ 客户端行为不变（仍然读取 localStorage）
- ✅ 默认行为一致（都是开启响应窗口）

## 测试验证

需要测试以下场景：
1. ✅ 服务端执行 `ADVANCE_PHASE` 不崩溃
2. ✅ 客户端仍然能正确读取/保存 localStorage
3. ✅ 响应窗口显示逻辑正确

## 相关问题

这个问题是在修复 Daze 机制时发现的，因为 Daze 会触发额外攻击，导致 `checkAfterAttackResponseWindow` 被调用。

## 教训

**UI 工具函数不应该直接访问浏览器 API**：
- ❌ 直接访问 `localStorage`/`sessionStorage`/`window`
- ✅ 添加环境检查（`typeof window !== 'undefined'`）
- ✅ 提供服务端安全的默认值

**领域层（domain/）不应该依赖 UI 层（ui/）**：
- `flowHooks.ts` 在服务端执行，不应该调用 UI 组件的函数
- 更好的设计：将 `getAutoResponseEnabled()` 移到 `domain/utils.ts`，或者通过配置注入
