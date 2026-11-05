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

## 结构化现场包

- 玩家反馈、客户端自动反馈和服务端自动反馈必须尽量同时提交 diagnosticPacket；旧 stateSnapshot、actionLog 和 clientContext 只保留兼容读取职责。
- diagnosticPacket 的唯一合同包含 schemaVersion、captureId、可选 chainId、capturedAt、source、collectionStatus、replayability、missingFields、correlation、构建信息、阶段 / 回合 / 交互 / 响应窗口、有限长度行动日志与事件流尾部，以及 snapshots.before / at / after。
- captureId 只标识一次采集；同一故障链的前态、中态、后态必须共用 chainId。matchId、roomId、requestId、stateId、stateRevision 或 decisionEpoch 缺失时必须进入 missingFields，禁止从反馈正文、相邻记录或 incidentKey 推测。
- replayability 只有三档：full（可进入原始时点回放）、partial（可消费状态或重建语义场景，但缺关键关联 / 时序）、unreplayable（缺少可用状态或真实入口）。
- 状态注入成功不等于反馈复现；接入现场包的测试必须直接读取运行时阶段、交互 / 响应窗口、目标对象、行动日志和事件流，并把“注入成功、运行时消费成功、原始故障复现成功”分开记录。
- actionLogTail / eventStreamTail 只能作为语义线索，不能单独证明原始时点可回放；涉及随机结果、连续结算或撤回链时，必须同时保留状态时点快照、前后快照、stateId / stateRevision、decisionEpoch、请求关联和 randomCursor，缺一只能降级为 partial 或 unreplayable。
- 状态注入入口必须支持显式 randomCursor，并返回权威 stateID / randomCursor；E2E helper 必须等待页面运行时消费到目标阶段 / 交互 / 响应窗口，禁止用固定 sleep 代替消费证明。
- 服务端自动反馈的关联键必须从权威 `match.state`、`match.stateID` 和当前交互 / 响应窗口读取；不存在独立房间号时保留 `roomId` 缺失，不得把 `matchId`、`incidentKey` 或日志文本伪装成房间号。
- 历史反馈只允许生成只读缺口报告；回填工具不得补写 diagnosticPacket、猜测关联键或改动反馈状态。现场包导入必须经过运行时消费断言入口，直接比较运行时阶段、请求、状态版本和决策纪元。
- 现场包采集失败不得吞掉反馈提交；应记录 collectionStatus: partial 或 failed 与 collectionErrors，让后台明确知道当前只能定位到哪一层。
