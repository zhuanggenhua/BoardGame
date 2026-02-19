# 文档索引与使用时机

> 按场景查找需要阅读的文档。

| 场景 / 行为 | 必须阅读的文档 | 关注重点 |
| :--- | :--- | :--- |
| **新增/修改 ActionLog 伤害来源标注** (breakdown/来源显示) | `docs/ai-rules/engine-systems.md` § ActionLogSystem 使用规范 → 伤害来源标注 | 实现 `DamageSourceResolver`，调用 `buildDamageBreakdownSegment` 或 `buildDamageSourceAnnotation`，禁止手写 breakdown 构建逻辑 |
| **处理资源** (图片/音频/图集/清单) | `docs/tools.md` | 压缩指令、扫描参数、清单校验 |
| **国际化资源架构** (i18n 路径/符号链接/locale) | `docs/i18n-asset-architecture.md` | 方案 B2 架构、符号链接设置、未来迁移计划 |
| **修改 DiceThrone** (文案/资源) | `docs/dicethrone-i18n.md` | 翻译 Key 结构、Scheme A 取图函数 |
| **环境配置 / 部署** (端口/同域代理) | `docs/deploy.md` | 端口映射、环境变量、Nginx 参数 |
| **本地联机测试** (单人同步调试) | `docs/test-mode.md` | 测试模式开关及其对视角的影响 |
| **编写或修复测试** (Vitest/Playwright) | `docs/automated-testing.md` | 测试库配置、错误码命名规范 |
| **开发前端 / 新增游戏** (引擎/组件) | `docs/framework/frontend.md` | 系统复用 (Ability/Status)、动画组件、解耦规范 |
| **开发后端 / 数据库** (NestJS/Mongo) | `docs/framework/backend.md` | 模块划分、Socket 网关、存储适配器 |
| **接口调用 / 联调** (REST/WS) | `docs/api/README.md` | 认证方式、分页约定、实时通信事件 |
| **使用 Undo / Fab 功能** | `docs/components/UndoFab.md` | UndoFab 组件的 Props 要求与环境依赖 |
| **新增作弊/调试指令** | `docs/debug-tool-refactor.md` | 游戏专属调试配置的解耦注入方式 |
| **粒子特效开发** (Canvas 2D 引擎) | `docs/particle-engine.md` | API、预设字段、性能优化、视觉质量规则、新增检查清单 |
| **新增棋盘特效** (FX 系统) | `docs/ai-rules/animation-effects.md` § 引擎级 FX 系统 | FxRegistry 注册、FxBus push/pushSequence、FxRenderer 适配器、新增流程 |
| **动画数值时序** (HP/damage 跳变) | `docs/ai-rules/engine-systems.md` § 动画表现与逻辑分离规范 | `useVisualStateBuffer` 冻结/释放、`FxLayer.onEffectImpact`、新游戏接入流程 |
| **卡牌特写队列** (其他玩家打出卡牌展示) | `docs/ai-rules/engine-systems.md` § 卡牌特写队列 | `useCardSpotlightQueue` + `CardSpotlightQueue`，EventStream 驱动，点击关闭，队列上限 |
| **多步骤特效编排** (序列特效) | `docs/ai-rules/animation-effects.md` § 序列特效 + `docs/ai-rules/engine-systems.md` § 序列特效 | pushSequence API、delayAfter、cancelSequence、适用场景 |
| **新增/审查游戏机制实现** (技能/Token/事件卡/被动) | `docs/ai-rules/engine-systems.md` § 描述→实现全链路审查 | 拆分描述为原子效果，逐效果检查六层链路，禁止只测注册 |
| **新游戏设计阶段** (领域建模/决策点/引擎缺口) | `docs/ai-rules/engine-systems.md` § 领域建模前置审查 | 规则→领域模型→实现，禁止跳过建模；术语映射、决策点识别、引擎缺口分析 |
| **判断是否有活跃交互 / 阻止手牌操作** (interactionBusy/disableInteraction) | `docs/ai-rules/engine-systems.md` § 框架复用优先 → `useIsInteractionBusy` | 所有"等待玩家输入"走 `sys.interaction`，Board 层用此 Hook 统一判断，禁止自建 UI 状态机 |
| **游戏结束检测** (gameover/胜负判定) | `docs/ai-rules/engine-systems.md` § 游戏结束检测 | `sys.gameover` 唯一来源，管线自动检测，Board 读 `G.sys.gameover`，禁止读 core/ctx |
| **传输层/Board Props** (socket/dispatch/Provider) | `docs/ai-rules/engine-systems.md` § 传输层架构 | `GameBoardProps` 契约，无 `ctx` prop，`dispatch` 命令分发，`GameProvider`/`LocalGameProvider` |
| **乐观更新/延迟优化** (optimistic/latency/预测) | `docs/ai-rules/engine-systems.md` § 乐观更新引擎 | Random Probe 自动检测、AnimationMode、EventStream 水位线、pending replay、`latencyConfig.ts` |
| **挑选/查找音效** (音效定位) | `docs/audio/audio-catalog.md` | 语义目录，按关键词搜索定位 registry key |
| **音频不播放 / AudioContext** (浏览器兼容) | `docs/ai-rules/golden-rules.md` § AudioContext | `ctx.resume()` 异步竞态、HTML5 Audio vs WebAudio 区别 |
| **状态同步/存储调优** (16MB 限制) | `docs/mongodb-16mb-fix.md` | 状态裁剪策略、Log 限制、Undo 快照优化 |
| **复杂任务规划** (多文件/长流程) | `.agent/skills/planning-with-files/SKILL.md` | 必须维护 `task_plan.md`，定期转存 `findings.md` |
| **UI/UX 设计** (配色/组件/动效) | `.agent/skills/ui-ux-pro-max/SKILL.md` | 使用 `python3 ... search.py` 生成设计系统与样式 |
| **大规模 UI 改动** (新页面/重做布局/新游戏UI) | 先 Skill `--design-system`，再 `design-system/` | 见 §UI/UX 规范 → §0. 大规模 UI 改动前置流程 |
| **游戏内 UI 交互** (按钮/面板/指示器) | `design-system/game-ui/MASTER.md` | 交互原则、反馈规范、动画时长、状态清晰 |
| **游戏 UI 风格选择** | `design-system/styles/` | arcade-3d（街机立体）、tactical-clean（战术简洁）、classic-parchment（经典羊皮纸） |
