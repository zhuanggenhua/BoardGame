# PR #86 圣骑士与主线合并审计记录（2026-07-10）

## 背景

- 原始 PR：`#86 接入 SmashUp 圣骑士 DIY 派系`
- 目标分支：`main`
- PR 原 head：`f3b2ff2679444315e29bc145d91ed3817935cac8`
- 合入的主线提交：`244eeb65477c5b5b258eec711f69fe2d3ffd88c4`
- 共同父提交：`d6518bc5506eff138cdf4540d89ad52802d88b33`
- merge commit：`4fa5156d5afa6531c3ab826b26ade0898bc23fb8`
- 说明：在隔离临时 clone 的 detached HEAD 中把最新 `main` 合入 PR head，再把结果推回原 PR 分支。没有切换或修改用户当前主工作区。

## 双侧内容范围

PR 一侧新增圣骑士（Paladins）DIY 派系：

- 圣骑士随从、战术、基地与神圣炽天使泰坦的数据和能力注册。
- 圣骑士卡牌、基地、泰坦图集标识与派系选择元数据。
- 圣骑士中英文文案。

主线一侧新增三套 POD 派系：

- 鲨鱼 POD、龙卷风 POD、全明星 POD 的卡牌数据。
- 三套 POD 图集标识、派系标识与派系选择元数据。
- 三套 POD 中英文文案及全明星能力注册。

## 双侧重叠文件与解决结果

1. `public/locales/en/game-smashup.json`
   - 双方修改了同一份英文资源文件，但新增键空间不同。
   - 最终同时保留 `paladins_*`、`base_paladins_*` 与 `sharks_*_pod`、`tornados_*_pod`、`all_stars_*_pod` 文案。
2. `public/locales/zh-CN/game-smashup.json`
   - 双方修改了同一份中文资源文件，但新增键空间不同。
   - 最终同时保留圣骑士及三套 POD 文案；圣骑士力量术语统一为“力量 / +1 力量指示物”。
3. `src/games/smashup/abilities/index.ts`
   - 保留 PR 一侧的 `registerPaladinAbilities()`。
   - 保留主线一侧的 `registerAllStarsAbilities()`。
4. `src/games/smashup/data/cards.ts`
   - 保留圣骑士卡牌与两张圣骑士基地注册。
   - 保留鲨鱼 POD、龙卷风 POD、全明星 POD 卡牌注册。
5. `src/games/smashup/domain/atlasCatalog.ts`
   - 保留圣骑士卡牌、基地、神圣炽天使三套图集。
   - 保留鲨鱼 POD、龙卷风 POD、全明星 POD 三套图集。
6. `src/games/smashup/domain/ids.ts`
   - 保留 `PALADINS` 及三项圣骑士图集标识。
   - 保留 `SHARKS_POD`、`TORNADOS_POD`、`ALL_STARS_POD` 及对应图集标识。
7. `src/games/smashup/ui/factionMeta.ts`
   - 保留圣骑士中文名、图标、颜色、描述和 DIY 扩展标记。
   - 保留鲨鱼 POD、龙卷风 POD、全明星 POD 的中文名与派系选择元数据。

其中只有两份本地化 JSON 出现 Git 文本冲突；逐键三方核对后，没有发现同一个键在双方被改成不同值。其余五个文件由 Git 自动合并，但仍逐项检查了双方新增注册，最终结果没有整份采用任一父提交，也没有丢弃单边独有内容。

## 额外修复

- 神圣炽天使加入活动泰坦清单，总数同步为 33。
- `playSeraphimHere` 的参数类型补入比赛状态。
- “神兵天降”改为只由 `MINION_PLAYED` 事件把额外随从写入核心状态，避免临时状态与事件重复落地。
- 对应测试改为精确断言额外随从只出现一次。
- 根级资源清单补入圣骑士卡牌、基地和神圣炽天使三条运行时压缩资源。

## 验证

- `npm run typecheck`
  - 结果：通过。
- `npm run i18n:check`
  - 结果：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/paladins.test.ts`
  - 结果：3 个文件、265 条测试通过。
- `npm run assets:validate -- --id i18n/zh-CN/smashup`
  - 结果：通过。
- ESLint
  - 结果：0 个错误；仅保留 `smashup.smoke.test.ts` 一条既有未使用变量警告。
- `git diff --check origin/main`
  - 结果：通过。

## 结果

- 双方独有内容均有明确落点，没有用“保留一侧、覆盖另一侧”的方式解决重叠文件。
- 本记录作为 merge commit `4fa5156d5afa6531c3ab826b26ade0898bc23fb8` 的紧跟补记提交，用于重新触发 PR 质量门。
