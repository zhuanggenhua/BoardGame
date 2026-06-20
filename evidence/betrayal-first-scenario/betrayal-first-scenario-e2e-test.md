# 山屋惊魂首剧本 E2E 截图验收

## 命令

- `npm run test:e2e:ci:file -- e2e/betrayal-first-scenario.e2e.ts`
- 结果：`1 passed`

## 截图核对

### 01 角色选择

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario\01-山屋惊魂-角色选择-确认前.png`
- 对应设计稿：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\docs\games\betrayal\design\generated\betrayal-character-select-style-b.png`
- 实际看到：角色选择页显示 6 个探索者候选，当前选择为杰登·琼斯，底部玩家槽与确认入口可见。
- 实际看到：探索者素材本体完整显示为五角形，没有被裁成圆形头像。
- 与设计稿差距：候选卡尺寸、边框装饰、底部玩家槽和确认按钮仍偏实现稿，尚未达到 `betrayal-character-select-style-b.png` 的高保真密度。
- 验收结论：首剧本入口流程可用；视觉尚未达到角色选择设计稿的最终验收标准。

### 02 运行时 v4 牌桌

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario\02-山屋惊魂-运行时-v4牌桌.png`
- 对应设计稿：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\docs\games\betrayal\design\generated\betrayal-runtime-prehaunt-board-v4.png`
- 实际看到：运行时已回到 `v4` 五区关系：左侧探索者与持有物、中央房间主视区、右侧牌堆/弃牌、底部五个动作、顶部短状态都存在。
- 实际看到：旧截图里的“可点击预演 / 当前目标 / 下一步 / 大块刚发生面板”已经不再常驻在主 UI。
- 实际看到：中央主视区现在是紧凑房间簇，不再把房间牌压成一条细竖列；首屏能同时看到上层、中层、地下的关键房间关系。
- 实际看到：房间牌面不再重复铺可见房间名、楼层说明和身份标签，主牌面只保留真实素材和最小悬浮操作入口。
- 实际看到：每个房间都有放大镜入口，点击后可单独查看该房间素材；右侧还保留了剧本查阅入口。
- 实际看到：中央地图仍可拖拽/滚动，作为后续房间数扩大时的承载方式。
- 与设计稿差距：当前本地拿到的仍是 512 级房间裁片，清晰度和材质细节不如完整拼版原图；如果后面补到更高清的房间源，这一块还能继续提升。
- 验收结论：运行时流程通过，当前首屏已经比上一版更适合阅读和操作；但它仍是可继续收敛的实现稿，不是最终定稿。

### 03 终局

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario\03-山屋惊魂-终局-幸存者胜利.png`
- 对应设计稿：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\docs\games\betrayal\design\generated\betrayal-endgame-style-b.png`
- 实际看到：终局页显示剧本结果为胜利，幸存者列表、叛徒败退、中央剧本卡和统计区都可见。
- 实际看到：幸存者和叛徒条目使用完整探索者素材，没有裁成圆形头像。
- 实际看到：终局里的目标、结果、奖励、叛徒败退和统计图标已经换成探索者牌、叛徒牌背、房间牌、预兆/事件牌、参考卡等真实素材，不再使用 emoji 假图标。
- 与设计稿差距：中央羊皮纸卡、左右面板边框、顶部标题区和底部按钮还偏普通实现稿，未达到 `betrayal-endgame-style-b.png` 的高保真装饰语法。
- 验收结论：首剧本终局流程可用；视觉尚未达到终局设计稿的最终验收标准。

## 备注

- 三张截图均来自 `/play/betrayal` 真实页面链路和 Playwright 状态注入，不是静态 HTML、组件孤立截图或生图替代品。
- 本轮截图已经通过 `view_image` 肉眼核对；结论是“流程可跑通，运行时方向纠回 v4，但三屏仍未全部达到设计稿高保真验收”。
- 当前最重要的剩余缺口：运行时缺完整高清房间拼版原图，当前只能复用本地缩略源裁片；角色选择和终局仍需要继续补边框、密度、按钮和标题区的设计稿语法。
