## 1. 规格与治理

- [x] 1.1 新增 feedback-management 规格增量并通过 strict 校验
- [x] 1.2 更新反馈系统标准与 feedback-closeout 唯一入口
- [x] 1.3 记录旧字段兼容边界与回放能力分级

## 2. 结构化现场包

- [x] 2.1 新增 FeedbackDiagnosticPacket 共享类型与版本
- [x] 2.2 扩展 API schema / DTO / service 校验现场包完整性
- [x] 2.3 实现缺失字段计算与 full/partial/unreplayable 分级
- [x] 2.4 保留旧字段并建立兼容读取路径

## 3. 客户端采集

- [x] 3.1 人工反馈提交同时生成现场包
- [x] 3.2 客户端自动反馈记录关联键、当前状态与最近时序
- [x] 3.3 状态采集失败时明确写入 collectionStatus 和原因

## 4. 服务端与 AI/watchdog

- [x] 4.1 在线 AI/watchdog 反馈改用统一现场包
- [x] 4.2 捕获 room / request / state / decisionEpoch 关联
- [x] 4.3 保存 AI 视角、合法动作、响应窗口和恢复动作
- [x] 4.4 保持自动恢复与反馈状态解耦

## 5. 管理端与回放

- [x] 5.1 管理端详情展示现场包完整性、关联键和缺失字段
- [x] 5.2 支持按回放能力筛选
- [x] 5.3 增加只读历史回填报告，不推测补全原始现场
- [x] 5.4 为现场包导入增加运行时消费断言入口

## 6. 验证

- [x] 6.1 API schema / DTO / service 测试
- [x] 6.2 客户端自动反馈与人工反馈测试
- [x] 6.3 在线 AI/watchdog 诊断测试
- [x] 6.4 真实入口 E2E 三段式证据
- [x] 6.5 npm run spec:lint
- [x] 6.6 npm run typecheck
- [x] 6.7 git diff --check
