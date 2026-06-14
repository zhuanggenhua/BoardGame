# 文档索引与使用时机

> 按场景查找需要阅读的文档。

| 场景 / 行为 | 必须阅读的文档 | 关注重点 |
| :--- | :--- | :--- |
| **新增/修改 ActionLog 伤害来源标注** (breakdown/来源显示) | `docs/ai-rules/engine-systems.md` § ActionLogSystem 使用规范 → 伤害来源标注 | 实现 `DamageSourceResolver`，调用 `buildDamageBreakdownSegment` 或 `buildDamageSourceAnnotation`，禁止手写 breakdown 构建逻辑 |
| **处理资源** (图片/音频/图集/清单) | `docs/tools.md` + `docs/ai-rules/asset-pipeline.md` | 压缩指令、扫描参数、清单校验、图片链路/裁剪规范 |
| **录入业务数据** (图片/规则书/Wiki/截图 → 名称/描述/数值/类型/索引/文案) | `.codex/skill/data-entry-workflow/SKILL.md` + `docs/ai-rules/data-entry.md` | 先通过 skill 进入通用门禁，再按 gameId 路由到专用 workflow；覆盖真相源锁定、核对契约、零猜测 OCR、图片索引录入、先文档后实现 |
| **录入 DiceThrone 角色** (新英雄/单角色图片 intake、裁图、卡牌/Token/骰面录入) | `docs/games/dicethrone/workflows/dicethrone-hero-intake.md` | 角色真相源表、裁图、卡牌合同、manifest、R2/CDN 回查、规则文档与代码同步 |
| **国际化资源架构** (i18n 路径/符号链接/locale) | `docs/i18n-asset-architecture.md` | 方案 B2 架构、符号链接设置、未来迁移计划 |
| **修改 DiceThrone** (文案/资源) | `docs/games/dicethrone/dicethrone-i18n.md` | 翻译 Key 结构、Scheme A 取图函数 |
| **环境配置 / 部署** (端口/同域代理) | `docs/deploy.md` | 端口映射、环境变量、Nginx 参数 |
| **Android App 打包 / 上传 / 原生更新 / OTA / 网站下载入口** | `.codex/skill/android-app-release/SKILL.md` + `docs/mobile-release.md` + `docs/android-app-build.md` | 先分 OTA 还是 native；release 必须正式壳；本地 build 不算完成；发布后必须回查 `latest.json` 并直接下载线上 APK 验 `appId/appName`；不要把“更新下载入口”误升格成“必须部署网站” |
| **本地联机测试** (单人同步调试) | `docs/test-mode.md` | 测试模式开关及其对视角的影响 |
| **编写或修复测试** (Vitest/Playwright) | `docs/automated-testing.md` | 测试库配置、错误码命名规范 |
| **处理不可复现反馈 / 证据式收口** (线上已恢复、当前复现不了、需要判断是否继续深挖) | `docs/automated-testing.md` | 先回原始入口和原环境核对；区分“当前未复现原症状”和“当前证据显示该入口无异常”；除非用户明确要求，否则可按证据收口 |
| **做审计 / 重审 / 为什么没审出来** (审计范围、层级、漏审归因、跨游戏门禁) | `docs/ai-rules/testing-audit.md` + `docs/ai-rules/audit-evidence-template.md` | 先建对象清单，再锁承接语义、触发时机、作用宿主、自动移除/清理与负向断言；漏审先补通用门禁，不要只补单对象 |
| **E2E 与截图验收** (UI 交互、状态注入、真实开房、截图证据) | `docs/ai-rules/e2e-verification.md` + `docs/testing-best-practices.md` | 默认状态注入；真实开房只用于跨入口合同；E2E 汇报必须附截图路径 |
| **E2E 太慢 / 长链拆分 / 从主页起跑是否合理** | `docs/ai-rules/e2e-verification.md` | 先看三板斧、入口分层、组合式验证、时长预算；默认不要把主页漏斗和游戏流程绑成一条巨型 E2E |
| **测试驱动是不是一直在写测试 / 为什么 45 分钟还没推进实现** | `docs/ai-rules/e2e-verification.md` + `docs/automated-testing.md` | 先看“长链不是默认调试循环”“15 分钟定位预算”“先状态注入锁定位点，再做最窄回归” |
| **开发前端 / 新增游戏** (引擎/组件) | `docs/framework/frontend.md` | 系统复用 (Ability/Status)、动画组件、解耦规范 |
| **开发后端 / 数据库** (NestJS/Mongo) | `docs/framework/backend.md` | 模块划分、Socket 网关、存储适配器 |
| **接口调用 / 联调** (REST/WS) | `docs/api/README.md` | 认证方式、分页约定、实时通信事件 |
| **处理系统反馈 / watchdog 自动反馈** | `docs/ai-rules/engine-systems.md` § 在线 AI 决策视图与 watchdog / 系统反馈闭环 | 先判断 feedback 是否足够定位；能定位就修业务；不能定位先补 reason/fingerprint/stateSnapshot/失败命令；业务无 bug 时改 feedback 链本身 |
| **使用 Undo / Fab 功能** | `docs/components/UndoFab.md` | UndoFab 组件的 Props 要求与环境依赖 |
| **新增/修改游戏光标主题** (cursor/光标/鼠标样式) | `docs/ai-rules/global-systems.md` § 光标主题系统 | 自注册流程、形态规范（grabbing 必须握拳）、共享样式模板、设置弹窗交互逻辑 |
| **新增作弊/调试指令** | `docs/debug-tool-refactor.md` | 游戏专属调试配置的解耦注入方式 |
| **粒子特效开发** (Canvas 2D 引擎) | `docs/particle-engine.md` | API、预设字段、性能优化、视觉质量规则、新增检查清单 |
| **新增棋盘特效** (FX 系统) | `docs/ai-rules/animation-effects.md` § 引擎级 FX 系统 | FxRegistry 注册、FxBus push/pushSequence、FxRenderer 适配器、新增流程 |
| **动画数值时序** (HP/damage 跳变) | `docs/ai-rules/engine-systems.md` § 动画表现与逻辑分离规范 | `useVisualStateBuffer` 冻结/释放、`FxLayer.onEffectImpact`、新游戏接入流程 |
| **卡牌特写队列** (其他玩家打出卡牌展示) | `docs/ai-rules/engine-systems.md` § 卡牌特写队列 | `useCardSpotlightQueue` + `CardSpotlightQueue`，EventStream 驱动，点击关闭，队列上限 |
| **多步骤特效编排** (序列特效) | `docs/ai-rules/animation-effects.md` § 序列特效 + `docs/ai-rules/engine-systems.md` § 序列特效 | pushSequence API、delayAfter、cancelSequence、适用场景 |
| **新增/审查游戏机制实现** (技能/Token/事件卡/被动) | `docs/ai-rules/engine-systems.md` § 描述→实现全链路审查 | 拆分描述为原子效果，逐效果检查六层链路，禁止只测注册 |
| **修改 DiceThrone 共享攻击结算** (`targetingRoll` / `withDamage` / `postDamage` / `ATTACK_RESOLVED`) | `docs/games/dicethrone/attack-settlement-invariants.md` | 主伤害单次落地、攻击后续选择不得重放主攻击、奖励骰与攻击后续选择语义拆分 |
| **用户明确裁定 / 与规则书或既有实现偏离的需求** | `docs/user-stories/README.md` | 先把用户描述沉淀为独立真相参考；项目级需求放 `docs/user-stories/project/`，游戏级需求统一放 `docs/games/<gameId>/user-stories/` |
| **新游戏设计阶段** (领域建模/决策点/引擎缺口) | `docs/ai-rules/engine-systems.md` § 领域建模前置审查 | 规则→领域模型→实现，禁止跳过建模；术语映射、决策点识别、引擎缺口分析 |
| **大杀四方 POD 系统** (POD 卡牌/自动映射/数据一致性) | `docs/refactor/pod-system-architecture.md` + `src/games/smashup/rule/POD-SYSTEM.md` | 数据层完整定义不继承，能力层自动映射+选择性覆盖，审计脚本检查一致性 |
| **判断是否有活跃交互 / 阻止手牌操作** (interactionBusy/disableInteraction) | `docs/ai-rules/engine-systems.md` § 框架复用优先 → `useIsInteractionBusy` | 所有"等待玩家输入"走 `sys.interaction`，Board 层用此 Hook 统一判断，禁止自建 UI 状态机 |
| **游戏结束检测** (gameover/胜负判定) | `docs/ai-rules/engine-systems.md` § 游戏结束检测 | `sys.gameover` 唯一来源，管线自动检测，Board 读 `G.sys.gameover`，禁止读 core/ctx |
| **传输层/Board Props** (socket/dispatch/Provider) | `docs/ai-rules/engine-systems.md` § 传输层架构 | `GameBoardProps` 契约，无 `ctx` prop，`dispatch` 命令分发，`GameProvider`/`LocalGameProvider` |
| **乐观更新/延迟优化** (optimistic/latency/预测) | `docs/ai-rules/engine-systems.md` § 乐观更新引擎 | Random Probe 自动检测、AnimationMode、骰子动画最短播放时间（UI 层保护）、EventStream 水位线、pending replay、`latencyConfig.ts` |
| **挑选/查找/对接音效** (查 key、换音效、补预加载、试听收口) | `.codex/skill/audio-integration/SKILL.md` + `docs/audio/audio-usage.md` | 先走项目音频 workflow；skill 负责查找链路、汇报和收口，文档负责架构合同与命令入口 |
| **从外部导入新音效素材** (新增音频资源) | `.codex/skill/audio-integration/SKILL.md` + `docs/audio/add-audio.md` | skill 负责执行步骤与收口；文档负责目录、命名、产物、压缩、registry、中文友好名和 `/dev/audio` 验收合同 |
| **音频不播放 / AudioContext** (浏览器兼容) | `docs/ai-rules/golden-rules.md` § AudioContext | `ctx.resume()` 异步竞态、HTML5 Audio vs WebAudio 区别 |
| **状态同步/存储调优** (16MB 限制) | `docs/mongodb-16mb-fix.md` | 状态裁剪策略、Log 限制、Undo 快照优化 |
| **复杂任务规划** (多文件/长流程) | `D:\codex-home\skills\planning-with-files\SKILL.md` | 必须维护 `task_plan.md`，定期转存 `findings.md` |
| **AI 规范文档整理** (压缩根 AGENTS、拆分大文档、去重但不丢内容) | `docs/ai-rules/document-consolidation.md` + `.codex/skill/README.md` | 统一到单一入口；记录来源、目标、语义变化和冲突裁决 |
| **根 AGENTS 该写到什么粒度** (渐进式披露 / 路由优先 / 只保留触发入口) | `docs/ai-rules/document-consolidation.md` + 本文件 | 根文件只保留“何时触发、先看哪里、哪些红线不能越过”；细节下沉到二级文档 |
| **向用户索要保留/合并/真相源拍板** (是不是二选一、能不能都保留、哪边先翻正) | `.codex/skill/merge-decision-package/SKILL.md` + `AGENTS.md` §1.1 | 先回答能不能都保留；按正式实现/候选实现/过程材料拆开；结论先行，用户只需决定一句话 |
| **UI/UX 设计** (配色/组件/动效) | `.codex/skill/ui-ux-pro-max/SKILL.md` | 这是 BoardGame 的 UI/UX overlay；先走全局 `ui-ux-pro-max`，再叠加项目设计系统与验收口径 |
| **生图设计稿 → 实现设计稿** (AI 生成 UI mockup 后按图实现/复刻) | `docs/ai-rules/generated-design-implementation.md` + `docs/ai-rules/ui-ux.md` | 真实内容盘点、禁止无中生有、目标稿复看、关键几何比例量测、E2E 截图证据 |
| **Home V2 移动横屏首页/详情/弹窗** (Home V2 书本界面、移动端专用首页、详情页、纸面弹窗) | `docs/ai-rules/home-v2-design.md` + `docs/ai-rules/generated-design-implementation.md` + `docs/ai-rules/ui-ux.md` | `artifacts/home-v2-design/` 目标稿优先、移动 CSS 视口、书页构图、详情页缩略图/描述/账本密度、纸面弹窗统一 |
| **大规模 UI 改动** (新页面/重做布局/新游戏UI) | 先 Skill `--design-system`，再 `design-system/` | 见 §UI/UX 规范 → §0. 大规模 UI 改动前置流程 |
| **游戏内 UI 交互** (按钮/面板/指示器) | `design-system/game-ui/MASTER.md` | 交互原则、反馈规范、动画时长、状态清晰 |
| **游戏 UI 风格选择** | `design-system/styles/` | arcade-3d（街机立体）、tactical-clean（战术简洁）、classic-parchment（经典羊皮纸） |
| **创建临时文件 / 清理根目录** (Bug 分析/测试脚本/Wiki 数据) | `docs/temp-files-management.md` | 临时文件分类规则、目录结构、.gitignore 规则、开发规范 |
