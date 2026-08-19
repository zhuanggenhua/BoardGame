# 自动化测试

> 本文档是项目测试运行、工具 API、启动链和产物目录的主入口，不是所有测试验收规则的唯一正文。E2E 入口、截图证据和视觉验收以 [`.spec/knowledge/README.md`](../.spec/knowledge/README.md) 路由的项目标准为准；引擎系统与原语规范见 [`.spec/knowledge/standards/engine-systems.md`](../.spec/knowledge/standards/engine-systems.md)。

## 目录

- [快速开始](#快速开始)
- [测试隔离与性能](#测试隔离与性能)
- [测试框架与工具](#测试框架与工具)
- [测试策略](#测试策略)
- [不可复现问题的证据式收口](#不可复现问题的证据式收口)
- [E2E 测试](#e2e-测试)
- [API 测试](#api-测试)
- [GameTestRunner](#gametestrunner)
- [调试工具](#调试工具)
- [持续集成](#持续集成)

---

## 快速开始

> **Windows / Codex / AI 终端注意**：单文件 / 单用例 E2E 优先直连 `node scripts/infra/run-e2e-command.mjs ...` 或 `node scripts/infra/run-e2e-single.mjs ...`，不要优先用 `npm run test:e2e:*`；否则会经过 `npm.cmd -> cmd.exe`，产生可见黑框。

```bash
# 默认先跑增量测试（基于 origin/main）
npm run test:changed

# 明确需要时再跑全量
npm test

# 运行特定游戏的测试（推荐开发时使用）
npm run test:summonerwars    # Summoner Wars
npm run test:smashup         # Smash Up
npm run test:dicethrone      # Dice Throne
npm run test:tictactoe       # Tic Tac Toe

# 运行核心框架测试
npm run test:core            # 引擎、组件、工具库

# 运行其他模块测试
npm run test:server          # 服务端测试
npm run test:ugc             # UGC 系统测试
npm run test:games           # 所有游戏测试
npm run test:api             # API 测试

# 监听模式（开发时使用）
npm run test:watch

# E2E 测试
npm run test:e2e
```

### 过滤运行 Vitest 测试

```bash
npm test -- audio.config                        # 匹配文件名/路径
npm test -- src/ugc/builder                     # 匹配目录
npm test -- src/games/tictactoe/__tests__       # 游戏测试目录
npm test -- src/games/tictactoe/__tests__/flow.test.ts  # 单文件
```

### 开发工作流建议

1. **默认先跑增量测试**：只验证相对 `origin/main` 的改动（最快反馈）
   ```bash
   npm run test:changed
   ```

2. **开发特定游戏时**：只运行该游戏的测试（快速反馈）
   ```bash
   npm run test:smashup  # 2-3分钟
   ```

3. **修改核心框架时**：先运行核心测试，再运行游戏测试
   ```bash
   npm run test:core     # 1-2分钟
   ```

4. **特殊情况再扩大范围**（如引擎层改动、跨游戏联动、用户明确要求）
   ```bash
   npm run test:games:core  # 3-5分钟（排除 property/audit/E2E）
   ```

5. **调试单个测试文件**：最快的方式
   ```bash
   npm run test -- myFeature.test.ts  # 10-60秒
   ```

6. **仅在 CI/明确要求时**：运行完整测试套件
   ```bash
   npm test  # 10-15分钟
   ```

### 测试性能参考

| 测试范围 | 预计时间 | 说明 |
|---------|---------|------|
| 单个测试文件 | 10-60秒 | 最快，推荐开发时使用 |
| 单个游戏 | 2-3分钟 | 包含该游戏的所有测试 |
| 核心游戏测试 | 3-5分钟 | 排除 property/audit/E2E |
| 所有游戏测试 | 5-10分钟 | 包含 property-based 测试 |
| 完整测试套件 | 10-15分钟 | 包含所有模块 |

**注意**：测试时间受机器性能影响。如果遇到超时，参考 `docs/testing-best-practices.md` 中的性能优化建议。

### 测试推进默认节奏

1. **先锁问题位点，再写或跑对应验证**：默认先用最靠近问题语义的验证层锁定位点，例如 `Vitest / GameTestRunner / 代表态注入 / 单条页面链`，不要一上来就从主页或完整对局起跑。
2. **先推进实现，再做收口回归**：测试驱动不等于长时间停在“反复跑 E2E 看哪里又不对”；默认节奏应是`最小证据锁位 -> 改实现 -> 最窄回归收口`。
3. **长链 E2E 不是主调试器**：当同一问题已经在长链里失败一次，却仍未直接命中问题位点时，优先退回状态注入、局部合同或更低层测试；不要继续把整局自然链当默认调试循环。
4. **游戏流程里的“开局”默认不是主页漏斗**：如果目标是验证游戏内流程、牌桌交互、HUD、结算或刷新恢复，默认从 `game route / match route / 代表态` 起跑；主页、创建房间、加入房间另算入口合同。详细规则见 [`.spec/knowledge/standards/e2e-verification.md`](../.spec/knowledge/standards/e2e-verification.md)。

### 测试前置依赖与运行模式（强制）

- **E2E 素材自动准备**：标准入口 `node scripts/infra/run-e2e-command.mjs ... e2e/<gameId>/...` 或 `run-e2e-single.mjs` 会在启动测试服务前自动按 `gameId` 从服务器素材主源补齐本地缺失运行时素材；已有文件按服务器 SHA-256 自动跳过。共享音频只补齐精简运行时注册表引用的对象，不会把全站音频一起下载。测试者不需要手动记住下载步骤。只列举用例（`--list`）不下载；共享测试或无明确游戏目录的测试不自动扩大到全站素材。
- **手动按游戏补齐素材**：`npm run assets:download -- --game <gameId>`；多个游戏可重复 `--game`。只有确实需要完整运行时镜像时才显式使用 `npm run assets:download -- --all`。

- **缺依赖先补齐再重试原命令**：若失败明确指向仓库已声明的 Node 包、Playwright 浏览器、构建工具或测试运行时，先按当前 lockfile 和项目包管理入口安装必要依赖，再重跑同一条命令。不得把依赖失败改写成业务失败，也不得跳过该测试或换旁路命令冒充通过。
- **外部服务不作为默认安装门槛**：Docker、外部 MongoDB、Redis 等系统服务只有在目标测试实际验证其行为时才需要启用；先使用项目已有的 lite、内存存储或测试内存服务。系统级软件不因普通测试失败而擅自安装。
- **运行模式按目标升级**：规则 / 引擎 / 游戏 UI 默认走最窄的 Vitest、GameTestRunner 或状态注入 E2E；只有认证、社交、后台、保存恢复、排行榜归档、真实持久化兼容性等目标，才升级到 API / 外部数据库相关测试。
- **依赖安装仍失败时才报告阻塞**：必须写明缺少的现实依赖、它阻止哪条测试链、已执行的安装动作和最小补救；不能用改测试、删断言、跳过用例或临时 mock 代替原验证。

### TDD 与业务变更边界

项目 AI 对“TDD / 回归测试 / 阻断测试 / 截图 evidence / playtest”的判断主源是 [`.spec/knowledge/standards/testing-tdd.md`](../.spec/knowledge/standards/testing-tdd.md)。本文只保留测试命令、runner、fixture 和工具 API，避免把同一规则维护成第二套正文。

工具侧摘要：

- 游戏规则、状态机、结算、保存、同步、资源索引和公开协议，优先用 GameTestRunner、契约测试或最窄 E2E 保护。
- UI 视觉恢复、样式微调、槽位复原、单个资源接线、玩法手感和频繁变化业务，默认不新增阻断测试；需要留证时用截图、git 历史、smoke、playtest 或 evidence。
- 严格 TDD 必须先有 RED；先实现后补测应称为回归、契约或验收保护。
- 新增阻断测试前必须先说明：保护的长期玩家结果、现有证据为什么不够、测试 seam 为什么稳定。

---

## 测试隔离与性能

项目采用测试隔离策略，将测试分为多个独立模块，支持选择性运行和并行测试。

### 测试模块划分

| 模块 | 命令 |
|------|------|
| Summoner Wars | `npm run test:summonerwars` |
| Smash Up | `npm run test:smashup` |
| Dice Throne | `npm run test:dicethrone` |
| Tic Tac Toe | `npm run test:tictactoe` |
| 核心框架 | `npm run test:core` |
| 服务端 | `npm run test:server` |
| UGC 系统 | `npm run test:ugc` |
| API | `npm run test:api` |
| 全量 | `npm test` |

### 何时运行全量测试

默认先执行 `npm run test:changed`，满足任一条件再扩大范围：
- 修改 `src/engine/`（含 `primitives/` 与 `systems/`）、`src/core/`、`src/components/game/framework/`
- 涉及多人联机、状态同步、Undo/Rematch/Prompt 等系统性行为
- 涉及公共类型/协议
- CI 回归或用户明确要求

---

## 测试框架与工具

### 测试框架

| 框架 | 用途 |
|------|------|
| Vitest | 游戏领域层测试 + API 集成测试 |
| Playwright | 浏览器级 E2E（默认状态注入；按需真实链路） |
| GameTestRunner | 游戏领域层专用测试运行器（命令序列 → pipeline → 状态断言） |

### 引擎层审计工具（`src/engine/testing/`）

> **GameTestRunner 行为测试是最优先、最可靠的测试手段**。审计工具是补充，用于批量覆盖 GameTestRunner 无法高效覆盖的注册表引用完整性和交互链完整性。
> 详细规范见 [`.spec/knowledge/standards/engine-systems.md`](../.spec/knowledge/standards/engine-systems.md) 的引擎层系统与原语清单。

| 工具 | 文件 | 用途 |
|------|------|------|
| GameTestRunner | `index.ts` | 命令序列执行 + 状态断言，所有游戏首选 |
| entityIntegritySuite | `entityIntegritySuite.ts` | 数据定义契约验证（注册表完整性/引用链/触发路径/效果契约） |
| referenceValidator | `referenceValidator.ts` | 实体引用链提取与验证 |
| interactionChainAudit | `interactionChainAudit.ts` | UI 状态机 payload 覆盖审计（模式 A） |
| interactionCompletenessAudit | `interactionCompletenessAudit.ts` | Interaction handler 注册覆盖审计（模式 B） |

新增游戏时根据游戏特征选择需要的审计工具：
- 所有游戏（必选）→ GameTestRunner
- 有注册表 + 数据定义（≥20 个实体）→ entityIntegritySuite
- 有多步 UI 交互 → interactionChainAudit
- 有 InteractionSystem → interactionCompletenessAudit

### 目录结构

```
/
├── e2e/                          # Playwright E2E 测试
├── apps/api/test/                # API 集成测试
├── src/engine/testing/           # 引擎层测试工具
└── src/games/<gameId>/__tests__/ # 游戏领域测试
```

---

## 测试策略

### 统一测试标准

本项目测试统一遵循 TDD 行为 seam 原则：测试保护公开行为，不保护实现细节。修 bug 或重构时，如果测试需要大面积同步修改，必须先判断是否存在以下问题：

- 测试直接读取内部系统状态而不是通过测试 helper 表达行为。
- 测试断言项目自有模块的调用次数/调用顺序。
- 同一测试在 `src/` 与镜像目录中重复维护。
- 巨型测试文件继续承载无关行为簇。

默认收敛方向：

- 游戏规则与命令行为优先用 `GameTestRunner` / 游戏专用 `runCommand` / `executePipeline` helper。
- 交互链优先使用游戏专用 prompt facade，不在用例中散落直读 `sys.interaction`。
- 确实需要保留 low-level ability / interaction / runtime resolver 合同时，优先通过 `__tests__/helpers.ts` 里的显式 contract helper 进入，不在测试体里直接 `resolveAbility(...)` 或手摸 handler registry。
- UI 交互只用 E2E 证明真实入口与可见结果。
- 审计测试用于批量合同验证，不代替单个 bug 的最小行为回归。
- 重构导致测试频繁跟改时，先补测试接口/行为端口，再改用例；测试文件不直接适配内部字段形状。

### 新增阻断测试前必须先锁定合同

- 会让后续提交失败的测试，只能用来锁**已经确认会长期成立的公开行为合同**，不能拿来冻结临时判断。
- 新增、改写或删除测试前，必须先阅读本文件；如果当前判断涉及测试分层、测试 seam、是否该先补夹具/代表态，再补读 `docs/testing-best-practices.md`。
- 新增测试前必须先写出“为什么现有验证不够”：现有单测、现有 E2E、类型检查、截图证据、git 历史对照或人工验收若已经覆盖本轮风险，不得再新增同义阻断测试。
- 以下情况默认**不新增阻断测试**：只改资源路径/资源语义、恢复旧 UI 外形、删除错误缺失提示、修正文案/样式微调、用户当轮未要求冻结的视觉布局、仍在频繁调整的业务规则或交互草案。需要留证时写 evidence 或复用既有截图链。
- 下列对象在真相源未明确前，默认**不得**直接写成阻断测试：
  - `是否仍属实施中`
  - 灰度/功能开关
  - 接入名单、显示名单、排序位
  - 临时 allowlist / denylist
  - 运营状态、发布状态、接入阶段
- 这类状态如果还可能被作者、产品、需求方继续调整，测试一旦落库，就会把“尚未定案的选择”伪装成“稳定业务真相”，后续有意修改也会被门禁拦住。
- 允许写成阻断测试的最低前提，至少满足其一：
  - 已有规格、需求文档或规则文档明确把它定义为长期合同；
  - 用户当轮已明确裁定该状态就是本轮要锁定的结果；
  - 作者或维护者已明确说明这是有意保留的长期选择；
  - 仓库现有行为、历史证据与验收口径已经一致证明它不是临时接入状态，而是正式业务规则。
- 如果上述前提不成立，默认动作不是“先加测试再说”，而是退回到更窄的证据层：人工核对、审计说明、临时验证记录，或只给真正稳定的玩法/交互/结算逻辑补测试。

### `e2e/src` Junction 口径

- `src/games/**/__tests__` 是游戏 Vitest 行为测试的权威来源。
- `e2e/src/**` 是本地 Junction 兼容入口，不再作为 Git 跟踪内容，任何文件都不得通过该镜像路径入库。
- 新增或重构游戏行为测试时，只在 `src/games/**/__tests__` 下建立或移动用例，不再同步第二份 `e2e/src/games` 镜像。
- E2E 文件引用源码时，使用从当前文件到仓库根 `src/` 的真实相对路径；不要通过 `e2e/src` 旧镜像绕路。
- 新增或迁出的游戏行为测试必须可运行，不得携带 `it.skip` / `test.skip` / `describe.skip`。旧 skipped 用例只有在补齐真实行为链路并跑绿后才允许迁入新的聚焦文件。

### E2E 目录入口口径

- 新增游戏 E2E 必须放在 `e2e/<gameId>/` 下；根级 `e2e/*.e2e.ts` 只保留跨游戏/共享入口或尚未迁移的历史债务。
- 禁止继续为同一游戏维护“根级文件 + 子目录文件”双入口。清理重复入口时，应保留子目录规范文件，并用 Playwright `--list` 或目标用例验证发现规则没有被 `testIgnore` 误伤。
- `e2e/<gameId>/legacy-root/` 是历史根级用例迁移目录，只用于保留根级独有覆盖；新增测试不得放入该目录。
- 根级历史债务允许逐步收敛，但不得继续追加新场景；新增场景应进入对应游戏子目录并按行为簇命名。

### 测试覆盖要求

| 类别 | 覆盖点 |
|------|--------|
| 基础流程 | 初始状态、状态流转、正常结束 |
| 核心机制 | 触发条件、实际效果（与描述一致）、状态变更、资源获取/消耗 |
| 数据驱动 | 效果与描述完全一致、状态变化、副作用正确性 |
| 升级系统 | 逐级升级、跳级拒绝、费用计算、最高级处理 |
| 错误处理 | 非法操作拒绝、前置条件拒绝、错误码正确性 |
| 边界条件 | 数值上下限、特殊触发、并发/竞态 |
| 静态审计 | 注册表完整性、交互链覆盖（使用引擎层审计工厂） |
| **集成链路** | **每个需要 Interaction 的能力至少 1 条 execute() 完整链路测试** |
| E2E | 入口 → 关键交互 → 完成/退出；教程需验证 AI 回合 |

### 集成链路测试规范（强制）

> 教训：单元测试直接调用能力函数（如 `triggerBaseAbility`）时会自动传递 `matchState` 参数，
> 但 reducer 层可能漏传参数导致 Interaction 类能力静默失败。单元测试全绿不代表完整链路正确。

**规则**：每个通过 `matchState` / `queueInteraction` 创建交互的能力，必须至少有 1 条通过 `execute()` 走完整链路的集成测试，验证：
1. `execute()` 返回的事件列表正确
2. 通过游戏 prompt facade 能读到对应玩家提示（sourceId / 选项 / 可响应对象匹配）
3. 通过 facade 响应该提示后，最终玩家结果或交互收口正确

**参考**：`src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`

### 精简策略（同类覆盖保留）

目标：减少低价值用例数量，保持每个"交互类别/能力类别"至少 1 条代表性用例。

**为什么需要精简**：
- **运行成本**：用例越多，CI/本地运行时间越长，反馈变慢
- **稳定性成本**：同类用例越多，受到波动/偶发失败影响的概率越高
- **维护成本**：UI/文案/流程调整会同时破坏大量重复用例
- **噪声成本**：大量相似失败会掩盖真正的高价值回归

**例外（必须保持多样化覆盖的场景）**：
- 素材/配置差异高（例如角色选择、资源加载、图片缺失）：需要按数据维度保留或改为数据驱动的完整性检查

**低价值用例判定（可删除/合并）**：
- 只验证"出现/可见"的静态用例，且在其它测试中已有同一路径的功能性操作
- 与"创建/更新/删除/保存"同类行为重复，仅验证列表/计数/标题等弱断言
- 同一个交互链条被拆成多个短用例，但没有新增失败分支或独立状态变化
- 仅为截图存在的用例（无断言或无状态变化）

**必须保留的同类覆盖（最少 1 条）**：
- 入口可达 + 关键操作 + 结果验证（例如：创建→保存→刷新恢复）
- 关键交互面（Modal/Tab/表单校验/多步骤选择）每类至少 1 条
- 负向或边界至少 1 条（如未登录/非法操作被拒绝）

### 测试命名规范

- 正向测试：描述预期行为（`"成功创建用户"`）
- 错误测试：标注错误码（`"无权限操作 - unauthorized"`）

### 测试文件组织规范

- 文件名必须表达测试对象和行为，例如 `audio/faction-audio-config.test.ts`、`prompts/alien-probe-choice.test.ts`、`abilities/cowboys-duel.test.ts`。
- 新增游戏行为测试默认放在 `src/games/<gameId>/__tests__/` 下，按能力簇、交互簇、配置合同或页面行为建立子目录。
- 禁止新增或继续扩写 `new*`、`misc`、`regression`、`feedback`、`fixes` 等泛名测试文件；遇到这类文件时，应先判断能否迁出本轮相关行为簇。
- 同类覆盖只保留必要代表性路径：至少 1 条正向主路径，必要时 1 条负向/边界路径；重复数据面优先改成数据驱动或审计合同，不用多个近似用例堆在同一文件。
- `e2e/src/games/**/__tests__` 不作为新增游戏行为测试目录；若本地 Junction 存在，也只能视为兼容入口，不得入库。
- `quality:changed` 会调用 `scripts/infra/testing-structure-guard.mjs` 检查游戏测试结构；本地也可直接运行 `npm run test:structure`。该门禁会阻止 `e2e/src/**` 镜像入库、新增根级游戏 E2E、新增泛名测试文件、临时/备份/测试输出文件入库，并阻止非系统契约游戏测试新增裸 prompt 内部访问，包括 `getInteractionsFromMS`、`prompt.data.options`、`SYS_INTERACTION_RESPOND`、`sys.interaction.current`、`resolveAbility(...)`、`getInteractionHandler(...)`、`getAbilityRuntimePromptHandler(...)`，同时阻止新增测试调试日志 `console.log/warn/error/debug`；旧泛名文件净删减时只警告，迁出的聚焦测试必须改走 facade。

### 测试接口规范

- 测试接口是测试可持续性的主要边界：实现重构可以改变内部模块、字段和 handler，但不应迫使业务测试逐个改断言。
- 新增交互能力测试时，优先扩展对应游戏的 prompt facade；测试体只通过 facade 读取 prompt、选择候选和响应交互。
- 如果测试目标是防止“界面上有按钮但玩家实际点不了 / 点了不生效”，正确写法是：用 facade 或 E2E 找到玩家可见选项，用公开响应 helper 或真实点击提交，再断言最终状态、日志、反馈或交互关闭；不要只断言内部 prompt 存在。
- 禁止把“直接读内部字段更方便”当作默认理由。只有测试目标就是底层系统契约时，才允许直读内部字段，并应把测试放到对应系统测试文件中。
- Smash Up 交互测试的默认端口包括 `getSimpleChoicePrompt`、`getPromptOption`、`respondToPrompt`、`respondToPromptOptions`、`expectNoPrompt`、`getReactionPrompt` 与 `getReactionPromptOptionBySourceDefId`；缺少表达力时先补 helper，再改用例。

### 测试最佳实践

1. 测试文件命名：`*.test.ts` 或 `*.test.tsx`
2. 测试文件位置：`__tests__` 目录下
3. 测试描述：使用中文描述测试用例
4. 测试隔离：每个测试应该独立，不依赖其他测试的状态
5. 快照测试：谨慎使用，优先使用断言
6. 异步测试：使用 `async/await`，设置合理的超时时间
7. **随机数处理（强制）**：测试中涉及随机数（骰子、抽牌、洗牌等）时，必须使用固定值或可控的伪随机序列，禁止依赖真随机。做法：
   - GameTestRunner 的 `random` 参数传入返回固定值的函数（如 `() => 0.5`）
   - E2E 测试使用 `applyDiceValues` 等调试面板 API 注入预设骰子值
   - 测试 setup 中直接构造确定性初始状态，跳过随机初始化
   - 目的：确保测试结果可重复、可调试、不因随机波动导致偶发失败

---

## 不可复现问题的证据式收口

### 触发条件

- 用户报告某个异常、回归或线上问题，但当前已经恢复正常，且在本轮约定的真实入口、真实环境或最接近原始症状的验证位点上无法稳定复现。

### 默认动作

- 先回到用户原始症状对应的入口、环境和验证位点做最小必要核对，例如原页面、原路由、原房间链路、原交互对象、相关自动化回归或现状截图。
- 如果当前仍然复现不了，可以直接给出基于证据的结论，但结论必须准确分层：
  - 只能证明“当前未复现到问题”时，就写“当前未复现原症状”；
  - 只有证据已经覆盖当前真实入口，并且可见状态、关键断言、相关日志都正常时，才可以写“当前证据显示该入口无异常”。
- 除非用户明确要求继续深入、继续追历史根因、或补更多环境证据，否则可以按本轮证据收口，不再无限追查偶发现象。

### 禁止行为

- 禁止把“一次未复现”直接包装成“问题已修复”或“从来没有 bug”。
- 禁止在没有复现证据和直接因果证据时，臆测根因并修改正式逻辑，只为了给偶发问题找解释。
- 禁止因为用户报过一次异常，就在当前已恢复正常且无新证据的情况下，默认无限延长排查。
- 禁止省略前提，直接丢一句“没问题了”；必须说明是在哪个入口、哪个环境、用哪些证据确认当前正常。

### 允许例外

- 用户当轮明确要求继续深入排查、追历史根因、补更多环境覆盖或保留长期监控时，不能用“当前未复现”直接收口。
- 如果仍然存在与用户原始症状直接对应的截图、日志、录像、反馈记录或自动化失败证据，而且这些证据还没有被解释掉，也不能把结论写成“已证明无异常”；只能写“当前未复现，但历史上确实出现过该异常”。

### 最低证据

- 收口时至少同时给出以下四项：
  1. 当前核对的具体入口/环境/位点；
  2. 实际查看的证据类型，例如真实页面现状、自动化回归、日志、截图或状态快照；
  3. 结论属于“当前未复现原症状”还是“当前证据显示该入口无异常”；
  4. 还有哪些范围没有覆盖，或为什么本轮不再继续深入。

---

## E2E 测试

测试文件位于 `e2e/` 目录。

### E2E 测试框架规范（强制）

#### 1. 测试前自动检查

所有 E2E 测试命令会自动执行以下检查：

**文件编码检查**（`npm run check:encoding` / `scripts/infra/check-file-encoding.mjs`）：
- 扫描 `src/`、`apps/`、`e2e/`、`scripts/`、`docs/` 等文本文件
- 检测 UTF-8 BOM；需要修复时执行 `npm run check:encoding:fix`
- 严格拦截“非 UTF-8 字节流”这类真实编码错误
- 对 replacement character、连续问号占位符、常见乱码片段给出告警
- 需要把这些告警也当成失败时，使用 `npm run check:encoding:strict`

**PowerShell 乱码处理**：
- 当前会话如果只是“显示乱码”，先执行：`. .\scripts\infra\enable-utf8.ps1`
- 这只修复终端显示，不代表文件已损坏
- 即使切到 UTF-8，也仍然禁止用 `Set-Content` / `Out-File` / `>` / `>>` 写回含中文源码或文档

**子进程能力预检**（`scripts/infra/assert-child-process-support.mjs`）：
- 主 E2E 命令会先验证当前环境是否允许 `fork` 与 `esbuild` service
- 若报 `spawn EPERM` / `fork EPERM`，会在进入 Playwright 前直接失败并给出原因
- 这类错误通常说明当前终端、沙箱或 Runner 禁止 Node 子进程，不是业务代码问题

**环境隔离检查**（`scripts/infra/check-e2e-safety.js`）：
- 检查测试模式（独立测试环境 vs 使用开发服务器）
- 检查端口占用情况
- 给出建议和警告

**截图验收主源**：
- 图面证据判定、外部资源缺失、线上现状图、移动端主方向和截图有效性，以 [`.spec/knowledge/standards/e2e-verification.md`](../.spec/knowledge/standards/e2e-verification.md) 的「图面证据判定」和「截图来源与证据文档」为准。
- 本文只保留 E2E 运行、截图产物位置和测试工具用法；新增验收规则必须回到 `.spec/knowledge/standards/` 的 canonical-source，不要在这里新增第二套清单。

#### 2. 服务器就绪检查

**Vite 就绪检查插件**（`vite-plugins/ready-check.ts`）：
- 提供 `/__ready` 端点
- 只有在 Vite 完全就绪后才返回 200 状态码
- Playwright 等待此端点就绪才开始测试
- 防止测试开始时服务还在编译
- 当 `BG_ENABLE_CAPTURE_SAVE=1` 时，同一插件会额外开放 `/__capture/save`，供移动端证据补录脚本把页内截图直接写回工作区

**配置示例**（`playwright.config.ts`）：
```typescript
webServer: [
  {
    command: `npm run dev:frontend`,
    url: `http://localhost:5173/__ready`,  // 使用就绪端点
    timeout: 120000,
  },
  // ...
]
```

#### 2.1 Isolated 启动链 fail-fast（global-setup）

为避免“子服务已崩溃但 global-setup 仍盲等 URL 超时”的问题，隔离模式启动链现在有以下基建保障：

1. `global-setup` 启动 worker 服务时会将 stdout/stderr 重定向到 bootstrap 日志（不再忽略输出）
2. 等待 `/games`、`/health`、`/__ready` 期间会持续检测启动进程存活
3. 若进程提前退出，立即 fail-fast；错误信息会带上日志路径与日志尾部内容
4. 子服务异常退出会返回非 0 退出码（`start-single-worker-servers.js` / `start-worker-servers.js`）

Bootstrap 日志路径规则：

- 单 worker：`F:\gongzuo\webgame\BoardGame\.tmp\playwright-bootstrap-<scope>-worker-0.log`
- 多 worker：`F:\gongzuo\webgame\BoardGame\.tmp\playwright-bootstrap-<scope>-worker-<id>.log`
- `<scope>` 来自 `PW_RUNTIME_SCOPE`（默认 `default`）

当 `npm run test:e2e:ci` 报健康检查超时时，优先看报错中给出的 bootstrap 日志路径和日志尾部，再决定是端口冲突、子进程能力受限还是构建/启动异常。

#### 3. 测试性能优化规范

**轮询间隔优化**：
```typescript
// ❌ 错误：使用默认轮询间隔（100ms）
await page.waitForFunction(condition, { timeout: 5000 });

// ✅ 正确：增加轮询间隔到 200ms
await page.waitForFunction(condition, { 
  timeout: 5000, 
  polling: 200  // 减少 50% 轮询次数
});
```

**同步等待 + 异步降级**：
```typescript
// ✅ 推荐：先尝试同步等待（无跨进程通信），失败后降级到异步等待
const result = await page.evaluate(() => {
  // 执行操作
  harness.command.dispatch({ type: 'action', payload });
  
  // 同步等待结果（最多 100ms）
  const startTime = Date.now();
  while (Date.now() - startTime < 100) {
    if (harness.state.get()?.someCondition) {
      return { success: true };
    }
  }
  return { success: false };
});

// 如果同步等待失败，降级到异步等待
if (!result.success) {
  await page.waitForFunction(() => {
    return harness.state.get()?.someCondition;
  }, { timeout: 5000, polling: 200 });
}
```

**性能基准**：
- 单个测试耗时应 < 20 秒
- 服务器启动耗时应 < 20 秒
- 总耗时应 < 40 秒

#### 4. 测试框架 API（强制使用）

> **⚠️ 强制规定**：所有新的 E2E 测试必须使用 GameTestContext API。禁止使用旧的 helper 函数（`setupSmashUpOnlineMatch`、`readCoreState`、`applyCoreState` 等）。旧测试可以保留，但新测试必须用新框架。

> **口径补充（强制）**：本项目默认把 `E2E / 端到端` 理解为**状态注入驱动的浏览器级验证**。也就是允许先用 `game.setupScene(...)` 构造场景，再验证 UI、交互和最终可见结果。只有用户明确要求“真实链路 / 从真实入口打出来”，或本轮需要证明房间创建、联机同步、`setupData -> runtime`、权限/座位/多端同步等跨入口合同时，才额外要求从真实玩法入口自然走到目标状态；这类用例与 evidence 必须显式标注 `真实链路`，并写清它额外证明了什么。

**GameTestContext**（`e2e/framework/GameTestContext.ts`）：

提供统一的测试 API，封装状态注入、游戏动作、断言等功能。

```typescript
import { test } from './framework';

test('测试名称', async ({ page, game }, testInfo) => {
  // 1. 快速场景构建
  await game.setupScene({
    gameId: 'smashup',
    player0: {
      hand: ['wizard_portal'],
      discard: ['alien_invader'],
    },
    currentPlayer: '0',
    phase: 'playCards',
  });
  
  // 2. 游戏动作
  await game.playCard('wizard_portal');
  await game.waitForInteraction('wizard_portal_pick');
  await game.selectOption('minion-0');
  await game.confirm();
  
  // 3. 断言
  await game.expectCardInHand('alien_invader');
  await game.expectPhase('playCards');
  
  // 4. 截图（可选）
  await game.screenshot('final-state', testInfo);
});
```

**核心方法**：
- `setupScene(config)` - 快速构建测试场景（跳过前置步骤）
- `playCard(cardDefId, options?)` - 打出指定卡牌
- `waitForInteraction(sourceId)` - 等待交互出现
- `selectOption(optionId)` - 选择交互选项
- `confirm()` / `skip()` - 确认/跳过交互
- `advancePhase()` - 推进阶段
- `getState()` - 读取当前游戏状态
- `expectCardInHand(cardDefId)` - 断言手牌中有指定卡牌
- `expectCardInDiscard(cardDefId)` - 断言弃牌堆中有指定卡牌
- `expectPhase(phase)` - 断言当前阶段
- `screenshot(name, testInfo)` - 截图

**详细文档**：`docs/e2e-testing-guide.md`

**为什么必须使用新框架**：
- ✅ 自动处理状态注入和等待（避免超时问题）
- ✅ 统一的 API，减少样板代码（60-70% 代码量）
- ✅ 更好的错误信息和调试支持
- ✅ 自动截图和测试报告
- ✅ 类型安全，编译期检查
- ❌ 旧的 helper 函数容易出现超时和环境问题
- ❌ 旧的方式需要手动管理状态、等待、清理

**禁止使用旧方式**：
```typescript
// ❌ 禁止：使用旧的 helper 函数
import { setupSmashUpOnlineMatch, readCoreState, applyCoreState } from './helpers/smashup';

// ✅ 正确：使用新的 GameTestContext API
import { test } from './framework';
test('test', async ({ page, game }) => {
  await game.setupScene({ ... });
});
```

### 使用 Fixture 简化测试（推荐）

项目提供了 Playwright Fixture 来自动管理对局创建和清理，大幅减少样板代码。

#### 基础用法

```typescript
import { test, expect } from './fixtures';

test('测试名称', async ({ smashupMatch }) => {
  const { hostPage, guestPage, matchId } = smashupMatch;
  
  // 直接开始测试，无需 setup 代码
  await hostPage.click('[data-testid="play-card"]');
  await expect(hostPage.getByText('Card played')).toBeVisible();
  
  // 无需手动 cleanup，fixture 自动处理
});
```

#### 可用的 Fixture

| Fixture | 说明 | 默认配置 |
|---------|------|----------|
| `smashupMatch` | SmashUp 对局 | Host: 派系 [0,1], Guest: 派系 [2,3] |
| `dicethroneMatch` | DiceThrone 对局 | Host: Monk, Guest: Barbarian |
| `summonerwarsMatch` | SummonerWars 对局 | Host: Necromancer, Guest: Trickster |

#### 自定义配置

如需自定义派系/角色，使用工厂函数：

```typescript
import { test, expect, createSmashUpMatch } from './fixtures';

test('自定义派系', async ({ browser }, testInfo) => {
  const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
    hostFactions: [9, 0],  // 幽灵 + 海盗
    guestFactions: [1, 2], // 忍者 + 恐龙
  });
  
  if (!setup) {
    // 仅允许用于测试环境/房间初始化前置失败；不得用来跳过业务断言失败。
    test.skip();
    return;
  }
  
  const { hostPage, guestPage } = setup;
  // 测试代码...
});
```

#### 代码量对比

**重构前**（每个测试 23-35 行）：
```typescript
test('test', async ({ browser }, testInfo) => {
  // 15-20 行 setup 代码
  const hostContext = await browser.newContext(...);
  await initContext(...);
  const matchId = await createRoom(...);
  // ...
  
  // 5-10 行测试代码
  await hostPage.click(...);
  
  // 3-5 行 cleanup
  await hostContext.close();
  await guestContext.close();
});
```

**重构后**（每个测试 5-10 行）：
```typescript
test('test', async ({ smashupMatch }) => {
  const { hostPage } = smashupMatch;
  
  // 5-10 行测试代码
  await hostPage.click(...);
  
  // 自动 cleanup
});
```

**减少代码量：60-70%**

### 传统方式（不推荐，仅用于特殊场景）

如果 fixture 不满足需求，可以使用传统的 helper 函数：

```typescript
import { setupSmashUpOnlineMatch } from './helpers/smashup';

test('test', async ({ browser }, testInfo) => {
  const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL);
  if (!setup) {
    // 仅允许用于测试环境/房间初始化前置失败；不得用来跳过业务断言失败。
    test.skip();
    return;
  }
  
  try {
    // 测试代码
  } finally {
    await setup.hostContext.close();
    await setup.guestContext.close();
  }
});
```

### E2E 测试失败排查规范（强制）

**当 E2E 测试失败时，必须按以下顺序排查，禁止跳过步骤直接猜测原因：**

1. **先读代码，再调试**
   - ❌ 错误做法：看到超时/卡住就假设"有 bug"，直接修改测试或增加等待时间
   - ✅ 正确做法：先读取相关源码，理解业务逻辑和 UI 交互设计
   - 示例：SummonerWars 的"结束阶段"按钮在 `move`/`attack` 阶段有防误操作机制，需要点击两次（第一次确认，第二次执行）。这不是 bug，是设计特性。

2. **理解测试失败的真实原因**
   - 读取失败日志，定位卡住/超时的具体步骤
   - 检查相关 UI 组件的 `disabled`/`onClick`/`useEffect` 逻辑
   - 检查状态管理（useState/useCallback）和条件渲染
   - 检查是否有"确认模式"、"二次确认"、"等待动画"等设计

3. **验证是设计特性还是真正的 bug**
   - 设计特性：防误操作、二次确认、动画延迟、状态门控
   - 真正的 bug：逻辑错误、状态不同步、事件未触发、死锁

4. **修复策略**
   - 设计特性 → 更新测试代码适配设计（如增加等待、处理确认流程）
   - 真正的 bug → 修复源码逻辑

**反面教材**：
```typescript
// ❌ 错误：未读代码就假设"阶段推进有 bug"
// 实际：move 阶段有可移动单位时需要二次确认
await page.click('[data-testid="end-phase"]');
await page.waitForTimeout(5000); // 盲目增加等待
```

**正确做法**：
```typescript
// ✅ 正确：读代码后理解确认机制，测试代码适配设计
// src/games/summonerwars/ui/useCellInteraction.ts:
// if ((currentPhase === 'move' || currentPhase === 'attack') && actionableUnitPositions.length > 0) {
//   setEndPhaseConfirmPending(true);  // 第一次点击进入确认模式
//   return;
// }

// 测试代码处理确认流程
const endPhaseBtn = page.getByTestId('sw-end-phase');
await endPhaseBtn.click(); // 第一次点击：进入确认模式
await page.waitForTimeout(500);
await endPhaseBtn.click(); // 第二次点击：确认并推进阶段
```

### E2E 测试环境依赖排查（强制）

**E2E 测试依赖三个服务同时运行**：前端开发服务器（Vite）、游戏服务器（game-server）、API 服务器（api-server）。这表示需要三个服务进程，不表示每条 E2E 都必须连接外部数据库；默认 E2E 的游戏服使用内存存储，测试环境 API 可使用项目内存 Mongo。

#### 推荐工作流

1. **默认隔离模式**（推荐）：
   ```bash
   # 单终端：自动启动测试专用服务（6173 / 20000 / 21000）并执行测试
   npm run test:e2e
   ```

2. **开发服务器复用模式**（只在调试测试代码时使用）：
   ```bash
   # 终端 1：启动开发服务（4173 / 18000 / 18001）
   npm run dev
   
   # 终端 2：复用开发服务运行测试
   npm run test:e2e:dev
   ```

   `npm run dev:lite` 是无 API 的快速开发模式，适合页面和游戏服快速体验；它默认从正式公开资源域名读取运行时素材，因此新 clone 不需要预先下载全量素材。不能用它证明认证、社交、后台或 API 链路。标准 E2E 应优先使用上面的测试专用 runtime，它会按测试环境启动所需服务并保持游戏服内存化。

3. **CI 模式**（自动启动测试专用服务）：
   ```bash
   # 单终端：自动启动服务并运行测试
   npm run test:e2e:ci
   ```

4. **清理端口占用**（仅在测试异常退出，且确认没有其他 E2E 正在使用测试端口时）：
   ```bash
   npm run test:e2e:cleanup
   ```

5. **运行环境前置条件**：
   - Vitest / Playwright / esbuild / E2E 三服务启动链都依赖 Node `child_process`
   - 如果报错为 `spawn EPERM` / `spawnSync EPERM` / `fork EPERM`，优先判断当前终端或沙箱是否禁止子进程
   - 补充：`npm run dev:frontend` 现在会在 `spawn EPERM` 时自动回退到“当前进程直接执行 Vite”；这只能说明前端 dev server 还能起，不代表 Playwright worker / esbuild service / E2E 三服务链已经恢复
   - 这类错误通常不是业务代码问题，应改在本地终端、CI Runner 或允许子进程的环境执行

6. **WSL / 跨平台工作区注意事项**：
   ```bash
   # 如果同一份仓库之前在 Windows 下装过依赖，再切到 WSL 跑 E2E，
   # 必须先重装一遍 Linux 依赖，否则可能缺少 rollup/esbuild 的 Linux 可选包。
   rm -rf node_modules
   npm ci
   npx playwright install --with-deps chromium
   ```
   - 典型报错：`Cannot find module @rollup/rollup-linux-x64-gnu`
   - 根因：同一份 `node_modules` 不能在 Windows 和 Linux 间直接复用，尤其是带原生二进制或 optional dependency 的工具链（如 `rollup`、`esbuild`、`playwright`）
   - 最佳实践：长期使用 WSL 时，将仓库迁到 WSL 文件系统；若仍在 `/mnt/<disk>/...` 下复用同一仓库，则每次跨 Windows / WSL 切换后都要重装依赖

#### 测试失败排查顺序

**当 E2E 测试失败时，按以下顺序排查：**

1. **检查端口配置**
   - 读取 `.env` 文件确认端口配置：
     - `VITE_DEV_PORT`（默认 4173，开发环境）
     - `GAME_SERVER_PORT`（默认 18000）
     - `API_SERVER_PORT`（默认 18001）
   - 单 worker 隔离测试端口固定为：
     - 前端 `6173`
     - game-server `20000`
     - api-server `21000`

2. **检查服务状态**
   ```powershell
   # 开发环境端口
   netstat -ano | findstr ":4173"
   netstat -ano | findstr ":18000"
   netstat -ano | findstr ":18001"

   # E2E 隔离环境端口
   netstat -ano | findstr ":6173"
   netstat -ano | findstr ":20000"
   netstat -ano | findstr ":21000"
   
   # 或使用 PowerShell
   Get-NetTCPConnection -LocalPort 4173
   Get-NetTCPConnection -LocalPort 18000
   Get-NetTCPConnection -LocalPort 18001
   Get-NetTCPConnection -LocalPort 6173
   Get-NetTCPConnection -LocalPort 20000
   Get-NetTCPConnection -LocalPort 21000
   ```

3. **验证服务可达性**
   - 开发模式：
     - 前端：`http://localhost:4173`
     - 游戏服务器：`http://localhost:18000/games`
     - API 服务器：`http://localhost:18001/health`
   - 隔离测试模式：
     - 前端：`http://localhost:6173/__ready`
     - 游戏服务器：`http://localhost:20000/games`
     - API 服务器：`http://localhost:21000/health`

4. **验证代理配置**
   - 检查 `vite.config.ts` 中的 `server.proxy` 配置是否与 `.env` 端口一致

5. **清理遗留连接**
   ```bash
   # 清理测试遗留的端口占用和 WebSocket 连接
   npm run test:e2e:cleanup
   ```
   - ⚠️ 默认不要把 `cleanup` 当成第一步；在隔离测试环境中，应先假设可能有其他 E2E 正在运行
   - 只有在确认端口残留、上一次测试异常退出，或明确没有其他测试在跑时，才执行该命令

6. **检查是否为跨平台依赖问题**
   - 如果报错包含 `@rollup/rollup-linux-x64-gnu`、`esbuild-*-linux-*`、`playwright` 浏览器依赖缺失等，优先判断是否在 WSL 中直接复用了 Windows 安装出来的 `node_modules`
   - 处理顺序：
     ```bash
     rm -rf node_modules
     npm ci
     npx playwright install --with-deps chromium
     ```

#### 端口冲突处理

**如果端口被占用**：

1. **先判断是否真的需要清理全部测试端口**：
   - 默认假设隔离环境中可能有其他 E2E 正在运行
   - 如果只是单个端口异常，优先定位并清理对应 PID，不要直接执行全量 cleanup

2. **确认没有其他测试运行后，再清理测试遗留进程**：
   ```bash
   npm run test:e2e:cleanup
   ```

3. **手动终止占用进程**（确认非关键进程后）：
   ```powershell
   # 查找占用进程的 PID
   netstat -ano | findstr ":18000"
   
   # 终止进程（替换 <PID> 为实际 PID）
   taskkill /F /PID <PID>
   ```

4. **⚠️ 危险操作警告**：
   - ❌ **禁止**：`taskkill /F /IM node.exe`（会杀掉所有 Node.js 进程）
   - ❌ **禁止**：`killall node`、`pkill node`（同上）
   - ❌ **禁止**：`Get-Process node | Stop-Process -Force`（同上）
   - **原因**：会杀掉其他项目的服务器、VS Code 语言服务器、调试器、正在运行的测试等

#### 为什么会端口占用

E2E 测试会创建多个 BrowserContext 和 WebSocket 连接。如果测试异常退出或清理不完整，这些连接可能不会被正确关闭，导致端口持续被占用。

**解决方案**：
- 使用 `npm run test:e2e:cleanup` 强制清理所有相关进程
- 或使用 `node scripts/infra/port-allocator.js <workerId>` 清理特定 worker 的端口

#### 测试超时排查

**如果测试超时（timeout）**：

1. **优先检查服务是否启动**（而非直接修改测试代码的超时时间）
2. **检查端口配置是否正确**
3. **检查是否有端口冲突**
4. **检查网络连接**（防火墙、代理等）

**常见错误**：
```
TimeoutError: page.goto: Timeout 30000ms exceeded
```

**排查步骤**：
1. 确认前端服务器正在运行（`http://localhost:3000`）
2. 确认游戏服务器正在运行（开发模式 `http://localhost:18000/games`，隔离模式 `http://localhost:20000/games`）
3. 确认 API 服务器正在运行（开发模式 `http://localhost:18001/health`，隔离模式 `http://localhost:21000/health`）
4. 检查浏览器控制台是否有错误（使用 `page.on('console', ...)` 监听）

### E2E 测试选择器多语言支持（强制）

**问题**：E2E 测试环境的语言可能与手动操作时不同，导致基于文本的选择器失败。

**规则**：所有 E2E 测试选择器必须支持多语言环境，不得依赖特定语言的文本内容。

**错误做法**：
```typescript
// ❌ 错误：只支持中文，测试环境是英文时会失败
const banner = page.locator('.bg-purple-900\\/95', { 
  hasText: '选择：打出事件卡或弃牌换魔力' 
});

const playButton = banner.locator('button', { hasText: '打出' });
```

**正确做法**：
```typescript
// ✅ 正确：使用 CSS 类 + 正则表达式，支持中英文
const banner = page.locator('.bg-purple-900\\/95').filter({ 
  hasText: /Choose|选择/ 
});

const playButton = banner.locator('button').filter({ 
  hasText: /Play|打出/ 
});

const discardButton = banner.locator('button').filter({ 
  hasText: /Discard|弃牌/ 
});

const cancelButton = banner.locator('button').filter({ 
  hasText: /Cancel|取消/ 
});
```

**最佳实践**：
1. **优先使用 `data-testid`**：不依赖文本和样式，最稳定
   ```typescript
   const button = page.getByTestId('play-event-button');
   ```

2. **使用 CSS 类选择器**：不依赖文本内容
   ```typescript
   const banner = page.locator('.magic-event-choice-banner');
   ```

3. **使用正则表达式匹配多语言**：当必须依赖文本时
   ```typescript
   const button = page.locator('button').filter({ hasText: /Play|打出/ });
   ```

4. **避免硬编码文本**：禁止使用 `{ hasText: '打出' }` 或 `getByText('打出')`

**为什么会出现语言不一致**：
- 手动操作时浏览器可能加载中文（根据系统语言或用户设置）
- 个别 E2E 用例会显式切到英文（例如调用 `setEnglishLocale()` 做英文断言）
- i18next 会根据 `localStorage.i18nextLng` 或 `navigator.language` 选择语言

**当前框架默认口径**：
- `initContext()` 默认写入 `zh-CN`，因为当前开发者和主要验收语境都是中文。
- 只有在确实要验证英文文案时，才显式调用 `setEnglishLocale()`。
- 不要再假设“E2E 默认英文”；需要多语言兼容时，用正则同时覆盖中英文。

**教训案例**：
- 问题：`e2e/summonerwars/summonerwars-magic-event-choice.e2e.ts` 测试失败，横幅文本未找到
- 原因：代码渲染了英文横幅 "Choose: Play event card or discard for magic"，但测试查找中文 "选择：打出事件卡或弃牌换魔力"
- 解决：使用正则表达式 `/Choose|选择/` 同时匹配中英文
- 参考：`e2e/summonerwars/summonerwars-magic-event-choice.e2e.ts`

### E2E 测试选择器一致性检查（强制）

> **重构 UI 交互模式后必须执行**。UI 组件的渲染方式变更（如从弹窗改为内联横幅）时，所有引用旧选择器的 E2E 测试必须同步更新。

**检查清单**：

1. **选择器来源验证**：E2E 测试中的 `data-testid` / CSS 选择器 / 文本匹配，必须对应实际渲染的组件。重构后用 `rg` 搜索旧选择器，确认所有 E2E 文件已更新。
2. **交互路径验证**：测试中的点击 / 输入序列必须与实际 UI 交互路径一致。例如：手牌选择在 HandArea 中直接点击 vs 在弹窗 overlay 中选择，两者选择器完全不同。
3. **按钮文本验证**：按钮文本来自 i18n，测试中的正则匹配必须覆盖中英文两种 locale（如 `/Confirm Discard|确认弃牌/i`）。
4. **状态验证**：测试必须验证 UI 状态变更（如 `data-selected="true"`），不能只验证“点击了按钮”。

**典型反模式**：

- ❌ 重构了交互模式（弹窗→横幅），E2E 测试仍查找旧弹窗选择器 → 测试超时 / skip，从未真正执行
- ❌ 测试中硬编码组件内部 CSS 类名（如 `.card-selector-overlay`）→ 样式重构后测试失效
- ✅ 使用 `data-testid` + 多语言按钮文本匹配，并与实际渲染组件对齐

### TestHarness 测试工具（推荐）

项目提供了统一的测试工具集（TestHarness），用于控制游戏状态、骰子投掷、随机数等，确保 E2E 测试稳定可靠。

#### 核心功能

| 功能 | 说明 | 用途 |
|------|------|------|
| 骰子注入 | 精确控制骰子投掷结果 | 消除随机性，测试特定技能触发条件 |
| 状态注入 | 直接设置游戏状态 | 快速构造测试场景，跳过冗长的准备步骤 |
| **刷新语义** | **区分本地快照与联机权威状态** | **避免错误假设“setupScene 刷新后自动持久化”** |
| 命令分发 | 直接执行游戏命令 | 绕过 UI 交互，快速推进游戏流程 |
| 随机数控制 | 控制所有随机数生成 | 确保测试结果可预测、可重复 |

#### 快速开始

```typescript
import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, readyAndStartGame, waitForGameBoard } from './helpers/dicethrone';
import { waitForTestHarness } from './helpers/common';

test('雷霆万钧技能测试', async ({ browser }, testInfo) => {
    const setup = await setupDTOnlineMatch(browser, testInfo.project.use.baseURL);
    const { hostPage, guestPage, hostContext, guestContext } = setup;

    // 选择角色并开始游戏
    await selectCharacter(hostPage, 'monk');
    await selectCharacter(guestPage, 'monk');
    await readyAndStartGame(hostPage, guestPage);
    await waitForGameBoard(hostPage);

    // 等待测试工具就绪
    await waitForTestHarness(hostPage);

    // 注入骰子值：3个掌面（值为3）+ 2个拳头（值为1）
    await hostPage.evaluate(() => {
        window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
    });

    // 修改玩家状态
    await hostPage.evaluate(() => {
        window.__BG_TEST_HARNESS__!.state.patch({
            core: {
                players: {
                    '0': { tokens: { taiji: 2 } }
                }
            }
        });
    });

    // 执行掷骰操作
    await hostPage.click('[data-tutorial-id="dice-roll-button"]');
    await hostPage.waitForTimeout(2500);
    await hostPage.click('button:has-text("确认")');

    // 验证骰子值
    const state = await hostPage.evaluate(() => {
        return window.__BG_TEST_HARNESS__!.state.get();
    });
    expect(state.core.dice.map(d => d.value)).toEqual([3, 3, 3, 1, 1]);

    // 清理
    await guestContext.close();
    await hostContext.close();
});
```

#### API 参考

**骰子注入**：
```typescript
// 设置骰子值（1-6）
window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);

// 添加骰子值到队列末尾
window.__BG_TEST_HARNESS__!.dice.enqueue(6, 6);

// 清空队列
window.__BG_TEST_HARNESS__!.dice.clear();

// 检查剩余骰子数
window.__BG_TEST_HARNESS__!.dice.remaining();
```

**状态注入**：
```typescript
// 获取当前状态
const state = window.__BG_TEST_HARNESS__!.state.get();

// 设置状态（完全替换）
state.core.players['0'].resources.hp = 10;
window.__BG_TEST_HARNESS__!.state.set(state);

// 部分更新（深度合并，推荐）
window.__BG_TEST_HARNESS__!.state.patch({
    core: {
        players: {
            '0': {
                resources: { hp: 10, cp: 5 },
                tokens: { taiji: 2 }
            }
        }
    }
});
```

**刷新行为（本地测试模式）**：
- `/play/<gameId>` 下的 `TestHarness` 只修改当前页面持有的本地状态快照
- 刷新页面后，会重新创建一个新的本地对局；此前通过 `setupScene()` / `state.set()` / `state.patch()` 注入的场景不会自动保留
- 如果测试需要“刷新后仍保留状态”，必须改用联机页面 `/play/<gameId>/match/<matchId>`，并通过服务端 `/test/inject-state` 或 `/test/patch-state` 注入权威状态

**工作原理**：
- 在本地测试模式（`/play/<gameId>`）下，`state.set()` / `state.patch()` 直接修改当前页面持有的状态快照
- 在联机页面（`/play/<gameId>/match/<matchId>`）下，客户端状态已经过 `playerView` 过滤，只允许读取，不允许直接写回
- 需要为联机对局注入权威状态时，必须调用服务端 `/test/inject-state` 或 `/test/patch-state` 接口
- `/test/*` 除了 `X-Test-Token` 外，还必须携带当前座位的 `playerID + credentials`；推荐复用 `e2e/helpers/state-injection.ts`，它会从当前页面的 `localStorage(match_creds_<matchId>)` 自动读取
- 只有联机对局走服务端权威状态时，刷新页面才会重新拉取最新状态

**命令分发**：
```typescript
// 分发命令
await window.__BG_TEST_HARNESS__!.command.dispatch({
    type: 'ADVANCE_PHASE',
    playerId: '0',
    payload: {}
});
```

**随机数控制**：
```typescript
// 设置随机数队列（0-1 范围）
window.__BG_TEST_HARNESS__!.random.setQueue([0.1, 0.5, 0.9]);

// 添加随机数
window.__BG_TEST_HARNESS__!.random.enqueue(0.2, 0.7);

// 清空队列
window.__BG_TEST_HARNESS__!.random.clear();
```

**工具状态查询**：
```typescript
// 获取所有工具状态
const status = window.__BG_TEST_HARNESS__!.getStatus();
console.log(status);
// {
//     random: { enabled: true, queueLength: 5, consumed: 3 },
//     dice: { remaining: 5, values: [3,3,3,1,1] },
//     state: { registered: true },
//     command: { registered: true }
// }

// 重置所有工具
window.__BG_TEST_HARNESS__!.reset();
```

#### 使用场景

**场景 1：测试依赖特定骰子结果的技能**
```typescript
// 雷霆万钧技能需要3个掌面（值为3）才能触发
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
});
```

**场景 2：快速构造测试场景**
```typescript
// 设置玩家 HP 为 10，跳过冗长的战斗过程
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({
        core: { players: { '0': { resources: { hp: 10 } } } }
    });
});
```

**场景 3：直接推进游戏阶段**
```typescript
// 直接推进到攻击阶段，跳过前置阶段
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.command.dispatch({
        type: 'ADVANCE_PHASE',
        playerId: '0',
        payload: {}
    });
});
```

#### 最佳实践

1. **总是等待测试工具就绪**
   ```typescript
   await waitForTestHarness(page);
   ```

2. **使用类型断言**
   ```typescript
   window.__BG_TEST_HARNESS__!  // 注意感叹号
   ```

3. **状态修改后等待渲染**
   ```typescript
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.state.patch({ ... });
   });
   await page.waitForTimeout(500);  // 等待 React 重新渲染
   ```

4. **使用有意义的骰子值**
   ```typescript
   // ✅ 正确：注释说明骰子含义
   await page.evaluate(() => {
       // 武僧骰子：3=掌面，1=拳头
       window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
   });
   ```

5. **测试结束时清理**
   ```typescript
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.reset();
   });
   ```

#### 常见陷阱

1. **忘记等待测试工具就绪**
   ```typescript
   // ❌ 错误：可能报错 "Cannot read property 'dice' of undefined"
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
   });

   // ✅ 正确
   await waitForTestHarness(page);
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
   });
   ```

2. **骰子值超出范围**
   ```typescript
   // ❌ 错误：骰子值必须是 1-6
   window.__BG_TEST_HARNESS__!.dice.setValues([0, 7, 10]);

   // ✅ 正确
   window.__BG_TEST_HARNESS__!.dice.setValues([1, 6, 3]);
   ```

3. **状态路径错误**
   ```typescript
   // ❌ 错误：缺少 core 前缀
   state.players['0'].hp

   // ✅ 正确
   state.core.players['0'].resources.hp
   ```

#### 更多资源

- 完整设计文档：`docs/testing-infrastructure.md`
- 快速参考：`docs/testing-tools-quick-reference.md`
- 示例测试：`e2e/dicethrone/example-test-harness-usage.e2e.ts`
- 实际案例：`e2e/dicethrone/dicethrone-thunder-strike.e2e.ts`

### 运行方式

```bash
# 开发模式：先启动服务，再指定相关 E2E 文件或 grep
npm run dev
npm run test:e2e -- e2e/<相关文件>.e2e.ts
# 或
npm run test:e2e -- --grep "<相关用例名>"
# 或（复用现服，仅跑单文件）
npm run test:e2e:file -- e2e/<相关文件>.e2e.ts

# CI 模式：自动启动服务器并运行相关测试
npm run test:e2e:ci -- e2e/<相关文件>.e2e.ts
# CI 单文件 + 单用例：优先用这个入口，避免 npm 壳层对 --grep 转发差异
npm run test:e2e:ci:file -- e2e/<相关文件>.e2e.ts "<相关用例名>"

# 明确需要全量时才使用
npm run test:e2e:all

# 明确需要全量 CI 时才使用
npm run test:e2e:ci:all
```

**环境变量控制**：
- `PW_START_SERVERS=true` — 强制启动服务器（CI 模式）
- 默认（不设置）— 使用已运行的服务器（开发模式）
- 默认禁止“无目标直接全量跑”`Playwright`，避免本地误触完整 E2E 套件卡死机器
- 常用项目脚本（如 `npm run test:e2e`、`npm run test:e2e:ci`、`npm run test:e2e:parallel`）会显式强制无头运行，避免终端里残留的 `PW_HEADED` / `PWDEBUG` 导致突然弹出一批浏览器窗口
- 如需可见浏览器调试，请显式使用 `npx playwright test --headed` 或 `npx playwright test --debug`
- E2E 自动起服默认会给游戏服务注入 `USE_PERSISTENT_STORAGE=false`，此时游戏服应以纯内存模式启动，不要求本机先准备 MongoDB；对应代价是 UGC、排行榜归档等依赖 Mongo 的能力会被自动跳过
- `npm run test:e2e:ci:file -- <文件> "<用例名>"` 这类“显式目标”入口会先在共享 registry 中保留一组隔离端口，再启动服务；多 AI / 多 worktree 并发时优先使用这个入口，避免两个运行链路同时挑中同一组动态端口

### 端口配置与隔离（重要）

E2E 测试使用独立的端口范围，与开发环境完全隔离，避免冲突。

#### 端口分配

| 环境 | Frontend | Game Server | API Server |
|------|----------|-------------|------------|
| 开发环境 | 3000 | 18000 | 18001 |
| E2E 测试 | 5173 | 19000 | 19001 |

#### 测试模式

**1. 隔离模式（推荐，默认）**
```bash
npm run test:e2e
```
- 使用独立的测试端口（5173/19000/19001）
- 不会影响开发环境
- 测试失败不会破坏开发服务器状态

**2. 开发服务器模式（不推荐）**
```bash
# 设置环境变量
$env:PW_USE_DEV_SERVERS = "true"  # PowerShell
export PW_USE_DEV_SERVERS=true    # Bash

# 运行测试
npm run test:e2e

# 清除环境变量
$env:PW_USE_DEV_SERVERS = $null   # PowerShell
unset PW_USE_DEV_SERVERS          # Bash
```
- 使用开发环境端口（3000/18000/18001）
- 需要先手动启动 `npm run dev`
- 测试会影响开发环境状态
- 仅用于调试特定问题

#### 端口配置原理

Playwright 配置文件（`playwright.config.ts`）根据 `PW_USE_DEV_SERVERS` 环境变量自动选择端口：

```typescript
// 根据模式选择端口
const PORTS = useDevServers ? DEV_PORTS : E2E_PORTS;

// 设置环境变量，让测试代码能够读取正确的端口
if (!process.env.PW_GAME_SERVER_PORT) {
    process.env.PW_GAME_SERVER_PORT = PORTS.gameServer.toString();
}
```

测试辅助函数（`e2e/helpers/common.ts`）通过环境变量获取端口：

```typescript
export const getGameServerBaseURL = () => {
    const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
    if (envUrl) return normalizeUrl(envUrl);
    const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
    return `http://localhost:${port}`;
};
```

#### 常见问题

**问题：测试失败，错误信息"房间不存在或已被删除"**

原因：测试代码连接到错误的端口（如连接到 19000 但服务器运行在 18000）

解决方案：
1. 检查是否设置了 `PW_USE_DEV_SERVERS` 环境变量
2. 如果使用开发服务器模式，确保 `npm run dev` 正在运行
3. 如果使用隔离模式，清除 `PW_USE_DEV_SERVERS` 环境变量
4. 检查测试日志中的实际请求 URL（`pw:api → POST http://localhost:xxxxx/...`）

**问题：端口被占用**

解决方案：
```bash
# 查看端口占用
netstat -ano | findstr :19000  # Windows
lsof -ti:19000                 # Linux/Mac

# 清理测试环境端口
npm run test:e2e:cleanup

# 清理开发环境端口
npm run clean:ports
```

### 覆盖原则

**硬性要求**：E2E 必须覆盖"交互面"而不只是"完整流程"。

- **交互覆盖**：对用户可见且可操作的关键交互点，逐一验证：
  - 能否触达（入口/按钮/快捷入口/菜单/路由）
  - 能否操作（点击/输入/拖拽/切换 Tab/确认取消/关闭弹窗）
  - 操作后的 UI 反馈（状态变化、禁用态、提示文案、Loading、错误提示）
  - 数据/状态副作用（如加入房间、发送消息、发起重赛投票、退出房间）
- **流程覆盖**：对"从入口到结束/返回"的主路径至少保留 1 条 happy path 作为回归基线

### 所有游戏 E2E 覆盖范围（通用规范）

1. **完整流程基线（Happy Path）**：入口 → 创建房间 → 阵营选择 → 开始对局 → 回合推进 → 结束/结算
2. **核心交互面**：关键 UI 面板（阶段、手牌、地图、行动按钮）、地图缩放/拖拽、阶段推进
3. **特殊交互面**：攻击后技能选择、事件卡多目标/多步骤选择、弃牌堆选择、奖励骰结算/重掷交互（如 `Loaded` / `Wild West` / 额外掷骰）
4. **负面与边界**：非当前玩家操作被拒绝、阶段自动跳过边界

### 在线对局测试

| 场景 | 做法 |
|------|------|
| 真实多人流程 | 使用 host/guest 两个浏览器上下文：创建房间 → guest `?join=true` 加入 |
| 交互回归 | 按"交互覆盖清单"逐条验证 |
| 冒烟测试 | 验证页面加载 + 关键元素出现 |

### 截图与附件管理（强制）

1. Playwright 自动产物目录固定为 `test-results/playwright-artifacts/`，仅保留失败用例附件（`preserveOutput: 'failures-only'`）
2. 显式证据截图统一通过 `game.screenshot()` 或共享工具写入 `test-results/evidence-screenshots/_shared/`
3. `game.screenshot()` 默认按“测试文件/测试用例”分目录，例如 `test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/触控窄视口下放大入口常显且可点击/10-mobile-main-board-state.png`
4. 同一用例首次截图前会自动清理该用例旧截图，并顺带清理旧的平铺遗留文件，避免新旧图混在一起
5. `testInfo.outputPath()` 只用于临时附件路径，不是长期证据目录
6. 禁止把同一张图复制到多个稳定目录；禁止默认自动写入 `evidence/_shared/screenshots/`
7. `test-results/` 目录已被 git 忽略，测试产物不应提交
8. 在对话、证据说明或交接里汇报截图位置时，必须直接给可复制的工作区绝对路径，例如 `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\...`，禁止只写相对目录、文件名或“看 test-results 下面”
9. 证据文档如果引用了 3 张截图，就必须逐张列出 3 条绝对路径；不能只在文档里放图片、相对链接，或只给目录级路径

```typescript
test('Match started', async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('game-started.png') });
});
```

```typescript
test('Match started', async ({ game }, testInfo) => {
    await game.screenshot('match-started', testInfo);
});
```

### 多客户端测试（Multi-Player E2E）

适用于需要模拟真实多玩家交互的测试。

```typescript
import { createMultiPlayerTest } from './helpers/multiPlayer';

test('多玩家游戏流程', async ({ browser }, testInfo) => {
  const multiPlayer = await createMultiPlayerTest({
    browser,
    baseURL: testInfo.project.use.baseURL,
    gameId: 'my-game',
    matchId: 'test-match-id',
    numPlayers: 3,
    disableAudio: true,
    disableTutorial: true,
  });

  try {
    const player1 = multiPlayer.getPlayer('0');
    await multiPlayer.waitForAllPlayersReady();
    // 执行测试逻辑...
  } finally {
    await multiPlayer.cleanup();
  }
});
```

关键要点：
1. 每个玩家必须使用独立的 `BrowserContext`
2. 每个玩家需要独立获取和存储 credentials
3. 根据游戏状态动态选择对应的客户端发送命令
4. 测试结束后必须关闭所有上下文

参考：`e2e/helpers/multiPlayer.ts`、`e2e/_shared/ugc-preview.e2e.ts`

### Mock API 响应

```typescript
test.beforeEach(async ({ page }) => {
    await page.route('**/auth/me', async route => {
        await route.fulfill({ json: { user: mockUser } });
    });
});
```

### 关键功能覆盖

- `e2e/social.test.ts` - Global HUD 入口、模态框、标签页、好友列表
- `e2e/navbar.test.ts` - 顶部导航、登录状态、游戏分类
- `e2e/tictactoe/tictactoe-tutorial.e2e.ts` - 井字棋教程完整流程
- `e2e/dicethrone/dicethrone.e2e.ts` - 线上房间手牌校验 + 教程完整流程 + 僧侣花开见佛选择 + 雷霆万钧奖励骰重掷
- `e2e/dicethrone/dicethrone-moon-elf.e2e.ts` - 月精灵基础攻击 + Targeted 伤害结算
- `e2e/dicethrone/dicethrone-shadow-thief.e2e.ts` - 暗影刺客基础攻击 + Sneak 免伤 + 双防御技能选择

---

## API 测试

可设置 `MONGO_URI` 复用 Docker MongoDB，避免下载内存 MongoDB 二进制：

```bash
# PowerShell
$env:MONGO_URI="mongodb://localhost:27017/boardgame_test"
npm run test:api
```

> 未设置时使用 `mongodb-memory-server` 自动启动临时 MongoDB。

---

## E2E 截图核对规范入口（2026-03）

> 截图核对、流程截图证据链、状态切换、奖励骰 / 特写、攻击修正、视觉项、资源缺失和对外结论口径统一归 [`.spec/knowledge/standards/e2e-verification.md`](../.spec/knowledge/standards/e2e-verification.md)。
>
> 本文只保留测试运行、截图附件目录和工具 API；新增截图验收规则必须改 E2E 主源，避免 `automated-testing.md` 与 `e2e-verification.md` 双写。

---

## GameTestRunner

游戏领域层专用测试运行器，输入命令序列 → 执行 pipeline → 断言最终状态。

使用规范以 [`.spec/knowledge/standards/testing-tdd.md`](../.spec/knowledge/standards/testing-tdd.md) 为主源。成功路径除了断言最终状态，也要断言没有失败步骤；非法命令或拒绝路径才使用 `expectError`。

### 1. 定义断言类型

```typescript
interface MyGameExpectation extends StateExpectation {
    winner?: string;
    score?: number;
}
```

### 2. 实现断言函数

```typescript
function assertMyGame(state: MyGameCore, expect: MyGameExpectation): string[] {
    const errors: string[] = [];
    if (expect.winner !== undefined && state.winner !== expect.winner) {
        errors.push(`获胜者不匹配: 预期 ${expect.winner}, 实际 ${state.winner}`);
    }
    return errors;
}
```

### 3. 编写测试用例

```typescript
const testCases: TestCase<MyGameExpectation>[] = [
    {
        name: '正常流程 - 玩家获胜',
        commands: [
            { type: 'MOVE', playerId: '0', payload: { ... } },
        ],
        expect: { winner: '0' },
    },
    {
        name: '错误测试 - 非法操作',
        commands: [{ type: 'INVALID_MOVE', playerId: '0', payload: {} }],
        expect: { expectError: { command: 'INVALID_MOVE', error: 'invalidMove' } },
    },
];
```

### 4. 运行测试

```typescript
const runner = new GameTestRunner({
    domain: MyGameDomain,
    playerIds: ['0', '1'],
    assertFn: assertMyGame,
});

runner.runAll(testCases);
```

### API 参考

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `domain` | `DomainCore` | 游戏领域内核 |
| `playerIds` | `string[]` | 玩家列表 |
| `setup` | `(playerIds, random) => state` | 可选，自定义初始化 |
| `assertFn` | `(state, expect) => string[]` | 断言函数 |
| `visualizeFn` | `(state) => void` | 可选，状态可视化 |
| `random` | `RandomFn` | 可选，自定义随机数 |
| `silent` | `boolean` | 可选，静默模式 |

| TestCase 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 测试名称 |
| `commands` | `Command[]` | 命令序列 |
| `expect` | `StateExpectation` | 预期结果 |
| `setup` | `(playerIds, random) => state` | 可选，单测自定义初始化 |
| `skip` | `boolean` | 可选，跳过 |

---

## E2E 状态同步工具

### waitForState 工具集

智能状态轮询工具，替代固定时间等待（`waitForTimeout`），提升测试速度和稳定性。

**位置**: `e2e/helpers/waitForState.ts`

**核心函数**:

| 函数 | 用途 | 示例 |
|------|------|------|
| `waitForState` | 通用条件等待 | `await waitForState(page, async () => condition)` |
| `waitForCoreState` | 等待核心状态 | `await waitForCoreState(page, (core) => core.currentPlayer === '1')` |
| `waitForSystemState` | 等待系统状态 | `await waitForSystemState(page, (sys) => sys.phase === 'attack')` |
| `waitForPhaseChange` | 等待阶段变化 | `await waitForPhaseChange(page, 'attack')` |
| `waitForInteractionComplete` | 等待交互完成 | `await waitForInteractionComplete(page)` |
| `waitForGameOver` | 等待游戏结束 | `await waitForGameOver(page)` |
| `waitForStateApplied` | 等待状态应用 | `await waitForStateApplied(page, (core) => core.xxx === yyy)` |

**迁移示例**:

```typescript
// ❌ 旧方式：固定等待
await page.waitForTimeout(500);

// ✅ 新方式：等待阶段变化
await waitForPhaseChange(page, 'attack');

// ❌ 旧方式：固定等待
await applyCoreState(page, state);
await page.waitForTimeout(2000);

// ✅ 新方式：等待状态应用
await applyCoreState(page, state);
await waitForStateApplied(page, (core) => core.currentPlayer === '1');
```

**优点**:
- ✅ 自动适应机器速度（快速机器节省时间，慢速机器不超时）
- ✅ 精确等待到条件满足（不是"等 500ms"，而是"等到阶段变为 X"）
- ✅ 清晰的错误信息（超时时显示当前状态和预期状态）
- ✅ 提升测试速度（平均节省 50% 等待时间）

**完整示例**: 见 `e2e/_shared/example-wait-for-state.e2e.ts`

#### waitForState 详细使用指南

##### 1. 基础用法

```typescript
import { waitForCoreState, waitForPhaseChange, waitForInteractionComplete } from './helpers/waitForState';

// 等待玩家切换
await waitForCoreState(page, (core) => core.currentPlayer === '1');

// 等待阶段变化
await waitForPhaseChange(page, 'attack');

// 等待交互完成（没有 pending interaction）
await waitForInteractionComplete(page);

// 等待游戏结束
await waitForGameOver(page);
```

##### 2. 复杂条件等待

```typescript
// 等待多个条件同时满足
await waitForCoreState(page, (core) => {
  return core.currentPlayer === '1' && 
         core.players['1'].hp > 0 &&
         core.players['1'].resources.mana >= 3;
});

// 等待数组长度变化
await waitForCoreState(page, (core) => {
  return core.players['0'].hand.length === 5;
});

// 等待特定单位出现
await waitForCoreState(page, (core) => {
  const units = core.bases[0].minions;
  return units.some(u => u.defId === 'ninja_infiltrator');
});
```

##### 3. 状态注入后等待

```typescript
// 注入状态后必须等待应用完成
await applyCoreStateDirect(page, {
  currentPlayer: '1',
  players: {
    '1': { hp: 10, resources: { mana: 5 } }
  }
});

// 等待状态应用
await waitForStateApplied(page, (core) => {
  return core.currentPlayer === '1' && 
         core.players['1'].resources.mana === 5;
});
```

##### 4. 自定义超时时间

```typescript
// 默认超时 10 秒，可以自定义
await waitForCoreState(
  page, 
  (core) => core.currentPlayer === '1',
  { timeout: 5000 } // 5 秒超时
);
```

##### 5. 错误处理

```typescript
try {
  await waitForCoreState(page, (core) => core.currentPlayer === '1');
} catch (error) {
  // 超时错误会包含当前状态信息
  console.error('等待超时，当前状态:', error.message);
  // 可以截图保存现场
  await page.screenshot({ path: 'timeout-error.png' });
  throw error;
}
```

#### waitForState 常见问题排查

##### 问题 1：超时但条件看起来应该满足

**症状**：
```
TimeoutError: Waiting for condition failed: timeout 10000ms exceeded
Current state: { currentPlayer: '1', ... }
```

**排查步骤**：
1. 检查条件函数是否正确（是否有拼写错误、逻辑错误）
2. 使用 `readCoreState` 手动读取状态，确认实际值
3. 检查是否有动画延迟（UI 更新但状态未同步）
4. 检查是否有其他交互阻塞（pending interaction）

**解决方案**：
```typescript
// 调试：先读取当前状态
const currentState = await readCoreState(page);
console.log('当前状态:', JSON.stringify(currentState, null, 2));

// 然后调整条件函数
await waitForCoreState(page, (core) => {
  console.log('检查条件:', core.currentPlayer); // 添加日志
  return core.currentPlayer === '1';
});
```

##### 问题 2：条件函数抛出异常

**症状**：
```
TypeError: Cannot read property 'length' of undefined
```

**原因**：条件函数访问了不存在的属性

**解决方案**：
```typescript
// ❌ 错误：没有检查 null/undefined
await waitForCoreState(page, (core) => {
  return core.players['1'].hand.length === 5; // 如果 hand 是 undefined 会报错
});

// ✅ 正确：添加安全检查
await waitForCoreState(page, (core) => {
  const hand = core.players?.['1']?.hand;
  return hand !== undefined && hand.length === 5;
});
```

##### 问题 3：状态更新太快，条件一直不满足

**症状**：等待 `currentPlayer === '1'`，但状态从 '0' 跳到 '2'，跳过了 '1'

**原因**：状态更新太快，轮询间隔（100ms）内状态已经变化多次

**解决方案**：
```typescript
// 方案 1：等待最终状态
await waitForCoreState(page, (core) => core.currentPlayer === '2');

// 方案 2：使用事件监听（如果可用）
await page.waitForEvent('console', msg => {
  return msg.text().includes('Player 1 turn started');
});

// 方案 3：减少轮询间隔（不推荐，会增加 CPU 负载）
await waitForCoreState(
  page, 
  (core) => core.currentPlayer === '1',
  { interval: 50 } // 50ms 轮询
);
```

##### 问题 4：waitForInteractionComplete 一直超时

**症状**：调用 `waitForInteractionComplete` 后一直超时

**排查步骤**：
1. 检查是否有 pending interaction 未处理
2. 检查 UI 是否显示了选择框/确认框
3. 检查是否有 bug 导致 interaction 无法完成

**解决方案**：
```typescript
// 调试：读取当前交互状态
const sysState = await readSystemState(page);
console.log('当前交互:', sysState.interaction);

// 如果有 pending interaction，需要先处理
if (sysState.interaction?.pending) {
  // 点击选项或取消
  await page.click('[data-testid="interaction-option-0"]');
}

// 然后再等待完成
await waitForInteractionComplete(page);
```

##### 问题 5：测试在 CI 环境超时，本地正常

**原因**：CI 环境机器较慢，默认 10 秒超时不够

**解决方案**：
```typescript
// 增加超时时间
await waitForCoreState(
  page, 
  (core) => core.currentPlayer === '1',
  { timeout: 30000 } // CI 环境使用 30 秒
);

// 或者使用环境变量
const timeout = process.env.CI ? 30000 : 10000;
await waitForCoreState(page, condition, { timeout });
```

#### waitForState 最佳实践

1. **优先使用专用函数**：`waitForPhaseChange`、`waitForInteractionComplete` 比通用的 `waitForCoreState` 更清晰
2. **条件函数保持简单**：避免复杂逻辑，只检查必要的条件
3. **添加安全检查**：使用可选链 `?.` 和 nullish coalescing `??` 避免异常
4. **合理设置超时**：默认 10 秒适合大多数场景，复杂操作可以增加到 20-30 秒
5. **失败时截图**：超时时保存截图和状态快照，方便排查问题
6. **避免过度等待**：不要在每个操作后都加 `waitForState`，只在关键状态变化时使用

---

## 调试工具

### 测试模式（调试面板）

测试模式用于快速联机测试：执行一次行动后自动切换到另一位玩家视角。

- **入口**：调试面板（右下角工具按钮）→ `⚙️ 系统` 标签页
- **开启**：执行任意 move 后自动切换视角（P0 ⇄ P1）
- **状态**：持久化到本地存储（键：`debug_testMode`）
- **限制**：仅面向开发调试，主要适用于 2 人对局

### 调试测试

```bash
# 详细输出
npx vitest run <文件路径> --reporter=verbose

# 监听模式
npx vitest <文件路径>

# VS Code 调试器：在测试文件中设置断点，使用 "JavaScript Debug Terminal" 运行
```

### ⚠️ 危险操作警告（强制）

**禁止使用以下命令清理进程**：

```bash
# ❌ 禁止：杀掉所有 Node.js 进程
taskkill /F /IM node.exe
killall node

# ❌ 禁止：杀掉所有进程（包括其他项目、IDE、工具）
taskkill /F /IM node.exe 2>$null
Get-Process node | Stop-Process -Force
```

**为什么禁止**：
- 会杀掉所有 Node.js 进程，包括其他项目的服务器
- 会杀掉 VS Code 的语言服务器、调试器等工具
- 会杀掉正在运行的其他测试
- 会导致数据丢失和状态不一致

**正确做法**：

```bash
# ✅ 清理单个测试的端口（推荐，不影响其他并行测试）
# 1. 查找占用端口的 PID
netstat -ano | findstr :5173    # Windows
lsof -ti:5173                   # Linux/Mac

# 2. 只杀掉该测试的进程
taskkill /F /PID <PID>          # Windows
kill -9 <PID>                   # Linux/Mac

# ✅ 清理所有测试环境端口（会影响所有并行测试，谨慎使用）
npm run test:e2e:cleanup        # 清理测试环境端口（5173/19000/19001）

# ✅ 清理开发环境端口（不影响测试）
npm run clean:ports             # 清理开发环境端口（3000/18000/18001）

# ✅ 清理特定 worker 的端口（并行测试）
node scripts/infra/port-allocator.js <workerId>  # workerId: 0, 1, 2...
```

**并行测试端口分配**：
- Worker 0: 3000, 18000, 18001
- Worker 1: 3100, 18100, 18101
- Worker 2: 3200, 18200, 18201
- 每个 worker 使用独立端口范围（+100 偏移）

**如果测试环境混乱**：

1. 先检查端口占用：`npm run test:e2e:check`
2. **优先清理单个测试的端口**（不影响其他测试）：
   ```bash
   # 查找并杀掉特定端口的进程
   netstat -ano | findstr :5173
   taskkill /F /PID <PID>
   ```
3. 如果需要清理所有测试端口（会中断其他并行测试）：`npm run test:e2e:cleanup`
4. 最后手段：重启终端/IDE（不要杀掉所有进程）

---

## 持续集成

当前仓库采用 `quality-gate.yml` 作为主门禁，PR/主分支推送必须通过：

1. `npm run typecheck`
2. `npm run test:games`
3. `npm run i18n:check`
4. `npm run test:e2e:critical`

其中 `test:e2e:critical` 为关键 E2E 烟测（当前覆盖 SmashUp 与 TicTacToe rematch）。

```yaml
# GitHub Actions 示例（quality gate）
- name: Typecheck
  run: npm run typecheck
- name: Run Game Tests
  run: npm run test:games
- name: Run i18n Contract Check
  run: npm run i18n:check
- name: Run Critical E2E
  run: npm run test:e2e:critical
```

---

## 添加新游戏测试

游戏测试会自动包含在 `npm run test:games` 中。如需单独运行：

```json
{
  "scripts": {
    "test:newgame": "vitest run src/games/newgame"
  }
}
```

---

## 构建排除

测试文件不打包到生产环境：

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    external: [/__tests__/]
  }
}
```
