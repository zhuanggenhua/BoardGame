# 更新日志开发环境排查记录（2026-03-12）

## 目标

确认 `dicethrone` 大厅详情弹窗里的“更新日志”为什么在开发模式下没有内容，并补充对应的端到端测试入口。

## 已补测试

文件：[e2e/lobby.e2e.ts](F:/gongzuo/webgame/BoardGame/e2e/lobby.e2e.ts)

- 新增 1 条真实链路断言：打开 `Dice Throne` 详情后切到 `Changelog` tab，等待 `/game-changelogs/dicethrone` 响应，确认状态码为 `200`，并确认页面脱离 loading。
- 新增 1 条渲染断言：拦截 `/game-changelogs/dicethrone` 返回一条已发布日志，确认标题、版本、置顶标签、正文会被渲染。

## E2E 实跑结果

执行命令：

```bash
npm run test:e2e:ci -- e2e/lobby.e2e.ts
```

结果：

```text
❌ 当前运行环境不允许测试基建所需的 Node 子进程能力。
场景: E2E
失败阶段: fork
错误: EPERM (spawn)
```

结论：

- 这次不是测试代码先失败，而是当前沙箱环境直接拦截了项目 E2E 所需的 `child_process` 能力。
- 因此本轮无法在当前环境里真正启动 Playwright worker、自动起三服务，也无法生成截图证据。

## 开发环境 HTTP 证据

当前本机开发服务实际在监听：

- 前端：`127.0.0.1:5173`
- 游戏服：`127.0.0.1:18000`
- API：`127.0.0.1:18001`

直接请求 API：

```bash
GET http://127.0.0.1:18001/game-changelogs/dicethrone
```

返回：

```json
{"changelogs":[]}
```

通过 Vite 代理请求前端地址：

```bash
GET http://127.0.0.1:5173/game-changelogs/dicethrone
```

返回：

```json
{"changelogs":[]}
```

结论：

- `dev` 代理链已经通了。
- 公开接口也已经通了。
- 当前“没有内容”不是因为前端没打到接口，而是接口真实返回空数组。

## 数据库证据

API 端 `.env` 没有覆写 `MONGO_URI`，当前代码会使用默认库：

```text
mongodb://localhost:27017/boardgame
```

排查时发现 Mongo 里同时存在两个相近集合名：

```json
[
  {
    "dbName": "boardgame",
    "collection": "game_changelogs",
    "count": 1
  },
  {
    "dbName": "boardgame",
    "collection": "gamechangelogs",
    "count": 0
  }
]
```

我最初误查了空的 `gamechangelogs`。继续核对后，真实业务数据在 `boardgame.game_changelogs`。

当前 `dicethrone` 真实记录：

```json
[
  {
    "_id": "69b292788ded478fb12f47c8",
    "gameId": "dicethrone",
    "title": "111",
    "versionLabel": "111",
    "content": "test",
    "published": false,
    "pinned": false,
    "publishedAt": null,
    "createdAt": "2026-03-12T10:16:24.233Z",
    "updatedAt": "2026-03-12T10:16:24.233Z"
  }
]
```

结论：

- 当前开发库里不是“没有 changelog 数据”，而是 `dicethrone` 只有一条草稿记录。
- 后台列表会显示草稿；主页公开接口只返回 `published: true` 的记录，所以主页为空。

## 当前判断

截至 2026-03-12，本地开发环境里“后台有、主页没有”的直接原因是：

1. 前台请求链正常，能请求到 `/game-changelogs/dicethrone`
2. API 正常响应 `200`
3. 当前 `dicethrone` 记录存在，但 `published` 为 `false`
4. 后台接口/页面会显示草稿，主页公开接口只返回已发布记录

因此下一步应该优先复核“管理员发布”这条写入链为什么没有把该条记录持久化成 `published: true`，而不是继续在大厅 UI 或 changelog 展示层排查。
