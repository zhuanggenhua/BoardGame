# 大杀四方放大镜状态层审计 2026-04-05

## 审计范围

- `src/games/smashup/ui/HandArea.tsx`
- `src/games/smashup/ui/BaseZone.tsx`
- `src/games/smashup/ui/PromptOverlay.tsx`
- `src/games/smashup/ui/DeckDiscardZone.tsx`

## 权威来源

- 用户本轮反馈：“描边方式变了”“边框只是卡牌的边框，不要影响不相干的”“放大镜颜色跟随随从描边一起变了”
- Git 历史与 blame：
  - `1c469445` `feat: add browser compatibility gate and mobile inspect gesture`
  - `4f456df1` `feat: 提交当前已暂存改动`
  - `4b2b4fcc` `收口剩余游戏适配、E2E、文档与资源更新`
  - `aaf12e6a` `完善移动端运行时边界与对局交互适配`

## Findings

### F1. 放大镜按钮长期挂在卡牌状态层内部，不是独立悬浮层

- 命中文件：
  - `src/games/smashup/ui/HandArea.tsx`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/ui/PromptOverlay.tsx`
  - `src/games/smashup/ui/DeckDiscardZone.tsx`
- 结论：
  - 放大镜按钮普遍作为卡牌或基地容器内部的绝对定位子节点存在，而不是状态层外的兄弟节点。
  - 只要父层承载 `ring / shadow / opacity / grayscale / hover` 等状态视觉，放大镜就会一起被“同层视觉”带着跑。
- 命中维度：
  - `D15 UI 状态同步`
  - `D23 架构假设一致性`
  - `D43 重构完整性检查`

### F2. 当前可见历史里，问题不是“最近第一次引入”，而是旧结构被后续视觉强化放大

- 版本线结论：
  - 至少从 `9c9dd78d` 可见历史起，手牌和基地/随从放大镜就已经在卡牌容器内部。
  - `1c469445` 把 inspect 手势和相关入口系统化。
  - `4f456df1` 进一步把手牌和 `PromptOverlay` 的放大镜样式固化在卡牌内部。
  - `4b2b4fcc` 又沿同一路径把泰坦/轨道放大镜继续扩散。
- 判定：
  - 用户感知到“描边方式变了”是成立的。
  - 但更准确的根因是：状态视觉层被持续增强，而放大镜仍留在这个层里，导致问题从“存在但不明显”变成“显著可见”。
- 命中维度：
  - `D8 时序正确`
  - `D23 架构假设一致性`
  - `D43 重构完整性检查`

### F3. 显式白边是附加噪音，但不是唯一根因

- 命中提交：
  - `4f456df1` 为手牌和 `PromptOverlay` 放大镜按钮加入 `border-2 border-white/30`
  - `4b2b4fcc` 为部分基地/泰坦相关放大镜加入 `border border-white/20`
- 判定：
  - 这些白边会让“按钮被描边”的错觉更重。
  - 但即使去掉白边，只要按钮仍在状态层内部，它仍可能跟随卡牌选择态或 hover 态一起变色/变透明/变得像被描边。
- 命中维度：
  - `D10 元数据一致`
  - `D15 UI 状态同步`

## 逐项结论

- `src/games/smashup/ui/HandArea.tsx`
  - 旧结构里，手牌卡牌外层容器承载 `ring`、`shadow`、`opacity` 等状态视觉；放大镜是其内部绝对定位子节点。
  - 2026-04-05 已修复：放大镜按钮改为卡框状态层外的兄弟节点，手牌 `ring / opacity / grayscale` 不再直接作用到按钮。
- `src/games/smashup/ui/PromptOverlay.tsx`
  - 两处卡牌放大镜都在 `motion.div.group` 内，但实际 ring/highlight 承载层是其内部卡框节点。
  - 2026-04-05 复查结论：`PromptOverlay` 的可见放大镜按钮已是卡框高亮层外的兄弟节点，本轮无须额外代码改动。
- `src/games/smashup/ui/BaseZone.tsx`
  - 基地放大镜在本轮之前已移到卡框外层。
  - 2026-04-05 已修复两处剩余耦合：
    - 场上泰坦放大镜改为 `group relative` 外层兄弟节点，不再挂在泰坦 `ring / shadow / used` 状态层内部。
    - 随从放大镜虽然原本已在卡框外层，但 `opacity / grayscale` 挂在按钮父层；本轮把 dimmed 视觉下沉到卡框层，避免按钮随 dimmed 一起褪色。
- `src/games/smashup/ui/DeckDiscardZone.tsx`
  - 旧结构里，轨道泰坦放大镜仍是实体按钮容器内部绝对定位节点。
  - 2026-04-05 已修复：轨道泰坦改成外层 `group relative` + 内层实体按钮 + 外层放大镜按钮，放大镜不再跟随轨道泰坦卡框状态层。

## 修复落点

- `src/games/smashup/ui/HandArea.tsx`
  - 放大镜按钮从手牌卡框状态层中移出，定位仍锚定在卡牌右上角，但不再被手牌卡框的 `ring / opacity / grayscale` 直接吞进去。
- `src/games/smashup/ui/BaseZone.tsx`
  - 场上泰坦新增外层 `group relative` 包裹，放大镜按钮改为状态层外兄弟节点。
  - 随从 dimmed 的 `opacity / grayscale` 从 `minionContainerClassName` 下沉到 `minionFrameClassName`，避免桌面放大镜跟随随从一起变灰。
- `src/games/smashup/ui/DeckDiscardZone.tsx`
  - 轨道泰坦新增外层 `group relative` 包裹，放大镜按钮不再放在实体按钮内部。
- `src/games/smashup/ui/PromptOverlay.tsx`
  - 复查后确认两处放大镜都已是卡框高亮层外兄弟节点，本轮保持不动。

## 验证证据

- 类型检查
  - `npm run typecheck` 通过。
- 标准 E2E
  - `npm run test:e2e:ci:file -- e2e/smashup-local-gameplay.e2e.ts "本地模式：手机横屏保留常驻放大按钮，点击按钮只放大不触发出牌"` 通过。
  - `npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "可视作行动打出的泰坦可通过牌库右侧泰坦栏按常规行动进场"` 通过。
- 人工看图
  - `test-results/evidence-screenshots/smashup-local-gameplay.e2e/本地模式：手机横屏保留常驻放大按钮，点击按钮只放大不触发出牌/smashup-mobile-inspect-button-preview.png`
    - 能看到放大层已正常打开，原手牌仍留在底部手牌区，没有因为点放大镜误触发出牌。
    - 放大层居中，手牌区与场上布局没有因放大镜操作产生错位。
  - `test-results/evidence-screenshots/smashup-alien-terraform.e2e/alien_terraform-第三步可通过牌库右侧泰坦栏选择可视作随从打出的-set-aside-泰坦/terraform-titan-rail-magnify.png`
    - 能看到轨道泰坦放大层正常打开，右侧轨道区域与场上基地保持独立，没有出现“放大镜本体被卡框描边吞进去”的额外边框。
- 未计入通过的补充验证
  - `npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "克苏鲁泰坦天赋可在分支选择后抽 1 张疯狂卡"` 本轮被仓库内另一条无关 E2E 重任务门禁拦截，未能作为标准通过证据计入。
  - 之后尝试用 `PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true` 直跑该单用例时，又卡在 `GameTestContext.openTestGame()` 的 `__BG_TEST_HARNESS__` 注册超时；这条失败信号属于测试基础设施问题，不是本次放大镜结构改动直接报错，但也不能拿来冒充通过。

## 审计结论

- 用户反馈成立：描边/状态表现的变化确实把问题放大了。
- 根因不是单一颜色值，也不是单一白边，而是放大镜按钮与实体状态层耦合。
- 正确修复方向不是继续调按钮颜色，而是把放大镜统一迁移为状态层外的独立悬浮兄弟节点。
- 2026-04-05 当前收口结论：
  - 手牌、基地泰坦、轨道泰坦这三条可见放大镜入口已经按“状态层外兄弟节点”修正。
  - 基地与埋葬牌入口维持已正确结构。
  - PromptOverlay 经复查无需额外改动。
  - 随从入口已去掉 dimmed 对按钮的直接影响，但按钮仍跟随外层 `motion` 的位置/旋转动画；这属于“跟随实体移动”而非“跟随实体描边/变色”，本轮未再继续扩大改动面。

## 后续修复要求

- `inspect` / 放大镜按钮统一改成状态层外兄弟节点。
- 卡牌 `ring / shadow / opacity / grayscale / scale / rotate` 仅作用于卡框层。
- 放大镜仅保留固定底色、hover 态、可点击性，不消费实体选择态或高亮态。

## 残留风险

- 当前审计已覆盖 `smashup` 主要 inspect 入口，但未扩展到其他游戏。
- 若后续在别的组件中继续复制“absolute 放大镜按钮挂在 group 内部”的模式，问题会再次出现。
- 仓库当前存在其他并发 E2E 任务，导致部分标准回归在本轮受基础设施门禁影响；这不是功能通过证据，后续若要宣称“全入口标准 E2E 全绿”，仍需补跑基地泰坦那条单测。

## 修订记录

- 2026-04-05 初版
  - 落地根因审计，确认用户反馈成立，根因是放大镜与状态层耦合。
- 2026-04-05 修订
  - 回写本轮结构性修复落点与验证结果。
  - 明确记录：手牌 / 场上泰坦 / 轨道泰坦已修，PromptOverlay 复查无需改，随从入口完成 dimmed 隔离但未进一步拆离外层 motion 动画。
