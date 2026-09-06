# 线上反馈收口证据（2026-09-05）

## 本轮口径

- 处理口径：线上真实反馈。
- 统计时间：北京时间 2026-09-05 20:40:58。
- 真实读取入口：`https://api.easyboardgame.top/admin-api/feedback`。
- 真实写回入口：无管理 token 时使用生产 Mongo SSH 写入口。
- 本地镜像：`temp/feedback-closeout/status-board.json`，只作为线上状态镜像，不是正式源。

## 线上读取

- 初始抓取：`node .spec/skills/feedback-closeout/scripts/triage-open-feedback.mjs --statuses open,in_progress --limit 100 --slots 8 --out-dir temp/feedback-closeout/online-20260905-initial`
- 抓取结果：`open=1`，`in_progress=1`，共 2 条未收口代表项。
- 新增 open 项 `6a9bb69fca09da8ce04f3a8e` 已立即接手并写回 `in_progress`，生产回写返回 `writer=mongo-ssh`、`matchedCount=1`、`modifiedCount=1`。

## 反馈结论

### 6a9bb69fca09da8ce04f3a8e

- 游戏 / 来源：基础设施自动反馈，`infra-cpu-watch`。
- 反馈原文：`[system][infra-cpu-watch] game-server CPU sustained high: average=109.36% highSamples=3/3 threshold=80% decision=restarted restarted=yes`
- 现实故障现象：生产游戏服务 CPU 连续 3 次采样高于 80%，平均 109.36%，监控已重启 `boardgame-game-server`。
- 直接触发条件：`logs/game-server-cpu-watch/20260905T062744Z-boardgame-game-server.txt` 记录 3 次采样分别为 131.84%、87.92%、108.31%。
- 止血 / 恢复动作：CPU watch 执行重启；随后 `restart-history.log` 在 `20260905T114835Z` 到 `20260905T123025Z` 的多次采样均为 `decision=ok`、`highSamples=0/3`，当前 `docker stats` 回查游戏服务 CPU 约 39.86%。
- 根本机制：生产日志在 2026-09-05 06:15:00Z 到 06:28:30Z 间，同一个已不存在的对局 `xuq57pWfFBp` 触发 4771 次“保存状态时房间已不存在”。CPU profile 同时显示热点集中在状态保存 `setState`、传输状态序列化 `serializeTransportState` 和存储清洗 `stripUndefinedForStorage`。源码层面，存储定时清理会删除 Mongo 房间，但运行层原先没有同步卸载仍在内存注册表里的活跃对局，后续 AI / 队列继续持有旧运行对象并反复保存状态。
- 本轮修复：`GameTransportServer` 新增“卸载存储已消失的活跃房间”入口；根服务在临时房间和 TTL 房间清理后调用该入口，并清理大厅、订阅、重开和聊天镜像。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server-lifecycle-sync.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：23 tests passed。
  - `npm run typecheck`：通过。

### 6a996d829f15a2294911238a

- 游戏：Dice Throne。
- 反馈原文：`太卡了`
- 原始对局：`sVJ2TR0PbjV`。
- 当前证据：生产 Mongo 回查该对局在 `matches / rooms / gameStates / matchStates` 均不存在，不能回放玩家原始现场；反馈未带截图、浏览器性能 trace、FPS、长任务、网络耗时或具体操作卡点。
- 当时服务器证据：2026-09-03 12:16Z 到 13:58Z 的 CPU watch 记录均未达到持续高 CPU 重启条件；反馈创建时间附近采样约 8% 至 13%，不能证明与 2026-09-05 的 CPU 告警同根。
- 当前状态：保留 `in_progress`。这条反馈需要性能专项复测或用户决定是否按“证据不足，无法回放原始现场”关闭；本轮不能把它写成已修复。

## 实际状态回写与最终回查

- `6a9bb69fca09da8ce04f3a8e`：北京时间 2026-09-05 20:41:31 已通过生产 Mongo SSH 写回 `resolved`，生产回读状态为 `resolved`，`resolvedMethod` 已写入面向反馈提交者的说明。
- `6a996d829f15a2294911238a`：生产回读状态仍为 `in_progress`，保留等待补证据或用户决定关闭。
- 最终线上回查：北京时间 2026-09-05 20:42:02，`open=0`，`in_progress=1`，剩余项只有 `6a996d829f15a2294911238a`。
- 本地镜像校验：`node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` 返回 `feedback-status: ok`。

## 追加批次：北京时间 2026-09-05 23:11:24

- 处理口径：线上真实反馈。
- 真实读取入口：`https://api.easyboardgame.top/admin-api/feedback`。
- 诊断批次：`temp/feedback-closeout/online-20260905-231120/summary.json`。
- 抓取结果：`open=0`，`in_progress=4`，共 4 条代表项；其中 3 条已通过生产 Mongo SSH 接手为 `in_progress`，战术优势反馈已在上一轮接手状态中。

### 6a9c10b8ca09da8ce04f47f5

- 反馈原文：`战术加的第一个标记，可以改对手的骰子。`
- 游戏 / 对象：Dice Throne，战术家“战术优势”第 1 个消耗效果。
- 规则合同：战术家提示板写的是“重掷 1 颗你的骰子”，不是改任意人的骰子；录入核对同步为“目标骰必须属于使用者”。
- 根本机制：旧实现只判断当前骰区存在可重掷骰，没有核对目标骰归属；因此战术家在防御骰、奖励骰、闪避骰等对手骰区里也能消耗战术优势重掷对手的骰子。
- 本轮修复：被动重掷新增“目标骰归属”裁决，战术优势默认只能选自己的骰子；命令验证、执行入口和 AI 候选枚举都使用同一裁决，防止绕过按钮或 AI 继续选到对手骰。
- 验证：`npx vitest run src/games/dicethrone/__tests__/passive-reroll-validation.test.ts src/games/dicethrone/__tests__/roll-context.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --reporter=dot`：3 files passed，250 tests passed。

### 6a9c1083ca09da8ce04f47e1

- 反馈原文：`王权骰铸 锁定 效果不能持续，攻击一次就消失了。`
- 游戏 / 对象：Dice Throne，共享状态“锁定 / Targeted”。
- 规则合同：月精灵提示板 `public/assets/i18n/zh-CN/dicethrone/images/moon_elf/tip.jpg` 的锁定说明为“即将受到的攻击伤害 +2”“持续”“攻击修正”，未写受到一次攻击后移除；规则总则 `src/games/dicethrone/rule/王权骰铸规则.md` 也说明状态获得后立即生效，永久/持续状态会留在场上直到被移除。
- 根本机制：旧状态定义把锁定配置成“触发后自动移除”；伤害结算在加上 2 点攻击伤害的同时生成移除状态事件，所以玩家看到锁定“攻击一次就消失”。
- 本轮修复：移除锁定的自动消费配置，保留“受到对手攻击伤害 +2”的伤害修正；中英文状态描述、旧 wiki 快照夹具、月精灵测试和战术家复用状态合同同步改为持续效果。
- 验证：`npx vitest run src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/moon-elf-abilities.test.ts src/games/dicethrone/__tests__/moon_elf-behavior.test.ts src/games/dicethrone/__tests__/targeted-defense-damage.test.ts --reporter=dot`：4 files passed，145 tests passed。

### 6a9c2a02ca09da8ce04f4cac

- 反馈原文：`[system][infra-cpu-watch] game-server CPU sustained high: average=99.65% highSamples=3/3 threshold=80% decision=restarted restarted=yes`
- 现实故障现象：生产游戏服务在 2026-09-05 22:39:38 附近连续 3 次 CPU 高于 80%，采样为 81.23%、97.61%、120.10%，监控执行了重启。
- 当前证据：生产文件 `/home/admin/BoardGame/logs/game-server-cpu-watch/20260905T143938Z-boardgame-game-server.txt`；容器日志在 14:30:27 到 14:30:45 期间持续刷“保存状态时房间已不存在”，房间为 `VxUydGxM4HP`。
- 根本机制：存储层已经清掉某个房间，但运行时仍保留该活跃对局，后续队列 / AI / 保存流程继续围绕已不存在房间反复执行并尝试保存，造成日志和状态序列化持续占用 CPU。
- 本轮修复：本地服务端已有“存储清理后卸载运行时活跃房间”的修复：清理临时房间和 TTL 房间后，会卸载已从存储消失的运行时对局，并同步清理大厅、订阅、重开与聊天镜像。
- 验证：`npx vitest run src/engine/transport/__tests__/server-lifecycle-sync.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --reporter=dot`：1 file passed，23 tests passed。
- 注意：当前验证证明代码修复成立；若要让生产不再复现同类 CPU 告警，还需要后续按正式发布链路部署这批改动。

### 6a996d829f15a2294911238a

- 反馈原文：`太卡了`
- 原始入口：`/play/dicethrone/match/sVJ2TR0PbjV?playerID=0`。
- 当前证据：诊断包含当时 Dice Throne 对局状态和操作记录，能看到战术优势曾在同一局中重投奖励骰；这部分规则风险已被 `6a9c10b8ca09da8ce04f47f5` 的战术优势修复覆盖。
- 不能关闭的原因：反馈原文本身只写“太卡了”，没有说明卡在页面渲染、网络同步、AI 等待、动画、按钮无响应还是性能掉帧；诊断包也没有 FPS、浏览器性能 trace、长任务、网络耗时或录屏。因此本轮不能证明“太卡了”的现实性能症状已被修复。
- 当前状态：保持 `in_progress`，等待性能专项复测、用户补充具体卡点，或用户明确决定按证据不足关闭。

### 附加验证记录

- 组合跑 `npx vitest run src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/moon-elf-abilities.test.ts src/games/dicethrone/__tests__/moon_elf-behavior.test.ts src/games/dicethrone/__tests__/targeted-defense-damage.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --reporter=dot` 时，前 4 个锁定相关文件通过，但 `zhanshujia-cursed-pirate-mechanics.test.ts` 中两条战争贩子防御响应窗口旧场景失败；失败点不在本轮两条玩家反馈的直接修复链上，未作为本轮反馈收口验证依据。

### 状态回写与最终回查

- `6a9c10b8ca09da8ce04f47f5`：北京时间 2026-09-05 23:35:08 已通过生产 Mongo SSH 写回 `resolved`，生产回读状态为 `resolved`。
- `6a9c1083ca09da8ce04f47e1`：北京时间 2026-09-05 23:35:27 已通过生产 Mongo SSH 写回 `resolved`，生产回读状态为 `resolved`。
- `6a9c2a02ca09da8ce04f4cac`：北京时间 2026-09-05 23:35:50 已通过生产 Mongo SSH 写回 `resolved`，生产回读状态为 `resolved`；回写说明已明确代码修复需要后续正式部署后在线上生效。
- 最终线上回查：北京时间 2026-09-05 23:36:17，`open=0`，`in_progress=1`，剩余项只有 `6a996d829f15a2294911238a`。
- 本地镜像校验：`node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` 返回 `feedback-status: ok`；本地镜像中 3 条为 `resolved`，`6a996d829f15a2294911238a` 保持 `in_progress`。

## 追加关闭：北京时间 2026-09-06 00:06:39

- 处理口径：线上真实反馈。
- 用户决定：反馈 `6a996d829f15a2294911238a` 原文只有 `太卡了`，本轮按用户明确决定关闭；这不是性能问题已修复的结论。
- 关闭说明：这条反馈内容是太卡了，没有留下具体卡在哪一步、性能数据、录屏或可回放现场；本轮已按用户决定关闭。后续如果再次遇到卡顿，请补充具体页面、操作步骤或性能截图，方便继续定位。
- 写回入口：`node .spec/skills/feedback-closeout/scripts/update-feedback-status.mjs 6a996d829f15a2294911238a closed ...`，通过生产 Mongo SSH 写回，`matchedCount=1`，`modifiedCount=1`。
- 写回修正：第一次关闭写回已成功，但关闭说明被命令行引号截短；随后同 ID 再次覆盖为上面的完整说明，生产回读状态为 `closed`。
- 最终线上回查：北京时间 2026-09-06 00:07:04，`open=0`，`in_progress=0`，诊断批次 `temp/feedback-closeout/online-20260906-final-recheck/summary.json`。
- 本地镜像校验：`node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` 返回 `feedback-status: ok`。
