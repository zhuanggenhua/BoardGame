## 1. 设计与契约
- [x] 1.1 定义在线 AI 决策视图模型：authoritative shared + private overlay
- [x] 1.2 定义默认决策可见性推断规则（shared / private-required / 可选覆盖）
- [x] 1.3 明确客户端桥接层与服务端 watchdog 的统一语义边界

## 2. 框架实现
- [x] 2.1 抽出共享的在线 AI 决策视图 helper，避免 `MatchRoom` 内部散落状态新鲜度判断
- [x] 2.2 改造 `resolveNextAiAction` / 客户端 `visibleStateResolver` 使用统一决策视图
- [x] 2.3 改造服务端 recovery / legal-action recovery 使用统一决策视图语义
- [x] 2.4 保持 stale-seat 保护：私有决策仍不得使用过期 seat overlay 抢跑

## 3. 测试
- [x] 3.1 补 Vitest：公开 setup 决策在 seat stale 时仍可基于 sharedState 继续
- [x] 3.2 补 Vitest：私有决策在 seat stale 时仍必须被阻止
- [x] 3.3 补 Vitest：服务端 watchdog / legal-action recovery 与客户端桥接层遵循同一视图语义
- [x] 3.4 运行相关测试与静态检查

## 4. 文档
- [x] 4.1 更新 `.spec/knowledge/standards/engine-systems.md`，新增在线 AI 决策视图规范
- [x] 4.2 记录本轮架构调整证据与回归说明
- [x] 4.3 运行 `openspec validate refactor-online-ai-decision-visibility --strict --no-interactive`
