## 1. Implementation
- [x] 1.1 为标准 E2E 入口注入统一的 supervisor/session 元数据
- [x] 1.2 扩展 runtime registry 与日志元数据，记录 session/source/entrypoint
- [x] 1.3 修改 `global-setup.ts`，在标准入口下禁止旁路 detached 起服，只允许附着 managed runtime
- [x] 1.4 为 direct Playwright / legacy bootstrap 增加显式开关与明确错误提示
- [x] 1.5 补充 teardown / stop 路径，确保标准入口退出后不会留下后台 runtime
- [x] 1.6 完成最小验证：单文件运行、`--list`、并发运行、异常中断后无残留 runtime
