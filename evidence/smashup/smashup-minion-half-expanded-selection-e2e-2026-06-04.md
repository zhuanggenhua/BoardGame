# 大杀四方随从选择半展开 E2E 验证

日期：2026-06-04

## 范围

- 目标：把大杀四方场上“选择随从”时的展示从“全展开”改为“半展开”。
- 验证点：
  1. 同一列多个可选随从进入选择态后，不再完全摊平。
  2. 同列至少 3 张候选时，三张都仍可辨认，不会被上层完全盖死。
  3. 最底部候选仍可直接点击，并在点击后正常收口。

## 代码变更

- `src/games/smashup/ui/BaseZone.tsx`
  - 选择态堆叠偏移从 `0` 改为 `layout.minionStackOffset * 0.5`，即半展开。
- `src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx`
  - 单测从“必须全展开 `0vw`”改为“半展开 `-2.75vw` 且底部可点击”。
- `e2e/smashup/smashup-base-minion-selection.e2e.ts`
  - 新增“同列多个候选半展开”验收场景与收口截图。

## 执行命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx --configLoader native
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "随从选择展示：同列多个候选应半展开且仍可点击底部随从"
```

## 截图证据

### 1. 选择态半展开

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择展示：同列多个候选应半展开且仍可点击底部随从\smashup-half-expanded-minion-selection.png`

肉眼观察：

- 左侧基地下同一列出现了 3 张可选随从，三张都能直接看到卡面主体，不再是完全重叠，也不是完全拉开成整卡高间隔。
- 中间两张仍有一定重叠，说明选择态已经从“全展开”收回到“半展开”。
- 最底部那张随从仍保留清晰的可点击露出区域，没有被上层卡面完全压住。
- 右侧 HUD、基地牌、结束回合区没有因为这次半展开而被挤歪，整体构图保持原场上布局。

验收结论：

- 达到“半展开”目标。
- 达到“同列多个候选时提高可见数量”的目标。

### 2. 点击底部候选后的收口

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择展示：同列多个候选应半展开且仍可点击底部随从\smashup-half-expanded-minion-selection-resolved.png`

肉眼观察：

- 点击最底部候选后，顶部“半展开验收：选择随从”横幅已经消失，说明本次选择交互已收口。
- 同列只剩 2 张随从，符合“第三张被成功选中并移除当前选择态”的结果。
- 原本最底部候选位置已经不再保留旧高亮链路，说明不是假点击或被上层遮挡后误触失败。

验收结论：

- 达到“底部随从仍可单独点击”的目标。
- 达到“点击后正常收口”的目标。

## 风险备注

- 当前半展开比例是“原负堆叠的一半”。这比之前的全展开更紧凑，但仍是固定比例。
- 如果后续用户觉得 3 张时仍偏松，可以继续把比例从 `0.5` 微调到 `0.6` 或 `0.65`，换取更高密度。
