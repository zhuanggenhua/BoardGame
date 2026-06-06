## Context
项目已有：
- 单工作树内的 `heavy-task-guard` 互斥
- E2E runtime registry / port reservation
- 单文件 E2E 稳定 scope 复用

缺口在于：多 worktree 并行时，上述机制无法限制“全机同时跑太多重任务”。

## Goals / Non-Goals
- Goals:
  - 为 E2E 与 quality gate 增加全仓库共享预算
  - 动态参考 CPU、可用内存、启动冷却时间做准入
  - 不引入常驻 daemon
- Non-Goals:
  - 不做复杂优先级调度器
  - 不替代 CI 层并发控制

## Decisions
- Decision: 预算状态放在 git common dir 下，确保多个 worktree 共享同一份状态
- Decision: 使用共享 lock 文件 + registry 文件，而不是后台守护进程
- Decision: 采用“硬预算上限 + 任务权重 + CPU/内存软门控 + 启动冷却”组合，而非只看 CPU
- Decision: 默认 E2E 与 quality gate 共用同一全局预算池，但保留按组配置空间

## Risks / Trade-offs
- CPU 采样只能近似反映当前负载，存在瞬时波动
  - Mitigation: 连续多次采样 + 冷却时间，避免单点误判
- 锁文件或 registry 可能残留
  - Mitigation: 启动前统一 prune stale 记录，并基于 PID/租约回收

## Migration Plan
1. 新增共享预算模块
2. 接入 E2E / quality gate
3. 扩展 doctor / cleanup 输出
4. 增加环境变量控制预算上限与门控阈值

## Open Questions
- 默认总权重阈值是否长期保持 `4`
- 是否需要为全量 E2E 与单文件 E2E 采用不同等待策略
