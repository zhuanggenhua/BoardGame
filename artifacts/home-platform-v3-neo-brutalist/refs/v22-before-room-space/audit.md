# 平台首页第二十二版 · 详情操作区重构

## 当前返工：详情按钮扎堆

用户指出「06怎么通过的」「按钮挤在一坨呢」，并明确要求「重构」。旧的详情验收结论撤回；本轮对象是详情主辅操作与相关弹窗背景，不用收藏库通过替代详情通过。

- 主操作独立承载；手机通栏，桌面与辅助组保留至少 20 像素间距。教程、收藏、配置三个辅助入口同排，内部间隔至少 16 像素，降低边框及阴影权重。
- 作者移回轻量署名区；人数、推荐人数和时长为只读文字。创建房间内真正可选的人数按钮保留。
- 辅助按钮取消悬停位移，避免同排错位；满房显示灰色「已满」并禁用。
- 修改前行为断言明确失败；迭代中真实发现并修复悬停错位。最终真实浏览器测试为 3 个文件、4 个用例通过。
- 桌面与手机 11 张详情相关原图重拍，独立审查见 [本轮账本](exports/.visual-review-details.json)。另外 32 张原图按摘要核对后沿用，不能称为本轮重新逐图审查。
- 证据命令：`node scripts/infra/vitest-cli-safe.mjs run --config artifacts/home-platform-v3-neo-brutalist/vitest.config.ts --configLoader native`；`node artifacts/home-platform-v3-neo-brutalist/capture.mjs --only=06,06b,06c,06d,m06,m06b,m06c,m06d,m06e,m06f,m06g`。

返工前源与证据保存在 [详情历史目录](refs/v22-before-details-actions/)。当前 [全量账本](exports/.visual-review.json)、[E2E 索引](exports/.e2e-image-index.json)、[PASS 清单](exports/open-design-pass-manifest.json) 与 [行为记录](exports/behavioral-verification.json) 对应本轮；教程与配置仍为设计稿示意反馈，不代表生产功能。人工验收仍为 `not-approved`，未修改 `src/`、提交、推送或部署。

以下收藏库记录是此前返工及本轮保护基线，其中「本轮」指此前收藏库批次。

---

## 此前收藏库主任务重构

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
