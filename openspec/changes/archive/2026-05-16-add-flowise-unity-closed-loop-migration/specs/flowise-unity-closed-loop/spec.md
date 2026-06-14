## ADDED Requirements

### Requirement: Unity 教程闭环工作流 SHALL 以迁移包而不是单个 JSON 形式复现

系统在另一台 Windows 电脑复现 `Unity 教程闭环工作流` 时，MUST 将 MCP 工具、LangGraph runner、重建脚本、模板文件、启停脚本和 MCP 补丁视为一个完整迁移包；不得只复制单个 `agentflowv2.json`。

#### Scenario: 迁移包包含最小必要资产
- **WHEN** 团队准备在另一台 Windows 电脑上复现当前工作流
- **THEN** 迁移包 MUST 至少包含 MCP 脚本、LangGraph runner、重建脚本、Agentflow V2 模板、启动脚本、停止脚本、刷新配置脚本
- **AND** MUST 同时包含 `flowise-components` 中 MCP 核心补丁的文件或补丁说明

#### Scenario: 重新安装 Flowise 后必须重新补 MCP 补丁
- **WHEN** 目标机器重新安装了 `flowise` 或重新生成 `node_modules`
- **THEN** 系统 MUST 重新检查并补回 `flowise-components/dist/nodes/tools/MCP/core.js` 中的超时补丁
- **AND** 不得假设旧机器复制过来的运行目录会永久保留该补丁

### Requirement: 工作流 SHALL 保持 Agentflow V2 的显式多节点编排

系统在迁移和后续维护 `Unity 教程闭环工作流` 时，MUST 保持 `Agentflow V2` 的显式多节点编排，不得回退为旧版画布或单工具伪编排。

#### Scenario: 推荐节点集合保持简洁
- **WHEN** 团队重建或调整该工作流
- **THEN** 系统 SHOULD 优先使用 `Start`、`Tool`、`Condition`、`DirectReply`
- **AND** 不得无必要回退到 v1 旧图

#### Scenario: 禁止单 MCP 巨型节点伪装闭环
- **WHEN** 团队尝试把大部分逻辑重新塞回单个 MCP 工具
- **THEN** 系统 MUST 视其为不符合当前工作流目标的实现
- **AND** 因为这种做法无法满足“画布可见多节点编排与真实验证闭环”的要求

#### Scenario: 显式拆出测试、验证、评估、修复与截图阶段
- **WHEN** 工作流被渲染在 Agentflow V2 画布中
- **THEN** 画布 MUST 显式展示场景测试、教程验证、项目快照、结果评估、条件分流、Codex 修复、截图、结果卡片等阶段节点
- **AND** 不得只在工具内部闭包里偷偷执行这些阶段

### Requirement: MCP 长耗时调用 SHALL 明确提升超时上限

系统在运行教程验证、Codex 修复等长耗时节点时，MUST 明确提高 MCP 请求超时，避免默认 60000ms 导致流程中断。

#### Scenario: 环境变量层提高超时
- **WHEN** 团队在目标机器配置 Flowise 运行环境
- **THEN** 系统 MUST 在 `.env` 或等价环境配置中显式设置 `FLOWISE_MCP_REQUEST_TIMEOUT_MSEC`
- **AND** 该值 MUST 高于默认 60000ms

#### Scenario: MCP 核心请求层同步提高超时
- **WHEN** 团队修补目标机器上的 Flowise MCP 节点
- **THEN** `client.request(...)` 或等价 MCP 请求调用 MUST 显式带更长超时参数
- **AND** 不得只依赖环境变量层单点放宽

### Requirement: MCP 工具层 SHALL 兼容 Flowise Tool 节点的字符串化参数

系统 MUST 假设 Flowise V2 `Tool` 节点会把 `boolean`、`number` 等参数以字符串形式传给 MCP 工具，并在工具层负责兼容与正规化。

#### Scenario: 布尔参数兼容字符串输入
- **WHEN** MCP 工具声明布尔参数
- **THEN** 工具 schema MUST 兼容 `boolean` 与 `string`
- **AND** 工具内部 MUST 在实际使用前将其正规化为布尔值

#### Scenario: 数值参数兼容字符串输入
- **WHEN** MCP 工具声明数值参数
- **THEN** 工具 schema MUST 兼容 `number` 与 `string`
- **AND** 工具内部 MUST 在实际使用前将其正规化为数值

### Requirement: 结束分支 SHALL 各自拥有独立末端节点

系统在 Agentflow V2 中组织多条结束分支时，MUST 让每条结束分支拥有独立的截图、结果卡片和返回结果节点，避免调度不稳定。

#### Scenario: 末端分支不复用同一个 reply 节点
- **WHEN** 第一轮、第二轮、第三轮分别都有可能直接结束流程
- **THEN** 每条结束分支 MUST 各自拥有独立的末端 `Tool` / `DirectReply`
- **AND** 不得把多个来源分支汇到同一个最终返回节点

#### Scenario: 结果不得退化成中间 JSON
- **WHEN** 工作流完成任一结束分支
- **THEN** 最终返回 MUST 是结果卡片或等价整理后的最终回复
- **AND** 不得只把某个中间节点的原始 JSON 直接吐给用户

### Requirement: 工作流 SHALL 采用三轮闭环结构

系统 SHALL 采用“验证 -> 评估 -> 条件 -> 修复”的三轮结构推进 Unity 教程闭环，并在最后一轮只做兜底不再继续修复。

#### Scenario: 前两轮允许条件分流与修复
- **WHEN** 第一轮或第二轮验证未通过
- **THEN** 工作流 SHOULD 通过 `Condition` 分流进入对应的 `Codex 修复` 节点
- **AND** 之后再回到下一轮验证链

#### Scenario: 第三轮作为最终兜底
- **WHEN** 工作流进入第三轮
- **THEN** 系统 SHOULD 将其作为最终兜底验证轮
- **AND** 不再继续递归追加新的修复轮次

### Requirement: 迁移后验收 SHALL 以可见编排与真实闭环为准

系统在另一台机器上验收该工作流时，MUST 以“可见多节点编排 + 真实验证闭环”作为通过标准，不能只看接口状态码。

#### Scenario: 首轮 smoke test 只验证不实现
- **WHEN** 团队在新机器完成迁移后做第一次烟测
- **THEN** SHOULD 优先使用“只测试当前教程工作流，不需要实现新功能；请附带截图。”这类不改仓库的验证请求
- **AND** 先确认截图链与验证链打通，再继续验证实现链

#### Scenario: 通过标准包含截图与顺序执行
- **WHEN** 团队判断迁移是否成功
- **THEN** 至少 MUST 同时满足：画布上是多节点结构、调试窗口按节点顺序执行、最终结果包含截图链接或图片、长耗时节点未因默认超时中断
- **AND** 不得仅因接口返回 200 就判定迁移通过
