# Smash Up 输入模式偏好设置 E2E 证据

## 本轮目标
- 验证大杀四方的输入模式偏好已经放进局内悬浮球设置面板。
- 至少提供两张截图：一张是设置弹层已打开的整体画面，一张是偏好设置区域本身。

## 执行命令
```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-local-gameplay.e2e.ts "本地模式：悬浮球设置面板显示 Smash Up 偏好设置"
```

## 环境说明
- 本次截图来自 worktree：`D:\gongzuo\webgame\BoardGame\.claude\worktrees\smashup-input-mode-preferences`
- 截图场景是 Smash Up 本地房间页，不是测试专用页面，因此能真实看到局内悬浮球与设置面板。
- 测试环境里部分牌面/基地美术没有稳定拉到外部资源，所以牌面仍是白色占位；本轮验收重点放在设置入口、弹层层级、偏好项内容和选中态。
- 本次截图文案使用页面默认英文 UI，但验证的是设置结构和状态本身，不影响验收结论。

## 截图与观察

### 1. 悬浮球设置弹层已打开
- 截图：`D:\gongzuo\webgame\BoardGame\.claude\worktrees\smashup-input-mode-preferences\test-results\evidence-screenshots\smashup\smashup-local-gameplay.e2e\本地模式：悬浮球设置面板显示-Smash-Up-偏好设置\smashup-settings-panel-open.png`
- 人工观察：
  - 右侧悬浮球菜单已经展开，`settings` 卫星按钮处于选中状态，说明偏好入口确实挂在悬浮球设置里。
  - 设置面板已经真实打开，不是只显示一个按钮；面板与棋盘同屏出现，能直接看出入口和弹层的关系。
  - `SMASH UP` 偏好区位于设置面板顶部，音量控制位于其下方，层级清楚，没有被埋进别的面板里。

### 2. 输入模式偏好区本身
- 截图：`D:\gongzuo\webgame\BoardGame\.claude\worktrees\smashup-input-mode-preferences\test-results\evidence-screenshots\smashup\smashup-local-gameplay.e2e\本地模式：悬浮球设置面板显示-Smash-Up-偏好设置\smashup-settings-preference-detail.png`
- 人工观察：
  - `Click` / `Drag` 两个模式按钮都在同一区块内，`Drag` 按钮带高亮描边，当前选中态清晰可见。
  - `Chinese overlay` 单独作为一个开关卡片出现，右侧状态徽章显示 `On`，说明覆盖层偏好也在同一设置区里。
  - 偏好区标题、说明文案、开关状态都完整可读，不需要离开设置面板去别处找二级入口。

## 结论
- 大杀四方输入模式偏好已经收敛到局内悬浮球的设置面板中。
- 本轮已生成并人工检查两张关键截图，分别覆盖“设置弹层已打开”和“偏好设置区本身”。
