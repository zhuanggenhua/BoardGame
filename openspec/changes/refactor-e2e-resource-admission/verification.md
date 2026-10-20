# 本地验收记录

目标环境：Windows 当前工作目录，标准 `test:e2e:file` 入口；无绕过检查参数，无提交、推送或部署。

## 原始阻塞与实际资源准入

旧链路在资源检查之前因同名登记 / 固定名额 / 无关 runtime 排队。新版在外部采集 PID 70504 仍存活时，教程与目录两个标准任务均实际启动：主线 CPU 6.6%、可用内存 3.60GB；目录 CPU 5.5%、可用内存 1.49GB、其它活跃任务 2。两者附着同一 6174 / 20000 / 21000 服务组。日志：`tmp/tutorial-resource-refactor-e2e-v2.log`、`tmp/tutorial-resource-catalog-e2e.log`。这些运行包含教程截图失败，不能作为教程完成证据。

## 独立服务 owner 与温复用

目录完整运行 `e2e-1792486783844-xqp85g` 三项通过并退出后，共享 owner 27540 与服务 PID 39976 / 156808 / 164912 仍健康。随后主线启动，第三次目录运行结束，主线继续执行；服务身份保持相同，未重启三组服务。

记录：`tmp/e2e-resource-warm-pool-after-catalog.json`、`tmp/e2e-resource-concurrent-pids.json`、`tmp/tutorial-resource-refactor-e2e-v3.log`、`tmp/e2e-resource-concurrent-third-run.log`。各次 Playwright 产物使用不同 `e2e-*` session 子目录；同用例第三次启动后前两次目录仍存在。正式截图 helper 也按 session 隔离。

## 自动化与独立复审

- Node 基础设施回归：`tmp/e2e-resource-admission-final-all.log`，18 项通过，覆盖多个任务共存、CPU / 内存拒绝、等待后重采样、启动锁、共享 owner、源码新鲜度、跨工作目录端口所有权及换代释放交错。
- 教程 / 生命周期 / 截图文件回归：`tmp/tutorial-refactor-verification-final.log`，50 项通过。包含同用例两个 session 的真实文件写入与清理互不干扰。
- 类型、规范和变更校验：`tmp/tutorial-refactor-typecheck-final.log`、`tmp/tutorial-refactor-speclint.log`、`tmp/e2e-resource-openspec.log`。
- 独立只读复审 `/root/tutorial_workflow_review`：先后发现共享 owner、产物、新鲜度和清理竞态，修复后确认当前复审范围无已知阻断项。POSIX 换代清理以原 owner 条件删除及同一保留锁保护；未声称已在 POSIX 实机运行。

教程截图的全量视觉验收单独在 Dice Throne 教程实例记录中收口，本记录不替代它。

## 当前源码的并行回放

`tmp/tutorial-final-shard-1.log` 与 `tmp/tutorial-final-shard-2.log` 是同一教程文件的两个独立执行。准入分别为 CPU 6.9% / 可用内存 4.65GB、CPU 10.2% / 可用内存 4.45GB；随后目录执行也附着 6174 / 20000 / 21000。每个执行保留独立浏览器和 `e2e-*` 产物目录。目录三项与独立机制练习通过；主线第一次回放中有恢复等待断言超时，已保留原失败日志，最终主线结论以教程实例记录为准。

本次还复现了“测试读当前清单、浏览器仍显示旧提示”的缓存偏差：稳定测试模式关闭 Vite 监听，不能仅用服务健康判断复用资格。当前复用同时比对前端源码与实际后端构建输入；前端 JSON、插件与构建配置的变化也使旧服务失去复用资格。活跃旧服务保持原状，新执行走已有隔离路径；空闲旧服务才刷新。对应测试包括外部 JSON / 插件失效和活跃消费者保护。

## 测试读取开销与最终回归

`tmp/tutorial-mobile-accepted-v3.log` 记录仅缩窄测试状态读取后的完整手机主线：1.7 分钟通过。抽牌节点完整状态 JSON 为 4,058,079 字节，核心状态为 88,222 字节；轮询不再把无关撤回快照和教程检查点传出浏览器，所有原有状态断言保留。本轮分支恢复约 1.1 秒、出售撤回 40 毫秒；这是该用例的本轮测量，不是整个平台性能结论。

最新基础设施回归 `tmp/e2e-resource-admission-accepted.log`：18 项通过；`tmp/tutorial-accepted-verification.log`：50 项通过；浮层窄屏修正后 `tmp/tutorial-overlay-accepted-verification.log`：10 项复查通过；`tmp/tutorial-final-typecheck.log`：类型检查通过。桌面完整回放见 `tmp/tutorial-desktop-accepted.log`，其它分支与逐图证据仍由教程实例记录负责。

最终双端回放 `tmp/tutorial-desktop-delivery.log`、`tmp/tutorial-mobile-delivery.log` 同时执行并附着共享 6174 / 20000 / 21000，分别 2.0 / 1.8 分钟通过。最终类型检查 `tmp/tutorial-delivery-typecheck.log` 通过。教程 145 张、7 条有序链及逐图账本已通过证据校验和全部路径 dry-run；查看器同一目录 key `00f11ac42522` 已确认展示 145 张，链接在教程实例记录中交付。没有提交、推送或部署。
