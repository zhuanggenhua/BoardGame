---
name: adapt-game-mobile
description: "BoardGame 单游戏移动端适配入口。用于 mobileProfile、横竖屏、mobile shell、hover/拖拽替代、游戏层手机/平板验收；不重写原生 App 或框架层。"
---

# 适配游戏移动端

本 skill 用于把已有游戏页面适配到移动 H5 / PWA 视口。默认前提是 PC 版是权威布局，移动端只做条件化适配；不重写第二套移动端 UI，不把 WebView 当作移动适配本身。

`mobile-adaptive` 是旧兼容入口，只能转入本 skill；不得维护第二套移动端执行规范。

## 基线

- PC 对照分辨率：`1920x1080`。
- 手机横屏真实设备基线：`2340x1080`（`13:6`）。
- E2E 可用等比例缩小视口，例如 `936x432`；若不直接用真实尺寸，也必须保持 `13:6`。
- 用户明确说“平板按 PC 看”或“不关心平板”时，只保留 PC + 手机横屏两档。
- 默认目标是手机横屏尽量可用；不是强行把所有游戏都改成竖屏。

## 必读

- 游戏注册与运行时入口：[`openspec/specs/game-registry/spec.md`](../../../openspec/specs/game-registry/spec.md)
- UI 总原则：[`ui-ux`](../../knowledge/standards/ui-ux.md)
- 引擎系统边界：[`engine-systems`](../../knowledge/standards/engine-systems.md)
- 字段与命名：`references/manifest-fields.md`
- 审查与验收：`references/checklist.md`

通用口径以本 skill 和 [`ui-responsive-layout`](../../knowledge/standards/ui-responsive-layout.md) 为准；实现入口不清时再查 [`docs/mobile-adaptation.md`](../../../docs/mobile-adaptation.md) 和 [`docs/architecture/ui-dual-platform-architecture.md`](../../../docs/architecture/ui-dual-platform-architecture.md)。旧复盘不能替代当前证据。

## 核心合同

### 1. 先过 PC 门禁

移动端适配前，先确认 PC 当前实现已达标：

- 主信息层级正确。
- 关键区域尺寸、比例、阅读顺序和主次关系已收口。
- 新桌面素材或新桌面布局已有桌面真图或测试证据。

PC 仍有明确缺口时，默认继续收 PC；不得提前做手机压缩、断点重排、横屏特化或触控补丁。只有用户明确要求先看移动端，或本轮只修已锁定移动端回归，才可越过。

### 2. 只做条件覆盖

- 移动端改动只能在窄视口、manifest / mobile shell 或触控入口条件下生效。
- 窄视口以 [`mobileSupport.ts`](../../../src/shared/mobileSupport.ts) 的 `1023px` 断点为准。
- `coarse pointer` 只用于 hover 替代入口显隐，不可单独作为缩小 PC 尺寸或重排桌面的依据。
- 触屏笔记本仍按 PC 布局处理。

### 3. 固定构图默认等比缩放

固定牌桌、棋盘、地图、卡面、格子、战区背景和主 HUD 默认属于同一 PC 构图：

```text
scale = min(availableWidth / designWidth, availableHeight / designHeight)
```

- `px` 在主体画布内表示设计坐标，最终显示由壳层缩放承接。
- `vw` / `vh` 只用于安全区、壳层可用高度和局部辅助；不得重算主体画布、主按钮、主字号、手牌轨道、中央牌区或 HUD 尺度。
- 对 `board-shell` 游戏，顶栏、分数、阶段提示、手牌、中央牌区、主按钮和主操作区默认跟随同一缩放体系。
- 不得把主按钮搬到新 action rail、把手牌另缩一套、把顶栏另排一套后声称只是移动端让位。

### 4. 命中区不等于视觉盒子

- 可以补触控命中区，但默认不放大可见元素。
- 优先使用显式 opt-in 类、透明 hit area、伪元素、外层点击盒或局部包装层。
- 禁止在移动媒体查询里对通用按钮、共享组件基类或全局图标类统一加 `min-width`、`min-height`、`padding` 来“顺带解决触控”。

### 5. 交互语义不能退化

- hover 信息必须有稳定触控入口，例如长按、点击详情或放大层。
- 长按是触控 fallback，不替换既有点击查看 / 放大 / 展开语义。
- 关键操作不能只靠拖拽；默认补 `点击选中 -> 点击目标 -> 点击确认` 的回退路径。
- 侧栏、日志、帮助和说明可折叠；固定牌桌主构图里的顶栏、分数、手牌、主按钮和中央牌区默认不可另排成移动专版。

## 工作流

1. **锁边界**：默认 `PC 优先 + manifest 方向 + 通用 shell 优先`；不做完整竖屏、不做视觉重设计，除非用户明确要求。
2. **拍或读 PC 主态**：用 `1920x1080` 作为桌面对照；先回答桌面端还差什么。
3. **审查游戏层**：读取 `manifest.ts`、`Board.tsx`、`ui/`；同时排查 `src/index.css`、共享按钮组件和全局媒体查询。
4. **归类风险**：hover 依赖、drag 依赖、固定尺寸、主体比例、常驻侧栏、信息密度、全局样式污染、命中区和视觉混淆。
5. **选 manifest**：只用 `references/manifest-fields.md` 已批准字段；主验收方向跟 `preferredOrientation` 一致。
6. **按层修**：先框架 / shell，再游戏层轻量例外；未来多游戏复用的能力回推框架层。
7. **验证**：PC 对照、移动主方向 E2E、截图核图、交互语义矩阵。

## manifest 裁决示例

复杂桌游默认从以下方向裁决，具体字段以 reference 为准：

```ts
mobileProfile: 'landscape-adapted'
preferredOrientation: 'landscape'
mobileLayoutPreset: 'board-shell'
shellTargets: ['pwa']
```

只有 H5 主方向适配和对应 E2E 通过后，才考虑扩到 `app-webview` 或 `mini-program-webview`。

## 游戏层例外

通常只在这些点写游戏层代码：

- 触屏预览入口。
- 非拖拽备选路径。
- 移动端折叠后仍需保留的核心摘要信息。
- 特殊交互的确认顺序、文案或操作轨道排序。

不要在单个游戏里重写框架已能承接的缩放、shell、断点或触控能力。

## 验收

移动端适配验收必须同时满足：

- PC 前后对比无布局回归、无尺寸基线变化、无主流程退化。
- 主验收方向下不依赖 hover 也能完成核心回合。
- 玩家不需要手动缩放就能查看关键手牌 / 状态 / 日志 / 说明。
- 主体画布保持等比；棋盘、地图、卡面、格子或背景不能压扁、拉长或错位。
- 主要触控入口可点，且命中区和视觉尺寸没有混淆。
- PC 与移动端交互语义矩阵一致：原点击、长按 fallback、hover 替代入口各自符合预期。
- 截图必须来自真实目标状态；教程浮层、调试面板、模态框、toast、系统菜单或遮挡主信息的大面积覆盖层会使主状态截图无效。
- 移动端主状态图必须逐张和同场景 PC 主态图对照整体比例、锚点、遮挡和主次关系。

只看断言、日志、DOM、locator 或控制台输出，不算完成移动端验收。

## 横向溢出防回归

- `scale()` 表达式必须返回无单位数字；`scale(calc(100vw / 1280))` 是错的，应用 `scale(calc(100vw / 1280px))` 或变量。
- `board-shell` 缩放选择器默认用后代命中，例如 `[data-game-page...] .mobile-board-shell`，不要默认直系子选择器。
- 缩放壳层内的主容器优先 `h-full`，不要外层 scale + 内层 `100dvh` 双重锁高。
- 复杂游戏可按 `data-game-id` 覆盖移动设计宽度，但不得改变 PC 设计基线。
- 移动 E2E 除功能断言外，还要断言：
  - `documentElement/body/#root` 的 `scrollWidth <= innerWidth + 1`。
  - `.mobile-board-shell` 左右边界在视口内。
  - 关键入口位于视口内。

## 禁止

- 把 `WebView` 或小程序 `web-view` 当成移动适配方案。
- 为移动端复制一套完整桌面 UI。
- 发明另一套 manifest 命名。
- 全局改小 `clamp()`、按钮 token 或桌面尺寸。
- 用移动端适配顺手重做 PC 阴影、边框、质感、色彩和整体视觉。
- 只验证布局，不验证真实交互路径。

## 汇报

最终至少说明：

- 审查过的文件和风险点。
- 选定的 manifest 字段值。
- PC 权威布局与移动条件覆盖边界。
- 修改的组件和层级归属。
- PC 对照、移动 E2E、截图核图和交互语义矩阵结果。
- 尚未通过的阻塞项，以及现实影响和最小补救动作。
