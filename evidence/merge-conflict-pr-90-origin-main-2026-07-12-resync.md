# 冲突解决汇报：PR #90 再次同步 origin/main

## 1. 背景

- 日期：2026-07-12
- PR：#90「实装 Smash Up 四套 POD 派系与卡图资源」
- 本地 PR head：`40f8a386e8b2212aa4f579d2a2fb0508b9d62637`（已补齐 PR90 POD 本地化、清理门禁，并修复召唤师战争路径轨迹构建导入）
- 最新 `origin/main`：`f565de178019148e196b5d0c4e49f4b90b4264a0`（修复部署构建并提升版本到 0.6.5）
- 触发命令：`git merge --no-edit origin/main`
- 合并目标：让 #90 PR 分支追上最新 `origin/main`，解除 GitHub 显示的 `DIRTY` 冲突状态。

## 2. 真实冲突文件

- `src/games/summonerwars/ui/BoardGrid.tsx`

同时随 `origin/main` 自动带入版本文件更新：

- `package.json`
- `package-lock.json`

## 3. 双边内容与解决策略

### `src/games/summonerwars/ui/BoardGrid.tsx`

- PR #90 修复侧：为了修复 `PathTrailEffect.tsx` 和 `Board.tsx` 对 `getCellPosition` 的构建导入缺口，同时避免 `react-refresh/only-export-components` 新增告警，已把格子坐标计算函数抽到 `src/games/summonerwars/ui/boardGridGeometry.ts`，并让 `BoardGrid.tsx`、`PathTrailEffect.tsx`、`Board.tsx` 统一从该 helper 引入。
- 最新 `origin/main` 侧：在 `BoardGrid.tsx` 内直接导出 `getCellPosition`，并用 eslint disable 注释压住 Fast Refresh 告警。
- 最终处理：保留 PR #90 修复侧的独立 helper 方案，删除冲突块里的 `BoardGrid.tsx` 内联导出函数。这样同时保留 main 要解决的现实问题（对外可复用 `getCellPosition`）和 PR 侧避免新增 Fast Refresh 告警的实现方式。

### `package.json` / `package-lock.json`

- 最新 `origin/main` 将项目版本从 `0.6.4` 提升到 `0.6.5`，`androidVersionCode` 从 `567` 提升到 `568`。
- 最终处理：保留 `origin/main` 的版本号更新。

## 4. 验证

### 冲突解决前已执行

- `npx eslint src/games/summonerwars/Board.tsx src/games/summonerwars/ui/BoardGrid.tsx src/games/summonerwars/ui/PathTrailEffect.tsx src/games/summonerwars/ui/boardGridGeometry.ts`
- `npm run build -- --minify false --configLoader native`

结果：构建通过；eslint 仅保留 `Board.tsx` 既有 hooks warning，未因 helper 拆分新增 Fast Refresh warning。

### 待执行

- 提交本次 merge 后重新执行正常 pre-push 门禁。
- 远端质量门通过后合并 PR #90。

## 5. 结果

- 本次真实冲突已解决，没有保留冲突标记。
- `getCellPosition` 由独立 helper 提供，避免组件文件导出非组件带来的新增告警。
- 版本号更新保留自最新 `origin/main`。

## 2026-07-12 POD 基地图集 fallback 补充

- 远端质量门失败原因是 PR90 新增的 8 个 POD 基地没有英文 POD 图集映射：`base_wyrms_desolation_pod`、`base_dragons_lair_pod`、`base_converted_cave_pod`、`base_crystal_fortress_pod`、`base_akihabara_high_pod`、`base_q_point_pod`、`base_moon_dumpster_pod`、`base_juice_bar_pod`。
- 已核对 PR90 随包资源：`public/assets/i18n/en/smashup` 下包含龙族 POD、超级英雄 POD、魔法少女 POD、超级战队 POD 的英文卡牌图，但没有这 8 个基地对应的英文 POD 基地整图。
- 继续沿用“不虚构不存在的 atlas 槽位”的规则；在真实基地美术到位前，这 8 个基地先记录为文字 fallback POD 基地。
