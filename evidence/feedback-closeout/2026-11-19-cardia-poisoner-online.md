# Cardia 第五枚印戒与毒师：在线代表场景验证

- 原线上两条自动反馈分别为 `[system][online-ai-watchdog] repeated-recovery-suppressed diagnostic_available` 和 `[system][online-ai-watchdog] force-end-turn-failed diagnostic_available`；两条记录均为 `resolved`，本地胜利判定时机修复尚未部署。
- 反馈原局的能力时机与胜负判定已通过私密回放和领域回归核验。本次在线测试使用新的双玩家房间，预置玩家 0 的四枚印戒与双方手牌，玩家在真实客户端各自出牌；不声称这些前态由该次测试自然产生，也不是原局回放。
- 服务端在遭遇产生第五枚印戒后仍处于能力阶段且没有游戏结束；玩家 1 实际点击可见的毒师能力按钮后，服务端进入下一回合、玩家 0 回到四枚印戒、仍没有游戏结束。玩家 1 页面未捕获未处理异常。
- 正式入口 `node scripts/infra/run-e2e-single.mjs ci e2e/cardia/cardia-poisoner-fifth-signet.e2e.ts` 通过 1 项；测试结构检查通过，ESLint 0 错误（2 个 `any` 警告）。这是本地在线代表场景，不证明线上部署或原反馈设备效果。
- 追加原反馈的在线 AI 路径：相同的预置四印戒场景中，座位 1 配置为服务端 AI；玩家 0 从页面出牌后，AI 自动出毒师并使用能力。权威状态同时确认毒师修正标记存在、玩家 0 为四枚印戒、游戏未结束并进入下一回合；主玩家页面未捕获未处理异常。正式入口按 `服务端 AI` 定向运行 1 项通过；该代表场景不是生产原局或生产部署验证。
