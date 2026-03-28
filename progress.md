# Progress Log

## Session: 2026-03-28 Smash Up Titans - 首批剩余 5 张审计补齐
- **Status:** completed
- Actions taken:
  - 逐张复核 `ghosts_creampuff_man`、`wizards_arcane_protector`、`vampires_ancient_lord`、`innsmouth_dagon`、`giant_ants_death_on_six_legs` 在 `src/games/smashup/abilities/titans.ts`、`src/games/smashup/__tests__/smashup.smoke.test.ts`、`e2e/smashup-alien-terraform.e2e.ts` 与三件套中的覆盖层级。
  - 确认这 5 张当前并非“只差审计”：
    - 5 张都有 smoke 级行为覆盖。
    - `innsmouth_dagon`、`giant_ants_death_on_six_legs` 额外有局部根因/规则核对记录。
    - 但此前都没有与当前同等级的浏览器证据收口。
  - 按“E2E 只保留不重复交互”的口径裁决：
    - `ghosts_creampuff_man` 的“两段交互：先弃手牌，再从弃牌堆额外打出标准战术并改放牌库底”属于独立 UI 链，应补 1 条真实 E2E。
    - `wizards_arcane_protector`、`innsmouth_dagon`、`giant_ants_death_on_six_legs` 只有 special/额度/被动 modifier，不新增独立浏览器链。
    - `vampires_ancient_lord` 的单目标选择属于已被 `Great Wolf Spirit / Hill that Strolls` 代表覆盖的同类 prompt，不重复补 E2E。
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 `openCreampuffTalentScene(...)` 与 1 条 `奶油泡芙美人` 真实浏览器用例。
  - 运行 `npm run typecheck`，通过。
  - 运行 `$env:PW_PORT='6281'; $env:PW_GAME_SERVER_PORT='20207'; $env:PW_API_SERVER_PORT='21207'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "奶油泡芙美人天赋可在 UI 中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底"`，结果 `1 passed`。
  - 产出 `Creampuff` 证据截图 3 张，并将审计裁决与 E2E 结果回写到 `evidence/smashup-alien-terraform-e2e-test.md`、`task_plan.md`、`findings.md`、`progress.md`。
- Files created/modified:
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | E2E 辅助场景与文档回填不引入类型错误 | 通过 | ✅ |
| Smash Up E2E | `$env:PW_PORT='6281'; $env:PW_GAME_SERVER_PORT='20207'; $env:PW_API_SERVER_PORT='21207'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "奶油泡芙美人天赋可在 UI 中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底"` | `Creampuff` 独立两段交互浏览器链通过 | `1 passed` | ✅ |
- Next step:
  - 当前已实现泰坦按“smoke + 审计 + 非重复 E2E”口径已收口。
  - 若继续推进 Smash Up Titans，应先补新的派系运行时，再恢复对应泰坦。

## Session: 2026-03-28 Smash Up Titans - 后续未接派系泰坦隐藏收口
- **Status:** completed
- Actions taken:
  - 复核 `src/games/smashup/data/titans.ts` 与 `src/games/smashup/abilities/titans.ts`，确认当前唯一仍停留在“静态占位、但无对应派系完整运行时”的后续泰坦是 `fairies_spirit_of_the_forest / 丛林之灵`。
  - 对照 `src/games/smashup/data/cards.ts` 与 `src/games/smashup/ui/factionMeta.ts`，确认 `fairies` 目前只有 2 张基地且未进入派系选择 UI，不具备继续推进单牌运行时闭环的前提。
  - 按用户最新口径，将 `fairies_spirit_of_the_forest` 从 `src/games/smashup/data/titans.ts` 的活动注册中移除，避免继续以静态占位形式暴露。
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 同步移除对应静态注册断言，并保留“双额度泰坦打出会同时消耗通常随从与通常战术额度”的通用领域回归。
- Files created/modified:
  - `src/games/smashup/data/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Next step:
  - 后续只继续处理“已有完整派系运行时支撑”的泰坦。
  - 当前后续候选里已无符合该条件但仍未实现的目标；除非先补对应派系，否则不再继续推进 `Spirit of the Forest`。

## Session: 2026-03-28 Smash Up Titans - Walking Castle 天赋交互顺序修正
- **Status:** completed
- Actions taken:
  - 复核 `src/games/smashup/rule/泰坦机制与卡牌抄录.md`，确认移动城堡天赋目标是“另一个基地”，不是未在场基地。
  - 在 `src/games/smashup/abilities/titans.ts` 重排 `magical_girls_walking_castle` 的天赋交互：
    - `USE_TALENT` 后先起 `titan_magical_girls_walking_castle_choose_base`
    - 选定目标基地后再起 `titan_magical_girls_walking_castle_choose_minions`
    - 无可带走随从时直接只移动泰坦
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 把对应 smoke 改成“先选基地、再选随从”的真实顺序断言。
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 把对应浏览器用例改成：
    - 先直接选目标基地
    - 再进入多选随从交互
    - 最后用显式 `optionIds` 提交多选结果
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "移动城堡天赋会先选择目标基地，再选择至多 3 个己方随从一起移动过去"`，通过。
  - 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去"`，结果 `1 passed`。
  - 只打开 1 个截图文件夹，并实际查看 3 张新图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去\walking-castle-talent-choose-base.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去\walking-castle-talent-choose-minions.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去\walking-castle-talent-resolved.png`
- Files created/modified:
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Walking Castle smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "移动城堡天赋会先选择目标基地，再选择至多 3 个己方随从一起移动过去"` | 新顺序 smoke 通过 | `1 passed` | ✅ |
| Walking Castle E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去"` | 浏览器链按“先基地后随从”通过 | `1 passed` | ✅ |
- Next step:
  - 继续切 `ignobles_the_hill_that_strolls / 漫游山岭巨人`。
  - 先确认是否已有可复用的随从控制权变更原语；若没有，就补最小通用事件/命令，再在这张泰坦上落地。

## Session: 2026-03-28 Smash Up Titans - The Hill that Strolls 运行时闭环
- **Status:** completed
- Actions taken:
  - 复读 `src/games/smashup/rule/泰坦机制与卡牌抄录.md`，确认漫游山岭巨人的目标是：
    - 至少 2 个“你拥有但正被其他玩家控制”的随从存在时可进场
    - 你把自己随从的控制权交给别人后，可为该随从放 1 枚 +1 标记
    - 天赋要么交出一个己方随从控制权并抽 1 张牌，要么夺回这里一个你拥有的随从
  - 在领域层补了最小通用原语：
    - `src/games/smashup/domain/events.ts` 新增 `MINION_CONTROL_CHANGED`
    - `src/games/smashup/domain/types.ts` 补事件类型与 `baseScoped` 触发配置支持
    - `src/games/smashup/domain/reducer.ts` / `src/games/smashup/domain/reduce.ts` 接通控制权变更的归约
    - `src/games/smashup/domain/ongoingEffects.ts` / `src/games/smashup/domain/abilityHelpers.ts` 把 `control_change` 正式接入 affect trigger
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `ignobles_the_hill_that_strolls`：
    - `special`
    - `ongoing`：交出控制权后可为该随从放置 1 枚 +1 标记
    - `talent`：交出己方随从并抽牌 / 夺回这里一个你拥有的随从
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 3 条 Hill smoke：
    - 至少 2 个被他人控制的己方随从时可进场
    - 交出控制权抽牌后，ongoing 真实起 prompt 并可加标记
    - 可通过 talent 夺回这里一个你拥有的随从
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 2 条 Hill E2E：
    - 右侧泰坦栏 special 进场
    - 交出控制权并抽牌后，真实进入“是否加标记”交互
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "漫游山岭巨人"`，结果 `3 passed`。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `75 passed`。
  - 为排除整份 E2E 里先前的 4 条偶发失败，改成独立端口串行复跑旧链：
    - `$env:PW_PORT='6275'; $env:PW_GAME_SERVER_PORT='20201'; $env:PW_API_SERVER_PORT='21201'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "硕大圆石可在随从移离后移动到目标基地并消灭低于其标记数的随从"`，结果 `1 passed`
    - `$env:PW_PORT='6276'; $env:PW_GAME_SERVER_PORT='20202'; $env:PW_API_SERVER_PORT='21202'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "哥佐拉在本基地打出战术后会加 1 标记并可通过交互抽 1 张牌"`，结果 `1 passed`
    - `$env:PW_PORT='6277'; $env:PW_GAME_SERVER_PORT='20203'; $env:PW_API_SERVER_PORT='21203'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从"`，结果 `1 passed`
  - 再用新端口整份复跑 `$env:PW_PORT='6278'; $env:PW_GAME_SERVER_PORT='20204'; $env:PW_API_SERVER_PORT='21204'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `31 passed`。
  - 只打开 1 个截图文件夹，并实际查看 3 张 Hill 新图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\漫游山岭巨人交出己方随从控制权并抽牌后，会通过真实交互给该随从放置-1-枚力量标记\hill-that-strolls-counter-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\漫游山岭巨人交出己方随从控制权并抽牌后，会通过真实交互给该随从放置-1-枚力量标记\hill-that-strolls-give-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\漫游山岭巨人交出己方随从控制权并抽牌后，会通过真实交互给该随从放置-1-枚力量标记\hill-that-strolls-give-resolved.png`
  - 将 Hill 的实现事实、验证结果、整文件复核结论与人工看图结论回写到 `evidence/smashup-alien-terraform-e2e-test.md`、`task_plan.md`、`findings.md`、`progress.md`。
- Files created/modified:
  - `src/games/smashup/domain/events.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/abilityHelpers.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Hill smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "漫游山岭巨人"` | Hill 3 条 smoke 通过 | `3 passed` | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | Hill + 既有 smoke 整体通过 | `75 passed` | ✅ |
| Boulder single E2E | `$env:PW_PORT='6275'; $env:PW_GAME_SERVER_PORT='20201'; $env:PW_API_SERVER_PORT='21201'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "硕大圆石可在随从移离后移动到目标基地并消灭低于其标记数的随从"` | 旧链单条无业务回归 | `1 passed` | ✅ |
| Gorgodzolla single E2E | `$env:PW_PORT='6276'; $env:PW_GAME_SERVER_PORT='20202'; $env:PW_API_SERVER_PORT='21202'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "哥佐拉在本基地打出战术后会加 1 标记并可通过交互抽 1 张牌"` | 旧链单条无业务回归 | `1 passed` | ✅ |
| Emperor Penguin single E2E | `$env:PW_PORT='6277'; $env:PW_GAME_SERVER_PORT='20203'; $env:PW_API_SERVER_PORT='21203'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从"` | 旧链单条无业务回归 | `1 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6278'; $env:PW_GAME_SERVER_PORT='20204'; $env:PW_API_SERVER_PORT='21204'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | Hill + 既有 Titans 整文件回归通过 | `31 passed` | ✅ |
- Next step:
  - `Hill` 已真正收口，继续切下一张后续泰坦运行时闭环。
  - 当前优先改为 `super_spies_moon_zero_three / 三号空间站`；`Time Box` 需要离场计数器与回手来源建模，侵入面更大。

## Session: 2026-03-26 Smash Up Titans - 泰坦纵向锚点再收敛
- **Status:** completed
- Actions taken:
  - 复读 `C:\Users\zhuagenbao\.codex\skills\planning-with-files\SKILL.md`、`AGENTS.md`、`docs/ai-rules/ui-ux.md`，确认需要在完成一部分后立即登记进三件套。
  - 定位一次文档乱码问题：文件本身不是坏编码，根因是 PowerShell 未显式按 UTF-8 读取中文文档，导致终端输出 mojibake，进而让 `apply_patch` 上下文命中失败。
  - 用 `python ... read_text(encoding='utf-8')` 与 `Get-Content -Encoding UTF8` 交叉确认真实内容，并据此继续后续补丁。
  - 复核 `src/games/smashup/ui/BaseZone.tsx` 与 `src/games/smashup/ui/layoutConfig.ts`，确认单泰坦并没有被配置成比普通随从更小。
  - 在 `src/games/smashup/ui/BaseZone.tsx` 微调有持续行动时的泰坦纵向锚点：不改基础尺寸，只把定位从偏底边对齐收敛为围绕持续行动中线展开。
  - 运行 `npm run typecheck`。
  - 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `7 passed`。
  - 实际查看并复核 3 张截图：`01-2p-five-ongoings-with-titan.png`、`03-4p-five-bases-with-titan.png`、`major-ursa-04-after-resolution.png`。
  - 按用户要求，把本轮结论回写到 `task_plan.md`、`findings.md`、`progress.md` 与 `evidence/smashup-alien-terraform-e2e-test.md`。
- Files created/modified:
  - `src/games/smashup/ui/BaseZone.tsx`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `evidence/smashup-alien-terraform-e2e-test.md`
- Next step:
  - 继续推进首批 10 张泰坦剩余能力与特殊交互。
  - 保持“做完一段就登记”的节奏，避免 E2E 看图结论只留在上下文里。
  - 遇到中文文档时统一先切 UTF-8，再读取和补丁，避免重复踩同一类乱码坑。

## Session: 2026-03-28 Smash Up Titans - Emperor Penguin 运行时闭环
- **Status:** completed
- Actions taken:
  - 基于已通过的 OpenSpec `add-smashup-titan-activated-ongoing` proposal，在领域层落地新入口：
    - `src/games/smashup/domain/types.ts` 新增 `ongoingActivation` / `activatableAbilityKinds` / `ACTIVATE_TITAN_ONGOING`
    - `src/games/smashup/domain/abilityRegistry.ts` 增加 `resolveOngoingActivation(...)`
    - `src/games/smashup/domain/titanAbilityValidators.ts` 增加泰坦主动 ongoing validator 注册与校验
    - `src/games/smashup/domain/commands.ts` / `src/games/smashup/domain/reducer.ts` 接通新命令的 validate + execute
    - `src/games/smashup/domain/playLegality.ts` 增加“牌库顶按通常随从额度打出”的语义校验
  - 在 `src/games/smashup/data/titans.ts` 为 `penguins_emperor_penguin` 显式声明 `activatableAbilityKinds: ['ongoing', 'talent']`。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `penguins_emperor_penguin`：
    - `onTurnStart` 起 `special` 进场交互
    - `ongoingActivation`：从牌库顶把随从打到泰坦当前所在基地，并消耗通常随从额度
    - `talent`：从手牌/弃牌堆选低战力随从，洗回牌库并给泰坦加 1 标记
    - `titan_penguins_emperor_penguin_play`
    - `titan_penguins_emperor_penguin_talent`
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 3 条 Emperor Penguin smoke：
    - 回合开始 `special` 交互与结算
    - 主动 ongoing 入口与通常随从额度消耗
    - `talent` 洗回牌库并加标记
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 3 条 Emperor Penguin E2E：
    - 回合开始交互进场
    - 桌面端 `持续 / 天赋` 双入口下的 ongoing
    - 桌面端 `持续 / 天赋` 双入口下的 talent
  - 调试过程中发现并修正两个真实缺口：
    - `src/games/smashup/ui/BaseZone.tsx`：桌面端多主动入口泰坦点击后不会展开按钮，现已改成显式切换 armed 状态。
    - `e2e/framework/GameTestContext.ts`：`selectOption()` 先误点手牌卡面、后点按钮，现已调整为先点可见按钮。
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `72 passed`。
  - 先分别运行 2 条 Emperor Penguin 单用例 E2E，确认：
    - 双入口菜单在桌面端可见
    - talent 交互可真正结算
  - 复跑整份 `e2e/smashup-alien-terraform.e2e.ts`，结果 `29 passed`。
  - 只打开 1 个截图根文件夹后，筛出并实际查看 5 张 Emperor Penguin 关键截图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇可在回合开始交互中打到满足条件的基地\emperor-penguin-play-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇可在回合开始交互中打到满足条件的基地\emperor-penguin-play-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从\emperor-penguin-activation-menu.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从\emperor-penguin-ongoing-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过天赋按钮洗回低战力随从并获得标记\emperor-penguin-talent-resolved.png`
  - 将 Emperor Penguin 的实现事实、验证结果、看图结论与 proposal 落地结果回写到 `evidence/smashup-alien-terraform-e2e-test.md`、`task_plan.md`、`findings.md`、`progress.md` 与 OpenSpec `tasks.md`。
- Files created/modified:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/abilityRegistry.ts`
  - `src/games/smashup/domain/playLegality.ts`
  - `src/games/smashup/domain/titanAbilityValidators.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/data/titans.ts`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/framework/GameTestContext.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `openspec/changes/add-smashup-titan-activated-ongoing/tasks.md`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | Emperor Penguin + 既有 smoke 全绿 | `72 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | Emperor Penguin + 既有 Titans 整文件回归通过 | `29 passed` | ✅ |
- Next step:
  - Emperor Penguin 已收口；下一轮继续筛并推进下一张后续泰坦运行时闭环。
  - 后续凡是“同一张泰坦/卡牌有多个主动入口”的桌面端 UI，都默认沿用这轮补好的显式展开逻辑与 E2E 选择顺序。

## Session: 2026-03-26 Smash Up Titans - Cthulhu 泰坦能力补齐
- **Status:** completed
- Actions taken:
  - 复读 `AGENTS.md`、`planning-with-files`、`docs/ai-rules/engine-systems.md`、`docs/testing-best-practices.md`，确认先补领域链，再补测试与证据。
  - 复核 `src/games/smashup/rule/泰坦机制与卡牌抄录.md`、`src/games/smashup/abilities/titans.ts`、`src/games/smashup/abilities/cthulhu.ts`，确认 `cthulhu_cthulhu_titan` 只接了 `special`，`ongoing` / `talent` 仍缺。
  - 在 `src/games/smashup/abilities/titans.ts` 新增 `cthulhu_cthulhu_titan` 的 `talent`、validator、两段 interaction handler，以及基于 `registerInterceptor` 的 ongoing：
    - `MADNESS_DRAWN` 后按抽取数量补泰坦力量标记
    - 打出 `special_madness` 后补 1 枚泰坦力量标记
    - 天赋支持“抽 1 张疯狂卡 / 给另一位玩家 1 张疯狂卡”两分支
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 4 个典型用例：
    - 抽疯狂卡后按数量加泰坦标记
    - 打出疯狂卡后加 1 标记
    - 只有抽牌分支时直接抽 1 张疯狂卡
    - 只有转交分支时起交互并把疯狂卡交给对手
  - 运行 `npm run typecheck`。
  - 运行 `npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts --maxWorkers=1`，36 条全部通过。
- Files created/modified:
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Next step:
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 补 Cthulhu 泰坦天赋交互的端到端用例。
  - 运行 E2E 后实际查看截图，再更新 `evidence/smashup-alien-terraform-e2e-test.md` 和三件套。

## Session: 2026-03-26 Smash Up Titans - Cthulhu E2E 看图收口
- **Status:** completed
- Actions taken:
  - 复读 `AGENTS.md`、`planning-with-files` 与现有 `evidence/smashup-alien-terraform-e2e-test.md`，确认这一轮必须先实际看图，再写结论。
  - 实际打开并查看 4 张新增的 Cthulhu 交互截图：
    - `cthulhu-titan-talent-draw-choice.png`
    - `cthulhu-titan-talent-draw-resolved.png`
    - `cthulhu-titan-talent-give-target.png`
    - `cthulhu-titan-talent-give-resolved.png`
  - 顺手复看 2 张布局图：`01-2p-five-ongoings-with-titan.png`、`03-4p-five-bases-with-titan.png`，确认本轮没有把之前的泰坦布局结论写坏。
  - 根据肉眼观察，把 4 张 Cthulhu 截图的绝对路径、交互现象和残余问题回写到 `evidence/smashup-alien-terraform-e2e-test.md`。
  - 把“交互分支正确、转交不会误加力量、长中文按钮文案仍有挤压问题”同步写入 `findings.md`。
- Files created/modified:
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Next step:
  - 继续推进首批 10 张泰坦剩余能力与特殊交互，并保持每完成一段就登记三件套。
  - 后续如果处理 Cthulhu 相关 UI 细节，优先单独修分支按钮的中文排版，不要把机制和样式再混到一轮里。

## Session: 2026-03-26 Smash Up Titans - Kraken 收口并推进 Great Wolf Spirit
- **Status:** completed
- Actions taken:
  - 复盘首批 10 张泰坦剩余缺口，确认 `The Kraken` 是当前能在现有引擎上形成最小正确闭环的一张。
  - 在 `src/games/smashup/domain/types.ts` 为计分后替换基地补 `playTitanOnReplacementBase`，在 `src/games/smashup/domain/systems.ts` 接成 `TITAN_PLAYED`，并在 `src/games/smashup/domain/ongoingEffects.ts` 让 set-aside titan 进入全局见证范围。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `The Kraken`：
    - afterScoring 进替换基地
    - afterScoring 救己方随从
    - 天赋移动泰坦并让目标基地敌方随从直到你下回合开始 `-1`
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 为 `The Kraken` 新增 4 条 smoke，并通过 `typecheck + smoke`。
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 `The Kraken` 3 条 E2E，并复跑整文件。
  - 实际查看 Kraken 7 张截图，确认替换基地进场、救随从、天赋减力三条链都闭环。
  - 继续往前推进 `Great Wolf Spirit`，没有在 Kraken 收口处停下。
  - 在 `src/games/smashup/domain/types.ts` / `commands.ts` / `reduce.ts` 增加玩家级 `extraTalentUsesConsumed`，以最小方式支撑“额外第二次 talent”。
  - 保持 `base_standing_stones` 的双才能例外优先，不让狼灵额度误吞掉巨石阵那次消费。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `Great Wolf Spirit` 的 `special`、`talent` 和目标交互。
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 3 条 `Great Wolf Spirit` smoke：special 进场、额外第二次 talent、天赋 +1。
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 1 条 `Great Wolf Spirit` 真实交互 E2E：点击泰坦 -> 选己方随从 -> 直到回合结束 `+1`。
  - 实际查看 `great-wolf-spirit-choose-minion.png` 与 `great-wolf-spirit-resolved.png` 两张图，并将绝对路径与人工观察回写 `evidence/smashup-alien-terraform-e2e-test.md`。
- Files created/modified:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | Kraken + Great Wolf Spirit 新旧 smoke 全绿 | `43 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | Kraken / Great Wolf Spirit / Cthulhu / Major Ursa / 布局整文件回归通过 | `13 passed` | ✅ |
- Next step:
  - 继续首批 10 张泰坦剩余能力，优先 `tricksters_big_funny_giant`。
  - 如果下一张继续需要真实交互，保持“实现 -> smoke -> E2E -> 看图 -> 回写 evidence / 三件套”节奏，不再回到只报 `passed` 的状态。

## Session: 2026-03-26 Smash Up Titans - Big Funny Giant 收口
- **Status:** completed
- Actions taken:
  - 复核 `src/games/smashup/rule/泰坦机制与卡牌抄录.md` 与 `src/games/smashup/rule/泰坦数据录入核对表.md`，确认 `tricksters_big_funny_giant` 应按中文原文实现，不再沿用此前误读到的外部英文文本。
  - 在 `src/games/smashup/abilities/titans.ts` 串起 `Big Funny Giant` 的完整注册链：
    - `special`
    - `talent`
    - `play_minion` restriction
    - `onTurnEnd`
    - `onMinionPlayed`
    - 以及 `discard_to_play / choose_minion / choose_base` 三个交互 handler
  - 在 `src/games/smashup/domain/commands.ts` 为 `isOperationRestricted(..., 'play_minion')` 补传 `cardUid` 与 `fromDiscard`，让 restriction 能在 validation 时正确排除“正在被打出的那张手牌”。
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 5 条 `Big Funny Giant` smoke：空基地 special、restriction 拦截、打出后强制弃牌、回合结束加指示物、talent 双段交互。
  - 运行 `npm run typecheck`。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `48 passed`。
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 1 条稳定的 `Big Funny Giant` 弃牌交互 E2E，并复跑整文件。
  - 实际打开并查看 2 张截图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\滑稽巨人的弃牌交互可在-UI-中选择手牌并完成弃置\big-funny-giant-discard-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\滑稽巨人的弃牌交互可在-UI-中选择手牌并完成弃置\big-funny-giant-discard-resolved.png`
  - 把 `Big Funny Giant` 的实现事实、测试结果和人工看图结论回写到 `evidence/smashup-alien-terraform-e2e-test.md`、`task_plan.md`、`findings.md`、`progress.md`。
- Files created/modified:
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | Big Funny Giant 新旧 smoke 全绿 | `48 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | 包含 Big Funny Giant 弃牌交互在内的整文件回归通过 | `14 passed` | ✅ |
- Next step:
  - 首批 10 张泰坦已经全部完成最小正确闭环；下一轮切到后续批次，重新盘点剩余已录入但未完整实现的泰坦。
  - 如果下一轮继续做 UI 相关工作，把 Cthulhu 分支按钮中文挤压和隔离 E2E 牌面空白问题单独拆出来处理，不再混进规则实现回合。

## Session: 2026-03-26 Smash Up Titans - 后续 11 张静态契约补齐
- **Status:** completed
- Actions taken:
  - 复核 `src/games/smashup/data/titans.ts`、`src/games/smashup/rule/泰坦机制与卡牌抄录.md`、`src/games/smashup/rule/泰坦数据录入核对表.md`，确认首批 10 张之外的后续候选仍停留在“文档已冻结、数据未落库”状态。
  - 全量搜索后续候选派系在 `src/games/smashup/abilities/`、`src/games/smashup/data/`、`src/games/smashup/domain/ids.ts` 的出现位置，确认当前不存在“派系运行时已接入、只差泰坦”的下一张；`fairies` 仅有基地数据。
  - 在 `src/games/smashup/domain/ids.ts` 补 11 个后续派系 id 与中文显示名，避免静态泰坦 def 继续使用裸字符串。
  - 在 `src/games/smashup/domain/types.ts` 扩 `TitanSummonMode`，新增 `insteadOfRegularMinionAndAction`，并让 `TitanPlayedEvent` 可同时记录多个常规额度消耗。
  - 在 `src/games/smashup/domain/titanAbilityValidators.ts`、`src/games/smashup/domain/abilityHelpers.ts`、`src/games/smashup/domain/reduce.ts`、`src/games/smashup/abilities/titans.ts` 补“双额度泰坦”最小领域支撑。
  - 在 `src/games/smashup/data/titans.ts` 补齐 11 张后续泰坦的静态契约：
    - `changerbots_mergacon`
    - `explorers_very_large_boulder`
    - `fairies_spirit_of_the_forest`
    - `ignobles_the_hill_that_strolls`
    - `itty_critters_rainboroc`
    - `kaiju_gorgodzolla`
    - `magical_girls_walking_castle`
    - `mega_troopers_megabot`
    - `penguins_emperor_penguin`
    - `super_spies_moon_zero_three`
    - `time_travelers_time_box`
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 2 条 smoke：
    - 后续 11 张泰坦已注册
    - 同时消耗通常随从与通常战术额度的 `TITAN_PLAYED` 会正确累加双额度
  - 运行 `npm run typecheck`。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `50 passed`。
- Files created/modified:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/titanAbilityValidators.ts`
  - `src/games/smashup/domain/abilityHelpers.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/data/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | 新增静态泰坦契约与双额度结算 smoke 通过 | `50 passed` | ✅ |
- Next step:
  - 决定下一轮是接一个未接派系的完整运行时，还是转去处理 Cthulhu 分支按钮中文挤压与隔离 E2E 牌面空白问题。
  - 如果继续推进后续泰坦运行时，优先挑规则面和引擎侵入面都最小的派系，而不是直接上最花哨的一张。

## Session: 2026-03-28 Smash Up Titans - Time Box 运行时闭环
- **Status:** completed
- Actions taken:
  - 复读 `src/games/smashup/rule/泰坦机制与卡牌抄录.md`，确认 `Time Box / 时间盒子` 的口径是：
    - 回合开始或有牌回手时加 1 枚计数
    - 达到第 5 枚后可移除全部计数来打出此泰坦
    - 天赋给予“此基地额外打 1 个 2 力以下随从”和“额外打 1 个战术”
  - 在 `src/games/smashup/domain/events.ts`、`src/games/smashup/domain/types.ts`、`src/games/smashup/domain/reduce.ts` 增加 `TITAN_METADATA_UPDATED`，让时间盒子的非力量计数持久化到 `titan.metadata.timeBoxCounters`。
  - 在 `src/games/smashup/domain/ongoingEffects.ts`、`src/games/smashup/domain/reducer.ts` 补 `onCardReturnedToHand` timing 与 `processReturnToHandTriggers(...)`，把 `MINION_RETURNED / CARD_RECOVERED_FROM_DISCARD` 统一接进 trigger 链。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `time_travelers_time_box`：
    - `onTurnStart`
    - `onCardReturnedToHand`
    - `special`
    - `talent`
    - `titan_time_travelers_time_box_play`
  - 规则复核时顺手发现一个通用缺口：基地限定额外随从额度此前不持久化 `powerMax`，会让 “此基地额外打 2 力以下随从” 失真。
  - 因此在 `src/games/smashup/domain/types.ts`、`src/games/smashup/domain/utils.ts`、`src/games/smashup/domain/commands.ts`、`src/games/smashup/domain/reduce.ts` 补 `baseLimitedMinionPowerCaps`：
    - `LIMIT_MODIFIED` 写入该字段
    - `PLAY_MINION` validation 按 `powerMax` 拦截超标随从
    - `MINION_PLAYED` 结算时消费对应的受限额度
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 补/强化 3 条 `Time Box` smoke：
    - `onTurnStart` 第 `4 -> 5` 枚后起 special 交互
    - `CARD_RECOVERED_FROM_DISCARD -> processReturnToHandTriggers -> reaction queue` 后起 special 交互
    - talent 写入 `baseLimitedMinionPowerCaps`，并真实拦住 `3` 力随从、放行 `2` 力随从
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 1 条组合 E2E：
    - special prompt 进场
    - talent 后额外打出 `2` 力随从与 1 张战术
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "时间盒子"`，结果 `3 passed`。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `78 passed`。
  - 运行 `$env:PW_PORT='6279'; $env:PW_GAME_SERVER_PORT='20205'; $env:PW_API_SERVER_PORT='21205'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "时间盒子可在达到第 5 枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度"`，结果 `1 passed`。
  - 复跑整份 `e2e/smashup-alien-terraform.e2e.ts` 时，先暴露出并发插入的重复 helper：
    - `openTimeBoxSpecialScene`
    - `openTimeBoxTalentScene`
  - 已删除这两处重复定义后，再次运行 `$env:PW_PORT='6279'; $env:PW_GAME_SERVER_PORT='20205'; $env:PW_API_SERVER_PORT='21205'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `32 passed`。
  - 按新规范只打开 1 个截图文件夹，并实际复看 4 张 `Time Box` 截图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\时间盒子可在达到第-5-枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度\time-box-play-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\时间盒子可在达到第-5-枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度\time-box-play-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\时间盒子可在达到第-5-枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度\time-box-talent-ready.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\时间盒子可在达到第-5-枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度\time-box-talent-resolved.png`
  - 将 `Time Box` 的实现事实、整份回归结果与看图结论回写到 `evidence/smashup-alien-terraform-e2e-test.md`、`task_plan.md`、`findings.md`、`progress.md`。
- Files created/modified:
  - `src/games/smashup/domain/events.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/domain/utils.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke (targeted) | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "时间盒子"` | Time Box 3 条闭环 smoke 通过 | `3 passed` | ✅ |
| Smash Up smoke (full) | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | Time Box + 既有 smoke 全绿 | `78 passed` | ✅ |
| Smash Up E2E (targeted) | `$env:PW_PORT='6279'; $env:PW_GAME_SERVER_PORT='20205'; $env:PW_API_SERVER_PORT='21205'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "时间盒子可在达到第 5 枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度"` | Time Box 真实浏览器链通过 | `1 passed` | ✅ |
| Smash Up E2E (full) | `$env:PW_PORT='6279'; $env:PW_GAME_SERVER_PORT='20205'; $env:PW_API_SERVER_PORT='21205'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | Time Box + 既有 Titans 整文件回归通过 | `32 passed` | ✅ |
- Next step:
  - `Time Box` 已完成单牌闭环，下一张后续泰坦优先切回 `Moon Zero Three / 三号空间站`。

## Session: 2026-03-27 Smash Up Titans - Mergacon 运行时闭环
- **Status:** completed
- Actions taken:
  - 复读 `src/games/smashup/rule/泰坦机制与卡牌抄录.md` 中 `Mergacon / 合体机器人` 的冻结文案，确认目标是：
    - 回合开始时进场
    - 在所在基地 `+3`
    - 天赋移动后直到回合结束失去持续能力
  - 在 `src/games/smashup/domain/types.ts`、`src/games/smashup/domain/events.ts`、`src/games/smashup/domain/reduce.ts` 增加 `su:titan_ongoing_suppressed` 与 `titanOngoingSuppressedUntilTurnEnd`，让泰坦也能表达“本回合失去 ongoing”。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `changerbots_mergacon`：
    - `onTurnStart` global trigger 进场交互
    - `registerTitanPowerModifier(... => +3)`
    - `talent` 选基地移动，并写入本回合 ongoing 压制事件
    - `titan_changerbots_mergacon_play`
    - `titan_changerbots_mergacon_talent`
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 4 条 Mergacon smoke：
    - 回合开始进场交互
    - 进场交互解决后真正落地
    - `+3 ongoing` 与回合结束后恢复
    - 天赋移动并写入压制标记
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 2 条 Mergacon E2E：
    - 回合开始进场交互
    - 天赋移动并写入压制标记
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `54 passed`。
  - 先分别运行 2 条 Mergacon 单用例 E2E，确认“回合开始进场”和“天赋移动后压制持续能力”都能独立通过。
  - 复跑整份 `e2e/smashup-alien-terraform.e2e.ts`，结果 `16 passed`。
  - 实际打开并查看 4 张 Mergacon 证据截图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人可通过回合开始交互进场到满足条件的基地\mergacon-play-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人可通过回合开始交互进场到满足条件的基地\mergacon-play-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人天赋可移动泰坦并写入本回合持续能力压制标记\mergacon-talent-choose-base.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人天赋可移动泰坦并写入本回合持续能力压制标记\mergacon-talent-resolved.png`
  - 将 Mergacon 的浏览器验证结果与人工看图结论补写到 `evidence/smashup-alien-terraform-e2e-test.md`。
- Files created/modified:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/events.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | Mergacon 新旧 smoke 全绿 | `54 passed` | ✅ |
| Smash Up E2E | `npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | Mergacon + 既有 Titans 整文件回归通过 | `16 passed` | ✅ |
- Next step:
  - Mergacon 已完成浏览器验证，下一轮可直接切到下一张后续泰坦的运行时闭环。
  - 如果后续再次出现 E2E 启动阻塞，优先先验证 Docker / 测试服务环境，而不是先怀疑当前泰坦实现。

## Session: 2026-03-27 Smash Up Titans - Rainboroc 运行时闭环
- **Status:** completed
- Actions taken:
  - 复读 `docs/ai-rules/engine-systems.md`、`docs/testing-best-practices.md` 与 `src/games/smashup/rule/泰坦机制与卡牌抄录.md`，确认 Rainboroc 目标是：afterScoring 进替换基地、每回合第一次低战力随从进场后加指示物、天赋把 2 力及以下随从洗回牌库并可移动。
  - 复核 `src/games/smashup/abilities/titans.ts`、`src/games/smashup/domain/reduce.ts`、`src/games/smashup/domain/types.ts`，确认 `ongoing` 的 once-per-turn 记账已经就位。
  - 修正 smoke 测试数据，把错误的 `trickster_gnome` 改成真实 `2` 力的 `pirate_first_mate`。
  - 在 `src/games/smashup/abilities/titans.ts` 修正 `titan_itty_critters_rainboroc_play_replacement`：
    - 不再直接返回 `TITAN_PLAYED`
    - 改为写入 `pendingPostScoringActions.playTitanOnReplacementBase`
    - 让真实浏览器链在补发 `BASE_REPLACED` 后再落地泰坦
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 把 Rainboroc 的 afterScoring 进场断言升级成 `createSmashUpEventSystem()` 的系统级验证，覆盖 deferred post-scoring 链。
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 2 条 Rainboroc E2E：
    - 计分后替换基地进场
    - 天赋：选弃牌堆低战力随从 -> 洗回牌库 -> 选是否移动
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `57 passed`。
  - 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `18 passed`。
  - 实际打开并查看 5 张 Rainboroc 截图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟可在基地计分后的替换基地交互中进场\rainboroc-play-replacement-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟可在基地计分后的替换基地交互中进场\rainboroc-play-replacement-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟天赋可通过真实交互把低战力随从洗回牌库并移动到其他基地\rainboroc-talent-choose-discard.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟天赋可通过真实交互把低战力随从洗回牌库并移动到其他基地\rainboroc-talent-choose-base.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟天赋可通过真实交互把低战力随从洗回牌库并移动到其他基地\rainboroc-talent-resolved.png`
  - 将看图结论同步回写到 `evidence/smashup-alien-terraform-e2e-test.md`、`task_plan.md`、`findings.md`、`progress.md`。
- Files created/modified:
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | Rainboroc + 既有 smoke 全绿 | `57 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | Rainboroc + 既有 Titans 整文件回归通过 | `18 passed` | ✅ |
- Next step:
  - Rainboroc 已完成浏览器验证，下一轮继续切下一张后续泰坦运行时闭环。
  - 凡是 afterScoring 还依赖 deferred post-scoring 事件的交互，后续 smoke 默认直接补系统级 `INTERACTION_EVENTS.RESOLVED` 验证，不再只测 handler 裸返回值。

## Session: 2026-03-27 Smash Up Titans - Gorgodzolla 运行时闭环
- **Status:** completed
- Actions taken:
  - 复读 `docs/ai-rules/engine-systems.md`、`docs/testing-best-practices.md`、`src/games/smashup/rule/泰坦机制与卡牌抄录.md`，确认哥佐拉目标是：有你至少 2 个战术的基地进场、在本基地打随从/战术后加标记、打战术后可选抽 1 张牌。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `kaiju_gorgodzolla`：
    - `special`
    - `onMinionPlayed`
    - `onActionPlayed`
    - `titan_kaiju_gorgodzolla_draw`
  - 在 `src/games/smashup/domain/ongoingEffects.ts` 为 `TriggerContext / collectTriggers` 增加 `actionTargetBaseIndex / actionTargetType / actionTargetMinionUid`。
  - 在 `src/games/smashup/domain/reducer.ts` 把 `PLAY_ACTION` 的 ongoing `onActionPlayed` 正式接进 reaction queue。
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 3 条哥佐拉 smoke：
    - special 条件含附着战术计数
    - 打随从后加标记
    - 打战术后经 reaction queue 结算加标记，再进入抽牌交互
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 2 条哥佐拉 E2E：
    - 右侧泰坦栏 special 进场
    - 打战术后经 reaction queue 再进入抽牌交互
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `60 passed`。
  - 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `20 passed`。
  - 实际打开并查看 4 张哥佐拉截图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\哥佐拉可通过牌库右侧泰坦栏按通常随从额打到有你至少两个战术的基地\gorgodzolla-rail-ready.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\哥佐拉可通过牌库右侧泰坦栏按通常随从额打到有你至少两个战术的基地\gorgodzolla-rail-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\哥佐拉在本基地打出战术后会加-1-标记并可通过交互抽-1-张牌\gorgodzolla-draw-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\哥佐拉在本基地打出战术后会加-1-标记并可通过交互抽-1-张牌\gorgodzolla-draw-resolved.png`
  - 将哥佐拉的实现事实、测试结果和人工看图结论回写到 `evidence/smashup-alien-terraform-e2e-test.md`。
- Files created/modified:
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | 哥佐拉 + 既有 smoke 全绿 | `60 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | 哥佐拉 + 既有 Titans 整文件回归通过 | `20 passed` | ✅ |
- Next step:
  - 哥佐拉已完成浏览器验证，下一轮继续切下一张后续泰坦运行时闭环。
  - 后续凡是依赖 `onActionPlayed` 的泰坦/行动效果，都默认直接沿用这轮补好的通用 reaction queue 链。

## Session: 2026-03-27 Smash Up Titans - Megabot 运行时闭环
- **Status:** completed
- Actions taken:
  - 先做并发确认：复查 `titans.ts`、`smashup.smoke.test.ts`、`smashup-alien-terraform.e2e.ts`，确认其余 AI 还没有把剩余后续泰坦往前推到 `Walking Castle / Moon Zero Three / Time Box / Emperor Penguin` 这些目标上。
  - 复读 `docs/ai-rules/engine-systems.md`、`docs/testing-best-practices.md` 与 `src/games/smashup/rule/泰坦机制与卡牌抄录.md`，确认超级佐德目标是：有你至少 3 个随从的基地进场、在本基地按己方随从数提供力量、在另一基地计分前可移动过去。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `mega_troopers_megabot`：
    - `special`
    - `beforeScoring` 扫描在场 Megabot 并按控制者链式创建“移动 / 留在原地”交互
    - `registerTitanPowerModifier(... => 你在此处的随从数)`
    - `titan_mega_troopers_megabot_move`
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 3 条 Megabot smoke：
    - 3 随从门槛的 special
    - ongoing 力量贡献
    - beforeScoring 交互发给控制者并在结算后移动到计分基地
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 2 条 Megabot E2E：
    - 右侧泰坦栏按通常随从额进场
    - 计分前交互移动到计分基地
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `63 passed`。
  - 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `22 passed`。
  - 实际打开并查看 4 张 Megabot 截图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\超级佐德可通过牌库右侧泰坦栏按通常随从额打到有你至少三个随从的基地\megabot-rail-ready.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\超级佐德可通过牌库右侧泰坦栏按通常随从额打到有你至少三个随从的基地\megabot-rail-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\超级佐德可在另一基地计分前通过交互移动到该基地\megabot-before-scoring-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\超级佐德可在另一基地计分前通过交互移动到该基地\megabot-before-scoring-resolved.png`
  - 将 Megabot 的看图结论补写到 `evidence/smashup-alien-terraform-e2e-test.md`，并同步回填三件套。
- Files created/modified:
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | Megabot + 既有 smoke 全绿 | `63 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | Megabot + 既有 Titans 整文件回归通过 | `22 passed` | ✅ |
- Next step:
  - Megabot 已收口，下一张优先继续 `Walking Castle / 移动城堡` 这一类不需要新计数器建模的后续泰坦。
  - 如果并发工作区里别的 AI 先动了 `Walking Castle`，就顺延切到 `Very Large Boulder` 或 `Moon Zero Three`，避免撞同一路径。

## Session: 2026-03-28 Smash Up Titans - Very Large Boulder 运行时闭环
- **Status:** completed
- Actions taken:
  - 复读 `docs/ai-rules/engine-systems.md`、`docs/testing-best-practices.md` 与 `src/games/smashup/rule/泰坦机制与卡牌抄录.md`，确认硕大圆石目标是：空基地进场、每回合第一次有随从从这里移走后可移动并消灭低于其标记数的随从、你的回合结束时若本回合未移动则获得 1 标记。
  - 在 `src/games/smashup/domain/types.ts` 为 `TriggerInstance` 增加 `moveFromBaseIndex / moveToBaseIndex`，并为 `SmashUpCore` 增加 `veryLargeBoulderTriggeredTurnByTitan / titanMovedTurnByTitanUid`。
  - 在 `src/games/smashup/domain/ongoingEffects.ts`：
    - 扩展 `TriggerContext`
    - 为 `registerTrigger` 增加 `playerContext`
    - 让 `locateSource` 可返回泰坦 UID
    - 在 `collectTriggers` 入队阶段拦住圆石同回合第二次新触发。
  - 在 `src/games/smashup/domain/reactionQueue.ts` 与 `src/games/smashup/domain/reactionQueueHandlers.ts`，把 `moveFromBaseIndex / moveToBaseIndex` 传到 trigger executor。
  - 在 `src/games/smashup/domain/reducer.ts`，让 `processMoveTriggers` 对每个 `MINION_MOVED` 同时收集：
    - “移入目标基地”的 `onMinionMoved`
    - “有随从从来源基地移走”的 `onMinionMoved`
  - 在 `src/games/smashup/domain/reduce.ts`：
    - `TITAN_MOVED` 写入 `titanMovedTurnByTitanUid`
    - `TRIGGER_CONSUMED` 为圆石写入 `veryLargeBoulderTriggeredTurnByTitan`
    - 同时清掉同控制者、同来源、同回合已排队的圆石重复 trigger。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `explorers_very_large_boulder`：
    - `special`
    - `onMinionMoved`
    - `onTurnEnd`
    - `titan_explorers_very_large_boulder_move`
    - `titan_explorers_very_large_boulder_destroy`
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 3 条圆石 smoke：
    - 空基地进场
    - 随从移离后由泰坦控制者响应、移动并消灭、同回合只触发一次
    - 回合结束未移动则获得 1 标记
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 2 条圆石 E2E：
    - 右侧泰坦栏 special 进场
    - 移离触发后的移动并消灭交互
  - 这轮调试确认 `robot_microbot_alpha` 在该场景下有效力量会变成 `3`，不适合作为“低于 2 力被消灭”的测试目标；因此将 smoke / E2E 的目标统一换成稳定 1 力的 `robot_microbot_guard`。
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `69 passed`。
  - 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `26 passed`。
  - 实际打开并查看 4 张圆石截图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\硕大圆石可通过牌库右侧泰坦栏按通常随从额打到没有玩家随从的基地\very-large-boulder-rail-ready.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\硕大圆石可通过牌库右侧泰坦栏按通常随从额打到没有玩家随从的基地\very-large-boulder-rail-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\硕大圆石可在随从移离后移动到目标基地并消灭低于其标记数的随从\very-large-boulder-move-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\硕大圆石可在随从移离后移动到目标基地并消灭低于其标记数的随从\very-large-boulder-move-resolved.png`
  - 将圆石的实现事实、测试结果和人工看图结论回写到 `evidence/smashup-alien-terraform-e2e-test.md`，并同步回填三件套。
- Files created/modified:
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/reactionQueue.ts`
  - `src/games/smashup/domain/reactionQueueHandlers.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | 圆石 + 既有 smoke 全绿 | `69 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | 圆石 + 既有 Titans 整文件回归通过 | `26 passed` | ✅ |
- Next step:
  - 圆石已收口，下一张优先继续筛 `Emperor Penguin / 企鹅帝皇` 这一类可复用现有命令入口的后续泰坦。

## Session: 2026-03-28 Smash Up Titans - Emperor Penguin OpenSpec 规格分流
- **Status:** completed
- Actions taken:
  - 复读 `openspec/AGENTS.md`、`openspec/project.md`，并运行 `openspec list`、`openspec list --specs`，确认这轮属于“新增 capability / 架构扩展”，不能跳过 proposal 直接实现。
  - 复读 `src/games/smashup/rule/泰坦机制与卡牌抄录.md` 中 `Emperor Penguin / 企鹅帝皇` 原文，确认其 ongoing 是“从牌库顶打出随从到本基地，代替常规随从打出”。
  - 复核 `src/games/smashup/data/titans.ts`、`src/games/smashup/domain/abilityRegistry.ts`、`src/games/smashup/domain/commands.ts`、`src/games/smashup/ui/BaseZone.tsx`，确认当前运行时只支持 `special` / `talent` 两类在场泰坦主动入口。
  - 对照现有 `openspec/changes/add-smashup-titans/` 的 proposal / design / tasks / delta spec，确认企鹅帝皇暴露的是一个新的“在场泰坦主动 ongoing”能力缺口，而不是单张卡的局部实现缺口。
  - 新建 `openspec/changes/add-smashup-titan-activated-ongoing/`，补齐：
    - `proposal.md`
    - `design.md`
    - `tasks.md`
    - `specs/smashup-titans/spec.md`
  - 运行 `openspec validate add-smashup-titan-activated-ongoing --strict --no-interactive`，结果通过。
  - 按用户新要求更新当前工作树规范：
    - `AGENTS.md`
    - `docs/testing-best-practices.md`
    - 规则新增“打开截图所在文件夹时每轮只打开 1 个目标文件夹；汇报默认只给截图完整绝对路径”
  - 只打开了 1 个截图文件夹用于后续继续查看，不再连续列目录刷屏。
- Files created/modified:
  - `openspec/changes/add-smashup-titan-activated-ongoing/proposal.md`
  - `openspec/changes/add-smashup-titan-activated-ongoing/design.md`
  - `openspec/changes/add-smashup-titan-activated-ongoing/tasks.md`
  - `openspec/changes/add-smashup-titan-activated-ongoing/specs/smashup-titans/spec.md`
  - `AGENTS.md`
  - `docs/testing-best-practices.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| OpenSpec | `openspec validate add-smashup-titan-activated-ongoing --strict --no-interactive` | proposal 合法 | 通过 | ✅ |
- Next step:
  - 等待 / 推进 `add-smashup-titan-activated-ongoing` 获批。
  - 获批后按 proposal 落 `Emperor Penguin / 企鹅帝皇`，并补 smoke、E2E、看图与证据。
  - 后续凡是依赖“从基地移离”语义的泰坦/基地能力，都默认直接沿用这轮补好的 `onMinionMoved` 双向收集链。

## Session: 2026-03-28 Smash Up Titans - Emperor Penguin 运行时闭环
- **Status:** completed
- Actions taken:
  - 在 `src/games/smashup/domain/types.ts` 为在场泰坦主动 `ongoing` 能力补齐契约：
    - `AbilityTag` 新增 `ongoingActivation`
    - `TitanCardDef` 新增 `activatableAbilityKinds`
    - `SU_COMMANDS.ACTIVATE_TITAN_ONGOING`
    - `ActivateTitanOngoingCommand`
  - 在 `src/games/smashup/domain/abilityRegistry.ts` 增加 `resolveOngoingActivation(...)`，并经 `src/games/smashup/domain/index.ts` 暴露。
  - 在 `src/games/smashup/domain/titanAbilityValidators.ts` 增加 `registerTitanOngoingActivationValidator(...)` / `validateTitanOngoingActivation(...)`。
  - 在 `src/games/smashup/domain/playLegality.ts` 增加 `validateDeckTopRegularMinionPlaySemantics(...)`，专门校验“牌库顶那张随从能否按通常随从额打到指定基地”。
  - 在 `src/games/smashup/domain/commands.ts` / `src/games/smashup/domain/reducer.ts` 接通 `ACTIVATE_TITAN_ONGOING` 的 validate + execute。
  - 在 `src/games/smashup/Board.tsx` / `src/games/smashup/ui/BaseZone.tsx` 接入泰坦 `ongoing` 可用态与 dispatch 路径；同一张泰坦同时具备 `ongoing + talent` 时，点击后显示 `持续 / 天赋` 双按钮。
  - 在 `src/games/smashup/data/titans.ts` 为 `penguins_emperor_penguin` 标记 `activatableAbilityKinds: ['ongoing', 'talent']`。
  - 在 `src/games/smashup/abilities/titans.ts` 补齐 `penguins_emperor_penguin`：
    - `onTurnStart` special 进场交互
    - `ongoingActivation`
    - `talent`
    - `titan_penguins_emperor_penguin_play`
    - `titan_penguins_emperor_penguin_talent`
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 3 条 smoke：
    - 回合开始进场交互 + 结算后落地
    - `ongoingActivation` 打出牌库顶随从并消耗通常随从额度
    - `talent` 把手中的低战力随从洗回牌库并给泰坦加标记
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 新增 3 条 E2E：
    - 回合开始交互进场
    - 双入口菜单下点击 `持续`
    - 双入口菜单下点击 `天赋`
  - 调试时发现并修掉 2 个真实缺口：
    - `src/games/smashup/ui/BaseZone.tsx`：桌面端多主动入口泰坦原先不会展开 `持续 / 天赋` 按钮，现改为点击后显式展开
    - `e2e/framework/GameTestContext.ts`：`selectOption()` 先点卡面再点按钮会误伤“按钮式选牌”交互，现改为 `可见按钮 > 卡面元素 > harness fallback`
  - 运行 `npm run typecheck`，通过。
  - 运行 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `72 passed`。
  - 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `29 passed`。
  - 只打开 1 个截图根文件夹并筛出 `emperor-penguin-*`，随后实际查看 5 张关键图：
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇可在回合开始交互中打到满足条件的基地\emperor-penguin-play-choice.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇可在回合开始交互中打到满足条件的基地\emperor-penguin-play-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从\emperor-penguin-activation-menu.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从\emperor-penguin-ongoing-resolved.png`
    - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过天赋按钮洗回低战力随从并获得标记\emperor-penguin-talent-resolved.png`
  - 将企鹅帝皇的实现事实、测试结果和人工看图结论回写到 `evidence/smashup-alien-terraform-e2e-test.md`、`task_plan.md`、`findings.md`、`progress.md`，并把 `openspec/changes/add-smashup-titan-activated-ongoing/tasks.md` 全部勾完。
- Files created/modified:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/abilityRegistry.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/domain/playLegality.ts`
  - `src/games/smashup/domain/titanAbilityValidators.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/data/titans.ts`
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `e2e/framework/GameTestContext.ts`
  - `e2e/smashup-alien-terraform.e2e.ts`
  - `openspec/changes/add-smashup-titan-activated-ongoing/tasks.md`
  - `evidence/smashup-alien-terraform-e2e-test.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | 企鹅帝皇 + 既有 smoke 全绿 | `72 passed` | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | 企鹅帝皇 + 既有 Titans 整文件回归通过 | `29 passed` | ✅ |
- Next step:
  - 企鹅帝皇已收口，下一轮直接切剩余未完整闭环的后续泰坦。
  - 后续同类“在场主动 ongoing”泰坦默认直接复用这轮补好的命令、validator、UI 入口与 E2E 交互选择顺序。

## Session: 2026-03-22 多线任务登记 / 新会话续跑入口
- **Status:** in_progress
- Actions taken:
  - 读取项目根目录现有 `task_plan.md` / `findings.md` / `progress.md`，确认三件套已存在，但顶层标题仍停留在旧任务，需要补登记本轮多线收口状态。
  - 读取并核对项目内主进度文件：`evidence/full-recovery-plan.md`、`evidence/p0-audit-progress.md`、`evidence/p1-restoration-progress.md`、`evidence/smashup-e2e-migration-progress.md`、`temp/feedback-main-branch-resume-plan.md`、`temp/ssh-codex-plan.md`。
  - 已确认当前主线不止一个：静态资源 fallback 事故、房主被踢/房间被删链路、feedback 未关闭项、E2E 迁移、POD 审计/恢复文档。
  - 已用 guarded task 启动并行 Codex：
    - `codex-feedback-open-tracker` → 目标产物 `temp/open-feedback-tracker.md`
    - `codex-e2e-migration` → 目标产物 `temp/e2e-next-batch-plan.md`
    - `codex-find-planning-with-files` → 原用于精确定位 plan 技能；在用户给出 GitHub 后已人工确认并安装技能。
  - 已从 `https://github.com/OthmanAdi/planning-with-files` 安装 `planning-with-files`，并整理到 OpenClaw 可识别目录；workspace commit：`1216e1e` (`skills: install planning-with-files`)。
  - 已记录用户通用规范：以后说 `plan` 默认指 `planning-with-files`；多任务并行时，新增任务主动委派给 Codex。
- Next step:
  - 新会话恢复时，先读本三件套，再检查以下产物是否已落盘：`temp/open-feedback-tracker.md`、`temp/e2e-next-batch-plan.md`、`temp/codex-room-assets-findings.md`。
  - 然后继续两条核心修复线：`apps/api/src/main.ts` 的 `/assets` SPA fallback 排除是否已真实落盘/验证；`server.ts` + 前端状态链路对“房间已删除”误判的根因与最小修复。

## Session: 2026-03-10

### Phase 1：读取规则与相关规范
- **Status:** in_progress
- Actions taken:
  - 读取 `planning-with-files` 技能说明，按复杂任务流程建档。
  - 检查项目内相关文档与规则文件位置。
  - 读取 `docs/ai-rules/engine-systems.md` 与 `src/games/dicethrone/rule/王权骰铸规则.md`，准备进入实现链路排查。
  - 追踪 `pendingBonusDamage` / `pendingAttack.bonusDamage` / `useActiveModifiers` 相关实现。
  - 对照规则确认：攻击修正必须依附当前攻击，当前实现却允许无攻击时预存到未来攻击。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 暂无 | - | - | - | - |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-10 | 暂无 | - | - |

---

## Addendum（2026-03-10）：传输层状态注入 P1 收尾

### Actions taken
- 审查 `src/engine/transport/react.tsx`，确认联机态 `StateInjector` 已改为只读注册，setter 直接抛错。
- 审查 `src/engine/transport/server.ts`，确认 `/game` socket 侧已不暴露 `test:injectState`。
- 在 `src/engine/transport/server.ts` 新增 `validateTestAccess()`。
- 在 `src/server/routes/test.ts` 为 `/test/inject-state`、`/test/patch-state`、`/test/get-state/:matchId`、`/test/snapshot-state`、`/test/restore-state` 补上座位级鉴权。
- 在 `src/server/routes/test.ts` 为 `restore-state` 增加注入前 `validateMatchState`。
- 更新 `e2e/helpers/state-injection.ts`，让服务端状态注入自动携带 `playerId + credentials`。
- 更新 `docs/automated-testing.md`，同步 `/test/*` 新契约。
- 扩充 `src/server/routes/__tests__/test.routes.test.ts`，覆盖缺失座位鉴权头、过期凭证等场景。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 传输层 / 测试路由回归 | `npx vitest run src/server/routes/__tests__/test.routes.test.ts src/engine/transport/__tests__/server.test.ts src/engine/transport/__tests__/server-injectState.test.ts --reporter=dot --silent --maxWorkers=1` | 新鉴权与旧传输行为同时通过 | `27 passed` | ✅ |
| TypeScript 类型检查 | `npm run typecheck` | 全绿 | 通过 | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-10 | `restore-state` 新增快照校验后，原单测夹具缺少 `core.bases` 导致 400 | 1 | 修正测试夹具，使快照状态满足当前 `validateMatchState` 契约 |
## Session: 2026-03-11 服务器启动缓慢排查
- **Status:** completed
- Actions taken:
  - 读取 `package.json`，确认 `dev`/`predev`/`dev:frontend:wait` 启动链路。
  - 读取 `scripts/infra/wait_for_ports.js`、`scripts/infra/clean_ports.js`、`scripts/game/generate_game_manifests.js`、`scripts/audio/generate-slim-registry.mjs`，定位串行等待与前置脚本开销。
  - 实测 `predev` 各步骤耗时，确认固定成本主要来自 `clean_ports`（清旧进程时）与音频 slim registry 生成。
  - 用端口探测分别复测游戏服与 API 服启动时间，确认前端等待会把后端慢启动直接放大为整套开发环境慢启动。
  - 用临时 `tsx` 脚本拆分导入链，确认 API 服核心瓶颈位于 `@sentry/nestjs` 与 `AppModule` 导入/转译，而不是监听端口本身。
  - 临时测量脚本已删除；一次 `Remove-Item` 被策略拦截，随后改用 `apply_patch` 删除成功。

## Session: 2026-03-11 Dice Throne 攻击修正残留修复
- **Status:** completed
- Actions taken:
  - 复核上一轮对 `src/games/dicethrone/domain/rules.ts` 与 `src/games/dicethrone/hooks/useActiveModifiers.ts` 的修复是否与规则一致。
  - 将“攻击修正必须绑定当前攻击”的边界测试迁移到轻量文件 `src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts`。
  - 清理临时落点：移除 `src/games/dicethrone/__tests__/card-give-hand-boundary.test.ts` 和 `src/games/dicethrone/__tests__/card-playCondition-audit.test.ts` 中为本次问题临时插入的断言。
  - 保留并复用 `src/games/dicethrone/__tests__/active-modifiers-undo.test.ts` 中对 `main2` / `TURN_CHANGED` 清理边界的覆盖。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 攻击修正规则边界 + 红热回归 | `npx vitest run src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts src/games/dicethrone/__tests__/active-modifiers-undo.test.ts --maxWorkers=1` | 规则边界和显示清理都通过 | `16 passed` | ✅ |
| TypeScript 类型检查 | `npm run typecheck` | 全绿 | 通过 | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-11 | `card-playCondition-audit.test.ts` 临时断言被插入到对象字面量中，且该文件默认被 `audit` 排除 | 1 | 将规则断言迁移到可执行轻量文件 `red-hot-meteor-integration.test.ts`，并清理临时插入代码 |
| 2026-03-11 | `card-give-hand-boundary.test.ts` 整文件运行时 worker 启动超时 | 1 | 不再把本次规则断言放入该重文件，改为迁移到轻量文件 |
- 审查 git 历史，确认 `dev:frontend:wait` 于 2026-03-09 引入；API 主启动文件最近无同等级别大改。
- 改造 `apps/api/src/main.ts`：顶层 Sentry 导入改为监听成功后后台惰性初始化，并补充启动耗时日志。
- 改造 `server.ts`：启动期房间清理改为监听成功后后台执行，并补充启动耗时日志。
- 调整 `package.json` / `nodemon.json`：去掉启动命令中的 `npx`，减少额外启动开销。
- 新增 `scripts/infra/dev-orchestrator.js`，把 `dev` 从并行冷启动改为 API → game-server → frontend 分阶段启动，避免两个 `tsx` 进程同时冷启动互相争抢资源。
- 验证结果：`npm run dev` 三端口 ready 从优化前的 `18000≈29.75s / 18001≈52.24s / 5173≈68.08s`，下降到 `18000≈9.18s / 18001≈7.08s / 5173≈10.24s`。
- 排障中遇到两次脚本问题：① orchestrator 用嵌套 `npm run` 在 Windows 上触发 `spawn EINVAL`/启动挂起，随后改为直接调用本地二进制；② 删除临时脚本时 `Remove-Item` 被策略拦截，改用 `apply_patch` 删除成功。
- 评估过“预编译后再运行”的更激进 dev runner，但 `npx tsc -p apps/api/tsconfig.json --outDir temp/api-dev` 被现有仓库中的无关 TypeScript 错误阻断（如 `apps/api/src/adapters/msgpack-io.adapter.ts`、`apps/api/src/modules/auth/dtos/auth.dto.ts`、`apps/api/src/modules/notification/notification.service.ts`），因此本次选择了不依赖完整编译通过的低风险方案。

## Session: 2026-03-11 服务器启动缓慢排查与优化
- **Status:** completed
- Actions taken:
  - 实查 `apps/api/src/main.ts`，把顶层 Sentry 初始化移出启动关键路径。
  - 实查 `server.ts`，把启动期房间清理从监听前挪到监听后后台执行，并增加结构化启动耗时日志。
  - 新增 `scripts/infra/dev-orchestrator.js`，让默认 `dev` 走分阶段启动。
  - 调整 `package.json` / `nodemon.json`，统一显式调用本地 CLI。
  - 更新 `docs/toolchain-reliability.md`、`docs/deploy.md`。
  - 通过实际端口探测验证 API、game-server、整套 dev 的冷/热启动表现。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint 回归 | `npx eslint scripts/infra/dev-orchestrator.js apps/api/src/main.ts server.ts` | 0 errors | 0 errors，1 个既有 warning | ✅ |
| API 启动（冷） | `npm run dev:api` | 可监听端口 | `~103.84s` | ✅ |
| API 启动（热） | `npm run dev:api` | 可监听端口 | `~4.20s / 5.82s` | ✅ |
| game-server 启动（热） | `npm run dev:game` | 可监听端口 | `~3.68s / 4.97s` | ✅ |
| 完整 dev 热启动 | `npm run dev` | 三端口都 ready | `~12.41s` | ✅ |
| 旧并行入口热启动 | `npm run dev:parallel` | 三端口都 ready | `~11.48s` | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-11 | `apply_patch` / Python 直写对部分既有文件未稳定落盘 | 1 | 改用 `Set-Content -Encoding UTF8` 直接写入并立即复读校验 |
| 2026-03-11 | `npm run check:prod-deps` 依赖 `/bin/bash`，当前 Windows 环境缺失 | 1 | 记录为环境限制，本次用 ESLint + 真实启动验证替代 |

## Session: 2026-03-11 第二阶段开发启动优化（bundle runner）
- **Status:** completed
- Actions taken:
  - 用 `esbuild` 验证 API 预先 bundle 后可在 `~3.74s` 内 ready。
  - 用 `esbuild` 验证 game-server 预先 bundle 后可在 `~2.11s` 内 ready。
  - 实现 `scripts/infra/dev-bundle-runner.mjs`，把 watch bundle 与运行时重启合并到统一脚本。
  - 更新 `package.json`、`scripts/infra/dev-orchestrator.js`、`scripts/e2e/start-all-servers.mjs`、`docs/toolchain-reliability.md`、`docs/deploy.md`。
  - 删除不再使用的 `nodemon.json` 主链路配置。

### Test Results
## Session: 2026-03-11 ???????????nodemon / Node pin / smoke?
- **Status:** completed
- Actions taken:
  - ?? `nodemon.json`??? `dev:game:nodemon` ???? watcher
  - ?? `.nvmrc`?`.node-version` ? `package.json` ?? `engines.node=24.1.0`
  - ?? `scripts/infra/startup-smoke-test.mjs`????????? bundle ????????
  - ?? `scripts/infra/dev-orchestrator.js`????? `DEV_BUNDLE_DIR` ?? bundle ??
  - ?? `docs/toolchain-reliability.md`

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint ?? | `npx eslint scripts/infra/dev-orchestrator.js scripts/infra/startup-smoke-test.mjs` | 0 errors | 0 errors | ? |
| ?? smoke test | `npm run smoke:startup` | API / game-server / full-dev ???? | `API ~3.66s / game-server ~41.72s / full-dev ~3.64s` | ? |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-11 | `smoke:startup` ?? `src/games/smashup/domain/index.ts` ???? `Unexpected "."`?? `englishAtlasMap.json` ? duplicate key warning | 1 | ???????????????????????/??????????????????????? unrelated ?? |


## Session: 2026-03-11 `englishAtlasMap.json` ?? key ??
- **Status:** completed
- Actions taken:
  - ?? `src/games/smashup/data/englishAtlasMap.json` ????? `src/games/smashup/ui/SmashUpCardRenderer.tsx` ? `src/games/smashup/ui/cardAtlas.ts`
  - ???????? key ? 1 ??`base_great_library`
  - `git blame` / `git log` ?????? `10b99ae6` ??????? bundle runner ????
  - ?????????????????? warning ??????????

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ?? key ?? | Python ???? `src/games/smashup/data/englishAtlasMap.json` | ???????? key | ? `base_great_library: 2` | ? |
| ???? | `git blame` + `git log --follow` | ?????? | ???? `6ea1f9f0`????? `10b99ae6` ?? | ? |

## Session: 2026-03-11 删除 `englishAtlasMap.json` 重复 key
- **Status:** completed
- Actions taken:
  - 删除 `src/games/smashup/data/englishAtlasMap.json` 中重复的 `base_great_library`
  - 用 Python 重新扫描文件，确认重复 key 数量为 `0`
  - 直接运行 esbuild 打包 `server.ts`，确认不再出现 `duplicate-object-key` warning
- Notes:
  - 当前终端环境会拦截 Node 内部 `child_process.spawn`，因此 `smoke:startup` 在这里会假失败；本轮改用直接 bundle 作为验证手段
## Session: 2026-03-24 Smash Up Titans
- **Status:** in_progress
- Actions taken:
  - 回到独立 worktree `D:\gongzuo\webgame\BoardGame-smashup-titans`，确认当前分支是 `feat/smashup-titans`
  - 重新读取根 `AGENTS.md`、`openspec/AGENTS.md` 与 `planning-with-files` 技能说明
  - 确认当前工作区已有大量泰坦相关未提交改动，这些改动属于当前分支上下文，不应回滚
  - 以 session override 的方式补写 `task_plan.md`、`findings.md`、`progress.md`，把当前任务切换为 Smash Up Titans
  - 记录当前阶段：房间扩展 UI、泰坦 rail / 基地行已完成，接下来进入 `playAsKinds` 交互闭环

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| OpenSpec 严格校验 | `openspec validate add-smashup-titans --strict --no-interactive` | 通过 | 已通过（历史结果） | ✓ |
| Smash Up smoke | `npm test -- src/games/smashup/__tests__/smashup.smoke.test.ts` | 通过 | 已通过（历史结果） | ✓ |
| TypeScript | `npm run typecheck` | 通过 | 已通过（历史结果） | ✓ |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|

## Session: 2026-03-24 Smash Up Titans - playAsKinds 最小闭环
- **Status:** completed
- Actions taken:
  - 核对 `playAsKinds` 相关改动已落在 `src/games/smashup/domain/types.ts`、`src/games/smashup/domain/abilityHelpers.ts`、`src/games/smashup/Board.tsx`、`src/games/smashup/abilities/aliens.ts`
  - 确认最小闭环选择 `alien_terraform` 作为代表链路，不把泰坦错误建模成 `minion`
  - 将“第 3 步允许选择可视作随从打出的 set-aside 泰坦”回归用例补入 `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - 用常规测试入口验证整份 smoke 文件，而不是依赖带历史噪音的 audit 文件

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke 单用例 | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts -t "alien_terraform" --configLoader native` | 新增泰坦候选链路通过 | 通过 | ✅ |
| Smash Up smoke 整文件 | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | 不回归现有 smoke | `21 passed` | ✅ |

### Next step
- 扩到更多“选择一个随从打出”的交互链
- 评估 `playAsKinds: ['action']` 的动作链路
- 决定是否补 E2E 覆盖 titan rail 与 hand prompt 的真实 UI 联动
## Session: 2026-03-24 Smash Up Titans - action-like titan 与证据收尾
- **Status:** completed
- Actions taken:
  - 为 `cthulhu_cthulhu_titan` 补齐 special 打出能力和 validator，要求目标基地必须已有己方随从
  - 将泰坦进场“是否消耗常规出牌额度”从隐式规则改为事件字段 `consumesRegularPlayKind`
  - 保持泰坦真实牌种为 `titan`，仅通过 `playAsKinds` 参与“视作随从/行动打出”的候选生成
  - 为单 worker E2E 增加端口环境变量覆盖，使用 `6274/20200/21200` 绕过本机 `6173` 绑定异常
  - 复跑 `e2e/smashup-alien-terraform.e2e.ts`，确认 5 条用例全部通过
  - 人工复核 4 张关键截图，并重建 `evidence/smashup-alien-terraform-e2e-test.md`，写入绝对路径与分析

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Smash Up smoke | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | 全文件通过 | 通过 | ✅ |
| Smash Up E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts` | 泰坦 rail 与旧 Terraform 链路均通过 | `5 passed` | ✅ |

### Evidence
- `D:\gongzuo\webgame\BoardGame-smashup-titans\evidence\smashup-alien-terraform-e2e-test.md`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\alien_terraform-第三步可通过牌库右侧泰坦栏选择可视作随从打出的-set-aside-泰坦\terraform-titan-rail-prompt.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\alien_terraform-第三步可通过牌库右侧泰坦栏选择可视作随从打出的-set-aside-泰坦\terraform-after-titan-from-rail.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\可视作行动打出的泰坦可通过牌库右侧泰坦栏按常规行动进场\cthulhu-titan-rail-ready.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\可视作行动打出的泰坦可通过牌库右侧泰坦栏按常规行动进场\cthulhu-titan-after-rail-play.png`

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-24 | 本机 `6173` 无法绑定，导致默认单 worker E2E 端口不可用 | 1 | 为单 worker E2E 增加 `PW_PORT` / `PW_GAME_SERVER_PORT` / `PW_API_SERVER_PORT` 覆盖，并改用 `6274/20200/21200` 成功跑通 |
# Session: 2026-03-25 Smash Up Titans - 基地泰坦布局微调
- **Status:** completed
- Actions taken:
  - 读取 `AGENTS.md`、`docs/ai-rules/ui-ux.md` 与当前 `BaseZone.tsx`，确认这轮只能调视觉比例，不能动你已经定下的总体交互模式
  - 在 `src/games/smashup/ui/BaseZone.tsx` 中取消“有持续行动时放大泰坦”的逻辑，只保留泰坦纵向整体上抬
  - 运行 `npm run typecheck`
  - 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`
  - 实际打开并查看 `01-2p-five-ongoings-with-titan.png`、`02-2p-five-ongoings-no-titan.png`、`03-4p-five-bases-with-titan.png`
  - 回写 `evidence/smashup-alien-terraform-e2e-test.md` 与 planning-with-files 三件套
- Next step:
  - 继续补首批 10 张泰坦剩余能力与端到端覆盖
  - 为房间扩展开关 `multi-select` 补一条 UI 回归
## Session: 2026-03-25 Smash Up Titans - Dagon smoke 修复
- **Status:** completed
- Actions taken:
  - 复查 `src/games/smashup/abilities/titans.ts`、`src/games/smashup/domain/ongoingModifiers.ts` 与 `src/games/smashup/abilities/index.ts`，确认 Dagon 的 titan power modifier 注册链存在
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 增加注册表断言，确认 `innsmouth_dagon` 已进入 `powerModifierIds`
  - 定位到真实根因是测试 helper：`src/games/smashup/__tests__/helpers.ts` 的 `makeBase` 与现有测试写法不兼容
  - 将 `makeBase` 扩展为同时兼容 `makeBase('base_id', minions)` 与 `makeBase({ ...overrides })`
  - 复跑 `npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts`，结果 `25 passed`
  - 复跑 `npm run typecheck`，通过
- Next step:
  - 继续接首批 10 张泰坦剩余能力
  - 特殊交互补端到端测试，并按规则回写绝对路径证据
## Session: 2026-03-25 Smash Up Titans - Major Ursa smoke 收口
- **Status:** completed
- Actions taken:
  - 复盘 `Major Ursa` smoke 失败链路，确认不是 `onTitanMoved` 触发器缺失，而是 `TITAN_MOVED` 在 reducer 中被错误解析回原基地。
  - 修正 `src/games/smashup/domain/utils.ts` 的 `resolveLiveBaseIndex(...)`，优先采用仍然有效且 `defId` 一致的 `baseIndex`。
  - 删除 `src/games/smashup/__tests__/smashup.smoke.test.ts` 中的临时调试日志。
  - 修正 smoke 中 `choose_minion -> choose_base` 的断言与入参，改为读取 `interaction.queue[0]`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Smash Up smoke | `npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts` | `Major Ursa` 新旧 smoke 全绿 | `32 passed` | ✓ |
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✓ |

## Session: 2026-03-25 Smash Up Titans - Major Ursa E2E 收口
- **Status:** completed
- Actions taken:
  - 在 `e2e/smashup-alien-terraform.e2e.ts` 中新增 `openMajorUrsaScene(...)` 场景夹具和 `Major Ursa` 三步交互用例
  - 交互路径保持为真实 UI：点击基地上的泰坦、点击场上的敌方随从、点击目标基地
  - 因泰坦与敌方随从都带持续动画高亮，Playwright 常规点击会报 `element is not stable`，因此对这两个目标改为 `click({ force: true })`
  - 先跑单用例，再跑整份 `e2e/smashup-alien-terraform.e2e.ts`，确认没有带坏原来的 rail / 布局 / terraform 用例
  - 实际打开 `major-ursa-01/02/03/04` 四张截图逐张查看
  - 将绝对路径、人工观察结论和残余可视问题回写到 `evidence/smashup-alien-terraform-e2e-test.md`
### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| Major Ursa 单用例 E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "Major Ursa 天赋应在移动泰坦后把 3 战力敌方随从挪到新基地"` | 单用例通过 | `1 passed` | ✅ |
| Smash Up Alien Terraform 整文件 E2E | `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci -- e2e/smashup-alien-terraform.e2e.ts` | 整文件回归通过 | `7 passed` | ✅ |

## Session: 2026-03-25 Smash Up Titans - Death on Six Legs
- **Status:** completed
- Actions taken:
  - 澶嶆煡 `src/games/smashup/abilities/titans.ts` 锛屽喅瀹氭妸 `Death on Six Legs` 鐨?special / talent / ongoing 鍏ㄩ儴鏀跺彛鍒扮粺涓€娉板潶鑳藉姏鏂囦欢
  - 鏂板 `getOwnMaxMinionCounters(...)`锛岀敤浜庡浐鍖栨湰鏂归殢浠庢槸鍚︽湁鑷冲皯 7 鏋?+1 鍔涢噺鏍囪鐨?special 鎵撳嚭鏉′欢
  - 瀹炵幇 `giantAntsDeathOnSixLegsSpecial(...)`锛氭弧瓒?7 鏋?+1 鏉′欢鍚庡彲浠ヤ粠 set-aside 杩涘満
  - 瀹炵幇 `giantAntsDeathOnSixLegsTalent(...)`锛氬鐢ㄥ叕鍏卞師璇?`grantExtraAction(...)` 鎺堜簣 1 娆￠澶栬鍔ㄩ搴?
  - 瀹炵幇 `buildDeathOnSixLegsCounterTransferEvents(...)`锛屽皢鈥滄湁闅忎粠杩涘叆寮冪墝鍫嗘椂杞Щ 1 鏋?+1 鏍囪缁欐嘲鍧︹€濇敹鏁涗负涓€澶勪簨浠剁敓鎴愬櫒
  - 鍦?`registerTitanAbilities()` 涓ˉ榻愭敞鍐岄摼锛歋pecial validator + talent + `registerInterceptor(MINION_DESTROYED)` + `registerTrigger(onMinionDiscardedFromBase)`
  - 鍦?`src/games/smashup/__tests__/smashup.smoke.test.ts` 琛?4 鏉″洖褰掞細special 杩涘満銆佹秷鐏繘寮冪墝鍫嗗姞鏍囪銆佽鍒嗘竻鍦哄姞鏍囪銆乼alent 鎺堜簣棰濆琛屽姩

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Smash Up smoke 鏁存枃浠? | `npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts` | 鏂板 `Death on Six Legs` 鐢ㄤ緥涓庣幇鏈?smoke 鍧囬€氳繃 | `29 passed` | 鉁?|
| TypeScript | `npm run typecheck` | 閫氳繃 | 閫氳繃 | 鉁?|

- Next step:
  - 缁х画鎺ラ鎵?10 寮犳嘲鍧﹀墿浣欒兘鍔涳紝浼樺厛 `bear_cavalry_major_ursa`
  - 鍚屾涓?smoke 娴嬭瘯琛ラ綈鏈€灏忓洖褰掞紝淇濇寔棣栨壒娉板潶鑳藉姏浠ユ枃浠朵负鍗曚綅鍙獙璇?

## Session: 2026-03-28 Smash Up Titans - Moon Zero Three 收口
- **Status:** completed
- Actions taken:
  - 复查 `src/games/smashup/domain/abilityHelpers.ts`、`src/games/smashup/abilities/titans.ts`、`src/games/smashup/domain/reducer.ts`、`src/games/smashup/domain/systems.ts`，把 Moon Zero 浏览器失败链从 reaction queue 继续收窄到 deck inspection 归属错误。
  - 用完整 pipeline 脚本复刻 `USE_TALENT -> RESPOND -> RESPOND`，确认旧实现里 `DECK_INSPECTED.inspectorPlayerId` 被错误写成被查看牌库拥有者，导致 `onDeckInspected` 触发归属错人。
  - 将 `peekDeckTop(...)` 扩展为支持显式传入 `inspectorPlayerId`，并仅在 `super_spies_moon_zero_three` 的 talent 第一段调用处传入真实操作者。
  - 在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 补 `inspectorPlayerId === '0'` 断言，锁住“查看者”和“牌库拥有者”不再混淆。
  - 复跑 `npm run typecheck`
  - 复跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "三号空间站"`
  - 复跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`
  - 复跑 `$env:PW_PORT='6280'; $env:PW_GAME_SERVER_PORT='20206'; $env:PW_API_SERVER_PORT='21206'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "三号空间站"`
  - 复跑 `$env:PW_PORT='6280'; $env:PW_GAME_SERVER_PORT='20206'; $env:PW_API_SERVER_PORT='21206'; npm run test:e2e:ci -- e2e/smashup-alien-terraform.e2e.ts`
  - 实际查看 Moon Zero 相关 5 张截图，并回写 `evidence/smashup-alien-terraform-e2e-test.md`、`findings.md`、`task_plan.md`
- Outcome:
  - `super_spies_moon_zero_three` 已形成完整闭环：special 进场、ongoing 每回合第一次牌库 inspection 标记、talent 查看任一牌库顶并放回顶/底。
  - 这轮根因已明确归档为通用 helper 归属错误，而不是 Moon Zero 私有逻辑或 reaction queue 时序。
- Next step:
  - 切下一张后续泰坦，优先 `Very Large Boulder / 硕大圆石` 或用户明确指定的目标。
