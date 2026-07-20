# 文档索引与使用时机

> 按场景查找需要阅读的文档。

| 场景 / 行为 | 必须阅读的文档 | 关注重点 |
| :--- | :--- | :--- |
| **新增/修改 ActionLog 伤害来源标注** (breakdown/来源显示) | `docs/ai-rules/engine-action-log.md` § 伤害来源标注 | 实现 `DamageSourceResolver`，调用 `buildDamageBreakdownSegment` 或 `buildDamageSourceAnnotation`，禁止手写 breakdown 构建逻辑 |
| **处理资源** (图片/音频/图集/清单) | `docs/tools.md` + `docs/ai-rules/asset-pipeline.md` + `docs/ai-rules/critical-image-preload.md` + `docs/ai-rules/audio-assets.md` | 压缩指令、正式对局素材禁止降采样、扫描参数、清单校验、图片链路/裁剪规范、正式素材优先、禁止未授权用占位/自绘替代、关键图片预加载、音频运行时合同 |
| **需求交接式安全图片处理 / 视觉子代理 / OCR / 图集裁图核对** (图片文字读取、卡图/房间图规则录入、图片验收、读图卡死后继续任务) | `.codex/skill/safe-image-reading/SKILL.md` + `.codex/skill/data-entry-workflow/SKILL.md` | 主线程把用户当前需求、业务对象、图片需要补足的字段/判断点和结果用途交给短子代理或本地 OCR；录入需求返回官方原文、原子子句、结构化规则字段并写入 evidence/真相表；验收/对比需求只返回是否满足用户预期、失败点和最小证据；不得返回 base64/markdown 图片，也不得产出无关过程说明 |
| **新增派系 / 新英雄 / 新角色** (从素材做到可玩、含录入/资源/机制/审计/E2E) | `.codex/skill/add-new-faction/SKILL.md` + `.codex/skill/data-entry-workflow/SKILL.md` | 这是新增批次的默认入口；先走项目 skill，再按 `gameId` 进入专项 workflow；默认包含对象级全面审计、evidence 留档与真实入口 E2E，不需要等用户额外提醒 |
| **录入业务数据** (图片/规则书/Wiki/截图 → 名称/描述/数值/类型/索引/文案) | `.codex/skill/data-entry-workflow/SKILL.md` + `docs/ai-rules/data-entry.md` | 先通过 skill 进入通用门禁，再按 gameId 路由到专用 workflow；覆盖真相源锁定、核对契约、零猜测 OCR、图片索引录入、先文档后实现 |
| **录入 DiceThrone 角色** (新英雄/单角色图片 intake、裁图、卡牌/Token/骰面录入) | `.codex/skill/add-new-faction/SKILL.md` + `.codex/skill/data-entry-workflow/SKILL.md` + `docs/games/dicethrone/workflows/dicethrone-hero-intake.md` | Dice Throne 新英雄默认先走两个项目 skill，再进入英雄 intake workflow；对象级审计、manifest、服务器素材主源回查、规则文档与代码同步属于同一交付 |
| **国际化资源架构** (i18n 路径/符号链接/locale) | `docs/i18n-asset-architecture.md` | 方案 B2 架构、符号链接设置、未来迁移计划 |
| **修改 DiceThrone** (文案/资源) | `docs/games/dicethrone/dicethrone-i18n.md` | 翻译 Key 结构、Scheme A 取图函数 |
| **环境配置 / 部署** (端口/同域代理) | `docs/deploy.md` | 端口映射、环境变量、Nginx 参数 |
| **协作者接入 Figma MCP** (Codex / OpenClaw 缺少 Figma 工具、首次授权、凭据失效、重启后仍不可用) | `docs/infra/figma-mcp.md` | 仓库脚本是唯一真相源；默认只补配置，显式 `-Login` 才重授权；`CODEX_HOME` 只存每人自己的配置和凭据 |
| **Android App 打包 / 上传 / 原生更新 / OTA / 网站下载入口** | `.codex/skill/android-app-release/SKILL.md` + `docs/mobile-release.md` + `docs/android-app-build.md` | 先分 OTA 还是 native；release 必须正式壳；本地 build 不算完成；发布后必须回查 `latest.json` 并直接下载线上 APK 验 `appId/appName`；不要把“更新下载入口”误升格成“必须部署网站” |
| **移动端素材包下载/清理/校验失败** (增量校验失败、本地临时文件校验失败、清理并重下仍失败) | `.codex/skill/android-app-release/SKILL.md` + `docs/mobile-release.md` + `docs/ai-rules/asset-pipeline.md` | 先回到真实移动素材包链路，锁 H5 清理、服务层安装模式、原生桥参数和原生日志；清理重下必须证明下一次安装已切完整 ZIP，发布 OTA 后必须下载线上 OTA zip 反查修复代码，缺少原始失败位点日志时不得宣称彻底修好 |
| **本地联机测试** (单人同步调试) | `docs/test-mode.md` | 测试模式开关及其对视角的影响 |
| **编写或修复测试** (Vitest/Playwright) | `docs/automated-testing.md` | 测试库配置、错误码命名规范 |
| **处理线上反馈 / 回写反馈状态** (open/in_progress/resolved/closed、修完立刻回写、区分反馈状态与部署状态) | `.codex/skill/feedback-closeout/SKILL.md` | `.codex/skill/feedback-closeout/SKILL.md` 是唯一规范真相源；只有实际需要 SSH/Mongo 入口时，再从 skill 路由到 `C:\Users\zhuagenbao\docs\服务器连接与生产部署入口.md` |
| **修改反馈提交入口 / 登录态 / 匿名提交** (`POST /feedback`、反馈弹窗、可选 JWT、失效 token) | `docs/ai-rules/feedback-system.md` | 玩家提交反馈是公共通道；登录只用于绑定用户和反馈积分，缺失/失效登录态必须按匿名提交继续，不得卡住反馈 |
| **处理不可复现反馈 / 证据式收口** (线上已恢复、当前复现不了、需要判断是否继续深挖) | `docs/automated-testing.md` | 先回原始入口和原环境核对；区分“当前未复现原症状”和“当前证据显示该入口无异常”；除非用户明确要求，否则可按证据收口 |
| **修规则 bug / 规则回归 / 等级效果不一致** (卡牌、技能、Token、状态、阶段、伤害、资源、升级版/基础版差异) | `.codex/skill/rule-bug-fix-workflow/SKILL.md` + `docs/ai-rules/rule-contract-audit.md` + `docs/ai-rules/regression-closeout.md` | 第一门禁是判断已有录入合同是否被实现正确消费；只有合同缺失、未锁或与反馈冲突才回图面/规则源；修复必须同步回写中文/英文描述、静态定义、测试和 evidence；回归收口必须说明同类扩审与漏审原因 |
| **从 TTS / 外部脚本 / 旧平台实现还原规则或 UI** (Lua、Workshop JSON、解包资产、旧脚本、配置按钮、自动提示、规则变体) | `docs/ai-rules/rule-contract-audit.md` § 外部脚本 / TTS 还原零猜测门禁 + `docs/ai-rules/ui-change-gates.md` | 先建脚本锚点、资产/UI锚点、当前实现、差异结论、状态矩阵；没有可定位证据只能标 `blocked/disputed`，不得凭“应该/看起来像/肯定有”实装成正式规则或 UI；涉及用户可见 UI 时仍必须真实入口 E2E 和截图 |
| **做审计 / 重审 / 为什么没审出来** (审计范围、层级、漏审归因、跨游戏门禁) | `docs/ai-rules/testing-audit.md` + `docs/ai-rules/testing-audit-core-principles.md` + `docs/ai-rules/testing-audit-dimensions.md` + `docs/ai-rules/audit-evidence-template.md` + `docs/ai-rules/regression-closeout.md` | 先读入口和核心原则，过 fail-close 门禁：最终权威状态、流程收口、共享链来源、来源例外；再按 D 维度库选择适用维度，建对象清单、锁承接语义、触发时机、作用宿主、自动移除/清理与负向断言；凡要写“全面审计/已收口/full_audit”必须在审计后运行 `npm run audit:evidence:selfcheck -- <evidence 文件>` 并把结果写回 evidence；该自检不默认阻塞发布；漏审复盘按回归收口文档归因，不要只补单对象 |
| **处理 UI 回归恢复 / 功能开关双分支** (改回原来、默认关闭必须完全旧实现、开启后新体验单独成立、不能混用) | `docs/ai-rules/e2e-verification.md` + `docs/ai-rules/ui-change-gates.md` + `docs/ai-rules/ui-ux.md` | 先锁 `last known good / first known bad`，直接阅读并恢复旧代码；若当前已混在同一组件里，先把关闭态拆回旧合同，再挂开启态；关闭态与开启态按两份并列正式合同实现和验收，只允许共享非视觉适配层 |
| **重构共享层 / 通用化 / 收口 helper / 为什么重构改坏功能** (shared helper、watchdog、transport、response-window、跨游戏 override) | `docs/ai-rules/shared-refactor-guard.md` + `docs/ai-rules/testing-audit.md` + `docs/ai-rules/testing-audit-core-principles.md` + `docs/ai-rules/testing-audit-dimensions.md` | 先锁旧语义、消费者矩阵、override 边界与 fallback 顺序；按核心原则和 D 维度库选择共享抽象、时序、状态消费、UI 消费等适用维度；禁止把游戏特化语义退回共享默认 |
| **E2E 与截图验收** (UI 交互、状态注入、真实开房、截图证据、用户直接要截图、AI 自己核图、服务器相册交付) | `docs/ai-rules/e2e-verification.md` + `docs/testing-best-practices.md` + `D:\codex-home\skills\artifact-preview-publisher\SKILL.md` | 默认状态注入；真实开房只用于跨入口合同；牌翻出/选择/投骰/结算/关闭类流程必须走六段链、六段截图、四列表和用户目标矩阵；投骰结果默认验空白关闭，可改骰时必须验空白关闭禁用和明确交互入口，阻塞式投骰未确认前不得推进行动权，必须验当前行动者仍是投骰玩家，确认/关闭后才验证下一位可操作；用户要截图时禁止拿合成图/临时图/辅助图冒充真实截图；AI 核图前先过图片上下文预算门禁；最终 E2E 截图默认发布到服务器任务相册并返回详情链接 |
| **教程 / 新手引导设计** (tutorial/onboarding、教程看不懂、只在教按钮、需要重做教学结构) | `.codex/skill/tutorial-workflow/SKILL.md` + `docs/ai-rules/tutorial-design.md` + `.codex/skill/game-audit-workflow/SKILL.md` + `docs/ai-rules/e2e-verification.md` | 先读该游戏规则真相源，再走教程 workflow：先出完整文案，用户确认后才实施；再核目标、收益、真实案例、计分因果、真实交互与截图证据 |
| **打开图片 / 给我看图 / 截图真正打开到本机 / 读图卡死** | `.codex/skill/screenshot-delivery/SKILL.md` + `docs/ai-rules/e2e-verification.md` | 先区分 AI 核图和用户开图；`view_image` / `Viewed Image` 只算 AI 看图，不算打开；AI 自己看图必须先检查大小/尺寸/数量，必要时只读轻量预览/OCR/contact sheet；用户说“打开图/我自己看”则直接用 `npm run verify:open-image` 或系统图片查看器打开目标图，回复附成功证据和绝对路径 |
| **首屏关键素材 / 图片预加载** (为什么没素材进度、为什么首帧抖动、atlas/牌背/桌面图是否必须预热) | `docs/ai-rules/critical-image-preload.md` + `docs/ai-rules/asset-pipeline.md` | 只要首屏依赖正式图片就必须配 `criticalImageResolver.ts`；真实房间页要能走到 `loadingAssets`；不要把“有图片资源”误当成“已配置首屏关键素材” |
| **E2E 太慢 / 长链拆分 / 从主页起跑是否合理** | `docs/ai-rules/e2e-verification.md` | 先看三板斧、入口分层、组合式验证、时长预算；默认不要把主页漏斗和游戏流程绑成一条巨型 E2E |
| **测试驱动是不是一直在写测试 / 为什么 45 分钟还没推进实现** | `docs/ai-rules/e2e-verification.md` + `docs/automated-testing.md` | 先看“长链不是默认调试循环”“15 分钟定位预算”“先状态注入锁定位点，再做最窄回归” |
| **开发前端 / 新增游戏** (引擎/组件) | `docs/framework/frontend.md` | 系统复用 (Ability/Status)、动画组件、解耦规范 |
| **开发后端 / 数据库** (NestJS/Mongo) | `docs/framework/backend.md` | 模块划分、Socket 网关、存储适配器 |
| **接口调用 / 联调** (REST/WS) | `docs/api/README.md` | 认证方式、分页约定、实时通信事件 |
| **处理系统反馈 / watchdog 自动反馈** | `docs/ai-rules/engine-systems.md` § 在线 AI 决策视图与 watchdog / 系统反馈闭环 | 先判断 feedback 是否足够定位；能定位就修业务；不能定位先补 reason/fingerprint/stateSnapshot/失败命令；业务无 bug 时改 feedback 链本身 |
| **AI 接入 / AI 适配 / 自动回合 / watchdog / 自动跳过** | `.codex/skill/game-ai-adaptation/SKILL.md` + `docs/ai-rules/ui-ux.md` | 先区分可见动作与静默动作；不改延迟时也必须补等待归属、唯一下一步入口、最小状态反馈与真实页面证据 |
| **使用 Undo / Fab 功能** | `docs/components/UndoFab.md` | UndoFab 组件的 Props 要求与环境依赖 |
| **新增/修改游戏光标主题** (cursor/光标/鼠标样式) | `docs/ai-rules/global-systems.md` § 光标主题系统 | 自注册流程、形态规范（grabbing 必须握拳）、共享样式模板、设置弹窗交互逻辑 |
| **新增作弊/调试指令** | `docs/debug-tool-refactor.md` | 游戏专属调试配置的解耦注入方式 |
| **粒子特效开发** (Canvas 2D 引擎) | `docs/particle-engine.md` | API、预设字段、性能优化、视觉质量规则、新增检查清单 |
| **新增棋盘特效** (FX 系统) | `docs/ai-rules/animation-effects.md` § 引擎级 FX 系统 | FxRegistry 注册、FxBus push/pushSequence、FxRenderer 适配器、新增流程 |
| **动画数值时序** (HP/damage 跳变) | `docs/ai-rules/engine-visual-events.md` § 动画表现与逻辑分离规范 | `useVisualStateBuffer` 冻结/释放、`FxLayer.onEffectImpact`、新游戏接入流程 |
| **卡牌 / 技能展示型特写** (其他玩家打出卡牌、展示卡牌、对手进攻技能或升级卡展示) | `docs/ai-rules/engine-visual-events.md` § 卡牌特写队列 + `docs/ai-rules/ui-ux.md` § 对手卡牌 / 技能展示型特写不得瞬时退场 | `useCardSpotlightQueue` + `CardSpotlightQueue`，EventStream 驱动，明确关闭按钮关闭，队列上限；游戏自建卡牌特写和技能特写也必须超过旧自动关闭时间仍可见，不能只修其中一套 |
| **多步骤特效编排** (序列特效) | `docs/ai-rules/animation-effects.md` § 序列特效 + `docs/ai-rules/engine-visual-events.md` | pushSequence API、delayAfter、cancelSequence、适用场景 |
| **新增/审查游戏机制实现** (技能/Token/事件卡/被动/主动开发或全面审查) | `docs/ai-rules/description-to-implementation-audit.md` + `docs/ai-rules/engine-systems.md` | 新增或主动审查机制时，先锁权威描述并拆成原子断言；逐交互链检查定义、注册、执行、状态、消耗、验证、UI、i18n、测试。玩家反馈的规则 bug 优先走上方规则 bug 修复 workflow |
| **修改 DiceThrone 共享攻击结算** (`targetingRoll` / `withDamage` / `postDamage` / `ATTACK_RESOLVED`) | `docs/games/dicethrone/attack-settlement-invariants.md` + `docs/games/dicethrone/token-active-use-custom-action.md` | 主伤害单次落地、攻击后续选择不得重放主攻击、奖励骰与攻击后续选择语义拆分；Token 主动使用依赖 custom action 时必须显式声明 |
| **修改 DiceThrone 卡牌时机 / 手牌可用性 / 改骰即时牌** (红色即时牌、黄色防御阶段牌、进攻/防御掷骰、响应窗口、修改自己或对方骰子) | `docs/games/dicethrone/card-timing-terms.md` + `docs/ai-rules/rule-contract-audit.md` | 先拆清卡牌颜色、使用窗口、效果目标、阶段归属和现实操作者；红色即时牌不等于防御阶段牌，“就这？”这类描述限定防御投掷阶段的牌按黄色防御阶段牌处理 |
| **用户明确裁定 / 与规则书或既有实现偏离的需求** | `docs/user-stories/README.md` | 先把用户描述沉淀为独立真相参考；项目级需求放 `docs/user-stories/project/`，游戏级需求统一放 `docs/games/<gameId>/user-stories/` |
| **新游戏设计阶段** (领域建模/决策点/引擎缺口) | `docs/ai-rules/engine-systems.md` § 领域建模前置审查 + `docs/ai-rules/engine-ability-framework.md` | 规则→领域模型→实现，禁止跳过建模；术语映射、决策点识别、引擎能力缺口分析；能力/约束系统读专项文档 |
| **大杀四方 POD 系统** (POD 卡牌/自动映射/数据一致性) | `docs/refactor/pod-system-architecture.md` + `src/games/smashup/rule/POD-SYSTEM.md` | 数据层完整定义不继承，能力层自动映射+选择性覆盖，审计脚本检查一致性 |
| **大杀四方消灭触发链 / pendingSave** (`processDestroyTriggers` / `PREVENT_DESTROY_SOURCE_IDS` / 防止消灭交互) | `docs/games/smashup/destroy-pending-save.md` + `src/games/smashup/rule/ENGINE_GUIDE.md` | onDestroy 与防止消灭交互顺序、pendingSave 白名单合同、matchState 链式传递；不要把 SmashUp 当前 runtime 例外提升成跨游戏通用规则 |
| **判断是否有活跃交互 / 阻止手牌操作** (interactionBusy/disableInteraction) | `docs/ai-rules/engine-systems.md` § 框架复用优先 → `useIsInteractionBusy` | 所有"等待玩家输入"走 `sys.interaction`，Board 层用此 Hook 统一判断，禁止自建 UI 状态机 |
| **游戏结束检测** (gameover/胜负判定) | `docs/ai-rules/engine-gameover.md` | `sys.gameover` 唯一来源，管线自动检测，Board 读 `G.sys.gameover`，禁止读 core/ctx |
| **传输层/Board Props** (socket/dispatch/Provider) | `docs/ai-rules/engine-transport.md` | `GameBoardProps` 契约，无 `ctx` prop，`dispatch` 命令分发，`GameProvider`/`LocalGameProvider` |
| **乐观更新/延迟优化** (optimistic/latency/预测) | `docs/ai-rules/engine-transport.md` + `docs/ai-rules/engine-visual-events.md` | Random Probe 自动检测、AnimationMode、骰子动画最短播放时间（UI 层保护）、EventStream 水位线、pending replay、`latencyConfig.ts` |
| **挑选/查找/对接音效** (查 key、换音效、补预加载、试听收口) | `.codex/skill/audio-integration/SKILL.md` + `docs/ai-rules/audio-assets.md` + `docs/audio/audio-usage.md` | 先走项目音频 workflow；skill 负责查找链路、汇报和收口，文档负责运行时合同、架构合同与命令入口 |
| **从外部导入新音效素材** (新增音频资源) | `.codex/skill/audio-integration/SKILL.md` + `docs/ai-rules/audio-assets.md` + `docs/audio/add-audio.md` | skill 负责执行步骤与收口；文档负责目录、命名、产物、压缩、registry、运行时合同、中文友好名和 `/dev/audio` 验收合同 |
| **音频不播放 / AudioContext** (浏览器兼容) | `docs/ai-rules/golden-rules.md` § AudioContext | `ctx.resume()` 异步竞态、HTML5 Audio vs WebAudio 区别 |
| **状态同步/存储调优** (16MB 限制) | `docs/mongodb-16mb-fix.md` | 状态裁剪策略、Log 限制、Undo 快照优化 |
| **复杂任务规划** (多文件/长流程) | `D:\codex-home\skills\planning-with-files\SKILL.md` | 必须维护 `task_plan.md`，定期转存 `findings.md` |
| **对话接续 / 交接摘要 / 上下文压缩后继续** (继续、接上、交接摘要冲突、临时覆盖矩阵接管目标) | `docs/ai-rules/conversation-handoff-target-lock.md` | 摘要和计划只作候选线索；接续前必须锁问题对象、真相来源、目标入口/环境、验收口径；与用户当前主线冲突时立即停线，不得按摘要继续实施 |
| **AI 规范文档整理** (压缩根 AGENTS、拆分大文档、去重但不丢内容) | `docs/ai-rules/document-consolidation.md` + `.codex/skill/README.md` | 统一到单一入口；记录来源、目标、语义变化和冲突裁决 |
| **根 AGENTS 该写到什么粒度** (渐进式披露 / 路由优先 / 只保留触发入口) | `docs/ai-rules/document-consolidation.md` + 本文件 | 根文件只保留“何时触发、先看哪里、哪些红线不能越过”；细节下沉到二级文档 |
| **向用户索要保留/合并/真相源拍板** (是不是二选一、能不能都保留、哪边先翻正) | `.codex/skill/merge-decision-package/SKILL.md` + `AGENTS.md` §1.1 | 先回答能不能都保留；按正式实现/候选实现/过程材料拆开；结论先行，用户只需决定一句话 |
| **UI/UX 设计** (配色/组件/动效) | `D:\codex-home\skills\ui-design-pipeline\SKILL.md` + `D:\codex-home\skills\ui-ux-pro-max\SKILL.md` + `docs/ai-rules/ui-change-gates.md` + `docs/ai-rules/ui-ux.md` + `docs/ai-rules/ui-animation-patterns.md` | 复杂 UI 先走 Design I/O 链路产出设计声明、执行契约和 evaluator；再用全局 `ui-ux-pro-max` 与 BoardGame overlay 补设计系统、组件规则、动画触发合同与验收口径 |
| **UI 审计 / 玩家视角验收 / 没过继续重构** (看图后判断好不好用、反复低级 UI 错误、不能只靠 E2E 绿灯) | `docs/ai-rules/ui-change-gates.md` § `UI 审计闭环` + `docs/ai-rules/ui-ux.md` + `D:\codex-home\skills\ui-ux-pro-max\SKILL.md` | 必须基于当前真实入口整屏截图照填审计表；任一项失败就保持 `in_progress`，回同一位点重构、重截图、重审计；最终必须说清玩家第一眼会怎么行动 |
| **新游戏位图设计稿 / 设计批准门禁** (先看图、先出 PNG/JPG/WebP、批准后才进骨架/前端) | `D:\codex-home\skills\ui-design-pipeline\SKILL.md` + `.codex/skill/boardgame-ui-imagegen/SKILL.md` + `.codex/skill/create-new-game/SKILL.md` | 阶段 0 锁定规则/素材/布局真相源后，先用 Design I/O 产出新游戏 UI 声明与 evaluator；设计稿默认是图片不是页面；Step1 结构、Step2 布局收敛、Step3 风格、Step4 分界面逐步批准；设计稿未批前不得启动服务、不得写运行页；前端实现必须等骨架完成 |
| **游戏主交互槽位 / 手牌区 / waiting / prompt / rail 抢位** (主交互被挤压、双主焦点、来源家族、交互壳层重排) | `docs/ai-rules/ui-change-gates.md` + `docs/ai-rules/ui-responsive-layout.md` + `design-system/game-ui/MASTER.md` + `D:\codex-home\skills\ui-ux-pro-max\SKILL.md` | 先写 `主交互槽位五联单`；来源家族必须能回查到真实文件/截图；验收必须证明主交互槽位前中后不漂移、临时 UI 不侵入主槽位、页面没有双主焦点 |
| **显示游戏实施状态** (`statusTag` / `under_construction` / 实施中横幅) | `docs/framework/frontend.md` § 实施中状态横幅 | 游戏目录、详情缩略图、选角卡面等用户可见入口，只要展示“实施中”，必须复用共享斜条组件 `ImplementationStatusRibbon`，禁止降级成普通标签/小字提示 |
| **七大恨区域工具 / 红线 truth / 工作区清点** | `docs/games/qidahen/workflows/qidahen-region-mask-truth-sources.md` | 先区分正式边界输入、默认页自动反推红线、`manual-boundary-user` 手工候选、历史 overlay/证据图，再决定截图、修图或清理 |
| **七大恨区域拓扑 / 正式区与运行时区分层** | `docs/games/qidahen/workflows/qidahen-region-topology-truth-sources.md` | 先区分印刷正式区、运行时逻辑区、`printedRegionIds` 显式映射，再决定该改正式闭合区还是 runtime 拆分 |
| **七大恨主棋盘 UI / 生图约束** (共享行动指示器、特殊区域、年份或回合卡位、主行动模型) | `.codex/skill/boardgame-ui-imagegen/SKILL.md` + `docs/games/qidahen/workflows/qidahen-ui-imagegen-rules.md` | 先读通用生图 skill 的共性约束，再读七大恨专项约束；单游戏专名只允许留在七大恨专项文档，不得回写到通用层 |
| **生图设计稿 → 实现设计稿** (AI 生成 UI mockup 后按图实现/复刻) | `docs/ai-rules/generated-design-implementation.md` + `docs/ai-rules/ui-change-gates.md` + `docs/ai-rules/ui-ux.md` | 真实内容盘点、禁止无中生有、目标稿复看、关键几何比例量测、E2E 截图证据 |
| **Home V2 移动横屏首页/详情/弹窗** (Home V2 书本界面、移动端专用首页、详情页、纸面弹窗) | `docs/ai-rules/home-v2-design.md` + `docs/ai-rules/generated-design-implementation.md` + `docs/ai-rules/ui-change-gates.md` + `docs/ai-rules/ui-ux.md` + `docs/ai-rules/ui-responsive-layout.md` | `artifacts/home-v2-design/` 目标稿优先、移动 CSS 视口、书页构图、详情页缩略图/描述/账本密度、纸面弹窗统一 |
| **大规模 UI 改动** (新页面/重做布局/新游戏UI) | 先 `D:\codex-home\skills\ui-design-pipeline\SKILL.md`，再全局 `ui-ux-pro-max --design-system` 与 `design-system/` | 先锁 spec/domain/design/components/craft/template/evaluator，再生成或更新具体设计系统；见 §UI/UX 规范 → §0. 大规模 UI 改动前置流程 |
| **游戏内 UI 交互** (按钮/面板/指示器) | `design-system/game-ui/MASTER.md` | 交互原则、反馈规范、动画时长、状态清晰 |
| **玩家可见文案 / 能力横幅** (规则原文、提示文案、验收清单不得上屏) | `design-system/game-ui/MASTER.md` §4.11 + `design-system/game-ui/source-families.md` | 总原则在 `MASTER.md`；具体承接方式按来源家族选型；单游戏 workflow 只引用入口，不重复维护正文 |
| **选择成熟交互来源家族** (prompt / waiting / 手牌区 / 右侧 rail / setup 壳层) | `design-system/game-ui/source-families.md` | 先从批准家族中选型；复用仓内成熟不变量；找不到家族前不得发明正式交互模式 |
| **游戏 UI 风格选择** | `design-system/styles/` | arcade-3d（街机立体）、tactical-clean（战术简洁）、classic-parchment（经典羊皮纸） |
| **创建临时文件 / 清理根目录** (Bug 分析/测试脚本/Wiki 数据) | `docs/temp-files-management.md` | 临时文件分类规则、目录结构、.gitignore 规则、开发规范 |
