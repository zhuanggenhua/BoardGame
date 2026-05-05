# Lobby 线上反馈：房间加入失败生产止血记录（2026-05-05）

## 来源

- 线上反馈源：生产 Mongo `feedbacks`
- 反馈 ID：
  - `69f86b739ec13b96d71107d4` — `创房间后朋友进不了提示进入失败`
  - `69f86c159ec13b96d7110804` — `朋友加入不了房间提示加入失败`

## 现场事实

### 1. 生产真源未关闭的人类反馈

- 2026-05-05 通过生产 Mongo 直查，未关闭的人类反馈仅剩上述 2 条。
- 两条都落在首页 `/` 的 `feedback-modal`，描述同一类现象：房间创建后，朋友加入失败。

### 2. 生产接口可复现失败

部署前直接对生产接口执行：

1. `POST /games/tictactoe/create`
2. `POST /games/tictactoe/:matchId/claim-seat`
3. `POST /games/tictactoe/:matchId/join`（**不带 `playerID`**，仅带 `playerName + guestId`）

部署前第 3 步返回：

- HTTP 403
- body: `{"error":"playerID is required"}`

这与用户反馈“朋友加入失败”完全一致。

### 3. 生产代码根因

生产机仓库 `/home/admin/BoardGame/server.ts` 当时仍是旧实现：

- `git rev-parse HEAD` = `2d1b8bf8b3fea80a536dd5ff3008b5e032752027`
- `/games/:name/:matchID/join` 仍要求 `playerID`

而当前仓库 / `origin/main` 已切到新语义：

- join 允许省略 `playerID`
- 服务端通过 `resolveJoinSeat(...)` 自动分配空座

即：**线上故障不是新问题，而是生产服务仍跑着旧 join 协议。**

## 生产止血动作

已在生产机执行项目规定脚本：

```bash
bash scripts/deploy/deploy-image.sh update
```

说明：

- 使用的是 `docker-compose.prod.yml`
- 未使用禁用项 `docker compose up -d`

## 部署后验证

再次对生产接口执行同样链路：

1. 创建 `tictactoe` 房间
2. 房主 `claim-seat`
3. 朋友以 `playerName + guestId` 直接 `join`

验证结果：

- 创建成功
- 房主占座成功
- 朋友加入成功
- 服务端返回 `playerID = "1"` 与有效 `playerCredentials`

示例验证结果：

```json
{
  "matchId": "bm2LiGg7lnQ",
  "hostClaimed": true,
  "guestJoined": true,
  "guestPlayerId": "1"
}
```

## 关于 Android 反馈里的额外报错

`69f86c159ec13b96d7110804` 附带了：

- `window.unhandledrejection`
- `"AppUpdate" plugin is not implemented on android`

这不是本次“加入房间失败”的直接生产根因；当前主故障仍是服务端 join 协议过旧。

但它暴露出一个独立兼容性风险：

- 老 Android 壳缺失 `AppUpdate` 原生插件时
- `subscribeAndroidNativeUpdateState()` 的 listener 注册 promise 会直接 reject
- 前端会留下无处理 rejection 痕迹

本地已补兼容修复，见：

- `src/lib/mobile/androidNativeUpdates.ts`
- `src/lib/__tests__/androidLiveUpdates.test.ts`

## 结论

- 两条“朋友加入房间失败”线上反馈的主根因已确认并完成生产止血。
- 生产当前已能按“无需前端预猜 seat，由服务端自动分配空座”的协议正常加入。
- Android `AppUpdate` 缺失插件属于并行兼容性补丁，已在本地补上，待后续随正常发布链路带上。
