# 设计与回归锁定

用户记忆中的服务复用在当前 `shouldAutoPreferSharedSingleRun` 和 `ensureSingleWorkerRuntime` 中仍存在；提交 `7c85d026d` 也保留该路径。固定预算从 `f089183e9` 起已存在。因此没有证据宣称“服务复用被删除”或历史曾允许无条件并发；本次按用户批准改造资源策略，保留原有健康服务复用。

原失败链：标准命令 → 全局 runtime 等待 → 同名任务互斥 → E2E 固定名额 → 动态性能检查 → 服务复用。前三项让性能检查与复用没有机会执行。

职责延续既有 owner：
- `heavy-task-guard` 只登记每个任务，不持有按任务类型的排他锁。
- `global-heavy-budget` 是唯一资源准入 owner，按实际 CPU / 内存决定；登记与启动前再次采样，数量与旧权重配置只保留诊断意义。
- `e2e-runtime-manager` 负责 scope、健康、复用及冷启动。使用现有 registry 短事务保护同一 scope 启动锁的创建 / 清理，等待服务启动时不持有全局 registry 锁，服务就绪后不锁测试执行。共享 owner 在发起测试结束后独立存活，错误日志写专用文件；登记实际消费者 PID，不能重启仍被使用的服务。
- bundle 记录实际 esbuild 输入及配置的内容摘要，另记录 Vite 前端源码摘要；稳定测试模式关闭监听，不能将健康的旧前端缓存当成当前源码。输入未变直接复用；前端或后端输入变化且池空闲则刷新共享服务，仍有消费者则保留旧服务并通过既有 isolated fallback 起当前源码服务。显式 tsx / ts-loader / prebuilt 用覆盖源码与产物的身份核对。
- Playwright 产物与正式截图 helper 的写入目录均按执行 session 隔离，允许同一用例并发回放，不互删当前证据。
- `port-allocator` 负责实际端口冲突，不能把其它 worktree 的同名 scope 当作自己来忽略。
- registry 缓存进程内不变的 Git 根目录，避免每次心跳都启动 Git、导致阻塞和租约过期。

不能改变：真实资源门控、危险内存 watchdog、健康就绪判据、跨 worktree 边界、浏览器上下文隔离、他人活跃进程、游戏测试断言与截图验收。
