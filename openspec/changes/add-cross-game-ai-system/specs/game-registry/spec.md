## ADDED Requirements

### Requirement: 显式 AI 能力声明
系统 SHALL 要求每个游戏在 manifest/registry 中显式声明 AI 能力档案，而不是通过文件存在性、命名约定或运行时猜测推断 AI 支持状态。

#### Scenario: 游戏显式声明 AI 能力
- **GIVEN** 某个游戏提供 `manifest.ts`
- **WHEN** 系统生成权威游戏清单
- **THEN** 该游戏条目 MUST 包含显式 `ai` 能力档案
- **AND** 档案 MUST 至少声明是否支持 `capture`、`local-ai`、`remote-ai`

#### Scenario: 游戏未声明 AI 能力
- **GIVEN** 某个游戏缺少 `ai` 能力档案
- **WHEN** 系统执行 registry 生成或开发态校验
- **THEN** 系统 MUST 报告缺失配置
- **AND** 不得通过隐式默认值推断为支持某种 AI 模式

#### Scenario: 前端与服务端读取同一份 AI 能力声明
- **GIVEN** 游戏 registry 已生成
- **WHEN** 前端展示房间配置或服务端创建 AI 座位
- **THEN** 双方 MUST 使用同一份权威 `ai` 能力档案
- **AND** 不得由前端或服务端各自维护第二份 AI 支持清单
