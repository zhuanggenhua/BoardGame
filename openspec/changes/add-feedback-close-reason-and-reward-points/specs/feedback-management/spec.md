## ADDED Requirements

### Requirement: 手填反馈关闭必须记录关闭理由
系统 SHALL 在手动关闭非自动反馈时记录关闭理由，并将其作为反馈详情的一部分保存。

#### Scenario: 关闭手填反馈时填写关闭理由
- **WHEN** 管理员、开发者或反馈所有者将一条手填反馈更新为 `closed`
- **AND** 该反馈不属于自动反馈
- **THEN** 请求 MUST 提供 `closedReason`
- **AND** 系统 MUST 将 `closedReason` 保存到该反馈记录

#### Scenario: 自动反馈关闭时可不填写关闭理由
- **WHEN** 管理员或开发者将一条自动反馈更新为 `closed`
- **THEN** 系统 MAY 接受空的 `closedReason`
- **AND** 不应因为缺少关闭理由而拒绝关闭

### Requirement: 已登录反馈必须记录奖励积分
系统 SHALL 为已登录用户提交的反馈记录奖励积分，并同步更新用户累计反馈积分。

#### Scenario: 登录用户提交反馈获得积分
- **WHEN** 已登录用户通过反馈弹窗提交一条反馈
- **THEN** 系统 MUST 在该反馈记录上保存本次奖励积分
- **AND** 系统 MUST 更新该用户的累计反馈积分

#### Scenario: 匿名反馈不累计用户积分
- **WHEN** 匿名用户提交反馈
- **THEN** 系统 MUST 允许该反馈创建成功
- **AND** 系统 MUST NOT 为不存在的用户累计反馈积分

### Requirement: 用户必须能够查询自己的反馈进度
系统 SHALL 允许已登录用户查询自己的反馈列表，并查看每条反馈的处理进度、关闭理由和奖励积分。

#### Scenario: 查看自己的反馈列表
- **WHEN** 已登录用户打开“我的反馈”
- **THEN** 系统返回仅属于该用户的反馈记录
- **AND** 每条记录包含状态、创建时间和反馈内容摘要

#### Scenario: 查看已关闭反馈的关闭理由
- **WHEN** 已登录用户查看一条状态为 `closed` 的本人反馈
- **THEN** 系统展示该反馈的 `closedReason`
- **AND** 若该反馈曾获得积分，系统同时展示奖励积分
