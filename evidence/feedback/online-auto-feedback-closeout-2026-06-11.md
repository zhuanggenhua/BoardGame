# 线上自动反馈收口证据 - 2026-06-11

## 范围

- 线上反馈源：生产 Mongo `boardgame.feedbacks`
- 本轮处理对象：
  - `6a2a2a458061c85a5fc8b7c8`：首页入口 `HomeEntry` 未定义
  - `6a2a2a448061c85a5fc8b7c6`：首页外壳 `GlobalHUD` 未定义
  - `6a298f080729eb97ecd47683`：召唤战争棋盘渲染 `t is not defined`

## 收口依据

- `HomeEntry` / `GlobalHUD`：
  - 当前源码已改为同步入口导入，避免入口级命名导出懒加载崩溃。
  - 验证命令：`pnpm vitest run src/pages/__tests__/App.entrySource.test.ts src/pages/__tests__/App.localRoute.test.tsx src/lib/__tests__/homeV2Routing.test.ts --configLoader native`
  - 结果：3 个测试文件、11 个测试通过。
- 召唤战争 `t is not defined`：
  - 生产包反查显示错误点是手牌单卡放大按钮直接调用未定义 `t`。
  - 当前源码已由父级 `HandArea` 传入 `magnifyAriaLabel`，避免子组件引用未绑定翻译函数。
  - 验证命令：`pnpm vitest run src/games/summonerwars/__tests__/HandArea.render.test.tsx src/games/summonerwars/ui/__tests__/FactionSelectionAdapter.test.tsx --configLoader native`
  - 结果：2 个测试文件、15 个测试通过。

## 状态口径

- 以上三条反馈均按 `resolved` 收口。
- 反馈状态表示根因已定位、代码已修复或当前源码已无该 bug、定向验证已通过；不表示代码已提交、push 或生产已部署。
