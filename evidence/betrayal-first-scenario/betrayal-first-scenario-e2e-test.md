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
- 实际看到：中央主视区已经从抽象条形目标列表改成房间牌拼接舞台；房间本体承接移动/探索，状态通过高亮、棋子、短徽记和 hover/title 表达。
- 实际看到：中央房间牌已经接入 `public/assets/i18n/zh-CN/betrayal/rooms/` 下的真实裁片，不再用 CSS 渐变/程序纹理冒充房间牌面。
- 实际看到：中央地图现在是内部可拖拽/可滚动舞台，房间牌按固定方形尺寸显示，图片使用原比例 `contain` 呈现，不再被百分比布局压扁或被 `cover` 裁切。
- 与设计稿差距：当前本地只拿到 `contact-11-1425-1426.jpg` 里的 2 张房间正面与 2 张房间背面裁片，多个房间仍复用同一真实素材；缺完整 `6300x5400` 房间拼版原图，所以清晰度、房间唯一性、连接件和整体材质仍明显弱于 `v4`。
- 验收结论：运行时流程通过，视觉方向已从旧失败图纠回 `v4`；但不能宣称已完全复刻 `v4`。

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
