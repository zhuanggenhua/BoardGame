## 1. 引擎层类型与系统

- [x] 1.1 在 `src/engine/types.ts` 新增 `RematchState` 类型定义
- [x] 1.2 在 `SystemState` 接口中添加 `rematch` 字段
- [x] 1.3 创建 `src/engine/systems/RematchSystem.ts` 实现系统逻辑
- [x] 1.4 在 `src/engine/systems/index.ts` 导出 RematchSystem 并加入默认系统

## 2. 通用 UI 组件

- [x] 2.1 创建 `src/components/game/RematchActions.tsx` 通用投票组件
- [x] 2.2 添加通用 i18n 文案到 `public/locales/zh-CN/common.json` 和 `en/common.json`

## 3. 游戏迁移（TicTacToe）

- [x] 3.1 移除 `Board.tsx` 中 `handlePlayAgain` 的 `lobbyClient.playAgain` 逻辑
- [x] 3.2 移除相关状态（`isRematchLoading`、凭证处理等）
- [x] 3.3 集成 RematchActions 组件替代原按钮
- [x] 3.4 移除 TicTacToe 专用的 rematch i18n 文案（改用通用）

## 4. 验证与清理

- [ ] 4.1 本地测试：双方投票后同房重开
- [ ] 4.2 验证：玩家2不再触发 404
- [x] 4.3 清理：移除所有遗留代码与未使用的 import
