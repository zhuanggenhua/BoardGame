# Task Plan: 线上 AI 自动反馈排查与修复（2026-05-13）

> 当前正式计划入口。下方旧计划均为历史上下文，不作为本轮任务入口。

## Goal

只读拉取生产反馈真源，确认当前是否存在 `online-ai-watchdog` / 系统 AI 自动反馈的 `open` 或 `in_progress` 项；若有可定位根因则修复并验证，若单条反馈信息不足以定位，则对对应自动反馈/恢复链路做结构化重构，提升后续可诊断性与收口能力。

## Constraints

- 不创建、切换、删除分支或 worktree。
- 生产侧先只读查询；不做状态回写、部署、重启或数据修改，除非后续获得明确授权或本轮修复验证已经形成可回写证据。
- 人类反馈仍高于系统反馈；本轮用户点名 `ai自动反馈`，所以先聚焦系统自动反馈。
- 如果线上反馈不足以定位，重构方向应落在诊断信息、聚合指纹、恢复链路边界或错误分类，不用猜测性业务补丁冒充修复。

## Acceptance Checklist

- [x] S0 读取根规范、部署/服务器入口、历史反馈处理流程与规划 skill。
- [x] S1 生产只读拉取当前 `open/in_progress` 自动反馈，保存关键事实。
- [x] S2 对每条 AI 自动反馈提取 gameId、matchId、incidentKind、reason、stateSnapshot/log 线索并归类。
- [x] S3 有明确根因时修复；无法从反馈定位时重构反馈诊断/恢复链路。
- [x] S4 跑相关聚焦验证；涉及 UI 才补 E2E 和截图证据。
- [x] S5 更新 evidence / progress，说明线上状态与是否需要回写或部署。

## Current Status

- [x] 已读取根 `AGENTS.md`、服务器入口文档、`docs/deploy.md` 与 planning-with-files skill。
- [x] 已确认现有 `task_plan.md` 顶部 shayu 任务已完成，本轮新建顶部计划。
- [x] 已拉取生产当前 AI 自动反馈真源并完成归类。
- [x] 已重构 watchdog 失败诊断：补足 command type 与真实失败原因透传。
- [x] 已完成聚焦 eslint / vitest 验证。
- [ ] 生产 `open` 状态如需回写，等待明确授权后再执行。

## Addendum（2026-05-14 23:38 +08）：人类线上反馈 Twister 可选语义

- [x] 已核实生产反馈 `6a055d1429cd213e03bfd3e9`：`twister实现完全错误`，状态仍按生产库实际值处理，本轮未擅自标 resolved。
- [x] 已以正式 shayu 卡图为真相源复核：Twister / Monster Tornado 是“你可以”移动，合法候选存在时也必须允许跳过。
- [x] 已修复 `tornados_twister` / `tornados_monster_tornado` 共用 push/pull helper：加入 skip，禁用可选 prompt 单候选自动结算，skip 后不改变权威状态。
- [x] 已补 L2、审计门禁与 L3 真实入口 E2E，并实际打开截图核对。
- [x] 已回写 evidence：`evidence/smashup/smashup-feedback-6a055d1429-twister-closeout-2026-05-14.md` 与 shayu 全面审计覆盖矩阵。
- [ ] 未完成：本地修复尚未提交、push、部署；线上反馈状态尚未回写 resolved。

## Addendum（2026-05-15 09:20 +08）：shayu 长描述复杂对象抽样全链路审计

- [x] 已按中文描述长度与动作链复杂度抽样复核：`sharks_megalodon`、`mythic_greeks_argonaut`、`sharks_blood_in_the_water`、`tornados_not_in_kansas`、`mythic_greeks_favor_of_dionysus`。
- [x] 已发现并修复 `mythic_greeks_argonaut` 两个真实缺口：缺少替代行动额度打出入口，以及 Argonaut 触发 action 后能力时漏掉 Jason。
- [x] 已补 L2 行为测试与 L3 真实入口 E2E：随从额度已满、行动额度可用时打出 Argonaut，并串联 Odysseus / Heracles / Spartan / Jason。
- [x] 已新增 evidence：`evidence/smashup/smashup-shayu-long-text-sample-audit-2026-05-15.md`。
- [ ] 未完成：本轮修复尚未提交、push、部署；该抽样不替代 shayu 45 对象全面审计矩阵。

## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-13 | `session-catchup.py` 提示 Codex 原生 session 解析未实现。 | 记录为无可同步上下文，继续按当前对话与项目文件推进。 |

---

# Task Plan: SmashUp shayu 三派系通用入口矩阵补强与全量重审（2026-05-12）

> 当前正式计划入口。下方旧计划均为历史上下文，不作为本轮任务入口。

## Goal

把“交互入口语义审计”从一句通用原则补强成可执行的通用审计矩阵，并按新矩阵对 SmashUp shayu 三派系（sharks / tornados / mythic_greeks）39 张卡 + 6 张基地做 P0/P1 全量重审；发现问题必须修复或显式登记，旧 evidence 失效结论必须回写。

## Constraints

- 不创建/切换/删除分支或 worktree；在当前工作树既有脏改基础上推进。
- 不把抽样审计说成全量；全量必须有对象清单逐项状态。
- 通用规范只写通用矩阵，不写 shayu / 飞鲨 / 单卡特例。
- 结论按 L1/L2/L3/L4 分层；没有新增 E2E 截图时不得宣称 L3 已补齐。
- 使用 completion guard：`temp/smashup-shayu-full-audit-2026-05-12.json`。

## Acceptance Checklist

- [x] S0 读取规范与项目 skill：game-audit-workflow、add-new-faction、testing-audit、engine-systems、testing-best-practices、automated-testing、data-entry。
- [x] S1 补强 `docs/ai-rules/testing-audit.md`：交互入口语义矩阵、目标归属、数量/可选、动作链、上下文携带、自动执行 vs 玩家选择。
- [x] S2 建立 shayu 39 卡 + 6 基地对象清单，标 L0-L4 与 P0/P1 风险。
- [x] S3 对每个对象做 P0/P1 重审：描述动作链、第一入口、数据字段、UI/validator/handler/reducer 链路、上下文与可选/数量语义。
- [x] S4 修复或登记发现项；同步测试与旧 evidence 回写。
- [x] S5 运行相关验证并更新 completion guard，不满足则不得宣称完成。
- [x] S6 再次抽样调查 L1/残余高风险对象；发现并修复 `mythic_greeks_favor_of_zeus` 二次基地选择缺口，补 L2 行为测试与 evidence。

## Current Status

- [x] 已确认根 `task_plan.md` 旧当前任务为七大恨 intake，已 completed；本轮在顶部切换为 shayu 全量重审计划并保留历史。
- [x] 已创建 completion guard 状态文件。
- [x] 已读取 OpenSpec 指引：本轮属于现有审计/bug 修复/证据补强，不先创建新 OpenSpec proposal。
- [x] 已补强通用规范、完成全量审计清单与验证。
- [x] 再次抽样调查完成：5 个高风险对象 L2 抽查通过；`favor_of_zeus` 入口重复 prompt 已修复。

## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-12 | planning-with-files session-catchup 提示原生 Codex session 解析未实现。 | 记录为无可同步上下文，继续按当前对话与项目文件推进。 |
| 2026-05-12 | PowerShell `Select-Object -Index 90..120` 写法被当成字符串，读取片段失败。 | 改用 Python 按 UTF-8 读取并输出行号。 |
| 2026-05-12 | 输出 `domain/index.ts` 时遇到 GBK 无法编码特殊字符。 | 改用 Python `stdout.buffer.write(...encode('utf-8'))` 输出。 |

---

# Task Plan: 七大恨新游戏前置 intake 与可行性分析（2026-05-11）

> 当前正式计划入口。下方旧计划均为历史上下文，不作为本轮任务入口。

## Goal

基于 `D:\gongzuo\webgame\gameasset\七大恨 中文mod\七大恨规则.pdf` 与 `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Images`，先完成新游戏前置 intake：把规则 PDF 转成易读 Markdown，把需要用到的图片放入项目正式资源目录并规范命名，随后分析“七大恨”接入本项目的实现可行性与风险；同时记录现有 create-new-game skill 的缺口，形成后续 skill 优化建议。

## Constraints

- 不擅自创建、切换、重建或删除分支；`create-new-game` 的正式建游戏分支要求等待用户明确授权。
- 本轮先做规则/资源/可行性前置，不直接创建完整游戏骨架。
- 主真相源：用户提供的中文规则 PDF 与中文 mod 图片目录。
- 图片正式资源必须遵循 `docs/ai-rules/asset-pipeline.md`：运行时资源落 `public/assets/i18n/zh-CN/<gameId>/...` 或过渡期等价路径，路径语义化，后续代码引用不写 `compressed/`。
- 录入中间产物、OCR/核对图、识别清单放 `temp/`，不混入正式资源树。

## Acceptance Checklist

- [x] S0 规划与规范读取：已读取 AGENTS、OpenSpec、planning-with-files、create-new-game、asset-pipeline、data-entry、temp-files-management。
- [x] S1 规则转档：将 `七大恨规则.pdf` 转为易读 Markdown，落到项目内新游戏 `rule/` 或前置文档目录，并保留转换方式与质量说明。
- [x] S2 素材盘点：列出 `Images` 下素材清单、尺寸、文件类型、疑似用途与命名依据。
- [x] S3 资源入库：把可裁定用途的正式图片复制到项目规范目录，采用语义化命名；不确定用途只登记，不强行命名。
- [x] S4 资源压缩/清单：对正式入库图片执行最小必要压缩或记录阻塞原因。
- [x] S5 可行性分析：基于规则文档与素材盘点分析核心机制、引擎映射、UI/资源复杂度、MVP 切分与风险。
- [x] S6 skill 优化建议：记录 create-new-game 对“PDF 转 MD + 素材 intake + 可行性评估”阶段的可补强点。

## Current Status

- [x] 已确认本轮不创建分支，先执行新游戏前置 intake。
- [x] 已读取项目根 AGENTS 与 OpenSpec 指引。
- [x] 已读取 planning-with-files 与 create-new-game skill。
- [x] 已读取图片资源、数据录入、临时文件管理规范。
- [x] 已完成规则转档核验、素材规范入库、压缩、manifest 校验、R2 上传、远端抽查、可行性分析与 skill 补强。

## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-11 | planning-with-files session-catchup 提示原生 Codex session 解析未实现。 | 记录为无可同步上下文，继续按当前对话与项目文件推进。 |

---

# Task Plan: DiceThrone 新增 Treant / Ninja 两个英雄（2026-05-09）

> 当前正式计划入口。下方历史计划来自创建 worktree 时的主线文件，仅保留为历史上下文，不作为本轮任务入口。

## Goal

在独立 worktree `.worktrees/dicethrone-treant-ninja` 中，基于用户提供的两组中文图片素材新增 Dice Throne `treant` 与 `ninja` 两个英雄，完成三方图片规格对比、资源接入、静态数据与必要机制实现、审计文档、测试/E2E、截图与资源链路收口。

## Scope

- 主真相源：
  - `public/assets/i18n/zh-CN/dicethrone/images/treant`
  - `public/assets/i18n/zh-CN/dicethrone/images/ninja`
- 参考对象：成熟旧英雄与新英雄 `gunslinger`，必要时对照 `samurai` / `moon_elf` 等复合升级与 atlas 接线。
- 工作现场：`D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja`
- 分支状态：detached HEAD，未新建分支。

## Acceptance Checklist

- [x] S0 合同层：锁定两英雄真相源、素材清单、图片规格差异、可复用项/谨慎项、冲突待裁定项。
- [x] S0 裁图层：生成单对象可读裁图/核对图，临时图放 `temp/`，正式资源与核对中间产物分层登记。
- [x] S0 文档层：为两个英雄创建/更新真相源表、录入核对、卡牌录入核对。
- [x] S1 资源层：压缩正式资源，重建 manifest，确认 `compressed/` 和 atlas 引用合同。
- [x] S1 配置层：接入英雄注册、骰面、token、能力、卡牌、critical images、locale。
- [x] S2 机制层：实现无法直接复用的 token / 被动 / 技能 / 卡牌机制，优先复用旧英雄共享逻辑。
- [x] S2 共享契约对比：至少与 `gunslinger` 和一个成熟复合升级英雄做并排核对。
- [x] S3 验证层：补/更新现有测试文件，跑相关 Vitest、eslint/typecheck，必要时跑真实入口 E2E。
- [x] S3 截图层：若涉及 UI/卡图展示，必须实际看截图并写 evidence。
- [x] S4 审计层：在 `evidence/` 落两个英雄审计与端到端证据文档，结论按 L1-L4 分层。
- [x] S4 资源远端层：运行资源上传并抽查代表性 URL；若受环境阻塞，明确列未上传资源与影响。

## Current Status

- [x] 已创建 detached worktree：`.worktrees/dicethrone-treant-ninja`
- [x] 已确认主工作树有大量无关脏改，本轮不在主工作树继续。
- [x] 已把用户给出的 `treant` / `ninja` 图片目录复制进新 worktree。
- [x] 已完成 S0-S4：新增 treant/ninja，完成资源、配置、规则文档、审计证据、测试/E2E、R2 回查。

## Reopened Scope（2026-05-10 用户复盘）

- [x] 重新按 `dicethrone-hero-intake` 新门禁复核，不再把选角 E2E 视为全流程完成。
- [x] 建立 treant/ninja 批次矩阵：数据录入、机制、资源上传、E2E、审计逐格证明。
- [x] 逐项核对两个角色的技能、Token、卡牌是否只有 L1/L2，列出未实现项。
- [x] 修订 evidence，明确哪些是真完成、哪些是 scoped-debt。
- [x] 如果要宣称彻底完成，必须补齐 L2/L3/L4 缺口；否则不得收口。


## Restart Contract（2026-05-10 重来口径）

> 用户明确要求“新增派系是通用 skill，没有就加，给我重来”。本节覆盖上方旧 Closeout Snapshot；旧 `S0-S4 已完成` 只能视为上一轮误收口历史，不作为当前完成证明。

### 新增派系/角色通用 skill

| 项 | 状态 | 证据 |
|---|---|---|
| 项目通用 skill `.windsurf/skills/add-new-faction/SKILL.md` | passed | `PYTHONUTF8=1 python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\add-new-faction` -> `Skill is valid!` |
| `data-entry-workflow` 路由到通用新增派系 skill | passed | `.windsurf/skills/data-entry-workflow/SKILL.md` 已包含“通用新增派系 / 新增角色 / 新增英雄”路由 |
| DiceThrone hero intake 门禁补强 | passed | `docs/games/dicethrone/workflows/dicethrone-hero-intake.md` 已增加禁止提前收口、批次矩阵、L0-L4 与资源/E2E/审计门禁 |

### Treant / Ninja 重审批次矩阵（当前真状态）

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
|---|---|---|---|---|---|---|
| `treant` | passed | passed | passed | passed | passed | passed |
| `ninja` | passed | passed | passed | passed | passed | passed |

上表已经在 2026-05-10 20:16 +08 全部核销为 `passed`；本轮可以使用“完成/收口”口径，但必须同时引用 evidence、测试命令和截图路径。

### 重审缺口核销结果

以下清单是 2026-05-10 18:49 +08 重新打开时的待审/待修项，20:16 +08 后不再作为阻塞项保留；逐项实现状态、L2/L3 证据与剩余风险以 `evidence/dicethrone/dicethrone-treant-ninja-intake-audit-2026-05-10.md` 为准。

- Treant：`seedling` / `sapling` / `divine` / `life_sap` / `thorn` 已完成机制复核；生命源泉另有真实入口 E2E 截图链证明主阶段奖励骰治疗可触发、可展示、可收口。
- Ninja：`delayed_poison` / `smoke_bomb` / `ninjutsu` 已完成机制复核；忍术另有真实入口 E2E 截图链证明 beforeDamageDealt 奖励骰加伤可触发、可展示、可收口。
- 旧问题“按钮可见但 custom 被动不派发命令”已修在 `src/games/dicethrone/Board.tsx`。
- 旧问题“beforeDamageDealt token 加伤只更新 pendingDamage，不同步 pendingAttack.bonusDamage”已修在 `src/games/dicethrone/domain/reduceCombat.ts`。

## Closeout Snapshot

- 2026-05-10 20:16 +08：按通用新增派系 skill 重来后，Treant / Ninja 的数据录入、资源链、机制 L2、真实入口 E2E、审计 evidence 已全部重新核销为 passed。
- 旧 16:20 收口只证明选角/静态接入，已在 evidence 中明确标记为失效结论。
- 证据文档：`evidence/dicethrone/dicethrone-treant-ninja-intake-audit-2026-05-10.md`。
- 机制 E2E 命令：`PW_PORT=6473 / PW_GAME_SERVER_PORT=20300 / PW_API_SERVER_PORT=21300 / PW_WORKERS=1 npm run test:e2e:ci -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts` -> 4 passed。
- 关键截图：
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/树精生命源泉应在主阶段触发奖励骰治疗并收口/03-life-sap-after-close.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/忍者忍术应在伤害前掷骰加伤并回到可收口状态/02-ninjutsu-bonus-die-overlay.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/忍者忍术应在伤害前掷骰加伤并回到可收口状态/03-ninjutsu-after-bonus-closeout.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/树精木苗树灵两个主阶段按钮应短文案展示并真实结算/01-sapling-short-buttons-before-use.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-treant-ninja-mechanics.e2e/忍者忍术6点应弹出分支选择并能施加慢性中毒/02-ninjutsu-6-choice-modal.png`


## Errors Encountered

| 时间 | 错误 | 处置 |
| --- | --- | --- |
| 2026-05-09 | 首次复制素材时用 `Copy-Item -LiteralPath ...\*`，PowerShell 将 `*` 当字面量导致找不到路径。 | 改用 `Copy-Item -Path ...\*` 后复制成功。 |

---

# Task Plan: 线上反馈持续修复（2026-05-03）

> 来源：线上反馈源（生产 API + 生产 Mongo）
> 说明：本节是当前正式计划入口；下方旧任务计划仅保留为历史记录，不再作为本轮任务入口。

## Goal
> 持续清空当前线上 `open` 反馈，默认以**人类反馈优先**为主线推进；系统自动反馈只作为补现场、补根因或止血支线处理。对仍在持续刷新的 watchdog，可并行止血，但不得再覆盖人类反馈的主优先级。

## Priority Rule

- [x] 已按 2026-05-05 新口径更新本任务优先级
  - 默认顺序：`人类反馈 > 系统自动反馈`
  - `watchdog` / `unsatisfiable-interaction-auto-skipped` / `force-end-turn-*` 仅在两类情况下提前处理：
    - 为某条人类反馈补现场或补根因；
    - 正在持续制造新故障、刷屏或资源风险，需要并行止血。
  - 后续汇报必须区分“人类反馈主线”与“系统反馈止血支线”，不得再混成单一优先级口径。

## Current Snapshot

- [x] 2026-05-10 命令执行异常全链路已完成本地修复与聚焦验证
  - 后端 batch 失败不再固定折叠为 `command_failed`，会透传领域错误码或 `pipeline_error: <message>`
  - 前端不再静默 `command_failed`，非 `stale_state` 的 batch rejection 会进入错误展示路径
  - 已补证据：`evidence/transport-command-error-full-chain-fix-2026-05-10.md`
  - 已通过聚焦 transport / MatchRoom helper 测试与 `npm run typecheck`
  - `长舟` 已按用户澄清重新定位为 SmashUp `base_drakkar`（德拉卡尔号 / Drakkar），不是 SummonerWars；根因是 2026-05-08 引入的运行时 `effectContract` 漏 `playLimits` / `discardState` / `opensInteraction` 后误拦截合法基地能力
  - 已补 `PLAY_MINION -> base_drakkar` 真实触发链回归，聚焦 `base_drakkar` 测试 4 passed
- [x] 审计流程已按“执行层级不够深”的复盘结论升级
  - 已更新 `docs/ai-rules/testing-audit.md`，新增“深度审计流程（强制）”
  - 已把对象清单、完整链路、真实入口、共享根因扩审、旧结论失效回写，改成统一深审门禁
  - 已明确把 `D37` 与 `D40` 标为本轮漏审复盘中的高风险专项
- [x] 生产反馈真源已恢复可读
  - 2026-05-03 生产 `Mongo` 因根盘打满 + `FTDC diagnostic.data` 异常重启，导致 `/admin/feedback` 返回 `500`
  - 已截断 `boardgame-game-server` 的 `13G` Docker 日志，根盘从 `100%` 降到 `68%`
  - 已确认 `boardgame-mongodb` 恢复为正常启动，`GET /admin/feedback?status=open` 恢复可读
- [x] 当前线上盘面已快照到本地
  - `temp/feedback-online/current-open-20260503.json`
  - `temp/feedback-online/current-in-progress-20260503.json`
- [x] `splendor` watchdog 本地止血补丁已完成并通过最小回归
  - `src/engine/transport/onlineAiRecovery.ts` / `src/engine/transport/server.ts`
  - 已验证：`splendor` 不再生成/执行裸 `ADVANCE_PHASE` recovery，manifest 明确禁用 AI 时 watchdog 会忽略残留 AI seat metadata
- [x] `dicethrone` 当前 watchdog / defensiveRoll 主链已完成本地聚焦验证
  - 已通过：`basic-commands-coverage`、`response-window-interaction-lock`、`flow.test.ts` 中 `targetingRoll / defensive / displayOnly / bonus` 相关聚焦用例
- [x] `smashup` 当前 `visible-interaction` / `scoreBases` 主链已完成本地聚焦验证
  - 已通过：transport `visible-interaction / recover-interaction` 相关回归 + `scoreBases-auto-continue`
- [x] `69f7ac9d...` 对应的 `smashup_reaction_choose` 重复 special 候选已完成本地最小修复验证
  - 已定位线上快照特征：同一 prompt 中重复出现 `activate_special:titan:titan_2_wizards_arcane_protector:3`
  - 已在 `reactionSession` 增加按 `option.id / reaction value` 去重，并补 `scoreBases-auto-continue` 三条聚焦回归通过
  - 已补最小兼容修复：`src/games/smashup/abilities/innsmouth.ts` / `e2e/src/games/smashup/abilities/innsmouth.ts` 缺失 `registerInteractionHandler` import，修复后 transport 聚焦套件可再次编译
- [x] `smashup` watchdog transport 闭环证明已补齐
  - 已新增并跑通：`src/engine/transport/__tests__/server.test.ts` 中 “`smashup` 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 `blocker_persisted`”
  - 2026-05-04 已再次复跑通过：`stale reaction choice` / `visible-interaction action` / `follow-up advance` 三条 watchdog 聚焦用例
- [x] `splendor` 线上 orphan watchdog 已完成生产止血
  - 先确认 `/internal/rooms` 已为空但 `boardgame-game-server` 单进程仍持续对 `Nh_5xVWO0km` 执行 `ADVANCE_PHASE -> unknownCommand`
  - 已执行最小生产操作：重启 `boardgame-game-server`
  - 复核：`69f6c4bc9ec13b96d710e10d` 停在 `occurrenceCount = 417` / `lastOccurredAt = 2026-05-03T17:40:12.626Z`，重启后 1 分钟日志不再出现该 `matchID`
- [x] `69f5be8c9ec13b96d710baa4` 已完成线上状态回写
  - 2026-05-04 生产 Mongo 直查先确认该条仍为 `open`，且现场仍对应 human `main1` 残留 AI 枪手 `displayOnly` 奖励骰孤儿态
  - 已按现有 transport/watchdog 修复证据执行最小回写：`matched=1`、`modified=1`
  - 回写后复核：`temp/feedback-online/post-69f5be-resolved-summary-20260504.json` 显示该条已为 `resolved`，当前 `openTotal = 20`，`dicethrone|feedback-modal` 从 `7` 降到 `6`
- [x] `69f7ac9d9ec13b96d710fded` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条对应 `smashup_reaction_choose` 中重复的 `arcane protector` special 候选；本地 runtime + watchdog 聚焦回归已通过
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
  - 回写后复核：当前 `openTotal = 19`，`smashup|online-ai-watchdog` 从 `4` 降到 `3`
- [x] `69f4acdf9ec13b96d7109f30` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条用户反馈“头晕目眩无法使用”；现场权威态显示 Barbarian 在 `main2` 手里持有 `card-dizzy`，但攻击后响应链未被用户正常使用
  - 本地已有 `card-dizzy` 的领域回归与真实 E2E 证据：攻击结算后 `afterAttackResolved` 响应窗真实出现，`card-dizzy` 可打出并对目标施加 `Concussion`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] `69f5c17f9ec13b96d710bb03` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条属于 `smashup_reaction_choose` 的 `scoreBases` / `visible-interaction:recover-interaction:blocker_persisted` 聚合项
  - 本地已有 transport 闭环补测，证明持久化 stale reaction choice 走 watchdog 恢复时会先按当前 live 语义收口，不再落成 `blocker_persisted`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] `69f423585cacc4e6b5cdbdbf` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是 `69f5c17f...` 的更早同类 `scoreBases` / `smashup_reaction_choose` 聚合项
  - 2026-05-04 按同一 transport/runtime 证据链通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 新一轮回写后盘面已降到 `openTotal = 16`
  - 聚类更新为：`dicethrone|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`smashup|online-ai-watchdog = 1`、`splendor|online-ai-watchdog = 1`
- [x] `69f479c69ec13b96d71099e3` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是最后 1 条 `smashup|online-ai-watchdog open`，根因不是 `scoreBases` stale reaction，而是 `endTurn` mandatory 顺序交互收口后，watchdog 没把 SmashUp `endTurn` 纳入 follow-up `ADVANCE_PHASE` fallback
  - 已补本地 transport 修复：`src/engine/transport/server.ts` 允许 SmashUp `endTurn` 在 legal action 耗尽后继续 fallback `ADVANCE_PHASE`
  - 已补并跑通聚焦回归：`watchdog falls back to first trigger respond for smashup onTurnEnd mandatory reaction ordering`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 15`
  - 聚类更新为：`dicethrone|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f21b05ab54eadcc2bb2b9e` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条现场不是泛化 AI 发呆，而是 DiceThrone 枪手 `targetingRoll -> Loaded token -> bonus die` 收口链脱节：末尾事件已走到 `BONUS_DICE_REROLL_REQUESTED`，但系统最终落成 `sys.phase=targetingRoll`、`flowHalted=true`、`interaction.queue=[]`
  - 根因簇与已回写 `69f5be8c...` 的 `displayOnly / pendingBonusDiceSettlement / hidden response` 修复链一致，也共享 `69f04210...` 的 `targetingRoll` 推进缺口
  - 已复跑并通过本地聚焦回归：`src/games/dicethrone/__tests__/flow.test.ts` 4 条 `targetingRoll` 用例、`src/engine/transport/__tests__/server.test.ts` 5 条 `displayOnly / hidden interaction / watchdog` 用例
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 14`
  - 聚类更新为：`dicethrone|feedback-modal = 4`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f2a81c5cacc4e6b5cdb4e5` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条生产快照并非卡死终态，而是已经完整收口到 `main2`：末尾事件顺序为 `TOKEN_RESPONSE_REQUESTED -> TOKEN_USED -> TOKEN_RESPONSE_CLOSED -> ATTACK_RESOLVED -> SYS_PHASE_CHANGED(defensiveRoll -> main2)`
  - 终态同时满足：`flowHalted=false`、`interaction.queue=[]`、`pendingAttack=null`
  - 该条与 DiceThrone `pendingInteractionId / hidden response / token response` 修复簇一致，按已修未回写处理
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 13`
  - 聚类更新为：`dicethrone|feedback-modal = 3`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f31c695cacc4e6b5cdb992` 已按“本地已修即 resolved”口径完成线上状态回写
  - 项目现有专项审计已直接点名同一时间戳、同一反馈原文“再来点这张卡自己整个回合都用不了”
  - 根因是 4 人 `targetingRoll` 自动目标窗口里攻击修正卡误死绑 `pendingAttack.defenderId`
  - 2026-05-04 已复跑并通过聚焦回归：`攻击修正卡可在 defenderId 写回前直接结算到自动目标`、`Loaded token 的奖励骰特写应命中自动目标`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 12`
  - 聚类更新为：`dicethrone|feedback-modal = 2`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f18ca4ab54eadcc2bb2322` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上现场仍处于 `defensiveRoll`，且底层骰子数据存在；问题位点对齐到共享骰面可见性修复簇 `69cba605...`
  - 已复跑共享 fallback 单测通过；fresh E2E 尝试因测试 runtime 启动失败未进入业务断言
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 新一轮回写后盘面已降到 `openTotal = 11`
  - 聚类更新为：`dicethrone|feedback-modal = 1`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f1978dab54eadcc2bb24b0` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条缺少 `stateSnapshot` / `errorContext`，按明确推断并入同日 DiceThrone 全局 HUD 加载失败簇 `69f1f938...` / `69f1f943...`
  - 已重跑同簇本地验证：`chatSelectionLogic.test.ts` 14 通过，`npm run build` 成功
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 10`
  - 聚类更新为：`smashup|feedback-modal = 7`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - `dicethrone|feedback-modal` 已清零
- [x] `69f27faaab54eadcc2bb2c77` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`蒸汽朋克卡牌差分机可以无限抽牌`
  - 根因不是 `Difference Engine` 自身递归，而是 `endTurn` 恢复态再次重复 `collectTriggers('onTurnEnd')`，把同一帧 `turn-end:1:9:0` trigger 重新入队
  - 已补本地修复：`src/games/smashup/domain/index.ts` 为 `from === 'endTurn'` 的恢复态加闸，避免收口后再次重排同一组 `onTurnEnd` trigger
  - 已复跑并通过：`turnCycle.test.ts` 中新增最小复现 + `expansionOngoing.test.ts` 中 `steampunk_difference_engine` 聚焦回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 9`
  - 聚类更新为：`smashup|feedback-modal = 6`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch9.json`
- [x] `69f27a5dab54eadcc2bb2c75` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`因为忍者侍从打出的随从无法触发打出效果`
  - 根因不是 `ninja_acolyte_play` 没产出 `MINION_PLAYED`，而是 `afterEvents` 轮里产出的 `MINION_PLAYED` 在 `postProcessSystemEvents()` 触发 `onPlay` 前还没先 reduce 进临时 `core`，导致 `cowboys_gunfighter` 看不到自己已在场上，决斗交互直接短路
  - 已补本地修复：`src/games/smashup/domain/index.ts` 先把该 `MINION_PLAYED` 临时 reduce 到 `tempCore`，再触发 `fireMinionPlayedTriggers()`
  - 已复跑并通过：`baseFactionOngoing.test.ts` 新增最小回归 + `newFactionAbilities.test.ts` 枪手原始 `onPlay` 聚焦回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 8`
  - 聚类更新为：`smashup|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch10.json`
- [x] `69f385d75cacc4e6b5cdbd4a` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`大杀四方  小妖精的泰坦效果没有触发  效果是触发有或者的效果时  一回合一次能两个效果全部触发   但我只能选择一个触发`
  - 当前仓库已有与该反馈直接同构的精确回归：`fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过`
  - 本轮已复跑并通过：`newFactionAbilities.test.ts` 的 `Puck + Spirit of the Forest` 聚焦回归，以及 `commandsValidation.test.ts` 的 Titan 额度守门回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 7`
  - 聚类更新为：`smashup|feedback-modal = 4`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch11.json`
- [x] `69f544f99ec13b96d710ae00` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`为什么出现了选择反应，然后选择轮回者又没效果，然后之前还有选择名人堂和大法师结算顺序，有什么意义`
  - 线上当前权威态已显示《轮回者》最终确实埋进《名人堂》下方，且链路已收口；仓库现有 E2E 证据也明确说明《轮回者》打出后先进入 `smashup_reaction_choose` 再收口是当前真实语义
  - 关于《名人堂 + 大法师》的另一半诉求，仓库已有 `archmageE2E` 精确回归证明应自动收口，不弹无意义排序交互
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 6`
  - 聚类更新为：`smashup|feedback-modal = 3`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch12.json`
- [x] `69f387a35cacc4e6b5cdbd4c` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`按效果我应该加2战力  而不是减2`
  - 线上当前权威态显示：`fairies_tinx` 当前控制者是 `0`，其身上的《雏菊花环 / Daisy Chain》拥有者是 `2`
  - 当前仓库中英文本地化文案与 `ongoing_modifiers.ts` 现有实现都明确要求：`ownerId === controller` 才是 `+2`，否则就是 `-2`
  - 本条不是“实现把正负号写反了”，而是用户把附着牌拥有者与当前随从控制者的关系看反了；本轮无需改代码
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 5`
  - 聚类更新为：`smashup|feedback-modal = 2`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch13.json`
- [x] `69f01fd49b68d90ee983669d` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`没法选择打出斯芬克斯`
  - 线上当前权威态不是“系统没给可选目标”，而是已经进入 `titan_sphinx_start_turn` 真实交互；当前候选位点在基地下方埋葬牌区域，不是单独一个 “Sphinx” 按钮
  - 本轮已复跑并通过：`src/games/smashup/__tests__/smashup.smoke.test.ts` 中 `狮身人面像会在你的回合开始时创建回收埋葬牌并进场的交互|狮身人面像在其所在基地计分后会创建回收该基地埋葬牌的交互`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 4`
  - 聚类更新为：`smashup|feedback-modal = 1`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch14.json`
- [x] `69f5469a9ec13b96d710ae26` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`着魔没效果，目标随从没有附加行动卡`
  - 线上 action log 已直接记录多次《着魔》真实附着：`附加持续战术： 着魔 -> c24 / c6`
  - 当前终态看不到宿主身上仍挂着《着魔》，是因为链路已经继续推进到宿主与《着魔》都离场后的更后拍，不等于前面没有附着成功
  - 本轮已复跑并通过：`src/games/smashup/__tests__/newFactionAbilities.test.ts` 中 `world_champs_bewitched 离场转移交互可把持续行动从弃牌堆重新附着`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 3`
  - 聚类更新为：`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - `smashup|feedback-modal` 已清零
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch15.json`
- [x] `69f471da9ec13b96d7109902`、`69f73be49ec13b96d710f1c2` 已按“本地已修即 resolved”口径完成线上状态回写
  - 两条都是同一类 DiceThrone watchdog 系统单：`force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - 线上当前只剩 watchdog 聚合摘要，已无可继续复核的真实残局；当前 `occurrenceCount` 分别停在 `2563` 与 `2`
  - 本轮 fresh transport 聚焦回归已通过：
    - `DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留`
    - `dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口`
    - `online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 1`
  - 聚类更新为：`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch16.json`
- [x] `69f6c4bc9ec13b96d710e10d` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是本轮最早优先止血的 Splendor watchdog 聚合项：`force-end-turn-failed active-turn:follow-up-advance:command_failed`
  - 当前本地修复已明确覆盖：Splendor 不再生成裸 `ADVANCE_PHASE` fallback，且 manifest `localAi=false` 时 watchdog 会忽略残留 AI seat metadata
  - 本轮 fresh 聚焦回归已通过：
    - `Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback`
    - `online AI watchdog 对 manifest 明确禁用 AI 的 splendor 应忽略残留 seatControllers`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 0`
  - `inProgressTotal = 0`
  - 聚类已清空：`{}`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch17.json`
- [x] 当前 `open` 反馈 20 条全部完成分类
- [x] 当前仍在刷新的 watchdog 问题完成止血
- [x] 用户反馈逐条修复、验证、留证并回写状态

## Phases

- [x] **Phase 0: 恢复线上反馈源**
  - [x] 读取生产环境入口与反馈规则
  - [x] 通过 SSH / 生产容器确认反馈源异常根因
  - [x] 恢复 `Mongo` 与 `/admin/feedback` 可读性
- [x] **Phase 1: 线上 open 盘面收敛**
  - [x] 拉取 `open / in_progress` 最新快照
  - [x] 生成去重后的问题簇与优先级
  - [x] 把“重复 watchdog 聚合项 / 真正用户反馈”拆开处理
- [ ] **Phase 2: 生产止血**
  - [x] 本地修复 `splendor` watchdog `command_failed` 死循环，避免再生成裸 `ADVANCE_PHASE`
  - [x] 本地验证 `dicethrone` watchdog `legal_action_unavailable` / 防御窗口链路主路径
  - [x] 本地验证 `smashup` watchdog `visible-interaction` 主路径
  - [x] 补齐 `smashup` transport 闭环测试，证明持久化 stale `smashup_reaction_choose` 不会再落成 `blocker_persisted`
  - [x] 为 `69f7ac9d...` 补 `reaction option` 去重与 stale special 正规化回归，锁定 `smashup_reaction_choose` 重复 special 候选不再原样外露
  - [x] 通过重启 `boardgame-game-server` 清掉生产 orphan room，确认 `splendor` 聚合项停止新增
  - [x] 评估并执行最小风险热补发布路径：在远端源码仓库同步 `engine/transport` 修复与最小依赖，借 `Node 24` 容器编出 `temp/prod-bundles/game/server.mjs`
  - [x] 将热补 bundle 覆盖到生产 `boardgame-game-server:/app/server.mjs` 并重启复核，确认 `/health` 正常且 `cWGQSaUXt1B` 不再继续刷日志
  - [x] 当前任务口径下已完成止血与反馈清盘；正式镜像发布路径保留为后续非阻塞事项
- [x] **Phase 3: 用户反馈逐条修复**
  - [x] Dice Throne `feedback-modal`
  - [x] Smash Up 2 条 `feedback-modal`
  - [x] 与 watchdog 重复描述的用户反馈合并验证，避免重复劳动
- [x] **Phase 4: 验证、证据、回写**
  - [x] 每个已修项补对应测试 / E2E / 证据文档
  - [x] 线上反馈状态回写为 `resolved` / `closed`
  - [x] 复查是否还有新增 `open` 项在继续产生

## Priority Queue

1. 当前 open / in_progress 已清零
   - 最新快照：`temp/feedback-online/post-20260504-resolved-batch-17-summary.json`
2. 若后续需要继续推进
   - 可把 Splendor 热补进一步收敛到正式镜像发布路径，但这不是本轮 `resolved=本地已修好` 口径的阻塞项

## Constraints

- 当前工作区已存在大量未提交改动，默认视为既有工作基线；修复线上反馈时不得回滚或覆盖这些改动。
- `C:\Users\zhuagenbao\.codex\.omx\ralph-loop.local.md` 当前被另一条长期任务占用；本任务改用仓库计划文件 + 独立 JSON state 持续推进，不抢占现有 loop。
- 当前工作区包含大量并行 dirty 改动；任何生产发布前都必须先确认不会把未验证的无关改动一并带上生产。

# Task Plan: Smash Up Oops 四派系接入与玩法实施

## Addendum（2026-04-07）：Android 本地素材包图片加载故障

### Goal
> 修复 App 端“素材包已下载但进入游戏后图片仍全部加载中”的问题，确保前端能在未走大厅包管理 hook 的情况下接住已安装游戏包，并且不会把 Android `/_capacitor_file_/...` 本地路径误套进开发态图片 fetch/blob workaround。

### Phase

- [x] **Phase A: 链路排查与根因确认**
  - [x] 复核原生安装目录、前端 asset override 注入点、MatchRoom 关键图片加载链路
  - [x] 确认启动期 hydration 会跳过“未预注册 fallbackState 的已安装包”
  - [x] 确认 `OptimizedImage` 会把 `/_capacitor_file_/...` 本地包路径误走开发态 `fetch -> blob` workaround

- [x] **Phase B: 修复与回归**
  - [x] 修复 `hydrateInstalledNativeGamePackages()` 对已安装包的兜底 hydration
  - [x] 收窄 `OptimizedImage` 的 blob-fetch workaround，只保留开发态 public `/assets/...`
  - [x] 补定向测试并完成 eslint / vitest 校验

## Goal
> 分两阶段完成 Smash Up `Oops, You Did It Again` 四个派系（埃及、牛仔、武士、维京人）的完整交付：先完成图片 intake、可复刻工作流与静态接入；再按 `Ancient Egyptians → Vikings → Cowboys → Samurai` 的顺序逐派系实施正式玩法、补齐 UI、新交互类型 E2E、统一审计与证据留档。

## Phases

- [x] **Phase 1: 发现与设计（intake）**
  - [x] 阅读 AGENTS、OpenSpec、资产/录入/测试/审计规范
  - [x] 创建独立 worktree 与任务分支
  - [x] 盘点现有 Smash Up 图片接入链路、脚本、数据结构与目标素材
  - [x] 创建 OpenSpec proposal/tasks/design/spec delta

- [x] **Phase 2: 资产处理与录入（intake）**
  - [x] 锁定权威来源与图片清单，建立 Markdown 核对契约
  - [x] 完成图片压缩、图集/切片配置与资源落盘
  - [x] 完成 i18n / 静态数据 / atlas / faction metadata 的同步录入
  - [x] 沉淀“给一批图片即可录入”的复刻工作流文档

- [x] **Phase 3: 审计与验证（intake）**
  - [x] 对照描述、资源路径、加载链路做 intake 审计
  - [x] 运行相关 Vitest / 审计脚本
  - [x] 编写并运行相关 E2E，用截图留证
  - [x] 汇总 evidence、结果与残留风险

- [x] **Phase 4: 玩法提案与实施设计（gameplay）**
  - [x] 创建 `add-smashup-oops-faction-gameplay` OpenSpec 变更
  - [x] 明确用户要求的实施顺序：逐派系实现，全部完成后统一审计与 E2E
  - [x] 将 bury UI 与新交互类型纳入正式 scope
  - [x] 运行 `openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
  - [x] 等待用户确认 proposal 后进入 `Ancient Egyptians`

- [x] **Phase 5: Ancient Egyptians**
  - [x] 补齐 card defs 元数据与 `abilityTags`
  - [x] 实现埋葬、翻开、替代去向与相关 base/action/minion ability
  - [x] 补齐 owner-visible bury UI 与对手隐藏占位
  - [x] 补领域测试与统一 E2E 证据收口

- [x] **Phase 6: Vikings**
  - [x] 按官方规则书 / Fandom 口径修正 defs、locale 与 ability metadata
  - [x] 实现 deck-top / discard / steal / extra-action 联动与相关基地能力
  - [x] 补领域测试并完成增量门禁验证
  - [x] 统一 E2E 与更严格语义收口已在四派系统一审计阶段完成

- [x] **Phase 7: Cowboys**
  - [x] 实现官方 duel 内核、move / destroy / ongoing draw 与相关 metadata
  - [x] 补决斗/目标选择最小交互断言
  - [x] 补完整 duel 浏览器 E2E 与证据收口

- [x] **Phase 8: Samurai**
  - [x] 按官方规则书 / Fandom 口径修正 defs、locale 与 ability metadata
  - [x] 实现 honor / duel / destroy / temporary-buff / ongoing draw 与相关基地能力
  - [x] Samurai 专项浏览器 E2E、临时触发精细语义与更严格审计已在统一审计阶段完成

- [x] **Phase 9: 统一审计与收尾**
  - [x] 四派系完成后再统一做 gameplay 审计
  - [x] 运行相关 Vitest / typecheck / OpenSpec 校验
  - [x] 运行覆盖新交互类型的 E2E 并留证
  - [x] 汇总最终 evidence、残留风险与后续扩展点

## Technical Decisions
| Decision | Rationale | Status |
| :--- | :--- | :--- |
| 使用独立 worktree `feat/smashup-base-faction-assets` | 根工作区已有并行任务与规划文件，隔离当前任务避免串改 | Approved |
| 使用 OpenSpec + planning-with-files 双轨记录 | 本次既要落地实现，也要沉淀可复刻流程和验收证据 | Approved |
| 以用户提供图片作为当前任务的直接权威来源 | 符合数据录入规范第 3 优先级，可直接用于资源与索引录入 | Approved |
| Smash Up 规则文本与审计必须走 Wiki 爬虫 | 项目专用强制规范，不能只凭图片或记忆录入 | Approved |
| 本轮 scope 以 intake/静态接入为准 | 用户要求整条资源接入链路，但 OpenSpec 已收束为图片、atlas、静态数据、文档、测试、E2E；不在本 change 内补完四派系完整 gameplay ability | Approved |
| `aiji.png` 按 `7x7`、`aiji_base.png` 按 `2x4` row-major 切片 | 已通过直接看图确认 48 张卡 + 1 尾格、8 张基地；后续 atlas/index 以此为唯一切片基准 | Approved |
| 武士基地 defId 使用 canonical 英文名，图面英文差异写入证据文档 | 图面为 `Kyuden Konbini / Sakura Shigemi`，TTS / Wiki canonical 为 `Shogun's Palace / Sakura Garden`；运行时名称与来源说明必须分离 | Approved |
| 先完整录入 locale 文本，再最小化卡牌结构标签 | 为避免把“未实现玩法”误录成“已实现 ability”，本轮卡牌 defs 仅承载图片、数量、力量、所属派系与最小结构，详细文本放入 locale | Approved |
| gameplay 以独立 OpenSpec change 推进，而不与 intake 混写 | intake 已完成并可单独验收；玩法补完涉及新交互类型、UI 与审计范围，必须单独建模 | Approved |
| gameplay 实施顺序固定为 `Ancient Egyptians → Vikings → Cowboys → Samurai` | 先打通 bury 主链路与 UI，再做 duel / movement / replacement，更容易收敛和审计 | Approved |
| bury UI 必须纳入 Ancient Egyptians 第一波范围 | 用户已指出吸血鬼 pod 时 bury 体系只有领域逻辑，没有正式 UI；若继续只做逻辑会重复留下未完成实现 | Approved |

## Critical Errors / Blockers
| Error | Impact | Resolution |
| :--- | :--- | :--- |
| 根工作区 `task_plan.md/findings.md/progress.md` 已服务其他任务 | 不能在原工作区继续维护本次计划 | 新建独立 worktree 承载本任务 |

## Addendum（2026-04-22）：lane-S2R SmashUp 卡牌效果/文本偏差反馈修复

### Goal
> 核对并最小修复 7 条线上 human open 反馈：世界冠军/美人鱼效果、436-1337工厂计分、疯狂山脉抽牌、缅怀先祖、天守阁决斗、武士进弃牌堆加攻击力链路；补测试、运行验证，并产出 vidence/smashup/2026-04-22 逐条证据。

### Phase
- [x] Phase A: 读取规范、锁权威基线与现有实现
- [x] Phase B: 最小修复反馈相关实现与文本
- [x] Phase C: 补现有测试文件中的回归用例并运行验证
- [x] Phase D: 写 evidence/smashup/2026-04-22 逐条结论与最终汇报

### 2026-04-30 复核结论
- 本 Addendum 实际已完成，原未勾选属于 planning 回填遗漏，不再代表“仍未做完”。
- 对应证据并非只落在单一 `evidence/smashup/2026-04-22/*` 路径，而是分布在：
  - `evidence/feedback-closeout/smashup-human-open14-closeout-2026-04-22.md`
  - `evidence/smashup/smashup-feedback-69e61a97-world-champs-card-index-fix-2026-04-25.md`
  - `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`
  - `evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`
- 其中 `69e61a97` 旧关闭结论曾在 2026-04-25 被判定失效，但同日已按“世界冠军 cards7 图集索引错位”根因重新修复并补齐新证据；截至 2026-04-30，lane-S2R 范围内 7 条反馈已具备重新收口依据。

### Scope Control
- 只改 SmashUp 反馈相关文件和 evidence。
- 不触碰当前工作区已有的非本轮改动；已发现 src/games/smashup/domain/index.ts 与 src/games/smashup/__tests__/smashup.smoke.test.ts 存在他人改动，本轮除非必要不修改。

## Addendum（2026-04-22）：SmashUp 10 周年三派系审计复审

### Goal
> 持续验证 `mermaids / skeletons / world_champs` 三派系在当前主线上的实现稳定性，并补齐审计维度（D1-D49）与横幅统一样式证据，确保“实施中”文案与样式收敛后无回归。

### Phase
- [x] 复跑三派系能力与审计门禁（newFactionAbilities + 4 个 audit suite）
- [x] 复跑三派系统一斜向横幅 E2E 并更新截图证据
- [x] 删除中英文 locale 里的 `faction_implementation_in_progress_hint`，只保留“实施中”主文案
- [x] 在 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 补齐 D1-D49 维度
- [x] 按“配置直通 / 新机制 / 新 UI-E2E”补齐主回归文件三派系能力覆盖缺口（静态比对为 0）
- [x] 回写通用 workflow：新增 `targetType: 'generic'` 双登记门禁（实现 + 审计理由）避免后续派系重复踩坑
- [x] 2026-04-24 再次复跑并同步最新口径：`newFactionAbilities = 168 passed / 1 skipped`、4 审计套件全绿、`smashup.e2e.ts = 3 passed`、横幅截图时间更新为 `2026-04-24 09:08`
- [x] 2026-04-24 追加静态覆盖复核：`registerAbility` 对照 `newFactionAbilities.test.ts`，三派系总计 `40` 条能力、缺口 `0`
- [x] 2026-04-24 复跑 OpenSpec + R2 回查：`openspec validate add-smashup-oops-faction-gameplay` 通过，`wangling.webp / wangling_base.webp` HEAD 均为 `200`
- [x] 2026-04-24 强化通用工作流：更新 `.windsurf/skills/data-entry-workflow/SKILL.md` 与 `docs/games/smashup/workflows/smashup-faction-implementation.md`，新增“长期任务连续执行”强制规则
- [x] 2026-04-24 同步两条 watchdog 反馈审计文档复核补记（`69db57c`、`69daa51e`），与主线 E2E `3 passed` 口径对齐
- [x] 2026-04-24 同步 Android 内置 SmashUp locale：删除 `faction_implementation_in_progress_hint`，并复跑 `assets:upload`（上传 `0` / 跳过 `530` / 失败 `0`）
- [x] 2026-04-25 完成两条 watchdog 反馈定向 E2E 复测：`69db57c` 1 条、`69daa51e` 2 条，均通过并回写证据截图路径
- [x] 2026-04-25 修订 `mermaids_toll_bay` 审计口径：旧“触发窗口标记”结论失效，按卡面语义统一为“即时抽牌”；`newFactionAbilities` 为 `170 passed / 1 skipped`，并复跑 4 审计套件 + i18n + `smashup.e2e.ts` 全绿
- [x] 2026-04-25 补跑 `smashup.smoke.test.ts`（`121 passed`）确认三派系修复未引入主流程烟测回归
- [x] 2026-04-25 追加全量 SmashUp 回归（`146 files passed / 9 skipped`，`1962 passed / 19 skipped`）与 R2 二次 HEAD 复核（`wangling.webp` / `wangling_base.webp` 均 `200`）
- [x] 2026-04-25 修复“巨石阵附着天赋二次发动”回归：`USE_TALENT(ongoingCardUid)` 补巨石阵双才能例外，复跑 `talentAbilities(22 passed)`、`smashup-gameplay.e2e(7 passed)`、`smashup.e2e(3 passed)`、`newFactionAbilities(174 passed/1 skipped)`、`smoke(121 passed)`、4 审计套件（`36 passed`）与 `i18n:check` 全绿
- [x] 2026-04-25 去重 `talentAbilities` 重复新增 case 并全链路复跑：`talentAbilities(20 passed)`、`newFactionAbilities(179 passed/1 skipped)`、`smoke(122 passed)`、`smashup-gameplay.e2e(7 passed)`、`smashup.e2e(3 passed)`、4 审计套件（`36 passed`）与 `i18n:check` 全绿
- [x] 2026-04-25 补齐数据录入基操脚本：`scrape-wiki-with-descriptions.mjs` 纳入 `skeletons/mermaids/world_champs`，`final-wiki-code-comparison.mjs` 补单双引号与弯直引号归一化并声明“仅校验 name/count”；复核 `skeletons` 抓取 `12/20`、对比 `1 正确/0 问题`、脚本 `eslint` 全绿
- [x] 2026-04-29 补《快如闪电 / 女主角 / 阿拉密斯》联合反应窗 L3，并回写旧“女主角实现正确”结论失效：根因确认为 `smashup_reaction_choose` 双 reduce + `Aramis` 触发范围缺口，补齐 `finalState / triggerQueue / reaction session / 真实入口 E2E` 审计维度
- [x] 2026-04-29 补《人鱼女王 / 安静的海岸》L3：把 `Mermaids` 的“模式选择 / 场上持续牌天赋迁移”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 补《塞壬的歌声 / 他们出来了》L3：把 `Mermaids` 的“来源基地过滤 + 逐段移动”与 `Skeletons` 的“选基地后多张挖掘”补到浏览器级真实入口，并显式修掉一次 E2E 场景误用不存在 card def 的低级错误
- [x] 2026-04-29 补《墓园》L3：把 `Skeletons` 的“场上持续牌天赋 -> 挖掘 -> 可选 +1 指示物”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 补《骸骨之王》L3：把 `Skeletons` 的“场上 minion 天赋 -> 挖掘这里任意埋葬牌 -> 先经 reaction session 再进 +1 后续交互”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 回写长期任务 / 派系重审 workflow 门禁：把“批量派系重审批次清单”“E2E 场景 defId 预检”“L0-L4 分层验收”“reaction session 抽样门禁”补进 `.windsurf/skills/data-entry-workflow/SKILL.md`、`docs/games/smashup/workflows/smashup-faction-implementation.md`、`docs/ai-rules/testing-audit.md`
- [x] 2026-04-30 收口《墓地爆发》L3，并修复 `scoreBases` 交互事件在 reduce 前被提前计分的时序缺口；定向 E2E `1 passed`，回归 Vitest `2 passed`
- [x] 2026-04-30 补《塞壬 / 诱惑者 / 无人岛》L3，并修复 `BaseZone` 分数徽章绕过 `getPlayerEffectivePowerOnBase(...)` 的 UI 口径缺口；3 条定向 E2E、`ongoingModifiers` 聚焦回归 `6 passed`、`typecheck` 全绿
- [x] 2026-04-30 补《武士 陈》正路径 L3，并收口 `World Champs` 最后一个对象级冻结点；定向 E2E `1 passed`，聚焦 Vitest `2 passed`

### Current Remaining Batch（强制继续，未清空前不得按“收口”停下）
- [x] 明确枚举 `World Champs / 世界冠军` 剩余未到发布级门禁的对象/链路，补到对象级 L3 或明确降级理由
- [x] 明确枚举 `Skeletons / 骷髅` 剩余未到发布级门禁的对象/链路，补到对象级 L3 或明确降级理由
- [x] 对三派系当前已补对象做一轮“卡图口径 vs UI真实出口 vs reaction session”交叉抽检，防止再出现“领域对 / UI错”型漏审
- [x] 回写总审计文档里所有仍写着泛化“已完成专项审计与回归验证”的旧高层口径，避免旧结论继续误导
- [x] 只有当上面 4 项全部勾完，且总审计文档的“仍有残余范围”被逐条消解或显式冻结，才允许进入最终收口汇报


## Addendum（2026-04-22）：线上 Dicethrone critical 反馈收口补强（69c3c83e / 69cba605）

### Goal
> 对 `69c3c83e`（黑屏）与 `69cba605`（骰面不可见）做当前代码基线复核；对仍存在前端兜底缺口的骰面链路做最小修复并补回归证据。

### Phase
- [x] Phase A: 复核反馈上下文与当前实现入口
- [x] Phase B: 最小修复 `Dice3D` 无 sprite 可见性兜底
- [x] Phase C: 补现有测试断言并运行验证
- [x] Phase D: 产出 evidence 文档并回填 planning 文件

### Scope Control
- 仅修改 `src/games/dicethrone/ui/Dice3D.tsx` 与对应现有测试文件。
- 黑屏链路仅做兼容修复有效性复核，不引入额外架构改动。

## Addendum（2026-04-26）：SmashUp 三派系审计续跑（_pod alias + 横幅复核）

### Goal
> 继续执行三派系审计批次：修复 `_pod` alias 审计误报，对齐 Mermaid 新语义断言，并复核统一斜向“实施中”横幅链路是否持续稳定。

### Phase
- [x] 修复 `interactionCompletenessAudit` 的 `_pod` alias 孤儿误报
- [x] 对齐 `Mermaids` 争议用例语义并复跑 `newFactionAbilities`
- [x] 复跑四项审计套件 + i18n 门禁
- [x] 复测横幅 E2E 并完成截图核图
- [x] 继续补齐 `World Champs` 关键链路 L3（`斗志奖杯`、`鼠、鸟与香肠`）并回写专项证据
- [x] 收敛 `smashup.e2e.ts` 中“3 人房座位状态”join 超时稳定性（`3 人房`用例增加 `test.setTimeout(120000)`，复跑 `smashup.e2e.ts` 全绿）
- [x] 收敛全量 `src/games/smashup` 回归失败簇（afterScoring/onDestroy/validation 共 14 条，已收敛为 0）
- [x] 修复 `bear_cavalry_bear_necessities` 交互 stale 目标兜底，并对齐新旧测试语义（“随从或行动卡”）
- [x] 收敛横幅 E2E 的服务就绪抖动：`ensureGameServerAvailable` 改为 45s 轮询，避免误判 skip
- [x] 2026-04-29 补《沉船湾 / 轮回者 / 诡异。可怕。 / 墓碑》L3，并回写两类场景错误：`轮回者` 的旧“直接无交互”假设失效；`沉船湾 / 墓碑` 的旧在线场景未满足计分阈值，根因属于 E2E 注入错误而非实现错误

## 2026-05-05 Follow-up
- [x] 复核当前线上人类 open 反馈并锁定主故障为房间加入失败
- [x] 确认生产 game-server 仍跑旧 join 协议（join 强制要求 playerID）
- [x] 使用生产部署脚本更新 latest 镜像并完成生产 create/claim-seat/join 复测
- [x] 将 69f86b739ec13b96d71107d4 / 69f86c159ec13b96d7110804 按证据链回写为 resolved，并同步 status-board
- [x] 锁定 Android `AppUpdate` 缺插件对应的正式原生壳版本：`0.5.0`（以及更早壳）；首个确认带 `AppUpdatePlugin` 的正式包为 `0.5.1.apk`
- [ ] 视发布窗口决定是否将 Android AppUpdate 缺插件兜底补丁随下一次正式发布带上生产

## Addendum（2026-05-05）：SmashUp 并列计分口径修复
- 用户给出的当前产品口径：`大杀四方战斗力相等时，应取第二位/更低位分，不取并列名次的高位分`。
- 已定位根因：`src/games/smashup/domain/index.ts` 的 `buildBaseRankings()` 之前按“并列沿用当前 rankSlot”发分，导致并列第一仍拿第一位分、并列第二仍拿第二位分。
- 已落修复：改为按并列组占据的最低名次发分（例如并列第一拿第二位分，并列第二拿第三位分）。
- 一致性补充：同步修正 `src/games/smashup/ai.ts` 的基地 VP 估值逻辑，避免 AI 仍按旧口径评估。
- 已补测试：`src/games/smashup/__tests__/baseScoring.test.ts`
  - `scoreOneBase 在并列第一时给并列玩家第二位分`
  - `scoreOneBase 在并列第二时给并列玩家第三位分`
- 已验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseScoring.test.ts --configLoader native --maxWorkers 1`
  - `npm run typecheck`

## Addendum（2026-05-05 23:35 +08）：人类反馈优先续跑

### Goal
> 按“人类反馈优先”新口径，先收敛 SmashUp 剩余 3 条人工反馈：并列计分、熊泰坦额外随从、多人观战异常。

### Phase
- [x] 把 `人类反馈 > 系统自动反馈` 回写到 `.windsurf/skills/feedback-closeout/SKILL.md` 与本计划
- [x] `69f96a734590ce09779a7205` 并列计分：确认本地已修并复跑定向回归
- [x] `69f9623c4590ce09779a715f` 熊的泰坦不能用额外随从打出：完成共享修复与回归
- [x] `69f961ca4590ce09779a715a` 多人观战有 bug 看不了其他人：完成多视角修复、真实 E2E 与收口截图

### Notes
- `69f9623c4590ce09779a715f` 的共享根因已确认不是熊专属逻辑，而是 `smashup_immediate_extra_minion` 候选只枚举手牌随从，没有纳入 `playAsKinds=['minion']` 的 `setaside` 泰坦。
- `69f961ca4590ce09779a715a` 的真实根因已收敛到 `SmashUpBoard` 的二元视角模型：旧实现只能在“自己 / 第一个对手”之间切换，多人局无法点谁看谁。
- 本轮新增本地收口证据：
  - `evidence/smashup/smashup-feedback-69f96a734590ce09779a7205-tied-base-scoring-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f9623c4590ce09779a715f-extra-minion-titan-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f961ca4590ce09779a715a-multi-opponent-view-local-closeout-2026-05-05.md`
- 本地状态板当前还是旧 `remote-human-unresolved-20260421-163730.json` 衍生快照，这 3 条新人工反馈尚未进入板子；在拿到最新 human summary 或正式远端写入口前，不伪造状态板条目。

## Addendum（2026-05-06 07:42 +08）：SmashUp 三条人工反馈正式状态回写

- [x] 核对 HTTP 反馈接口当前不可作为正式写入口：`GET /feedback/open?...` 返回 `404`
- [x] 通过生产 `feedbacks` 集合直连确认 3 条目标反馈回写前均为 `open`
- [x] 已把 `69f96a734590ce09779a7205 / 69f9623c4590ce09779a715f / 69f961ca4590ce09779a715a` 正式回写为 `resolved`
- [x] 已把本地 `temp/feedback-closeout/status-board.json` 同步补入并校验通过
- [x] 线上人类未收口反馈最终已清零；最后两条 `69fa23e04590ce09779a7c52 / 69fa0bd74590ce09779a7bd6` 已在后续批次完成正式回写

## Addendum（2026-05-06 08:10 +08）：SmashUp 最后两条人工反馈回写与人类未收口清零

- [x] 继续沿用 `人类反馈 > 系统自动反馈` 口径处理最后两条 `smashup|feedback-modal`
- [x] `69fa23e04590ce09779a7c52` 已按“已修未回写”回写为 `resolved`
- [x] `69fa0bd74590ce09779a7bd6` 已按“非 bug / 规则符合”回写为 `closed`
- [x] 本地 `status-board.json` 已与这两条最终状态对齐，并通过 `feedback-status: ok`
- [x] 已通过生产 `feedbacks` 复核：`reporterType=user && status in [open,in_progress]` 当前 `count=0`

### Notes

- 正式证据文档：
  - `evidence/feedback-closeout/smashup-human-final-two-writeback-2026-05-06.md`
- 关键快照：
  - `temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-before-writeback-20260506.raw.txt`
  - `temp/feedback-closeout/update-feedback-status-20260506-smashup-human-remaining-two.raw.txt`
  - `temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-after-writeback-20260506.raw.txt`
  - `temp/feedback-closeout/query-human-open-inprogress-after-final-writeback-20260506.raw.txt`

## Addendum（2026-05-07 00:20 +08）：SmashUp 新人工反馈 `69faac614590ce09779a7d8f` 宗教圆环发不了效果

- [x] 重新核对线上真源，确认当前人类反馈新增 1 条 `smashup|feedback-modal`
- [x] 锁定目标反馈：`69faac614590ce09779a7d8f`，原文 `宗教圆环发不了效果`
- [x] 结合生产快照与用户截图定位到前端根因，不是领域校验失败
  - 新补 E2E 首轮直接卡在点击 `[data-ongoing-uid="oa-sacred-circle"]`
  - Playwright 明确报错为透明 `absolute inset-0 z-60` 层拦截点击
- [x] 已做最小修复
  - `src/games/smashup/ui/BaseZone.tsx`
  - `e2e/src/games/smashup/ui/BaseZone.tsx`
  - 桌面端基地 ongoing 放大镜包裹层改为 `pointer-events-none`
- [x] 已补最小 UI 复现
  - `e2e/smashup/smashup-base-minion-selection.e2e.ts`
  - 场景覆盖：点击《宗教圆环》 -> 进入已用态 -> 选择手牌《本地人》 -> 成功打到巫师学院
- [x] 已完成本地 E2E 收口并补证据
  - `evidence/smashup/smashup-feedback-69faac614590ce09779a7d8f-sacred-circle-click-fix-e2e-2026-05-07.md`
- [x] 已按 2026-05-07 新口径补充 workflow：反馈只要完成修复验证，就应立刻回写远端正式状态，不再默认停在本地 resolved
- [x] 已完成远端反馈状态回写与生产复核
  - `temp/feedback-closeout/query-feedback-69faac61-before-writeback-20260507.raw.txt`
  - `temp/feedback-closeout/update-feedback-status-20260507-69faac61-to-resolved.raw.txt`
  - `temp/feedback-closeout/query-feedback-69faac61-after-writeback-20260507.raw.txt`
  - `temp/feedback-closeout/query-human-open-inprogress-after-20260507.raw.txt`
  - 线上 `reporterType=user && status in [open,in_progress]` 当前 `count=0`
- [x] 全量线上反馈已清零
  - `temp/feedback-closeout/update-feedback-status-20260507-final-watchdog-batch.raw.txt`
  - `temp/feedback-closeout/query-all-open-inprogress-after-final-watchdog-batch-20260507.raw.txt`
  - `temp/feedback-closeout/query-all-open-inprogress-current-20260507.raw.txt`
  - 截至 `2026-05-07 21:25 +08`，生产真源 `open/in_progress = 0`
  - 本轮最后 `21` 条 watchdog 系统单已完成正式回写：`resolved = 9`、`closed = 12`
  - 当前可以正式宣称“线上人类反馈已清零，系统反馈也已清零，所有反馈都已修好”

## Addendum（2026-05-07 21:25 +08）：最后 21 条 watchdog 系统反馈正式清零

- [x] 生产真源回写前盘面核对完成
  - 回写前真实待清批次是 `21` 条，另有 `69fb3fde... / 69fc6298...` 已在本轮更早一拍单独回写
  - 这 `21` 条全部来自 `reporterType=system`、`source=online-ai-watchdog`
- [x] 判定口径已落地
  - `force-end-turn-failed ...` 与 `unsatisfiable-interaction-auto-skipped empty-options` 按 `resolved`
  - `force-end-turn-success ...` 按 `closed`
- [x] 最后一批生产正式回写完成
  - 回写时间：`2026-05-07 21:08:22 +08`
  - 回写结果：`resolved.matchedCount=9 / modifiedCount=9`，`closed.matchedCount=12 / modifiedCount=12`
- [x] 本地状态板已同步补入并准备校验
  - `temp/feedback-closeout/status-board.json`
- [x] 最终复核已确认线上全量清零
  - `temp/feedback-closeout/query-all-open-inprogress-current-20260507.raw.txt`
  - 截至 `2026-05-07 21:25 +08`：`totalOpenOrInProgress=0`、`humanOpen=0`

## Addendum（2026-05-07 21:52 +08）：`69fc6298` 短暂重开后再次清零

- [x] `69fc62984a37805e1526f6d9` 在生产真源短暂回到 `open`
  - fresh 生产直查结果：`totalOpenOrInProgress=1`、`humanOpen=0`
- [x] 复核同局 `bSJjqanl8rO` 的日志后确认这是同一系统聚合项的再刷
  - watchdog 已继续把局面从 `scoreBases -> draw -> playCards` 推进收口
  - 这条仍按失败类系统单回写 `resolved`
- [x] 生产再次回写成功
  - `matchedCount=1 / modifiedCount=1`
  - 目标：`69fc62984a37805e1526f6d9`
- [x] 最新复核再次确认全量清零
  - `totalOpenOrInProgress=0`
  - `humanOpen=0`
  - 当前最终口径仍是“所有反馈已清零”

## Addendum（2026-05-07 22:00 +08）：fresh 生产直查仍为全量清零

- [x] 最新生产直查结果
  - `ts=2026-05-07T14:00:21.653Z`
  - `totalOpenOrInProgress=0`
  - `humanOpen=0`
- [x] 当前最终口径再次确认不变
  - 线上人类反馈已清零
  - 系统 watchdog 反馈已清零
  - 所有反馈已清零

## Addendum（2026-05-09 23:58 +08）：新一批人工反馈继续处理

- [x] 生产 Mongo 重新拉取人工 open/in_progress
  - 截至 `2026-05-09 20:40:30 +08`：8 条人工未收口。
  - 本地状态板：`temp/feedback-closeout/status-board.json` 已补入新批次。
- [x] 优先修复 3 条 SmashUp critical 扩展基地反馈
  - `69feca4bf0a61f28ba015d7e`：印斯茅斯弃牌区为空时无法发动/跳过。
  - `69fecbb9f0a61f28ba015d9e`：印斯茅斯效果触发不了。
  - `69fec94df0a61f28ba015d49`：温室无法执行。
  - 根因：queued reaction 执行器 effect contract 缺少 `controllerState`，运行时读取 `state.players.*` 时抛错。
- [x] 已补修复与验证
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
  - 证据：`evidence/smashup/smashup-feedback-20260509-expansion-base-effect-contract.md`
- [x] 已回写 3 条生产反馈为 `resolved`
  - `69fec94df0a61f28ba015d49` 本轮脚本实际 `matched=1 / modified=1`
  - `69feca4bf0a61f28ba015d7e`、`69fecbb9f0a61f28ba015d9e` 回写前已是 `resolved`
- [x] 已修复 `69feac13f0a61f28ba015c93` 巫师空牌库抽牌/揭示反馈
  - `wizard_neophyte` 空牌库走 `peekDeckTop`，POD 学徒可先洗弃牌堆再揭示。
  - `wizard_enchantress`、`wizard_mystic_studies`、`wizard_sacrifice` 改走 `buildStandardDrawEvents`，避免空牌库时只记录抽牌但最终手牌未增加。
  - 验证：`factionAbilities.test.ts -t "69feac13"` 3 passed；整文件 46 passed；eslint 0 errors。
  - 证据：`evidence/smashup/smashup-wizard-neophyte-empty-deck-feedback-2026-05-09.md`
- [x] 已回写 `69feac13f0a61f28ba015c93` 生产反馈为 `resolved` 并复查剩余未收口数量
- [x] 已修复并回写 `69feede0f0a61f28ba0163df` 泰坦场下询问反馈
  - 根因：`werewolves_great_wolf_spirit` 的 `onTurnStart` 被错误登记为 `global`，场下 setaside 泰坦也会被 `collectTriggers()` 放入 reaction queue。
  - 修复：移除巨狼之灵 `global` 触发注册，删除重复注册块，同步 `e2e/src` 镜像。
  - 验证：`turnCycle -t 线上反馈 69feede0` 1 passed；`smashup.smoke -t Great Wolf Spirit creates a start-of-turn move interaction` 1 passed；eslint 0 errors。
  - 证据：`evidence/smashup/smashup-great-wolf-spirit-setaside-feedback-2026-05-09.md`
  - 生产回写：`matched=1 / modified=1`
- [x] 最新生产剩余人工/反馈弹窗队列已重新拉取并同步状态板
  - 截至 `2026-05-10 02:55 +08`：`remainingHumanOrModalOpenInProgress.count = 5`
  - 新增两条：`69ff7291f0a61f28ba0189b9` 实验工坊有bug；`69ff720cf0a61f28ba01897d` 非常多bug，海盗的bug很多。
- [x] 继续处理剩余 5 条：Cardia 教程、SmashUp AI/卡住、实验工坊、海盗反馈等。
- [x] 已修复并回写 `69ff7291f0a61f28ba0189b9` 实验工坊反馈
  - 根因：实验工坊/同类基地把“本回合该基地已打出随从次数”放在 queued trigger 执行期读取，并声明 `playLimits`，与大法师写 `playLimits` 误判为强制触发排序冲突。
  - 修复：基地能力支持 `canTrigger` 入队前预筛；实验工坊/集会场/名人堂不再在 queued 执行期读取出牌计数字段，避免残留 `triggerQueue` 或弹无意义排序窗口。
  - 验证：`archmageE2E` 聚焦 `69ff7291` 1 passed，整文件 9 passed；`newBaseAbilities` 实验工坊/集会场 7 passed；`expansionBaseAbilities` 名人堂 1 passed；eslint 0 errors。
  - 证据：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
  - 生产 Mongo 回写：`matchedCount=1 / modifiedCount=1`；回写后剩余人工/反馈弹窗 open/in_progress 为 4 条。
- [x] 已补充 `69ff7291f0a61f28ba0189b9` 旧生产持久化队列兼容复核
  - 发现：生产快照中的 `base_laboratorium` trigger 已持久化旧 `effectContract.reads`，需要证明旧局也能恢复。
  - 补充：`reactionOrdering` 物化排序 contract 时兼容旧版实验工坊/集会场首随从基地触发；新增旧队列回归。
  - 验证：生产快照只读灌入 `maybeResolveReactionQueue` 后 `triggerQueueLength=0 / currentInteractionSourceId=null / archmagePowerCounters=1 / actionLimit=2`；`newBaseAbilities` 59 passed；`reactionQueueOrdering` 18 passed。
  - 证据已修订：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
- [x] 已回写 `69ff720cf0a61f28ba01897d` 海盗泛反馈为同根因 `resolved`
  - 现场：用户描述泛称海盗 bug，但快照实际为 `robot_hoverbot` 打到 `base_laboratorium` 后残留旧实验工坊 trigger。
  - 验证：生产快照只读灌入 `maybeResolveReactionQueue` 后 `triggerQueueLength=0 / currentInteractionSourceId=null / hoverbotPowerCounters=1 / consumedEvents=1`。
  - 证据：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
  - 生产 Mongo 回写：`matchedCount=1 / modifiedCount=1`；fresh 后剩余人工/反馈弹窗 open/in_progress 为 3 条。

## Addendum（2026-05-10 05:36 +08）：5/10 本批人工反馈清零

- [x] 剩余 3 条人工/反馈弹窗 open 已全部收口并回写生产 Mongo。
  - `69ff0e90f0a61f28ba016a4d` Cardia 教程反馈：`resolved`，证据 `evidence/cardia/cardia-tutorial-full-flow-e2e-test.md`
  - `69ff0cd0f0a61f28ba0169e9` SmashUp AI 出牌阶段卡死：`resolved`，回写产物 `temp/feedback-closeout/update-feedback-status-20260510-69ff0cd0-ai-playcards-stalled-to-resolved.raw.txt`，`matched=1 / modified=1`
  - `69ff0310f0a61f28ba0167d6` SmashUp 天选之人确认交互卡住：`resolved`，回写产物 `temp/feedback-closeout/update-feedback-status-20260510-69ff0310-cthulhu-chosen-confirm-to-resolved.raw.txt`，`matched=1 / modified=1`
- [x] 已补齐 69ff0310 浏览器 UI 证据链。
  - E2E：`npm run test:e2e:ci:file -- e2e/smashup/smashup-cthulhu.e2e.ts "线上反馈 69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭"` -> `1 passed`
  - 截图 1：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-cthulhu.e2e\线上反馈-69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭\69ff0310-chosen-confirm-button-overlay.png`
  - 截图 2：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-cthulhu.e2e\线上反馈-69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭\69ff0310-chosen-confirm-after-no.png`
- [x] 已补充 69ff0cd0 最新回归验证。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts --configLoader native --maxWorkers 1 -t "69ff0cd0|base_the_mothership"` -> `6 passed`
- [x] 本地状态板已更新并通过校验。
  - `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` -> `feedback-status: ok`
- [x] fresh 生产真源清零核对完成。
  - 查询产物：`temp/feedback-closeout/query-open-human-final-20260510.raw.txt`
  - 截至 `2026-05-10 05:35 +08`，生产 Mongo 人工/feedback-modal `open/in_progress`：`count=0`

## Addendum（2026-05-12 08:38 +08）：shayu 第一入口直接消费专项重审

- [x] 承认并修正审计缺口：此前全量矩阵偏静态，没有强制检查“payload/UI 已确定第一入口后 handler 是否直接消费”。
- [x] 通用规范补强：`docs/ai-rules/testing-audit.md` 新增“第一入口已确定时不得二次创建同 targetType prompt”的最低门禁。
- [x] 专项全量清单已落地：`evidence/smashup/smashup-shayu-entry-consumption-audit-2026-05-12.md` 覆盖 39 卡 + 6 基地的入口来源、第一入口、handler 消费结论与证据等级。
- [x] 已修复 3 个本轮发现项：宙斯的恩惠二次 base prompt、卷走二次 minion prompt、不在堪萨斯替换后误触发新基地 onActionPlayed。
- [x] 已补 L2 验证：新增 `shayuEntryConsumption.test.ts`，并更新 `shayuFactionAbilities.test.ts` 的卷走真实入口用例。
- [ ] 未完成/不得宣称：本轮追加复跑 3 条高风险真实入口 E2E；仍不能宣称 45 对象逐项 L3 E2E；Argonaut 跨派系 action-trigger 泛化仍是后续专项。


## Addendum（2026-05-12 08:46 +08）：shayu 高风险入口 E2E 复跑

- [x] 已修正 `e2e/smashup-shayu-factions.e2e.ts` 中 `tornados_carried_away` 旧流程：不再等待二次 minion prompt，直接等待 `tornados_carried_away_dest` 目标基地 prompt。
- [x] 已复跑 3 条真实入口 E2E：Carried Away 真实手牌入口、Not in Kansas 基地替换、Tornado Alley 首次/二次移入。
- [x] 已实际打开截图核对，并回写 `evidence/smashup/smashup-shayu-entry-consumption-audit-2026-05-12.md`。
- [ ] 仍不得宣称：这不是 45 对象逐项 L3 E2E，只是高风险入口链追加 L3。

## Addendum（2026-05-12）：审计默认口径升级为全面审计

- [x] 已更新 `docs/ai-rules/testing-audit.md`：未限定的“审计”默认等于全面审计；抽样/专项/L1 必须显式标注，不得简称“已审计”。
- [x] 已建立 shayu 全面审计 guard：`temp/smashup-shayu-comprehensive-audit-2026-05-12.json`。
- [x] 已建立 45 对象覆盖矩阵：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- [ ] 当前仍未完成：全量 L2、全交互 L3、全部时序/窗口/队列 L4 还要继续补。


## Addendum（2026-05-12 22:50 +08）：shayu 全面审计 L2 补强批次

- [x] 扩展 `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 到 12 条 L2 行为测试。
- [x] 新增覆盖：`sharks_chum`、`base_the_deep`、`mythic_greeks_favor_of_hades`、`base_trailer_park`、`base_tornado_alley`。
- [x] 验证：`npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 12 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- [x] 已回写 comprehensive coverage 矩阵与 guard evidence。
- [ ] 仍未完成：C3 45 对象逐行 L2 核销、C4 全交互 L3/代表链、C5 全时序/窗口/队列 L4、C6 旧 evidence 全部降级回写。


## Addendum（2026-05-12 23:50 +08）：L3 真实入口补强批次

- 已补强并实际看图核对 2 条高风险 E2E：
  - Sharks：大白鲨结算辅助、飞鲨真实入口、激光束真实入口。
  - Mythic Greeks / Tornados：哈迪斯、宙斯、雅典娜、信风真实入口。
- 本批新截图与肉眼结论已回写总入口：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- 重要限定：`sharks_great_white` 这次仍由 test harness dispatch 触发天赋，只能算结算辅助证据，不算完整真实 UI 天赋入口 L3。
- 当前可升级为 L3 的对象：`sharks_air_jaws`、`sharks_freakin_laser_beam`、`mythic_greeks_favor_of_hades`、`mythic_greeks_favor_of_zeus`、`mythic_greeks_favor_of_athena`、`tornados_trade_winds`。
- 当前仍不得宣称全面审计完成：45 对象全量 L2 核销、全部 L3 代表链、全部 L4 时序治理仍未完成。


### 2026-05-13 00:03 +08 全文件 E2E 回归补充

- 补跑整文件：`$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 说明：第一次整文件复跑被同类 E2E heavy-task guard 拦截；确认使用隔离 runtime 后显式允许并发并通过。
- 该结果证明 `e2e/smashup-shayu-factions.e2e.ts` 当前 14 条代表性真实入口/时序链没有被本轮测试修正破坏；仍不等于 45 对象全量 L3/L4 完成。


## Addendum（2026-05-13 00:16 +08）：C3 全量 L2 核销

- 新增 `tornados_twister` 旋风 push/pull L2 行为测试。
- `shayuComprehensiveBehavior.test.ts` 当前 13 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 0 errors。
- 已在全面审计总入口逐对象写清 45/45 的 L2 行为证据来源；C3 可标 pass。
- 仍未完成：C4 全交互 L3/代表链截图归档、C5 全部时序/窗口/队列 L4、C6 最终修复/旧 evidence 全量回写。


## Addendum（2026-05-13 00:55 +08）：全面审计 C4/C5/C6 回写

- 总入口仍是 `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- `sharks_great_white` 已重新用真实 UI 点击随从触发天赋，旧“仅 harness 辅助”结论失效。
- C4 已逐对象归档：所有真实 UI 交互入口均为独立 L3 或等价代表链；无用户入口对象显式标记 C4 不适用。
- C5 已逐家族归档：beforeScoring、afterScoring、base replace、once/turn、action-trigger、base trigger、destroy trigger、multi/order/continuationContext 均有 L4 或系统代表链证据。
- C6 已完成回写；最终是否 COMPLETE 以 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json` 与 guard 检查为准。


## 2026-05-13 01:03 +08 最终回归验证

- `npx eslint e2e/smashup-shayu-factions.e2e.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 13 passed。
- `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 本轮实际核对截图包括：
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-talent-destination-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-after-move-destroy.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`

## Addendum（2026-05-15 08:13 +08）：Twister 后 shayu 完整技能流程再审计

- [x] 已建立并完成 post-Twister 防早停 guard：`temp/smashup-shayu-post-twister-loop-2026-05-15.json`。
- [x] 已新增完整技能流程矩阵：`evidence/smashup/smashup-shayu-post-twister-complete-flow-audit-2026-05-15.md`，覆盖 Sharks 12 + Tornados 12 + Mythic Greeks 15 + shayu 基地 6，共 45 对象。
- [x] 已把 Twister 反馈新增的不变量应用回全集：凡“你可以 / 至多 / 任意数量”必须有拒绝/空选证据，或明确说明可选性由激活入口承载。
- [x] 已完成 3 条不同机制家族全链路抽查：Twister 可选跳过、Athena/Trade Winds 多步链、Gone with the Wind afterScoring 链。
- [x] 本轮未发现新的实现错误；因此没有触发 Twister 可选否定路径之外的新规范升级。
- [ ] 未执行提交、push、部署，也未把生产反馈状态改为 resolved。
