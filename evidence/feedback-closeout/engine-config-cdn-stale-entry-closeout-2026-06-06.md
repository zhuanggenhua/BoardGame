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
3. 当前公网首页 `https://easyboardgame.top/` 返回的入口资源仍是旧集合，例如：
   - `assets/index-C_5TCrl0.js`
   - `assets/index-tyQKVDrf.css`
4. 当前 `https://boardgame-e6c.pages.dev/` 与最新生产部署 URL `https://0600ef34.boardgame-e6c.pages.dev/` 返回的也是同一套旧集合，说明根域名内容与 Pages 当前生产部署一致，不是单纯“边缘节点没 purge 干净”。
5. Cloudflare DNS 已确认：
   - `easyboardgame.top` 是 `CNAME -> boardgame-e6c.pages.dev`（Pages 自定义域名）
   - `api.easyboardgame.top` 才是 `CNAME -> cfargotunnel.com`（服务器 API 入口）
6. Cloudflare Pages 项目 `boardgame` 当前生产分支是 GitHub `zhuanggenhua/BoardGame` 的 `main`，最近一次成功生产部署是 `2026-06-06T13:45:51.831604Z` 的 commit `4d37d270a440a2e0a70b823e4a259fe3243a5f15`。
7. 当前本地仓库 `main` 已比 `origin/main` 领先 `5` 个提交；服务器 `http://127.0.0.1/` 返回的新入口 `assets/index-3eBZoSWA.js` 来自这条更靠前的本地/服务器链，而不是当前 Pages 已发布的 GitHub `main`。

## 结论

- `engineConfig is not defined` 这组系统反馈，当前已锁定为 **根域名前端实际走 Cloudflare Pages，而 Pages 生产部署仍停留在旧的 GitHub `origin/main` 构建**。
- 之前“源站已新、公网仍旧”的现象只说明**服务器本地链路**比 Pages 新，不能再被解释成“只差一次 Cloudflare purge 就能让根域名切到服务器 dist”。
- 这不是一个继续猜改 `MatchRoom` / `OnlineAiSeatBridge` 业务逻辑就能收口的问题；也不能只根据服务器 `dist` 判定“线上前端已修好”。
- 在未让 Pages 发布到包含目标修复的提交，或未证明根域名已切到正确 Pages 部署前，不应把这 7 条单直接标成“当前树已修复可 closed/resolved”。

## 本轮补救

- 已给部署链补充两项能力：
  - `scripts/deploy/purge-cloudflare-cache.sh`
  - `scripts/deploy/deploy-image.sh` 新增公网入口一致性门禁，并支持把比对源从默认 `127.0.0.1` 切到 Pages 域名
- Cloudflare purge 现在支持两种认证：
  - `CLOUDFLARE_API_TOKEN`
  - 或 `CLOUDFLARE_AUTH_EMAIL + CLOUDFLARE_GLOBAL_API_KEY`
- 对当前正式环境，后续验证“根域名前端是否已更新”时，必须优先核对：
  - `https://easyboardgame.top/`
  - `https://boardgame-e6c.pages.dev/`
  - Pages 最新生产部署 commit / URL

## 当前 blocker

- 当前已经具备 Cloudflare purge 凭据，也已经验证过 purge；但 purge 不会把根域名从 Pages 旧构建切到服务器本地新构建。
- 真正 blocker 是：Pages 当前生产发布仍停在旧的 `origin/main` 提交，而本地/服务器链路已经领先。
- 在 Pages 发布链未更新前，这 7 条系统单暂不应回写关闭。
