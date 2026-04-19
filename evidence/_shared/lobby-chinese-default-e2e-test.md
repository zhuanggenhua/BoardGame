# 大厅中文默认链路 E2E 证据

## 测试命令

- `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "井字棋详情弹窗会显示当前动作入口"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "井字棋详情页不会再渲染对战AI按钮"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "大杀四方 创建房间弹窗可直接配置 AI 人数和模组，并为游客保存偏好"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "移动端包管理游戏详情在左下角显示包管理入口"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "王权骰铸 更新日志 tab 会渲染接口返回的已发布内容"`

结果：全部通过。

## 截图观察

### 1. 井字棋详情页不再显示英文 AI 入口

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\井字棋详情页不会再渲染对战AI按钮\lobby-tictactoe-no-play-ai-entry.png`

肉眼观察：

- 左侧标题是“井字棋”，不是 `Tic-Tac-Toe`。
- 左侧只保留“教程模式”，右侧主按钮是“创建房间”，没有 `Play AI` 或 `Single Device`。
- 顶部 tab 是“在线大厅 / 更新 / 评价 / 排行榜”，没有 `Leaderboard`、`Updates` 之类英文入口。

### 2. 移动端包管理确认弹窗为中文

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\移动端包管理游戏详情在左下角显示包管理入口\lobby-mobile-package-entry-confirm-modal.png`

肉眼观察：

- 弹窗眉头是“安装确认”，主标题是“下载井字棋游戏包”。
- 中部信息块显示“预计下载大小 / 代码包 / 素材包”，没有 `Estimated Download`、`Code Pack`、`Asset Pack`。
- 底部主按钮是“确认下载”，次按钮是“取消”，没有 `Confirm Download`。

### 3. 移动端包管理失败态为中文

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\移动端包管理游戏详情在左下角显示包管理入口\lobby-mobile-package-entry-failed-retry.png`

肉眼观察：

- 失败标题显示“待接入下载器”，不是 `Downloader Pending`。
- 重试按钮显示“重新发起”，没有 `Retry`。
- 失败说明与底部提示都是中文，保持了和确认弹窗一致的中文链路。

### 4. 王权骰铸更新日志页为中文

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\王权骰铸-更新日志-tab-会渲染接口返回的已发布内容\lobby-dicethrone-changelog-renders-published-entry.png`

肉眼观察：

- 左侧游戏名显示“王权骰铸”，右侧 tab 显示“更新”，没有 `Dice Throne`、`Updates`。
- 更新条目标题是“平衡性更新”，旁边标签是“置顶”，不是 `Balance Update`、`Pinned`。
- 正文是“烈焰法师的灼烧提示已与已发布规则同步。”，说明中文 mock 数据已实际渲染到页面。

### 5. 大杀四方创建房间链路仍保持中文

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\大杀四方-创建房间弹窗可直接配置-AI-人数和模组，并为游客保存偏好\lobby-smashup-create-room-ai-config-modal.png`

肉眼观察：

- 弹窗主标题为“创建房间”，AI 区块为“加入 AI / AI 占位 / 1 号位（房主）/ 2 号位 / 3 号位”。
- 底部操作是“取消 / 确认”，没有 `Create Room`、`Add AI`、`Confirm`。
- 说明大厅中文默认链路与创建房间中文链路已经收口一致。
