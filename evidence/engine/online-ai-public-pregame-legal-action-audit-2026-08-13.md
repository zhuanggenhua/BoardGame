# 在线 AI 公开开局 legal-only 同类缺口专项扩审

## 1. 基本信息

- 对象：服务端权威在线 AI 的公开开局 legal-only 执行链
- 日期：2026-08-13
- 文档类型：`audit`
- 关联反馈：DiceThrone 本地反馈 `_id=6a7d71172b841ba4e6115296`，`matchId=4imWV8AwAgf`
- 本轮主目标：同类扩审 + 代表性修复验证

## 2. 范围锁定

| 项 | 本轮口径 |
| --- | --- |
| 问题对象 | 公开开局阶段中，真人是当前操作者，但 AI 座位仍有公开合法准备动作的服务端执行链 |
| 真相来源 | `src/games/*/game.ts` 的 `onlineAiRecovery` 配置、各游戏 AI legal actions、`src/engine/transport/server.ts` 服务端执行入口、定向回归测试 |
| 目标入口 / 环境 | 本地测试环境，服务端权威在线 AI；不涉及生产部署、不回写线上反馈状态 |
| 验收口径 | DiceThrone / SmashUp / SummonerWars / Betrayal 的公开开局代表链能由服务端执行 AI 合法动作；不能替真人执行；不把相邻但不同分支混称为已修 |

### 2.0 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前实现 | 是否阻塞完成口径 | 当前范围裁定 | 后续入口 |
| --- | --- | --- | --- | --- | --- |
| Betrayal `characterSelect` 缺少公开开局 legal-only 配置 | `功能实现阻塞` | 是 | 是 | 当前范围内，已修 | `src/games/betrayal/game.ts` + `src/engine/transport/__tests__/server.test.ts` |
| 公开开局判断强依赖 `hostStarted === false` | `功能实现阻塞` | 是 | 是 | 当前范围内，已修 | `src/engine/transport/onlineAiWatchdogGameSemantics.ts` |
| Betrayal 多 AI 开局每个 AI 需要多步确认，默认单片预算不够 | `功能实现阻塞` | 是 | 是 | 当前范围内，已修 | `src/engine/transport/server.ts` |
| The Gang `chip-selection` 同步公开筹码选择 | `非阻塞扩展` | 否，本轮同根因不命中 | 否，已裁定范围外 | 相邻风险，不在本轮 legal-only 分支 | 后续 The Gang 专项设计 / 回归 |

## 3. 结论等级

- 结论等级：`仍有残余范围`
- 判定理由：本轮已经覆盖并修复“公开开局 + 真人当前操作者 + AI legal-only 准备动作”这个同类根因家族中的 Betrayal 缺口，同时复验 DiceThrone、SmashUp、SummonerWars 代表链；The Gang `chip-selection` 是相邻同步公开选择机制，但不走本轮同一条 legal-only 分支，不能混称为已解决。

## 4. 根因分层

| 层级 | 结论 |
| --- | --- |
| 现实故障现象 | 公开开局阶段，真人完成选择后，AI 座位仍停在未选择 / 未确认状态，导致对局无法进入下一阶段。DiceThrone 反馈中表现为真人选了 `tianshi`，AI seat `1` 仍是 `unselected`。 |
| 直接触发条件 | 服务端看到当前操作者是真人时，公开开局 AI legal-only 探测只覆盖既有硬编码阶段，未覆盖新增/不同阶段语义。 |
| 恢复动作为什么执行 | 服务端权威 AI 必须在人类命令成功或同步进房后，从当前权威状态重新生成 AI 合法动作并执行；这不是客户端强制跳过，也不是旧 AI seat 浏览器继续代发命令。 |
| 根本机制 / 缺陷 | 在线 AI 权威迁到服务端后，公开开局阶段语义仍残留在公共层硬编码中：原判断依赖 `hostStarted=false` 和固定阶段名，导致没有 `hostStarted` 字段或使用其它公开开局阶段名的游戏被漏掉；Betrayal 还需要多 AI、多步准备确认，原即时执行预算不足以覆盖。 |

## 5. 消费者矩阵与逐项结论

| 游戏 / 模块 | 公开开局阶段 | AI 合法动作面 | 实现入口 | 证据层级 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| DiceThrone | `setup` | 选择角色、准备确认 | `onlineAiRecovery.publicPregameLegalActionPhases: ['setup']`；服务端即时执行入口 | L2 服务端行为 + L3 既有真实入口 E2E | 当前代表链通过 |
| SmashUp | `factionSelect` | 选择阵营 | 既有 `publicPregameLegalActionPhases: ['factionSelect']` | L2 服务端行为 | 当前代表链通过 |
| SummonerWars | `factionSelect` / `summon` | 选择阵营 / 召唤前公开准备 | 既有 `publicPregameLegalActionPhases: ['factionSelect', 'summon']` | L2 服务端行为 | 当前代表链通过 |
| Betrayal | `characterSelect` | `SELECT_EXPLORER`、`CONFIRM_EXPLORER`、`CONFIRM_SCENARIO_CARD` | 新增 `publicPregameLegalActionPhases: ['characterSelect']`；公开开局判断不再要求 `hostStarted=false`；即时执行预算按 AI 座位数扩展 | L2 服务端行为 | 本轮修复并验证 |
| The Gang | `chip-selection` | 同步公开筹码选择 | 当前没有走本轮 `human current + public pregame legal-only` 同一分支 | L1 结构识别 | 相邻风险，范围外残余 |
| Cardia / FantasyRealms / Qidahen / Splendor / TicTacToe | 未命中本轮公开开局选择 + human current + legal-only 条件 | N/A | N/A | L1 结构筛查 | 当前未命中同类缺口 |

## 6. 已改动的关键点

| 文件 | 改动 | 现实作用 |
| --- | --- | --- |
| `src/engine/transport/onlineAiWatchdogGameSemantics.ts` | `isOnlineAiWatchdogPublicPregameLegalActionPhase()` 改为必须显式配置公开阶段，且只在 `hostStarted === true` 时拒绝 | 支持没有 `hostStarted=false` 字段但明确配置了公开开局阶段的游戏，同时防止游戏开始后误走开局恢复 |
| `src/games/betrayal/game.ts` | 为 Betrayal 增加 `publicPregameLegalActionPhases: ['characterSelect']` | 让 Betrayal 角色选择阶段进入公开开局 AI legal-only 探测 |
| `src/engine/transport/server.ts` | 真人命令成功和同步进房后触发服务端 AI 即时执行；公开开局预算按 AI 座位数扩展 | 多 AI 准备选择不依赖浏览器 AI seat socket，也不等 watchdog 轮询；Betrayal 两个 AI 均可连续完成选择和确认 |
| `src/engine/transport/__tests__/server.test.ts` | 增加 Betrayal 单 AI watchdog、多 AI 即时执行，以及 DiceThrone/SummonerWars/SmashUp 代表回归 | 防止同类阶段漏配、预算不足、服务端不继续执行回归 |

## 7. 验证证据

### L1 结构证据

- 命令：`rg "publicPregameLegalActionPhases|onlineAiRecovery|characterSelect|chip-selection" src/games -n`
- 结果：命中 DiceThrone `setup`、SmashUp `factionSelect`、SummonerWars `factionSelect/summon`、Betrayal `characterSelect`；The Gang `chip-selection` 被识别为相邻风险但不走本轮同一分支。
- 结论：本轮对象全集限定在“公开开局 + human current + AI legal-only”语义家族；The Gang 不并入本轮修复。

### L2 领域行为证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "Betrayal characterSelect|Betrayal 在线普通 AI|DiceThrone 普通 setup 阶段应代普通 AI 选择角色|DiceThrone 在线普通 AI 应在人类选角命令成功后立即由服务端继续选角|DiceThrone 在线普通 AI 应在人类同步进房后继续既有 setup 卡点|factionSelect 阶段应走 legal-action recovery|summonerwars 公开选阵营阶段也应代 AI 执行 legal action"`
- 结果：1 file passed，7 tests passed。
- 结论：DiceThrone、SmashUp、SummonerWars、Betrayal 的公开开局代表链均能由服务端执行 AI 合法动作。

- 命令：`npm run test:ai:decision-view`
- 结果：4 files passed，449 tests passed。输出包含测试环境预期的 `INTERNAL_FEEDBACK_TOKEN 未配置`、`socket hang up / ECONNRESET` 噪声，Vitest 最终通过。
- 结论：在线 AI 决策视图、响应窗口、座位校验等共享回归未被本轮改动破坏。

- 命令：`npm run typecheck`
- 结果：通过。

- 命令：`npx eslint src/engine/transport/server.ts src/engine/transport/onlineAiWatchdogGameSemantics.ts src/engine/transport/__tests__/server.test.ts src/games/betrayal/game.ts src/games/dicethrone/game.ts`
- 结果：通过；仅出现 Babel 对大文件的样式降级提示。

- 命令：`git diff --check -- src/engine/transport/server.ts src/engine/transport/onlineAiWatchdogGameSemantics.ts src/engine/transport/__tests__/server.test.ts src/games/betrayal/game.ts src/games/dicethrone/game.ts`
- 结果：通过；仅出现 Git 的 LF/CRLF 提示。

### L3 真实玩法证据

- DiceThrone 真实入口 E2E 已在对应反馈 evidence 中记录：`evidence/dicethrone/dicethrone-feedback-6a7d711-setup-ai-character-recovery-2026-08-13.md`。
- 本轮新增的 Betrayal 证据为服务端行为回归；未声明 Betrayal 真实 UI 入口已完整验收。

### L4 治理证据

- 共享根因：服务端权威 AI 迁移后，公开开局阶段语义仍在公共层硬编码，未完全下放为游戏显式配置。
- 同类扩审记录：已按 `publicPregameLegalActionPhases`、AI legal actions、公开开局阶段名、是否 `human current + legal-only` 命中条件筛查。
- 残余范围：The Gang `chip-selection` 是同步公开筹码选择的相邻机制，需要独立方案和回归；当前不能宣称所有同步公开选择机制都已覆盖。

## 8. 禁止假阳性检查

- 没有把 watchdog 降噪、跳过或限流说成修复；本轮验证的是服务端执行 AI 合法动作后的权威状态变化。
- 没有把“测试通过”外推为全仓所有 AI 机制无问题；范围限定为公开开局 legal-only 同类根因家族。
- 没有把 The Gang 相邻风险混称为本轮已修。
- 没有把浏览器 AI seat 的旧命令继续发送当作商业项目最佳实践；正式执行权仍在服务端。

## 9. 对外汇报口径

- 允许说：这次修复并验证了公开开局 legal-only 同类缺口中的 Betrayal 漏配，并复验 DiceThrone、SmashUp、SummonerWars 代表链。
- 允许说：Betrayal 多 AI 不是强制跳过，而是服务端在人类命令成功后，按当前权威状态连续执行 AI 自己的合法动作。
- 必须保留：The Gang `chip-selection` 是相邻风险，需要后续专项，不能说所有同步公开选择机制都已经覆盖。
- 禁止说：全仓 AI 卡死问题都已解决；所有游戏开局同步机制都已无风险；本轮已经覆盖所有风险。
