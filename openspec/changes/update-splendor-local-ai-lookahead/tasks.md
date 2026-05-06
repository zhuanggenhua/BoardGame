## 1. Splendor AI 架构迁移
- [ ] 1.1 将 `easy` / `normal` 迁移为 scorer-only 的 `createLookaheadLocalAiPolicy`
- [ ] 1.2 将 `hard` / `expert` 迁移为带 projection 的 `createLookaheadLocalAiPolicy`
- [ ] 1.3 保持 `baseline` 按 difficulty 路由的现有行为

## 2. 启发式与可见态投影
- [ ] 2.1 扩展 `SplendorFeatureSnapshot`，补齐阶段、贵族 gap、稀缺度、溢出风险与 target 派生视图
- [ ] 2.2 重做目标卡、拿宝石、预留、丢弃、终局与贵族 scorer
- [ ] 2.3 将 Splendor 动作投影升级为完整可见态 projection，并为 `expert` 增加 follow-up 评估

## 3. 回归与验证
- [ ] 3.1 保持现有 Splendor AI 测试通过
- [ ] 3.2 新增目标卡偏置、discard 偏好、projection trace 与 hidden-info 保守性测试
- [ ] 3.3 验证 `easy < normal < hard < expert` 的整体强度顺序不反转
