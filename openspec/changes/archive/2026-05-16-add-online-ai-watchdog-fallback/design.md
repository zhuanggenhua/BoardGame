## Context
- 现有在线房间 AI 主链路是“房主客户端托管 + 每个 AI seat 独立 `claim-seat` + 后台 `GameTransportClient` 提交命令”。这条链路能复用 playerView 和 socket 鉴权，但也引入两个天然短板：一是房主页面失活时权威侧没有任何 AI 恢复者；二是普通 AI 重试链与客户端 watchdog 同时竞争同一 AI seat 时，容易在恢复批次落地前后出现 `command_failed / not_connected / disconnected`。
- 当前 `OnlineAiSeatBridge` 的 `8 秒强制结束` 只是客户端 watchdog。它已经通过单测与 E2E 证明“不会误伤真人玩家”，但仍会在真实网络/凭据/并发竞态下弹出“强制结束失败”的提示。用户现在要的是：即使前端桥不工作，服务端也要能把 AI 卡死收口，并自动把 incident 反馈出来。
- 现有 `POST /feedback` 接口允许匿名写入，支持 `content`、`actionLog`、`stateSnapshot`、`clientContext`、`errorContext`。这意味着 game-server 可以用最小耦合方式 best-effort 报告 watchdog incident，而无需引入新的后台管理链路。

## Goals / Non-Goals
- Goals:
  - 让在线 AI 卡死恢复拥有服务端权威兜底，不再依赖房主页面存活。
  - 保持“不会误伤真人玩家”的安全边界。
  - 自动生成可审计的反馈记录，帮助后续定位剩余 AI 卡死根因。
  - 将恢复动作做成共享纯函数规则，让服务端与前端 fallback 读同一套判定语义。
- Non-Goals:
  - 不把整套在线 AI 正常决策主链完全迁移为服务端常驻 AI。
  - 不在本轮新增复杂告警平台或第三方监控；只复用现有 feedback API + 服务器日志。
  - 不承诺一次性消灭所有 AI 策略/合法动作缺陷；本轮目标是“卡死可收口、失败可上报、用户不再被失败 toast 反复轰炸”。

## Decisions

### Decision: 新增服务端权威 watchdog，按 incident key 在 `GameTransportServer` 内部恢复 AI 卡死
- 服务端维护 `onlineAiRecovery` 运行态：按 match/seat/incident key 记录首次发现时间、最近进度 marker、最近失败原因、是否已上报反馈。
- 周期性扫描活跃房间：只要当前卡住的对象属于 AI seat，且进度 marker 超过阈值未变化，就在服务端内部执行恢复，不经过 socket 凭据链。
- Why:
  - `GameTransportServer` 已持有权威状态、命令执行锁和 `executeCommandInternal` 能力，是唯一能在房主页面失活时仍做出确定性恢复的位置。
  - 服务端内部恢复可以绕过 `claim-seat` 凭据失效与 `not_connected/disconnected` 类假失败。

### Decision: 保持“两段式恢复”——先解阻塞，再基于最新权威状态多步推进直到安全收口
- 若是 AI 私有交互/response window 卡住，第一段只做 `RESPOND/CANCEL/PASS` 之类的最小恢复动作。
- 第一段成功后重新读取权威状态；只有在“仍是该 AI 的回合 + 没有新交互 + 没有新 response window”时，才进入第二段 `ADVANCE_PHASE`。
- 第二段不是只跳一次 phase，而是按最新权威状态循环执行 `ADVANCE_PHASE`，直到切回真人 / 出现新阻塞 / 命中安全步数上限。
- Why:
  - 用户新反馈的 DiceThrone 卡死证明“只跳一个阶段”并不等于“真正结束 AI 回合”；多阶段回合必须在权威侧收口到安全边界。
  - 继续保持“每一步都重新读取权威状态”的策略，仍可维持“不误推进真人回合”的性质。

### Decision: 共享恢复判定逻辑，不再让前端和服务端各写一套强制结束语义
- 将 `resolveForceSkippableHiddenAiInteraction / resolveForceEndTurnForStalledAi / resolveForceAdvancePhaseAfterRecovery` 这类纯判定逻辑抽到共享模块，前端和服务端共用。
- 服务端版本输出“内部命令计划”，前端版本仍可在必要时转成 `sendBatch`。
- Why:
  - 避免前后端对“什么叫 AI 卡死”“何时可安全推进阶段”形成双份规则，减少之后继续分叉导致的审计困难。

### Decision: 自动反馈采用 best-effort、去重、低耦合写入 `/feedback`
- 触发条件：
  1. 服务端 watchdog 成功执行 `force-end-turn` 或同等级别的强制恢复；
  2. 同一 incident 连续恢复失败达到阈值；
  3. 发生用户可见失败 toast 对应的服务端 reject reason，且本 incident 还未报告。
- 内容包含：`gameId`、`matchId`、`playerId`、incident kind、失败/恢复 reason、权威进度 marker、精简 `stateSnapshot`、必要时附 `actionLog` 摘要。
- 去重键建议为 `matchId + playerId + turn + phase + incidentKind + progressMarker`，并加时间冷却，防止一个卡点连发多条。
- Why:
  - 现有反馈后台已经能收结构化上下文；best-effort HTTP 提交实现成本最低，也最容易被研发同学直接看到。

### Decision: 前端桥接层降级为次级 fallback + 用户提示层
- `OnlineAiSeatBridge` 仍保留：
  - 继续承担当前已存在的前端 fallback（用于服务端 watchdog 尚未覆盖的窗口）。
  - 继续给用户展示“AI 被自动跳过/强制结束”的成功提示。
- 但一旦发现服务端已经接管同一 incident，前端必须停止重复提交与重复失败提示；对于 `command_failed` 这类更可能是“服务端已推进状态”的情况，要先重新同步权威状态，再决定是否提示。
- Why:
  - 这样可以平滑迁移，避免一口气删除现有桥接层带来覆盖倒退，同时显著降低“失败 toast 噪音”。

## Risks / Trade-offs
- 服务端 watchdog 如果判定条件写错，会比客户端 fallback 更危险。
  - Mitigation: 继续沿用现有人类门禁与 follow-up 二次确认，并补单测覆盖“human active turn / human responder / 切回人类后不得继续 ADVANCE_PHASE”。
- 自动反馈若不做去重，可能在同一 match 上产生噪音数据。
  - Mitigation: 服务器内存去重 + incident 冷却 + 只在达到关键阈值时报告。
- 服务端定时扫描如果实现粗糙，可能带来额外性能抖动。
  - Mitigation: 使用低频 tick（例如 500ms 或 1000ms），且只在存在 AI seat 的活跃房间上检查固定字段，不做重型深比较。

## Migration Plan
1. 抽出共享 AI recovery 判定模块，保留前端现状不变。
2. 在 `GameTransportServer` 接入 watchdog 运行态、扫描循环与内部恢复执行。
3. 增加 best-effort 自动反馈上报器与 incident 去重。
4. 让 `MatchRoom` 在服务端接管时降噪，并补失败 reason 精准提示。
5. 通过 Vitest + 在线房间 E2E 验证“服务端接管成功”“人类不受伤害”“失败 incident 自动入反馈”。

## Open Questions
- 自动反馈是否需要固定落一个 `contactInfo=system:online-ai-watchdog` 便于后台筛选？本提案默认：需要。
- 成功恢复是否也要生成反馈，还是只报失败/重试超阈值？本提案默认：成功 `force-end-turn` 也报，但 severity 低于失败 incident。
