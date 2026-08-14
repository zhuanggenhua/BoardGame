# Change: Smash Up 10th Anniversary 三派系接入与派系实施工作流补强

## Why

- 用户已在本地加入 `wangling.png` 与 `wangling_base.png`，需要把其中的 `Mermaids / Skeletons / World Champs` 三个派系正式接入 Smash Up。
- 本轮目标不只是资源 intake，还要验证“长期任务 + 多 agent + 可恢复状态”能否把一次批量派系新增自动推进到完整交付。
- 当前项目已有 `data-entry-workflow` 与 `smashup-faction-intake`，但缺少“intake 完成后如何进入逐派系玩法实施与统一收口”的正式 workflow。
- `World Champs` 是混源派系，部分卡能命中当前仓库已有同名实现，更多卡则来自尚未在仓库落地的旧派系；如果没有显式裁定，最容易出现“看名字就盲复用 handler”的错误。

## What Changes

- 新增 `smashup-faction-batch-workflow` 能力，定义 Smash Up 新派系批量任务的两段式流程：`intake → implementation`。
- 保留 `.spec/skills/data-entry-workflow/SKILL.md` 作为统一入口，不新增独立 Smash Up skill；改为让它在“仅 intake”和“intake + 玩法实施”之间做显式分流。
- 新增 `Mermaids / Skeletons / World Champs` 的 atlas、faction/card/base 静态数据、locale、UI metadata 与正式玩法实现。
- 把 `World Champs` 明确建模为“混源 one-of deck”，要求逐张裁定是复用已有实现、复制并改名，还是全新实现。
- 为本轮三派系补齐 Vitest / E2E / evidence，并把 intake 合同、workflow 改造与实现证据一并留档。

## Impact

- Affected specs:
  - 新增 `smashup-faction-batch-workflow`
  - 新增 `smashup-10th-anniversary-factions`
- Affected code / docs:
  - `.spec/skills/data-entry-workflow/SKILL.md`
  - `.spec/skills/smashup-faction-intake/SKILL.md`
  - `.spec/skills/smashup-faction-implementation/SKILL.md`（新增）
  - `src/games/smashup/domain/{ids,atlasCatalog}.ts`
  - `src/games/smashup/data/**`
  - `src/games/smashup/abilities/**`
  - `src/games/smashup/ui/**`
  - `public/locales/*/game-smashup.json`
  - `e2e/**`
  - `evidence/smashup/**`
- Key risks:
  - `World Champs` 不能按“同名即复用”处理，必须逐张审计
  - 仓库根 `task_plan.md / findings.md / progress.md` 当前正服务其他任务，本轮长期任务不能混写
