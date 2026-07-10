## ADDED Requirements

### Requirement: 正式训练数据只允许完整合格对局
系统 MUST 将对局中的决策样本先写入非正式暂存区，并且只在对局真实结束且满足质量门槛后原子提交整局样本。

#### Scenario: 对局未完成或中途退出
- **WHEN** 对局尚未产生正式终局，或进程在终局前退出
- **THEN** 该局样本 MUST NOT 出现在正式训练数据目录

#### Scenario: 完整对局达到时长门槛
- **WHEN** 对局产生正式终局且持续时间达到该游戏适用的最低完成时长
- **THEN** 系统 MUST 一次性提交该局全部已采集决策样本
- **AND** 提交 MUST 使用同一文件系统内的原子切换，避免半局文件可见

#### Scenario: 完整对局低于时长门槛
- **WHEN** 对局产生正式终局但持续时间低于最低完成时长
- **THEN** 系统 MUST 丢弃该局暂存样本
- **AND** MUST NOT 创建正式训练数据文件

### Requirement: 最低完成时长必须来自可解释配置
系统 MUST 优先使用游戏注册表显式配置的最低完成时长，并在游戏未配置时使用全局最低完成时长；不得使用不可解释的硬编码平均时长。

#### Scenario: 游戏配置了专属门槛
- **WHEN** 游戏 manifest 配置 `ai.trainingMinCompletedDurationMs`
- **THEN** 系统 MUST 使用该游戏级门槛

#### Scenario: 没有任何可靠门槛
- **WHEN** 游戏级和全局最低完成时长都未配置
- **THEN** 系统 MUST 安全停止该游戏正式训练数据提交

### Requirement: 每游戏正式训练数据必须限制为 300MiB
系统 MUST 将每个游戏的既有和新增正式训练数据总量限制在 300MiB 以内。

#### Scenario: 新完整对局会超过容量
- **WHEN** 既有正式数据加该局暂存文件会超过 300MiB
- **THEN** 系统 MUST 拒绝提交该局
- **AND** MUST NOT 删除、截断或覆盖任何既有正式文件

#### Scenario: 存在旧版未筛选 raw 数据
- **WHEN** 历史目录仍保留旧版逐命令采集的 raw 或 archive 文件
- **THEN** 这些历史未筛选文件 MUST NOT 占用新正式 completed 数据的 300MiB 配额
- **AND** 系统 MUST 保留它们供人工审计，不得自动混入正式数据

### Requirement: 未完成对局暂存必须自动过期
系统 MUST 定期清理超过配置保留时间的 pending 文件，避免中途退出或进程异常的对局无限占用磁盘。

#### Scenario: pending 超过 24 小时
- **WHEN** 未完成对局的 pending 文件最后更新时间超过默认 24 小时
- **THEN** 系统 MUST 删除该 pending 文件
- **AND** MUST NOT 创建任何正式 completed 文件

### Requirement: 生产训练数据必须跨容器重建持久化
系统 MUST 将生产 `game-server` 的训练数据根目录挂载到独立持久化卷。

#### Scenario: game-server 容器被重建
- **WHEN** 生产 `game-server` 容器被替换或重建
- **THEN** 已提交正式训练数据 MUST 继续存在
- **AND** MUST NOT 依赖容器可写层恢复
