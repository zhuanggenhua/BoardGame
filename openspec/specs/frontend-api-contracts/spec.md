# frontend-api-contracts Specification

## Purpose
TBD - created by archiving change refactor-frontend-api-contracts-and-lobby-ranking. Update Purpose after archive.
## Requirements
### Requirement: 前端后台请求合同
系统 MUST 提供前端后台请求合同 Module，集中声明后台入口、路径拼接、响应解析与错误模式。首页/大厅链路 MUST 通过该 Module 读取后台统计，不得在 hook 或展示 Module 中直接拼接后台入口字符串。

#### Scenario: 首页热度读取命中真实统计入口
- **GIVEN** 首页大厅需要读取游戏热度
- **WHEN** 前端发起统计请求
- **THEN** 请求 MUST 命中后台统计入口 `/admin/stats`
- **AND** 不得命中认证入口下的 `/auth/admin/stats`

#### Scenario: 新增首页后台请求走集中合同
- **GIVEN** 开发者为首页或大厅新增后台请求
- **WHEN** 该请求需要访问后台统计、房间或游戏运营数据
- **THEN** 代码 MUST 通过前端后台请求合同 Module 发起请求
- **AND** 不得在页面、hook 或排序 Module 中直接拼接 `ADMIN_API_URL` 或 `AUTH_API_URL`

### Requirement: 请求失败可观测
系统 MUST 区分真实空数据与请求失败。消费后台统计的前端 Module MUST 暴露加载状态和失败原因，不能只用空对象或空数组表达所有失败情况。

#### Scenario: 后台统计请求失败
- **GIVEN** 首页大厅请求后台统计
- **WHEN** 请求返回非 2xx、网络失败或响应无法解析
- **THEN** 热度加载结果 MUST 标记为失败
- **AND** 结果 MUST 包含可诊断的失败原因
- **AND** UI MAY 使用固定排序降级展示，但测试和开发态诊断 MUST 能识别这不是“真实无热度”

#### Scenario: 后台统计真实为空
- **GIVEN** 首页大厅请求后台统计成功
- **WHEN** 后台返回空的游玩统计
- **THEN** 热度加载结果 MUST 标记为成功
- **AND** 热度数据 MUST 为空
- **AND** 该状态 MUST 与请求失败可区分

### Requirement: 大厅排序解释合同
系统 MUST 提供大厅排序解释合同，输出每个游戏参与排名的关键因子。排序因子 MUST 至少包含实施状态优先级、热度分、固定回退优先级和原始顺序。

#### Scenario: 热度最高的已上线游戏排第一
- **GIVEN** Dice Throne 是已上线游戏
- **AND** 后台统计显示 Dice Throne 热度分最高
- **WHEN** 首页大厅按全部游戏排序
- **THEN** Dice Throne MUST 排在第一位
- **AND** 排序解释 MUST 显示其胜出因子包含热度分

#### Scenario: 实施中游戏不能靠热度冲到已上线游戏前面
- **GIVEN** 一个实施中游戏拥有最高热度分
- **AND** 至少存在一个已上线游戏
- **WHEN** 首页大厅按全部游戏排序
- **THEN** 实施中游戏 MUST 排在已上线游戏之后
- **AND** 排序解释 MUST 显示实施状态优先级先于热度分生效

#### Scenario: 热度不可用时使用固定回退顺序
- **GIVEN** 热度加载失败或热度数据为空
- **WHEN** 首页大厅需要展示游戏列表
- **THEN** 系统 MUST 使用固定精选回退顺序
- **AND** Dice Throne MUST 在该回退顺序中优先于未完成或低优先级游戏

