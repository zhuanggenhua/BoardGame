# Smash Up `special` 激活语义重构 E2E 证据

## 范围

- 游戏：`Smash Up / 大杀四方`
- 本轮目标：
  - 不再让 `abilityTags.special` 直接决定“高亮 / 可点击 / 可执行”
  - 把“有没有手动入口”和“当前是否可用”彻底拆开
  - 触发式 `onPlay / beforeScoring / afterScoring` 能力不再因为挂了 `special` 被误亮
  - 真正可手动触发的 `special` 仍然按原规则正常高亮、点击、结算

## 语义结论

- `activation metadata` 现在只描述“这张牌有没有手动入口、入口在哪个 zone、哪个窗口”。
- UI 的高亮与点击资格不再猜测，也不再只看 `abilityTags.special`。
- 真正的“此刻能不能点”统一复用命令验证链：
  - `validateSpecialUse`
  - `validateTalentUse`
  - `activatableAbilities`
- 因此：
  - `ninja_acolyte` 这种真手动 special 会在满足条件时亮、条件不满足时熄灭。
  - `skeletons_gravestones` 这种“持续 + 计分后触发”的牌，不会因为带 `special` 语义就常亮。
  - `skeletons_revenant` 这类真实可手动入口仍会保留可点击链路。

## 本轮验证

### 单测

- 命令：`npm test -- src/games/smashup/__tests__/commandsValidation.test.ts`
- 结果：`32 passed`
- 结论：`commands` 层现在使用真实验证器判断 `special` / `talent` 可用性，旧的错误测试占位已清掉。

### 2026-05-15 追加：泰坦 `setaside special` 窗口回归

- 用户问题：确认泰坦 special 是否真有回归，不能把 FAB 面板最高层级当成问题处理。
- 回归判定：
  - `last known good`：`63a9f026449d960b72acd5d9e2f1203a75997b10`。
  - `first known bad`：`fde11638744718b742aafaabc21bcea377031ef5`，提交信息为 `重构 SmashUp 特殊激活模型并补齐相关回归`。
- 关键提交 hunk：
  - `fde11638` 新增 `src/games/smashup/domain/activationMetadata.ts`，其中 `hasCardActivatableAbility` 在查询带 `window` 时，若能力自身没有 `window`，会继续匹配。
  - 同一提交给大量泰坦新增 `{ kind: 'special', zone: 'setaside' }`，但没有写 `window`。
  - `validateTitanAbility` 会把泰坦 special 的当前窗口传给 `hasCardActivatableAbility`；因此这些无窗口的 setaside special 会误匹配 `beforeScoring` / `afterScoring`。
- 真实影响边界：
  - 不是 FAB 问题。
  - 不是所有泰坦都会真实暴露。没有 special executor 的泰坦后续仍会被 `resolveSpecial` 拦住。
  - 真问题是有 special executor 的代表泰坦会因为缺 `window` 而在计分响应窗口被错误放行，例如 `ghosts_creampuff_man`、`fairies_spirit_of_the_forest`、`wizards_arcane_protector`、`vampires_ancient_lord`、`giant_ants_death_on_six_legs`、`time_travelers_time_box`、`tricksters_big_funny_giant`、`explorers_very_large_boulder`。
- 修复策略：
  - 不改 FAB。
  - 不重写 validator。
  - 只还原错误 hunk 的合同：所有泰坦 `special:setaside` 显式补 `window: 'playCards'`；`penguins_emperor_penguin` 原本没有 setaside special，保持不变。

#### 追加验证

- 命令：`npm run test -- src/games/smashup/__tests__/commandsValidation.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
- 结果：`2 files passed`，`68 passed`。
- 命令：`npm run test:e2e:ci:file -- e2e/smashup/smashup-alien-terraform.e2e.ts "触发式 special 不应在泰坦栏或基地上被错误高亮为可手动激活"`
- 结果：`1 passed`，隔离端口 `6273/20100/21100`。
- 追加窗口矩阵：
  - `ghosts_creampuff_man`、`fairies_spirit_of_the_forest`、`tricksters_big_funny_giant`、`explorers_very_large_boulder`：`playCards=VALID`，`beforeScoring/afterScoring=该泰坦的特殊能力不能手动激活`。
  - `wizards_arcane_protector`、`vampires_ancient_lord`、`giant_ants_death_on_six_legs`、`time_travelers_time_box`：`playCards` 进入各自真实规则前置条件校验，`beforeScoring/afterScoring=该泰坦的特殊能力不能手动激活`。
- 静态检查：
  - `rg -n "kind: 'special', zone: 'setaside'(?!, window: 'playCards')" src/games/smashup/data/titans.ts e2e/src/games/smashup/data/titans.ts --pcre2` 无命中。
  - `src/` 与 `e2e/src/` 三个镜像文件无内容差异：`data/titans.ts`、`commandsValidation.test.ts`、`scoreBases-auto-continue.test.ts`。

### E2E

- 命令：

```powershell
$env:PW_USE_DEV_SERVERS='true'
$env:VITE_DEV_PORT='6176'
$env:GAME_SERVER_PORT='18000'
$env:API_SERVER_PORT='18001'
$env:PW_HAS_EXPLICIT_TARGET='true'

npx playwright test --config playwright.config.ts e2e/smashup/smashup-ninja-acolyte-extra-minion.e2e.ts --grep "应该授予基地限定随从额度并允许打出额外随从|应该允许选择跳过|同一基地不能使用两次|本回合已打出随从时应该无法使用"

npx playwright test --config playwright.config.ts e2e/smashup/smashup-alien-terraform.e2e.ts --grep "触发式 special 不应在泰坦栏或基地上被错误高亮为可手动激活"

npx playwright test --config playwright.config.ts e2e/smashup/smashup-robot-hoverbot-new.e2e.ts --grep "复仇者应可在回合中触发埋葬且同回合不重复触发|墓碑应在基地计分后可把自己埋葬到另一个基地"
```

- 结果：
  - `ninja_acolyte`：`4 passed`
  - `触发式 special 不误高亮`：`1 passed`
  - `skeletons_revenant`：`1 passed`
  - `skeletons_gravestones` 计分后迁移：`1 skipped`

## 关键截图与肉眼结论

### 1. 真手动 special：`ninja_acolyte` 可用时应亮，且点击后能真实结算

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-ninja-acolyte-extra-minion.e2e\应该授予基地限定随从额度并允许打出额外随从\ninja-acolyte-play-extra-minion.png`
- 我实际看到什么：
  - 场上这张《忍者侍从》被当成真实可交互对象使用，不是被动常亮摆设。
  - 额外随从打出后的场面已经变化，说明点击入口后真的走到了“授予基地限定额外随从额度 -> 打出额外随从”的链路。
- 是否达到验收标准：达到。真手动 special 的高亮与点击链路保留正常。

### 2. 真手动 special：条件失效后不应继续亮

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-ninja-acolyte-extra-minion.e2e\本回合已打出随从时应该无法使用\ninja-acolyte-disabled-after-minion.png`
- 我实际看到什么：
  - 同一张《忍者侍从》在“本回合已打出随从”后不再处于可用态。
  - 这不是静态数据差异，而是同一真实入口在 validator 失败后熄灭。
- 是否达到验收标准：达到。说明高亮由实时可用性驱动，而不是只看 `special` 标签。

### 3. 触发式 special：`skeletons_gravestones` 不再误高亮

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-titan-rail\skeletons-gravestones-no-false-activation-glow.png`
- 我实际看到什么：
  - 《墓碑》卡面本体可见，但没有绿色/黄色可激活描边，也没有可手动触发的光晕。
  - 用例里随后还直接强点了这张牌，并断言没有进入 `interaction.current`。
- 是否达到验收标准：达到。`skeletons_gravestones` 不会再因为挂了 `special` 语义而常亮、常点。

### 4. 触发式 special：整张代表图中《墓碑》与触发式泰坦都没有误亮

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\触发式-special-不应在泰坦栏或基地上被错误高亮为可手动激活\pecos-and-deputy-no-false-special-highlight.png`
- 我实际看到什么：
  - 泰坦栏里的 `Pecos Bill` 没有“可打出”黄条。
  - 基地上的触发式对象没有手动激活描边。
  - 这张全景图同时覆盖了“触发式泰坦”和“触发式场上牌”两类误亮场景。
- 是否达到验收标准：达到。误高亮问题不是只修一张牌，而是入口模型已统一收紧。

### 5. Skeletons 同类：`skeletons_revenant` 真实手动入口仍可用

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\复仇者应可在回合中触发埋葬且同回合不重复触发\skeletons-revenant-discard-panel-selected.png`
- 我实际看到什么：
  - 《复仇者》已经进入其真实交互链，不是“被重构掉入口”。
  - 交互面板已经打开，说明 validator 允许它在正确窗口暴露手动入口。
- 是否达到验收标准：达到。Skeletons 同类里真正的手动入口没有被本轮通用修复误杀。

### 6. Skeletons 同类：`skeletons_revenant` 结算后可收口，且同回合不重复

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\复仇者应可在回合中触发埋葬且同回合不重复触发\skeletons-revenant-second-card-no-repeat.png`
- 我实际看到什么：
  - 第一张《复仇者》结算后，后续对象不会在同回合继续错误重复触发同类入口。
  - 这证明“可用态来自 validator”不仅控制亮不亮，也控制用过后是否及时熄灭。
- 是否达到验收标准：达到。Skeletons 的真手动 special 当前仍按规则限次。

## `墓碑` 正路径的当前边界

- `skeletons_gravestones` 的“不要误高亮”本轮已现跑通过。
- `skeletons_gravestones` 的“基地计分后把自己埋到另一个基地”这条正路径：
  - 当前这轮重跑仍在 `setupSUOnlineMatch(...)` 阶段因为在线房间环境不可用而 `skip`
  - 不是断言失败，也不是 `special` 语义重构把它打坏
- 已有历史正路径证据：
  - 文档：`evidence/smashup/smashup-skeletons-returned-one-spooky-scary-gravestones-e2e-2026-04-29.md`
  - 截图：
    - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-gravestones-after-scoring-prompt-2026-04-29.png`
    - `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-gravestones-buried-2026-04-29.png`

## 结论

- 本轮 `special` 重构已经从“标签驱动高亮”切换到“入口 metadata + 实时 validator 驱动可用性”。
- 这次现跑证据已经覆盖了三类关键风险：
  - 真手动 `special` 仍可亮、可点、可结算
  - 触发式 `special` 不再误亮
  - Skeletons 同类中真手动入口保留，假手动入口熄灭
- 当前剩余的不是语义模型残缺，而是 `墓碑` 在线正路径在这轮重跑里仍受房间环境波动影响；因此本轮不拿这条 `skip` 冒充通过。
