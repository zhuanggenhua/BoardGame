## ADDED Requirements

### Requirement: 统一 AI 决策上下文
系统 SHALL 为所有 AI 运行时提供统一的结构化决策上下文，而不是按不同游戏、不同模型类型分别设计输入协议。

#### Scenario: 本地 AI 与远程 AI 共用同一上下文
- **GIVEN** 某个座位被配置为 `local-ai` 或 `remote-ai`
- **WHEN** 该座位进入可决策状态
- **THEN** 系统 MUST 生成同一种 `AiDecisionContext`
- **AND** 上下文 MUST 至少包含 `gameId`、`matchId`、`playerId`、可见状态、交互上下文、响应窗口、`legalActions`、规则版本与时间预算

#### Scenario: AI 只能看到该座位可见的信息
- **GIVEN** 某个游戏存在隐藏信息
- **WHEN** 系统为 AI 生成 `AiDecisionContext`
- **THEN** 系统 MUST 仅提供经过 `playerView` 过滤后的可见状态
- **AND** 不得把对手手牌、牌堆顺序或其他隐藏信息直接暴露给 AI

### Requirement: AI 座位控制器
系统 SHALL 以 seat controller 的方式统一管理人类玩家、本地 AI 和远程 AI。

#### Scenario: 本地 AI 座位自动接管回合
- **GIVEN** 某个座位配置为 `local-ai`
- **WHEN** 轮到该座位操作或响应
- **THEN** 系统 MUST 自动触发本地 policy 求解
- **AND** 求解结果 MUST 仍通过现有命令执行链提交

#### Scenario: 远程 AI 座位通过 provider 决策
- **GIVEN** 某个座位配置为 `remote-ai`
- **WHEN** 轮到该座位操作或响应
- **THEN** 系统 MUST 调用已注册的 `RemoteAiProvider`
- **AND** provider 的输入输出 MUST 复用统一 AI 决策契约

### Requirement: AI 决策合法性门控
系统 SHALL 先提供结构化 `legalActions`，并要求所有 AI 决策都在合法动作范围内完成。

#### Scenario: AI 选择合法动作
- **GIVEN** `AiDecisionContext.legalActions` 已生成
- **WHEN** AI 返回某个动作引用
- **THEN** 系统 MUST 能将其映射到某个合法动作
- **AND** 该动作 MUST 再经过现有 validate / execute / reduce / systems 链执行

#### Scenario: AI 返回非法动作
- **GIVEN** AI 返回了不在 `legalActions` 中的动作
- **WHEN** 系统准备执行该动作
- **THEN** 系统 MUST 拒绝执行
- **AND** 系统 MUST 记录该次失败
- **AND** 系统 MUST 进入明确的 fallback 策略，而不是让对局卡死

### Requirement: 结构化训练样本采集
系统 SHALL 以与业务日志分离的结构化样本格式采集对局决策数据，供后续分析、训练和评估复用。

#### Scenario: 成功决策写入训练样本
- **GIVEN** 某次真人或 AI 的命令执行成功
- **WHEN** 命令完成状态落盘并更新对局
- **THEN** 系统 MUST 记录一条结构化训练样本
- **AND** 样本 MUST 包含规则版本、命令、决策前后状态、交互上下文、响应窗口和 `legalActions`

#### Scenario: 训练样本按 schema 版本隔离到 raw 目录
- **GIVEN** recorder 接收到某个 `schemaVersion` 的训练样本
- **WHEN** 系统准备把样本写入本地文件存储
- **THEN** 系统 MUST 把样本写入按 `raw/v{schemaVersion}/{gameId}/{day}.jsonl` 分层的目录
- **AND** 不得把不同 schema 版本的样本混写到同一个日志文件

#### Scenario: 过期 raw 样本归档到 archive 目录
- **GIVEN** 本地训练数据采集启用了保留天数策略
- **WHEN** recorder 在新的一天执行样本写入或归档检查
- **THEN** 系统 MUST 将超过保留窗口的 raw 日志移动到对应的 `archive/v{schemaVersion}/{gameId}/` 目录
- **AND** 同一天内仍在保留窗口内的 raw 日志 MUST 继续保留在 raw 目录

#### Scenario: 训练采集失败不影响对局
- **GIVEN** recorder、文件系统或外部存储发生异常
- **WHEN** 系统尝试写入训练样本
- **THEN** 系统 MUST 记录错误或告警
- **AND** 不得回滚或阻塞该次真实对局命令

### Requirement: 桌游优先的本地策略框架
系统 SHALL 为本地逻辑 AI 提供围绕 `legalActions` 的通用评分式策略框架，并允许游戏在同一动作集合上叠加搜索，而不是把行为树作为默认总方案。

#### Scenario: 本地策略对合法动作逐个评分
- **GIVEN** 某个游戏声明支持 `local-ai`
- **WHEN** 本地 policy 接收到 `AiDecisionContext`
- **THEN** policy MUST 能基于 `legalActions` 对多个动作逐个评分
- **AND** 系统 MUST 选择总分最高的动作作为默认决策结果

#### Scenario: 同分动作保持稳定选择
- **GIVEN** 两个或多个合法动作得到相同总分
- **WHEN** 系统在评分结果中选择最终动作
- **THEN** 系统 MUST 使用稳定的 tie-break 规则
- **AND** 相同上下文下的同一 policy MUST 产生可复现的结果

#### Scenario: 搜索建立在相同动作边界上
- **GIVEN** 某个游戏后续需要使用浅层搜索或 MCTS 增强本地策略
- **WHEN** 游戏在评分框架上叠加搜索逻辑
- **THEN** 搜索 MUST 仍以当前 `legalActions` 为根动作集合
- **AND** 不得绕开统一决策契约另起一套搜索专用执行接口

### Requirement: 本地 AI 策略插件
系统 SHALL 支持每个游戏按统一接口注册本地 AI 策略，而不要求必须先有训练模型。

#### Scenario: 无训练模型时使用启发式或搜索策略
- **GIVEN** 某个游戏已经声明支持 `local-ai`
- **AND** 该游戏尚未提供训练模型
- **WHEN** 本地 AI 需要做决策
- **THEN** 系统 MUST 允许该游戏使用启发式、评分、脚本或搜索策略实现 `LocalAiPolicy`

#### Scenario: 游戏未提供本地策略
- **GIVEN** 某个游戏未声明 `local-ai` 支持
- **WHEN** 房间尝试为该游戏创建本地 AI 座位
- **THEN** 系统 MUST 拒绝该配置
- **AND** 不得通过隐式 fallback 假装该游戏支持 AI

### Requirement: 远程 AI Provider 桥接
系统 SHALL 支持通过统一 Provider 接口桥接 AstrBot、外部大模型服务或后续独立机器人进程。

#### Scenario: AstrBot 作为远程 provider 接入
- **GIVEN** 某个 `RemoteAiProvider` 实现由 AstrBot 驱动
- **WHEN** 系统向该 provider 发送 `AiDecisionContext`
- **THEN** provider MUST 返回结构化 `AiActionDecision`
- **AND** 系统 MUST 继续使用统一合法性门控和执行链

#### Scenario: 远程 provider 超时
- **GIVEN** 远程 provider 在预算时间内未返回结果
- **WHEN** 超时阈值被触发
- **THEN** 系统 MUST 执行明确的 fallback 策略
- **AND** 不得无限等待导致整局停滞
