# Client 本地反馈收口：Qidahen runtime preview 访问 maskUrl 初始化前崩溃

- 反馈 ID：`6a2e96af9a4b43b2ac4b12f0`
- 本轮口径：本地 Mongo 反馈库，`mongodb://127.0.0.1:27017/boardgame.feedbacks`
- 反馈原文：`[auto][react.error_boundary] Cannot access 'maskUrl' before initialization`
- 目标入口：`/dev/qidahen-runtime-preview`
- 目标文件：`src/pages/devtools/QidahenRuntimePreview.tsx`
- 验收口径：组件渲染时，`maskUrl` 必须在任何 effect、图片加载或 JSX 使用前声明，不能触发 JavaScript 的初始化前访问错误。

## 真实反馈状态

本地反馈记录来自 React 错误边界：

- 错误类型：`ReferenceError`
- 错误消息：`Cannot access 'maskUrl' before initialization`
- 页面组件：`QidahenRuntimePreview`
- 堆栈位置：`src/pages/devtools/QidahenRuntimePreview.tsx`，运行时报约 `220` 行

这个错误不是普通资源 404，也不是图片加载失败；它表示组件 render 过程中访问了一个还没完成初始化的 `const` 变量。

## 当前树核查

当前源码里 `maskUrl` 的声明已经位于共享 printed 预览加载 effect 之前：

- `const sharedPrintedMappings = React.useMemo(...)`
- `const maskUrl = React.useMemo(...)`
- 后续 effect 才执行 `image.src = maskUrl`

因此反馈栈对应的“初始化前访问”形状在当前树已恢复。

## 本轮改动

- `src/pages/devtools/__tests__/QidahenRuntimePreview.compatSource.test.ts`
  - 新增源代码顺序防回归断言：`maskUrl` 声明必须早于共享 printed 预览 effect 和 `image.src = maskUrl`。
  - 目的不是替代运行时渲染测试，而是锁住本条反馈的直接触发条件，避免后续把 `maskUrl` 再移到使用点之后。

## 验证

```text
node scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/QidahenRuntimePreview.compatSource.test.ts --configLoader native

1 file passed / 6 passed
```

```text
npx eslint src/pages/devtools/__tests__/QidahenRuntimePreview.compatSource.test.ts src/pages/devtools/QidahenRuntimePreview.tsx

passed
```

## 结论

本条反馈按“当前树已恢复 / 已失效”收口：本地反馈里的崩溃原因是 `maskUrl` 初始化前访问；当前源码已经先声明 `maskUrl` 再进入图片预览 effect，不再具备同一崩溃条件。本轮补了顺序防回归测试。
