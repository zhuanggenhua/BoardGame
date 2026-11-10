# 线上反馈 6ac609fb8ae0d30b1f56206f：Smash Up 观战手牌空白

## 反馈内容 / 现实症状

> 观战看不到手牌，是空白的。

来源：线上 `https://api.easyboardgame.top/admin-api/feedback`，反馈记录创建于 `2026-10-07T08:59:39.842Z`；路由为 `/play/smashup/match/nbBsLolR2nL?spectate=1`，附带 1 张截图。

## 当前现场

- 诊断快照处于 Smash Up `playCards` 阶段，路由为 `?spectate=1`。
- 观战切换到其他玩家时，`Board.tsx` 把 `isAlternateView` 直接传成 `HandArea.isOpponentView=true`，导致观战也走真实玩家的“对手牌背”路径；观战看到的是空白/不可读手牌，而不是完整卡面。
- Smash Up 的 spectator player view 已经应保留所有玩家的完整手牌对象；问题在 UI 把观战误判成受限对手视角。

## 发现的问题

这是观战视角与真实玩家对手视角混用：观战本应无手牌限制，但 UI 复用了 `isAlternateView => opponent view` 的牌背规则。

## 处理方式 / 修复结果

- `src/games/smashup/Board.tsx`：新增 spectator 分支；观战切换到任意玩家时不再传 `isOpponentView`，因此显示完整卡面。
- `src/games/smashup/ui/HandArea.tsx`：恢复“只有真实玩家的对手视角才显示牌背”的语义，不再把 `hidden_private_card` 作为观战限制开关。
- `src/games/smashup/domain/index.ts`、`src/games/smashup/__tests__/playerView-runtime-contract.test.ts`：保留并验证 spectator view 返回各玩家的完整手牌对象。
- `src/games/smashup/__tests__/HandArea.discardLayout.test.tsx`：保留真实玩家对手视角牌背回归，避免与观战语义混淆。

## 验证

- Smash Up 观战投影与手牌回归：`7 passed`。
- `npx tsc --noEmit --pretty false`：通过。
- `git diff --check`：通过；仅有工作树既有 LF/CRLF 提示，无 diff 错误。

## 当前状态与边界

`resolved`。本地根因、代码修复和定向回归已完成；生产当前 bundle 尚未包含本轮修正，必须发布后再从 `?spectate=1` 切换多个玩家验证完整手牌。

## 漏审复盘 / 规范回代判断

旧测试覆盖了普通玩家与对手视角，却没有覆盖“观战切换其他玩家仍应显示完整卡面”；属于 spectator UI 语义回归缺口。现有反馈收口规范已覆盖逐条现场、根因、修复和验证要求，本轮不新增第二套规范源。

## 2026-10-08 当前玩家视角端到端复核

用户补充的验收要求是：必须看到当前行动玩家本人、卡牌内容完整，并能在观战中正常浏览检视。复核旧截图发现回合条仍显示“对手”，尽管手牌已经渲染；因此旧截图不作为本轮验收证据。

- 修改 `src/games/smashup/Board.tsx` 与中英文 Smash Up 文案：观战默认视角跟随当前行动玩家；牌桌回合条使用“当前玩家”，不再把无座位的观战者标成“对手”。真实玩家查看对手仍保留牌背语义。
- 正常观战只读浏览包括查看完整卡面、打开并关闭卡牌检视；观战仍不能代替玩家提交出牌命令。
- 真实 E2E 重新完成双人正式开局，进入 `/play/smashup/match/<matchId>?spectate=1`，构造活动玩家为 1 的合法出牌阶段；断言五张完整卡面均加载，玩家 0 手牌未混入，检视激光三角龙后显式关闭返回原手牌，服务端权威 `core` 不变。最终结果：`1 passed`。
- 三张当前工作树整屏图于 2026-10-08 15:23（新加坡时间）生成，视口 1920×1080；默认当前玩家手牌、检视层、关闭返回均逐图 `PASS`。TypeScript 检查与目标文件 `git diff --check` 通过。
- 当前生产记录仍为 `resolved`，说明为本地已修、生产尚未发布/从观战入口回查；这只证明线上状态记录，不证明线上版本已生效。本轮没有部署生产。

## 2026-10-08 20:08（新加坡时间）当前工作树重跑

- D 盘空间恢复后，先用项目资源清单生成器重建了因此前 ENOSPC 截断的根级 i18n manifest，再通过标准 E2E 入口从真实双人对局重跑；本次结果为 `1 passed`。
- 本次同一运行生成并晋升四张 1920×1080 原图及同源 `.e2e-image-index.json`：默认当前玩家手牌、只读点选态、卡牌完整检视、关闭检视返回手牌。四张原图逐张 AI 核图均为 PASS；当前清单 `evidence/smashup/smashup-spectator-current-player-hand-pass-20261008.json` 绑定此运行，不引用旧三图。
- E2E 断言活动玩家五张卡完整加载、另一玩家手牌未混入、点选仅产生本地状态、检视可开关，且服务端权威 `core` 前后相同。共享 Provider 的命令拒绝测试与 TypeScript 检查尚待本轮复跑。
- 覆盖矩阵只将 Smash Up 标为本轮真实入口已验收；其余 11 款仍明确保留各自的视角 / 隐私 / 只读证据与未覆盖 E2E，不从单款结果外推。
- 线上反馈上次成功读为 `resolved`；本轮未部署、未改线上状态，故没有宣称生产已生效。
- 收尾复验确认 PASS 清单校验通过（4 张媒体、1 条前中后链路），网页查看器 dry-run 与目录注册均成功，VIEWER_URL=`http://127.0.0.1:4867/?key=bd9946cc1c06`，未自动打开。线上 HTTPS API 与记录过的直连 IP GET 在本轮均超时，因此线上状态没有本轮刷新确认，沿用上次成功回查时间 `2026-10-08T08:09:31.547Z`。
