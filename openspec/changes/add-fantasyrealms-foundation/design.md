## Context
`fantasyrealms` 当前不是单纯“新增一个 gameId”的 intake 问题，而是已经进入具体的桌面布局、玩家关注点排序和后续实现阶段划分。用户已经明确否定了此前泛化卡牌模板的几个问题：Board 首屏不该有大标题，不该重复壳层状态，不该用大面积终局计分纸抢主位。与此同时，当前仓库也已经不再只是“只有 Board 原型”的阶段，后续 card catalog / scoring / gameplay / runtime-entry change 都已存在并落地，因此 foundation 这条 change 必须回到自己的职责边界：负责 UI 基础层与完成口径，而不是继续笼统代指整个新游戏。

当前问题的核心不是“实现范围要尽量小”，而是“流程必须完整、阶段必须明确”。因此这里的策略是：用 foundation change 明确冻结当前真实边界，而不是用“最小提案”弱化 proposal/design/tasks/spec 的完整性。

## Goals / Non-Goals
- Goals:
  - 为 `fantasyrealms` 建立正式的 OpenSpec 入口，覆盖当前这次新游戏的设计方案、任务拆分和验收边界。
  - 固化单一“实体牌桌”方向，明确牌桌主次关系与 7+7 卡位不变量。
  - 允许当前探索性实现被保留，但必须纳入 proposal 约束下继续收敛。
  - 明确 foundation 与后续 gameplay / scoring / runtime-entry change 的职责边界，避免用 foundation 继续笼统覆盖整个新游戏完成态。
  - 把“真实页面端到端通过，且无阻塞级 UI bug”写成 foundation 完成门禁。
- Non-Goals:
  - 本 proposal 阶段不直接定义完整的 `fantasyrealms` 领域规则、命令系统与结算引擎。
  - 不再生成多套不同风格方向稿，不恢复“标题页 + 大状态条 + 中央大计分板”的旧路线。
  - 不把与真实游戏无关的背景全景图硬接成正式桌面资源。
  - 不把非阻塞的后续 polish 混写成“foundation 仍未完成”的根因。

## Decisions
- 采用“新游戏 foundation”分阶段设计，而不是把当前工作伪装成一次性完整接入：
  - Phase 1：来源与范围锁定
  - Phase 2：实体牌桌 Board foundation
  - Phase 3：后续 runtime 接入预留
- Board 主视口优先级固定为：
  - 第一视觉：公共牌与手牌
  - 第二视觉：当前能做什么 / 当前焦点卡
  - 第三级：分数摘要与终局进度
- Foundation 不再把“固定 7 张公共牌”当作当前真实玩法合同；公共区的 UI 语义必须跟随后续 gameplay change 的正式对象（当前是公开弃牌堆）。
- 当当前玩法以 7 张手牌为核心时，手牌区仍必须保持 7 张完整可读；响应式压缩可以改变承载方式，但不能改变手牌完整可见性要求。
- 当前探索实现继续沿用单一奇幻实体牌桌语法：
  - 木桌/皮垫/铜钉/旧纸标签
  - 牌是最亮对象
  - 工具与说明让位给牌
- foundation 完成门禁固定为：
  - 真实页面主路径与关键状态已经端到端复核
  - 已知阻塞级 UI bug 已清零
  - 剩余项若只是后续 polish，必须显式降级为非阻塞 follow-up
- runtime 接入边界改为：
  - foundation 只负责说明“后续 change 接管 gameplay / scoring / runtime-entry”
  - 不再用旧的 `manifest.enabled: false` 作为当前总完成口径

## Alternatives Considered
- 继续把 `fantasyrealms` 当成“先做个静态页再说”的无 spec 探索任务：
  - 拒绝。已经进入具体设计与拆任务阶段，缺少 proposal 会继续导致范围混乱。
- 把新游戏 skill 与 OpenSpec 写成二选一：
  - 拒绝。新游戏 skill 负责通用流程，OpenSpec 负责当前这次具体设计和任务拆分。
- 恢复多风格并行试验：
  - 拒绝。用户已经明确要求停止多风格分散，收敛到单一实体牌桌方向。

## Risks / Trade-offs
- 当前仓库里已经存在探索性实现，如果 proposal 与现有文件事实不一致，后续会继续混乱；因此 tasks 第一阶段必须先做对齐审计。
- 若过早把 `fantasyrealms` 注册进运行时链路，而领域层仍缺失，会制造“大厅可见但不可玩”的伪完成态。
- 如果不把“公共区语义跟随真实玩法、手牌区保持 7 张完整可读”写进规范，后续很容易再次回退到旧静态稿或通用卡牌模板。
- 如果不把“阻塞级 UI bug 仍属当前任务范围”写成门禁，后续会继续出现“tasks 勾满但真实 UI 仍未过验收”的假完成态。

## Migration Plan
1. 用本 change 正式接管当前 `fantasyrealms` 探索产物。
2. 先审计设计文档、Board 原型与 evidence 是否满足 proposal/spec。
3. 由后续 gameplay / scoring / runtime-entry change 接管运行时能力与入口口径；foundation 只保留视觉和验收基础层。
4. 对真实页面执行 completion audit：把阻塞级 UI bug 与非阻塞 polish 分开记录，前者必须修完，后者才能降级处理。

## Open Questions
- 当前 foundation evidence 覆盖哪些关键真实页面状态才足以支撑“UI 已端到端通过”的口径？
