## 1. Spec
- [x] 1.1 新增 `online-ai-recovery` spec，定义服务端权威 watchdog、两段式恢复、自动反馈与前端降噪要求

## 2. Shared recovery core
- [x] 2.1 抽取在线 AI 卡死恢复判定与 follow-up 逻辑为共享纯函数模块，供前端和服务端共用
- [x] 2.2 保持 human 门禁与 follow-up 二次确认语义不变，并补单测锁定真人安全边界

## 3. Server watchdog
- [x] 3.1 在 `GameTransportServer` 增加在线 AI recovery runtime、周期性扫描与 incident tracker
- [x] 3.2 在服务端内部执行最小恢复命令（先解阻塞，再按最新权威状态循环 `ADVANCE_PHASE` 直到安全收口）
- [x] 3.3 让服务端恢复动作与命令执行锁/队列兼容，避免与普通命令互相踩状态

## 4. Automatic feedback
- [x] 4.1 增加 best-effort 自动反馈上报器，向现有 `/feedback` 写入结构化 incident
- [x] 4.2 增加去重与冷却，避免同一 incident 刷屏
- [x] 4.3 将关键 reason、incident key 与反馈结果写入服务器日志，便于排查

## 5. Client fallback alignment
- [x] 5.1 调整 `MatchRoom` 前端桥接层：服务端已接管 incident 时降噪，不再反复弹失败 toast
- [x] 5.2 将失败提示改为精确 reason/phase 口径，便于判断是服务端 reject 还是服务端已接管

## 6. Validation
- [x] 6.1 补 Vitest：共享 recovery 逻辑、服务端 watchdog、自动反馈 dedupe、真人安全边界
- [x] 6.2 补/改在线房间 E2E：验证服务端 watchdog 可在 AI 卡死时真正交还回合，并验证用户侧不再被失败 toast 反复轰炸
- [x] 6.3 运行 `openspec validate add-online-ai-watchdog-fallback --strict --no-interactive`
