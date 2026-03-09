# TestHarness 刷新行为复核（2026-03-09）

## 结论

- `/play/<gameId>` 本地测试模式下，`TestHarness` 只操作当前页面内存中的状态快照，**刷新后不会持久化**
- `/play/<gameId>/match/<matchId>` 联机页面下，客户端拿到的是经过 `playerView` 过滤后的玩家视图，**禁止直接用客户端状态回灌服务器**
- 需要让联机对局在刷新后保留测试注入状态时，**唯一正确入口**是服务端 `/test/inject-state` 与 `/test/patch-state`

## 为什么旧结论不成立

之前曾尝试让 `StateInjector` 在联机模式下通过 socket 把客户端状态直接写回服务端，并假设这样就能获得“状态持久化”。  
这个思路后来被 reviewer 证明有两个根本问题：

1. 联机 `GameProvider` 持有的是 **`playerView` 过滤后的玩家视图**，不是权威状态  
2. `/game` namespace 上新增的 `test:injectState` 没有复用对局归属/credentials 校验，存在未授权篡改风险

因此当前修复采取了更保守也更正确的边界：

- `StateInjector` 只负责读写当前前端持有的状态快照
- 联机 `GameProvider` 的 `harness.state` 改为只读，写入会明确报错
- 服务端权威注入只保留在 `/test` 路由

## 本次验证

### 1. 本地模式刷新行为

测试文件：`e2e/test-state-persistence.e2e.ts`

验证目标：
- `setupScene()` 注入后的场景在当前页面内可见
- 刷新后页面回到新的本地对局，而不是错误地“保留”旧场景

关键断言：
- 刷新前 `sys.phase === 'playCards'`
- 刷新前玩家 0 手牌数量为 `1`
- 刷新前第一个基地上随从数量为 `2`
- 刷新后重新出现 `factionSelection`
- 刷新后玩家 0 / 玩家 1 手牌都回到 `0`
- 刷新后基地随从回到默认空场

截图结论：
- `test-results/test-state-persistence.e2e.ts-本地-TestHarness-场景刷新后应重建默认状态-chromium/before-refresh.png`：棋盘已进入对局，左侧基地上有红蓝各 1 个随从，底部有 1 张手牌，左上角显示 `TURN 1 / YOU / Play`
- `test-results/test-state-persistence.e2e.ts-本地-TestHarness-场景刷新后应重建默认状态-chromium/after-refresh.png`：页面回到 `DRAFT YOUR FACTIONS` 派系选择界面，说明本地场景没有跨刷新保留

### 2. 测试环境端口隔离

测试文件：`e2e/test-port-isolation.e2e.ts`

验证目标：
- E2E 测试仍指向隔离端口 `20000 / 21000 / 6173`
- 在请求创建房间前先等待测试游戏服务器真正就绪，避免把启动中的 `ECONNREFUSED` 误判为端口隔离失败

本次结果：
- `getGameServerBaseURL()` 返回 `http://127.0.0.1:20000`
- 在等待服务就绪后，创建房间请求返回 `200 OK`

## 架构裁决

**最正确方案**：  
把“权威状态注入”严格收口到服务端测试 API，而不是继续依赖联机客户端 `TestHarness`。

原因：
- 架构边界正确：客户端玩家视图 ≠ 服务端权威状态
- 安全边界清晰：复用测试路由上的 token/服务端入口，而不是把写权限挂在玩家 socket 上
- 可维护性更高：本地测试模式、联机测试模式、服务端权威注入各自职责明确

## 相关文件

- `src/engine/testing/StateInjector.ts`
- `src/engine/transport/react.tsx`
- `src/engine/transport/server.ts`
- `src/server/routes/test.ts`
- `e2e/test-state-persistence.e2e.ts`
- `e2e/test-port-isolation.e2e.ts`
