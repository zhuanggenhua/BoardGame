# 大杀四方幼龙卷走移入触发 E2E 证据

## 场景

- 用例：`e2e/smashup/smashup-longzu-audit.e2e.ts`，`龙：幼龙会让对手通过卷走移入本基地的随从本回合 -1 力量`
- 路径：对手手牌真实行动 `卷走`，选择把 `粉丝` 从第二个基地移入有 `幼龙` 的 `龙穴`

## 验证

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-longzu-audit.e2e.ts "龙：幼龙会让对手通过卷走移入本基地的随从本回合 -1 力量"
```

结果：`1 passed`

## 截图观察

- `test-results/evidence-screenshots/smashup/smashup-longzu-audit.e2e/龙：幼龙会让对手通过卷走移入本基地的随从本回合-1-力量/dragons-hatchling-carried-away-01-before-move.png`
  - 移动前，`幼龙` 在 `龙穴`，`粉丝` 在第二个基地，`粉丝` 显示力量 `2`。
- `test-results/evidence-screenshots/smashup/smashup-longzu-audit.e2e/龙：幼龙会让对手通过卷走移入本基地的随从本回合-1-力量/dragons-hatchling-carried-away-02-destination-choice.png`
  - `卷走` 结算到“选择移动目标基地”，`龙穴` 是可选目标之一。
- `test-results/evidence-screenshots/smashup/smashup-longzu-audit.e2e/龙：幼龙会让对手通过卷走移入本基地的随从本回合-1-力量/dragons-hatchling-carried-away-03-after-move-minus-one.png`
  - 移动后，`粉丝` 已进入 `龙穴`，卡面旁显示 `-1` 修正，底部有效力量显示为 `1`。
  - 画面出现“幼龙 触发！”提示，和状态断言 `tempPowerModifier = -1`、`effectivePower = 1` 对齐。
