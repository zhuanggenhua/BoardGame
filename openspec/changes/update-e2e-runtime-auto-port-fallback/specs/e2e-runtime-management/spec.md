## ADDED Requirements
### Requirement: Isolated runtime 必须支持自动端口回退
系统 SHALL 在启动 isolated runtime 时检测默认端口组是否可用；若已被占用，则自动分配下一组可用端口并继续启动。

#### Scenario: 默认端口被占用时自动回退
- **WHEN** isolated runtime 请求启动且默认端口组已被占用
- **THEN** 系统自动选择可用端口组启动该 runtime
- **AND** registry 记录该 runtime 的端口组与 ownerPid

#### Scenario: 端口池耗尽时给出冲突清单
- **WHEN** isolated runtime 请求启动但端口池中无可用端口组
- **THEN** 系统拒绝启动并返回错误
- **AND** 错误信息包含占用端口组的 runtimeId 与端口列表

## MODIFIED Requirements
### Requirement: 多工作树必须相互隔离
系统 SHALL 以 `worktreeRoot + scope` 作为 runtime 隔离边界，禁止不同工作树隐式复用同一 E2E runtime。

#### Scenario: 另一个工作树占用相同共享端口
- **WHEN** 当前 worktree 请求复用共享单 worker 端口，而该端口已被其他 worktree 的 active runtime 占用
- **THEN** 系统拒绝复用
- **AND** 返回包含冲突 worktree 与 runtime 摘要的错误信息

#### Scenario: 同一 worktree 的多个 isolated runtime 并行
- **WHEN** 当前 worktree 已存在 isolated runtime 且再次请求新的 isolated runtime
- **THEN** 系统自动分配不同端口组
- **AND** 两个 runtime 的 registry 记录互不覆盖
