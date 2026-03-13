---
name: adapt-game-mobile
description: "审查并接入本项目中单个游戏的移动端适配，遵循“PC 优先、移动端条件覆盖”的通用接入框架。用于用户要求“给某个游戏做移动端适配”“评估某个游戏是否适合手机横屏”“给 manifest 声明 mobileProfile / preferredOrientation / mobileLayoutPreset / shellTargets”“把 hover / 拖拽 / 常驻侧栏接入通用 mobile shell”“梳理游戏层移动端接入流程”时。只处理游戏层接入与验收，不重写原生 App 或小程序，不替代框架层实现。"
---

# 适配游戏移动端

## 概览

- 本 skill 的第一原则是 `PC 版是权威布局`，移动端只能在不影响 PC 的前提下做条件化适配。
- 默认目标是 `手机横屏尽量可用`，不是强行把所有游戏都压成手机竖屏。
- 默认复用现有 `React + Vite + UI Engine Framework`，不重写第二套 `MobileBoard`。
- `App WebView`、小程序 `web-view` 只是分发容器，不是移动端适配方案本身。
- 移动端适配验收对象始终是同一套 H5 / PWA 在移动视口下的真实交互。
- 移动端适配不是 UI 重构；除非用户明确要求，否则不得借适配顺手重做阴影、边框、质感、色彩语言、动效节奏或整体视觉风格。

## 核心硬规则

### 1. PC 优先，不得回归

- 任何移动端适配都不得改变 PC 的视觉层级、尺寸基线、布局流和主交互路径。
- 只要用户反馈 “PC 端出问题了”，优先回查最近移动端改动，默认按回归处理。
- 不允许为了塞进手机屏幕而全局调小 `clamp(...)`、统一缩放桌面按钮、压缩桌面主面板。
- 不允许把桌面常驻结构直接改成抽屉或折叠，除非该变化只在移动条件下生效。

### 2. 移动端只能条件覆盖

- 所有移动端尺寸压缩、触控入口、面板折叠、底部 action rail、hover 替代入口，都必须只在移动条件下启用。
- 移动条件优先级：
1. `窄视口`：以 [mobileSupport.ts](/F:/gongzuo/webgame/BoardGame/src/games/mobileSupport.ts) 中的 `1023px` 断点为准。
2. `manifest / mobile shell`：用于页面级结构切换。
3. `粗指针 / 触控`：只用于 hover 替代入口显隐，不可单独作为压缩 PC 尺寸的依据。
- 触屏笔记本仍然属于 PC 布局范围；不能因为 `(pointer: coarse)` 就缩小桌面 UI。

### 3. 交互目标的命中区不等于视觉盒子

- 任何触控交互目标都可以按需补命中区，但默认不能把对应元素的可见尺寸一起改大或改胖。
- 这里的“交互目标”不只包括按钮，也包括图标入口、卡牌预览热点、状态徽记、标签页、列表项、头像入口、抽屉开关、操作轨道项等一切可点击或可触达元素。
- 禁止在移动媒体查询里对通用交互元素选择器、共享组件基类或全局图标类直接施加统一的 `min-width`、`min-height`、额外 `padding` 等规则来“顺带解决触控”。
- 如果确实要补命中区，优先用显式 opt-in 类、透明 hit area、伪元素、外层点击盒或局部包装层；不要污染整类交互目标的视觉基线。
- 命中区方案必须和桌面视觉尺寸解耦；“更容易点到”不等于“看起来更大”。

### 4. 优先记录根因，不只记录现象

- 审查时不要只写“按钮变胖了”“图标变大了”“移动端整体缩水了”，必须继续追到导致现象的真实来源。
- 记录问题时，优先写成“哪条全局样式 / 哪个共享组件基类 / 哪个媒体查询 / 哪个布局条件判断”导致视觉膨胀、缩水或挤压，而不是只写结果描述。
- 高频根因模式通常只有几类：全局选择器污染、共享交互基类叠加移动规则、命中区要求和视觉盒子耦合、把 `coarse pointer` 误当布局条件、把桌面 token 全局替换成更小值。
- 如果一次异常同时出现在多个区域，默认先怀疑根因在全局 CSS、共享组件或公共条件判断，而不是多个游戏组件刚好同时写错。

### 5. 默认裁决

- PC 是唯一权威版本；移动端做的是“适配”，不是“重做一套更小的桌面版”。
- 如果某项改动会让 PC 和移动端共用一套更小的尺寸 token，这个方案默认错误。
- 如果某项能力未来会被多个游戏复用，优先沉到框架层或通用 hook，不要在单个游戏里硬写。
- 优先修的是触控尺寸、视口条件、局部放大入口、关键路径可达性，不是桌面视觉语言本身。

## 先读权威来源

- `docs/mobile-adaptation.md`
- `openspec/specs/game-registry/spec.md`
- `docs/ai-rules/ui-ux.md`
- `docs/ai-rules/engine-systems.md`

如需补充理解当前设计背景，再读：

- `openspec/changes/add-pc-first-mobile-adaptation-framework/design.md`
- `openspec/changes/add-pc-first-mobile-adaptation-framework/specs/mobile-support-framework/spec.md`

按需阅读 `references/`：

- 字段与命名：`references/manifest-fields.md`
- 审查与验收：`references/checklist.md`
- DiceThrone 试点：`references/dicethrone-pilot.md`

如果用户这次要的是提案、spec、proposal，而不是直接接入，先走 OpenSpec 流程。

## 默认交互裁决

### hover

- 卡牌 hover：默认改为 `长按看大图`，优先复用 [useLongPressAction.ts](/F:/gongzuo/webgame/BoardGame/src/hooks/ui/useLongPressAction.ts)。
- 面板 hover：默认改为 `点击查看详情` 或 `点击进入放大层`。
- 影响决策的 hover 信息：必须变成稳定入口，不能只存在悬停态。

### 侧栏

- 核心信息侧栏：PC 默认保持原有桌面结构，不主动改成抽屉。
- 次要信息侧栏：只有在移动窄屏下确实挡主战区时，才折叠为抽屉、标签页或切换面板。
- 日志、说明、帮助：优先判断为次要信息后，再在移动端降级为可切换面板。

### 拖拽

- 关键操作不能只靠拖拽。
- 默认补一条 `点击选中 -> 点击目标 -> 点击确认` 的回退路径。
- 只有拖拽本身就是玩法核心语义时，才保留拖拽为主路径并单独设计触控方案。

## 工作流

### 1. 确认边界

- 默认采用 `PC 优先 + 横屏优先 + 通用 shell 优先`。
- 默认不新建 `MobileBoard.tsx`，不重写第二套移动端 UI。
- 默认不把问题转移到 `React Native`、`Flutter` 或原生小程序重写。
- 用户未明确要求时，默认不做完整竖屏布局。
- 用户未明确要求时，默认不做视觉重设计；不要把“适配”扩写成“换一套更像移动 App 的 UI”。

### 2. 审查游戏层

先读：

- `src/games/<gameId>/manifest.ts`
- `src/games/<gameId>/Board.tsx`
- `src/games/<gameId>/ui/`

如果用户反馈的是“移动端所有按钮都肥了 / 都缩了 / 多个区域一起异常”，先补读：

- `src/index.css`
- 相关通用按钮组件、共享布局组件或全局媒体查询入口

优先用 `rg` 搜这些风险点：

```powershell
rg -n "hover|onMouse|mouseenter|mouseleave|drag|draggable|pointer|tooltip|sidebar|drawer|panel|absolute|fixed|clamp" src/games/<gameId>
```

如果怀疑是全局样式污染，再搜：

```powershell
rg -n "@media|button|min-width|min-height|padding|coarse|hover|clamp" src/index.css src/components src/games/<gameId>
```

至少记录这些问题：

- `hover` 依赖：信息、预览、状态说明是否只能悬停查看。
- `drag` 依赖：关键路径是否只能靠拖拽完成。
- `固定尺寸`：是否把桌面尺寸直接压缩到了所有视口。
- `常驻侧栏`：是否在手机横屏下挡住主战区。
- `信息密度`：是否要求用户先缩放再操作。
- `全局样式污染`：是否由 `src/index.css`、共享按钮样式、全局媒体查询或 reset 把多个区域一起改胖 / 改瘦。
- `命中区与视觉混淆`：是否把 touch target 要求直接写成了一整类交互元素的可见尺寸变化。
- `根因定位`：是否已经定位到具体选择器、共享组件、媒体查询或条件判断，而不是只停留在“看起来变胖 / 变小”。

每个问题必须归类为：

- `framework`：应沉到通用移动壳或公共 hook。
- `game`：需要游戏层声明或轻量修正。
- `blocked`：当前框架能力不足，必须先补框架层。

### 3. 选定 manifest

不要自创字段名。只使用已批准的字段和值，详见 `references/manifest-fields.md`。

复杂桌游默认推荐：

```ts
mobileProfile: 'landscape-adapted'
preferredOrientation: 'landscape'
mobileLayoutPreset: 'board-shell'
shellTargets: ['pwa']
```

只有 H5 横屏适配和对应 E2E 通过后，才考虑把 `shellTargets` 扩到 `app-webview` 或 `mini-program-webview`。

### 4. 接入移动端时的正确方式

- 先保持 PC 桌面尺寸 token 不变，再为移动窄视口补一套条件化 token。
- 先排查 `src/index.css`、共享按钮组件和全局媒体查询，再决定是否真的需要改游戏组件 token。
- 尺寸压缩要通过 `1023px` 视口判断或 shell 条件启用，不能全局覆盖。
- hover 替代入口可以用粗指针判断显隐，但按钮尺寸不能因此误伤桌面端。
- 如果要补触控命中区，优先补“不可见命中区”或显式 opt-in 命中区类，不要直接把可见交互元素做胖。
- 面板折叠、操作轨道、触控替代入口都必须证明“只在移动条件下生效”。
- 允许保留 CSS fallback 缩放作为最后兜底，但不能把它当成适配完成。

### 5. 只做最小必要的游戏层例外

通常只在这些点上写游戏层代码：

- 触屏预览入口。
- 非拖拽备选路径。
- 移动端折叠后仍需保留的核心摘要信息。
- 某些特殊交互的确认顺序、文案或操作轨道排序。

如果某个例外未来大概率会被多个游戏复用，优先回推到框架层。

## 验收

按 `references/checklist.md` 验收。最低要求：

- 手机横屏不依赖 hover 也能完成核心回合。
- 玩家能查看手牌、状态、日志、说明，不必先手动缩放。
- 主要按钮达到触控目标尺寸。
- 竖屏要么有明确引导，要么清晰降级。
- PC 前后对比无布局回归、无尺寸基线变化、无主流程退化。

涉及 UI / 交互修改时，验收必须同时覆盖：

- `PC 视口人工对比`：确认桌面布局没有被移动端改动带歪。
- `H5 移动视口 E2E`：至少覆盖 1 个手机横屏和 1 个平板横屏。

如已改动 UI，则这轮 E2E 是强制收口项；不能只做人工检查。

## 输出要求

执行这个 skill 时，最终至少输出：

1. 审查过的文件与风险点。
2. 选定的 manifest 字段值。
3. PC 权威布局与移动条件覆盖的边界。
4. 需要修改的组件列表。
5. PC 验收结果、移动验收结果，或尚未通过的阻塞项。
6. 已补的 E2E 证据，或尚未补齐的缺口。

## 不要做

- 不要把 `WebView` 当成“自动获得移动端支持”。
- 不要把小程序 `web-view` 当成第一个落地方向。
- 不要为了移动端复制一套完整桌面 UI。
- 不要发明另一套 manifest 命名。
- 不要只看宽度压缩，不检查真实交互路径。
- 不要用“全局改小 clamp”去做移动适配。
- 不要在移动媒体查询里给整类交互元素或共享交互组件统一加 `min-width` / `min-height` / `padding` 来放大视觉尺寸。
- 不要接受任何会影响 PC 布局的移动端方案。
- 不要借移动端适配顺手重做视觉风格；没有明确需求时，不改 PC 端的阴影、边框、质感、色彩和整体观感。
