# 大厅创建房间过渡 Loading E2E 证据

## 测试用例

- 文件：`e2e/_shared/lobby.e2e.ts`
- 用例：`创建房间时会显示进入对局 loading`
- 命令：`npm run test:e2e:ci:file -- lobby.e2e.ts "创建房间时会显示进入对局 loading"`

## 截图

![创建房间进入对局 loading](../test-results/evidence-screenshots/_shared/lobby.e2e/创建房间时会显示进入对局-loading/lobby-tictactoe-create-room-loading.png)

截图绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\创建房间时会显示进入对局-loading\lobby-tictactoe-create-room-loading.png`

## 人工观察结论

- 画面中央显示了完整的全屏黑底 loading，而不是继续停留在“创建房间”弹窗按钮的局部 `处理中...` 状态。
- 底部文案明确可见：标题为“创建中”，描述为“正在创建房间并进入对局...”，用户能知道当前不是卡死，而是在等待进入对局。
- 右上角没有再出现“服务目前不可用”的误报 toast，说明瞬时 socket connect error 已被延迟门控，不会在恢复成功时误吓用户。
