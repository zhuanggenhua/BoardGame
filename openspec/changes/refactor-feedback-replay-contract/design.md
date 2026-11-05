## Context

现有反馈模型以多个可选字符串字段承载诊断信息。客户端通常只能在上报瞬间拿到一个当前状态，服务端 watchdog 也分别构造 stateSnapshot 与 actionLog。这些字段没有统一的采集合同，导致：

- 同一反馈缺少稳定的 captureId / chainId；
- roomId / requestId / stateId / decisionEpoch 经常缺失或只存在内部日志；
- 只有当前状态，没有明确的 before / at / after；
- 无法区分“状态注入成功”“运行时真实消费”“原始故障可回放”；
- 管理端无法快速判断这条反馈是否值得继续定位。

## Goals / Non-Goals

### Goals

- 把反馈现场包变成结构化、版本化、可关联的唯一诊断合同。
- 让人工反馈、客户端自动反馈和服务端自动反馈使用同一套字段语义。
- 明确记录现场是否可回放以及缺失什么。
- 让管理端和收口 workflow 能据此阻止越权结论。

### Non-Goals

- 不改变游戏规则、UI 文案或 AI 决策策略。
- 不把所有历史反馈强行补成完整现场。
- 不要求首轮就实现跨版本自动重放服务；首轮先保证现场采集和完整性可判定。

## Decisions

### Decision 1：统一现场包而不是继续扩展散落字符串

新增 diagnosticPacket 作为唯一现场诊断真相。旧 stateSnapshot、actionLog、clientContext 保留用于兼容，但写入新反馈时必须同时生成现场包。

### Decision 2：关联键分层且不可推测

现场包区分：

- captureId：一次采集唯一标识；
- chainId：同一故障链的前 / 中 / 后关联；
- matchId / roomId：对局或房间；
- requestId：命令 / 交互 / 请求；
- stateId / stateRevision / decisionEpoch：状态时点。

缺失字段必须进入 missingFields，不能用 incidentKey 或字符串内容猜测。

### Decision 3：回放能力显式分级

- full：具备原始时点状态、关联键、版本和时序材料，可直接进入回放；
- partial：能消费状态或重建语义场景，但缺少原始时点或关键关联；
- unreplayable：缺少足够状态或入口，只能保留事实和继续采集。

### Decision 4：前后状态按能力采集

采集器优先保存 before / at / after。只能拿到 at 时不伪造其它阶段，字段保持缺失并降级回放能力。

### Decision 5：状态注入不等于复现

任何由诊断包导入的测试都必须在运行时读取 phase / interaction / responseWindow / target object / action log / event stream，并在证据中区分：

- 注入成功；
- 运行时消费成功；
- 原始故障复现成功。

### Decision 6：收口状态仍与诊断完整性分离

resolved / closed 继续由反馈收口 workflow 管理。现场包完整不自动代表修复完成；现场包不完整也不能被写成根因已修复。

## Risks / Trade-offs

- 现场包增大存储量 → 采用尾部限制、字段上限和脱敏，不存无界日志。
- 历史数据缺字段 → 保留旧字段，回填脚本只补可证明内容并写 missingFields。
- 客户端与服务端版本不同 → 使用 schemaVersion 与独立 build 信息，避免覆盖。
- 采集失败影响反馈提交 → 反馈主提交仍可成功，现场包标记 collectionStatus: partial 并记录失败原因。

## Migration Plan

1. 先落 schema / DTO / 共享类型和完整性计算。
2. 让客户端与服务端新反馈同时写 diagnosticPacket。
3. 管理端展示现场包完整性和关联键。
4. 为历史记录生成只读回填报告，不覆盖原始字段；命令为 `npm run feedback:diagnostic-gaps`。
5. 现场包导入统一经过 `assertFeedbackDiagnosticPacketConsumed`，由运行时状态证明注入已被消费。
6. 执行三类真实 E2E：人工反馈、客户端自动反馈、在线 AI/watchdog；每类都要有同一 `chainId` 的前态、中态、后态截图和中文描述。
7. 通过规范、类型、单测和反馈 API E2E 后再切换收口 workflow 为硬门槛。

## Open Questions

- 是否需要将完整现场包异步落对象存储，以降低 Mongo 文档大小？
- 线上生产环境是否允许保存随机种子与完整私有视图，需按隐私策略确认。
