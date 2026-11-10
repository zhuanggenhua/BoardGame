# 平台首页第二十二版 · 收藏库主任务重构

当前稿源：[index.html](index.html)。这是 Open Design 设计稿候选，人工验收仍为 `not-approved`；没有实现生产前端、提交、推送或部署。

## 原问题与证据

用户原话：「移动端收藏库游戏都看不见了怎么通过验收的，要不要学习一下steam移动端做法啊」，随后授权「继续重构」。

最后正常的移动稿未锁定，之前两次候选均被用户否定。本轮按新授权重构，不声称恢复某个已认可的旧手机版本。旧稿的首屏几何检查只完整显示八款中的两款，完整列表藏在抽屉；此前只验节点、比例和末项滚动，漏了直接浏览、找游戏的主任务。

[旧稿失败记录](exports/library-main-task-red.log) 明确得到 `2 !== 8`。返工前源与证据保存在 [历史目录](refs/v22-before-library-task-rebuild/)。

## 当前结果

- 默认 `375×812` 收藏库为三列封面；当前八款封面及中文名全部在对局条上方，搜索和排序直接可见。
- 情报默认折叠在所有游戏后面，手动展开后才显示新闻封面。
- 单次点按封面直接进入对应游戏；顶部「← 收藏库」返回并保留查询、排序和实际浏览位置。
- 无匹配结果仍保留查找入口；清除搜索恢复八款；按时长和名称排序有对应行为断言。
- 桌面原有三导航、侧栏、主页构图和悬停保留；工坊列表抽屉与发现两列不变。

实际参考了 Valve 官方移动库截图中的搜索、最近排序和三列封面。截图没有覆盖详情返回，当前返回行为由本轮用户任务定义，不能称为复刻 Steam；参考来源与吸收边界见 [设计合同](DESIGN.md)。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run --config artifacts/home-platform-v3-neo-brutalist/vitest.config.ts --configLoader native`：2/2 通过，包含真实浏览器主任务单测。
- `node artifacts/home-platform-v3-neo-brutalist/capture.mjs --only=01,01b,02,03,04,m01,m01c,m01d,m01e,m01f,m01g,m01h,m02,m02b,m02c,m02d`：浏览器链路通过；16 张变化原图已重拍。
- 内置浏览器另走「输入战争→单次进入召唤师战争→返回」，返回后查询仍为战争、焦点回到该游戏。
- [独立图面审查](exports/.visual-review-library.json) 逐张检查本轮 16 图；首屏八款和返回入口按实际像素判定。
- [全量账本](exports/.visual-review.json) 共 43 图：16 张当前审查，27 张未改写且摘要与既有证据相同后沿用。
- [E2E 索引](exports/.e2e-image-index.json)、[PASS 清单](exports/open-design-pass-manifest.json)、[行为记录](exports/behavioral-verification.json) 分别记录图片、图面、行为与源摘要。

## 责任与限制

`index.html` 扩展已有库渲染与状态 owner；`mobile.css` 独占窄屏样式；`library-tasks.mjs` 是 Vitest 与截图编排共同消费的找游戏行为合同。本轮未新增移动端平行游戏数据。

本轮新图覆盖 375 竖屏，未声称其它手机宽度、原生键盘、真机触摸或安全区验收。既有命运支配、井字棋演示素材占位不在本轮接入范围。没有修改 AI 通用规范，无需知识沉淀。
