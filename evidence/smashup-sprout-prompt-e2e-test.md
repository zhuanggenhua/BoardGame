# Smash Up - 嫩芽牌库检索交互 E2E 证据

## 目标

验证 `killer_plant_sprout` 的牌库检索交互在 UI 中会：

- 正确显示可选卡牌选项
- 正确显示“跳过”按钮
- 跳过后正常关闭交互，不再卡死

## 关联改动

- 显式交互元数据保留在 `src/games/smashup/abilities/killer_plants.ts`
- `responseValidationMode: 'live'` 保留在 `src/games/smashup/abilities/killer_plants.ts`
- 审计断言保留在 `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`
- 代表性 E2E 保留并补充在 `e2e/smashup-robot-hoverbot-new.e2e.ts`

## 验证命令

### 静态校验

```bash
npx tsc --noEmit
npx eslint vite.config.ts playwright.config.ts e2e/smashup-robot-hoverbot-new.e2e.ts src/games/smashup/abilities/killer_plants.ts src/games/smashup/abilities/wizards.ts src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts
```

说明：

- `tsc` 通过
- `eslint` 无 error，仅存在仓库内既有 warning

### 目标 E2E

```bash
npx cross-env PW_USE_DEV_SERVERS=true PW_PORT=5173 VITE_FRONTEND_URL=http://localhost:5173 GAME_SERVER_PORT=18000 API_SERVER_PORT=18001 PW_GAME_SERVER_PORT=18000 PW_API_SERVER_PORT=18001 npx playwright test e2e/smashup-robot-hoverbot-new.e2e.ts --grep "嫩芽牌库检索交互应显示卡牌选项并允许跳过"
```

结果：

- 1 passed

## 截图证据

### 1. 交互已显示可选项

![嫩芽交互可见](./screenshots/sprout-prompt-visible.png)

观察结果：

- 中央覆盖层显示标题“嫩芽：选择一个力量≤3的随从打出（可跳过）”
- 中央存在两张可选卡牌，标签分别为 `Sprout` 与 `Neophyte`
- 下方存在单独的“跳过”按钮
- 背景棋盘被正常遮罩，说明当前确实进入了阻塞式交互，而不是空弹窗

结论：

- 本次 bug 的核心现象“弹窗出现但没有可选项”已被修复
- `generic + displayMode: 'card' + autoRefresh: 'deck' + responseValidationMode: 'live'` 的组合能被 UI 正确渲染

### 2. 跳过后交互正常结束

![嫩芽交互跳过后状态](./screenshots/sprout-prompt-skipped.png)

观察结果：

- 覆盖层已经关闭，没有残留的卡牌选择面板
- 顶部出现提示 “Selection skipped. Deck reshuffled.”
- 左上角回合标识已回到可继续操作状态
- 基地上不再有 `Sprout` 的交互覆盖态，界面没有卡住
- 左下牌库计数仍为 `3`，符合“跳过后洗回牌库、不直接打出随从”的预期

结论：

- 点击“跳过”后交互能正确 resolve
- 玩家不会因为无选项或交互未关闭而卡死

## 额外说明

- 当前代码里真正暴露 `TestMatchRoom` 的路由仍是 `src/App.tsx:99` 的 `/play/:gameId/test`
- 因此本次 E2E 实际使用的是 `/play/smashup/test` 入口；这与文档中“`/play/<gameId>` 自动启用 TestHarness”的描述目前不一致，建议后续统一
