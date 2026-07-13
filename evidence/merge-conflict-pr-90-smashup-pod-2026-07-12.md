# 冲突解决汇报：PR #90 合并 main

## 1. 背景

- 日期：2026-07-12
- PR：#90「实装 Smash Up 四套 POD 派系与卡图资源」
- base：`main` / `0abc741538ff2f14add57a466d7fd721943a3498`（已合入漫威第一波四派系）
- head：`codex/upstream-main-dev-20260707` / `ae0717fc3677cb16c44c48eb2eaee66d57890364`
- 合并提交：`62c3b98c5208bdc130ac51410afc1b208c3a14b5`
- 触发动作：在隔离 worktree 中把 PR #90 头提交合入最新 `origin/main`，解决冲突后推回原 PR head 分支。
- 合并目标：保留 main 已合入的漫威第一波四派系、Pretty Pretty POD 相关入口，同时补入 PR #90 的龙族 POD、超级英雄 POD、魔法少女 POD、超级战队 POD 卡图资源、卡牌定义、能力实现、双语文案和验证覆盖。

## 2. 冲突文件

Git 合并过程产生真实冲突的文件：

- `public/assets/i18n/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/ui/factionMeta.ts`

pre-push 门禁对 merge commit 做双侧重叠改动审计，识别到 9 个混合结果文件：

- `public/assets/i18n/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/variantBindings.ts`
- `src/games/smashup/ui/cardAtlas.ts`
- `src/games/smashup/ui/factionMeta.ts`

## 3. 解决策略

- 资源清单：以 main 现有资源 hash 和条目为准，只补入 PR #90 新增的四套 POD 卡图 PNG/WebP 条目，避免覆盖 main 已有 DiceThrone 与其他游戏资源记录。
- 双语文案：以 main 已有 key 的当前文案为准，只补入 PR #90 新增的四套 POD 派系、卡牌和超级战队 POD 交互文案；已有 Pretty Pretty POD 文案不被 PR 单边覆盖。
- 卡牌注册：保留 main 已合入的复仇者、神盾局、蜘蛛宇宙、终极战队注册，同时补入 PR #90 的超级英雄 POD 注册；龙族 POD、魔法少女 POD、超级战队 POD 的 PR 侧注册也保留。
- 图集注册：保留 main 的 Pretty Pretty POD 与漫威图集，同时补入 PR #90 实际随资源入库的四套 POD 图集；没有随本 PR 入库的其他 POD 图集和基地图集不在本次冲突中补进，避免产生缺资源入口。
- 阵营元数据：保留 main 的漫威四派系展示入口，同时补入 PR #90 的龙族 POD、超级英雄 POD、魔法少女 POD、超级战队 POD 展示入口。
- 运行时缺口：根据本次合并后的验证失败，补齐 POD 共享持续效果别名、四套 POD 图集常量、超级战队 POD 独立变体规则、计分前特殊能力任意基地来源校验、红骑士 POD 第二个己方泰坦条件，以及欧米伽协议 POD 临界点修正。

## 4. 风险与验证

### 已执行

- `git diff --check`：通过。
- `npx vitest run src/games/smashup/__tests__/dragonsSuperheroesMagicalGirlsMegaTroopersPodIntegration.test.ts src/games/smashup/__tests__/abilities/mega-troopers.test.ts`：通过，2 个测试文件、49 个测试全部通过。
- `npm run i18n:check`：命令退出码 0；仍报告 22 条 DiceThrone `DiceTray.tsx` 命名空间歧义警告，属于既有非本 PR Smash Up 范围问题，本次未修改。
- commit hook：`lint-staged` 与 `typecheck` 已在提交 `62c3b98c5208bdc130ac51410afc1b208c3a14b5` 时通过。

### 待执行

- 补记本审计文档后重新提交并执行 `git push`，由 pre-push 门禁重新校验 merge evidence。

## 5. 结果

- 本次冲突不是单边取舍；已把 main 的漫威/Pretty Pretty POD 内容和 PR #90 的四套 POD 内容做双边保留。
- 已避免引入没有实际资源文件支撑的图集入口。
- Smash Up 相关新增 POD 接入和超级战队 POD 行为已用专项测试覆盖。
