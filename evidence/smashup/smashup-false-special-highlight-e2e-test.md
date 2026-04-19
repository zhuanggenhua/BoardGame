# Smash Up 触发式 Special 误高亮 E2E 证据

## 范围

- 问题 1：`pecos_bill` 未进入“成为 duel challenger”触发链时，不应在泰坦栏显示为“可打出”。
- 问题 2：`cowboys_deputy_pod` 不应在基地上显示为可手动激活的绿色能力高亮。

## 运行结果

- E2E：`npm run test:e2e:ci:file -- e2e/smashup/smashup-alien-terraform.e2e.ts "触发式 special 不应在泰坦栏或基地上被错误高亮为可手动激活"`
- 结果：通过

## 关键截图与肉眼观察

### 1. 全景截图

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-alien-terraform.e2e\触发式-special-不应在泰坦栏或基地上被错误高亮为可手动激活\pecos-and-deputy-no-false-special-highlight.png`
- 我实际看到什么：
  - 左下泰坦栏里的 `Pecos Bill` 只有普通卡框，没有 `可打出` 黄条徽记。
  - 左侧基地上的 `副警长` 只有普通卡框，没有绿色描边、绿色 ring，也没有激活光晕。
- 是否达到验收标准：达到。本图同时证明了“泰坦误显示可打出”和“副警长误显示可激活”两处问题位点都已消失。

### 2. Pecos Bill 局部图

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-titan-rail\pecos-titan-rail-not-activatable.png`
- 我实际看到什么：
  - `Pecos Bill` 卡面下方只有名称标签“泰坦”。
  - 卡面上没有 `可打出` 黄条，也没有激活态视觉强调。
- 是否达到验收标准：达到。该截图直接证明 `pecos_bill` 不会再被错误标成可手动打出的泰坦。

### 3. 副警长局部图

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-titan-rail\cowboys-deputy-no-false-activation-glow.png`
- 我实际看到什么：
  - `副警长` 只有默认白色卡框。
  - 卡牌周围没有绿色边框、绿色 ring，也没有代表可激活的黄光叠层。
- 是否达到验收标准：达到。该截图证明 `副警长` 不再被当成可手动点按的 special。

## 相关验证

- Vitest：`npm test -- src/games/smashup/__tests__/smashup.smoke.test.ts`
- 结果：通过（97/97）

## 结论

- 本轮问题对应的两类误高亮已被修复：
  - 触发式泰坦 special 不再出现在牌库右侧泰坦栏的“可打出”状态中。
  - 触发式随从 special 不再在基地上显示为可手动激活。
