## 1. Implementation
- [x] 1.1 在 ResponseWindowSystem 增加语义 fingerprint/冷却判定（默认不破坏旧行为）
- [x] 1.2 在 DiceThrone 系统配置启用语义去重（或提供游戏层注入）
- [x] 1.3 onlineAiRecovery 进展标记改为语义 fingerprint（忽略 timestamp 派生 responseWindowId）
- [x] 1.4 在线 watchdog 反馈补充响应窗口 fingerprint / unsatisfiable reason
- [x] 1.5 更新相关单测（优先 `src/engine/transport/__tests__/server.test.ts`）
- [x] 1.6 更新 AI 审计 evidence（若规则/行为变化）
- [x] 1.7 在线 watchdog 移除 enableAi 启动依赖，并补齐对应测试
