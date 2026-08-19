# Change: 重构阻塞交互为 Choice Request 接口

## Why

当前阻塞交互存在三套事实来源：UI 载体知道人类能点什么，游戏或 AI 适配器另行拼 AI 能做什么，线上 watchdog 再在超时后猜测如何恢复。这会导致 UI 形态或业务交互稍变，AI 没有对应动作就进入等待；watchdog 只能强制结束或跳过，不能替代真实选择逻辑。

平台要支持更多新游戏与长期 AI 自动玩家，阻塞选择必须先被建模为 `Choice Request`（选择请求），再投影给人类 UI、AI 策略、服务端校验和恢复诊断。这样“人类可选、AI 也可选；AI 不能选时必须报错”成为框架接口合同，而不是每个业务组件临时补。

## What Changes

- **BREAKING**：新游戏和本 change 迁移批次中的阻塞业务决策不得再以裸 `createSimpleChoice` 作为主入口；必须先创建 `Choice Request`，再由 UI 载体适配显示。
- 新增 Choice Request 接口：每个阻塞选择请求声明行动座位、选择类型、候选项、选择数量/顺序、可见性、跳过/确认策略、所属 resolution frame、命令映射和诊断信息。
- 统一合法动作生成：UI 可点击候选、AI `legalActions`、服务端校验摘要和 recovery 诊断都从同一份 `Choice Request` 或其同源投影产生。
- AI 策略门禁前移：每个 AI 可控 `ChoiceKind` 必须有策略或明确 unsupported 声明；缺策略、无候选且不可跳过、候选映射失败都必须 fail-close 并上报，不能静默返回空动作。
- UI 载体降级为 adapter：simple-choice 弹窗、场地直选、骰子确认栏、手牌高亮、棋盘格高亮等只负责展示与采集，不拥有候选真相、权限真相或 AI 策略。
- 迁移优先级先覆盖框架本身、用 simple-choice 少且仍在实施中的新游戏：Betrayal（小黑屋后续交互批次）、Mage Wars、Qidahen，以及后续新游戏默认 Choice Request 优先；DiceThrone / 王权骰铸只纳入低风险通用 `CHOICE_REQUESTED` 桥迁移，不扩大为全量 DiceThrone 重构。
- Cardia、TicTacToe 按旧项目兼容边界处理，本 change 不把它们列入首批直接迁移。
- Smash Up 与 Summoner Wars 存量不全量爆破；每次选一个交互家族直接迁到 Choice Request 入口，旧 simple-choice 只保留为薄 legacy adapter，不承载新规则或第二套恢复逻辑。
- 文档收口为一个交互接口总入口：simple-choice 只作为 legacy surface/adapter 附录或索引条目，不再作为和主框架平级的独立设计范式；普通 UI 组件不建立一组件一大文档，只有承担非显而易见接口合同的组件才单独成文。

## Impact

- Affected specs: `interaction-system`, `game-ai-system`, `online-ai-recovery`
- Related specs/changes: `systems-layer`, `online-ai-decision-view`, `mage-wars`, `refactor-ai-decision-semantics`, `refactor-online-ai-server-authority`, `refactor-betrayal-core-interactions`, `refactor-qidahen-decision-flow-and-mobile-hud`
- Affected code: `src/engine/systems/InteractionSystem.ts`, `src/engine/ai/decisionSemantics.ts`, `src/engine/ai/context.ts`, `src/engine/ai/localRunner.ts`, `src/engine/transport/server.ts`, `src/engine/transport/onlineAiRecovery.ts`, first-batch game interaction builders under `src/games/{betrayal,mage-wars,qidahen}/`, and the DiceThrone generic choice event bridge in `src/games/dicethrone/domain/systems.ts`
- Compatibility: existing Smash Up, Summoner Wars, Cardia, and TicTacToe simple-choice flows remain available through legacy adapter until each approved interaction family is migrated; they must not be used as new-game examples
- Approval gate: this proposal only defines the refactor plan. No implementation starts until the change is reviewed and approved.
