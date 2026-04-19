# 大杀四方疯狂牌供给 E2E 证据

## 测试目标

验证以下行为已经在端到端层面生效：

1. 只有本局存在疯狂牌派系时，牌库上方才显示疯狂牌供给角标。
2. 疯狂牌供给初始上限显示为 30。
3. 抽取疯狂牌后，供给会减少。
4. 疯狂牌被消耗后，不会回补供给。

## 执行命令

```bash
npm run test:e2e:ci:file -- smashup-robot-hoverbot-new.e2e.ts "疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补"
```

执行结果：通过

## 截图

### 1. 无疯狂派系时不显示

绝对路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补\madness-supply-hidden.png`

![无疯狂派系时不显示](../test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补/madness-supply-hidden.png)

观察结果：

- 左下角只有普通牌库，没有迷你疯狂牌角标。
- 这与同一用例里的断言 `su-madness-supply` 数量为 0 一致。

### 2. 有疯狂派系时初始显示 x 30

绝对路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补\madness-supply-initial.png`

![初始 x 30](../test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补/madness-supply-initial.png)

观察结果：

- 左下角牌库上方出现迷你疯狂牌角标。
- 角标文案清晰显示为 `x 30`。
- 说明疯狂牌供给只在存在疯狂牌派系时显示，且上限为 30。

### 3. 抽取疯狂牌后变为 x 29

绝对路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补\madness-supply-after-draw.png`

![抽取后 x 29](../test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补/madness-supply-after-draw.png)

观察结果：

- 左下角角标从 `x 30` 变成了 `x 29`。
- 这张截图是在打出 `cthulhu_whispers_in_darkness` 并抽到疯狂牌后生成的。
- 说明疯狂牌供给会被真实消耗，而不是固定显示。

### 4. 消耗疯狂牌后仍保持 x 29

绝对路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补\madness-supply-after-consume.png`

![消耗后仍为 x 29](../test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补/madness-supply-after-consume.png)

观察结果：

- 左下角角标仍然是 `x 29`，没有回到 `x 30`。
- 这张截图是在打出 `special_madness` 并选择“消耗这张疯狂牌”后生成的。
- 说明疯狂牌被消耗后只会从玩家区域移除，不会补回疯狂牌供给。

## 结论

本次 E2E 已证明：

1. 疯狂牌供给角标的显示条件正确。
2. UI 显示的剩余数量会随着抽取变化。
3. 疯狂牌供给已经从“可回收池”改为“有限供给池”，消耗后不会回补。
