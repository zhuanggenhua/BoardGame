# Smash Up Homeworld 本地人连打 E2E 证据

## 范围

- 目标链路：`印斯茅斯 本地人 -> 家园 (The Homeworld) -> 连续额外打出低战力随从 -> 尝试再打 3 力随从`
- 结论口径：
  - 当前仓库实际行为会继续叠加 `力量<=2` 的额外随从额度。
  - 当前仓库仍会拦截 `3` 力随从继续打出。
  - 因此本轮复现到的是“持续连打低战力”的现有行为，不是“连 3 力也无限打”的更严重回归。

## 执行命令

```bash
node scripts/infra/run-e2e-command.mjs dev e2e/smashup/smashup-innsmouth-locals-reveal-simple.e2e.ts --grep "本地人打到家园后会继续叠额外低战力额度，但 3 力随从仍然不能继续打出"
```

```bash
npx vitest run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/baseAbilityIntegration.test.ts src/games/smashup/__tests__/baseRestrictions.test.ts -t "base_the_homeworld|母星|家园|Homeworld"
```

## 截图观察

### 1. 第一次本地人打到家园，展示正确出现

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-homeworld-locals-chain-step1-first-reveal.png`
- 我实际看到：
  - 屏幕中央出现“玩家P0 的牌库顶”展示浮层，三张牌依次是 `本地人 / aliens_scout / 本地人`。
  - 左侧家园已经有 1 张己方随从，基地总力量显示为 `2/23`。
  - 手牌区还剩 3 张牌，说明本地人展示后确实把两张同名牌加入了后续可打链。
- 是否达到本轮验收标准：达到。证明第一次触发链真实出现，不是纯状态注入伪结果。

### 2. 第二次本地人继续打到家园，额外额度继续生效

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-homeworld-locals-chain-step2-second-reveal.png`
- 我实际看到：
  - 家园左侧己方随从已经叠到 2 张，基地总力量变成 `4/23`。
  - 展示浮层仍然再次出现，不是只触发一次。
  - 手牌区降为 2 张，说明第二次本地人已成功落地并继续推进链路。
- 是否达到本轮验收标准：达到。证明同回合第二张低战力随从仍能继续利用家园效果。

### 3. 第三次本地人仍可继续打出

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-homeworld-locals-chain-step3-third-reveal.png`
- 我实际看到：
  - 家园左侧己方随从已经叠到 3 张，基地总力量变成 `6/23`。
  - 展示浮层第三次出现，仍然是同一条本地人翻牌链。
  - 手牌区只剩 1 张牌，说明第三张本地人也被实际打出。
- 是否达到本轮验收标准：达到。证明当前实现里“本地人 -> 家园”不是一次性额外额度，而是会继续叠。

### 4. 尝试继续打 3 力外星人时被门禁拦住

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-homeworld-locals-chain-step4-big-minion-blocked.png`
- 我实际看到：
  - 顶部连续出现 `该基地不可选择` 提示。
  - 家园左侧仍只有前面那 3 张己方随从，总力量仍是 `6/23`，没有继续增加。
  - 中间基地仍为空，底部那张被选中的手牌没有成功落地。
- 是否达到本轮验收标准：达到。证明当前链路虽然会持续给 `力量<=2` 的额外额度，但 `3` 力随从并没有借这个链路穿门禁。

## 代码与测试基线

- 实现位置：`src/games/smashup/domain/baseAbilities.ts:1118`
  - 当前实现是“每次有随从打到家园，就再 grant 一次 `powerMax: 2` 的额外随从额度”。
- 仓库现有集成测试：`src/games/smashup/__tests__/baseAbilityIntegration.test.ts:536`
  - 其中已有“打出随从到母星后 `minionLimit` 增加”和“同回合连续打出低战力随从时，应持续获得额外额度”的测试。
- 仓库现有限制测试：`src/games/smashup/__tests__/baseRestrictions.test.ts:83`
  - 已覆盖 `extraMinionPowerMax = 2` 时，`power>2` 随从被拒、`power<=2` 随从通过。

## 最终判断

- 相对当前仓库基线：这不是新回归。现有实现和现有单测本来就允许“家园持续叠低战力额外额度”。
- 相对你怀疑的现象：如果你担心的是“会不会连 3 力都无限打”，这次 E2E 没复现到；`3` 力随从仍被拦住。
- 相对官方规则口径：当前仓库实现大概率仍有规则偏差。Alderac 官方 Aliens 规则页把 `The Homeworld` 写成 `Once per turn, after you play a minion here...`
  - 参考：<https://smashup-rulebook.alderac.com/wiki/Aliens>
