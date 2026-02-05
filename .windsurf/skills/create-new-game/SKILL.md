---
name: create-new-game
description: "为本项目创建新游戏（Boardgame.io + 引擎适配器 + 领域内核）。当用户要求新增游戏/新玩法/新工具并需要接入 src/games、manifest 自动生成、domain core 与 Board 组件时使用。强调通用架构与可复用组件；若现有架构不足，必须先补齐框架/系统层再实现游戏。"
---

# 创建新游戏（引擎架构）

## 前置确认（最小集合）
- 明确 gameId（与目录名一致，小写短横线或单词）
- 明确玩家人数范围与最小可玩回合循环（MVP 级即可）
- 明确是否需要“阶段/流程系统”（有阶段就用 FlowSystem）
- 明确规则文档位置（若会改玩法/机制，先读对应 rule/ 文档）
- 确认是否需要新增通用系统/组件/类型（如需新增，先补齐框架层）
- **先查配置字段**：在确认字段需求前，先查看 `src/games/manifest.types.ts` 与大厅展示组件，避免重复询问用户已有信息。

## 信息完整性与使用原则（强制）
- **信息完整性门禁**：关键缺口未确认不得进入下一阶段；只能停留在当前阶段并回问。
- **信息全量使用**：用户提供的资料必须映射到 manifest / 本地化 / 规则实现，禁止遗漏。
- **映射清单**：每阶段输出“用户信息 → 实际落地字段”清单供确认。
- **无字段不扩展**：发行年份/评分/出版商等若不在 manifest schema 中，写入本地化 description 文案，不强行扩展结构字段。

## 提问与默认值策略（受门禁约束）
- **仅对关键缺口提问**：只询问以下缺失项：
  1. gameId
  2. 玩家人数范围
  3. 最小可玩规则范围（胜利条件/回合循环）
  4. 必要本地化标题与简介
- **默认值使用条件**：仅对非关键字段使用默认值，并在映射清单中标注“默认值”。
- **避免重复确认**：每阶段只更新“变更清单”，除非用户显式修改，否则不重复询问已确认字段。

## 工作流规范（强制）
- **完整骨架优先**：无论是否已明确规则，必须先生成完整骨架（`manifest.ts`、`game.ts`、`Board.tsx`、`tutorial.ts`、`thumbnail.tsx`、`__tests__` 占位），否则 `npm run dev` 与清单生成会失败。
- **基础骨架直出**：创建新游戏时可直接按模板生成基础骨架，不要求阅读大量源码；规则阶段再读规则/参考文件即可。
- **阶段门禁**：任何阶段未达成“验收”不得进入下一阶段。
- **系统补齐优先**：发现通用能力缺口，必须先补齐框架层再写游戏层逻辑。
- **可视化验证**：新增系统/骨架组件必须附带最小美术素材验证路径。
- **测试伴随**：新增系统/新规则必须补测试用例并运行对应测试。

## 分阶段工作流（必须按序推进）

### 阶段 1：目录与骨架落地（只做结构，不做规则）
- **目标**：建立完整目录结构与占位实现，确保清单可生成。
- **步骤**：
  1. 依据 references/game-skeleton.md 创建 `src/games/<gameId>/` 与 `domain/` 目录结构。
  2. 新建 `manifest.ts` 并完整填写元数据；**必须使用用户已提供的信息**，关键字段缺失则停止推进并回问。
  3. 创建 `game.ts/Board.tsx/tutorial.ts/thumbnail.tsx` 的最小占位导出，禁止业务逻辑。
  4. 在 `rule/` 创建规则文档占位（至少包含标题）。
  5. 在 `__tests__/` 创建占位测试文件（仅保证测试框架可运行）。
- **验收**：
  - 目录齐全、可被清单生成脚本发现（但不启用）。
  - 占位文件可编译通过（不引入业务逻辑）。

### 阶段 2：规则分析 → 工具/系统缺口补齐
- **目标**：从规则文档抽取“系统需求清单”，不足先补齐框架层。
- **步骤**：
  1. 阅读 rule 文档并拆解为：阶段流程、资源/数值、地图与坐标、指令类型、随机/骰子、卡牌/单位/建筑类型。
  2. 输出“系统需求清单”，映射到可用系统与框架组件。
  3. 在 `/core`、`/engine/systems`、`/components/game/framework` 中检索可复用实现（先 `find_by_name` 再 `grep_search`）。
  4. 若缺口存在，按“工具补齐流程”补齐框架层后再回到游戏层。
  5. 放入最小美术素材（占位图或 demo asset），并在 Board 中完成渲染验证。
- **验收**：
  - 新工具/系统有测试用例（vitest），且最小资产可在开发界面渲染。
  - 工具清单已确认，进入下一阶段前不留 TODO 缺口。

#### 工具补齐流程（缺口出现时必须执行）
1. **类型契约**：先在 `/core/ui` 或 `/engine/types` 补接口与类型。
2. **骨架组件**：在 `/components/game/framework` 建立无样式骨架与 hooks。
3. **系统实现**：在 `/engine/systems` 实现通用系统，并暴露配置入口。
4. **最小资产验证**：在 `public/assets/<gameId>/` 放置最小资产并接入 Board 渲染。
5. **测试**：补充 vitest 用例覆盖新增能力与异常路径。

### 阶段 3：领域内核与命令事件闭环
- **目标**：完成确定性核心逻辑（命令 → 事件 → Reducer）。
- **步骤**：
  1. 定义核心状态与类型（`types`）。
  2. 定义业务命令与事件枚举（`commands/events`）。
  3. 实现 `setup/validate/execute/reduce/isGameOver` 并保证确定性。
  4. 若多阶段流程，接入 FlowHooks（`sys.phase` 单一权威）。
  5. 为关键规则补充单元测试（正常 + 异常）。
- **验收**：核心规则测试通过（正常 + 异常场景）。

### 阶段 4：系统组装与数据配置
- **目标**：把领域内核接入引擎系统，并完成最小可玩的数据配置。
- **步骤**：
  1. 在 `game.ts` 组装系统数组（选择必要系统）。
  2. 调用 `createGameAdapter` 连接 domain 与 systems。
  3. 配置 `commandTypes`（仅业务命令）。
  4. 填充最小数据配置（地图尺寸、初始单位/资源、卡牌样例）。
  5. 如需日志/撤销/提示/响应窗口系统，按需启用并配置。
- **验收**：可在开发态创建对局并完成基础回合推进。

### 阶段 5：Board/UI 与交互闭环
- **目标**：提供最小可玩 UI，完成交互闭环与资产展示。
- **步骤**：
  1. Board 仅承载 UI/交互，不直接修改 core。
  2. 接入骨架组件与 hooks（Phase/Hand/Resource 等），游戏层只做样式与配置。
  3. 若有棋盘布局，使用 `BoardLayoutRenderer` 渲染与命中检测。
  4. 将交互映射到命令（点击/拖拽 → Command）。
  5. 验证最小美术素材显示路径。
- **验收**：核心操作可在 UI 中完成；美术素材显示正确。

### 阶段 6：收尾与启用
- **目标**：补齐 i18n、测试、清单与发布条件。
- **步骤**：
  1. 补齐 i18n 文案与缩略图。
  2. 确认 `manifest.enabled` 与发布状态一致（测试阶段可保持 true）。
  3. 运行 `npm run generate:manifests` 更新生成文件。
  4. 运行测试（至少 `vitest run src/games/<gameId>`）。
  5. 验证大厅入口与创建对局流程。
- **验收**：清单生成成功、测试通过、游戏可进入大厅。

## 系统选型提示
- **简单玩法**：只启用必需系统（Log/ActionLog/Undo/Prompt/Rematch/ResponseWindow/Tutorial 按需）。
- **多阶段流程**：使用 FlowSystem + FlowHooks，并确保 `sys.phase` 为唯一权威来源。
- **交互选择**：需要玩家选择时使用 PromptSystem；响应窗口使用 ResponseWindowSystem。
- **工具验证**：新增系统/骨架组件必须提供可视化验证路径（含最小美术素材）。

## 关键约束（必须遵守）
- **三层复用模型**：类型契约 `/core/ui/` → 骨架组件 `/components/game/framework/` → 游戏实现 `/games/<id>/`。
- **禁止系统层写游戏特化逻辑**：系统层只做通用骨架与规则；游戏特化下沉到 `/games/<id>/`。
- **命令驱动**：UI 不直接改 core，必须通过 Command → Event → Reduce。
- **清单自动生成**：不要手改 `manifest.*.generated`。

## 架构补足准则（架构不足时必须执行）
1. **类型契约先行**：在 `/core` 或 `/engine/types` 中补足接口/类型。
2. **通用系统扩展**：需要通用行为时，先在 `/engine/systems` 实现并提供配置入口。
3. **骨架组件优先**：新 UI 骨架先放 `/components/game/framework/`，游戏层仅做样式与配置。
4. **测试与文档**：新增系统/框架必须补测试与必要说明，避免游戏层复制逻辑。

## 参考资料
- 目录与入口说明：references/project-structure.md
- 目录骨架与最小模板：references/game-skeleton.md
- 清单生成脚本说明：references/manifest-generation.md
- 棋盘布局系统：docs/framework/board-layout.md

## 框架组件清单（优先复用）
- 布局与坐标：`BoardLayoutEditor` / `BoardLayoutRenderer` / `board-layout.types` / `board-hit-test`
- 骨架组件：`PhaseIndicatorSkeleton` / `PlayerPanelSkeleton` / `HandAreaSkeleton` / `ResourceTraySkeleton` / `SpotlightSkeleton` / `CharacterSelectionSkeleton`
- 通用 hooks：`useGameBoard` / `useHandArea` / `useResourceTray` / `useDragCard`
- 预设渲染函数：`createPhaseItemRender` / `defaultPhaseItemRender` / `createResourceBarRender` / `defaultResourceBarRender` / `createStatusEffectRender`

## 引擎系统清单（可用工具）
- **FlowSystem**：阶段驱动与门禁控制（`sys.phase` 单一权威）。
- **UndoSystem**：撤销/重做，配合命令白名单生成快照。
- **PromptSystem**：需要玩家选择/输入时的提示与决策流。
- **ResponseWindowSystem**：响应窗口（对攻/拦截/等待回应）。
- **LogSystem**：原始命令/事件流水记录。
- **ActionLogSystem**：可视化动作日志（需要 formatEntry）。
- **EventStreamSystem**：事件流追踪（复盘/调试）。
- **TutorialSystem**：教学步骤与提示驱动。
- **RematchSystem**：重赛投票与结果汇总。
- **CharacterSelectionSystem**：通用选角/准备/房主开始。
- **CheatSystem**：开发态调试/资源注入（仅 DEV）。

### 默认系统组合
- `createDefaultSystems()`：EventStream + Log + ActionLog + Undo + Prompt + Rematch + ResponseWindow + Tutorial

## 架构参考路径（仅用于理解，不照抄）
- 复杂流程参考：`src/games/dicethrone/`
- 框架层组件：`src/components/game/framework/`
- 引擎系统：`src/engine/systems/`
- 新游戏起步参考：`src/games/summonerwars/`
