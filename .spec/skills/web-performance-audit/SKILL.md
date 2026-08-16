---
name: web-performance-audit
description: "BoardGame Web / React 性能专项排查入口。用于页面卡顿、Chrome Performance 红色角标、样式重算/布局/绘制过高、长列表或大量卡牌渲染、图片加载拖慢首屏、动画导致掉帧、React 重渲染过多、需要做性能隐患大排查或复测优化收益时。"
---

# Web Performance Audit

## 职责

对 BoardGame 真实 Web 页面做性能基线、定位、修复和复测。优先解决用户正在感知的卡顿，再把同类隐患纳入清单。

本 skill 是项目内执行入口；外部性能 skill 只作为参考来源，不是本项目的第二套规则。已吸收的外部方向：

- `addyosmani/web-quality-skills@performance`：性能预算、关键渲染路径、图片/字体、运行时性能、列表虚拟化、缓存和第三方资源治理。
- `vercel-labs/agent-skills@vercel-react-best-practices`：React 重渲染、依赖管理、包体、DOM 批处理、缓存和数据结构选择。

## 前提锁定

改代码前先写清四项：

1. 问题对象：具体游戏、页面、弹层、列表或交互，例如“大杀四方角色选择页”。
2. 真相来源：用户描述、真实入口截图/录屏、Performance trace、E2E 指标、运行日志或源码路径。
3. 目标入口/环境：真实路由、桌面/移动、浏览器、是否走图片门禁、是否本地 dev server。
4. 验收口径：可感知结果和量化指标，例如不卡顿、DOM 数下降、样式重算下降、长任务消失、滚动稳定。

如果复测跳过了关键图片门禁，必须明说：本次只验证页面渲染性能，不代表图片预加载链路健康。

## 快速分流

- 用户说“现在很卡 / Performance 红色角标 / border-color / layout / paint”时，先做眼前页面的最小基线和最小修复。
- 用户说“大排查 / 隐患 / 全面扫一下”时，先列页面和场景矩阵，再按风险分批跑基线，不要直接全仓改。
- 用户点名长列表、卡牌库、角色选择、日志、弹层选项时，优先检查真实渲染数量；滚动本质可分页，默认考虑 windowing / virtualization。
- 用户点名图片慢、加载素材卡住、白图或门禁时，先读 [`critical-image-gate`](../../knowledge/standards/critical-image-gate.md) 和 [`critical-image-preload`](../../knowledge/standards/critical-image-preload.md)。
- 用户点名动画、hover、transition、特效时，先读 [`animation-effects`](../../knowledge/standards/animation-effects.md)。

## 基线采集

每个目标入口先保存一组证据到 `evidence/<中文主题>/<timestamp>/`：

1. `README.md` 或 `summary.json`：入口、环境、用户原始症状、是否跳过图片门禁。
2. 截图或录屏：只作为可见结果证据，不替代性能指标。
3. Performance/trace 指标：样式重算、布局、绘制、脚本、长任务、FPS 或交互延迟。
4. DOM inventory：总元素数、关键列表项数、图片数、canvas 数、可滚动容器、视口内外元素数。
5. 资源指标：图片请求数、失败数、解码/加载耗时、字体和大包体。

允许用 Playwright、Chrome DevTools trace、`performance.now()`、React Profiler 或临时探针。临时脚本放 `temp/` 或 evidence 目录；正式收口前删除不该长期存在的临时测试。

## 定位维度

按现实症状选择维度，不必每次全量扫描：

- 渲染量：列表、卡牌、候选项、日志、弹层选项是否把视口外内容全部渲染。
- React 重渲染：父组件状态、内联对象/函数、派生数组、context、key 变化是否导致整片重渲染。
- CSS 主线程成本：`transition-all`、`transition-colors`、`border-*`、`box-shadow`、`filter`、backdrop blur 是否反复触发样式重算或绘制。
- 布局抖动：读写 DOM 尺寸是否交错，滚动中是否反复计算 `getBoundingClientRect()`，动画是否改 width/height/top/left。
- 图片/字体：关键图片门禁、预加载、解码、图集初始化、字体阻塞和未压缩资源是否拖慢首屏。
- 脚本长任务：初始化、排序、筛选、配置归一化、i18n、卡牌定义遍历是否在首帧一次性做完。
- 内存与生命周期：滚动、切换、重进页面后监听器、timer、动画循环、cache 是否释放。

## 修复原则

先降低真实工作量，再微调属性：

1. 长列表优先做窗口化、分页或分批渲染；滚动容器只渲染视口附近项目，保留总高度占位和可达性。
2. 卡牌/角色候选只渲染首屏和 overscan；搜索、筛选、排序结果可以保留完整数据，但 DOM 不应完整落地。
3. hover/选中态优先改 `transform`、`opacity` 或单一背景色；禁止新增 `transition-all` 和无边界阴影动画。
4. 重计算结果用 `useMemo` 或提前归一化，但不要为了理论问题新增第二套真相源或兜底状态。
5. React 优化优先稳定 props、拆小组件、避免无意义 context 扇出；只有实测命中时才加 `memo`。
6. 图片优化优先修加载层和资源体积；跳过图片门禁只能叫“绕过验证入口”，不能叫图片链路修复。
7. 止血、降噪、跳过、吞异常只能标为缓解；原始用户症状必须回到同一入口复测。

## 复测收口

修复后用同一入口、同一环境、同一操作重跑：

- 对比修前/修后指标，至少包含一个用户可感知指标和一个直接性能指标。
- 对窗口化/分页类修复，验证首屏数量、滚动后可见内容、顶部/底部边界、选择状态保持。
- 对 CSS/动画类修复，验证 Performance trace 中对应红色角标或高成本属性是否消失或明显下降。
- 对 React 重渲染类修复，验证重复交互、筛选、滚动、选中不会使无关区域整片刷新。
- 对图片链路，分别说明关键图片门禁通过、后台加载通过、或本轮只验证非图片渲染路径。
- 清理临时脚本和无长期价值的探针；保留 evidence、必要单测/E2E、正式源码改动。

## 汇报口径

- 先讲现实结果：哪里变快了、用户会感受到什么。
- 再讲证据：截图、trace、DOM 数、样式重算、长任务、测试命令。
- 最后讲边界：哪些场景未覆盖、是否跳过图片门禁、是否只是止血。

禁止把“日志安静”“脚本没报错”“trace 文件生成了”当成性能问题已修好。只有同一真实入口的修后指标和用户可见路径改善，才能称为本轮性能修复完成。
