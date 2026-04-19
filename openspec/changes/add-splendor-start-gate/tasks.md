# 实现任务清单

## 1. 领域层开始门槛
- [x] 1.1 为 `splendor` core 增加 `hostPlayerId` 与 `hostStarted`
- [x] 1.2 新增 `HOST_START_GAME` 命令与 `HOST_STARTED` 事件
- [x] 1.3 在开始前拒绝玩法命令，仅允许房主开始游戏
- [x] 1.4 reducer 正确写入开始状态

## 2. UI：开始前等待/开始覆盖层
- [x] 2.1 `Board` 在 `hostStarted=false` 时显示等待/开始覆盖层
- [x] 2.2 房主显示“开始游戏”按钮，其他玩家显示等待文案
- [x] 2.3 开始后恢复正常棋盘交互

## 3. 文案与验证
- [x] 3.1 补充中英文开始前提示文案
- [x] 3.2 补充 `splendor` 领域测试，验证开始前不能执行玩法命令
- [x] 3.3 运行 `splendor` 相关测试验证
