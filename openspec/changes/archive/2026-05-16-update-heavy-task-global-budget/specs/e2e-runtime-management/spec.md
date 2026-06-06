## MODIFIED Requirements
### Requirement: Single-Worker Runtime Isolation And Reuse
系统 SHALL 在单文件 E2E 运行时，为同一 worktree 的同一目标生成稳定 runtime scope，以便复用现有 runtime；不同 worktree 即使目标文件相同，也必须获得不同 scope，避免共享同一 runtime。

#### Scenario: Same worktree reuses stable runtime
- **WHEN** 同一 worktree 连续运行相同目标的单文件 E2E
- **THEN** 系统使用相同的稳定 runtime scope
- **AND** 如现有 runtime 健康可用，则复用该 runtime

#### Scenario: Different worktrees stay isolated
- **WHEN** 不同 worktree 同时运行相同目标的单文件 E2E
- **THEN** 系统为它们生成不同 runtime scope
- **AND** 运行时记录、端口保留和预算占用彼此隔离

### Requirement: Global Heavy Task Budget
系统 SHALL 为 E2E 与其他重型本地校验任务提供全仓库共享预算，并在启动前根据预算占用、CPU、可用内存和启动冷却状态决定是否允许启动。

#### Scenario: Heavy task starts within budget
- **WHEN** 新的重型任务请求启动
- **AND** 当前共享预算尚有余量
- **AND** CPU 与可用内存满足准入阈值
- **THEN** 系统记录该任务的全局预算占用并允许启动

#### Scenario: Heavy task rejected by budget
- **WHEN** 新的重型任务请求启动
- **AND** 当前共享预算已满或动态资源门控未通过
- **THEN** 系统拒绝启动该任务
- **AND** 输出当前活跃重任务、预算占用与阻塞原因

#### Scenario: Stale global budget entries are recovered
- **WHEN** 共享预算 registry 中存在 PID 失效或租约过期的任务记录
- **THEN** 系统在新的重型任务启动前自动清理 stale 记录
- **AND** stale 记录不会继续占用预算
