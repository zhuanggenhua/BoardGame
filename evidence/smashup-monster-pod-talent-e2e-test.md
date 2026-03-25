# 大杀四方 POD 科学怪人「怪物」天赋点击验证

## 问题描述

用户反馈：POD 版科学怪人派系的「怪物」在准备发动天赋时，点击后看起来没有反应。

本次重点核对两条路径：

1. 没有 `+1` 力量指示物时，不应被当成可发动天赋。
2. 有 `1` 个 `+1` 力量指示物时，触屏路径应先进入武装态，再在第二次点击时成功发动，并给出明确反馈。

## 修复点

1. 统一了「怪物」天赋的前置条件判断：
   - 领域校验层禁止无 `+1` 指示物时发动。
   - execute 层增加兜底，避免误生成 `TALENT_USED`。
   - UI 层不再把无 `+1` 指示物的怪物渲染为可发动状态。
2. 成功发动后补充明确反馈：
   - 获得额外随从额度时弹出 `获得1次额外随从机会` toast。
3. 触屏交互补充提示：
   - 第一次点击进入武装态时显示 `再次点击发动`，避免用户误以为点击无效。

## 验证命令

```bash
npx tsc -p tsconfig.json --noEmit --pretty false
npm run test:e2e:ci -- e2e/smashup-4p-layout-test.e2e.ts
```

## 关键截图

1. 无指示物：
   - `D:\GA\BoardGame-main-clean\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端不会把没有+1力量指示物的怪物当成可发动天赋\12-monster-without-counter-does-not-arm-talent.png`
2. 有 1 个指示物并成功发动：
   - `D:\GA\BoardGame-main-clean\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端有+1力量指示物的怪物发动天赋后会移除指示物并提示额外随从机会\13-monster-with-counter-grants-extra-minion.png`

## 截图分析

### 1. 无 `+1` 指示物

- 怪物卡牌不会进入武装态。
- 点击后不会消耗天赋，不会误触发 `TALENT_USED`。
- E2E 断言了：
  - `data-activation-armed = false`
  - `talentUsed = false`

### 2. 有 `1` 个 `+1` 指示物

- 第一次点击进入武装态，并显示 `再次点击发动` 提示。
- 第二次点击后：
  - `powerCounters` 从 `1` 变为 `0`
  - `talentUsed` 变为 `true`
  - 玩家 `minionLimit` 从 `1` 增加到 `2`
- 页面断言命中 `获得1次额外随从机会`，说明成功反馈已到达 UI。

## 结论

问题已被拆成两部分并分别修复：

1. 无指示物时不再出现“明明不能用却还能点”的误导。
2. 有指示物时，触屏路径现在有明确的“第一次武装、第二次发动”提示，发动成功后也会看到额外随从机会反馈。
