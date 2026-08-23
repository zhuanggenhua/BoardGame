# 本地自动反馈收口：Betrayal 旧 3D 测试页 loadModel 未定义

- 日期：2026-08-22
- 口径：本地数据库反馈；Mongo `boardgame.feedbacks`
- 反馈组：
  - `6a37763e38209c7325ec7266`
  - `6a37767c38209c7325ec7268`

## 自动检测场景

两条反馈都是 React 错误边界记录：

```text
ReferenceError: loadModel is not defined
at src/games/betrayal/BetrayalLocal3DTest.tsx
```

这是旧 Betrayal 本地 3D 测试页里的未定义函数调用。

## 当前树结论

当前仓库中已不存在 `src/games/betrayal/BetrayalLocal3DTest.tsx`，也没有 `loadModel` 引用。该崩溃入口已经失效，本轮不需要改业务代码。

## 验证记录

```text
Test-Path src/games/betrayal/BetrayalLocal3DTest.tsx
False

rg -n "loadModel" src -S
无命中

rg -n "BetrayalLocal3DTest" src -S
无命中
```

## 收口口径

按当前树已恢复 / 旧本地测试页反馈关闭。当前版本没有这个页面入口，也没有 `loadModel` 未定义调用可再次触发同类 React 错误边界。
