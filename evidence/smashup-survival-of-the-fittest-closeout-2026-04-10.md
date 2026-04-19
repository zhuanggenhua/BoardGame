# Smash Up「适者生存」反馈 69d72257932fe508b2420cdb 收口阻塞记录

## 结论摘要

- 业务侧已存在修复：`适者生存` 当前通过 `playNeedsBase` 进入选基地流程，不再直接走“无目标行动卡”路径。
- 本轮补上了目标 E2E 用例，覆盖“点卡进入选基地 → 点基地后按全场规则结算”这条真实用户链路。
- `apps/api/src/main.ts` 的测试模式 Mongo 初始化已改成 `MongoMemoryServer.create({ instance: { ip: '127.0.0.1', port: 0 } })` 等价的 loopback 策略，避免继续走 `0.0.0.0` 绑定。
- 当前**未能把反馈正式收口为 resolved**：目标 E2E 没有跑到业务断言，阻塞在前端 Vite runtime OOM 崩溃，不是 `适者生存` 逻辑断言失败。

## 本轮改动

1. `apps/api/src/main.ts`
   - 新增测试模式 MongoMemoryServer loopback 创建函数。
   - 测试模式下显式使用 `127.0.0.1 + port 0`，规避当前环境对 `0.0.0.0` 的拒绝。

2. `apps/api/test/vitest.setup.ts`
   - 补齐 `MONGOMS_*` 默认环境。
   - 为 `MongoMemoryServer.create` 注入 loopback 默认参数。
   - 保持 `MONGO_URI` 默认指向 `mongodb://localhost:27017/boardgame_test`，避免把整套 `test:api` 突然切到当前仍不稳定的 Vitest threads + memory-server 组合。

3. `e2e/smashup-gameplay.e2e.ts`
   - 新增目标用例：`适者生存应先进入选基地流程，再按所选基地结算全场最低力量随从消灭`

## 动态验证记录

### 1) loopback MongoMemoryServer 可单独启动

命令：

```powershell
node -e "const { MongoMemoryServer } = require('mongodb-memory-server');(async()=>{const mongo=await MongoMemoryServer.create({ instance:{ ip:'127.0.0.1', port:0 } });console.log('MONGO_OK', mongo.getUri());await mongo.stop();})();"
```

结果：

- 输出 `MONGO_OK mongodb://127.0.0.1:11126/`
- 说明当前环境下，loopback + 随机端口路径是可行的。

### 2) 目标 E2E 已进入真实起服链路，但前端 runtime 崩溃

命令：

```powershell
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
npm run test:e2e:ci:file -- e2e/smashup-gameplay.e2e.ts "适者生存应先进入选基地流程，再按所选基地结算全场最低力量随从消灭"
```

结果：

- API 测试模式日志明确出现：
  - `[API] 测试模式 Mongo 已就绪`
  - `source: "memory-server"`
  - `port: 21100`
- 说明 `apps/api/src/main.ts` 的 test mongo 初始化链已实际跑通。
- 但 Playwright 最终失败在 `openTestGame()` 等待 test harness 阶段，原因不是业务断言，而是前端 Vite runtime 退出。

关键日志：

- `D:\gongzuo\webgame\BoardGame\.tmp\playwright-runtime-isolated-single-single-ci-boardgame-smashup-gameplay-88251ddee8.log`
- 其中明确出现：
  - `memory allocation of 229376 bytes failed`
  - `Vite 进程退出`
  - `退出码: 3221226505`

失败截图：

- `D:\gongzuo\webgame\BoardGame\test-results\playwright-artifacts\smashup-gameplay.e2e.ts-Sm-37124-先进入选基地流程，再按所选基地结算全场最低力量随从消灭-chromium\test-failed-1.png`

肉眼观察：

1. 页面已经进入“游戏页保护”兜底，不是 `适者生存` 的交互界面。
2. 文案显示“页面没有正常显示”，说明前端 runtime 在测试页初始化阶段就已崩溃。
3. 因为连 test harness 都没挂上，所以这张图**不能作为该反馈已修复的证据**。

## 当前 blocker 裁定

### 已解决

- API server 在测试模式下不再依赖 `0.0.0.0` 绑定 memory-server。
- 目标 E2E 用例已经补齐到仓库。

### 仍阻塞

- 当前机器上的目标 E2E 阻塞于前端 Vite OOM / runtime 崩溃。
- 这不是 `适者生存` 的业务失败，而是更底层的前端测试环境问题。

## 是否足以改成 resolved

- **暂时不够。**
- 还缺一条真正通过的目标 E2E（或同等强度的真实 UI 动态证据）来证明：
  1. 点卡后不再弹“场上没有符合条件的目标”；
  2. 能进入选基地；
  3. 选基地后按当前实现完成结算。
