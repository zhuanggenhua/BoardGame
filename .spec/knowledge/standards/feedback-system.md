---
name: feedback-system
description: 反馈系统标准：提交、状态、去重、恢复和回写边界——改用户反馈链路时查
metadata:
  type: doc
  status: 已交付
---

# 反馈系统规范

## 反馈提交入口

- `POST /feedback` 是玩家反馈提交通道，必须对未登录用户可用。
- 可选登录态只用于绑定提交者与发放反馈积分；登录凭证缺失、过期、无效或格式异常时，提交必须按匿名反馈继续处理。
- 前端反馈弹窗不得把登录、反馈积分、个人反馈列表或后台管理权限作为提交前置条件；如果带登录态提交返回未授权，必须允许匿名重试。
- 后台反馈管理、个人反馈列表、状态回写、删除等管理动作可以继续要求登录和权限校验。
- 修改 `FeedbackModal`、`FeedbackController`、`OptionalJwtAuthGuard`、`POST /feedback` 或相关认证链路时，必须保留或补充两类回归：未登录可提交、失效 token 仍可提交。

## 反馈处理入口

- 处理线上反馈、回写状态、关闭理由、解决方式等流程仍以 `.spec/skills/feedback-closeout/SKILL.md` 为唯一规范真相源。
- 本文只约束玩家提交反馈的公共入口，不替代反馈收口 workflow。

## 服务端读取与投影边界

- 反馈列表与详情必须由服务端按身份和所有权过滤：普通用户与 developer 的“自己提交”范围仅包含 `reporterType=USER` 且 userId 匹配的记录；developer 还可读取负责游戏范围内的记录；admin 可读全部记录。历史 SYSTEM 记录即使误带相同 userId，也不得进入普通用户或 developer 的本人范围。越权记录必须从列表省略，详情返回 404；`summaryOnly` 使用相同权限范围。
- 未登录查询若开放，只能读取 SYSTEM 安全摘要；不得返回 USER 记录、SYSTEM 正文、联系信息、配置提案、用户账号字段、完整诊断原文或可关联到玩家 / 对局的标识。公开诊断保留排障所需的安全阶段、类型、数量和性能摘要，关联 ID 必须移除；稳定哈希也不得代替移除。匿名响应不得返回 incidentKey、aggregationKey 等跨查询关联键。
- 新写入响应、普通列表、`summaryOnly`、详情及历史兼容记录都必须经服务端字段白名单投影；不得透传完整 Mongoose 文档或 populate 后的 user 对象。联系信息仅 admin 可读；配置提案仅该反馈所有者、负责游戏的 developer 或 admin 可读；用户 email / 账号资料不得由通用反馈投影返回。
- 玩家正文仅在所有者、负责游戏的 developer 或 admin 的授权查询中返回。完整权威状态和 `privateReplay` 仍只允许 admin 读取；其它角色只能获得安全诊断摘要。
- 客户端异常可保留正式站点构建 JS 的公开产物指纹及行列号，用于匹配发布版本定位；必须严格校验来源格式，禁止因此保存原始 URL、查询参数或原始堆栈。无法识别时保持位置缺失，不猜测脚本来源。

## 结构化现场包

- 玩家反馈、客户端自动反馈和服务端自动反馈必须尽量同时提交 diagnosticPacket；旧 stateSnapshot、actionLog 和 clientContext 只保留兼容读取职责。
- diagnosticPacket 的唯一合同包含 schemaVersion、captureId、可选 chainId、capturedAt、source、collectionStatus、replayability、missingFields、correlation、构建信息、阶段 / 回合 / 交互 / 响应窗口、有限长度行动日志与事件流尾部、有限命令摘要，以及 snapshots.before / at / after。
- lastCommand / commandTraceTail 仅允许 commandId、commandType、playerId、issuedAt、stateId、randomCursor、afterStateId 和 afterRandomCursor；最多保留最近 12 条，字符串字段最多 128 个字符。禁止采集或序列化原始命令 payload、卡牌 / 选项 / 目标 ID、任意嵌套对象及未知字段；packet 构造边界必须再次按白名单投影，不能信任上游类型声明。
- 公开 diagnosticPacket 与兼容字段 actionLog / stateSnapshot 必须在客户端构造时投影为安全摘要：操作日志只留时间、玩家、类型和条目数；事件流只留事件序号、类型、时间与来源命令类型；交互 / 响应窗口只留请求 ID、kind / windowType、玩家或响应人数及选项数量；状态快照只留阶段、回合、独立版本号、决策纪元和明确允许的公开状态摘要。不得把完整 core、手牌 / 牌堆、隐藏选项、任意事件 payload、撤回快照或随机种子带入公开诊断包、兼容字段或 AI 复制文本。AI 复制文本必须保留玩家反馈原文，并对历史记录中的 actionLog / stateSnapshot 再执行同一白名单投影。
- 完整权威状态、隐藏区域与随机种子仅保存在管理员权限的 privateReplay 附件中；完整原局回放以该附件为唯一来源。附件缺失或无法读取时，安全诊断摘要只能标记 partial，不能声称已完整重放。
- captureId 只标识一次采集；同一故障链的前态、中态、后态必须共用 chainId。matchId、roomId、requestId、stateId、stateRevision 或 decisionEpoch 缺失时必须进入 missingFields，禁止从反馈正文、相邻记录或 incidentKey 推测。
- stateRevision 与 decisionEpoch 是两个独立关联字段：引擎初始 revision 为 0，每条成功命令提交后按前一权威状态递增一次，失败命令不递增；stateRevision 只能取真实 state revision / 显式 stateRevision 来源，decisionEpoch 只能取系统决策纪元。任一缺失都单独记录，不得彼此、或与 stateId 互相填充。
- replayability 只有三档：full（可进入原始时点回放）、partial（可消费状态或重建语义场景，但缺关键关联 / 时序）、unreplayable（缺少可用状态或真实入口）。
- 状态注入成功不等于反馈复现；接入现场包的测试必须直接读取运行时阶段、交互 / 响应窗口、目标对象、行动日志和事件流，并把“注入成功、运行时消费成功、原始故障复现成功”分开记录。
- actionLogTail / eventStreamTail 只能作为安全语义线索，不能单独证明原始时点可回放；涉及随机结果、连续结算或撤回链时，必须同时保留安全状态摘要、前后摘要、stateId / stateRevision、decisionEpoch、请求关联和 randomCursor，并通过管理员 privateReplay 附件取得完整状态。缺一只能降级为 partial 或 unreplayable。
- 状态注入入口必须支持显式 randomCursor，并返回权威 stateID / randomCursor；E2E helper 必须等待页面运行时消费到目标阶段 / 交互 / 响应窗口，禁止用固定 sleep 代替消费证明。
- 服务端自动反馈的关联键必须从权威 `match.state`、`match.stateID` 和当前交互 / 响应窗口读取；不存在独立房间号时保留 `roomId` 缺失，不得把 `matchId`、`incidentKey` 或日志文本伪装成房间号。
- 历史反馈只允许生成只读缺口报告；回填工具不得补写 diagnosticPacket、猜测关联键或改动反馈状态。现场包导入必须经过运行时消费断言入口，直接比较运行时阶段、请求、状态版本和决策纪元。
- 现场包采集失败不得吞掉反馈提交；应记录 collectionStatus: partial 或 failed 与 collectionErrors，让后台明确知道当前只能定位到哪一层。
