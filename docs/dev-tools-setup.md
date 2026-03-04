# Chrome DevTools 配置指南

## 问题
控制台日志中充斥大量 React 内部堆栈信息（`commitPassiveMountOnFiber`、`recursivelyTraversePassiveMountEffects` 等），完全无用且干扰排查。

## 一劳永逸的解决方案

### ⭐ 方案 1：配置 Chrome DevTools Ignore List（强烈推荐）

**这是唯一能从根源上完全隐藏框架堆栈的方法。**

#### 配置步骤：
1. 打开 Chrome DevTools（F12）
2. 按 **F1** 打开设置
3. 找到 **"Ignore List"** 部分
4. 勾选 **"Enable Ignore Listing"**
5. 勾选 **"Automatically add known third-party scripts to ignore list"**
6. 点击 **"Add pattern"** 添加以下模式：
   ```
   /node_modules/
   /react-dom/
   /@sentry/
   /framer-motion/
   ```

#### 效果：
- ✅ React 内部堆栈**完全不显示**
- ✅ 只显示你的业务代码堆栈
- ✅ 配置一次，永久生效（保存在浏览器配置中）
- ✅ 所有项目通用

### 方案 2：使用全局日志工具（已实现）

项目提供了 `src/lib/logger.ts` 工具，自动清理框架堆栈：
- 自动过滤 `react-dom`、`@sentry`、`framer-motion` 等框架代码
- 只显示业务代码的调用堆栈
- 自动折叠详细信息

使用示例：
```typescript
import { logger } from '@/lib/logger';

// 错误日志（自动清理堆栈）
logger.error(
  '交互选项为空',
  { 交互ID: 'xxx', 来源: 'yyy' },
  ['检查能力源码', '是否需要添加 optionsGenerator']
);

// 调试日志（默认折叠）
logger.debug('原始数据', data1, data2);
```

### 方案 3：配置 Error.stackTraceLimit（已配置）

项目已在 `src/main.tsx` 中配置：
```typescript
if (import.meta.env.DEV) {
  Error.stackTraceLimit = 10; // 限制堆栈深度为 10 层
}
```

### 方案 4：控制台过滤（临时方案，不推荐）

在控制台右上角的过滤框中输入：
```
-react-dom -@sentry -framer-motion -commitPassive -recursivelyTraverse
```

**缺点**：每次刷新页面都要重新输入，不是长久之计。

## 效果对比

### 配置前（100+ 行噪音）
```
commitPassiveMountOnFiber @ react-dom_client.js:11033
recursivelyTraversePassiveMountEffects @ react-dom_client.js:11010
commitPassiveMountOnFiber @ react-dom_client.js:11201
recursivelyTraversePassiveMountEffects @ react-dom_client.js:11010
... (重复 100+ 行)
[PromptOverlay] 交互详情: { ... }
```

### 配置后（只显示业务代码）
```
❌ 交互选项为空 (pirate-broadside)
  ▶ 详细信息
  ▶ 💡 排查建议
  ▶ 📍 调用堆栈
    at PromptOverlay (PromptOverlay.tsx:215)
    at Board (Board.tsx:89)
```

## 推荐配置顺序

1. **必做**：配置 Chrome DevTools Ignore List（方案 1）
2. **已完成**：使用项目的 logger 工具（方案 2）
3. **已完成**：Error.stackTraceLimit 限制（方案 3）

## 团队协作

建议将此配置加入团队文档，新成员入职时配置一次即可。所有开发者都应该配置 Chrome DevTools Ignore List，这是最有效的解决方案。
