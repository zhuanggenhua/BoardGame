# 大杀四方 POD 科学怪人「怪物」天赋点击验证

## 问题描述

用户反馈：POD 版科学怪人派系的「怪物」在准备发动天赋时，点击后看起来没有反应。
本次修复聚焦两条路径：
1. 没有 `+1` 力量指示物时，不应被当成可发动天赋。
2. 有 `1` 个 `+1` 力量指示物时，触屏路径应先进入武装态，再在第二次点击时成功发动，并给出明确反馈。

## 实现内容

1. 统一了「怪物」天赋的前置条件判断：
   - 领域校验层禁止无 `+1` 指示物时发动。
   - execute 层增加兜底，避免误生成 `TALENT_USED`。
   - UI 层不再把没有 `+1` 指示物的怪物渲染成可发动状态。
2. 成功发动后补充明确反馈：
   - 获得额外随从额度时弹出 `获得1次额外随从机会` toast。
3. 触屏交互补充提示：
   - 第一次点击进入武装态时显示 `再次点击发动`，避免用户误以为点击无效。
4. 同步补了回归测试：
   - Vitest：POD 怪物无指示物时的校验与 execute 兜底。
   - Vitest：POD 弃牌/检索弹窗卡图预览统一走 `smashup-card-renderer`。
   - Playwright：补了两条移动端怪物天赋交互用例。

## 已执行验证

```bash
npx tsc -p tsconfig.json --noEmit --pretty false
npx vitest run src/games/smashup/__tests__/ui-interaction-manual.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts
```

结果：
- `tsc` 通过
- 目标 Vitest 通过

## E2E 阻塞情况

尝试执行：

```bash
npm run test:e2e:ci -- e2e/smashup-4p-layout-test.e2e.ts
```

阻塞原因不是本次修复，而是测试环境在应用初始化阶段就失败，导致 `__BG_TEST_HARNESS__` 无法注册。

失败上下文显示：

```text
Failed to resolve import "html2canvas" from "src/components/system/MobileEvidenceCaptureAgent.tsx"
TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:6174/src/components/system/MobileEvidenceCaptureAgent.tsx
```

因此：
- 本次没有生成可用的 E2E 证据截图
- 现有 Playwright 失败属于独立环境依赖问题，需先补齐 `html2canvas` 依赖或修复该动态导入链路后，才能继续验证新增用例

## 结论

这次 POD 修复的核心逻辑已经完成，并通过了类型检查和目标单测。
E2E 仍需在修复 `MobileEvidenceCaptureAgent.tsx` 的 `html2canvas` 依赖问题后重新运行。
