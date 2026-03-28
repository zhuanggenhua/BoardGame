# 王权骰铸攻击修正 E2E 证据

## 目标

验证两件事：

1. 未先选择攻击技能时，打出攻击修正牌会出现正确提示。
2. 已先选择攻击技能时，攻击修正 UI 会显示在骰区上方，且不会被遮挡。

## 执行记录

- Vitest：
  `node scripts/infra/vitest-cli-safe.mjs run src/components/__tests__/ToastContext-dedupe.test.tsx --configLoader native`
- Playwright：
  在同一 shell 内临时启动 Vite，再执行
  `npx playwright test e2e/dicethrone-watch-out-spotlight.e2e.ts --project chromium --grep "attack modifier should show the correct timing prompt after invalid play|selected attack should show visible attack-modifier ui above the dice tray"`

## 截图 1：错误时机提示

截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\attack-modifier-should-show-the-correct-timing-prompt-after-invalid-play\07-attack-modifier-timing-prompt.png`

截图结论：

- 右上角只出现 1 条拒绝提示，不再重复。
- 提示文案为 `Select an attack ability before playing this attack modifier`。
- 手牌仍保留该牌，符合“拒绝打出”的预期。

## 截图 2：攻击修正 UI

截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\selected-attack-should-show-visible-attack-modifier-ui-above-the-dice-tray\08-attack-modifier-ui-visible.png`

截图结论：

- 两个徽章以单排形式绝对定位在骰盘正上方。
- `+2 Damage` 与 `Attack Modifier` 没有再纵向堆叠，也没有挤压右侧动作区。
- 两个徽章都在视口内，没有被右侧栏裁切或遮挡。

## 最终结果

- 攻击修正失败提示已改为“先选择攻击技能，再打出此牌”。
- 攻击修正 UI 已恢复可见，并通过 E2E 证明确实显示在骰区上方。
