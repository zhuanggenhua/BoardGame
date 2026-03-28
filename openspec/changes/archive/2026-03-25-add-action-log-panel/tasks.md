# 实现任务清单

## 1. 引擎：ActionLogSystem 与类型
- [x] 1.1 在 `src/engine/types.ts` 新增 `ActionLogEntry` / `ActionLogState` / `ActionLogSegment` 类型
- [x] 1.2 新增 `src/engine/systems/ActionLogSystem.ts`，包含 allowlist 过滤和默认 `maxEntries=50`
- [x] 1.3 在基础系统装配中注册 `ActionLogSystem`

## 2. 撤回单步与共享白名单
- [x] 2.1 `UndoSystem` 默认 `maxSnapshots=1`，但保留可配置能力
- [x] 2.2 各游戏定义共享 allowlist 常量，并同时传给 `UndoSystem` 和 `ActionLogSystem`
- [x] 2.3 确保操作日志只记录 allowlist 内命令

## 3. UI：GameHUD 日志面板
- [x] 3.1 补齐 ActionLog 相关上下文/读取链路
- [x] 3.2 GameHUD FabMenu 增加“操作日志”入口
- [x] 3.3 渲染日志条目（文本 + 卡牌片段）并支持 hover 预览
- [x] 3.4 补充 i18n 文案（HUD 标签等）

## 4. 卡牌资源对齐
- [x] 4.1 补齐参与日志预览的卡牌资源引用（`assets.image` / `atlasIndex` 等）

## 5. 测试与验证
- [x] 5.1 引擎测试：`ActionLogSystem` 记录 allowlist 命令并遵守 `maxEntries`
- [x] 5.2 引擎测试：`UndoSystem` 默认单步撤回
- [ ] 5.3 手动验证：日志面板、卡牌 hover 预览、撤回后日志回滚
