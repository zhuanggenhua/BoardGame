# 当前Fate修复的待发布范围

本文件是可审查的发布边界，不是发布授权。源码尚未提交、推送或部署；生产当前仍运行旧教程。

## 产品修改

| 现有owner | 修改目的 |
| --- | --- |
| src/games/fate-domination/tutorial.ts | 删除开场他席名册、强制详情阅读；弃牌指令及真实图标焦点 |
| src/games/fate-domination/tutorialLessons.ts | 删除不再消费的强制御主读卡课 |
| src/games/fate-domination/ui/tutorialLessonProjection.ts | 当前战略部署实际按钮与补充攻击手牌用途 |
| src/games/fate-domination/ui/tutorialPresentation.ts | 轻量能力tip与教程共存；完整检视继续独占前景 |
| src/games/fate-domination/ui/FateSelfDock.tsx | 给既有弃牌按钮标记准确教学目标，不新增入口 |
| src/games/fate-domination/ui/hand-surface.css | 未解码卡图保留扫光占位比例；骑乘费用状态深底，不移动手牌/暂存/威力/技能槽位 |
| src/games/fate-domination/criticalImageResolver.ts | 首屏实际可见头像/令咒/己方及已揭示技能预载，隐藏身份仍按权限 |
| src/components/common/media/OptimizedImage.tsx | 加载/失败阶段视觉alt为空，可访问名称保留；成功恢复说明，既有候选/重试链不改 |

对应Fate测试、共享图片加载测试及Fate三份E2E改动一起保存：完整教程采集/真实源码身份/弃牌卡面就绪、手牌悬浮真实再展开入口、新独立图片延迟与恢复。8个旧UI测试改为真实中文资源夹具，不调整玩家预期。

规范仅合并E2E主源既有两段；任务、覆盖、逐项审查和媒体副本作为证据。其它现存脏改动保持原样，包括其它游戏、平台UI、共享CardPreview、共享教程定位与存档模块；不能按整个工作树直接打包。当前本地证据记录了当时实际消费的共享依赖，选择性提交后的实际发布版本还须核对其依赖差异、CI与生产入口，不能只凭本地截图宣称同版本。

## 当前完成及发布后门禁

本地12项E2E、90张整屏媒体、91节点内容/衔接、类型及规范检查分别见[当前重审](acceptance-rework-20261101.md)。生产188对象200/SHA一致及真实首屏12图解码已验证；仍有主源缺口的脏砚令咒不造图，不恢复18退役键。

取得发布授权后，按上述产品及对应测试/规范/证据白名单提交，先检查实际发布版本与CI，再仅发布网站。随后从实际生产入口复验开场、能力tip/实际使用、卡图加载、弃牌和后续操作，全部适用栏通过才生成最终PASS清单与查看器链接。此范围不包含安卓更新，不将全卡、高级响应、完整角色能力、AI策略、角色/高级教程或音频写成完成。
