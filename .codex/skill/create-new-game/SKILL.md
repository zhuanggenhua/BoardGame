---
name: create-new-game
description: "BoardGame 新游戏创建或资源/data intake 流程。用于新增游戏、只给图片/位置先开工；按现有游戏模式分阶段推进并验收。"
---

# 创建新游戏（分阶段工作流）

> **核心原则**：每个阶段独立可验证、独立可提交。阶段之间不留 TODO 缺口。AI 必须在完成当前阶段验收后才能进入下一阶段。
> **新增游戏第一步不是写 Board**：在规则来源和素材目录已给出时，第一批实质动作必须是规则数据录入、规则对象抽取、素材候选定位、语义命名与正式落盘/替代裁定。低保真程序化界面只能算原型，不能绕过素材 intake。
> **用户给出 URL / 哈希素材 / DOM / 结算界面时先录入**：用户当轮或历史上下文里已经给出可用素材 URL、Steam CDN/Workshop 哈希、DOM、CSS、结算截图、BGG 教程页或本地素材目录时，第一动作必须把这些来源写进 intake 表，执行下载/定位/命名/裁切/落盘或明确失败；不得先做程序化 UI、空素材 Board、提案文档或截图验收。若未找到用户点名素材，必须把“查找命令、失败路径、最小补救”写成缺口，不得标完成。
> **第一步必须产生可执行矩阵**：阶段 0 不是一句“已看素材”，而是必须落成规则对象素材矩阵；矩阵每行必须能驱动下一步查找、重命名、裁切、落盘、接线、替代批准或阻塞。
> **多剧本 / 多模式 / 多场景必须先建子账本**：如果游戏规则由多个剧本、关卡、模式、boss、事件包、地图、作祟、任务或胜利条件组合而成，不能用 1 个代表样例外推完整规则。必须先建立总索引、官方源段映射和逐项子账本门禁；未完成子账本的条目只能标为 `source-mapped-contract-pending`、`representative-only` 或 `blocked`，不得称为基础功能完成。
> **执行顺序红线**：阶段 0 未形成可验证的规则对象素材矩阵前，不得把目录骨架、Board、E2E、截图、提案或收口文档当成主交付；如果已经误入后续阶段，必须立刻降回 `in_progress` 并先补阶段 0。
> **录入账本必须一致**：同一源图、DOM/HTML/TTS 存档、裁切合同、manifest、运行时代码和完成状态不得互相打架；只要某个源图已被裁切落盘或运行时引用，候选表和分类合同必须同步改为 `pass`，不得仍保留 `blocked`、`基础版不接入` 或 `intake-closed`。
> **指定参考未命中必须阻塞**：用户点名 DOM、截图、电子版、规则书、BGG 页面、TTS 存档或某个素材文件时，必须先证明该参考已读取且可用；若文件缺失、为空、不可解析或内容不覆盖目标，必须停在 `blocked/in_progress` 并汇报缺口，不能改用相邻来源继续实施或标完成。若某个参考为空，只能说明“这个参考为空”，还必须继续查同批目录、用户 URL、缓存和可爬取页面；只有全部候选来源都实际查过且失败，才可把素材/布局标为 `blocked`。
> **素材来源不等于 UI 风格**：TTS/Workshop/BGG/DOM/HTML 只能作为素材、结构、位置或交互参考；视觉风格必须按 `docs/ai-rules/ui-ux.md`、`design-system/styles/` 和每个游戏自己的风格裁定执行。禁止因为使用 TTS 素材或坐标，就把主 UI 做成 TTS 桌面风格。
> **每个游戏必须有自己的风格**：新增游戏不是把通用牌桌、其它游戏壳层或 Tailwind 面板换名。进入 Board/UI 实现前，必须先写 `design-system/games/<gameId>.md`，并落成可截图验收的独立风格合同：主题气质、主视觉素材、桌面关系、色彩材质、按钮/HUD 语气、框体数量来源、与同仓其它游戏的差异。首屏看不出该游戏自己的主题和素材语法时，UI 必须保持 `in_progress`。
> **Board/UI 前先走 Design I/O（强制）**：阶段 0 已锁定规则对象、素材和布局真相源后，进入新游戏主 UI、设计稿、布局收敛或 Board 实现前，必须先读 `D:\codex-home\skills\ui-design-pipeline\SKILL.md`，产出本游戏的设计声明、执行契约和 evaluator；它只补“为什么这样设计、按什么验收”，不替代素材 intake、OpenSpec、位图生图批准或真实页面验收。
> **桌面先闭环，手机后降级**：固定牌桌/棋盘/桌面区位类新游戏默认先完成桌面真实页面和 AI 复看；桌面截图未过，不得切到手机适配宣称推进。手机只能在已通过桌面合同上做响应式降级，不能反向污染桌面构图、增加多层框体或压缩主对象来凑屏幕。用户未验收桌面时，手机阶段只能记录为后续缺口，不能继续实施。
> **主桌面少框优先**：用户反馈“框多/像框/这么多框”时，默认指半透明面板、黑色矩形容器、重复胶囊壳、占位边框、按钮壳、分区壳、冗余状态框和全局悬浮黑圆等 UI 容器感；不指扑克牌、筹码、棋子等实体素材边界。桌面未过验收前，必须先消除这些框感来源，让游戏实体和桌面素材成为视觉主体，不得转去手机或用 E2E 绿灯收口。
> **满元素截图是桌面验收基线**：桌面 UI 验收不能只截空桌、开场或结算面板；至少要有一张“玩家已经拿过历史标记/筹码、正在拿新标记/筹码、中央主对象和公共资源同屏”的过程态满元素截图。若游戏没有筹码，替换成该游戏的历史选择、当前选择和中央主对象。用户要求看图时必须实际打开当前截图。
> **缺口必须继续推进或汇报，不得标完成**：只要存在可本地推进的数据录入、素材查找、语义命名、DOM/BGG/截图抽取、OpenSpec 补证、真实 UI 修复、截图复看或任务状态更新，就必须继续执行下一步。只有整体证据全过、真实阻塞已记录、或用户明确暂停时，才允许停止；阶段完成、E2E 通过、截图存在、提案写完都不是完成。

## 流程边界、现场锁定与 OpenSpec

> 详细规则已拆到 `references/workflow-boundaries.md`。进入 proposal/spec/design/tasks、创建新游戏 worktree、处理主工作区与游戏 worktree 分线、或判断是否上升总框架/百游戏模式时，先读该 reference。

最小执行口径：
- 新游戏默认独立 worktree，除非用户明确要求留在当前工作区。
- 一旦选定 worktree，后续读写、验证、截图和 OpenSpec 更新都必须落在同一执行现场。
- 共享基线改动和单游戏实现必须分线收口，不能混成一次无边界提交。
- create-new-game 只管通用流程；进入具体游戏方案、布局、runtime 边界或任务拆分时，切到 OpenSpec。
- 用户要求百游戏模式时，先做抽象层级和候选消费者分析；未明确要求时默认不改总框架。
## 必读索引（单一权威来源，避免本文档过时）

> 本 skill 只做“分阶段流程 + 验收门禁 + 单阶段闭环”。
> 任何**规范/红线/最佳实践**若在下列文档中已有定义，必须以它们为准；本 skill 不重复展开。
> 若本文与下列权威文档出现路径、组件、命令或门禁冲突，先按权威文档执行，并立即修正本文，不得用本文内的旧示例覆盖实施规范。

- 总则：`AGENTS.md`
- 引擎/系统/move/command：`docs/ai-rules/engine-systems.md`
- UI 设计生成链路：`D:\codex-home\skills\ui-design-pipeline\SKILL.md`
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

## 前置门禁与 Intake 裁定

> 详细规则已拆到 `references/preflight-gates.md`。开始目录创建、规则录入、素材落盘、PDF 转 Markdown、图片/位置驱动 intake、对象粒度或资源准入裁定前，先读该 reference。

最小执行口径：
- 先确认主分支基线、服务器素材主源本地同步、真相源/对照源、素材处理授权和目标 gameId。
- 用户问“添加新游戏怎么做”时，必须主动给输入清单、默认流程和验收边界。
- 素材驱动 UI、规则驱动对象粒度、空间载体 setup、数据驱动边界，必须先裁定职责再实施。
- 资源准入必须先建规则配件表白名单；正式资源、候选资源、参考图和排除项不能混放。
- PDF 规则源要先转 Markdown 并做可行性评估；图片/位置驱动 intake 可在最小输入足够时直接启动。

## 阶段 0：规则数据与素材 Intake 第一门禁（强制）

> 详细规则见 `references/preflight-gates.md`、`references/asset-intake.md` 与 `references/mechanics-data-design.md`。新增游戏不能先做低保真 Board 再事后补素材；必须先把规则对象和运行时素材需求锁住。

本阶段是新增游戏的**第一批实际工作**，不是验收时补写的说明。若用户已经给出规则来源和素材目录，默认不得先创建 Board、写 E2E、跑截图或写完成提案；必须先完成下面的录入和素材映射动作。若只给了图片/位置而规则尚不完整，仍先走素材 intake，并把缺失规则对象标为 `待补证据`，不能用原型 UI 代替 intake。

如果阶段 0 已经被跳过，后续发现缺规则对象、缺素材、缺数据录入、缺 UI 承载或缺正式运行时资源时，不能继续沿当前实现硬凑闭环；必须先把状态改回 `in_progress`，补 proposal/tasks/spec 与规则对象素材矩阵，再回到实现。

在进入目录骨架、Board、manifest、E2E 或“完成”判断前，必须先完成以下最小闭环：

1. **规则数据录入**：把规则来源转成可引用文本，列出基础版必须实现的对象、阶段、动作、结算、胜负条件、隐藏信息和随机源。
2. **规则对象清单**：把规则里出现的牌、筹码、token、面板、桌面/区位、帮助卡、扩展对象分成 `基础版必需` / `基础版可程序化` / `只作视觉参考` / `扩展后续` / `无法识别待补证据`。
3. **素材用途裁定**：逐项回答每个基础版必需对象是否需要图片资产；如果需要，必须从用户素材中锁定源文件、语义命名、正式落点、压缩产物和引用方式。
4. **素材命名与落盘**：随机哈希名、下载 URL 名、扫描流水名不得直接进入运行时；必须按规则对象语义重命名或写入待确认清单。已锁定资产必须进入 `public/assets/i18n/zh-CN/<gameId>/...` 并生成压缩/manifest 证据。
5. **布局真相源抽取**：若用户素材里有 DOM/HTML、TTS Workshop JSON、XmlUI、对象 `Transform`、截图或桌面存档，必须先抽取桌面、牌槽、手牌区、token 区、帮助区和主要对象坐标/层级为布局合同；不得因为某个 DOM 文件为空，就跳过其它布局真相源。若用户当轮点名某个来源（例如 DOM 或 BGG 电子版），该来源未读取、为空或不可解析时必须先阻塞汇报，除非用户明确批准改用其它来源。
6. **视觉风格裁定**：布局合同只回答“对象在哪、层级如何、谁承接交互”；视觉风格必须另行从 UI skill、设计系统风格和游戏主题中裁定。素材包来自 TTS 不等于 UI 要复刻 TTS 风格；TTS 坐标最多作为对象关系参考。
7. **禁止跳过口径**：只有“该对象按规则不需要图片”或“用户明确接受程序化表达”时，才可不接入素材；不能因为程序化 UI 能跑通，就把候选素材整体裁成“不阻塞”。

阶段 0 的最低产物必须真实存在：

1. 规则文本或数据录入文件，能回查到来源。
2. 规则对象素材矩阵，覆盖所有基础版必需对象。
3. 素材候选审计表，记录源文件、尺寸、图面判断、准入状态和下一步。
4. 已确认运行时素材的语义命名文件、压缩产物和 manifest 证据。
5. 候选表、分类合同、裁切合同、manifest、运行时代码和完成状态之间的交叉一致性扫描结果。
6. 布局真相源合同；如果确实没有 DOM/HTML/TTS 存档/截图可用，必须列出已查找路径和缺口。
7. 未接入对象的明确缺口或用户批准的程序化替代记录。

本阶段的一票否决：

- 规则对象清单还没有覆盖基础版必需对象时，不得创建“基础版完成”提案、收口文档或完成状态。
- 用户素材目录里存在明显候选，但没有完成源文件定位、语义命名、正式落盘、压缩/manifest 或逐项替代批准时，不得进入完成判断。
- 如果 Board 已经使用程序化扑克牌、筹码、桌面、token 或帮助入口，必须逐项写明对应真实素材为什么不接入；没有用户明确批准时，默认仍为阻塞。
- E2E、单测、typecheck 通过只能证明程序链路能跑，不等于素材 intake 已闭合。
- 不得用“提案已写”“截图已出”“核心流程 E2E 通过”“程序化可玩”替代规则数据录入、素材查找、语义重命名、正式落盘和运行时引用。
- 若同一源素材在一个文件里被标成 `blocked/不接入`，但另一个合同或运行时代码已经使用它，必须先修正录入口径并重新验证；不得带着矛盾账本进入完成判断。
- 若存在 DOM/HTML/TTS 存档/对象坐标/截图等布局真相源但没有抽取合同，主 UI 只能标为 `in_progress`，不得宣称“布局已复刻”或“UI 已完成”。
- 若用户点名的 DOM/HTML/BGG/截图/素材文件未找到、为空、读取失败或与目标不匹配，必须把该事实写进缺口并停止完成判断；不得用其它来源顶上后继续宣称端到端闭环。
- 若布局来源是 TTS/Workshop/BGG/DOM/HTML，只能证明结构参考，不自动证明视觉风格正确；未完成游戏专属风格裁定和截图核对时，UI 必须保持 `in_progress`。
- 若未建立游戏专属风格合同，或合同没有把 BGG/DOM/运行时截图拆成“结构合同”和“视觉裁定”，不得开始把 Board/UI 标为完成。
- 若桌面端真实页面尚未截图复看通过，不得把手机横屏、移动适配、E2E 绿灯或结算截图写成 UI 阶段完成证据。
- 如果阶段 0 任一基础版必需对象仍是 `blocked`、`base-runtime-candidate`、`needs-visual-confirmation` 或无明确替代批准，整体状态必须保持 `in_progress`。
- **端到端验收不得强行跑通**：发现规则提到的素材、数据、交互或实现缺口时，必须先回到提案/任务矩阵补齐缺口并实施；不得用 HTML/CSS 画一个相似元素、文字占位、程序化牌面或假 token 来制造“端到端已通过”。
- **素材缺口一票阻塞**：规则明确出现的素材对象，要么找到源素材并完成语义命名、落盘、压缩、manifest 和运行时引用，要么立刻标为 `blocked` 并停止完成判断；不得把“后续美术优化”当作绕过理由。

未完成本阶段时，只能说“低保真规则链路/原型已跑通”，不得说“新游戏基础版完成”。

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

## 阶段 1.5-2：机制分解与数据设计

> 详细规则已拆到 `references/mechanics-data-design.md`。进入机制分解、数据结构设计、静态数据录入、类型定义、领域建模或引擎能力缺口分析时，先读该 reference。

最小执行口径：
- 先建立“基础规则语义覆盖矩阵”，把规则动作、玩家决策点、随机/进度关系、属性/资源轨、空间放置/朝向、模式/剧本选择逐条映射到状态、事件、命令、UI 承接和验证证据；矩阵未闭合前不得进入基础版完成判断。
- 多剧本 / 多模式 / 多场景游戏必须额外建立“子规则账本索引”：每个剧本、关卡、作祟、boss、任务或模式都要有源段、公开信息、私密信息、setup、目标、特殊规则、特殊行动、token/对象、空间要求、终局和验证状态；代表链只证明代表链本身。
- 先把规则动作拆成机制、状态、事件、命令和 UI 承接，再映射到现有引擎原语。
- 数据结构设计要区分正式真相、系统状态、派生读模型和纯 UI 状态。
- 数据缺失必须显式标记，不得用占位值伪装完成。
- 正式素材缺失或未接入必须显式标记；一旦权威来源里已经锁定素材，就必须接入真实素材或可追溯派生产物，不得继续用文字壳、CSS 图形、示意图、旧占位或相似素材代替。派生产物必须记录源文件、派生方式、运行时路径和验证证据。
- 录入规则文档、静态数据、类型定义和系统需求检查必须一起闭环。
- 基础版一票否决默认包括：玩家必须选择但实现自动代选、规则要求多候选但实现只有单例、轨道/档位/非线性属性被压成裸数值、随机/进度关系只做结果日志没有可见状态承接、空间放置/朝向/连接合法性缺少玩家决策或结构化数据。
- 面向百游戏的设计检查只判断抽象边界，不把当前游戏答案硬塞进通用层。
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
- `docs/ai-rules/engine-action-log.md`（ActionLogSystem 使用规范）
- `evidence/dicethrone/action-log-card-preview.md`（卡牌预览注册表模式 + 数据流说明）

**你在新游戏里只需要做这些（最小闭环）**：
1. 在 `game.ts` 配置 `createActionLogSystem({ commandAllowlist, formatEntry })`，`formatEntry` 产出包含 `segments` 的 `ActionLogEntry`。
2. 若游戏有卡牌：实现 `ui/cardPreviewHelper.ts` 提供 `cardId → CardPreviewRef` 查询，并在 `game.ts` **文件末尾**调用 `registerCardPreviewGetter(gameId, getter)` 注册。
3. Board 不重复实现日志/撤回 UI：行为日志、操作日志和撤回入口由通用 `GameHUD` / FAB 悬浮球承载。新游戏只负责产出正确 ActionLog 数据和接入 Undo 上下文，不在牌桌主界面、侧栏或底部再加日志面板、最近操作列表或第二套撤回按钮。

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

> 详细规则已拆到 `references/ui-implementation-gates.md`。进入新游戏 Board/UI、设计稿批准、实现骨架、交互映射、选择 UI 或基础玩法截图链时，先读该 reference。

最小执行口径：
- 新 UI 必须先过端到端完成门禁，不能只交局部页面或静态壳。
- 新游戏主 UI、设计稿或布局收敛进入本阶段前，必须先走 `D:\codex-home\skills\ui-design-pipeline\SKILL.md`，产出 `spec/domain/design/components/craft/template/evaluator` 这组最小设计声明与回流契约；若用户要位图设计稿，再继续走 `boardgame-ui-imagegen`。
- 设计稿、架构审查、需求对齐三者缺一时，不得进入正式 Board 实现。
- 设计批准 → 骨架 → 前端实现的顺序不能打乱。
- Board 组件按已有游戏模式接入状态、教学、音频、事件和选择阶段。
- 若声称基础流程已具备，必须补真实页面截图链和逐步说明。
- 新游戏主截图链必须包含至少一张高信息密度中局过程态：历史资源/筹码已累积、当前正在获取新资源/筹码、中央主区域牌/棋子/筹码等关键对象同时可见；空首轮或终局图不能替代这张图。
## 阶段 6：收尾与启用

> 详细规则已拆到 `references/finalization-checklist.md`。补 i18n、教学、音频、关键图片预加载、debug 配置、资源命名落盘和最终验证时，先读该 reference。

最小执行口径：
- 补齐游戏 i18n 文案、教学配置、音频配置和关键图片预加载。
- 音频细则读 `docs/ai-rules/audio-assets.md` 和 `.codex/skill/audio-integration/SKILL.md`。
- 关键图片预加载读 `docs/ai-rules/critical-image-preload.md`。
- 资源落盘、压缩、manifest、服务器素材主源回查按 `docs/ai-rules/asset-pipeline.md`。
- 最终验证至少覆盖清单生成、游戏测试、类型检查、资源检查/上传和真实入口可玩性。

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

- 流程边界、执行现场、OpenSpec 与百游戏模式：references/workflow-boundaries.md
- 前置门禁、来源裁定、素材/规则 intake：references/preflight-gates.md
- 目录骨架与最小模板：references/game-skeleton.md
- 机制分解、数据结构设计、数据录入：references/mechanics-data-design.md
- Board/UI 实现门禁与基础玩法截图链：references/ui-implementation-gates.md
- 收尾启用、音频、关键图片、资源验证：references/finalization-checklist.md
- 架构审查模板：references/architecture-review-template.md
- 图片 / 位置驱动 intake：references/asset-intake.md
- 清单生成说明：references/manifest-generation.md
- 项目结构速览：references/project-structure.md
- 基础玩法截图链示例：references/basic-flow-screenshot-template.md

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
