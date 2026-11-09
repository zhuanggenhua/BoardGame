# 重赛丢失创建响应后的凭据恢复

## 范围与基线

- 基线：`33c10d5fda7bfca1082d37a8bff825d70fc52629`，`backup/boardgame-recovery-20261106`。
- 独立工作树实现，没有修改 main、推送或部署。
- 包含先前的重赛 socket 会话与轮次竞争修复，以及本次持久恢复协议。

## 已实现

1. 浏览器在创建请求之前，通过原有 IndexedDB 跨标签写锁持久保存随机目标房间 ID 和独立 256 位恢复令牌。同一待执行请求可由两个标签复用。
2. 服务端保持旧房 P0 及账户鉴权、权威私有配置和单次原子替换。新凭据仍由服务端生成；仅保存恢复令牌、首次凭据的 SHA-256 哈希及 owner/source/24 小时有效期。
3. `POST /games/:name/:matchID/rematch-recovery` 只读、禁止缓存，不创建、不轮换凭据、不追踪后继房间。用户房必须同时提供相同账户的有效 JWT。P0 凭据轮换、清空、目标删除、owner 改变或到期后不能恢复旧凭据。
4. 创建重放、CAS 输家、写入结果不明，以及目标预检查和源读取之间的并发提交，都只读确认已提交结果，不重复替换或删除。
5. 根恢复门在旧房间路由挂载之前恢复；进行中的创建失败可转入相同恢复流程。超时/离线保留待恢复记录。目标不存在时，只有单独确认旧房仍存在才放行旧页面，不自动重新创建。
6. 自动 404 清理不能破坏待恢复源凭据；明确强制本地退出可丢弃待恢复记录。身份和房间选择检查在写锁内执行，禁止旧响应覆盖新选择或新凭据。
7. 成功保存凭据后才移除对应待恢复记录。旧房页面重定向到后继；大厅恢复不强制入房。令牌不进入 URL、公开 DTO、socket 广播或日志。

## 验证结果

使用 Node 24.1.0。

- 最终专项回归：16 套，203/203 通过。
- 真实 loopback HTTP + Socket.IO + Betrayal 引擎 + HybridStorage 内存 CAS：覆盖丢弃 HTTP 创建响应、只读恢复原签发 P0、后继鉴权同步、旧凭据拒绝、私有 receipt 经过运行时更新仍保留、detail/lobby/socket 无泄露。
- 服务端路由测试：强制同 descriptor 的两个请求都通过预检查，CAS 输家返回赢家凭据；目标碰撞不覆盖房间；结果不明只确认一次；重复请求不重复替换。
- 安全测试：错误 token/source/game/target、无效或不同账号 JWT、轮换/清空凭据、删除目标、过期或损坏 receipt 均失败关闭。
- 客户端 happy-dom 测试：关闭/重开恢复、旧路由先恢复后挂载、大厅恢复、离线/8 秒超时与迟到响应、账号变化、锁内鉴权、拒绝存储、双标签逻辑、自动清理保护、主动改选/退出，以及没有 pending 的恢复事件。
- 修改文件 ESLint：0 errors，11 个已有 warning；最后修改的恢复门及测试单独 lint 无输出。
- 服务端生产 bundle 成功；前端 Vite 生产构建成功，保留既有 CSS 选择器和大 chunk 警告。
- `git diff --check` 通过。
- 全仓类型检查：未通过，只有基线既有 `cutsceneDemoRuntime.ts` 第 1785、1821 行 `MeshGeometry.addAttribute` 的 TS2551；本次没有修改该文件。
- 扩展路由/退出/大厅消费者回归：6 套，112 通过、2 失败。失败是大厅旧状态文案断言 `activeMatch.notice`；基线同套件复跑同样 91 通过、2 失败。其余 5 套（21 项）通过。
- 额外座位验证套件：150 通过、3 失败。失败为原有 `react-router-dom` mock 缺少 `useLocation`。在未改客户端的 33c10d5 基线工作树复跑，同样 150/3；本次没有改该测试。
- 独立代码安全复审通过。复审期间发现并修复了 live 失败清理、大厅自动清理、无提交请求挡住旧房、无 pending 事件卡 loading 等问题。

本轮合计执行 23 个不同测试文件、470 项测试：465 通过，5 项已在未改客户端基线上复现的失败。没有把已知失败计为通过。

## 重现命令

专项测试：

```sh
node scripts/infra/vitest-cli-safe.mjs run \
  src/server/__tests__/rematch.test.ts \
  src/server/__tests__/rematchSetup.test.ts \
  src/server/__tests__/rematchRecovery.test.ts \
  src/server/__tests__/rematchCreateRoute.test.ts \
  src/server/__tests__/rematchSocketAuth.test.ts \
  src/server/__tests__/betrayalRematch.http.test.ts \
  src/hooks/__tests__/RematchContext.privacy.test.tsx \
  src/hooks/__tests__/RematchContext.connection.test.tsx \
  src/hooks/__tests__/pendingRematchRecovery.test.ts \
  src/hooks/__tests__/RematchRecoveryGate.test.tsx \
  src/hooks/__tests__/matchCredentialSelection.test.ts \
  src/hooks/__tests__/matchCredentialTransaction.test.ts \
  src/hooks/__tests__/matchSocket.rematchAuth.test.ts \
  src/hooks/__tests__/matchSocket.rematchReconnect.http.test.ts \
  src/api/__tests__/matchApi.test.ts \
  src/games/betrayal/__tests__/endgameRematch.test.tsx \
  --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
```

构建与检查：

```sh
node scripts/infra/build-node-bundle.mjs --label game-prod --entry server.ts --outfile temp/prod-bundles/game/server.mjs --tsconfig tsconfig.server.json
node --max-old-space-size=8192 scripts/infra/vite-cli-safe.mjs build --config vite.config.ts --configLoader bundle
node --max-old-space-size=6144 node_modules/typescript/bin/tsc --build --pretty false
git diff --check
```

## 尚未证明的环境与边界

- 没有运行真实 Mongo、真实 Chromium 多标签或关闭标签浏览器验收，沿用已有访问限制，未绕过重试。happy-dom 和内存 CAS 不能代替这些环境。
- 没有推送、部署或线上验证。上线前仍需允许的 Mongo、浏览器环境验收，以及确定发布构建配置。必须先升级服务端，再发布依赖恢复接口的新客户端；新客户端与不支持本协议的旧服务端不能混用。
- 恢复窗口为 24 小时；旧客户端未预存独立恢复令牌的历史请求不具备本次恢复能力。
- 正常 leave/destroy 后可遗留待恢复记录至过期，不会越过选择检查复活房间；下一次启动可能多做一次无效只读恢复。
- 已显示恢复失败的标签不会自动跟随另一标签完成，可能需要重试或刷新。

## 相关实现

- [服务端恢复验证](../../src/server/rematchRecovery.ts)
- [恢复请求与 receipt 类型](../../src/shared/rematchRecovery.ts)
- [客户端持久准备与保存](../../src/hooks/match/pendingRematchRecovery.ts)
- [根恢复门](../../src/components/system/RematchRecoveryGate.tsx)
- [真实 HTTP/socket 回归](../../src/server/__tests__/betrayalRematch.http.test.ts)
