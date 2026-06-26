---
name: create-new-game
description: "为本项目创建新游戏或先做新游戏资源/data intake。当用户要求新增游戏，或只给图片/位置就希望先开工时使用。基于 dicethrone/summonerwars/smashup 的真实模式，分阶段完成，并带启动询问、素材 intake 与验收门禁。"
---

# 创建新游戏（分阶段工作流）

> **核心原则**：每个阶段独立可验证、独立可提交。阶段之间不留 TODO 缺口。AI 必须在完成当前阶段验收后才能进入下一阶段。

## 流程完整度口径（强制）

- **适用范围**：凡是新游戏 workflow 已经进入 proposal / spec / design / tasks / approval gate / change 拆分阶段时。
- **默认口径**：这里默认追求的是**流程完整度与边界真实度**，不是“先做一条最小 proposal 再说”。
- **`最小` 的允许位置**：
  - 仅可用于描述局部补救动作、低风险辅助检查、单次压缩/脚本调用等非流程主交付物；
  - 不得用于 change 定义、proposal 范围表达、spec 拆分、approval gate 解释或“走流程”的默认策略。
- **用户说“走流程 / 补 spec / 提 proposal / 按流程来”时的强制理解**：
  - 先审计当前真实阶段已经跨到哪些边界；
  - 再把对应的 proposal / design / tasks / spec delta / approval 状态补齐；
  - 不得为了“更快开工”故意只保留最小 foundation、最小提案或最小 change。
- **禁止行为**：
  - 禁止把“先最小提案”“先最小 foundation”“先挂一条再说”当成默认响应；
  - 禁止明知当前范围已经涉及 `card-catalog / gameplay / scoring / runtime-entry`，却仍强行收缩成单条 foundation change；
  - 禁止用“实现范围先最小”偷换成“流程交付物也最小化”。
- **最低汇报要求**：只要进入流程阶段，汇报里必须明确写出“当前已存在哪些 change / 当前请求实际跨到哪些 change / 本轮补的是哪几层主文档 / 哪些 change 仍待批准”，不能只说“我先补一个最小提案”。

## 新游戏 worktree 覆盖口径（强制）

- **适用范围**：仅在“新增/创建新游戏”命中本 skill 时生效。
- **优先级**：在 `branch/worktree` 决策上，本 skill 对新游戏 workflow 的口径高于根 `AGENTS.md` 的通用默认规则；其它非新游戏任务仍按根 `AGENTS.md` 执行。
- **默认动作**：新增新游戏时，默认先创建**独立 git worktree** 作为执行现场，而不是继续在仓库根主工作区直接开工。
- **默认授权**：当用户明确提出“新增游戏 / 创建新游戏 / 做新游戏 / 接入一个新 gameId”时，默认视为**已授权**为该游戏创建隔离 worktree；不再把“能不能开 worktree”当成额外阻塞问题重复确认。
- **最低要求**：
  - worktree 默认从职责正确的 `main` 基线派生；
  - 默认配套新分支命名为 `feat/game-<gameId>`；
  - 汇报里必须明确 worktree 路径、目标 `gameId`、对应分支名。
- **例外**：只有以下情况才不默认新开 worktree：
  - 用户当轮明确说“就在当前工作区做 / 不要新开工作树”；
  - 当前任务已经在一个明确服务该新游戏的独立 worktree 中；
  - 本地 git、权限、磁盘或路径环境阻止创建 worktree，此时必须汇报阻塞点并给出最小补救步骤。
- **禁止降级**：不得因为“只是先录数据 / 先做 UI 草稿 / 先看素材”就留在主工作区推进；这些同样属于新游戏 workflow，应默认在独立 worktree 中完成。

## 新游戏执行现场锁定（强制）

- **真实问题定义**：新游戏 workflow 的失败点不只是“没开 worktree”，还包括“已经开了 worktree，但后续命令、读写文件、测试或汇报仍落回主工作区”。
- **适用范围**：一旦本 skill 为某个新游戏创建或选定了独立 worktree，本轮后续所有与该游戏直接相关的实现、读写、验证、截图、OpenSpec 更新，都必须以该 worktree 作为唯一执行现场。
- **默认动作**：
  1. 创建/确认 worktree 后，立即记录 `worktree 绝对路径 + 分支名 + gameId`；
  2. 第一次继续实施前，必须再次显式核对一次 `git rev-parse --show-toplevel` 与 `git rev-parse --abbrev-ref HEAD`；
  3. 后续每个工具调用都应显式把 `workdir` 指向该 worktree，直到用户明确要求切回别处。
- **汇报门禁**：进入正式编辑前，必须能说清“当前正在 `<worktree-path>` / `<branch>` 上执行”；如果实际仍在主工作区，只能先纠正执行现场，不能继续假装已经切过去。
- **禁止行为**：
  - 禁止在已创建新游戏 worktree 后，继续在仓库根主工作区实现同一 `gameId`；
  - 禁止把“我已经建过 worktree”当成“后续自然就在 worktree 里”的默认前提；
- 禁止在未核对当前 cwd/branch 的情况下继续写某个新游戏的代码。
- **发现偏移后的处理**：
  - 一旦发现命令落在错误现场，必须立即停止继续编辑；
  - 先审计主工作区与目标 worktree 是否已出现同一 `gameId` 的重复产物；
  - 再明确哪边是当前正式实现现场，避免两边继续分叉推进。

## 共享基线与游戏实现分线收口（强制）

- **真实问题定义**：新游戏 workflow 中常见失误不是“没建 worktree”，而是把两类改动混在一起处理：
  1. 本应进入 `main` 的共享基线改动（项目 skill、通用 workflow、全局规范补强）；
  2. 只应留在 `feat/game-<gameId>` worktree 的游戏实现（`src/games/<gameId>/**`、该游戏 i18n、OpenSpec change、测试、evidence、design-system 等）。
- **正规做法**：
  1. 先把共享基线改动在职责正确的主线现场整理清楚；
  2. 共享基线单独提交到 `main`；
  3. 再让目标新游戏 worktree 吸收这批 `main` 更新；
  4. 游戏实现继续只在 `feat/game-<gameId>` worktree 推进。
- **主工作区允许保留的内容**：
  - 只允许保留本次应进入 `main` 的共享改动；
  - 不得把误落到主工作区的该 `gameId` 实现，一并作为“顺手带上”的改动提交到 `main`。
- **发现主工作区与 worktree 同时存在同一 `gameId` 改动时的默认处理**：
  1. 先列出交集文件，按“共享基线 / 游戏实现”分组；
  2. 共享基线留在主工作区整理；
  3. 游戏实现以目标 worktree 为正式现场；
  4. 主工作区里的重复游戏实现只做精确去重，不得继续在主工作区推进。
- **禁止行为**：
  - 禁止因为主工作区里已经有一份新游戏实现，就先把它提交进 `main`，再让 worktree “回头吸收”；
  - 禁止把共享规范提交、游戏功能实现提交、误落重复文件清理，混成一次无边界的大收口；
  - 禁止在未区分“共享改动”和“游戏实现”前，直接宣称“先提交主分支就行”。
- **最低汇报要求**：只要出现主工作区 / worktree 双现场并存，就必须明确汇报：
  - 哪些文件属于共享基线、准备进 `main`；
  - 哪些文件属于该 `gameId` 实现、必须留在 worktree；
  - 主工作区里哪些重复实现需要去重但不能进 `main`。

## 新游戏总框架默认策略与百游戏模式（强制）

- **真实问题定义**：新游戏实现常见两种相反跑偏：
  1. 协作者一看到可复用机制，就默认去改总框架、改引擎、抽共享模块，导致当前游戏迟迟落不了地；
  2. 明明用户希望把机制往“100 个游戏可复用”的方向抽象，协作者却仍然只做一次性游戏内实现，后续每个游戏重复造轮子。
- **默认模式（强制）**：未被用户当轮明确点名时，**默认是不改总框架**。
  - 这里的“不改总框架”包括但不限于：
    - 不主动修改 `src/engine/systems/`
    - 不主动新增/重写 `src/engine/primitives/`
    - 不主动改共享 `framework` 组件语义
    - 不主动把当前游戏机制升级成全项目通用协议
  - 默认先把当前游戏在既有框架能力内落到正确边界；若发现复用缺口，只记录为“候选抽取项”，不自动实施。
- **显式开启百游戏模式（强制）**：只有当用户明确说出类似语义，才允许进入“面向 100 个游戏可复用”的设计与抽象模式：
  - `按 100 个游戏可复用方向设计`
  - `把这个机制上升到总框架`
  - `这块不要只做 betrayal，要做成通用模块`
  - `剧本模块抽成共享能力`
- **进入百游戏模式后的默认动作**：
  1. 先判断这是 `游戏内可复用层`、`项目 framework 层`、还是 `engine/primitives/systems` 层的抽象；
  2. 先做引擎能力缺口分析与抽象边界说明，再动共享层；
  3. 抽象必须服务至少两个明确候选游戏或两个明确机制家族，不能只因为“未来可能有用”就上升总框架；
  4. 共享抽象和当前游戏实现必须拆分为独立 change / 独立提交边界，不能混成一团。
- **剧本模块的默认口径（强制）**：
  - 像 `剧本 / 鬼屋 / traitor-haunt / scenario / campaign / encounter-script` 这类机制，**属于高概率候选共享能力**；
  - 但在未开启百游戏模式前，默认只允许先做 `betrayal` 自身可落地的最小语义壳层，不得直接宣称“这就该进总框架”；
  - 只有用户明确要求做通用化时，才把它升级为共享抽象目标。
- **默认交付要求**：
  - 默认模式下，必须额外留一节 `候选共享抽取项`，记录：
    - 当前机制为什么像共享能力；
    - 若未来上升总框架，最可能落在哪一层；
    - 当前为什么先不抽。
  - 百游戏模式下，必须额外留一节 `共享抽象验收条件`，写清：
    - 抽象服务哪些游戏/机制；
    - 哪些 API/数据结构会成为共享合同；
    - 哪些仍留在当前游戏层。
- **禁止行为**：
  - 禁止协作者默认把“可复用”理解成“必须立刻改框架”；
  - 禁止协作者默认把“先别动框架”理解成“永远不做抽象设计”；
  - 禁止在用户没明确授权时，拿当前游戏当借口顺手大改共享层；
  - 禁止在用户明确要求百游戏模式后，仍然只做一次性临时实现却不补抽象边界文档。

## 新游戏与 OpenSpec 的职责边界（强制）

- **create-new-game 是通用流程，不是具体方案文档**：它负责新游戏的 intake、来源裁定、阶段切分、worktree/分支现场和实施门禁；一旦任务进入某个新游戏的**具体设计、具体布局、具体 runtime 边界、具体任务拆分**，就不能继续只靠本 skill 口头推进。
- **进入具体方案阶段时必须切到 OpenSpec**：只要出现以下任一情况，就必须立即打开 `openspec/AGENTS.md`，为该新游戏建立或更新正式 change：
  - 用户开始要求某个新游戏的具体布局、风格、玩家关注点排序、UI 不变量；
  - 用户开始要求该新游戏的具体实现阶段拆分、proposal、spec、design、tasks；
  - 用户开始要求把探索性 `Board`、`design-system`、`evidence`、`manifest`、`game.ts`、`domain` 等产物纳入正式范围管理；
  - 需求已经不再是“能不能做 / 先 intake 一下”，而是“这次新游戏到底做什么、不做什么、先后顺序是什么”。
- **默认动作**：
  1. 先继续使用本 skill 完成 intake、来源裁定、现场隔离和必要的素材/规则摸底；
  2. 一旦进入具体方案阶段，立即切换到 `openspec` 流程，补 `proposal.md`、`tasks.md`、必要时补 `design.md` 与 spec delta；
  3. proposal 未批准前，不得把探索实现伪装成“已经完成的新游戏接入”。
- **禁止语义降级**：
  - 禁止把具体新游戏的方案阶段表述成“先随便做个静态页 / 先最小提案再说”；
  - 禁止用“最小改动”替代“完整流程”。这里应该收敛的是**实现范围**，不是**流程交付物**；proposal / design / tasks / spec 必须把当前真实范围、边界、风险和待决策项写全。
- **允许的 proposal 前动作**：
  - 来源裁定、素材盘点、规则整理、现有探索产物审计；
  - 为 proposal/service design 提供证据的低风险草稿、截图、布局验证；
  - 但这些只能作为 proposal 的输入或 evidence，不得越过 approval gate 宣称 runtime 接入已正式完成。

## 新游戏需求对齐闭环（强制）

- **真实问题定义**：新游戏最常见的失败不是“没做”，而是“做完后与需求对不上”。因此本 skill 的目标不是把某个局部问题修到能跑，而是让协作者在单步或多步交付后，仍能回查每一项用户需求最终落到了哪一个设计、哪一个实现、哪一个验证。
- **适用范围**：只要任务目标包含“创建新游戏”“接入一个新 gameId”“把素材录入后继续实施游戏”，本节立即生效。
- **强制产物**：进入实现前，必须先形成一份可回溯的需求对齐表，至少逐项列出：
  1. 用户原始目标 / 明确拒绝项；
  2. 该目标对应的 OpenSpec change；
  3. 该目标对应的设计产物（`design.md` / `design-system/games/<gameId>.md` / 架构审查产物）；
  4. 该目标对应的代码或资源落点；
  5. 该目标对应的验证方式；
  6. 该目标是否已完成，若未完成则缺什么。
- **禁止行为**：
  - 禁止“先做出来再说，最后再解释”的口径；
  - 禁止把“能跑”当成“需求对齐”；
  - 禁止把“完成了一个步骤”当成“完成了用户要的游戏”；
  - 禁止在没有逐项对齐表时进入正式实现或正式录入；
  - 禁止把未裁定的需求、未选定的 UI 家族、未冻结的资源合同，直接塞进实现结果里。
- **一步到位 / 多步到位定义**：
  - 一步到位：该轮交付能直接闭合用户原始目标，且对齐表里所有条目都已完成或明确标记为用户接受的后续项。
  - 多步到位：允许拆成多个 change，但每一步都必须是可独立验收的“完整子目标”，不是半成品。
  - 不允许把“多步到位”变成“先做一半，最后靠猜补齐”。
- **收口门禁**：
  - 任何宣称“已完成”“已可交付”“已进入下一步”的结论，都必须能被需求对齐表逐条证明。
  - 若某项需求找不到对应设计、代码或验证证据，默认视为未完成，而不是“应该差不多”。
  - 若用户明确要求“别的合作者也能照着完成”，则必须额外补一份交接清单，写清当前已知边界、后续 change、风险和不能碰的部分。

## 新游戏 OpenSpec 拆分与升级规则（强制）

- **适用范围**：当新游戏已经从 intake 进入正式 OpenSpec change 管理后。
- **先分 change 类型，再继续实现**：默认先判断当前工作属于哪一类 change，而不是把所有后续内容都塞进第一条 foundation change。
  - `foundation`：方向、布局不变量、首期边界、探索产物转正。
  - `card-catalog`：官方卡表、数据合同、真相源映射、录入验证。
  - `gameplay`：回合循环、命令、领域规则、结算链路。
  - `scoring`：正式计分、胜负裁定、复杂语义求值。
  - `runtime-entry`：`manifest.enabled`、大厅入口、loaderMap、本地入口开放。
- **范围升级必须显式升级 change**：
  - 如果当前实现已经越过现有 change 的边界，必须先新建后续 change，或显式更新现有 proposal/design/tasks/spec。
  - 禁止继续沿用“还是同一条最小 foundation change”的口径，把后续 gameplay / scoring / runtime-entry 混写进旧 change。
- **用户说“走流程”时的默认动作**：
  1. 读取 `openspec/AGENTS.md`、`openspec list`、`openspec list --specs`；
  2. 审计当前新游戏已有哪些 change、当前请求实际跨到哪些边界、缺哪一层主文档；
  3. 按真实范围补 proposal / design / tasks / spec delta；如果已跨出当前 change，先补新的 change 或显式升级旧 change；
  4. 运行 `openspec validate <change-id> --strict --no-interactive`；
  5. 再汇报“当前 change 范围、已完成 change、待批准 change、下一条 change”。
- **禁止把“走流程”收缩成单条最小 change**：
  - 如果用户当前要求已经明确覆盖玩法、计分、运行时入口或 UI 不变量，不得只补 foundation；
  - 如果当前已有多条 change 在并行服务同一个新游戏，不得假装只有最靠前那条存在；
  - 如果主文档缺的是 `design.md`、`tasks.md` 或 spec delta，不得只补一份 proposal 交差。
- **禁止只补旁证，不补主文档**：
  - 禁止只改 `design-system`、`evidence`、静态稿或截图，而不同时更新对应的 proposal / design / tasks / spec。
  - 禁止只说“已经做完 foundation / 已经有 runtime”，却说不清它分别落在哪些 change 里。
- **批准门禁保持真实**：
  - 未获批时，只能说“proposal 已就绪 / 已校验 / 待批准”，不能把后续实现任务直接标成已完成。
  - 若实现已先行存在，必须明确标注为“探索产物”或“待 proposal 对齐”，不得把它反向包装成流程已经走完。
- **批准语义不得偷换**：
  - 用户说“继续”“继续任务”“继续做”“按 OpenSpec 走流程”“先补 spec”“先提 proposal”，只代表**允许继续推进流程产物**，不等于批准任意一条 change 的实现范围。
  - 只有当用户明确点名当前 change，或明确说“按这个 proposal / 这条 change 的范围继续做”，才可把对应 `Approval Gate` 记为已批准。
  - 某一条 change 已获批，不自动外溢到后续 `card-catalog / gameplay / scoring / runtime-entry` 等新 change；后续每条 change 都要分别确认范围。
  - `tasks.md` 中的 `0.1 Approval Gate` 必须写成“批准哪条 change、批准到什么边界”的具体语义，禁止用“用户要求继续流程”或“用户说继续某个新游戏”冒充批准记录。

## 新游戏附加能力矩阵与本体后确认（强制）

- **真实问题定义**：当前 skill 已要求新游戏接 OpenSpec，也已默认复用 `ActionLog / Undo / Tutorial` 等系统，但还缺一层明确门禁：游戏本体确认完成后，哪些附加能力要继续正式实施，哪些本轮有意跳过，为什么跳过，何时补，不应靠 AI 临场猜。
- **适用范围**：所有“新增游戏 / 完整接入一个 gameId / 以可交付游戏为目标推进”的 workflow。
- **先后顺序（强制）**：
  - `gameplay / scoring / runtime-entry / board-ui` 这些游戏本体能力优先；
  - `action-log / undo-system / game-ai-system / tutorial-engine / debug-config` 默认视为**本体后的附加能力**；
  - 附加能力不得反向阻塞“本体是否已完成”的判断，除非用户当轮明确把它们纳入本轮主交付。
- **测试友好最低 AI 路径（强制）**：
  - 这里要区分两件事：`完整 game-ai-system` 仍然默认属于本体后的附加能力；但为了让新游戏可重复测试，**本体阶段必须至少保留一种可重复的人机测试路径**。
  - 可接受形态至少包括其一：
    - `manifest.ai.localAi = true`，本地模式可直接加入 AI 座位；
    - 在线 / 建房流程支持 AI 座位加入或等价的人机占位测试入口；
    - 至少一条 E2E / helper 能以 AI 座位完成多人链路收口，而不是必须依赖多个人工页面同时操作。
  - 这条要求的目标是**测试可达性**，不是要求首批就做完强单机、难度档位、远程 provider 或完整 AI 策略体系。
- **默认可选能力矩阵**：至少逐项裁定以下能力，不得漏项：
  - `action-log`：操作日志 / HUD 日志面板
  - `undo-system`：撤回 / 撤回审批
  - `game-ai-system`：本地 AI、强单机、AI 座位可玩性
  - `tutorial-engine`：教学步骤 / 引导
  - `debug-config`：仅开发态调试面板（是否需要）
- **每项都必须有状态**：`实施本轮` / `本轮明确跳过` / `仅保留底层接口，UI 暂不交付` 三选一，不允许空着。
- **记录落点（强制）**：
  1. 游戏进入 OpenSpec 后，foundation change 的 `proposal.md` 或 `design.md` 必须包含该矩阵；
  2. `tasks.md` 必须把“本轮实施项”和“显式跳过项”写成可勾选条目；
  3. 若跳过，必须写明原因、影响和计划补回的后续 change（如 `ai-support` / `tutorial` / `action-log`）。
- **实施边界**：
  - `action-log / undo-system / tutorial-engine / game-ai-system` 属于**本体后的可选附加能力**，不是所有游戏首批都必须上；
  - 但它们是否跳过，必须由用户或 proposal 明确裁决，不能由 AI 默默不做。
  - **例外澄清**：为了建房 / 联机 / waiting / spectator 这些链路能稳定验证，允许把“AI 座位可加入房间 / 本地模式可补 AI 座位 / E2E helper 可拉起 AI 座位”视为本体测试基础设施；这不等于“完整 `game-ai-system` 已在本轮全部完成”。
- **本体完成后的二次确认（强制）**：
  - 在准备提 PR、请求合并或宣称“这个游戏已可交付”之前，若游戏本体已确认完成，必须再次向用户汇报一次附加能力矩阵：
    - 哪些已实施；
    - 哪些本轮跳过；
    - 跳过是否仍被用户接受。
  - 若用户此时追加其中某项（例如“把日志也带上”“顺手把 AI 做了”），必须先更新 OpenSpec 记录，再进入实现。
- **禁止行为**：
  - 禁止因为 `createBaseSystems()` 默认带了 `ActionLog / Undo`，就默认把该游戏视为“已经支持日志/撤回”；
  - 禁止因为某游戏已有 `ai.ts` 雏形，就默认视为“AI 已完成”；
  - 禁止在本体完成后准备提 PR 时，才临时发现“这个游戏其实没问过要不要日志/撤回/AI”。
- **最低汇报要求**：只要用户希望“一次能实施完毕游戏”，就必须在前置阶段明确答出：
  1. 本轮目标是“先把游戏本体做完”还是“本体 + 附加能力一次性交付”；
  2. 附加能力矩阵当前分别是什么状态；
  3. 哪些能力若本轮不做，不影响本体完成；哪些若不做，会影响“可发布 / 可教学 / 可单机体验”的扩展口径。

## 新游戏大任务拆解与 UI 债务门禁（强制）

- **适用范围**：当新游戏任务已经大到需要同时处理规则、数据、运行时、主 Board、移动端、AI、截图验收、入口开放中的任意两类以上，或单个 `Board.tsx`/主 UI 文件开始承载多套布局分支时。
- **大任务不得直接实施**：
  - 先把当前目标拆成若干 OpenSpec change，每条 change 只绑定一个可验收结果，例如 `foundation`、`card-catalog`、`gameplay`、`scoring`、`runtime-entry`、`board-ui-desktop`、`board-ui-mobile`、`ai-support`。
  - 每条 change 必须有自己的 `proposal.md`、`tasks.md` 和 spec delta；涉及跨模块架构或 UI 家族切换时必须有 `design.md`。
  - 禁止把“先整体做出来再补流程”当成默认路线；实现已先行存在时，必须先标注为探索产物，再回填或拆分 OpenSpec，不能继续在探索产物上堆实现。
- **UI 家族收口门禁**：
  - 当主 Board 同时存在旧三栏/堆叠/新牌桌/实验预览等多套 UI 家族，必须先在 OpenSpec 中裁定哪一套是正式语义，再进入实现。
  - 正式 UI 家族确定后，只允许保留必要的响应式降级分支；旧 UI 家族不得继续作为“兜底”长期并存，除非在 `design.md` 明确说明触发条件、保留期限和删除验收。
  - 如果单个 Board 文件超过 300 行或同时包含领域推演、布局分支、CSS、交互状态和截图专用状态，必须在 tasks 中安排拆分到 `ui/` 子模块；不得把继续加样式当作主修法。
- **常驻语义单承载门禁**：
  - 同一条进行中主命令、同一条短状态、同一个区块标题，在同一首屏常驻 UI 中只能有**一个可见主承载位**；不得在顶部状态条、侧边主按钮、区块内标题、悬浮提示之间用同一文案重复占位。
  - 顶部状态条/状态 chip 只负责报状态，不得重复主操作按钮的命令文案；例如右侧主按钮已承担 `抓一张牌`，顶部就只能显示 `摸牌`、`弃牌`、`等待` 这类状态，而不能再写一次 `抓一张牌`。
  - 外层区块标题与内层卡片/列表标题不得使用同一可见标题重复命名；若确需重复语义，只允许其中一处保留为无障碍 `aria-label` 或非可见结构语义。
  - 新增或重构主 UI 后，必须用截图、测试或定向查询证明关键命令文案/关键标题在当前目标视口下只出现一次；若需要把断言放宽成 `getAllByText(...).length >= 1`，必须先说明为什么不是重复 UI。
- **动效合理性门禁**：
  - 新游戏主 UI 的动效必须先区分“状态反馈”“结果揭示”“装饰质感”和“操作确认”；每类动效都要写清触发来源与结束条件。
  - 禁止用固定定位大按钮、过重阴影、无位移动画的 hover、持续脉冲、视觉噪声或重复高亮来替代清晰交互。
  - 动效只允许绑定真实状态或用户明确操作；命令可能失败的操作不得先播放成功态动画。
- **最低收口证据**：汇报新游戏大任务进展时，必须同时说明：
  1. 当前有哪些 OpenSpec change，各自负责什么；
  2. 哪条 change 是当前 active scope，哪些仍待批准；
  3. 主 Board 当前只保留哪一套正式 UI 家族，哪些旧分支仍待删除；
  4. 动效触发源、持续时间和退出条件是否已审查；
  5. 对应真实入口截图/E2E/测试证据在哪里。
  缺任一项，不得宣称“新游戏主 UI 已完成”或“这是一个正常可交付游戏”。

## 必读索引（单一权威来源，避免本文档过时）

> 本 skill 只做“分阶段流程 + 验收门禁 + 单阶段闭环”。
> 任何**规范/红线/最佳实践**若在下列文档中已有定义，必须以它们为准；本 skill 不重复展开。
> 若本文与下列权威文档出现路径、组件、命令或门禁冲突，先按权威文档执行，并立即修正本文，不得用本文内的旧示例覆盖实施规范。

- 总则：`AGENTS.md`
- 引擎/系统/move/command：`docs/ai-rules/engine-systems.md`
- UI/布局/组件：`docs/ai-rules/ui-ux.md`
- React 白屏/渲染错误/Hook 规则：`docs/ai-rules/golden-rules.md`
- 动画/特效：`docs/ai-rules/animation-effects.md`
- 数据录入/真相源契约：`docs/ai-rules/data-entry.md`
- 图片/音频资源接入：`docs/ai-rules/asset-pipeline.md`
- 音频细则：`./.codex/skill/audio-integration/SKILL.md`（workflow） + `docs/audio/audio-usage.md`（合同）；新增音频资产流程见 `docs/audio/add-audio.md`
- 工具脚本：`docs/tools.md`
- 图片 intake 复刻案例：`docs/games/smashup/workflows/smashup-faction-intake.md`
- 不确定该读哪份：`docs/ai-rules/doc-index.md`

## 实施规范接入门禁（强制）

进入任何目录创建、素材落盘、压缩、资源引用、`thumbnail.tsx`、`criticalImageResolver` 或 manifest 资源字段之前，先执行对应实施规范；本 skill 不允许自带第二套路由。

- 图片/缩略图/图集/音频落盘与引用：以 `docs/ai-rules/asset-pipeline.md` 为单一实施合同。
- UI 组件与布局：以 `docs/ai-rules/ui-ux.md` 为实施合同。
- 引擎、系统、move/command：以 `docs/ai-rules/engine-systems.md` 为实施合同。
- React 白屏、Hook、函数提升、注册时机：以 `docs/ai-rules/golden-rules.md` 为实施合同。

资源实施最低门禁：

1. 新游戏图片默认进入 `public/assets/i18n/zh-CN/<gameId>/...`；`public/assets/<gameId>/...` 只作为历史兼容或 `asset-pipeline` 明确允许的例外，不得作为新资源默认落点。
2. 缩略图也属于图片资源，默认落到 `public/assets/i18n/zh-CN/<gameId>/thumbnails/`，运行时由 `ManifestGameThumbnail` / `OptimizedImage` 解析。
3. 代码里传资源路径只传相对逻辑路径，例如 `<gameId>/thumbnails/cover`；禁止硬编码 `/assets/`、`compressed/`、`.webp` 或版本参数。
4. 如果必须偏离上述公共链路，必须在当前任务证据中写明原因、影响范围和验收方式。

## 新游戏设计稿目录（强制）

- **适用范围**：只要本轮为某个新游戏产出设计稿、参考图、布局稿、实现骨架稿、风格对照图或生图 brief。
- **单一正式目录**：游戏级设计稿默认统一放在 `docs/games/<gameId>/design/`，禁止继续散落到 `evidence/<gameId>/`、`temp/`、仓库根目录或其它平行入口。
- **设计稿与规范文档不是一回事（强制）**：
  - `design-system/games/<gameId>.md` 是**可实现 UI 规范 / 实现约束文档**；
  - `docs/games/<gameId>/design/generated/*.png|jpg|webp` 才是**位图设计稿 / 视觉稿 / 生图稿**；
  - 不能再把 `design-system` 文档本身当成“设计稿已交付”。
- **推荐子目录**：
  - `docs/games/<gameId>/design/reference/`：外部参考、量测底稿、参考 HTML/SVG、brief。
  - `docs/games/<gameId>/design/implementable/`：可前端复刻的实现骨架稿、布局红稿、实现说明。
  - `docs/games/<gameId>/design/generated/`：保留的位图生图或最终概念稿。
- **目录职责**：
  - `reference` 负责“看什么”；
  - `implementable` 负责“按什么落代码”；
  - `generated` 负责“最终保留哪张图”。
- **最低索引文件**：目录下必须有 `README.md` 或等价索引，至少写清：
  1. 当前唯一有效的参考稿；
  2. 当前唯一有效的实现稿；
  3. 哪些文件只是历史试稿，是否已清理；
  4. 若存在 repo 外生成图，哪个文件是当前保留的 canonical copy。
- **禁止行为**：
  - 禁止把运行截图、E2E 证据图、审计截图冒充设计稿放进该目录；
  - 禁止把已经放弃的中间试稿长期和当前有效稿并列堆放，又不写索引；
  - 禁止实现已经改向后，目录里还保留多张互相冲突的“当前稿”不做裁定。
- **与 evidence 的边界**：
  - `evidence/` 只放验证、审计、截图结论和收口证据；
  - `docs/games/<gameId>/design/` 只放设计输入、实现骨架和保留稿。

## 前置 0：环境与来源确认（强制）

开始任何目录创建、规则录入、素材落盘前，先做以下确认。**这是本 skill 的默认提问模板，不等用户自己提醒**：

1. **主分支基线确认**
   - 先检查当前是否基于职责正确的 `main` 基线。
   - 主动询问用户是否要先同步/更新 `main`；默认推荐“是”，尤其是准备新开 `feat/game-<gameId>` 时。
   - 命中新游戏 workflow 时，默认直接从 `main` 派生 `feat/game-<gameId>` 并创建独立 worktree；只有用户明确要求留在当前工作区时才跳过。
2. **R2 本地同步确认**
   - 主动询问是否要先执行 `npm run assets:download -- --check` 或 `npm run assets:download`，把远端资源拉到本地。
   - 推荐场景：换机/新环境、本地缺图、要复用 `common/` 资源、或当前游戏已有远端图片资产。
3. **真相源 / 对照源裁定**
   - 主动询问本轮主真相源是什么：官方规则书、官方站点、用户图片、用户指定网站、数据库等。
   - 主动询问是否要把 Wiki、用户给的网站或其他数据库作为对照源一起比对。
   - 未裁定前，禁止把多个来源的内容直接混写进代码。
4. **素材处理授权**
    - 主动询问是否允许 AI 自动重命名、自动移动到语义目录、自动压缩。
    - 若用户只给图片路径 + 位置表 / 行列数 / 裁片顺序，也允许直接进入资源 intake，不必等到完整玩法阶段。
    - **自动重命名的依据必须先说明**：默认依据是读图得到的对象语义 + 真相源合同，不是原文件名。
    - **默认不改用户已有命名**：只有当文件名明显是随机值、导出默认名或无语义占位名时，才默认自动改名；否则先询问，未获确认就保留原命名。
5. **移动端适配默认启用**
   - 移动端适配是全游戏统一规范，不作为“是否需要”的可选问题询问用户。
   - 只允许询问主使用姿态或验收优先级（例如手机横屏、竖屏、平板），不允许把“要不要考虑移动端”交给用户触发。
   - 新游戏设计阶段必须主动选定 `mobileProfile / preferredOrientation / mobileLayoutPreset`，并写入游戏专属 UI 规范。

## 前置 1：信息收集（启动门禁）

收集以下信息后才能开始。**已有信息直接使用，缺失项回问用户，不猜测**：

1. **gameId**（小写，与目录名一致，如 `smashup`）
2. **玩家人数范围**（如 `[2]`、`[2,3,4]`）
3. **核心机制简述**（如"卡牌驱动+区域控制"、"骰子+角色技能"、"战棋+召唤"）
4. **是否需要阶段/流程系统**（多阶段回合制 → FlowSystem）
5. **规则文档位置**（若有，先放 `rule/` 目录下）
6. **i18n 标题与简介**（中英文）
7. **当前素材输入形态**（规则书/PDF/图片路径/位置表/网站/Wiki/用户整理表）
8. **是否允许自动重命名并移动素材到正式目录**
9. **是否需要先拉取 R2 本地资源**
10. **是否需要与 Wiki / 官网 / 用户指定站点做对照录入**
11. **主视觉素材**（按游戏实际形态识别：主地图/主棋盘/桌面板、角色板、卡牌 atlas、骰子/转盘、token、牌背、缩略图等）
12. **空间承载类型**（先分类：无空间载体 / 网格 / 区域地图 / 点位网络 / 轨道 / 桌面区位 / 混合）
13. **空间载体交互**（仅当存在地图/棋盘/大桌面/轨道时继续判断：是否需要拖拽、缩放、聚焦、旋转、翻面或局部放大）
14. **空间数据来源**（仅当存在空间载体时继续判断：格子、区域、点位、轨道、邻接、区位坐标是否已有来源）
15. **空间实体定位方式**（仅当实体会进入空间载体时继续判断：卡/棋子/token/标记/资源在格子、区域、点位、轨道或桌面区位上的定位与堆叠方式）
16. **移动端主姿态**（只收集横屏/竖屏/平板优先级；不询问是否适配）

**先查已有字段**：阅读 `src/games/manifest.types.ts` 确认可用字段，避免重复询问。

## 前置 1.1：用户问“添加新游戏怎么做”时的主动指导模板（强制）

当用户只是问“添加新游戏该怎么做”“我想做一个新游戏”“给你素材能不能做”时，AI 必须主动给出可执行 intake 指南，而不是只说“提供规则和素材即可”。

### 必须主动说明的输入清单

1. **规则来源**
   - 官方规则书 PDF/Markdown、玩家帮助卡、FAQ/勘误、用户指定对照网站。
   - 若只有 PDF，先走 `前置 1.4` 转 Markdown。
2. **核心素材**
   - 缩略图、主棋盘/主地图、玩家面板、卡牌正反面、牌背、单位/标记/token、骰子或转盘、帮助卡。
   - UI 设计必须优先参考这些图片素材，尤其主地图、主棋盘、角色板这类决定构图的素材。
3. **空间/桌面数据（按游戏类型触发）**
   - 先判断游戏是否存在空间载体：地图、棋盘、轨道、桌面区位、玩家面板槽位、token 区域等。
   - 有空间载体时，再收集网格行列、区域边界、区域名称、邻接关系、轨道点、实体定位点、槽位、控制点等。
   - 无空间载体时跳过本项，不得把地图类问题套给纯卡牌、骰子、词语、经济、问答、拍卖等游戏。
   - 若用户没有坐标表且该游戏确实依赖空间载体，AI 必须主动记录“坐标/槽位合同缺口”和建议产出时机；不得默认立刻做脱离真实 Board 的独立工具。
4. **玩法信息**
   - 玩家人数、回合/阶段结构、胜利条件、隐藏信息、随机性来源、资源类型、交互复杂度。
   - 若要先出游戏设计稿/牌桌生图，必须额外先锁 `进行中可见`、`仅自己可见`、`仅终局揭示`、`旁观者不可见` 四类信息；像实时排名、他人实时分数、隐藏手牌、终局前不可公开的对象，未被规则明确允许前，一律不得画进设计稿。
   - 还必须先列 `交互模式来源表`：每个关键动作由什么对象承接、是否需要确认步骤、提示是否常驻、等待态由谁承接，以及它来自正式设计稿、官方产品、仓内既有真相还是用户明确要求。没有来源的交互模式，不得直接写进 `design-system/games/<gameId>.md` 或正式实现。
   - 还必须先列 `主交互槽位五联单`：每个关键步骤都要写清 `主交互对象 / 固定槽位 / 让位顺序 / 禁止侵入对象 / 来源家族`。没有这份五联单，不得直接开始 Board 布局或交互实现。
   - `来源家族` 必须能回查到真实仓内文件或正式截图，不能只写“参考成熟项目”。优先复用本仓已验证家族，例如 `src/games/smashup/ui/HandArea.tsx`、`src/games/smashup/ui/PromptOverlay.tsx`、`src/games/smashup/ui/MeFirstOverlay.tsx`、`src/games/smashup/Board.tsx` 中的承接面路由。
   - 若准备把前置选择、等待态、手牌选择、棋盘直选、中央响应层写进正式 UI 规范或 `design-system/games/<gameId>.md`，验收口径还必须先写明：主交互槽位在交互前/中/后是否漂移、临时 UI 是否侵入主槽位、页面是否出现双主焦点。没有这三条验收口径，不得把该交互模式定稿。
   - 固定牌桌/棋盘类游戏的桌面进行页，默认必须在 `1920x1080` 首屏内显示完整游戏状态；除非规则或用户明确允许长桌、可滚动地图或多层战场，不得把页面级滚动当成主布局方案。
   - 牌桌质感必须来自素材、桌面底材、卡面层次、光影和少量必要 HUD；没有有效设计稿依据时，不得用反复叠外框、内框、细线框、圆角大面板来冒充高级感。
5. **移动端基线**
   - AI 直接说明移动端是默认工作内容，并根据游戏形态建议横屏/竖屏与 `mobileLayoutPreset`。

### 默认回答结构

```text
我会先做这几步：
1. 规则转 Markdown，并保留来源和质量说明。
2. 盘点素材，找出主地图/主棋盘/主面板作为 UI 设计参考。
3. 判断是否有空间载体：没有就跳过地图/点位问题；有则继续分为网格、区域地图、点位网络、轨道或桌面区位。
4. 如果有地图、棋盘、轨道或桌面区位，先记录坐标/槽位合同需求与工具需求；默认等真实 Board/地图壳初版可运行后，再做嵌入式校准工具。
5. 产出 design-system/games/<gameId>.md，包含桌面与移动端方案。
6. 再进入骨架、数据结构、规则实现、UI 闭环。
```

## 前置 1.2：素材驱动 UI 与空间/工具时机裁决（强制）

新游戏 UI 设计不得脱离素材凭空发挥。只要用户提供了图片目录或图片文件，AI 在生成 `design-system/games/<gameId>.md` 前必须先做：

1. **素材视觉盘点**
   - 识别最大图、主地图/主棋盘、角色板、牌背、卡牌 atlas、token/marker。
   - 记录关键图片的路径、尺寸、疑似用途。
   - 主 UI 设计必须引用这些素材观察结论，尤其主地图/主棋盘的实际构图、颜色、已有 UI 区块和留白。
2. **空间承载类型裁决**
   - 先判断游戏是否有空间载体。可能是无空间载体、网格、区域地图、点位网络、轨道、桌面区位、玩家面板槽位或混合形态。
   - 无空间载体的游戏，不触发地图拖拽、区域划分、实体定位点等问题。
   - 有大地图/大棋盘/大桌面时，默认评估拖拽、滚轮缩放、双指缩放、重置视角、聚焦目标；地图类优先复用 `src/games/summonerwars/ui/MapContainer.tsx` 的交互模式。
3. **空间合同与工具时机门禁**
   - 区域地图、点位网络、轨道、桌面区位、可放置实体的空间载体，必须先识别坐标/槽位合同需求。
   - 前置阶段默认只产出合同字段、待标注对象、素材依据和风险清单；不要为了“有工具”先做脱离运行时的独立页面。
   - 即使用户说“制作工具”，AI 也必须先判断最佳时机，并说明推荐路线：通常等真实 Board、真实缩放/拖拽、真实资源和真实坐标系跑通后，再做嵌入式编辑/校准工具。
   - 地图/棋盘类工具优先复用 SummonerWars 式模式：在真实游戏 Board 或 MapContainer 内开启开发编辑态，直接校准运行时使用的坐标、命中区、堆叠点和导出数据。
   - 独立工具只允许作为临时低保真/离线数据采集方案，必须明确“不是最终工具”，且不得替代真实 Board 内校准与截图验收。
   - 区域地图最终工具至少支持：导入/绑定地图图、标多边形区域、标实体定位点/城市点/人口点/控制点、编辑 `id/name/type/adjacentRegionIds`、导出 JSON。
4. **空间实体定位主动设计**
   - 只有当规则里存在“实体进入空间载体”时才触发；实体可以是棋子、卡牌、token、资源、标记、骰子、人物、建筑等，不限于单位。
   - 区域控制/地图游戏不能只标区域中心；必须按规则需要单独设计实体定位点或槽位，避免多个实体挤在同一个点。
   - 定位点应带 role，例如 `piece/card/token/resource/city/population/control/marker`；具体 role 由当前游戏定义，不能写成所有游戏通用字段。
5. **移动端默认设计**
   - 移动端适配不再作为可选问题；每个游戏 UI 规范都必须写桌面和移动端。
   - 地图类默认优先 `landscape-adapted + map-shell`；固定牌桌默认优先 `landscape-adapted + board-shell`；天然单列轻游戏才考虑 `portrait-simple`。
   - 如果素材或规则证明该游戏暂不适合手机，也必须在 manifest/UI 规范中写明降级策略，而不是跳过移动端思考。

## 前置 1.2.1：空间载体 setup 真相贯通门禁（强制）

只要新游戏存在地图、棋盘、轨道、桌面区位、玩家面板槽位等空间载体，且规则 setup 会把实体直接摆到这些载体上，本条立即生效。

### 真实问题

- 常见跑偏不是“没有 setup 数据”，而是：
  - 领域层已经有正式 setup 真相；
  - 运行时又额外造一层手写样板 token/marker/piece；
  - Board 最终显示吃的是样板层，而不是正式 setup。
- 这会导致“规则看起来做了，图上却还是错的”，也会让后续修改出现双真相。

### 强制要求

1. **先锁单一真相源**
   - 必须明确 setup 最终落在哪一层：`core.regions`、`boardSlots`、`pieces`、`trackState`、`playerAreas` 等。
   - 若显示层还需要 `mapTokens / markers / overlays / renderedPieces` 之类派生结构，必须明确写出它是**从该真相源派生**，不是第二份手写初始样板。
2. **禁止手写展示样板替代正式 setup**
   - 禁止在 `createInitialCore()`、`Board` 默认 state、静态配置或临时 helper 中，额外写一串只为“先显示出来”的开局 token/piece 样板，并长期替代正式 setup。
   - 允许临时样板只存在于探索阶段，但一旦进入正式 runtime 接入、Board 接入或阶段验收，必须删掉或改成从正式真相派生。
3. **空间实体必须逐类定义派生关系**
   - 至少逐类说明：控制标记、兵力/棋子、人口/资源、外交/状态 marker、城市点/槽位装饰中，哪些是正式对象，哪些只是纯视觉辅助。
   - 对正式对象，必须说明：来源字段、显示位置来源、数量来源、图片/样式来源。
4. **地图/棋盘类不能只验领域，不验显示派生**
   - 不能因为 `regions` / `pieces` / `slots` 已经初始化正确，就宣称 setup 完成。
   - 只要用户在真实页面上能看到这些实体，就必须验证“页面上看到的对象”确实来自正式 setup 真相链。

### 最低验收

进入 Board/UI 阶段或宣称 setup 已完成前，至少补齐以下证据：

1. 一条定向测试，证明正式 setup 真相存在。
2. 一条定向测试，证明显示派生层对象来自该真相，而不是手写样板。
3. 若本轮改动了用户可见布局/棋子外观，还必须补真实页面截图验收。

### 禁止收口的典型信号

- `core` 里已有正式兵力/控制区，但地图上显示仍靠手写 `mapTokens: [...]`。
- 同一对象同时存在“规则层名字”和“显示层假 id”，却没有稳定映射或派生函数。
- 领域测试全绿，但一打开真实 Board，开局棋子数量、位置、形状或归属仍和 setup 不一致。

## 前置 1.2.2：规则驱动对象粒度与架构职责裁定（强制）

只要新游戏规则中的对象不是“纯数量资源”，而是以**单卡、单棋子、单木块、单 token、单 marker、单建筑、单骰子、单槽位实体**承载独立规则状态，本条立即生效。

### 真实问题

- 常见工程性跑偏不是“数据没录完”，而是：
  - 规则里的物理对象本身有独立状态、独立命运、独立朝向/等级/附着/控制权；
  - 领域层却先偷懒压成 `count + level`、`summary + quantity`、`stack + value` 之类聚合占位；
  - 再由显示层反向拆出假棋子、假 token、假 marker 来“看起来像对的”。
- 这类结构短期能出画面，长期几乎一定演化成技术债：真相层和显示层双向补洞，后续一碰到承伤、翻面、降级、脱离、附着、单体转移、独立禁用、局部 buff/debuff 就会失真。

### 先裁定职责，再决定是不是“数据驱动”

1. **领域建模职责**
   - 以下问题优先属于领域建模 / 架构职责，不是单纯的数据录入：
     - 一个对象是否需要稳定身份 `id`
     - 一个对象的状态粒度是“单体”还是“栈/汇总”
     - 一个对象的拥有者、控制者、宿主、位置、朝向、等级、附着关系如何表达
     - 一个对象的状态变化是否会独立发生、独立结算、独立离场
   - 这些没裁定前，不得以“先录数据”“先让它显示出来”为理由跳过建模。
2. **数据驱动职责**
   - 只有在对象粒度和生命周期已经被正确建模后，才进入数据驱动职责：
     - 规则书里的静态事实、卡表、数值、标签、目标规则、图片引用、初始配置
   - 数据驱动负责“把既定结构填满”，不负责替代“结构本身该长什么样”的决策。

### 强制裁定规则

1. **先判断对象是否可替换（fungible）**
   - 只有纯数量资源才允许用 `count/value` 聚合表达，例如金币、粮草、VP、总牌数、行动点、一般资源池。
   - 只要对象存在以下任一特征，就必须按**单对象**建模，而不是先压栈：
     - 会单独承伤、降级、翻面、旋转、耗尽、破坏、回手、附着、转控、移除
     - 同名对象之间状态可能不一致
     - 同区域/同宿主下的多个对象可能只移动其中一部分
     - UI 上需要稳定定位、稳定选择、稳定 hover、稳定动画、稳定截图核对
2. **物理配件优先按规则对象建模**
   - 木块、棋子、人物、卡牌、装备、建筑、token、marker、槽位占用物，只要规则把它们当作“一个个独立对象”使用，就必须保持同粒度建模。
   - 不能因为当前 MVP 暂时只显示总数，就先把领域模型降成汇总值；显示可以降级，真相层不能降级错粒度。
3. **显示派生不得反向创造真相**
   - `mapTokens / renderedPieces / boardMarkers / overlays` 这类结构只能从正式领域对象派生。
   - 禁止先在领域里存汇总栈，再在显示层人为复制出多个“假单体”来冒充正式对象。
4. **聚合栈只允许作为派生视图，不允许替代正式对象**
   - 如果规则/UI 确实需要“按栈展示”，允许额外派生 `stackSummary`、`groupedPieces`、`regionOccupancySummary`。
   - 但这些只能是读模型/显示模型，不能反过来成为 command/reduce 的主真相。

### 新游戏软件工程流程口径（最低要求）

进入实现前，至少按下列顺序收口一次，不得把中间步骤吞掉：

1. 规则真相源裁定
2. OpenSpec / change 边界裁定
3. 领域术语与对象粒度建模
4. 生命周期 / 控制权 / 宿主 / 位置 / 朝向 / 等级状态裁定
5. 数据结构设计自检
6. 数据录入
7. setup 真相与显示派生贯通
8. 真实页面截图与定向测试验收

### 禁止行为

- 禁止把“可独立变化的物理对象”先压成 `count`，再由 UI 拆假对象。
- 禁止把对象身份、位置、朝向、等级、控制权等规则真相只保存在显示层。
- 禁止在还没完成对象粒度裁定前，就开始写 `Board.tsx`、`mapTokens`、`renderedPieces` 一类显示派生。
- 禁止把“当前先够用”当成对象建模降级理由，尤其是地图/棋盘/战棋/区域控制/卡牌附着类游戏。

### 最低交付证据

在进入正式录数据或开始实现 Board 前，至少补齐以下证据：

1. 一份对象粒度裁定清单：哪些是单对象、哪些是可聚合资源、理由分别是什么。
2. 一份领域状态映射：单对象真相层落在哪些字段，显示派生层怎么从它派生。
3. 一条定向测试或文档证据，证明“显示对象不反向承担领域真相”。

## 前置 1.3：规则配件表白名单与正式资源准入（强制）

当规则书、PDF、素材包、Workshop/TTS 导出目录或用户素材目录中存在“配件表 / 组件表 / 素材清单 / 起始设置表 / 牌表”时，AI 必须先把它整理成正式资源准入白名单，再移动、压缩、上传任何运行时图片。

### 默认动作

1. **先抽取规则配件表**
   - 从规则书或用户指定真相源中抽取组件清单，至少记录对象类别、阵营/归属、数量、是否运行时可见、规则出处。
   - 若规则书没有显式配件表，必须用规则文本和素材图面建立“临时准入表”，并标注为待复核；不得因为来源目录里有文件就默认全部接入。
2. **给每个源文件做准入裁决**
   - `runtime`：规则/MVP 运行态需要，默认进入 `public/assets/i18n/<locale>/<gameId>/`。
   - `reference`：只作为规则、帮助、剧本或人工核对资料，允许进入明确的 `aids/` 或留在 `rule/` / `evidence/`，但不得被当成运行时对象。
   - `candidate`：可能有用但规则依据不足，只能登记到 `temp/<gameId>-intake/` 或清单里，禁止进正式运行时目录。
   - `excluded`：TTS/Workshop 材质色块、编辑器占位图、无规则对象对应的贴图、重复导出、下载站装饰图等，必须写排除原因，禁止压缩、上传和引用。
   - 若源文件本身是**大拼版图、扫描页、整页说明卡、整版房间板块、整版楼层板或多对象 atlas 原图**，默认只能先判为 `candidate` 或 `reference`；只有裁成“代码会直接引用的单对象运行时资源”后，才允许升格为 `runtime`。
   - 若素材盘点中出现成组的小图、头像、棋子图、怪物圆片、人物立绘裁片、状态 token 或 `384x336 / 450x450` 这类高频 token 尺寸组，必须把该尺寸组单独做一轮视觉联系表审查；不能只把大角色板、怪物卡、牌背列进白名单后，把这些小图笼统写成“尚未确认”。
   - 只要规则或剧本里出现 `figure / pawn / standee / monster token / hero token / small monster token / stunned token / 状态 token` 等进入地图、棋盘、角色板或怪物卡的承载物，对应头像/token 小图默认进入 `runtime` 候选审查；若不接入，必须逐类写明规则不需要、MVP 不需要或素材无法对应的原因。
   - 玩家在地图上的位置、怪物在房间里的位置、状态 token 在角色板/怪物卡上的位置，属于运行时主体验承载；不得只接入角色整板/怪物整卡，然后在 UI 里用文字缩写、无关 marker 或临时圆点代替这些头像/token。
   - 如果规则或当前 UI 明确需要某类正式素材承载，而盘点后仍缺对应正面图、token 图、atlas frame 或同语义对象图，默认动作不是“先拿别的素材顶上”，而是**立即向用户询问素材位置或是否还有未 intake 目录**；未问清前，不得把猜测性的替代图接进正式运行时。
3. **正式目录只接收白名单资源**
   - 进入 `public/assets/i18n/<locale>/<gameId>` 的文件，必须在准入表中有 `runtime` 或明确的 `reference` 状态。
   - 新游戏不得默认把正式图片放入顶层 `public/assets/<gameId>`；确需使用历史兼容落点时，必须先说明 `asset-pipeline` 依据和运行时加载链路。
   - 不能用“以免漏资产”“以后可能用到”“目录里有”作为正式接入理由。
   - 若需要保留原始包的完整快照，只能放在用户原目录、`temp/<gameId>-intake/raw/` 或外部资料目录，不能混入正式运行时资源树。
4. **命名必须有证据链**
   - 正式文件名必须是稳定语义名：小写 kebab-case，按 `阵营/类别/对象/序号或批次` 组合，例如 `ming-card-back`、`jin-regular-infantry`、`chronology-cards-atlas`。
   - 图面无法读清、规则表无法对应、同名对象无法区分时，不得硬塞进正式目录；先标为 `candidate`，等 OCR/人工核对后再命名。
   - 允许临时序号只用于 `temp/` 或清单；正式资源不得长期使用下载哈希、扫描流水号、`image-01`、`unknown-*`、`misc-*` 这类无法回溯语义的名字。
5. **上传前复核**
   - 运行 `assets:manifest`、`assets:check`、`assets:upload` 之前，必须先确认正式目录没有 `candidate/excluded` 文件。
   - 如果发现已经把排除项放进正式目录，本轮不能继续按“资源闭环已完成”收口；必须先说明对象、依据和最小补救方案，并按删除/降级规则取得用户确认后再处理。

### 准入表最低字段

`sourceFile | sourceSize | dimensionGroup | visualLabel | ruleRef | requiredComponent | carrierRole | intakeStatus | targetPath | canonicalName | decisionReason | reviewerNotes`

其中 `intakeStatus` 只能是 `runtime`、`reference`、`candidate`、`excluded`。缺少 `ruleRef` 或 `decisionReason` 的文件，默认不能进入正式运行时目录。
`carrierRole` 用来记录该素材的现实承载角色，例如 `card-front`、`card-back`、`character-board`、`figure-avatar`、`monster-token`、`status-token`、`room-tile`、`reference-card`；如果无法判断，必须先留在 `candidate`。

## 前置 1.4：规则 PDF 转 Markdown 与可行性评估（强制前置）

当用户提供的是“规则 PDF + 图片素材目录”，或明确要求先判断新游戏是否可做时，先完成本阶段，**不要直接进入游戏骨架实现**。

### 默认动作

1. **规则转档**
   - 优先使用项目脚本：`npm run pdf:md -- "<输入PDF>" -o "src/games/<gameId>/rule/<游戏名>规则.md"`。
   - 若 PDF 无原生文字，先说明当前脚本无法直接提取，再选择 OCR/截图转写方案；OCR 中间图必须放 `temp/<gameId>-intake/`。
   - Markdown 顶部必须写明来源路径、转换日期、转换方式和质量说明；不得在转写时改写规则语义。
2. **素材盘点**
   - 生成 `temp/<gameId>-intake/image-inventory.tsv` 或等价清单，至少包含原文件名、尺寸、类型、疑似用途。
   - 先按 `前置 1.3` 生成正式资源准入白名单；只有 `runtime` 或明确 `reference` 的图片，才允许按本 skill 的资源目录与语义命名落正式目录。
   - 不能可靠识别、不能对应规则配件表或当前 MVP 不需要的图片，只登记为 `candidate` / `excluded`，不强行命名，不移动到正式资源树。
   - 若当前图片是房间拼版、楼层拼版、扫描页或多对象整版，必须先写“单对象裁切合同”；在未裁到单对象前，不得把该整版图片直接宣称为“正式素材已齐”。
   - 若盘点摘要发现某个尺寸组数量异常高，或肉眼可见包含头像/token/怪物圆片/状态圆片，必须生成并打开该尺寸组的联系表或分块图；准入表里要逐类记录哪些进入 `runtime`，哪些降为 `candidate/excluded`，不得只写“主要是小图，待确认”。
3. **资源闭环**
   - 正式图片落盘后运行最小必要压缩命令。
   - 压缩前再次确认正式目录没有 `candidate/excluded` 文件。
   - 运行 `npm run assets:manifest` 与 `npm run assets:validate`。
   - 若本轮新增运行时资源，执行 `npm run assets:check`；发现远端缺失时继续 `npm run assets:upload`，并抽查代表性远端 URL 返回 200。
4. **可行性分析**
   - 在 `evidence/<gameId>/<gameId>-feasibility-<date>.md` 写结论，至少覆盖：核心机制、引擎原语映射、状态模型难点、UI/资源难点、MVP 切分、主要风险与建议阶段。
   - 结论必须区分“可做”与“建议怎么做”：复杂游戏默认先给 MVP 边界，不承诺一次性全规则自动化。

### 验收

- `rule/<游戏名>规则.md` 存在且可读。
- 素材准入表能回溯原始文件、规则配件表依据、准入状态与正式目标路径。
- 正式资源目录中不存在 `candidate/excluded` 文件。
- 正式资源已有 `compressed/*.webp` 或明确说明为何不能压缩。
- 资源 manifest 已重建并校验通过。
- 可行性分析已落到 `evidence/<gameId>/`，并能指导后续是否开分支建骨架。

## 前置 1.5：图片 / 位置驱动的快速 intake（可直接启动）

当用户还没把完整规则讲完，但已经给了**图片路径、裁片位置、行列数、顺序说明或对象定位**时，可以直接启动资源 intake。不要要求“先把所有规则补齐再开始”。

### 允许直接开工的最小输入

1. `gameId`
2. 原图路径或图片文件列表
3. 每张图的素材类别（缩略图 / 卡牌 atlas / 基地 atlas / 角色板 / 棋盘 / 通用插图）
4. 位置口径（行列数、row-major 顺序、裁图坐标、对象列表之一即可）
5. 当前主真相源与是否需要对照源

### AI 默认动作

1. 先写素材录入契约：真相源表、规则配件表白名单、切图表、核对合同表、对照表、冲突待裁定表。
2. 先读图识别对象，再判断现有文件名是否明显随机/无语义：
   - 若是随机名、默认导出名、批量下载残留名，则按**图片内容语义**自动重命名并移动到正式目录。
   - 若现有文件名看起来是用户有意命名的语义名，则默认不改名，只询问是否需要统一为项目规范命名。
3. 移动正式资源前必须完成 `runtime/reference/candidate/excluded` 裁决；`candidate/excluded` 不得进入 `public/assets/` 正式树。
4. 若素材是大拼版或扫描页，先裁成单对象运行时资源，再落正式目录；不得把整版图片直接丢进 `public/assets/i18n/zh-CN/<gameId>/` 冒充接入完成。
5. 原图落盘后立即运行 `npm run compress:images -- public/assets/i18n/zh-CN/<gameId>` 或最小必要子目录。
6. 若用户给的是“位置/顺序”，则直接建立索引映射和命名合同，不等待后续手工整理。
7. 若默认运行态依赖远端资源，数据录入或图片 intake 完成后必须跑 `npm run assets:check`；只要本轮新增/变更了运行时资源且远端有缺口，就必须继续执行上传闭环，直到远端对象可访问，不能停留在“本地已落盘”。

### 默认目录与命名约定

| 素材类型 | 默认命名 | 默认目录 |
|---------|---------|---------|
| 缩略图 | `cover.png` | `public/assets/i18n/zh-CN/<gameId>/thumbnails/` |
| 卡牌 atlas | `<batch>.png` | `public/assets/i18n/zh-CN/<gameId>/cards/` |
| 基地 atlas | `<batch>_base.png` | `public/assets/i18n/zh-CN/<gameId>/base/` |
| 角色/英雄面板 | `<entityId>-board.png` | `public/assets/i18n/zh-CN/<gameId>/hero/` |
| 棋盘/地图/公共插图 | 按语义命名 | `public/assets/i18n/zh-CN/<gameId>/board/` 或 `common/` |
| 图集配置 | `<name>.atlas.json` | `public/assets/atlas-configs/<gameId>/` |

若用户没有给命名方案，AI 默认采用上述语义命名；若用户已给命名规则，以用户规则为准。

### 命名依据（强制）

1. **正式命名依据 = 图片内容语义 + 真相源合同**
   - 能从图片中直接读到对象名称、类别、批次、角色身份时，必须以这些内容作为正式命名依据。
2. **原文件名只当输入，不当正式命名依据**
   - 像 `IMG_1234.png`、`新建文件夹 (2).png`、`scan0007.png`、`image(1).png` 这类随机名/默认名不能直接沿用为长期正式命名。
   - 若文件名本身已经是明显语义化的用户命名，则默认保留，不自动替换。
3. **按层级决定命名粒度**
   - 整体缩略图按用途命名，如 `cover`
   - atlas 按批次/对象集合命名，如 `<batch>`、`<batch>_base`
   - 单张裁片按对象命名，如卡名、基地名、角色名或稳定 `defId`
4. **图面名与 canonical 名冲突时必须分离**
   - 若图面显示名和正式对象名不一致，必须在合同里显式记录“显示名”和“正式命名/defId”的裁决，不能暗改。
5. **看不清就停**
   - 图片内容不足以支持可靠命名时，不得硬命名；应标记待确认并拉入对照源比对。
6. **只有明显随机名才默认自动改**
   - “明显随机名”指随机字符串、设备默认导出名、截图默认名、扫描仪流水号、下载站无语义序号等。
   - 只要文件名存在明确语义且看起来是用户主动命名，就应先询问，不要默认替换。

---

## 阶段 1：目录骨架与 Manifest 落地

**目标**：建立完整目录结构与最小占位实现，`npm run generate:manifests` 可成功运行。

### 1.1 创建目录结构

> **默认拆分**：中等以上复杂度游戏（命令数 ≥5 或有多阶段回合）从第一天就用拆分结构。

```
src/games/<gameId>/
  manifest.ts          # 清单元数据
  game.ts              # 引擎适配器组装（只做组装，不写逻辑）
  Board.tsx            # UI 布局组装（逻辑拆到 hooks/，子组件拆到 ui/）
  thumbnail.tsx        # 缩略图组件
  tutorial.ts          # 教学配置（占位）
  audio.config.ts      # 音频配置（占位）
  criticalImageResolver.ts  # 关键图片预加载（若有精灵图）
  domain/
    index.ts           # 领域内核入口
    types.ts           # re-export barrel（导出 core-types + commands + events）
    core-types.ts      # 状态接口（PlayerState, GameCore, 基础类型）
    commands.ts        # 命令类型 + XX_COMMANDS 常量
    events.ts          # 事件类型 + XX_EVENTS 常量
    ids.ts             # 领域 ID 常量表
    utils.ts           # 游戏内共享工具（从第一天就建立）
  rule/
    <游戏名>规则.md     # 规则文档占位
  hooks/               # 游戏业务 hooks
  ui/                  # 游戏 UI 子组件
  __tests__/
    smoke.test.ts      # 冒烟测试占位
```

### 1.2 manifest.ts（参考真实游戏）

```ts
import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: '<gameId>',
    type: 'game',
    enabled: true,
    titleKey: 'games.<gameId>.title',
    descriptionKey: 'games.<gameId>.description',
    category: 'strategy',         // strategy | casual | party | abstract
    playersKey: 'games.<gameId>.players',
    icon: '🎮',
    thumbnailPath: '<gameId>/thumbnails/cover',
    allowLocalMode: false,        // 默认仅联机
    playerOptions: [2],           // 可选 [2,3,4]
    tags: [],                     // dice_driven | card_driven | tactical 等
    bestPlayers: [2],
};

export const <GAME_ID>_MANIFEST: GameManifestEntry = entry;
export default entry;
```

### 1.3 domain 类型文件（默认拆分结构）

**core-types.ts** — 状态接口：
```ts
import type { PlayerId } from '../../../engine/types';
export type GamePhase = 'factionSelect' | 'startTurn' | 'playCards' | ...;
export const PHASE_ORDER: GamePhase[] = [...];
export interface PlayerState { id: PlayerId; /* ... */ }
export interface <GameId>Core {
    players: Record<PlayerId, PlayerState>;
    turnNumber: number;
    gameResult?: { winner?: string; draw?: boolean };
}
```

**commands.ts** — 命令类型：
```ts
import type { Command } from '../../../engine/types';
export const XX_COMMANDS = { DO_SOMETHING: 'DO_SOMETHING', ... } as const;
export interface DoSomethingCommand extends Command<'DO_SOMETHING'> { payload: { ... }; }
export type <GameId>Command = DoSomethingCommand | ...;
```

**events.ts** — 事件类型：
```ts
import type { GameEvent } from '../../../engine/types';
export const XX_EVENTS = { SOMETHING_DONE: 'SOMETHING_DONE', ... } as const;
export interface SomethingDoneEvent extends GameEvent<'SOMETHING_DONE'> { payload: { ... }; }
export type <GameId>Event = SomethingDoneEvent | ...;
```

**types.ts** — re-export barrel：
```ts
export * from './core-types';
export * from './commands';
export * from './events';
```

### 1.4 domain/ids.ts（领域 ID 常量表）

所有稳定 ID 必须在此定义，禁止字符串字面量。

### 1.5 domain/index.ts（领域内核占位）

```ts
import type { DomainCore, PlayerId, RandomFn, GameOverResult } from '../../../engine/types';
import type { <GameId>Core } from './types';

export const <GameId>Domain: DomainCore<<GameId>Core> = {
    gameId: '<gameId>',
    setup: (playerIds: PlayerId[], random: RandomFn): <GameId>Core => ({
        // 最小初始状态
        players: Object.fromEntries(playerIds.map(pid => [pid, createPlayerState(pid)])),
        turnNumber: 1,
        // ...其他必要字段
    }),
    validate: (state, command) => ({ valid: true }),  // 占位
    execute: (state, command, random) => [],            // 占位
    reduce: (core, event) => core,                     // 占位
    isGameOver: (core) => core.gameResult,
};
```

### 1.6 game.ts（引擎适配器占位）

```ts
import { createGameEngine, createBaseSystems, createFlowSystem } from '../../engine';
import { <GameId>Domain } from './domain';
import type { <GameId>Core } from './domain/types';

// FlowHooks 占位（阶段 4 实现）
const flowHooks = {
    initialPhase: '<firstPhase>',
    getNextPhase: () => '<firstPhase>',
    getActivePlayerId: ({ state }) => Object.keys(state.core.players)[0],
};

const systems = [
    createFlowSystem<<GameId>Core>({ hooks: flowHooks }),
    ...createBaseSystems<<GameId>Core>(),
];

export const <GameId> = createGameEngine<<GameId>Core>({
    domain: <GameId>Domain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [],  // 阶段 4 填充
});

export default <GameId>;
```

### 1.7 Board.tsx（最小占位）

```tsx
import React from 'react';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { <GameId>Core } from './domain/types';

type Props = GameBoardProps<<GameId>Core>;

const <GameId>Board: React.FC<Props> = ({ G, playerID }) => {
    return <div className="p-4 text-white">
        <h1>{'<gameId> - 骨架占位'}</h1>
        <p>当前玩家：{playerID ?? 'observer'}</p>
        <pre>{JSON.stringify(G.core, null, 2)}</pre>
    </div>;
};

export default <GameId>Board;
```

### 1.8 其他占位文件

- **thumbnail.tsx**：使用 `ManifestGameThumbnail` 组件
- **tutorial.ts**：导出空 `TutorialManifest`（`{ id: '<gameId>-basic', steps: [] }`）
- **audio.config.ts**：导出空 `GameAudioConfig`
- **__tests__/smoke.test.ts**：验证 domain.setup 不报错

### 1.9 资源目录

```
public/assets/i18n/zh-CN/<gameId>/
  thumbnails/.gitkeep
  board/.gitkeep
  cards/.gitkeep
```

### 1.10 i18n 文件

创建 `public/locales/zh-CN/game-<gameId>.json` 和 `public/locales/en/game-<gameId>.json`，包含 title/description/players。

### 验收

```bash
npm run generate:manifests    # 成功生成清单
npx vitest run src/games/<gameId>  # 冒烟测试通过
npm run dev                   # 编译无报错（游戏可在大厅列表看到）
```

---

## 阶段 1.5：机制分解与数据结构设计（强制前置）

**目标**：在录入数据前，先将游戏机制分解为引擎原语组合，设计面向百游戏的通用数据结构，避免后期重构。

### 1.5.1 机制分解与引擎原语映射（强制）

> **核心原则：面向百游戏设计，不依赖现有游戏的具体实现。**

将新游戏的核心机制分解为引擎原语的组合：

| 机制类别 | 游戏中的表现 | 引擎原语映射 | 是否需要扩展 |
|---------|------------|------------|------------|
| **随机性** | 骰子/抽牌/洗牌 | `dice.ts` / `zones.ts` | ? |
| **资源管理** | 魔力/行动点/金币 | `resources.ts` | ? |
| **状态效果** | buff/debuff/标记 | `tags.ts` (层数/持续时间/层级匹配) | ? |
| **数值修改** | 攻击力加成/伤害减免 | `modifier.ts` (flat/percent/priority) | ? |
| **动态属性** | 可被 buff 修改的属性 | `attribute.ts` (base + modifiers) | ? |
| **能力系统** | 技能/被动/光环 | `ability.ts` (注册/查找/执行器) | ? |
| **目标选择** | 选择敌人/友军/格子 | `target.ts` | ? |
| **条件判断** | 触发条件/激活条件 | `condition.ts` + `expression.ts` | ? |
| **效果执行** | 伤害/治疗/移动/抽牌 | `effects.ts` | ? |
| **空间关系** | 棋盘/网格/区域 | `zones.ts` (grid/stack/hand) | ? |
| **伤害计算** | 伤害修正/防御/护甲 | `damageCalculation.ts` | ? |

**输出产物**：
1. **引擎原语组合方案**：列出需要使用的 primitives 及其组合方式
2. **缺口清单**：列出现有 primitives 无法覆盖的机制（需新增或扩展）
3. **复用策略**：哪些机制可以直接用现有 primitives，哪些需要游戏层封装

### 1.5.2 数据结构设计（强制）

> **核心原则：数据结构必须支持未来扩展，面向百游戏设计，禁止"先录入再重构"。**

在录入具体数据前，先设计通用数据结构：

#### 对象生命周期与延迟交互前置审查（强制）

只要新游戏里存在以下任一机制，就必须在正式录数据前先回答清楚，再决定 core/event/interaction 结构：

1. 对象会跨区移动：手牌、牌库、弃牌、场上、附着区、宿主区、移出游戏区之间转换
2. 对象会临时换控制者、换持有者、换宿主，或“当前使用者”和“真实拥有者”分离
3. 某条交互会跨阶段、跨清场、跨宿主变化后继续结算
4. UI 想根据 payload 里有没有 `defId` / `targetType` / 类似字段来猜展示模式

最低输出必须包含：

- `session context`：当前谁有权决策，统一从底层 seam 读取，不在业务层手猜
- `object ref / provenance`：对象稳定身份、真实归属、当前控制/持有/宿主、默认终点分别怎么表达
- `deferred snapshot`：哪些事实在交互创建时冻结，哪些字段允许解决时再查 live state
- `interaction descriptor`：展示模式由什么显式描述，避免 UI 从业务 payload 猜语义

禁止做法：

- 只传一串 `fromPlayerId / toPlayerId / ownerId / cardId` 散字段，希望 reducer 自己猜真实语义
- 把“当前控制者/当前宿主/当前持有者”直接当成真实拥有者或默认终点
- 交互创建时不快照，等 resolve 时再去 live state 碰运气找对象
- 让 UI 通过 payload 形状猜“这是按钮模式、卡牌模式还是基地模式”

#### 新游戏架构审查清单（强制）

> **核心原则：先做架构裁定，再做数据录入与实现。**
> 这份清单服务于“防工程错误”，不是可选的讨论题。

只要准备进入 `domain/types.ts`、`config/data`、`setup`、`Board.tsx`、`game.ts` 或任何会固化结构的实现文件，必须先完成这份清单；未完成时只能继续建模，不能落实现。

##### A. 规则对象与工程对象一一映射

对规则中每一类主要对象，必须明确回答：

1. 规则对象名是什么
2. 工程中的正式对象类型是什么
3. 是**单对象**还是**可聚合资源**
4. 稳定身份 `id` 落在哪一层
5. 它的主状态由谁持有：`core` / `sys` / 派生读模型 / 纯 UI

最低要求：

- 单卡、单棋子、单木块、单 token、单 marker、单槽位占用物，默认先按**单对象**审查。
- 若要判定为“可聚合资源”，必须写明为什么它在规则中是可替换的（fungible），且不会出现单体差异状态。

##### B. 状态粒度裁定

对每类对象，逐项判断以下状态是“对象级”还是“汇总级”：

- 位置
- 朝向 / 旋转 / 翻面
- 等级 / 士气 / 耐久 / 剩余次数
- 控制者 / 拥有者 / 持有者 / 宿主
- 附着关系 / 装备关系 / 承载关系
- 冷却 / 禁用 / 已行动 / 已受击等局部状态

只要其中任一状态可能在同类对象之间不一致，就不得用 `count + sharedFields` 代替单对象。

##### C. 真相层与派生层分离

必须显式列出以下分层：

1. **正式真相层**
   - 哪些字段会被 command / validate / execute / reduce 直接读取
2. **系统层**
   - 哪些是交互、流程、会话、自动推进、待选择状态
3. **派生读模型**
   - 哪些是为了地图、棋盘、列表、面板展示而派生出的结构
4. **纯 UI 状态**
   - 哪些只影响 hover、展开、tab、动画、不参与规则判定

禁止出现：

- `Board` 或显示 helper 持有规则真相
- `mapTokens / renderedPieces / overlays` 反向承担领域状态
- `core` 为了迁就 UI 先存一份错误粒度的汇总结构

##### D. 单一真相与写入路径

每个正式对象至少写清：

1. 创建入口
2. 更新入口
3. 删除/离场入口
4. setup 初始落点
5. 显示派生入口

如果同一个对象需要在两个以上位置手工同步，说明结构设计还没收口，禁止继续录数据。

##### E. 未来变化压力测试

对每个关键对象，至少反问以下场景是否仍成立：

1. 如果其中一个对象单独降级/受伤/翻面，当前结构是否能只改它自己
2. 如果只移动一部分对象，当前结构是否能稳定选中并搬运子集
3. 如果对象换控制者但不换拥有者，当前结构是否不需要复制假对象
4. 如果 UI 需要给单对象做 hover/动画/截图核对，当前结构是否有稳定 `id`
5. 如果后续规则新增一个“只影响其中一枚”的效果，当前结构是否不用推翻重做

有任一题答案是否定的，不能进入数据录入。

##### F. 审查产物（必须落地）

在开始正式录数据前，至少留下以下产物之一，且必须可回溯：

1. `evidence/<gameId>/<gameId>-architecture-review-<date>.md`
2. OpenSpec `design.md` 中的专门小节
3. `design-system/games/<gameId>.md` 中单列“对象模型与架构边界”章节

默认优先使用模板：

- `./references/architecture-review-template.md`
- 若没有正当理由，不得只在对话里口头描述“已经审过对象模型”，而不落成上述正式产物。

产物最少包含：

- 规则对象 → 工程对象映射表
- 单对象 / 可聚合资源裁定表
- 真相层 / 派生层 / UI 层分层表
- 已知风险与暂不实现边界

##### G. 阶段门禁

在这份清单完成前：

- 不得宣称“新游戏骨架已合理”
- 不得进入大批量数据录入
- 不得把探索性显示对象写成正式领域真相
- 不得把“先跑起来再说”当默认路径

#### 实体类型分析

列出游戏中的所有实体类型（如卡牌/单位/骰子/资源/状态），对每种实体类型回答：

1. **领域语义**：该实体在游戏规则中的核心作用（如"单位=可移动可攻击的棋子"）
2. **共性字段**：所有该类实体都有的字段（如 id/name/cost）
3. **变体字段**：部分实体有的字段（如 attack/defense/range）
4. **扩展性需求**：未来可能新增的字段（如 rarity/tags/keywords）
5. **引用关系**：该实体引用哪些其他实体（如卡牌引用技能）
6. **引擎原语映射**：该实体的哪些属性应该用引擎原语表达（如 hp 用 `resources.ts`，buff 用 `tags.ts`）

#### 数据结构设计模板

```ts
// ❌ 错误示例：字段不完整，未来需要重构
interface Card {
    id: string;
    name: string;
    cost: number;
}

// ✅ 正确示例：考虑扩展性，字段完整，面向百游戏
interface Card {
    id: string;
    name: string;
    type: 'action' | 'unit' | 'event';  // 类型区分（必须）
    cost: number;  // 费用（若游戏有资源系统）
    
    // 可选字段（根据游戏机制决定）
    rarity?: 'common' | 'rare' | 'epic';  // 稀有度
    tags?: string[];  // 标签（如 'magic' | 'melee'）
    abilities?: string[];  // 技能 ID 引用（不嵌套对象）
    effects?: Effect[];  // 效果定义（结构化）
    
    // 触发条件（若有）
    trigger?: {
        phase?: GamePhase;  // 触发阶段
        event?: string;  // 触发事件
        condition?: Condition;  // 触发条件
    };
    
    // 使用限制（若有）
    usageLimit?: {
        perTurn?: number;  // 每回合次数
        perGame?: number;  // 每局次数
        cooldown?: number;  // 冷却回合
    };
    
    // 目标选择（若有）
    targeting?: {
        type: 'self' | 'opponent' | 'any_unit' | 'any_cell';
        filter?: Condition;  // 目标过滤条件
        count?: number | 'all';  // 目标数量
    };
}
```

#### 数据驱动反模式清单（强制）

在设计数据结构时，必须避免以下反模式：

| 反模式 | 错误示例 | 正确做法 | 为什么错误 |
|--------|---------|---------|-----------|
| **硬编码技能逻辑** | `validate()` 中 `switch (abilityId)` 每个技能一个 case | 技能定义包含 `validation` 配置，使用通用验证函数 | 第 100 个游戏会有 10000 行 switch |
| **UI 状态混入 core** | `core.lastPlayedCard`（纯展示） | 通过 EventStream 传递给 UI | core 应该只包含规则判定需要的数据 |
| **交互状态混入 core** | `core.pendingAttack`（等待输入） | 使用 `sys.interaction` | 交互状态是系统层职责，不是领域层 |
| **缺少目标字段** | `grantStatus: { statusId, value }` + 执行层猜测目标 | `grantStatus: { statusId, value, target: 'opponent' }` | 数据不完整导致执行层需要"猜测" |
| **缺少触发条件** | 技能只有效果描述，触发条件在代码里硬编码 | 技能定义包含 `trigger: { phase, event }` | 触发逻辑应该数据驱动，不是代码驱动 |
| **缺少使用限制** | 技能只有费用，没有"每回合一次"等限制 | 技能定义包含 `usageLimit: { perTurn: 1 }` | 限制规则应该在数据中声明 |
| **对象嵌套引用** | `card.abilities: Ability[]`（嵌套对象） | `card.abilities: string[]`（ID 引用） | 嵌套导致数据冗余和更新不一致 |
| **散落的状态字段** | `unit.stunned`, `unit.poisoned`, `unit.buffed` | `unit.tags: TagContainer` | 第 100 个游戏会有 100 种状态字段 |
| **ad-hoc 修正字段** | `unit.attackBonus`, `unit.defenseBonus` | `unit.attack: Attribute` (base + modifiers) | 修正逻辑应该用 modifier 系统 |

#### 数据完整性自检清单（强制）

设计完数据结构后，逐项检查：

- [ ] 所有实体类型都有唯一 ID 字段（`id: string`）
- [ ] 所有实体类型都有类型区分字段（`type: 'xxx'`）
- [ ] 所有引用关系都是 ID 引用，不是对象嵌套
- [ ] 所有"可能被 buff 修改"的数值都映射到 `Attribute` 或 `resources.ts`
- [ ] 所有"需要玩家选择"的操作都有目标选择规则（`targeting` 字段）
- [ ] 所有"有使用限制"的能力都有限制字段（`usageLimit`）
- [ ] 所有"有触发条件"的效果都有触发规则（`trigger` 字段）
- [ ] 所有状态效果都映射到 `TagContainer`，不是散落的布尔字段
- [ ] 所有数值修改都映射到 `modifier.ts`，不是 ad-hoc 的 `xxxBonus` 字段

### 1.5.3 引擎能力缺口分析（强制）

对照 `src/engine/primitives/` 和 `src/engine/systems/`，列出：

1. **可直接复用**：已有的 primitives/systems 可以直接使用
2. **需要扩展**：已有的 primitives/systems 需要增加新功能
3. **需要新增**：完全没有的能力，需要新建 primitive/system

**输出产物**：
- 引擎能力缺口清单（Markdown 表格）
- 每个缺口的优先级（P0 阻塞 / P1 重要 / P2 可延后）
- 每个缺口的预计实现阶段（阶段 3 / 阶段 4 / 阶段 6）

### 1.5.4 面向百游戏的设计检查（强制）

> **核心问题：如果未来有 100 个游戏，这个设计会不会导致代码爆炸？**

对每个设计决策，问自己：

1. **如果有 100 个游戏，每个游戏都这样做，会发生什么？**
   - ❌ 每个游戏在 `validate()` 中加 100 行 switch → 10000 行 switch
   - ✅ 每个游戏在数据中声明验证规则 → 数据驱动，代码不增长

2. **这个字段/逻辑是游戏特有的，还是可以抽象为通用能力？**
   - ❌ `core.diceThroneSpecificField` → 只有一个游戏用
   - ✅ `core.resources: ResourceContainer` → 所有游戏都能用

3. **这个实现是否依赖"已有游戏的具体实现"？**
   - ❌ "参考 DiceThrone 的 `CombatAbilityManager`" → 耦合具体游戏
   - ✅ "使用 `engine/primitives/ability.ts`" → 依赖通用抽象

4. **如果规则变化，需要改多少地方？**
   - ❌ 改技能触发条件需要改 validate/execute/UI 三处 → 散落逻辑
   - ✅ 只改技能定义的 `trigger` 字段 → 单一数据源

### 验收

- 机制分解表已完成，引擎原语映射明确
- 数据结构设计已完成，通过完整性自检清单
- 引擎能力缺口清单已输出，优先级明确
- 面向百游戏的设计检查已通过（无"代码爆炸"风险）
- 用户确认数据结构设计合理，可以开始录入

---

## 阶段 2：数据录入（规则文档 + 游戏数据 + 类型定义）

**目标**：完成规则文档录入、静态游戏数据录入、核心类型定义，不写业务逻辑。需要新增引擎原语的部分可标记延后。

### 2.0 数据缺失处理规范（强制）

> **核心原则：不猜测、不编造、不跳过。缺什么问什么，问清楚再录。**

1. **规则文档不完整或有歧义时**：
   - 列出具体缺失/歧义项（如"火球术的伤害是3还是3+骰子数？规则书第X页描述模糊"）
   - 回问用户确认，不自行推断
   - 若用户暂时无法确认，标记 `// TODO: 待确认 — <具体问题>`，不填默认值

2. **数据量大、用户只提供了部分时**：
   - 先录入已有数据，每批录入后输出 Markdown 核对表（实体名/关键属性/数量）
   - 明确告知用户"已录入 X 条，还缺 Y 条"，列出缺失清单
   - 用户补充后继续录入，不等全部数据到齐才开始（已有数据先落地）

3. **素材数据核对（强制，遵循 AGENTS.md）**：
   - 根据图片/规则书提取数据时，必须全口径核对、逻辑序列化
   - 关键限定词显式核对（如"每回合一次"vs"每场一次"、"相邻"vs"同行"）
   - 输出 Markdown 表格作为核对契约，用户确认后才算录入完成

4. **需要新增引擎原语的数据**：
   - 若某些游戏机制在 `src/engine/primitives/` 中没有现成实现
   - 先在数据层标记 `// DEFERRED: 需新增引擎原语 <xxx>，暂用占位`
   - 记录到阶段验收的"延后清单"中，在阶段3或阶段4补充实现
   - 不因缺少原语而阻塞整个数据录入流程
5. **对照源主动确认（强制）**：
   - 如果用户同时给了 Wiki、官网、数据库或自整理网站，必须主动问“要不要把它作为对照源一起比？”。
   - 对照源只用于发现冲突和补足索引，不得默认覆盖主真相源。
   - 对照结果必须写进 Markdown 对照表，不允许只在对话里口头比较。

### 2.1 录入规则文档

将规则书/规则图片内容结构化录入 `src/games/<gameId>/rule/` 下的 Markdown 文件，拆解为：

1. **阶段流程**：回合结构、阶段顺序、阶段间切换条件
2. **核心实体**：卡牌/单位/骰子/资源的类型与属性
3. **操作类型**：玩家可执行的命令（如出牌/移动/攻击/弃牌）
4. **结算规则**：积分/伤害/胜利条件
5. **特殊机制**：如 faction 选择、deck building、技能触发

**规则文档质量要求**：
- 每条规则必须可追溯到规则书原文位置（页码/章节）
- 数值必须精确（"3点伤害"而非"一些伤害"）
- 条件触发必须完整（触发时机 + 触发条件 + 效果 + 持续时间）

### 2.2 录入游戏静态数据

根据规则文档，将所有实体数据录入代码。**不只是名称+描述，必须录入影响游戏机制的全部必要信息**。

#### "必要信息"判断原则（强制）

> 未来的游戏机制不可预知，不预设具体字段清单。用以下原则判断一条信息是否必须录入：

1. **规则判定依赖**：如果 `validate()` / `execute()` / `reduce()` / `isGameOver()` 需要读取该信息来做决策，则必须录入。
   - 例：攻击力、生命值、费用、射程、触发条件、效果数值、冷却回合、使用限制
2. **状态区分依赖**：如果该信息用于区分不同实体的行为差异，则必须录入。
   - 例：近战vs远程、一次性vs持续、主动vs被动、阵营归属
3. **UI 渲染依赖**：如果界面需要该信息来正确展示实体，则必须录入。
   - 例：精灵图索引/图集坐标、素材文件引用、牌背符号、中英文名称
4. **引用关系依赖**：如果该信息建立实体间的引用链（A拥有B、A触发B），则必须录入。
   - 例：技能ID列表、效果引用、目标选择规则
5. **数量/分布依赖**：如果该信息影响游戏的随机性或资源分配，则必须录入。
   - 例：牌组中的数量、骰面分布、初始资源

**反面判断——可以不录入的**：
- 纯风味文本（不影响任何规则判定的背景故事）
- 可从其他已录入数据推导出的冗余信息
- 仅在开发调试时使用、不进入生产的临时标记

#### 录入完整性自检（逐字段，强制）

> **核心问题：素材/规则书上的每一条信息，是否都已在代码中有对应字段？**
> AI 容易漏录"不好结构化"的信息（如图标表示的触发条件、符号表示的骰面组合）。必须逐项核对，不能只录"好录的"。

每录入一个实体类型，执行以下自检：

1. **素材全信息提取**：将素材（卡牌图片/规则书条目）上的所有可见信息逐条列出，包括：
   - 文字信息（名称、描述、数值）
   - 图标/符号信息（骰面图标、元素符号、阵营标记）→ 必须转化为结构化数据
   - 位置/布局隐含信息（卡牌分区暗示的阶段归属、颜色暗示的稀有度）
2. **逐条比对**：将提取的信息列表与已定义的 TypeScript 字段逐条比对，确认每条信息都有对应字段承接
3. **缺字段立即补**：发现素材上有信息但代码中无对应字段 → 补字段，不跳过
4. **引用完整性**：该实体引用的其他实体 ID 是否都已定义？（断链 → 补或标记 TODO）

**典型漏录场景（警示）**：
- ❌ 技能卡只录了名称+效果描述，漏了触发骰面组合 → `validate()` 无法判断触发条件
- ❌ 单位卡只录了攻击力+生命值，漏了移动范围 → 棋盘交互无法校验合法移动
- ❌ 卡牌只录了效果文本，漏了费用/冷却 → 资源消耗逻辑无数据源

#### 目录结构选择

按游戏复杂度选择合适的数据组织方式：

**简单游戏**：直接在 domain 中定义。

**中等游戏**：
```
data/
  cards.ts           # 实体定义与查询函数
  factions/          # 按分组组织数据
```

**复杂游戏**：
```
config/ 或 heroes/   # 按实体大类拆分
  factions/          # 按阵营/角色进一步拆分
```

具体目录名和文件拆分方式由游戏的实体结构决定，不预设。

#### 录入流程

1. 按实体类别分批录入（如先录基础实体，再录依赖它们的复合实体）
2. 每批录入后输出核对表，**核对表的列必须覆盖该实体类型的所有必要字段，不只是名称**
   - 列的选择依据：上述"必要信息判断原则"中命中的字段
   - 数值字段直接列出数值，引用字段列出引用目标，布尔/枚举字段列出取值
   - 最后一列标注录入状态（✅ 已录入 / ❌ 缺数据 / ⚠️ 待确认）
3. 用户确认核对表后，该批数据视为"已验收"
4. 所有稳定 ID 录入 `domain/ids.ts`（`as const`），禁止字符串字面量
5. **全量数据确认（阶段门禁）**：所有批次录入完成后，输出一份汇总清单，包含：
   - 各实体类别的数量统计（如"单位 24 张、技能 18 个、事件 12 种"）
   - 仍有 `TODO: 待确认` 的条目列表
   - 标记 `DEFERRED` 的引擎原语需求列表
   - 用户明确回复"确认"后才可进入阶段 3，否则继续补充

### 2.3 完善类型定义

根据录入的数据，补充 domain/types.ts（或拆分文件）：
- 完整的 `PlayerState`（根据游戏需要的状态字段）
  - **状态效果建议用 `TagContainer` 表达**（`engine/primitives/tags.ts`），避免散落的 `statusEffects: Record<string, number>` / `tempAbilities: string[]`
- 完整的 `<GameId>Core`（玩家状态/回合信息/游戏特有状态等）
- 所有命令类型（`XX_COMMANDS` 常量对象）
- 所有事件类型（`XX_EVENTS` 常量对象）
- 实体定义的 TypeScript 接口

### 2.4 检查系统需求与引擎原语选型

对照规则，在引擎层检索可复用实现：
- 骰子 → `src/engine/primitives/dice.ts`
- 资源（消耗品）→ `src/engine/primitives/resources.ts`
- 状态/buff/debuff（层数/持续时间/净化/层级匹配）→ `src/engine/primitives/tags.ts`
- 数值修改管线（flat/percent/override/compute + priority）→ `src/engine/primitives/modifier.ts`
- 可被 buff 修改的属性（base + modifier → current）→ `src/engine/primitives/attribute.ts`
- 能力系统骨架（注册/查找/执行器分发/可用性检查）→ `src/engine/primitives/ability.ts`
- 卡牌/区域 → `src/engine/primitives/zones.ts`
- 条件/表达式 → `src/engine/primitives/condition.ts` + `expression.ts`
- 目标解析 → `src/engine/primitives/target.ts`
- 效果执行 → `src/engine/primitives/effects.ts`

**强制要求（新游戏）**：
- 禁止自行实现 statusEffects / tempAbilities / DamageModifier / PowerModifierFn / abilityRegistry；必须复用上述 primitives（详见 `AGENTS.md` 与 `docs/ai-rules/engine-systems.md`）。

**若缺口存在**：优先补充 `src/engine/primitives/`（通用工具函数）；领域语义放在游戏层（`src/games/<gameId>/domain/`）。若工作量大，记入延后清单，在后续阶段补充。

### 2.5 领域建模前置审查（强制门禁）

> 完整规范见 `docs/ai-rules/engine-systems.md`「领域建模前置审查」节。
> 核心原则：**规则文本 → 领域模型 → 实现**，禁止跳过建模直接写实现。

1. **领域概念建模**：为每个规则术语定义精确语义边界和事件映射（如"影响"= 哪些具体事件）。
2. **决策点识别**：标记所有需要玩家选择的点（强制/可选/无），评估引擎是否支持该交互模式。
3. **引擎能力缺口分析**：建模产出与引擎能力逐一比对，列出缺口和扩展计划。

产出：术语→事件映射表 + 决策点清单 + 引擎缺口清单。

### 验收

- 规则文档完整录入 `rule/*.md`，覆盖所有阶段/实体/操作/结算/特殊机制
- 静态数据全部录入代码，核对表已获用户确认
- types.ts 中所有类型能覆盖规则文档描述的实体
- ids.ts 常量表覆盖所有稳定 ID
- 数据文件可正常导入，无循环依赖
- 冒烟测试仍通过
- **领域建模审查已完成**（术语映射表/决策点清单/引擎缺口清单）
- **延后清单**（若有）：列出需要新增引擎原语的项目及预计补充阶段

---

## 阶段 3：领域内核实现（Command → Event → Reduce）

## 旧浏览器兼容门禁（新游戏强制）

新游戏默认遵循这条原则：**能继续兼容就继续兼容，真缺关键能力才提示**。

1. 禁止按浏览器版本号硬拦
   - 版本号只能作为经验参考，不得直接作为 `/play/:gameId/*` 的拦截条件。
   - 旧版本只要关键能力仍然齐全，就必须允许进入并继续游玩。
2. 可降级能力优先做 fallback
   - `matchMedia`、监听 API 差异（`addEventListener('change')` vs `addListener`）这类能力，优先在通用工具层或游戏层补 fallback。
   - 只有在确认没有安全 fallback、且缺失后会破坏核心游玩时，才允许升级成兼容门禁。
3. 门禁必须按游戏/页面精确收敛
   - 不要把某个游戏需要的浏览器能力写成所有 `/play/*` 的统一硬门槛。
   - 若某项能力只影响特定游戏或特定 dev 页面，门禁必须按 `gameId` 或页面前缀精确判断。
4. `ResizeObserver` 视为高风险能力，但不是全站默认门槛
   - 只有当该游戏的核心游玩布局确实依赖 `ResizeObserver`，且缺失后会导致棋盘/地图/主操作区明显错位或不可操作时，才允许把它加入该游戏的拦截条件。
   - 教程浮层、关于页特效、UGC 编辑器这类外围能力，不得外扩成所有游戏的游玩门槛。

**目标**：完成确定性核心逻辑，测试通过。

### 3.1 实现 validate（命令校验）

```ts
// domain/commands.ts 或 domain/validate.ts
export function validate(state: MatchState<Core>, command: Command): ValidationResult {
    // 1. 检查是否是当前玩家的回合
    // 2. 检查当前阶段是否允许此命令
    // 3. 检查命令参数合法性
    // 4. 检查资源/条件是否满足
}
```

**三个游戏共同模式**：
- dicethrone: `domain/commands.ts` → `validateCommand()`
- summonerwars: `domain/validate.ts` → `validateCommand()`
- smashup: `domain/commands.ts` → `validate()`

### 3.2 实现 execute（生成事件）

```ts
// domain/execute.ts 或 domain/reducer.ts
export function execute(state: MatchState<Core>, command: Command, random?: RandomFn): GameEvent[] {
    // 根据 command.type 分发处理
    // 返回一系列事件（不直接修改状态）
}
```

### 3.3 实现 reduce（应用事件到状态）

```ts
// domain/reducer.ts
export function reduce(core: Core, event: GameEvent): Core {
    switch (event.type) {
        case 'DAMAGE_DEALT': {
            // ✅ 结构共享：只 spread 变更路径
            const { targetId, amount } = event.payload;
            const target = core.players[targetId];
            if (!target) return core;
            return {
                ...core,
                players: {
                    ...core.players,
                    [targetId]: { ...target, hp: Math.max(0, target.hp - amount) },
                },
            };
        }
        // 每种事件类型一个 case
        default: return core;
    }
}
```

**关键约束**：
- reduce 必须是纯函数，不依赖随机数。
- **禁止 `JSON.parse(JSON.stringify())`**（性能灾难）。只 spread 变更路径，未变路径保持原引用。
- 嵌套超过 3 层时提取 `updatePlayer()` 等 helper 到 `domain/utils.ts`。
- 详见 `docs/ai-rules/engine-systems.md`「Reducer 结构共享范例」。

### 3.4 实现 isGameOver

```ts
isGameOver: (core): GameOverResult | undefined => {
    // 检查胜利条件
    // 返回 { winner: playerId } 或 { draw: true } 或 undefined
}
```

### 3.5 补充单元测试

在 `__tests__/` 创建测试文件，覆盖：
- 正常流程（happy path）
- 非法操作被拒绝
- 边界条件
- 胜利条件判定

**测试辅助模式**（参考 smashup/__tests__/helpers.ts）：
```ts
export function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState { ... }
export function makeState(overrides?: Partial<Core>): Core { ... }
export function makeMatchState(core: Core): MatchState<Core> { ... }
```

### 验收

```bash
npx vitest run src/games/<gameId>  # 所有测试通过
```

核心规则正常 + 异常场景有覆盖。

---

## 阶段 4：FlowSystem 与系统组装

**目标**：接入 FlowSystem 完成阶段流转，`game.ts` 组装完毕。

### 4.1 实现 FlowHooks

创建 `domain/flowHooks.ts`（参考 summonerwars/domain/flowHooks.ts）：

```ts
import type { FlowHooks, PhaseExitResult } from '../../../engine/systems/FlowSystem';

export const flowHooks: FlowHooks<Core> = {
    // 初始阶段（通常为 factionSelect 或第一个游戏阶段）
    initialPhase: 'factionSelect',

    // 是否允许推进
    canAdvance: ({ state }) => ({ ok: true }),

    // 下一阶段计算
    getNextPhase: ({ state, from }) => {
        const idx = PHASE_ORDER.indexOf(from as GamePhase);
        return PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
    },

    // 当前活跃玩家
    getActivePlayerId: ({ state }) => state.core.currentPlayer,

    // 阶段退出副作用（如：抽牌/切换回合/结算伤害）
    onPhaseExit: ({ state, from }): PhaseExitResult => {
        const events: GameEvent[] = [];
        // 按阶段处理副作用
        return { events };
    },

    // 阶段进入副作用（如：回合开始事件/状态重置）
    onPhaseEnter: ({ state, from, to }): GameEvent[] => {
        const events: GameEvent[] = [];
        // 按阶段处理副作用
        return events;
    },

    // 自动推进检查（如：非交互阶段自动跳过）
    onAutoContinueCheck: ({ state, events }) => {
        // 如 startTurn/endTurn 等纯自动阶段
        return undefined;
    },
};
```

**三个游戏的 FlowHooks 复杂度对比**：
- smashup: `domain/index.ts` 内联（~150 行），阶段退出处理记分逻辑
- summonerwars: 独立 `domain/flowHooks.ts`（~250 行），阶段进退处理抽牌/换人/技能触发
- dicethrone: `game.ts` 内联（~500 行），最复杂，攻防阶段有大量分支

### 4.2 完善 game.ts

```ts
// 系统选择模式（三个游戏共同模式）
const systems = [
    createFlowSystem<Core>({ hooks: flowHooks }),
    // 方式 A：逐个选择（dicethrone/summonerwars 风格，精细控制）
    createEventStreamSystem(),
    createLogSystem(),
    createActionLogSystem({ commandAllowlist: ACTION_ALLOWLIST, formatEntry }),
    createUndoSystem({ snapshotCommandAllowlist: UNDO_ALLOWLIST }),
    createInteractionSystem(),
    createRematchSystem(),
    createResponseWindowSystem({  // 需要响应窗口时配置注入
        allowedCommands: ['PLAY_CARD'],  // 响应期间允许的游戏命令
        responseAdvanceEvents: [         // 触发响应者推进的事件
            { eventType: 'CARD_PLAYED' },
        ],
        // interactionLock: { ... },     // 多步交互锁定（可选）
    }),
    createTutorialSystem(),
    createCheatSystem<Core>(cheatModifier),

    // 方式 B：默认集合（smashup 风格，简洁）
    // ...createBaseSystems<Core>(),
    // createCheatSystem<Core>(cheatModifier),
];

// 命令类型（只列业务命令，系统命令由 adapter 自动合并）
const commandTypes = [
    ...Object.values(XX_COMMANDS),
];
```

### 4.3 实现 CheatModifier（开发调试必备）

参考 summonerwars/game.ts 的 `summonerWarsCheatModifier`，至少实现：
- `getResource` / `setResource`
- `setPhase`
- `dealCardByIndex`（如有牌库）

### 4.4 ActionLog + 卡牌预览（避免重复说明，按权威实现做）

**强制先读（权威单一来源）**：
- `docs/ai-rules/engine-systems.md`（ActionLogSystem 使用规范）
- `evidence/dicethrone/action-log-card-preview.md`（卡牌预览注册表模式 + 数据流说明）

**你在新游戏里只需要做这些（最小闭环）**：
1. 在 `game.ts` 配置 `createActionLogSystem({ commandAllowlist, formatEntry })`，`formatEntry` 产出包含 `segments` 的 `ActionLogEntry`。
2. 若游戏有卡牌：实现 `ui/cardPreviewHelper.ts` 提供 `cardId → CardPreviewRef` 查询，并在 `game.ts` **文件末尾**调用 `registerCardPreviewGetter(gameId, getter)` 注册。

> 关键点：Vite SSR 的函数提升陷阱与“注册必须放文件末尾”的原因，详见 `AGENTS.md` / `docs/ai-rules/golden-rules.md`。

### 4.5 补充 FlowHooks 测试

```bash
npx vitest run src/games/<gameId>/__tests__/flow.test.ts
```

### 验收

```bash
npm run generate:manifests   # 清单生成成功
npx vitest run src/games/<gameId>  # 所有测试通过
npm run dev                  # 游戏可从大厅创建对局，基础回合可推进
```

---

## 阶段 5：Board/UI 与交互闭环

**目标**：提供最小可玩 UI，完成交互闭环。

### 5.0A 新 UI 端到端完成门禁（强制）

- 只要本阶段新增或重做了游戏主 UI、主 Board、关键面板、核心交互布局，就必须把“完成”定义为**真实页面端到端通过**，而不是“组件存在 / 局部截图可看 / 测试通过”。
- 若该阶段同时包含桌面端与移动端工作，默认顺序固定为：**先让桌面端真实页面通过，再进入移动端适配**。除非用户当轮明确要求并行推进，或明确说先做移动端，否则不得把“移动端适配”升级成下一主阶段。
- **在线房间的前置选择默认必须在对局内完成（强制）**：
  - 只要游戏存在 `scenario / faction / character / armament / loadout` 这类会影响具体席位、阵营、可见信息或后续前置流程的选择，且该游戏支持联机房间，就默认做成**进入 match 后的局内 setup 层**。
  - 其中 `scenario` 若还承担**剧本介绍、候选对比、全员投票、房主裁定同票**中的任一职责，则剧本本体也默认属于局内 setup，不得继续在建房页直接预设最终剧本结果。
  - 局内 setup 必须是独立页面或独立壳层，不得把投票、选阵营、人物/军备/loadout 选择压在正式棋盘 HUD 上；setup 未完成前，轮盘、手牌、牌库、弃牌、动作栏等正式对局主 HUD 不应同时渲染。
  - 建房页只允许承载房间级公共参数，例如人数、密码、是否有 AI，或“是否启用局内剧本投票”这类房间模式开关；不得把某个席位/阵营的私有前置决定，或本应在局内阅读介绍后再决定的剧本结果，偷偷写死在建房页默认值里。
  - 若某些前置项确实要在建房页完成，必须证明它们不是 seat-private 信息，不依赖局内介绍/投票，且不会让后续联机页面缺少真实操作入口；否则视为流程不完整。
- **联机游戏先锁 seat/viewer 语义，再做主 Board（强制）**：
  - 只要目标包含在线房间、多人或 spectator，主 Board 开发前必须先裁定每个页面到底代表哪个 seat / viewer，以及哪些信息属于该 viewer 的私有视图。
  - 默认要有 `playerView`、私有 overlay 或等价过滤层，确保手牌、prompt、局内 setup、waiting 态都按 viewer 隔离；不得先按本地同屏心智把所有页面做成“谁回合到谁就切过去看谁”。
  - 若当前 viewer 对应的 seat / faction 解析失败，默认动作是留空、等待或报错提示；不得回退成“当前行动势力的私有视图”，更不得因为 `currentPlayer` 变化把页面自动切成别人的手牌和私有候选。
  - 联机验收必须至少有一条**多浏览器上下文** E2E，证明不同 seat 页面看到的是不同私有内容；hotseat/local 只能当辅证，不能冒充联机验收。
- **一级行动与二级步骤必须分层呈现（强制）**：
  - 当流程存在“先选主行动，再选目标/成本/确认”的两段式结构时，UI 必须先明确锁定当前一级行动，再暴露二级步骤。
  - 未进入当前一级行动前，不得让地图、手牌、轮盘、确认按钮、次级候选同时都像并列主入口那样可点；否则用户无法判断现在到底该先做什么。
  - 若对象本体承担二级点击，仍必须给出贴近对象的短提示或当前行动状态，让用户能从截图中直接看出下一步落点。
- 若真实路由或真实牌桌里仍存在以下任一项，本阶段不得收口为完成：
  - 信息层级错误，主次关系与设计/规则不符
  - 空态、终局态、等待态等关键状态误导用户
  - 文案溢出、标题挤压、卡面/面板比例失真、首屏结构被空白或次级区错误撑大
  - 固定牌桌/棋盘类 PC live 需要滚动页面才能看到完整游戏、手牌或主操作
  - 为了“提质感”给牌桌、公共区、手牌区、HUD 叠出多层无依据边框，导致主交互对象被一圈框体抢焦点
  - 关键操作虽存在，但在真实页面路径中阅读顺序、可达性或可理解性仍失败
- 组件测试、领域测试、局部截图都只能证明“部分约束成立”；**只要真实页面还有已知 UI bug，就不能说新游戏 UI 已实施完毕**。
- 只要桌面端真实页面仍有阻塞级 UI bug，就不能把“已经开始做移动端适配”描述成自然的下一步完成阶段；此时正确状态仍然是“桌面端未完成”。
- **流程跑通的截图定义（强制）**：
  - `主流程已跑通` 默认是指从本轮承诺的**开始点**走到本轮承诺的**结束点**；必须先把两端写死，不能只说“跑过一遍”。
  - 若起点是首页真实入口，就必须真从首页真实入口起跑；若起点只是已进入 `match` 的 opening 代表态，就必须直说“当前只证明对局内从 opening 到 X”。
  - 只要对外说“新游戏主流程已跑通”，必须按核心决策位给出 `触发前 -> 触发后` 截图对，而不是只给终点图。
  - 至少覆盖：入口前/入口后、首个核心决策前/后、至少一个中段关键决策前/后、终局前/终局后；若本轮范围未到终局，必须明确写“当前只证明到哪一步”。
  - 每张 `触发前` 图都必须让人直接看出下一步主操作落在哪里；如果截图看起来像“没有可点对象 / 不知道做什么 / 像页面卡死”，即使规则状态合法，也不得收口。
  - 每张关键图都必须由 AI 自己实际打开并给出肉眼 verdict；禁止只靠断言通过、文件已生成或截图路径存在就宣称流程已证明。
- **新游戏用户友好底线（强制）**：
  - 开局态、空态、等待态、owner prompt 出现前的过渡态，都不得做成“需要靠规则知识猜下一步”的死板空画面。
  - 当只剩单一合法主动作时，必须给出显式入口或贴近入口的短提示；当处于等待态时，必须写清当前在等谁。
  - 这条底线默认先于“画面简洁”；只要简洁导致用户误判成卡死，就算失败。
- **独特高风险交互必须有独立 E2E（强制）**：
  - 只有“同一类交互只是换内容”时，才允许复用现有 E2E。
  - 若本轮新增的是新的联机 setup、seat-private 选择、独特响应窗口、独特支付/弃牌模式、独特棋盘直选模式，就必须单独补一条针对该流程的真实 E2E，不得拿相邻流程的通过结果代替。
- **交互模式来源门禁（强制）**：
  - 风格参考、题材 moodboard、竞品气质图，默认不能直接推出交互模式。
  - 若正式设计稿没有画清交互，而仓内也没有已验证的 sibling 模式，就必须把该交互标记为 `待裁定` 并向用户说明；禁止静默发明一套新交互，再把它写成项目规范。
- 最终汇报必须显式区分三类状态：
  - `已完成`：真实页面主路径已端到端通过，未留已知阻塞级 UI bug
  - `未完成`：真实页面仍有阻塞级 UI bug
  - `可选 polish`：不影响主路径验收的后续微调
- 禁止把“我还在继续收最后几处真实页面问题”和“这一阶段已经完成”同时成立地对外汇报；如果前者成立，默认后者不成立，除非已明确证明剩余项只是非阻塞 polish。

### 5.0 UI 设计规范生成（强制前置）

**强制先读（权威单一来源）**：
- `docs/ai-rules/ui-ux.md`
- 若要生成 UI 概念图或 imagegen prompt：`.codex/skill/boardgame-ui-imagegen/SKILL.md`
- 若涉及动画/特效：`docs/ai-rules/animation-effects.md`
- 若出现白屏/渲染错误/函数未定义：`docs/ai-rules/golden-rules.md`

> 每个游戏的视觉风格各不相同，**禁止直接复用已有游戏的样式规范**。必须为新游戏生成独立的设计规范。

0. **默认四步走（强制）**
   - 没有明显说明时，UI 设计默认按四步走，且**通过前一步才进入下一步**：
     1. **规则提炼 UI**：先从规则、素材、图面结构里提炼必须常驻、按需展开、禁止出现、素材已有 UI，先确认必要元素和基础布局；默认优先生成**运行时主界面/主交互界面**的结构稿。
     2. **布局分裂 UI**：当 Step 1 布局大致没问题后，再生成默认 **3 张布局稿** 来比较最合适的主结构；其中**至少 1 张必须优先使用原本素材语法**。
     3. **风格分叉 UI**：在已选定布局上生成多个风格方案，选定其一后才继续。
     4. **分界面 UI**：在已选定风格下，再分别生成选择角色、运行时、结算等不同界面的 UI；若用户没有特别说明，默认先做最关键的运行时界面，再补其它界面。
   - `design-system/games/<gameId>.md` 是复刻约束与风格合同，不是前四步的替代品。
   - 用户如果只想要其中一步，必须当轮明确说出跳过哪些步；否则默认视为要完整四步。

1. **先看素材再设计（强制）**
   - 若用户提供了图片目录，先识别并打开主地图/主棋盘/角色板/卡牌 atlas/牌背/缩略图。
   - `design-system/games/<gameId>.md` 必须写明至少 1 张主视觉素材的路径、尺寸和肉眼观察结论。
   - 素材本身就是 UI 元素的一部分：地图自带的牌库区、行动轮、流程轨道、区域名称、边界、卡位、图例、槽位都要先作为 UI 约束处理，不能当纯背景。
   - 若素材里包含 `Player reference`、回合顺序卡、帮助卡、`Traitor reference`、`Monster reference` 这类规则摘要卡，默认必须先把它们提炼成运行时的按钮、动作条、短状态或帮助入口；**不得**把整张参考卡直接放进运行界面冒充交互设计。
   - 禁止先用泛化风格词生成一套 UI，再回头硬套用户素材。
   - 生图前必须先按 `boardgame-ui-imagegen` 输出 UI 元素拆解：素材已有 UI、规则必须常驻、按需展开、禁止出现；未完成拆解不得直接调用 imagegen。
2. **执行 ui-ux-pro-max `--design-system`**：根据新游戏的类型、题材、美术风格生成专属设计系统：
   ```bash
   python3 .codex/skill/ui-ux-pro-max/scripts/search.py "<游戏类型> <题材> <风格关键词>" --design-system --persist -p "<游戏名>" --page "game-board"
   ```
3. **产出保存到 `design-system/games/<gameId>.md`**：作为该游戏的 UI 复刻约束参考，后续 Board/组件开发以此为准。
4. **移动端适配写入同一份规范（强制）**
   - 必须写桌面基线与移动端基线。
   - 必须明确 `mobileProfile / preferredOrientation / mobileLayoutPreset` 推荐值。
   - 地图类游戏必须说明拖拽缩放、双指缩放、触控查看、HUD 让位策略。
5. **与通用规范的关系**：`design-system/game-ui/MASTER.md` 中的交互原则（反馈/状态清晰/动画时长等）仍然适用，但配色/字体/视觉风格以游戏专属规范为准。

### 5.0.1 设计稿 / 架构审查 / 需求对齐三联门禁（强制）

- **真实问题定义**：很多“新游戏最后和需求对不上”的根因，不是某一步没做，而是协作者只做了其中一项，例如只出了 proposal、只出了 UI 设计稿、只做了架构审查、只把资源录进目录，然后就直接开始实现。
- **进入正式实现前必须同时满足三项**：
  1. **UI 设计稿已落地**：
     - 必须同时存在：
       - `docs/games/<gameId>/design/generated/step1-*.png|jpg|webp`：规则提炼 / 布局确认稿；
       - `docs/games/<gameId>/design/generated/step2-*.png|jpg|webp`：布局分裂稿（默认 3 张，至少 1 张素材优先）；
       - `docs/games/<gameId>/design/generated/step3-*.png|jpg|webp`：同布局风格分叉稿；
       - `docs/games/<gameId>/design/generated/step4-*.png|jpg|webp`：分界面稿（至少覆盖本轮明确要求的界面类型）；
       - `design-system/games/<gameId>.md`：实现约束与 UI 规范；
       - `docs/games/<gameId>/design/README.md`：明确当前每一步的唯一有效稿。
     - 仅有 `design-system/games/<gameId>.md`，或只有单张壳层图，不算“UI 设计稿已完成”。
  2. **架构审查已落地**：至少存在 `evidence/<gameId>/<gameId>-architecture-review-<date>.md`、OpenSpec `design.md` 专门小节，或 `design-system/games/<gameId>.md` 中的“对象模型与架构边界”章节。
  3. **需求对齐表已落地**：至少能逐项回答“用户要什么 / 当前不做什么 / 设计落点 / 实现落点 / 验证落点 / 当前状态”。
- **禁止行为**：
  - 禁止只做 `design-system/games/<gameId>.md`，就宣称 UI 设计稿已完成；
  - 禁止只做单张位图生图，却没有按四步把结构、布局分裂、风格、分界面走完，就开始实现；
  - 禁止只做架构审查就开始录入数据；
  - 禁止只补 proposal/design/tasks，而缺 `design-system/games/<gameId>.md`；
  - 禁止只在对话里口头说“后面会补设计稿/审查表/对齐表”。
  - 禁止在设计稿未获用户批准时，启动 `dev server`、跑真实页面、补 `Board.tsx` 行为、做前端交互验真。
  - 禁止把“已经有个能点的页面”当成骨架完成；没有通过骨架门禁的页面，一律视为探索性假前端，不得作为正式实现入口继续堆逻辑。
- **默认关系**：
  - Step1 位图回答“必要元素与基础布局是什么”；
  - Step2 位图回答“哪一种布局最适合这款游戏，其中哪一张最贴近原素材语法”；
  - Step3 位图回答“同一布局可以长成哪些风格”；
  - Step4 位图回答“同一风格下不同界面分别长什么样”；
  - `design-system/games/<gameId>.md` 回答“这些稿如何被前端高保真复刻”；
  - 架构审查回答“系统内部如何承接这些对象和规则”；
  - 需求对齐表回答“这三者是否仍对着用户原始目标”。
  - 三者缺任意一项，或四步未走完，就不得进入正式数据录入、正式 Board 实现或正式玩法实现。
- **运行态最低交互门槛（强制）**：
  - 只要 Step1 做的是运行时主界面，图上就必须能看出“当前玩家现在到底能点什么”。
  - 像 `移动`、`探索`、`交易`、`使用 Item/Omen 特殊动作`、`结束回合` 这类从规则或参考卡提炼出的操作，必须至少以按钮、动作条、状态切换或贴近对象的短入口出现其一。
  - 若画面里出现了参考卡大图、帮助卡大图，却看不出当前玩家如何执行这些动作，默认判 Step1 失败。

### 5.0.2 设计批准 → 骨架 → 前端实现 顺序门禁（强制）

- **顺序不可打乱**：新游戏正式进入前端实现前，必须严格满足：
  1. 位图设计四步稿已产出；
  2. 当前进入实现所需的设计稿已经过用户明确批准；
  3. 骨架已完成并可回查边界；
  4. 然后才允许写前端与启动真实页面验证。
- **这里的骨架至少包括**：
  - `proposal / design / tasks / spec delta` 或等价的正式边界文档已说明本轮做什么、不做什么；
  - 需求对齐表能回答“必要按钮为什么存在、哪些按钮暂不该出现、后续界面有哪些”；
  - 运行时对象、主交互入口、状态来源、资源合同已有可实现的最小合同，而不是只剩一张图。
- **禁止行为**：
  - 禁止在“设计稿还没批”时直接写页面，事后再拿页面截图反过来当设计确认；
  - 禁止在“骨架未完成”时进入前端实现，把探索性页面堆成正式运行页；
  - 禁止把“先写一个能点的页面看看”包装成设计阶段的一部分。

### 5.1 Board.tsx 主组件

**三个游戏的 Board 共同模式**：

```tsx
const Board: React.FC<Props> = ({ G, moves, playerID, ctx }) => {
    const core = G.core;
    const phase = G.sys.phase;
    const gameMode = useGameMode();
    const { t } = useTranslation('game-<gameId>');

    // 1. 基础状态
    const isGameOver = ctx.gameover;
    const isMyTurn = playerID === core.currentPlayer;

    // 2. 教学系统集成
    useTutorialBridge(G.sys.tutorial, moves as Record<string, unknown>);
    const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();

    // 3. 音效系统
    useGameAudio({ config: AUDIO_CONFIG, gameId: MANIFEST.id, G: core, ctx: { ... } });

    // 4. 事件消费 → 动画驱动
    const gameEvents = useGameEvents({ G, myPlayerId: playerID || '0' });

    // 5. 阵营/角色选择阶段
    if (isInSelectionPhase) {
        return <FactionSelection ... />;
    }

    // 6. 游戏主 UI
    return (
        <div className="...">
            {/* 棋盘/基地/卡牌区域 */}
            {/* 手牌区 */}
            {/* 阶段指示/操作按钮 */}
            {/* 结算覆盖层 */}
            {isGameOver && <EndgameOverlay ... />}
        </div>
    );
};
```

### 5.2 UI 子模块拆分

当 Board.tsx 超过 300 行时，按职责拆分到 `ui/` 目录：

**参考 summonerwars/ui/**：
- `BoardGrid.tsx` — 棋盘网格渲染
- `HandArea.tsx` — 手牌区
- `PhaseTracker.tsx` — 阶段指示器
- `PlayerInfo.tsx` — 玩家信息面板
- `GameButton.tsx` — 游戏操作按钮
- `useGameEvents.ts` — 事件消费 hook
- `useCellInteraction.ts` — 格子交互 hook
- `BoardEffects.tsx` — 特效层
- `FactionSelection.tsx` — 阵营选择 UI

**参考 smashup/ui/**：
- `HandArea.tsx` — 手牌区
- `FactionSelection.tsx` — 派系选择
- `PromptOverlay.tsx` — 提示覆盖层
- `useGameEvents.ts` — 事件消费
- `BoardEffects.tsx` — 特效层

### 5.3 交互映射

所有用户操作通过 `moves[COMMAND_TYPE](payload)` 触发：
- 点击/拖拽 → Command
- Board 不直接改 core

### 5.4 阵营/角色选择

**三个游戏共同模式**：初始阶段是 `factionSelect`/`setup`，通过 FlowHooks 的 `onAutoContinueCheck` 在所有玩家准备后自动推进到游戏阶段。

UI 侧使用 `TutorialSelectionGate`（框架组件）或自定义选择组件。

### 验收

- 核心操作可在 UI 中完成
- 阶段推进正常
- 结束界面正常显示
- 已按真实页面端到端复核主路径、空态、等待态、终局态；没有仍阻塞完成口径的已知 UI bug

---

## 阶段 6：收尾与启用

**目标**：补齐 i18n、测试、教学、音效。

### 6.1 i18n 文案

补齐 `public/locales/{zh-CN,en}/game-<gameId>.json` 中的所有文案：
- 阶段名称
- 命令/事件描述
- UI 文本
- 教学步骤文案

### 6.2 教学配置

参考 smashup/tutorial.ts 的模式：
1. setup 步骤：AI 自动完成选角 + 作弊设置手牌
2. UI 介绍步骤：逐个高亮 UI 元素（`highlightTarget` + `blockedCommands`）
3. 操作教学步骤：`requireAction: true` + `allowedCommands` + `advanceOnEvents`

### 6.3 音频配置（已重构，避免重复造轮子）

**强制先读**（权威单一来源，避免本文档过时）：
- `AGENTS.md`「音频资源架构（强制）」
- `docs/ai-rules/asset-pipeline.md`「🔊 音频资源规范」
- `./.codex/skill/audio-integration/SKILL.md`（workflow） + `docs/audio/audio-usage.md`（新增音频资产流程见 `docs/audio/add-audio.md`）

**你在新游戏里只需要做这些（最小闭环）**：
1. 创建 `src/games/<gameId>/audio.config.ts`，导出 `GameAudioConfig`：
   - `feedbackResolver(event): SoundKey | null`：无动画事件返回 SoundKey；有动画事件返回 `null`，音效交给动画层 `onImpact()` 播放
   - `criticalSounds`：进入游戏后立即预加载的高频音效 key（建议 5~15）
   - （可选）`contextualPreloadKeys`：根据上下文增量预热
   - BGM 列表按现有游戏格式配置（具体规则以 `docs/audio/audio-usage.md` 为准）
2. **音效 key 的唯一来源**：`public/assets/common/audio/registry.json`。
   - 禁止在游戏层声明 `basePath/sounds`
   - 禁止手写 `compressed/`
   - 禁止定义短 key（如 `click/dice_roll`），必须使用 registry 的完整 key
3. **避免重复播放**：同一动作只能走一条路径（`feedbackResolver` / FX `FeedbackPack` / 动画 `onImpact` / UI `GameButton` / `playDeniedSound()`）。

> 参考实现：`src/games/smashup/audio.config.ts` / `src/games/summonerwars/audio.config.ts`。

### 6.4 关键图片预加载（若游戏有精灵图/图集）

**强制先读（权威单一来源）**：
- `docs/ai-rules/asset-pipeline.md`（critical/warm 规则、路径格式、门禁与验收清单）

**你在新游戏里只需要做这些（最小闭环）**：
1. 实现 `criticalImageResolver.ts`，返回 `{ critical, warm }`，并按“选择阶段 vs 游戏阶段”动态解析。
2. 在 `game.ts`（或游戏入口约定的位置）注册 resolver。

> 参考实现：`src/games/smashup/criticalImageResolver.ts` / `src/games/summonerwars/criticalImageResolver.ts` / `src/games/dicethrone/criticalImageResolver.ts`。

### 6.5 debug-config（可选）

若需要调试面板，创建 `debug-config.tsx` 提供游戏专属调试选项。

**调试面板规范**：
- 调试入口统一使用 `GameDebugPanel` 组件挂载在 Board 内，不得创建新的全局入口。
- 调试操作必须通过 `SYS_CHEAT_*` 指令（依赖 CheatSystem），禁止直接修改 core。
- 若包含“发牌/出牌”类调试：
  - **必须以精灵图索引为发牌依据**（或等价的稳定索引），保证可复现。
  - **必须提供索引对照表**（索引 → 名称/类型），支持快速查找与一键发牌。
- 面板内状态复制/赋值需校验 JSON，失败给出明确提示。
- 重要调试动作尽量提供快捷按钮（如“清零/满值/切换阶段”）。

### 6.6 资源命名与落盘（缩略图 / 图集 / 插图）

1. 若用户已给素材类型或图片位置，AI 默认负责：
   - 先读图，再判断是否属于明显随机文件名；只有这类文件才按图片内容语义自动命名（如 `cover`、`<batch>`、`<entityId>-board`）
   - 自动移动到正确目录
   - 自动运行最小必要范围的压缩命令
2. 缩略图默认流程：
   - 原图放入 `public/assets/i18n/zh-CN/<gameId>/thumbnails/cover.png`
   - 运行 `npm run compress:images -- public/assets/i18n/zh-CN/<gameId>/thumbnails`
   - `manifest.ts` 中 `thumbnailPath` 使用 `<gameId>/thumbnails/cover`
   - `thumbnail.tsx` 使用 `ManifestGameThumbnail`，禁止自写 `<img src="/assets/...">`
3. 图集 / 运行时图片默认流程：
   - 若原图本身是单对象运行时资源，按业务语义落到 `public/assets/i18n/zh-CN/<gameId>/<category>/`
   - 若原图本身是大拼版、整版房间图、整版楼层图、扫描页或多对象说明页，必须先裁成单对象资源，再进入正式目录
   - 图集配置落到 `public/assets/atlas-configs/<gameId>/`
   - 切片顺序、索引和命名先写合同，再接入代码
4. 若当前环境依赖远端默认资源基址：
   - 启动前主动询问是否先 `npm run assets:download -- --check`
   - 交付前必须执行 `npm run assets:check`
   - 若检查到本轮新增/变更的运行时资源远端缺失，必须继续上传并用远端 URL 复核到 `200/206`，再算交付完成

### 6.7 最终验证

```bash
npm run generate:manifests          # 清单生成成功
npx vitest run src/games/<gameId>   # 所有测试通过
npm run typecheck                   # 类型检查通过
npm run assets:check                # 若本轮新增了运行时资源，检查远端缺口
npm run assets:upload               # check 发现本轮运行时资源远端缺失时必须执行
npm run dev                         # 大厅可见、可创建对局、可完整游玩
```

### 验收

- 清单生成成功
- 所有测试通过
- 游戏可从大厅进入并完成完整游玩流程
- i18n 双语齐全
- 若本轮新增/修改了运行时资源：远端对象已上传，并已用实际远端 URL 复核可访问

---

## 系统与红线速查（只保留本 skill 的最小提醒）

**权威来源**：系统清单/红线/反模式以 `AGENTS.md` + `docs/ai-rules/engine-systems.md` 为准，本节不再重复抄写。

### 系统组装最小提醒

- `createBaseSystems()` 默认包含：EventStream + Log + ActionLog + Undo + Interaction + Rematch + ResponseWindow + Tutorial
- `createBaseSystems()` **不包含** FlowSystem / CheatSystem：需要自行追加
- `commandTypes` **只列业务命令**：系统命令由 adapter 自动合并
- ResponseWindowSystem **必须配置注入**：`allowedCommands` / `responseAdvanceEvents`（禁止改引擎文件）

### 新架构强制复用（新游戏）

- 能力系统：必须使用 `engine/primitives/ability.ts`
- 状态/buff/debuff：必须使用 `engine/primitives/tags.ts`
- 数值修改：必须使用 `engine/primitives/modifier.ts`
- 可被 buff 修改的属性：必须使用 `engine/primitives/attribute.ts`（纯资源消耗仍用 `resources.ts`）
- 当前决策者读取：必须优先复用 `src/engine/sessionContext.ts` 这一层语义，不再在共享层手写 `currentPlayer/currentPlayerId/currentPlayerIndex` 分支
- 跨区对象/临时控制/附着脱离：必须先设计稳定 `object ref + provenance`，禁止直接复制历史 `owner/originalOwner/fromPlayerId/toPlayerId` 弱协议
- 跨阶段交互：必须显式设计 `deferred snapshot`，禁止把创建时事实偷偷挂在 ad hoc `runtimeContext/context` 上
- 交互展示：必须给出独立 descriptor，禁止靠 payload 形状推断 UI 模式

---

## 参考资料

- 目录骨架与最小模板：references/game-skeleton.md
- 图片 / 位置驱动 intake：references/asset-intake.md
- 清单生成说明：references/manifest-generation.md
- 项目结构速览：references/project-structure.md

## 架构参考路径（仅用于理解，不照抄）

- **最复杂流程**：`src/games/dicethrone/`（角色系统/骰子/攻防/状态效果/Token响应）
- **中等复杂 + 棋盘战棋**：`src/games/summonerwars/`（网格棋盘/单位管理/阵营牌组/技能系统）
- **中等复杂 + 卡牌区控**：`src/games/smashup/`（多人支持/基地记分/派系混搭/持续效果）
- **框架层组件**：`src/components/game/framework/`
- **引擎系统**：`src/engine/systems/`
- **引擎原语**：`src/engine/primitives/`

## 缩略图配置模板（thumbnail.tsx）

```tsx
import manifest from './manifest';
import { ManifestGameThumbnail } from '../../components/lobby/thumbnails';

export default function Thumbnail() {
    return <ManifestGameThumbnail manifest={manifest} />;
}
```

- `manifest.ts` 中配置 `thumbnailPath: '<gameId>/thumbnails/cover'`（不含扩展名、不含 `compressed/`）。
- 用户提供图片后，运行 `npm run compress:images -- public/assets/i18n/zh-CN/<gameId>/thumbnails` 压缩。
- 禁止在 `thumbnail.tsx` 中硬编码 `/assets/<gameId>/.../compressed/*.webp`；如需定制视觉，在 `ManifestGameThumbnail` 或公共缩略图组件层扩展。
