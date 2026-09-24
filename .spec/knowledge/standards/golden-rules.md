---
name: golden-rules
description: 项目黄金规则：高频硬边界和不可降级口径——开工前或复盘时查
metadata:
  type: doc
  status: 已交付
---

# Golden Rules

本文件只保留跨任务高频失误的硬规则。具体事故、长代码示例和单游戏经验不写在这里；需要排查时回到当前文件、代码 diff、测试输出和对应专项 skill。

## React 渲染

- Hooks 必须在组件顶层稳定调用；任何 `return`、条件分支或循环都不能改变 `useState`、`useEffect`、`useMemo`、`useCallback` 等调用顺序。
- `const` / `let` 在声明前不可引用。新增条件分支、debug 日志、菜单项、配置对象或回调时，先确认引用变量已经在上方声明。
- 父子组件都有 `useEffect` 且存在生产 / 消费关系时，必须同时支持两种时序：消费者先挂载、生产者先准备。不能假设父组件 effect 先执行。
- `useEffect` 不得无条件制造 `false -> true` 之类准备态翻转；如果该状态控制子树渲染，会触发卸载 / 重挂载并污染父级 ref。
- 跨模式、跨入口或跨对局共享的 Context / bridge / sync 写入必须有模式守卫和清理动作，防止一个模式的状态污染另一个模式。

## 运行时阻塞

- 白屏、渲染错误、函数未定义、模块加载失败时，先取证再改代码：跑最窄 E2E / 单测、看控制台和测试输出，锁定真实错误。
- 只要真实页面仍有 Vite overlay、动态模块加载失败、`ReferenceError` 或等价前端阻塞错误，截图落盘和断言通过都不能算验收。
- 用户说“之前正常、现在坏了”时，转入 [`regression-closeout`](regression-closeout.md)；不要在本文件复制回归流程。

## 模块与注册顺序

- Vite / vite-node / SSR 环境中不要依赖函数声明提升。注册表、能力表、路由表和导出入口必须在被引用实现之后组装，或显式拆成无循环依赖的模块。
- 文件顶部只放类型、常量、纯配置和无副作用 helper；会读取下方实现的注册调用放到文件末尾。
- 出现 `Cannot access ... before initialization`、`... is not defined` 或循环 import 迹象时，先查声明顺序、注册顺序和模块依赖方向。

## 高频交互

- 鼠标移动、拖拽、悬停、滚动和动画帧级交互优先用 ref / motion value 承载瞬时位置，避免把每一帧写进 React state。
- 拖拽、回弹和 hover 只能有一个权威控制源；不要混用浏览器事件、动画库自动回弹和手动回弹去写同一位置。
- 需要兜底结束的交互必须监听窗口级释放事件，并在业务重置时同步清理 ref、选中态、临时样式和动画状态。
- 元素会移动到鼠标下方时，不用纯 `whileHover` 作为业务状态来源；用进入 / 离开事件或显式命中判断。

## 音频

- `AudioContext.resume()` 是异步动作。调用后不得立即同步读取 `ctx.state` 来决定是否跳过播放；必须等待 resume 完成或走播放失败回调。
- HTML5 Audio 与 WebAudio 的解锁条件不同。BGM 若走浏览器原生 `<audio>`，不要用 WebAudio context 状态拦截。
- 用户手势解锁、首次播放、恢复播放和失败重试要各自有清晰生命周期；不能用静默失败或假成功掩盖浏览器自动播放限制。

## 证据边界

- 本文件只提供高频排查入口，不定义各专项的完整验收流程；最终证据回到 [`e2e-verification`](e2e-verification.md)、[`regression-closeout`](regression-closeout.md) 或命中的专项标准。
- 如果只做了止血、降噪、跳过或兜底，要按止血汇报，不能称为根因修复。
- 如果发现冲突，按 [`spec-steward`](../../skills/spec-steward/SKILL.md) 收口唯一主源，不在本文件新增反向覆盖。
