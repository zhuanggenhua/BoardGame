# 本地反馈收口：移动端取证组件读取路由上下文崩溃

- 反馈 ID：`6a48e4c95c7d8647992b50f7`
- 口径：本地数据库（`mongodb://127.0.0.1:27017/boardgame.feedbacks`）
- 反馈内容：`[auto][react.error_boundary] Cannot read properties of null (reading 'useContext')`
- 自动检测场景：客户端进入 React 错误边界；堆栈显示发生在开发环境移动端取证组件 `MobileEvidenceCaptureAgent` 读取当前页面地址时。

## 原始症状保真

自动反馈记录的现实症状是：页面渲染过程中，移动端取证组件为了读取当前页面地址调用路由 hook，结果 React 路由上下文读取失败，页面被错误边界接住。

## 修复

`MobileEvidenceCaptureAgent` 的职责只是读取 `bgCapture` 等取证参数并执行取证脚本，不需要依赖 React Router。现在它直接从浏览器当前地址读取路径和查询参数，不再调用 `useLocation`，因此即使取证组件被放在没有 Router 的开发挂载环境里，也不会因为读取路由上下文打挂页面。

## 验证

红测：

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\components\system\__tests__\MobileEvidenceCaptureAgent.test.tsx --configLoader native
```

修复前结果：`1 failed`，错误为 `useLocation() may be used only in the context of a <Router> component.`

修复后：

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\components\system\__tests__\MobileEvidenceCaptureAgent.test.tsx --configLoader native
node scripts\infra\vitest-cli-safe.mjs run src\pages\__tests__\App.localRoute.test.tsx --configLoader native
npx eslint src\components\system\MobileEvidenceCaptureAgent.tsx src\components\system\__tests__\MobileEvidenceCaptureAgent.test.tsx src\lib\audio\__tests__\audioManager.test.ts
```

结果：

- `MobileEvidenceCaptureAgent.test.tsx`：`1 file passed / 1 test passed`
- `App.localRoute.test.tsx`：`1 file passed / 3 tests passed`
- ESLint：通过

## 回写建议

状态：`closed`

原因：真实开发取证崩溃已修复，取证组件不再依赖路由上下文；已补回归测试覆盖。
