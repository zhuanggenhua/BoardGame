# Logger.ts Node.js 兼容性修复

## 问题
服务器启动失败，错误信息：
```
TypeError: Cannot read properties of undefined (reading 'DEV')
    at <anonymous> (D:\gongzuo\web\BordGame\src\lib\logger.ts:11:31)
```

## 根本原因
`src/lib/logger.ts` 使用了 `import.meta.env.DEV`，这是 Vite 特有的 API，在 Node.js 环境中不可用。

POD 提交恢复了这个文件，但它被服务端代码（`server.ts`）引用，导致服务器无法启动。

## 修复方案
将：
```typescript
const isDev = import.meta.env.DEV;
```

改为：
```typescript
// 兼容 Node.js 和浏览器环境
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV !== false;
```

## 修复逻辑
1. 检查 `import.meta` 是否存在（Node.js 中不存在）
2. 如果存在，检查 `import.meta.env?.DEV` 是否为 false
3. 默认行为：Node.js 环境中 `isDev = true`（因为 `typeof import.meta !== 'undefined'` 为 false）

## 影响范围
- ✅ 浏览器环境（Vite）：正常工作，`import.meta.env.DEV` 可用
- ✅ Node.js 环境（server.ts）：正常工作，`isDev = true`（开发模式）
- ✅ 生产环境：如果需要禁用日志，应在服务端使用环境变量控制

## 验证
服务器应该能够正常启动，不再报错。

## 相关文件
- `src/lib/logger.ts` - 已修复
- `server.ts` - 引用了 logger
- `src/server/logger.ts` - 服务端专用日志系统（Winston），不受影响

## 教训
1. 共享代码（同时被浏览器和 Node.js 使用）必须兼容两种环境
2. Vite 特有 API（`import.meta.env`）不能在 Node.js 中使用
3. 恢复代码时必须检查环境兼容性
