# ugc-runtime Spec Delta

## ADDED Requirements

### Requirement: 预览与运行统一容器
系统 SHALL 提供统一运行容器供预览与运行复用，保证接口与行为一致。

#### Scenario: 预览复用容器
- **WHEN** 用户进入预览模式
- **THEN** 系统 MUST 使用与运行时一致的容器与接口

### Requirement: 动作钩子执行通道
系统 SHALL 允许视图通过受限 SDK 触发动作钩子，并由宿主验证后执行。

#### Scenario: 动作钩子请求
- **WHEN** 视图触发动作钩子
- **THEN** 系统 MUST 通过受限 SDK 发送并由宿主校验
