## 1. Spec / Design
- [x] 1.1 创建并验证 OpenSpec 变更。
- [x] 1.2 明确 Effect DSL primitive 与 AbilityRuntime 的接入边界。

## 2. Implementation
- [x] 2.1 扩展 AbilityRuntime program metadata，支持 `deriveFootprint(context)`。
- [x] 2.2 新增 Smash Up Effect DSL primitives 与 footprint 合并工具。
- [x] 2.3 让 reactionResources 优先读取 DSL footprint，失败才 probe。
- [x] 2.4 迁移至少一条代表触发链到 DSL，覆盖事件与结构化交互。
- [x] 2.5 更新规则/开发指南，禁止新能力重复手写 effectContract/读写清单。
- [x] 2.6 将 Fairies/Titania OR 分支接入 option 级真实资源 footprint，确保分支选择仍走正常 UI 交互。
- [x] 2.7 将 Fairies/Puck、Magic Acorns、Fairy Ballet 与 Fairy Ring 主要 OR 分支接入 DSL primitive / option 级真实 footprint。
- [x] 2.8 删除旧 TriggerEffectContract / ReactionOrderingAtom 抽象桶类型、运行时包裹器与注册参数；结算顺序只吃真实 ResourceFootprint / runtime artifact / fallbackFootprint。

## 3. Verification
- [x] 3.1 补/改 Vitest，证明 primitive footprint 与执行产物一致。
- [x] 3.2 复跑 Smash Up 反应排序聚焦测试。
- [x] 3.3 复跑代表 E2E 并看截图。
- [x] 3.4 更新 evidence 与长期任务状态。
- [x] 3.5 复跑 Titania OR 端到端用例并看截图，确认初始分支 → 场上选择 → 剩余分支+跳过 → 收口。
- [x] 3.6 复跑 Fairy Ring OR 端到端用例并看截图，确认基地 OR 同样先执行已选分支，再给剩余分支与跳过。
- [x] 3.7 复跑结算顺序定向 Vitest，覆盖基地、ongoing、回合开始/结束、onMinionPlayed、onMinionDiscardedFromBase 与 footprint 推导。
