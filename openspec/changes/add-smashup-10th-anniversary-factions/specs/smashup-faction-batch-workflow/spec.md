# smashup-faction-batch-workflow Specification (delta)

## ADDED Requirements

### Requirement: Smash Up 新派系批量任务必须采用 intake 与 implementation 两段式 workflow
系统 SHALL 将 Smash Up 新派系批量任务拆分为 `intake` 与 `implementation` 两个连续阶段，并明确前一阶段的输出物如何交接给后一阶段。

#### Scenario: 用户要求从一批新派系图片一路做到正式玩法实现
- **WHEN** 用户给出 Smash Up 新派系图片，并要求继续实施派系玩法
- **THEN** 系统 MUST 先完成来源合同、atlas 索引、静态数据与 intake 验证
- **AND** 系统 MUST 在 intake 收口后再进入玩法实现
- **AND** 系统 MUST 明确记录 handoff 包，而不是把“资源接入完成”误报成“派系完成”

### Requirement: Smash Up 派系批量任务必须复用通用 data-entry 入口
系统 SHALL 继续以 `.windsurf/skills/data-entry-workflow/SKILL.md` 作为 Smash Up 新派系任务的统一入口，而不是为每一批派系单独复制一套 skill。

#### Scenario: 处理 Smash Up 新派系图片包
- **WHEN** AI 接到 Smash Up 派系图片录入或派系新增任务
- **THEN** AI MUST 先走 `data-entry-workflow`
- **AND** AI MUST 根据任务范围显式分流到 Smash Up intake 文档或 implementation 文档
- **AND** AI MUST NOT 因为是 Smash Up 就额外新建一个重复职责的独立 skill

### Requirement: implementation 前必须存在可审计的 handoff 包
系统 SHALL 在进入 Smash Up 新派系 implementation 前，产出至少包含 faction 清单、atlas 索引、base 元信息、未决裁定项与复用风险说明的 handoff 包。

#### Scenario: intake 完成准备开始玩法实现
- **WHEN** intake 阶段已经完成
- **THEN** 系统 MUST 交付可复查的 handoff 文档
- **AND** handoff 文档 MUST 明确哪些事项已确认、哪些事项仍待裁定
- **AND** 若缺少 handoff 文档，则不得把 implementation 说成正式开工完成

### Requirement: implementation 阶段必须采用 Spec 分层拆解
系统 SHALL 在单派系 implementation 阶段采用分层拆解（配置复用层 / 机制扩展层 / UI+E2E 层），并按层收口后再推进下一层。

#### Scenario: AI 开始实现某一个具体派系
- **WHEN** AI 已进入该派系 implementation
- **THEN** AI MUST 先完成可配置复用的一批，再处理新机制或共享扩展的一批，最后完成新 UI 与对应 E2E 的一批
- **AND** 任何一批仍有未实现项时，AI MUST 维持未完成状态，不得误报该派系完成
- **AND** 若发现共享抽象缺口，AI MUST 直接做可复用扩展重构，而不是留下临时硬编码

### Requirement: 长期任务状态记录不得抢占已被其他任务占用的根 planning 文件
系统 SHALL 在根 `task_plan.md / findings.md / progress.md` 明显被其他任务占用时，使用替代的持久状态记录方式继续推进 Smash Up 批量任务。

#### Scenario: 仓库根 planning 文件已服务其他任务
- **WHEN** 当前 Smash Up 批量任务需要跨多轮持续推进
- **AND** 根 planning 文件明显正在服务别的未完成任务
- **THEN** 系统 MUST NOT 混写这些文件
- **AND** 系统 MUST 改用其他可恢复状态记录方式继续维护进度与 blocker
