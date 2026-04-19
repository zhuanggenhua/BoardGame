# 移动端包管理入口 E2E 证据

## 用例

- 测试文件：`e2e/_shared/lobby.e2e.ts`
- 用例名：`移动端 package-managed 游戏详情在左下角显示包管理入口`
- 执行命令：`npm run test:e2e:file -- e2e/_shared/lobby.e2e.ts "移动端 package-managed 游戏详情在左下角显示包管理入口"`

## 截图 1：左下角入口初始态

![左下角入口初始态](../test-results/evidence-screenshots/_shared/lobby.e2e/移动端-package-managed-游戏详情在左下角显示包管理入口/lobby-mobile-package-entry-left-bottom.png)

- 入口已经收成一个纯图标圆按钮，位于房间区左下角，视觉上是压在内容上的 overlay，不再像单独新增的一排内容。
- `CREATE ROOM` 按钮、空房间区和顶部 tab 都保持原位，说明这个入口没有挤压正文布局，只是悬浮在房间区上层。
- 图标按钮明显小于房间按钮和正文块，用户第一眼会把它理解为辅助动作，而不是详情页的新主模块。

## 截图 2：下载确认弹窗

![下载确认弹窗](../test-results/evidence-screenshots/_shared/lobby.e2e/移动端-package-managed-游戏详情在左下角显示包管理入口/lobby-mobile-package-entry-confirm-modal.png)

- 点击左下角图标后，中央弹出统一羊皮纸风格的确认弹窗，没有直接开始下载。
- 弹窗里能看到 `Estimated Download`、`Code Pack`、`Asset Pack` 三段结构，说明大小预览和包类型信息已经进入确认层。
- 当前因为还没接发布清单，大小位置显示为 `Pending manifest`，这和当前实现阶段一致，没有伪造下载大小。
- 按钮和卡片背景沿用了详情页同一套羊皮纸配色与深棕主按钮，没有额外起一套突兀皮肤。

## 截图 3：点击确认后的进度态

![点击确认后的进度态](../test-results/evidence-screenshots/_shared/lobby.e2e/移动端-package-managed-游戏详情在左下角显示包管理入口/lobby-mobile-package-entry-progress-card.png)

- 点击 `Confirm Download` 后，弹窗内部切到 `Preparing` 进行中状态，并出现横向进度条，说明下载流程已经进入统一状态机。
- 进行中态仍然停留在同一张中央弹窗里，没有回落成页面里的单独卡片，也没有让房间区重新排版。
- 当前百分比显示为 `Pending`，符合“先把确认流、阶段切换和进度 UI 接起来，再接真实下载器”的实现目标。

## 截图 4：失败与重试态

![失败与重试态](../test-results/evidence-screenshots/_shared/lobby.e2e/移动端-package-managed-游戏详情在左下角显示包管理入口/lobby-mobile-package-entry-failed-retry.png)

- 模拟流程结束后，弹窗切到 `Downloader Pending`，并明确写出“真实下载器尚未接入”，没有伪装成已经安装成功。
- `Retry` 按钮保留在同一张弹窗里，用户不需要回到页面重新找入口，失败恢复路径和首次确认路径是同一条链路。
- 失败态依旧是中央弹窗，不会在房间区额外撑出一张失败卡片。

## 结论

- 当前实现已经满足“移动端详情页左下角只保留一个下载图标入口”的位置要求。
- 图标入口以 overlay 方式压在房间区上层，没有破坏详情页正文布局，也不会看起来像单独新增一排。
- 点击图标后会先弹统一样式的确认弹窗，并展示代码包/素材包与总大小预览位。
- 点击确认后会在同一张弹窗里进入进行中态，并在当前 mock runner 结束后切到明确的失败/重试态，链路已经收口为“图标入口 + 确认弹窗 + 进度条 + 重试”。
- 真实下载器和远端发布清单仍未接入；当前进度与失败文案是受控占位，用于验证 UI、状态切换和后续 service 接线。
