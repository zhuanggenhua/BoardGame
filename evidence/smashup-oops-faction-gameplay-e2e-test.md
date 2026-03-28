# Smash Up Oops 四派系 Gameplay E2E 证据

## 测试目标

验证本轮新增的三类浏览器交互已经真正可操作，而不只是领域状态存在：

- `Ancient Egyptians` 的埋葬条带与翻开交互
- `Cowboys` 的官方决斗链路 UI：`Pinkerton -> 决斗牌 -> Deputy -> 结算`
- `Samurai` 的“消灭己方随从后获得额外出牌额度”交互

## 执行命令

```bash
npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Ancient Egyptians 埋葬条带与翻开交互应在浏览器中可完成"
npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"
npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Samurai 额外出牌效果应在浏览器中兑现额外随从与行动额度"
```

## 结果

- 状态：通过
- 日期：`2026-03-28`

## 证据截图

### 1. Ancient Egyptians：埋葬条带与翻开

截图路径：

- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Ancient-Egyptians-埋葬条带与翻开交互应在浏览器中可完成\Oops-Ancient-Egyptians-埋葬条带与翻开交互应在浏览器中可完成-oops-bury-strip-before-uncover.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Ancient-Egyptians-埋葬条带与翻开交互应在浏览器中可完成\Oops-Ancient-Egyptians-埋葬条带与翻开交互应在浏览器中可完成-oops-bury-strip-after-uncover.png`

嵌入预览：

![Ancient Egyptians 翻开前](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Ancient-Egyptians-埋葬条带与翻开交互应在浏览器中可完成/Oops-Ancient-Egyptians-埋葬条带与翻开交互应在浏览器中可完成-oops-bury-strip-before-uncover.png)

![Ancient Egyptians 翻开后](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Ancient-Egyptians-埋葬条带与翻开交互应在浏览器中可完成/Oops-Ancient-Egyptians-埋葬条带与翻开交互应在浏览器中可完成-oops-bury-strip-after-uncover.png)

观察结论：

- 翻开前，基地旁可见埋葬条带与 `1` 张己方埋葬牌。
- 翻开后，埋葬条带数量归零。
- `You Can Take It With You` 进入弃牌堆，且当前玩家手牌数增加到 `4`。

### 2. Cowboys：官方决斗链路

截图路径：

- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-pinkerton-prompt.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-card-prompt.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-deputy-card-prompt.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-deputy-target-prompt.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算\Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-after-resolve.png`

嵌入预览：

![Cowboys Pinkerton](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-pinkerton-prompt.png)

![Cowboys 决斗牌](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-card-prompt.png)

![Cowboys Deputy 选牌](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-deputy-card-prompt.png)

![Cowboys Deputy 选目标](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-deputy-target-prompt.png)

![Cowboys 决斗结算后](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算/Oops-Cowboys-决斗交互应按官方链路完成-Pinkerton-决斗牌-Deputy-结算-oops-duel-after-resolve.png)

观察结论：

- 决斗横幅在全流程持续可见，文案明确提示处理顺序为 `Pinkerton / 决斗牌 / Deputy / 再结算胜负`。
- `Pinkerton` 阶段会弹出数量按钮，浏览器里可直接点击对应的放置指示物按钮。
- `决斗牌` 阶段显示专用提示与对应的跳过按钮，文案会随当前 locale 统一切换。
- `Deputy` 阶段先展示弃牌选择，再进入场上随从目标点击阶段。
- `Deputy` 目标选中后，`Deputy` 进入弃牌堆，失败随从离场，决斗横幅消失。

### 3. Samurai：额外随从/行动额度兑现

截图路径：

- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Samurai-额外出牌效果应在浏览器中兑现额外随从与行动额度\Oops-Samurai-额外出牌效果应在浏览器中兑现额外随从与行动额度-oops-extra-play-before-select.png`
- `D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\test-results\evidence-screenshots\smashup-phase-transition-simple.e2e\Oops-Samurai-额外出牌效果应在浏览器中兑现额外随从与行动额度\Oops-Samurai-额外出牌效果应在浏览器中兑现额外随从与行动额度-oops-extra-play-after-resolve.png`

嵌入预览：

![Samurai 额外出牌前](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Samurai-额外出牌效果应在浏览器中兑现额外随从与行动额度/Oops-Samurai-额外出牌效果应在浏览器中兑现额外随从与行动额度-oops-extra-play-before-select.png)

![Samurai 额外出牌后](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Samurai-额外出牌效果应在浏览器中兑现额外随从与行动额度/Oops-Samurai-额外出牌效果应在浏览器中兑现额外随从与行动额度-oops-extra-play-after-resolve.png)

观察结论：

- 目标己方随从会在棋盘上进入可点击高亮态。
- 点击后，该随从离场。
- 当前玩家的 `minionLimit` 与 `actionLimit` 从 `1` 提升到 `2`。

## 覆盖口径与限制

- 这三条 E2E 的目标是证明“新增交互类型在浏览器里可走通”，不是声明四派系所有正式出牌链都已用浏览器完整覆盖。
- `Cowboys` 这条是完整浏览器交互：真实打出 `Gunfighter`，并在浏览器里走完 `Pinkerton -> 决斗牌 -> Deputy -> 结算`。
- `Ancient Egyptians` 与 `Samurai` 这两条是“注入当前交互后完成浏览器点击”的证据：
  - `Ancient Egyptians` 直接注入 `ancient_egyptians_seal_the_tomb_uncover`
  - `Samurai` 直接注入 `samurai_yokai_attack`
- 因此这两条证明的是“埋葬翻开 UI / 目标点击 UI / 额度兑现 UI 已可工作”，不是“从手牌正常打出整张牌直到最终结算的 full-chain E2E”。
- 本轮额外修正了 Cowboys 决斗链的 i18n 不一致：决斗横幅、阶段提示和跳过按钮现在会一起跟随 locale，不再出现“英文横幅 + 中文交互按钮”的混搭。

## 同批门禁

除三条 gameplay E2E 外，本轮同批还已通过：

```bash
npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native
npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native
npm run typecheck
```

## 当前残留风险

- `cowboys_stagecoach` 当前只覆盖“同一基地选择 1-2 个己方随从移动到另一基地”，尚未覆盖更完整的 transfer 语义。
- `Ancient Egyptians / Samurai` 若要证明完整正式出牌链，后续仍需补 full-chain E2E，而不是只注入当前交互。
- Samurai 虽然已复用官方 duel 内核，但本轮浏览器出图只覆盖了 Cowboys 共享链路；Samurai 侧当前仍以领域测试证明 `VP / draw / destroy` 等不同 outcome。
