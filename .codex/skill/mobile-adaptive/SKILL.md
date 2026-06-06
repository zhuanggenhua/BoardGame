# Skill: mobile-adaptive（移动端优先适配与移植工作流）

本 Skill 用于把项目与单个游戏迁移到 **Mobile-First**：手机体验优先、PC 次优但可用。

## 适用范围

- 新游戏接入移动端
- 既有游戏对局页移动端适配
- 统一规范：比例适配、热区、横竖屏切换、资源分级加载

## 强制前置阅读（按需触发）

- 需要修改 UI/布局/样式：`docs/ai-rules/ui-ux.md`
- 涉及引擎系统/交互系统：`docs/ai-rules/engine-systems.md`
- 需要补 E2E：`docs/automated-testing.md`、`docs/testing-best-practices.md`

## 规范来源（单一真实来源）

- `openspec/specs/mobile-adaptive/spec.md`
- `openspec/specs/mobile-adaptive/design.md`

如两者与代码现状冲突，以 spec 为准，必要时先更新 spec。

## 移植目标（验收门禁）

### 设备视口组（默认必须覆盖）

- 手机竖屏：`390x844`
- 手机竖屏大屏：`430x932`
- 手机横屏：`844x390`
- 手机横屏（XR）：`896x414`
- 平板竖屏：`768x1024`
- 平板横屏：`1024x768`

### 关键验收

- 不出现明显横向溢出（`pageOverflowX <= 1px`）
- 不依赖整页缩放（root scaleX >= 0.99）
- 核心战场与手牌区可见且可操作
- tightLandscape（宽>=800 且高<=420）允许更松的 bottom 偏差，但不应出现明显遮挡

## 工作流（按顺序执行）

### 1) 建立可测试的锚点（data-testid）

对局页根组件必须具备稳定 testid：

- `<gameId>-board`
- `<gameId>-battlefield`
- `<gameId>-hand-area`

如现有组件没有，优先补齐（避免测试写不稳）。

### 2) 识别布局骨架（portrait vs landscape）

输出一个“布局骨架表”（写在 PR 描述或 evidence 文档里）：

- 竖屏：上/下分区如何分配高度
- 横屏：左/右分栏如何分配宽度
- 哪些区允许滚动（内部滚动），哪些区必须固定可见

### 3) 比例与溢出修复（禁止整页缩放）

- 禁止通过 `transform: scale()` 压缩整页
- 优先：容器约束 + 内部滚动（flex + min-h-0）
- 处理 safe-area：必要时给底部/顶部 padding

### 4) 触控热区放大

- 所有关键按钮/卡牌 hit-area >= 44x44
- 视觉可小，但 hit-area 必须大

### 5) Hover 替代

- 移动端必须可在无 hover 情况下查看关键信息（点击弹层/长按/信息按钮）

### 6) 资源分级加载

- P0：首屏关键
- P1：首屏后延迟
- P2：按需

具体落地策略：优先用现有的懒加载/动态 import/IntersectionObserver（项目已有则复用）。

### 7) E2E（强制）+ 证据

- 在对应 `e2e/<game>-*.e2e.ts` 中补充 viewport 组
- 必须运行：`npm run test:e2e:ci -- <测试文件>`
- 创建证据：`evidence/<gameId>-mobile-adaptive-e2e.md`
- 证据必须包含截图 + 每张截图对应的 viewport 说明与结论

## Cardia 作为参考实现

优先参考与复用：

- `e2e/cardia/cardia-smoke-test.e2e.ts`
- `src/games/cardia/Board.tsx`

Cardia 的适配结果将作为其它游戏迁移时的模板。

