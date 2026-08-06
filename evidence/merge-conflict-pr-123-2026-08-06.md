# PR #123 冲突解决与有效改动提取记录

## 1. 背景

- PR：`#123`，开放半场战争四派系发布状态
- 主线基线：`e03b9820e941788be67671de51db26d1e3bddd5c`
- PR head：`ae794039c9ab93eaa0e589f0e3b64c06be849305`
- 共同祖先：`372924c468a28cecc877e0d1b3d794c5f20cfeea`
- 触发命令：`git merge --no-commit --no-ff ae794039c9ab93eaa0e589f0e3b64c06be849305`

PR 相对共同祖先只有 3 个文件的有意修改，没有真实文件删除。主线从共同祖先之后继续合入了 20 个提交；主线独有的文件和代码差异属于版本漂移，不作为 PR 删除处理。

## 2. 冲突与块级裁决

### `src/games/smashup/domain/ids.ts`

- 共同祖先和 PR head 的实施中集合包含四个半场战争派系，以及 Munchkin 派系。
- 当前主线在共同祖先之后又保留了四个半场战争派系，并新增圆桌骑士、哥布林实施中状态。
- PR 的真实意图是移除四个半场战争派系的实施中状态；合并结果因此保留主线的圆桌骑士、哥布林和 Munchkin 状态，只删除：忍者神龟、特种部队杰拉尔德、宇宙的巨人希曼、珍珠和幻像四项。
- 未接受 PR 旧文件的整份内容，避免丢失主线后续新增的实施中派系。

### `src/games/smashup/ui/factionMeta.ts`

- 该文件自动合并成功，但仍按 PR delta 审查，确认只移除四个半场战争派系的 `implementationStatus: 'in_progress'`。
- 四个派系的名称、图标、颜色、描述 key 和其它派系元数据均保留；主线其它派系的实施中状态未改变。

### `src/games/smashup/__tests__/halfTheBattleFactionIntake.test.ts`

- 保留 PR 新增的发布状态断言：四个派系进入中文可见列表，领域实施中判断和 UI 实施中判断均为 false。
- 原有卡牌、基地、图集、locale 和 manifest 合同断言继续保留。

## 3. 业务真相与规范同步

- `openspec/changes/add-smashup-half-the-battle-factions/specs/smashup-faction-registry/spec.md` 记录的对象级玩法、真实入口 E2E 和收口证据已在 `evidence/smashup/2026-07-28-half-the-battle-gameplay-representative-validation.md` 中完成登记。
- PR #123 是业务发布状态更新，不是测试放宽；合并后同步 OpenSpec 的实施中/发布状态要求，避免规范仍把已发布四派系描述为实施中。

## 4. 风险与验证

- 主要风险：若误删主线新增状态，会让圆桌骑士、哥布林或 Munchkin 被错误地标记为可发布；三方结果已保留这些状态。
- 定向测试：`halfTheBattleFactionIntake.test.ts`，13/13 通过。
- TypeScript：`npm run typecheck` 通过。
- ESLint：`ids.ts`、`factionMeta.ts` 和 intake 测试 0 errors。
- 合并后单边审计和 pre-push 结果在最终提交后补记。

## 5. 结果

- 合并提交：当前隔离 worktree 的 merge commit。
- 推送目标：远端 `main`。
