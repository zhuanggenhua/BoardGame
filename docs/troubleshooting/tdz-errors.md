# TDZ 运行时错误排查

TDZ（Temporal Dead Zone）是 `const` / `let` 在声明前被访问导致的运行时错误，常见报错是 `Cannot access '<name>' before initialization`。

## 常见来源

- 调试日志写在变量声明前。
- 条件分支里提前读取后面才声明的变量。
- 回调函数引用了尚未初始化的局部变量。
- 组件参数少解构了字段，却在函数体里直接使用。

## 检查顺序

```bash
npm run typecheck
npm run lint
npm run test -- <相关测试文件>
```

TypeScript 不能覆盖所有 TDZ，因为 TDZ 发生在运行时；最终仍要跑到相关代码路径。

## 修复原则

- 变量先声明，再使用；调试日志放到所有依赖声明之后。
- 不靠条件分支假设“这段不会执行”。
- React 组件参数需要什么就显式解构什么。
- 如果只在 E2E 才复现，先锁具体入口和触发路径，再改代码。

提交前的通用检查入口见 [`development-checklist`](../development-checklist.md)。
