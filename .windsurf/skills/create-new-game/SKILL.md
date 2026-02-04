---
name: create-new-game
description: "为本项目创建新游戏（Boardgame.io + 引擎适配器 + 领域内核）。当用户要求新增游戏/新玩法/新工具并需要接入 src/games、manifest 自动生成、domain core 与 Board 组件时使用。强调通用架构与可复用组件；若现有架构不足，必须先补齐框架/系统层再实现游戏。"
---

# 创建新游戏（引擎架构）

## 前置确认
- 明确 gameId（与目录名一致，小写短横线或单词）
- 明确玩家人数范围、核心回合循环、是否需要“阶段/流程系统”
- 明确是否需要：教程、音效、特殊系统、AI/UGC 支持
- 明确规则文档位置（若会改玩法/机制，先读对应 rule/ 文档）
- 确认是否需要新增通用系统/组件/类型（如需新增，先补齐框架层）

## 必做工作流
1. **复用检查**：优先在 `/core`、`/components/game/framework`、`/systems` 中检索可复用实现。
   - 先 `find_by_name` 再 `grep_search`，确认是否已有骨架组件/系统可复用。
   - 若不存在，先在框架层补足（见“架构补足准则”）。
2. **创建游戏目录**：在 `src/games/<gameId>/` 建立基础文件结构（详见 references/game-skeleton.md）。
3. **实现领域内核**：实现 domain core（types/commands/reducer），只包含确定性状态与规则。
   - 明确 `setup / validate / execute / reduce / isGameOver` 的职责边界。
4. **组装引擎适配器**：在 `game.ts` 中使用 `createGameAdapter`，配置系统与业务命令。
   - `commandTypes` 只声明业务命令，系统命令会自动合并。
5. **实现 Board 与 UI**：Board 只负责 UI 与交互，不直接修改 core，改动通过命令驱动。
6. **新增 manifest**：`manifest.ts` 中声明 id/type/titleKey/descriptionKey 等元数据。
7. **生成清单**：运行 `npm run generate:manifests` 更新 `manifest.*.generated`。
8. **补充测试**：在 `__tests__` 添加 vitest 用例（覆盖正常+异常），并运行测试。
9. **资源接入（可选）**：按需在 `public/assets/<gameId>` 添加资源；音效参考 `audio.config.ts`。

## 系统选型提示
- **简单玩法**：只启用必需系统（Log/ActionLog/Undo/Prompt/Rematch/ResponseWindow/Tutorial 按需）。
- **多阶段流程**：使用 FlowSystem + FlowHooks，并确保 `sys.phase` 为唯一权威来源。
- **交互选择**：需要玩家选择时使用 PromptSystem；响应窗口使用 ResponseWindowSystem。

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
