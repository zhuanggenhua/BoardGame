# 现代首页工具与动效

用户授权：PC 操作指南等工具有空间就直接显示；沿用现有风格，经典首页不动；交付 PC 与手机竖屏实际录屏，行为与视觉结论分账。

## 来源与采用范围

按 Emil Kowalski 的 [find-animation-opportunities](https://github.com/emilkowalski/skills/blob/main/skills/find-animation-opportunities/SKILL.md)、[animate](https://github.com/emilkowalski/skills/blob/main/skills/animate/SKILL.md)、[review-animations](https://github.com/emilkowalski/skills/blob/main/skills/review-animations/SKILL.md) 分别盘点、实现和复核。正文及 recipes/standards 留在本轮 `.tmp/home-motion-20261026/references` 作来源记录；本文件是单任务合同，不新增项目规范或动画库。

| 位置 | 目的与频率 | 采用 |
| --- | --- | --- |
| PC 工具区 | 常用入口可发现性 | 按实际工具、账户、菜单宽度逐项收纳，优先保留操作指南；观察字体、账户及视口变化，不因整组略超宽而全藏 |
| 卡片与分类 | 高频操作轻反馈 | 120–160ms 硬边按压及细微悬浮；仅精细指针启用 hover 位移 |
| 手机导航选中条 | 高频状态反馈 | 保留荧黄与顶部选中条，只做140ms显隐/缩放；键盘不等待 |
| 菜单 | 偶发，空间连续性 | 原生 dialog，220ms同侧进退、160ms遮罩；交给其它全局面板时即时关闭原生顶层 |
| 现代详情 | 偶发，避免突变 | 桌面 .97→1 轻浮现，手机底部进退；220ms进入、160ms退出；减少动态效果时只保留120ms透明度 |

拒绝：不做整页/网格反复入场；不做搜索结果逐项延迟；不做滚动视差或改变读取对象的位置；不新增拖拽关闭及其它业务操作。

owner：PlatformNavigation 持有工具测量和原生菜单；platform-motion.css 持有现代轻反馈；HomeGameDetailsPresentation 接管原 GameDetailsPresentation 的呈现职责，ModalBase 只接受可选表现参数，原默认分支保留；Home 仍持有所有业务状态。

## 验收合同

- 行为：真实正式入口；多宽度/中英文/登录前后按实际可用空间显示工具，导航中心可实际点击；菜单关闭、Escape焦点及面板交接；详情、收藏、返回位置；减少动态效果；经典目录与详情保持默认表现。
- 视觉：只交正常1920×1080桌面、375×812手机竖屏的当前连续录屏；保留真实时长。检查工具可见、硬边色彩、选中条、菜单及详情进退、快速操作和收口。内部额外视口不进入展示组。
- 环境：独立 runtime、独立 UGC 与数据库；Mongo 仅127.0.0.1:37022；不重启其他 owner 的运行时。
- 实际结果与逐媒体结论在完成运行和核图后补入；未跑不记通过。

## 当前收口状态（2026-10-27）

实现已保留，D轮行为4/4、E轮边界2/2、相关单测50/50为2026-10-26运行。2026-10-27两次复录均在浏览器用例前被并行源码变化保护终止，没有新增通过项；用户明确先审现有录屏。

现有两端录屏审查及PC末段Luna max补核已完成：已录主要状态通过，手机缺少登录后稳定首页起点，支持作者悬浮未录到，整组REVISE，最终录屏链接尚未交付。逐段事实、失败位点、原始证据与待补录动作见[现有录屏审查](./home-motion-review-20261027.md)。经典及页面布局本轮未修改。

随后用户恢复资源窗口，已完成当前C轮补录及两端视觉通过、清单校验和查看器交付。旧D退回结论保留，不用于新交付；本轮当前结果见[动效收口记录](./home-motion-closeout-20261027.md)。
