## 1. 设计落地
- [x] 新增 TutorialSystem（EngineSystem 插件），扩展 SystemState.tutorial
- [x] 定义 tutorial 系统命令/事件（SYS_TUTORIAL_START/STEP_CHANGED/AI_CONSUMED 等）
- [x] Adapter 包装 RandomFn（读取 sys.tutorial.randomPolicy）

## 2. UI/Manifest 迁移
- [x] TutorialOverlay 读取 G.sys.tutorial.step 渲染
- [x] 移除 TutorialContext 或改为只读兼容层
- [x] DiceThrone tutorial manifest 迁移为事件驱动 + 随机策略

## 3. 测试与验证
- [ ] 新增 TutorialSystem 单测（启动/推进/拦截/随机策略）
- [ ] 调整 dicethrone 教程 E2E 用例验证固定骰子
- [ ] 本地验证教程路由完整流程
