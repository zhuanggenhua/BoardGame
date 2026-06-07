# `engineConfig is not defined` 系统反馈真相记录（2026-06-06）

## 处理对象

- 反馈：
  - `6a23bbbb8bfd75951e984109`
  - `6a23bfcb8bfd75951e98412b`
  - `6a23c2583f06ad518a7dec0f`
  - `6a23d4503f06ad518a7dec4b`
  - `6a23dea1dcb72bc9665b4ddf`
  - `6a23df61dcb72bc9665b4de1`
  - `6a23e468dcb72bc9665b4df3`
- 症状：`ReferenceError: engineConfig is not defined`
- 主要路由：`/play/dicethrone/match/...`、`/play/smashup/match/...`

## 真相来源

- 线上 Mongo `feedbacks` 原始记录
- 公网 `https://easyboardgame.top/` 实际返回的首页入口资源
- 服务器源站 `http://127.0.0.1/` 实际返回的首页入口资源
- 线上容器 `/app/dist/assets` 当前真实构建产物

## 已确认事实

1. 这 7 条系统单创建时间集中在 `2026-06-06 14:18:35 +08:00` 到 `17:12:08 +08:00`。
2. 反馈堆栈指向旧前端 chunk，例如 `MatchRoom-CJhvjseb.js`。
3. 当前公网首页返回的入口资源仍是旧集合，例如：
   - `assets/index-C_5TCrl0.js`
   - `assets/index-tyQKVDrf.css`
4. 当前源站 `http://127.0.0.1/` 返回的入口资源已经是另一套新集合，例如：
   - `assets/index-3eBZoSWA.js`
   - `assets/index-BMcStq8O.css`
5. 当前源站容器 `/app/dist/assets` 中也确实存在新集合，对不上公网仍在发的旧入口。
6. 当前公网返回的旧入口脚本还能被 Cloudflare 以 `200` 命中，说明问题位于**公网边缘缓存 / 旧入口分发**，不是“当前源站仍在跑同一坏源码”。

## 结论

- `engineConfig is not defined` 这组系统反馈，当前已锁定为 **Cloudflare / 公网缓存仍在发旧首页入口与旧 chunk 映射**。
- 这不是一个可以继续通过猜改 `MatchRoom` / `OnlineAiSeatBridge` 业务逻辑来收口的问题。
- 在未完成 Cloudflare purge 或公网/源站入口一致性恢复前，不应把这 7 条单直接标成“当前树已修复可 closed/resolved”。

## 本轮补救

- 已给部署链补充两项能力：
  - `scripts/deploy/purge-cloudflare-cache.sh`
  - `scripts/deploy/deploy-image.sh` 新增公网/源站入口一致性门禁
- 若服务器环境补齐 `CLOUDFLARE_ZONE_ID` 与 `CLOUDFLARE_API_TOKEN`，部署后会自动执行 purge，并拒绝把“源站已更新但公网仍发旧入口”的状态当作部署完成。

## 当前 blocker

- 当前服务器和容器环境里未发现可直接使用的 Cloudflare purge 凭据。
- 因此前台公网入口还不能在本轮直接完成 purge 止血，7 条系统单暂不应回写关闭。
