# PR #119 远端重复提交归并审计

## 1. 背景

- 目标 PR：#119《实现哥布林与圆桌骑士派系》
- 目标分支：`codex/smashup-goblins-round-table-knights-only`
- 本地父提交：`caafaac7c0ee8f831884478de3064ff8c343e48f`
- 远端新增提交：`a99a0e0fbdd969c4fa523b360bbf3a80c8e4d972`
- 归并提交：`9f977e79fa23852b736d1ce620c10c8fb6153cec`
- 触发命令：`git merge deathcats4/codex/smashup-goblins-round-table-knights-only --no-commit --no-ff`

本次远端新增提交是同一轮“唯一合法目标仍需显式确认”测试与规范同步提交的另一份提交哈希。远端分支在本地推送重试期间先到达该提交，因此不能强制覆盖，改为正常归并。

## 2. 重叠文件

内容级审计识别到 2 个双方都修改的文件：

- `openspec/specs/smashup-ability-runtime/spec.md`
- `src/games/smashup/__tests__/abilities/kaiju.test.ts`

两份文件在双方归并结果中与两侧内容相同，没有一侧覆盖另一侧的差异。

## 3. 归并裁决

### `openspec/specs/smashup-ability-runtime/spec.md`

- 双方含义：都增加“玩家规则语义要求选择目标时，即使只有一个合法目标，也要保留独立目标交互”的通用规范。
- 裁决：保留归并结果，内容与双方相同。
- 风险：若误判，可能丢失 Smash Up 单一合法目标的显式确认契约；本次没有丢失。

### `src/games/smashup/__tests__/abilities/kaiju.test.ts`

- 双方含义：都让 Kaiju Johnny 的唯一基地额外行动测试先选择行动牌，再选择唯一基地目标。
- 裁决：保留归并结果，内容与双方相同。
- 风险：若误判，测试会继续把“选行动牌”错误当成完整结算，无法覆盖当前主线交互；本次没有丢失。

### 其他有效内容

- 本地父提交独有的 `src/games/smashup/domain/extraPlay.ts` 主线同步保留在归并结果中：移除唯一目标自动执行，并清理同步过程中暴露的无用 `MinionOnBase` 导入。
- 远端提交没有独有的业务实现或资源内容；它与本地同轮测试/规范内容重复，因此没有放弃任何单边功能。

## 4. 验证

- 自动归并：无文本冲突。
- 《大杀四方》国际事件测试：42/42 通过。
- Kaiju 测试：18/18 通过。
- 两组定向测试合计：60/60 通过。
- OpenSpec 全量严格校验：191/191 通过。
- 本地增量质量门：编码、测试结构、类型检查、ESLint warning 增量、构建和 i18n 均通过。
- 质量门当前唯一阻塞：要求 merge commit 具备本审计文档；不是业务测试失败。

## 5. 结果

- 归并提交：`9f977e79fa23852b736d1ce620c10c8fb6153cec`
- 补记提交：`f083da2d9f5a91b6d1d6d1b51d19a4290d1f667d`
- 推送目标：`deathcats4/BoardGame` 的 `codex/smashup-goblins-round-table-knights-only`
