# Smash Up Alien Terraform E2E 证据

## 2026-03-28 Update: Creampuff + 首批剩余 5 张审计补齐

### 本轮执行目标

- 对首批实现但尚未完成同等级收口的 5 张泰坦做最终覆盖裁决：
  - `ghosts_creampuff_man`
  - `wizards_arcane_protector`
  - `vampires_ancient_lord`
  - `innsmouth_dagon`
  - `giant_ants_death_on_six_legs`
- 约束是：E2E 只保留不重复交互；没有独立 UI 价值的牌，不再重复铺浏览器链。

### 本轮裁决

- `ghosts_creampuff_man / 奶油泡芙美人`
  - 需要新增 E2E。
  - 原因：存在“两段链式交互”，先弃 1 张手牌，再从弃牌堆额外打出 1 张标准战术，并在结算后改放牌库底；这条链与当前文件里已有用例不重复。
- `wizards_arcane_protector / 奥术守护者`
  - 不新增 E2E。
  - 原因：只有 special 进场、被动力量修正、直接抽 1 张牌，没有独立浏览器交互形态。
- `vampires_ancient_lord / 鲜血领主`
  - 不新增 E2E。
  - 原因：唯一交互是单目标随从选择，这一形态已被 `Great Wolf Spirit / Hill that Strolls` 的真实浏览器链代表覆盖。
- `innsmouth_dagon / 大衮`
  - 不新增 E2E。
  - 原因：special 进场与“授予基地限定额外随从额度”都已被其他泰坦和基地能力代表覆盖，没有新的 UI 入口形态。
- `giant_ants_death_on_six_legs / 六足死神`
  - 不新增 E2E。
  - 原因：special 进场、离场见证加标记、直接授予额外行动额度都已被现有 smoke 和同类浏览器链覆盖，不值得重复铺 E2E。

### 本轮执行命令

```powershell
npm run typecheck
$env:PW_PORT='6281'
$env:PW_GAME_SERVER_PORT='20207'
$env:PW_API_SERVER_PORT='21207'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "奶油泡芙美人天赋可在 UI 中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底"
```

### 本轮执行结果

- `npm run typecheck` 通过
- `奶油泡芙美人` 单条浏览器链：
  - `$env:PW_PORT='6281'; ...; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "奶油泡芙美人天赋可在 UI 中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底"`：`1 passed`

### 本轮产出的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\奶油泡芙美人天赋可在-UI-中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底\creampuff-talent-discard-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\奶油泡芙美人天赋可在-UI-中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底\creampuff-talent-play-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\奶油泡芙美人天赋可在-UI-中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底\creampuff-talent-resolved.png`

## 2026-03-28 Update: Time Box / 时间盒子 运行时闭环

### 本轮执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "时间盒子"
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6279'
$env:PW_GAME_SERVER_PORT='20205'
$env:PW_API_SERVER_PORT='21205'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "时间盒子可在达到第 5 枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度"
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 本轮执行结果

- `npm run typecheck` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "时间盒子"`：`3 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`：`78 passed`
- 单条 `Time Box` 浏览器链：
  - `$env:PW_PORT='6279'; ...; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "时间盒子可在达到第 5 枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度"`：`1 passed`
- 独立端口整份 `e2e/smashup-alien-terraform.e2e.ts`：`32 passed`
- 中途确实清掉了并发残留的重复 `openTimeBoxSpecialScene / openTimeBoxTalentScene`，但最终整份复跑已经恢复稳定，不再把之前的掉线尝试视为当前结论。

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\时间盒子可在达到第-5-枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度\time-box-play-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\时间盒子可在达到第-5-枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度\time-box-play-resolved.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\时间盒子可在达到第-5-枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度\time-box-talent-ready.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\时间盒子可在达到第-5-枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度\time-box-talent-resolved.png`

### 人工观察结论

- `time-box-play-choice.png`
  - 中央提示条明确显示“时间盒子：是否移除全部计数器并打出到一个基地？”，并保留两个高亮基地与 `跳过` 按钮，说明 special 是真实交互，不是自动落地。
  - 这一步选择的是场上的基地，不是未在场基地或基地牌库；与规则抄录口径一致。
- `time-box-play-resolved.png`
  - 时间盒子已真实落到中间基地上方，提示条消失，右侧 `Minion 1` 额度仍保留，说明这张牌的进场不走通常随从额。
  - 结算后场面布局稳定，没有因为从 set-aside 进场而挤坏基地或牌库区域。
- `time-box-talent-ready.png`
  - 在场时间盒子可直接点击，右下此时 `Minion 0 / Action 0`，与“通常额度已耗尽，只能靠天赋给额外额度”的场景前置一致。
  - 手牌区确实同时摆着 `2` 力随从和 1 张战术，适合验证“此基地额外低战力随从 + 额外战术”两段能力。
- `time-box-talent-resolved.png`
  - 左侧基地下方已同时出现 `First Mate` 与 `Hideout`，说明天赋给出的两种额外额度都进入了真实浏览器结算。
  - 右侧额度条显示 `Minion 1 / Action 0`，与“额外随从额度被消耗但不增加通常随从额度、额外战术额度被用掉”一致。

## 2026-03-28 Update: Walking Castle / 移动城堡 天赋交互顺序修正

### 本轮执行命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "移动城堡天赋会先选择目标基地，再选择至多 3 个己方随从一起移动过去"
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去"
```

### 本轮执行结果

- `Walking Castle` 这轮不是新能力接入，而是对真实交互路径做修正：
  - 旧链：先选随从，再选目标基地
  - 新链：先选目标基地，再选要一起移动的随从
- `node scripts/infra/vitest-cli-safe.mjs ...`：`1 passed`
- `npm run test:e2e:ci:file -- ...`：`1 passed`

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去\walking-castle-talent-choose-base.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去\walking-castle-talent-choose-minions.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去\walking-castle-talent-resolved.png`

### 人工观察结论

- `walking-castle-talent-choose-base.png`
  - 提示条已先显示“移动城堡：选择要移动到的基地”，说明交互起手点已改成直接选目标基地。
  - 当前基地上的泰坦与己方随从仍停在原地，未提前进入多选态。
- `walking-castle-talent-choose-minions.png`
  - 选完目标基地后才出现“已选 0 / 3”与“确认选择”，顺序已从旧链倒过来。
  - 这一步仍只允许从原基地己方随从中选，未把其他基地或敌方随从暴露成可选目标。
- `walking-castle-talent-resolved.png`
  - 移动城堡与被选中的 2 张己方随从都已落到中间目标基地。
  - 原左侧基地只剩未选择的那张己方随从，说明“带走一部分随从”的结算正确。

## 2026-03-28 Update: The Hill that Strolls / 漫游山岭巨人 运行时闭环

### 本轮执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "漫游山岭巨人"
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6275'
$env:PW_GAME_SERVER_PORT='20201'
$env:PW_API_SERVER_PORT='21201'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "硕大圆石可在随从移离后移动到目标基地并消灭低于其标记数的随从"
$env:PW_PORT='6276'
$env:PW_GAME_SERVER_PORT='20202'
$env:PW_API_SERVER_PORT='21202'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "哥佐拉在本基地打出战术后会加 1 标记并可通过交互抽 1 张牌"
$env:PW_PORT='6277'
$env:PW_GAME_SERVER_PORT='20203'
$env:PW_API_SERVER_PORT='21203'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从"
$env:PW_PORT='6278'
$env:PW_GAME_SERVER_PORT='20204'
$env:PW_API_SERVER_PORT='21204'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 本轮执行结果

- `npm run typecheck` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "漫游山岭巨人"`：`3 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`：`75 passed`
- 这轮先把整份 E2E 里曾失败的旧链逐条改用独立端口复跑：
  - `硕大圆石`：`1 passed`
  - `哥佐拉`：`1 passed`
  - `企鹅帝皇`：`1 passed`
- 最终用新端口整份复跑 `e2e/smashup-alien-terraform.e2e.ts`：`31 passed`
- 结论是：此前整文件里出现的 4 条失败不是 `Hill` 业务回归，而是测试服务端口/启动冲突导致的偶发环境失败；改成独立端口串行复跑后已全部消失。

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\漫游山岭巨人交出己方随从控制权并抽牌后，会通过真实交互给该随从放置-1-枚力量标记\hill-that-strolls-counter-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\漫游山岭巨人交出己方随从控制权并抽牌后，会通过真实交互给该随从放置-1-枚力量标记\hill-that-strolls-give-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\漫游山岭巨人交出己方随从控制权并抽牌后，会通过真实交互给该随从放置-1-枚力量标记\hill-that-strolls-give-resolved.png`

### 人工观察结论

- `hill-that-strolls-give-choice.png`
  - 提示条先要求选择“要交出控制权的己方随从”，左侧己方随从被高亮，说明第一段交互确实是先选交出的目标，不是直接起加标记 prompt。
  - 左下牌库计数为 `1`，与这条天赋会先抽 1 张牌的场景前置一致。
- `hill-that-strolls-counter-choice.png`
  - 交出控制权并抽牌后，第二段 prompt 才询问“是否为该随从放置 1 枚 +1 力量标记”，并同时给出“放置标记 / 跳过”两个按钮。
  - 此时被交出的随从已经停在对手控制的一侧，说明 ongoing 见证的是控制权变更后的真实场面，不是旧快照。
- `hill-that-strolls-give-resolved.png`
  - 结算后该随从身上可见新增的 `+1` 标记，底部战力也从 `2` 变为 `3`。
  - 漫游山岭巨人仍稳定留在中间基地上方，布局没有因控制权转移和后续 prompt 而被带坏。

### 本轮补充结论

- `ignobles_the_hill_that_strolls` 这轮已经形成完整闭环：
  - `special`
  - `ongoing`：你把自己某个随从控制权交给别人后，可为其加 1 标记
  - `talent`：交出己方随从控制权并抽 1 张牌，或夺回这里一个你拥有的随从
- 这轮还补了一条新的通用领域原语：
  - `MINION_CONTROL_CHANGED`
  - `processAffectTriggers` 现在会正式处理 `control_change`
  - `onMinionAffected` 支持用 `baseScoped: false` 表达“不是 here 限定”的全局见证类泰坦效果

## 2026-03-28 Update: Emperor Penguin / 企鹅帝皇 运行时闭环

### 本轮执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 本轮执行结果

- `npm run typecheck` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`：`72 passed`
- `npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`：`29 passed`
- 这轮新增的浏览器证据聚焦 `penguins_emperor_penguin` 的三条链：
  - 回合开始时通过交互进场到满足条件的基地
  - 在同一张泰坦上同时露出 `持续 / 天赋` 双主动入口
  - 通过天赋把低战力随从洗回牌库并获得 1 枚力量指示物

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇可在回合开始交互中打到满足条件的基地\emperor-penguin-play-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇可在回合开始交互中打到满足条件的基地\emperor-penguin-play-resolved.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从\emperor-penguin-activation-menu.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从\emperor-penguin-ongoing-resolved.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\企鹅帝皇在同回合同时具备持续与天赋入口时可通过天赋按钮洗回低战力随从并获得标记\emperor-penguin-talent-resolved.png`

### 人工观察结论

- `emperor-penguin-play-choice.png`
  - 左侧基地已先有 3 张己方随从，中央提示条明确显示“企鹅帝皇：选择要进场的基地”，并保留 `跳过`，说明回合开始 special 是真实交互，不是自动落地。
  - 这一步只高亮满足条件的基地，未把另外两个基地错误暴露成可选目标。
- `emperor-penguin-play-resolved.png`
  - 企鹅帝皇已经落到左侧基地上方中央，右下 `Minion` 额度变为 `0`，与“进场仍消耗通常随从额”一致。
  - 左侧原有 3 张己方随从仍保留在下方，没有被泰坦入场挤坏布局。
- `emperor-penguin-activation-menu.png`
  - 同一张在场企鹅帝皇上方同时出现 `持续` 与 `天赋` 两个小按钮，说明桌面端双主动入口已经真实可见，不再是“点击后无事发生”的假可用状态。
  - 右下仍保留 `Minion 1` 额度，左下牌库计数为 `1`、右下弃牌计数为 `1`，与“持续可打牌库顶、天赋也可用”的场景前置一致。
- `emperor-penguin-ongoing-resolved.png`
  - 结算后左侧基地上方新增了牌库顶随从，右下 `Minion` 从 `1` 变成 `0`，说明持续主动能力确实是“代替通常随从打出牌库顶随从”。
  - 牌库计数降为 `0`，与该随从来自牌库顶的语义一致。
- `emperor-penguin-talent-resolved.png`
  - 这张图停留在真实的 `REVEAL_HAND` overlay 上，不是测试残留；中间可见被展示的 `First Mate`，说明从手牌选择目标后的展示链已进浏览器。
  - 左侧基地上方的企鹅帝皇角标已到 `1`，左下牌库计数变为 `2`，右下弃牌仍为 `0`，和“手牌中的低战力随从洗回牌库并给泰坦 +1 标记”的结算一致。

### 本轮补充结论

- `penguins_emperor_penguin` 这轮已经形成完整闭环：
  - `onTurnStart special`
  - 在场 `ongoingActivation`
  - `talent`
- 这轮还顺手修掉了两个真实缺口：
  - `BaseZone` 桌面端的“同一张泰坦有多个主动入口”此前不会显按钮，只会吞点击；现已改为桌面端点击后显式展开。
  - `e2e/framework/GameTestContext.ts` 里对带 `cardUid` 的按钮式交互曾优先错误点击手牌卡面；现已改成先点可见按钮，再退回卡面。

## 2026-03-28 Update: Very Large Boulder / 硕大圆石 运行时闭环

### 本轮执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 本轮执行结果

- `npm run typecheck` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`：`69 passed`
- `npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`：`26 passed`
- 这轮新增的浏览器证据聚焦 `explorers_very_large_boulder` 的两条链：
  - 通过右侧泰坦栏按通常随从额进场到空基地
  - 在有随从移离后通过交互移动到目标基地，并消灭低于其标记数的随从

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\硕大圆石可通过牌库右侧泰坦栏按通常随从额打到没有玩家随从的基地\very-large-boulder-rail-ready.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\硕大圆石可通过牌库右侧泰坦栏按通常随从额打到没有玩家随从的基地\very-large-boulder-rail-resolved.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\硕大圆石可在随从移离后移动到目标基地并消灭低于其标记数的随从\very-large-boulder-move-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\硕大圆石可在随从移离后移动到目标基地并消灭低于其标记数的随从\very-large-boulder-move-resolved.png`

### 人工观察结论

- `very-large-boulder-rail-ready.png`
  - 中间基地为空，右侧泰坦栏里的圆石可见且可点击，说明 special 的“打到没有玩家随从的基地”前置条件在真实 UI 中成立。
  - 右下 `Minion 1` 额度仍可用，符合“尚未用通常随从额”的预期。
- `very-large-boulder-rail-resolved.png`
  - 圆石已经落到左侧基地上方中央，原本空基地被正常占位，没有压坏下方卡槽。
  - 右下 `Minion` 额度从 `1` 变为 `0`，与“代替通常随从进场”一致。
- `very-large-boulder-move-choice.png`
  - 中央提示条明确显示“硕大圆石：是否移动到「飞船」？”，并提供“移动并结算 / 跳过”两个按钮，说明 onMinionMoved 触发链真实进入浏览器。
  - 圆石此时仍停在左侧原基地，右侧目标基地已有敌方随从，状态与“有随从移离后再决定是否跟着移动”的规则一致。
- `very-large-boulder-move-resolved.png`
  - 圆石已经移动到中间目标基地上方，左侧基地只剩基地牌，不再残留旧位置影子。
  - 目标基地总战力从 `4` 变为 `3`，说明低于 2 力的敌方随从已被真实消灭，只留下高于阈值的那张敌方随从。
  - 提示条已消失，布局稳定，没有把基地徽章或随从区挤坏。

### 本轮补充结论

- `explorers_very_large_boulder` 这轮已经形成完整闭环：
  - `special`
  - `onMinionMoved` 触发移动
  - 移动后按当前标记数消灭低战力随从
  - `onTurnEnd` 本回合未移动则加 1 标记
- 这轮还补了一条通用触发基础设施：
  - `onMinionMoved` 现在同时支持“移入基地”和“从基地移离”两种 base-scoped ongoing 触发语义。
  - `collectTriggers` 在入队阶段就能按运行时来源信息拦住“同一张圆石同回合第二次新触发”，不再只靠消费时清理已排队副本。

## 2026-03-27 Update: Megabot / 超级佐德 运行时闭环

### 本轮执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 本轮执行结果

- `npm run typecheck` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`：`63 passed`
- `npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`：`22 passed`
- 这轮新增的浏览器证据聚焦 `mega_troopers_megabot` 的两条链：
  - 通过右侧泰坦栏按通常随从额进场
  - 在另一基地计分前通过交互移动到该基地

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\超级佐德可通过牌库右侧泰坦栏按通常随从额打到有你至少三个随从的基地\megabot-rail-ready.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\超级佐德可通过牌库右侧泰坦栏按通常随从额打到有你至少三个随从的基地\megabot-rail-resolved.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\超级佐德可在另一基地计分前通过交互移动到该基地\megabot-before-scoring-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\超级佐德可在另一基地计分前通过交互移动到该基地\megabot-before-scoring-resolved.png`

### 人工观察结论

- `megabot-rail-ready.png`
  - 左侧基地已经有 3 张己方随从，说明 special 的进场门槛在 UI 上真实成立。
  - 右侧泰坦栏可见且可点击，说明超级佐德已经进入真实出牌入口，不是只在领域测试里存在。
- `megabot-rail-resolved.png`
  - 超级佐德已经落到左侧基地上方中央，没有把下方 3 张随从挤出布局。
  - 右下角 `Minion` 额度从 `1` 变成 `0`，和“代替通常随从进场”的规则一致。
- `megabot-before-scoring-choice.png`
  - 中央提示条明确显示“超级佐德：是否移动到即将计分的基地？”，并提供“移动到该基地 / 留在原地”两个按钮，说明 beforeScoring 特殊能力已真实进 UI。
  - 超级佐德此时仍停在左侧基地，上方中间位置稳定，没有因为弹提示而漂移。
- `megabot-before-scoring-resolved.png`
  - 结算后超级佐德已经移动到中间即将计分的基地，原基地上方不再残留旧位置影子。
  - 提示条已消失，整体布局保持稳定，没有把中间基地的卡槽和计分徽章挤乱。

### 本轮补充结论

- `mega_troopers_megabot` 这轮已经形成完整闭环：
  - `special`
  - `beforeScoring` 移动
  - `ongoing` 按己方随从数提供力量
- 这张牌没有引入新命令入口或新计数器建模，完全复用了现有泰坦能力骨架和计分前交互链。

## 2026-03-27 Update: Gorgodzolla / 哥佐拉 运行时闭环

### 本轮执行命令

```powershell
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 本轮执行结果

- `npm run typecheck` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`：`60 passed`
- `npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`：`20 passed`
- 这轮新增的浏览器证据只聚焦 `kaiju_gorgodzolla` 的两条链：
  - 通过右侧泰坦栏按通常随从额进场
  - 在本基地打出战术后加 1 标记，并经交互选择后抽 1 张牌

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\哥佐拉可通过牌库右侧泰坦栏按通常随从额打到有你至少两个战术的基地\gorgodzolla-rail-ready.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\哥佐拉可通过牌库右侧泰坦栏按通常随从额打到有你至少两个战术的基地\gorgodzolla-rail-resolved.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\哥佐拉在本基地打出战术后会加-1-标记并可通过交互抽-1-张牌\gorgodzolla-draw-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\哥佐拉在本基地打出战术后会加-1-标记并可通过交互抽-1-张牌\gorgodzolla-draw-resolved.png`

### 人工观察结论

- `gorgodzolla-rail-ready.png`
  - 左侧基地上方已经能肉眼看到 2 张先在场的战术牌，说明 special 的前置条件在 UI 上确实成立。
  - 右侧泰坦栏可见且可点击，说明这张泰坦已经进入真实可操作入口，而不是只在测试注入状态里“理论可打”。
- `gorgodzolla-rail-resolved.png`
  - 哥佐拉已经落到左侧基地上方中央，两侧已有战术牌没有被挤掉或覆盖。
  - 右下角 `Minion` 额度从 `1` 变成 `0`，和“以代替打出通常随从来打出此泰坦”的规则一致。
- `gorgodzolla-draw-choice.png`
  - 左侧基地上的哥佐拉角标已变成 `1`，说明“你在本基地打出战术后放置 1 枚 +1 战力标记”先于抽牌选择生效。
  - 中央提示条明确显示“哥佐拉：你可以抽 1 张牌”，并提供“抽 1 张牌 / 跳过”两个按钮，说明这里不是被硬编码成强制抽牌。
  - 左下角牌库计数为 `1`，与这条用例里预置的单张牌库相符。
- `gorgodzolla-draw-resolved.png`
  - 结算后底部手牌区出现 1 张新手牌，同时左下角牌库计数降为 `0`，和“选择抽 1 张牌”完全对上。
  - 哥佐拉身上的 `1` 枚标记仍然保留，没有在抽牌后被错误清掉或重置。

### 本轮补充结论

- `kaiju_gorgodzolla` 这轮已经形成完整闭环：
  - `special`
  - `onMinionPlayed` 加标记
  - `onActionPlayed` 加标记
  - `onActionPlayed` 的可选抽牌交互
- 同时确认了一条之前未真正接通的通用链路：`onActionPlayed` 的 ongoing trigger 现在已经能进入真实反应队列并驱动交互。

## 执行命令

```powershell
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

补充：

- 这条布局证据用例现在会在截图前额外等待 `900ms`，确保显式证据图反映的是动画收稳后的最终布局，而不是入场过渡帧。

## 执行结果

- 结果：`6 passed`
- 工作目录：`D:\gongzuo\webgame\BoardGame-smashup-titans`
- 截图根目录：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e`
- 本次“泰坦与持续行动布局”统一收口到同一个业务目录：
  `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定`

## 2026-03-26 Update: 泰坦纵向锚点再收敛

### 本轮执行命令

```powershell
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 本轮执行结果

- 结果：`7 passed`
- 这轮改动的重点不是再放大泰坦，而是继续收敛“有持续行动时的泰坦纵向锚点”。
- 我这次复看的重点仍然是布局，不是牌面美术；如果截图里 R2/CDN 资源没渲染出来，只影响卡面细节，不影响对位置、层级、遮挡和相对大小的判断。

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\01-2p-five-ongoings-with-titan.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\03-4p-five-bases-with-titan.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\Major-Ursa-天赋应在移动泰坦后把-3-战力敌方随从挪到新基地\major-ursa-04-after-resolution.png`

### 人工观察结论

- `01-2p-five-ongoings-with-titan.png`
  - 泰坦比上一轮更接近两侧持续行动的同一视觉层级。
  - “被抬高后显得更小”的感觉明显减轻。
  - 泰坦仍位于中间，没有压住两侧持续行动。
- `03-4p-five-bases-with-titan.png`
  - 四人局最左基地仍保持正确方向。
  - 泰坦仍在中间，持续行动仍朝棋盘内侧排，没有回退成之前错误方向。
- `major-ursa-04-after-resolution.png`
  - 无持续行动时的泰坦摆位没有被本轮改坏。
  - `Major Ursa` 仍稳定停在基地上方中央。

### 本轮结论

- 当前单泰坦并没有真的比普通随从更小；这轮更像是在修正纵向锚点带来的视觉错觉。
- 本轮改动和复核已经完成，并已同步登记进 `task_plan.md`、`findings.md`、`progress.md`。

## 2026-03-26 Update: Cthulhu 泰坦天赋交互证据补录

### 本轮执行结果

- 结果：`9 passed`
- 这轮新增的重点不是布局，而是 `cthulhu_cthulhu_titan` 的双分支天赋交互：
  - 抽 `1` 张疯狂卡
  - 把手中的 `1` 张疯狂卡交给另一位玩家
- 我这次已经实际打开并查看下面 4 张截图；结论来自肉眼观察，不是只根据测试通过或代码逻辑推断。
- 截图里仍有 R2/CDN 牌面资源未渲染的问题，所以本轮验收重点放在布局、交互入口、分支切换和结算结果。

### 本轮实际复看的截图

- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\克苏鲁泰坦天赋可在分支选择后抽-1-张疯狂卡\cthulhu-titan-talent-draw-choice.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\克苏鲁泰坦天赋可在分支选择后抽-1-张疯狂卡\cthulhu-titan-talent-draw-resolved.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\克苏鲁泰坦天赋可把手中的疯狂卡交给另一位玩家\cthulhu-titan-talent-give-target.png`
- `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\克苏鲁泰坦天赋可把手中的疯狂卡交给另一位玩家\cthulhu-titan-talent-give-resolved.png`

### 人工观察结论

- `cthulhu-titan-talent-draw-choice.png`
  - 左侧基地上方的 `Cthulhu` 泰坦保持在基地上方中央，没有掉进随从区。
  - 中央提示条已经出现“选择要执行的天赋效果”，并同时给出两个按钮，说明“双分支都可执行”时会先起分支选择。
  - 第二个按钮的中文排版有明显异常，肉眼能看到文字挤压/重叠，这属于现存 UI 文案渲染问题，不应当被忽略。
- `cthulhu-titan-talent-draw-resolved.png`
  - 分支选择后，底部手牌从 `1` 张变成 `2` 张，肉眼可见抽牌结果已经结算。
  - 左侧基地右上角的力量指示从 `0` 变成 `1`，和“抽到疯狂卡后给泰坦加 `1` 枚力量标记”的预期一致。
  - 天赋提示条已经消失，说明这条交互在抽牌分支下能直接闭环结束。
- `cthulhu-titan-talent-give-target.png`
  - 当只剩“转交疯狂卡”这条路径时，界面不再先给分支选择，而是直接进入“选择接收玩家”的下一步。
  - 中央只出现一个玩家目标按钮，说明目标集合被正确收窄为对手玩家，而不是错误列出自己。
  - 这张图里底部仍有 `1` 张手牌，说明目标选择前并没有提前把疯狂卡从手里移走。
- `cthulhu-titan-talent-give-resolved.png`
  - 结算后底部手牌消失，说明这张疯狂卡已经离开当前玩家手牌。
  - 左侧基地右上角力量仍是 `0`，没有错误触发“转交疯狂卡也加自己力量”的回归 bug。
  - 提示条已消失，说明“选玩家 -> 转交”这条链路也已完整收口。

### 本轮补充结论

- `cthulhu_cthulhu_titan` 的天赋分支 UI 已经形成正确的两种路径：
  - 双分支都可用时，先选天赋效果。
  - 只剩单分支可用时，直接进入该分支的下一步，不多弹一层无意义 prompt。
- 这次看图同时确认了一个真实 UI 问题：分支选择里较长的中文按钮文案有挤压/重叠，后续要单独修。
- 这轮证据已经补完；后续继续推进其它泰坦能力时，应保持“实现 -> E2E -> 实看截图 -> 回写 evidence”这条链。

## 人工看图记录

- 本文结论不是只根据 `6 passed` 得出，而是已实际打开三张关键截图逐张查看。
- `01-2p-five-ongoings-with-titan.png` 肉眼可见左侧 3 张、右侧 2 张持续行动绕开中间泰坦，泰坦没有掉进随从区。
- `01-2p-five-ongoings-with-titan.png` 在加入截图前等待后，行动卡不再出现“越往后越像还没长到最终大小”的过渡态错觉。
- `02-2p-five-ongoings-no-titan.png` 肉眼可见 5 张持续行动连续排布，没有因为这次改动平白留出中间空洞。
- `03-4p-five-bases-with-titan.png` 当前最新版已切成“中间固定泰坦 + 左右独立容器”的布局；在四人局最左边基地中，持续行动全部进入泰坦右侧的内向容器。
- `03-4p-five-bases-with-titan.png` 当前图里 5 张持续行动的可见宽度已经稳定一致，不再像早先截图那样给人“右边更小”的动画残影。

## 关键截图

### 1. 二人局：基地有泰坦且有 5 张持续行动

- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\01-2p-five-ongoings-with-titan.png`

结论：

- 泰坦仍位于基地上方居中，没有掉进随从区。
- 5 张持续行动现在按“左容器 3 张 / 右容器 2 张”贴着泰坦两侧摆放。
- 持续行动之间没有额外留白，只保留卡牌边框本身的视觉分隔。
- 泰坦没有压住两侧持续行动。
- 左侧最外一张持续行动已贴近画面边缘，但仍完整可见，没有被裁掉。

### 2. 二人局对照：基地无泰坦但有 5 张持续行动

- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\02-2p-five-ongoings-no-titan.png`

结论：

- 没有泰坦时，5 张持续行动连续排布。
- 对照图证明中间留白只会在基地上存在泰坦时出现。
- 右侧卡没有出现明显“越往右越小”的失真感。

### 3. 四人局：5 个基地且首个基地有泰坦与 5 张持续行动

- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\03-4p-five-bases-with-titan.png`

结论：

- 四人局 5 基地场景可正常渲染。
- 左侧第一个基地不再通过整排平移来硬挤位置。
- 最左基地现在是“泰坦固定在中间偏左，持续行动全部进入其右侧容器”，方向上已经切到棋盘内侧。
- 从截图能直接看出，最左侧不再残留一张单独悬在外侧的持续行动。

## 回归范围

同一轮 E2E 继续覆盖并通过以下链路：

- `alien_terraform` 三步交互
- 跳过额外随从打出
- 基地牌堆为空时优雅失败
- 通过牌库右侧泰坦栏打出可视作随从的泰坦
- 通过牌库右侧泰坦栏按行动额打出 `cthulhu`
- 二人局下泰坦与 5 张持续行动同场布局
- 二人局下无泰坦的 5 张持续行动对照布局
- 四人局 5 基地下泰坦与 5 张持续行动布局

## 结论

- 当前这个业务已经统一到一个截图目录，不再拆成多个“每种情况一个文件夹”。
- 本轮 E2E 已实际跑通，关键截图已人工复核。

## 2026-03-25 Major Ursa Update

### 执行命令

```powershell
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci -- e2e/smashup-alien-terraform.e2e.ts
```

### 执行结果

- 结果：`7 passed`
- 新增用例：`Major Ursa 天赋应在移动泰坦后把 3 战力敌方随从挪到新基地`

### Major Ursa 关键截图

#### 1. 选择目标基地
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\Major-Ursa-天赋应在移动泰坦后把-3-战力敌方随从挪到新基地\major-ursa-01-choose-destination.png`

人工观察：
- 左侧基地上方的 `Major Ursa` 已处于可点击高亮态，说明泰坦天赋入口可见。
- 棋盘上同时存在 3 个基地，可继续进行“选目标基地”的第一步。

#### 2. 选择敌方随从
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\Major-Ursa-天赋应在移动泰坦后把-3-战力敌方随从挪到新基地\major-ursa-02-choose-minion.png`

人工观察：
- `Major Ursa` 已经从左侧基地移动到中间基地上方，说明第一步移动已生效。
- 中间基地下方的敌方随从被紫色边框高亮，第二步“选敌方 3 力随从”入口可见。

#### 3. 选择新基地
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\Major-Ursa-天赋应在移动泰坦后把-3-战力敌方随从挪到新基地\major-ursa-03-choose-base.png`

人工观察：
- 被选中的敌方随从仍停留在中间基地下方，说明第二步只是锁定目标，没有提前误移动。
- 右侧基地仍为空，保留了第三步“把该随从挪去别的基地”的目标位置。

#### 4. 结算完成
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\Major-Ursa-天赋应在移动泰坦后把-3-战力敌方随从挪到新基地\major-ursa-04-after-resolution.png`

人工观察：
- `Major Ursa` 最终停在中间基地上方，没有回弹回原基地。
- 原本位于中间基地下方的敌方随从已经被挪到右侧基地下方，三步交互闭环完成。
- 泰坦角标由初始 `1` 增至 `2`，和天赋“先加 1 指示物再移动”的预期一致。

### 补充说明

- 该用例里的泰坦卡和随从卡都带持续动画高亮，常规 Playwright `click()` 会被判定为 `element is not stable`。
- 因此测试保留真实 DOM 点击目标，但对泰坦和被高亮随从改用 `click({ force: true })`，避免动画导致的误超时。

### 当前复跑观察到的残余问题

- 这次隔离 E2E 环境里，截图中的牌面美术没有正常渲染，当前主要依赖位置、高亮、角标与标签来判读交互结果。
- 交互提示条里的中文文案也仍然存在乱码现象。
- 这两个现象在本轮没有继续展开修复，但已经在实际看图时确认存在，不能当作“截图完全正常”来汇报。
# 2026-03-25 Update

- 本轮不是只看 `6 passed` 就下结论，而是再次实际打开以下 3 张图复核：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\01-2p-five-ongoings-with-titan.png`
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\02-2p-five-ongoings-no-titan.png`
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\03-4p-five-bases-with-titan.png`
- 二人局有泰坦时，泰坦顶部现在明显高于持续行动一排，不再是只往下多露一截。
- 泰坦尺寸已经恢复为和其他场景一致，本轮结论不是“放大后更顺眼”，而是“大小保持一致，只把位置上抬”。
- 二人局无泰坦的 5 张持续行动对照图未回归，说明这轮微调只改变了“有泰坦时”的纵向关系。
- 四人局最左基地里，泰坦也同步抬高，方向仍保持“泰坦居中、持续行动朝棋盘内侧排”，没有退回之前那种整排歪掉的方案。

## 2026-03-26 Kraken + Great Wolf Spirit Update

### 执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 执行结果

- `npm run typecheck` 通过
- `smashup.smoke.test.ts` 结果：`43 passed`
- `e2e/smashup-alien-terraform.e2e.ts` 结果：`13 passed`

### 海怪克拉肯：天赋移动并减力

## 2026-03-27 Rainboroc Update

### 执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 执行结果

- `npm run typecheck` 通过
- `smashup.smoke.test.ts` 结果：`57 passed`
- `e2e/smashup-alien-terraform.e2e.ts` 结果：`18 passed`

### 彩虹鸟关键截图

#### 1. 计分后替换基地进场选择
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟可在基地计分后的替换基地交互中进场\rainboroc-play-replacement-choice.png`

人工观察：
- 画面中央已经出现“彩虹鸟：是否将其打出到替换的基地？”提示，下面同时有“打出彩虹鸟”和“跳过”两个按钮，说明 afterScoring 的 special 交互已真实起出。
- 左侧基地下方还能看到你方 1 张 2 力随从，说明这一步仍发生在计分结算链中，而不是被提前清场后才补弹窗。
- 牌面资源仍有未稳定渲染的白卡现象，但不影响确认提示条、按钮和基地相对位置。

#### 2. 计分后替换基地进场结算完成
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟可在基地计分后的替换基地交互中进场\rainboroc-play-replacement-resolved.png`

人工观察：
- 中央提示条已经消失，说明“是否进场”的交互没有卡在半路。
- 场上可见 `Factory 436-1337`，说明替换基地已经完成补发，不是只把泰坦打出却漏掉基地替换。
- 左侧基地上方仍保留一张泰坦卡面占位，没有回到牌库旁，说明这条链的最终结果是“留在场上”而不是被后续计分事件冲掉。

#### 3. 天赋第一步：选择弃牌堆低战力随从
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟天赋可通过真实交互把低战力随从洗回牌库并移动到其他基地\rainboroc-talent-choose-discard.png`

人工观察：
- 画面中央出现“彩虹鸟：选择弃牌堆中一个战力 2 或更低的随从洗回牌库”的大字提示，第一段交互语义清晰。
- 右下角 `Discard (1)` 可见，说明这一步确实是从弃牌堆选牌，而不是错误读成手牌或牌库。
- 左侧基地上方的彩虹鸟仍留在场上，说明点天赋后没有把泰坦本体隐藏掉。

#### 4. 天赋第二步：选择是否移动到其他基地
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟天赋可通过真实交互把低战力随从洗回牌库并移动到其他基地\rainboroc-talent-choose-base.png`

人工观察：
- 提示条已切换成“彩虹鸟：你可以将其移动到另一个基地”，说明第一步洗回牌库后，交互确实推进到了第二段。
- 左下角牌库计数已经变成 `1`，右下角弃牌堆变成 `0`，肉眼可见那张 2 力随从已经离开弃牌堆进入牌库。
- 中间和右侧基地都带黄色高亮边框，且底部有“留在原基地”按钮，说明“移动”和“跳过移动”两个分支都在 UI 上可见。

#### 5. 天赋结算完成
- 绝对路径：`D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\彩虹鸟天赋可通过真实交互把低战力随从洗回牌库并移动到其他基地\rainboroc-talent-resolved.png`

人工观察：
- 中央提示条已经消失，说明双段天赋链完整结束，没有残留交互。
- 左下角牌库仍是 `1`、右下角弃牌堆仍是 `0`，和“把随从洗回牌库”结算后的状态一致。
- 彩虹鸟卡面占位已经从左侧基地上方移动到中间基地上方，说明第二段“移动到其他基地”在真实 UI 中已经落地。

### 本轮结论

- `Rainboroc / 彩虹鸟` 现在已经完成“afterScoring special + once-per-turn ongoing + talent 双段交互”的领域闭环。
- 这张牌的 afterScoring 进场不能直接在交互 handler 里立刻发 `TITAN_PLAYED`；真实链路里必须先挂到 `pendingPostScoringActions`，等 deferred 的 `BASE_REPLACED` 补发后再真正落地。
- 本轮截图里仍偶尔有泰坦或选牌白卡面，但交互提示、按钮、牌库/弃牌计数和泰坦位置变化都清晰可见，足以支撑功能验收。

- 选择目标基地：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\海怪克拉肯天赋可移动并让目标基地敌方随从-1-战力直到你的下回合开始\kraken-talent-choose-base.png`
- 结算完成：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\海怪克拉肯天赋可移动并让目标基地敌方随从-1-战力直到你的下回合开始\kraken-talent-resolved.png`

人工观察：

- 第一张图里海怪克拉肯位于中间基地上方，左右两个其他基地都保持可选，说明“先点泰坦，再选目标基地”的交互入口正常出现。
- 结算图里海怪克拉肯已经移动到中间基地上方。
- 目标基地左下红框敌方随从出现 `-1` 标记，右下蓝框己方随从没有被误伤。

### 海怪克拉肯：计分后进替换基地

- 选择是否进场：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\海怪克拉肯计分后可通过交互打到替换基地\kraken-play-replacement-choice.png`
- 结算完成：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\海怪克拉肯计分后可通过交互打到替换基地\kraken-play-replacement-resolved.png`

人工观察：

- 选择图里中央按钮文案明确是“是否将其打出到替换的基地”，不是错误地落成普通基地选择。
- 结算图里左侧基地已经替换为 `Factory 436-1337`，海怪克拉肯也落在新基地上方，说明“补发 BASE_REPLACED 后再落泰坦”这条链是通的。

### 海怪克拉肯：计分后救出己方随从

- 选择随从：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\海怪克拉肯计分后可把此处己方随从移到其他基地而不进入弃牌堆\kraken-rescue-choose-minion.png`
- 选择基地：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\海怪克拉肯计分后可把此处己方随从移到其他基地而不进入弃牌堆\kraken-rescue-choose-base.png`
- 结算完成：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\海怪克拉肯计分后可把此处己方随从移到其他基地而不进入弃牌堆\kraken-rescue-resolved.png`

人工观察：

- 选择随从图里左侧基地下方只有己方那张海盗随从被高亮，符合“只允许救自己随从”。
- 第二张图里进入的是“选择要移动到的基地”，说明这条链不是点了随从后直接自动落点。
- 结算图里左侧旧基地已被替换，中间基地下方出现被救出的海盗随从，旧基地下方不再残留这张牌，说明它确实没有跟着清场进弃牌堆。

### Great Wolf Spirit：天赋真实交互

- 选择目标随从：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\Great-Wolf-Spirit-天赋可通过真实交互让己方随从直到回合结束获得-+1-战力\great-wolf-spirit-choose-minion.png`
- 结算完成：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\Great-Wolf-Spirit-天赋可通过真实交互让己方随从直到回合结束获得-+1-战力\great-wolf-spirit-resolved.png`

人工观察：

- 选择图里顶部提示明确写着“选择一个你的随从获得 +1 战力直到回合结束”，左侧己方随从被高亮，说明 titan -> minion 这条真实交互入口已经出现。
- 结算图里左侧随从左上角出现绿色 `+1` 标记，底部力量从 `2` 变成 `3`，而巨狼之灵本体仍停在中间基地上方，没有误移动。

### 本轮结论

- `The Kraken` 已形成完整闭环：天赋移动减力、计分后进替换基地、计分后救己方随从三条链都已在真实浏览器里走通并看图确认。
- `Great Wolf Spirit` 已至少补齐一条真实 UI 证据：点击泰坦、选择己方随从、直到回合结束 `+1` 战力。
- 当前隔离 E2E 环境里牌面美术仍然不稳定，验收依旧以位置、高亮、力量角标和状态变化为主，而不是卡面插画。

## 2026-03-26 Big Funny Giant Update

### 执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 执行结果

- `npm run typecheck` 通过
- `smashup.smoke.test.ts` 结果：`48 passed`
- `e2e/smashup-alien-terraform.e2e.ts` 结果：`14 passed`

### 滑稽巨人：弃牌交互

- 选择手牌弃置：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\滑稽巨人的弃牌交互可在-UI-中选择手牌并完成弃置\big-funny-giant-discard-choice.png`
- 结算完成：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\滑稽巨人的弃牌交互可在-UI-中选择手牌并完成弃置\big-funny-giant-discard-resolved.png`

人工观察：

- 第一张图里顶部提示条明确写着“选择 1 张手牌弃置，才能把随从打到这里”，说明 `Big Funny Giant` 的持续限制已经以真实交互形式出现，而不是静默结算。
- 第一张图底部中央同时亮出 2 张手牌，说明当前确实是在“从剩余手牌里二选一弃置”，不是错误地把刚打出的那张牌也算进可弃集合。
- 结算图里底部只剩 1 张手牌，右下角弃牌堆计数变成 `1`，说明所选手牌已经真正进入弃牌堆。
- 结算图里左侧基地上方的滑稽巨人仍保持在基地上方中央，这条交互没有把泰坦布局或层级带坏。

### 本轮结论

- `tricksters_big_funny_giant` 已形成最小正确闭环：
  - `special` 进空基地
  - 对手打随从时的强制弃牌限制
  - 回合结束加泰坦指示物
  - `talent` 双段交互
- 这轮在真实浏览器里稳定保留了“弃牌交互”证据；其余链路由 smoke 覆盖，不再把不稳定的 UI 链路硬留在主 E2E 文件里。

## 2026-03-27 Mergacon Update

### 执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6274'
$env:PW_GAME_SERVER_PORT='20200'
$env:PW_API_SERVER_PORT='21200'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts
```

### 执行结果

- `npm run typecheck` 通过
- `smashup.smoke.test.ts` 结果：`54 passed`
- `e2e/smashup-alien-terraform.e2e.ts` 结果：`16 passed`

### 合体机器人：回合开始进场

- 选择进场基地：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人可通过回合开始交互进场到满足条件的基地\mergacon-play-choice.png`
- 结算完成：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人可通过回合开始交互进场到满足条件的基地\mergacon-play-resolved.png`

人工观察：

- 选择图顶部提示明确写着“合体机器人：选择要进场的基地”，并保留了“跳过”按钮，说明这条链是回合开始触发的可选 special，不是被错误做成强制自动进场。
- 左侧基地被高亮，且该基地下方已有 2 张己方机器人，符合“你在该基地有至少 2 个随从”这一进场条件。
- 结算图里合体机器人已落在左侧基地上方，基地总战力从 `4` 提升到 `7`，说明进场和 `+3 ongoing` 两段都已同时生效。

### 合体机器人：天赋移动并压制持续能力

- 选择目标基地：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人天赋可移动泰坦并写入本回合持续能力压制标记\mergacon-talent-choose-base.png`
- 结算完成：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人天赋可移动泰坦并写入本回合持续能力压制标记\mergacon-talent-resolved.png`

人工观察：

- 选择图顶部提示明确写着“合体机器人：选择要移动到的基地”，说明点击泰坦后真实进入了 talent 交互，而不是落成普通基地点击。
- 结算图里合体机器人已经从左侧基地移动到中间基地上方，左侧基地总战力回落到 `1`，说明它本回合的 `+3 ongoing` 确实被压制掉了。
- 中间基地总战力显示为 `4`，与“泰坦基础战力落位但持续能力本回合失效”的预期一致，没有把 `+3 ongoing` 错误带到新基地。

### 本轮结论

- `changerbots_mergacon` 已形成完整闭环：
  - 回合开始时的可选 special 进场
  - 所在基地 `+3` 的 ongoing
  - talent 移动并在本回合压制自身持续能力
- 上一轮卡住的 E2E 问题已确认是测试环境阻塞，不是实现缺陷；在 Docker 环境恢复后，整份 `smashup-alien-terraform.e2e.ts` 已稳定通过。

## 2026-03-28 Moon Zero Three Update

### 执行命令

```powershell
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "三号空间站"
$env:PW_PORT='6280'
$env:PW_GAME_SERVER_PORT='20206'
$env:PW_API_SERVER_PORT='21206'
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "三号空间站"
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native
$env:PW_PORT='6280'
$env:PW_GAME_SERVER_PORT='20206'
$env:PW_API_SERVER_PORT='21206'
npm run test:e2e:ci -- e2e/smashup-alien-terraform.e2e.ts
```

### 执行结果

- `npm run typecheck` 通过
- `smashup.smoke.test.ts -t "三号空间站"` 结果：`3 passed`
- `smashup.smoke.test.ts` 整文件结果：`81 passed`
- `e2e/smashup-alien-terraform.e2e.ts "三号空间站"` 结果：`2 passed`
- `e2e/smashup-alien-terraform.e2e.ts` 整文件结果：`34 passed`

### 三号空间站：牌库右侧 rail 进场

- 进场前：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\三号空间站可通过牌库右侧泰坦栏按通常随从额打到没有其他玩家随从的基地\moon-zero-rail-ready.png`
- 进场后：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\三号空间站可通过牌库右侧泰坦栏按通常随从额打到没有其他玩家随从的基地\moon-zero-rail-resolved.png`

人工观察：

- 进场前截图里左侧基地下方只有己方红框随从，中间基地下方是对手蓝框随从，说明 special 的合法基地与非法基地场面都已摆出来。
- 进场后截图里三号空间站本体已经落到左侧基地上方，右侧 rail 的常规随从额度从 `Minion 1` 变成 `Minion 0`，说明它确实按通常随从额完成进场，而不是走了额外免费旁路。
- 中间基地的对手随从仍停留在原位，没有出现“可打到有其他玩家随从的基地”的错误落点。

### 三号空间站：天赋查看牌库顶并放顶/放底

- 选择牌库：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\三号空间站天赋可查看任一牌库顶并将其放到牌库底\moon-zero-talent-choose-player.png`
- 选择放回位置：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\三号空间站天赋可查看任一牌库顶并将其放到牌库底\moon-zero-talent-resolve-choice.png`
- 结算完成：
  - `D:\gongzuo\webgame\BoardGame-smashup-titans\test-results\evidence-screenshots\smashup-alien-terraform.e2e\三号空间站天赋可查看任一牌库顶并将其放到牌库底\moon-zero-talent-resolved.png`

人工观察：

- 第一张图里顶部提示明确写着“选择要查看的牌库”，弹窗里只有“玩家二的牌库”，说明天赋第一段是先选目标牌库，而不是直接偷看默认目标。
- 第二张图里提示条已展示“玩家二牌库顶是【微型机守护】，选择放回位置”，下方同时出现“放回牌库顶 / 放到牌库底”两个按钮，说明第二段交互已正确拿到真实牌库顶信息。
- 第三张图里左下角牌库顶卡背已经从 `robot_microbot_guard` 变成另一张牌背，结合 E2E 断言的最终顺序 `['moon-target-next', 'moon-target-top']`，可确认“放到底”真实改写了牌序，而不是只改 UI。
- 这条链在领域层还额外验证了计数器闭环：浏览器用例断言三号空间站在这次查看后获得了第 1 枚指示物。

### 本轮结论

- `super_spies_moon_zero_three` 已形成完整最小闭环：
  - special 只能打到没有其他玩家随从的基地
  - ongoing 能见证每回合第一次查看 / 展示 / 检索牌库并加 1 标记
  - talent 能查看任一玩家牌库顶 1 张，并把它放回顶或底
- 这轮真实根因不是 reaction queue，而是通用 helper `peekDeckTop(...)` 把“牌库拥有者”误当成了 `inspectorPlayerId`。修正后，`DECK_INSPECTED -> TRIGGER_QUEUED -> TRIGGER_CONSUMED -> TITAN_POWER_COUNTER_ADDED` 全链已在完整 pipeline 中验证通过。
