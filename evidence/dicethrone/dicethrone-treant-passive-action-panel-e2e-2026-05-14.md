# DiceThrone 树精被动动作按钮收敛证据

## 范围

- 修复位置：`src/games/dicethrone/ui/PassiveAbilityPanel.tsx`
- 同步位置：`e2e/src/games/dicethrone/ui/PassiveAbilityPanel.tsx`
- 测试位置：`e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts`

## 规则核对结论

- 幼种树灵：只在自己的掷骰阶段消耗，用于重掷 1 颗自己的骰子。
- 木苗树灵：只在自己的主阶段消耗。`治疗+CP` 与 `抽牌` 是同一个 token 的两个替代用法；当 token 与 CP 条件满足时，两者可以同时作为二选一入口出现。
- 生命源泉：只在自己的主阶段消耗，触发奖励骰治疗。
- 因此 UI 不能常驻渲染所有树精被动动作；只能显示当前真实可用的动作，或重掷选择中的取消入口。

## 修复

- `PassiveAbilityPanel` 现在只渲染 `isUsable || isSelecting` 的动作。
- 不可用动作不再以灰按钮常驻占位。
- 按钮压缩为短动作名；token 消耗不再占第二行，完整代价保留在 `title` / `aria-label`。
- 有 CP 额外代价的动作仍显示 `1 CP`。

## 验证

- `npx eslint src/games/dicethrone/ui/PassiveAbilityPanel.tsx e2e/src/games/dicethrone/ui/PassiveAbilityPanel.tsx e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts`
- `npm run typecheck`
- `npx vitest run src/games/dicethrone/__tests__/treant-token-mechanics.test.ts --configLoader native --maxWorkers 1`：7 tests passed。
- `npm run test:e2e:ci -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts`：10 passed。

## 截图核对

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精生命源泉应在主阶段触发奖励骰治疗并收口\01-life-sap-entry-before-use.png`
  - 右侧只看到生命源泉对应的 `治疗` 入口。
  - 幼种重掷、木苗两个动作没有在主阶段无 token 条件下占位。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精木苗树灵两个主阶段按钮应短文案展示并真实结算\01-sapling-short-buttons-before-use.png`
  - 右侧只看到 `治疗+CP` 与 `抽牌` 两个木苗入口。
  - 这是同一个木苗 token 的两个可选用法；当前 CP 与 token 条件满足，所以两者同时显示是规则允许的。
  - 幼种重掷与生命源泉没有占位。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精幼种树灵应通过真实骰子按钮完成重掷\01-seedling-reroll-before-select.png`
  - 掷骰阶段右侧只看到 `重掷` 入口。
  - 木苗与生命源泉主阶段动作没有占位。

