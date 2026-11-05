## MODIFIED Requirements

### Requirement: Global Heavy Task Budget
系统 SHALL 根据实时 CPU 与可用内存决定重型本地校验任务是否可以启动；任务名称、已有任务数量、静态权重配额与无关 runtime 的存在 MUST NOT 构成固定并发限制。任务登记保留独立身份、来源、租约与诊断信息。

#### Scenario: 其它 E2E 存活但资源充足
- **WHEN** 已有 E2E 或质量检查仍在运行，新任务请求启动
- **AND** CPU 与可用内存满足准入阈值
- **THEN** 新任务通过实际资源检查并独立登记
- **AND** 不需要开启绕过检查或放宽固定名额的开关

#### Scenario: 实际资源压力过高
- **WHEN** CPU 或可用内存不满足准入阈值
- **THEN** 系统等待或拒绝本次启动
- **AND** 输出实际采样、阈值与直接原因
- **AND** 运行中的危险内存监控继续有效

#### Scenario: 等待服务期间资源转差
- **WHEN** 首次准入通过，但服务就绪等待期间 CPU 或内存转差
- **THEN** 真正启动浏览器前重新采样并等待资源恢复
- **AND** 使用同一次任务登记，不重复占用登记记录

#### Scenario: 失效登记恢复
- **WHEN** 登记的 PID 已失效或租约已过期
- **THEN** 系统精准清理失效记录
- **AND** 不结束仍存活的其它任务来腾出名额

### Requirement: Single-Worker Runtime Isolation And Reuse
系统 SHALL 默认复用同一 worktree 的健康共享服务，使多个测试执行使用独立 session 与浏览器上下文，不能因复用服务而强制整个测试串行。明确要求隔离或实际存在端口 / worktree 冲突时，系统 SHALL 使用独立 scope 和合法端口组。

#### Scenario: 多个目标复用健康服务
- **WHEN** 同一 worktree 的两个目标同时运行且共享服务健康
- **THEN** 两次执行附着同一 runtime 与同一服务端口组
- **AND** 不重复启动前端、游戏服和 API 服务
- **AND** 保留不同测试 session 与浏览器上下文
- **AND** 每次执行使用独立的 Playwright 产物目录，不清理其它执行的截图、录屏或 trace
- **AND** 正式截图 helper 的写入和清理同样限定当前执行 session

#### Scenario: 后端输入已改变
- **WHEN** 健康共享服务对应的构建输入或运行时类型与当前源码不同
- **THEN** 不得因健康端点返回成功而复用旧规则
- **AND** 无活跃消费者时刷新服务，有活跃消费者时保留原服务并隔离启动当前源码

#### Scenario: 最早的测试先结束
- **WHEN** 启动共享服务的测试先于其它复用者结束
- **THEN** 共享服务 owner 独立存活，继续承载其它测试及后续复用
- **AND** 后续孤儿清理不能将其误判为无 owner 服务

#### Scenario: 不同 worktree 端口冲突
- **WHEN** 其它 worktree 已占用或保留同一端口组，即使 scope 同名
- **THEN** 系统不能覆盖其保留或复用其服务
- **AND** 合法隔离运行使用可用的其它端口

## ADDED Requirements

### Requirement: 同一服务的冷启动必须合并
系统 SHALL 仅在同一 scope 的检查与启动期间保护启动临界区，多个请求 MUST 等待该启动完成后复用服务，不得重复启动或停止尚在启动的活跃 owner。此锁 MUST NOT 覆盖整个测试执行期或无关 scope。

#### Scenario: 同时请求尚未就绪的共享服务
- **WHEN** 同一 worktree 的多个请求同时发现共享服务尚未就绪
- **THEN** 仅一个请求执行冷启动
- **AND** 其余请求等待该服务就绪后复用
- **AND** 服务启动锁释放后多个测试可同时执行

#### Scenario: 已有服务不健康且 owner 存活
- **WHEN** 现有服务健康检查失败但 owner 仍存活
- **THEN** 系统保留原服务供其会话诊断
- **AND** 不重启他人服务，使用合法隔离运行或报告真实冲突
