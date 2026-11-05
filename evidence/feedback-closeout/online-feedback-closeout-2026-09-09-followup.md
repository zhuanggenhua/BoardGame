# 线上反馈收口补充证据（2026-09-09）

## 本轮口径

- 处理口径：线上真实反馈。
- 初始读取时间：北京时间 2026-09-09 13:58:45。
- 初始读取结果：`open=2`，`in_progress=1`，共 3 条代表项。
- 真实读取入口：`https://api.easyboardgame.top/admin-api/feedback`。
- 真实写回入口：无管理 token 时使用生产 Mongo SSH 写入口，本轮回写为 `writer=mongo-ssh`。
- 本地镜像：`temp/feedback-closeout/status-board.json`，只作为线上状态镜像，不是正式源。

## 已关闭反馈

### 6aa09719def4f2f0ea836b57

- 反馈原文：`[auto][react.error_boundary] Cannot read properties of undefined (reading 'default')`
- 现实含义：有玩家浏览器在前端入口触发 React 错误边界，页面曾崩溃。
- 当前复查：生产首页和 4 个配置审查真实路径均返回 200，Playwright 未捕获 `pageerror` 或错误级 console。
- 对照结论：反馈栈里的 `ConfigReviewRoutes-DVZ1ARDO.js` / `App-C5hyLfWn.js` 是旧资源；当前入口 HTML 引用 `/assets/index-DTPazrHf.js`，旧资源不再是现存入口。
- 状态回写：已通过 `mongo-ssh` 写为 `closed`。
- 证据文件：`evidence/feedback-closeout/client-feedback-6aa09719-stale-config-review-lazy-module-current-production-closed-2026-09-09.md`

### 6aa0f39d61ba00ac3b647d21

- 反馈原文：`吸血鬼刚刚选的是不可防御伤害`
- 效果描述原文：生产中文文案中基础版 `魅惑之力` 为 `3 个催眠：获得 1 个催眠并造成 4 点伤害。`，升级版 `魅惑之力 II` 才写 `造成 5 点不可防御伤害。`
- 当前现场：诊断包事件流显示本次 `sourceAbilityId=mesmerize-power`、`isDefendable=true`；角色当时没有装备 `魅惑之力 II` 升级。
- 对照结论：玩家把基础版理解成了不可防御伤害；当前实现与基础版规则文案一致。
- 状态回写：已通过 `mongo-ssh` 写为 `closed`，并补全了面向提交者的关闭说明。
- 证据文件：`evidence/feedback-closeout/dicethrone-feedback-6aa0f39d-vampire-mesmerize-defendable-closed-2026-09-09.md`

## 保留未解决反馈

### 6a9ed318def4f2f0ea835ba9

- 反馈原文：`[system][infra-cpu-watch] game-server CPU sustained high: average=100.84% highSamples=3/3 threshold=80% decision=restarted restarted=yes`
- 自动检测场景：生产 `game-server` 连续 3 次 CPU 高于 80%，CPU 看门脚本保留现场后执行重启并提交系统反馈。
- 高峰现场：`/home/admin/BoardGame/logs/game-server-cpu-watch/20260907T150602Z-boardgame-game-server.txt` 记录采样 `86.09%`、`112.12%`、`104.30%`，并保留 V8 CPU profile。
- 当前恢复证据：北京时间 2026-09-09 14:38，生产 `boardgame-game-server` CPU 样本为 `1.07%`、`0.16%`、`0.40%`，监控决策为 `ok`，当前容器 CPU 快照约 `0.32%`。
- 当前生产版本：`boardgame-game-server` 镜像 revision 为 `d41a8f6c14ee631ad1e77682a7a3cc4bddd15c96`。
- 当前判断：已确认高 CPU 触发、自动重启止血、当前生产恢复；但仍没有闭环到单一业务根因或可安全修改的代码 owner。
- 状态处理：保持 `in_progress`，不写 `resolved` / `closed`。继续收口需要专项分析 CPU profile 与同批 Dice Throne 对局的在线 AI 恢复 / 状态广播 / 保存链路，或由用户明确决定按“已止血但根因未定位”关闭。

## 最终回查

- 最终线上回查时间：北京时间 2026-09-09 14:58:41。
- 命令：`node .spec/skills/feedback-closeout/scripts/triage-open-feedback.mjs --statuses open,in_progress --limit 100 --slots 6 --out-dir temp/feedback-closeout/2026-09-09T14-58-40-311Z-final-recheck-after-reason-fix`
- 结果：`open=0`，`in_progress=1`，剩余代表项只有 `6a9ed318def4f2f0ea835ba9`。
- 本地镜像校验：`node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` 返回 `feedback-status: ok`。
