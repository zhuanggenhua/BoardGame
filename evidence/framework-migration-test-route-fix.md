# 框架迁移 - 测试路由修复

## 问题描述

E2E 测试失败，显示 "Game client not found" 错误。

## 根本原因

新的测试框架期望使用 `/play/:gameId` 路由（不带 `/test` 后缀），但这个路由之前指向 `MatchRoom` 组件，该组件需要 `matchId` 参数才能正常工作。当没有 `matchId` 时，`MatchRoom` 会显示 "Game client not found"。

## 解决方案

将 `/play/:gameId` 路由改为使用 `TestMatchRoom` 组件，该组件：
1. 使用 `LocalGameProvider`（而不是 `GameProvider`）
2. 启用 TestHarness
3. 允许通过 `game.setupScene()` 注入状态

## 实施的修改

### 1. 修改 `src/App.tsx`

```typescript
// 添加 TestMatchRoom 导入
const TestMatchRoom = React.lazy(() => import('./pages/TestMatchRoom').then(m => ({ default: m.TestMatchRoom })));

// 修改路由
<Route path="/play/:gameId" element={<React.Suspense fallback={<LoadingScreen />}><TestMatchRoom /></React.Suspense>} />
```

## 测试状态

### 第一次运行（修复前）
- 所有 3 个测试失败
- 错误：`Game client not found`
- 截图显示页面只有 Chat 按钮和错误消息

### 第二次运行（修复后）
- 测试超时（120秒）
- 服务器启动成功，但测试未完成
- 可能原因：
  1. Vite 服务器启动太慢
  2. TestMatchRoom 组件加载或初始化问题
  3. TestHarness 注册超时

## 下一步

1. 检查 TestMatchRoom 组件是否正确加载
2. 增加测试超时时间或优化服务器启动
3. 添加更多日志来定位具体的超时点
4. 考虑使用更简单的测试来验证路由是否正确

## 相关文件

- `src/App.tsx` - 路由配置
- `src/pages/TestMatchRoom.tsx` - 测试模式组件
- `e2e/framework/GameTestContext.ts` - 测试框架
- `e2e/framework-pilot-ninja-infiltrate.e2e.ts` - 测试文件

## 教训

1. 新的测试框架需要专门的测试路由和组件
2. `MatchRoom` 组件设计为在线对局使用，不适合 E2E 测试
3. 测试路由应该使用 `LocalGameProvider` 而不是 `GameProvider`
4. 需要确保 TestHarness 在测试开始前正确初始化
