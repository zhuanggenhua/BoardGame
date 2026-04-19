# 王权骰铸：攻击投掷阶段出牌与复制交互 E2E 证据（2026-03-11）

## 结论

- `card-me-too`（俺也一样）在 `offensiveRoll` 阶段现在可以正常打出。
- 复制交互允许把**已锁定骰子**作为复制源，也允许把**已锁定骰子**作为复制目标。
- 本次补的端到端校验是可信的：不再错误读取 Harness 中不存在的本地 multistep 状态，而是直接验证真实 UI 与最终游戏状态。

## 根因

这次排查确认有两个层面：

1. 业务语义层  
   `modifyDie` 交互不应该因为骰子已锁定（`isKept`）就禁止选择。锁定只影响重投保留，不影响卡牌/效果改骰。

2. E2E 观测层  
   `useMultistepInteraction` 的中间结果保存在 React 本地状态里，不会在第一步点击后立即写回 `sys.interaction.current.data.result`。  
   因此，旧 E2E 在第一步选源骰后等待 Harness 状态变化，属于错误断言，会把“功能正常”误报成“不能出牌”。

## 修改

### 1. 增强骰子按钮的可观测性

- 文件：`src/games/dicethrone/ui/DiceTray.tsx`
- 变更：
  - 在真实可点击的骰子按钮上补充：
    - `data-selected`
    - `data-clickable`
    - `data-display-value`

这样 E2E 可以直接验证：

- 第一步点源骰后，该骰子是否进入已选中状态
- 当前 UI 显示的骰值是否符合预期

### 2. 修正 `card-me-too` 的 E2E 断言方式

- 文件：`e2e/dicethrone-watch-out-spotlight.e2e.ts`
- 变更：
  - 不再等待 `sys.interaction.current.data.result`
  - 改为校验骰子按钮的 `data-selected="true"` 与 `data-display-value`
  - 最终仍通过 Harness 断言落地后的真实状态：
    - 骰值
    - 锁定状态
    - 手牌消耗

## 实际运行结果

### E2E

执行命令：

```bash
npm run test:e2e:dev:file -- e2e/dicethrone-watch-out-spotlight.e2e.ts
```

结果：

- `4 passed`

覆盖内容：

1. 自己打出 `Watch Out` 时显示卡牌特写与骰子特写
2. 暴击只增加总伤害，不重复显示攻击修正伤害徽章
3. `card-me-too` 在攻击投掷阶段允许复制已锁定骰子
4. 对手打出 `Lucky` 时，己方只看到卡牌特写，不重复出现多骰 overlay

### 领域层回归

执行命令：

```bash
npm run test -- flow.test.ts -t copy
```

结果：

- 通过

说明 `card-me-too` 的复制命令链路没有被这次 UI/E2E 修正破坏。

## 截图分析

### 1. `card-me-too` 最终态

截图：

- `e2e/test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/俺也一样-copy-模式应允许选择已锁定骰子作为源和目标-07-me-too-locked-dice-copy.png`

观察：

- 左侧阶段高亮仍停留在 `Offensive Roll Phase`
- 右侧前两颗骰子仍显示 `LOCKED`
- 说明复制完成后，锁定语义没有被破坏

结合 E2E 最终断言可确认：

- 最终骰值为 `[6, 3, 4, 6, 3]`
- 最终锁定状态为 `[true, true, false, false, false]`
- 两张 `card-me-too` 已全部消耗

这正对应两次复制：

1. `die0(6, locked) -> die3`，结果 `die3 = 6`
2. `die4(3) -> die1(locked)`，结果 `die1 = 3`

### 2. 对手 `Lucky` 不重复 overlay

截图：

- `test-results/dicethrone-watch-out-spotl-be393-0-只应看到卡牌特写，不应重复看到多骰-overlay-chromium/05-p0-after-p1-play-lucky-no-duplicate-overlay.png`

观察：

- 画面中央只保留卡牌特写及绑定的 3 颗骰子
- 没有额外独立的多骰 overlay 浮层

说明这条回归链路也保持正常，没有被本次改动带坏。

## 备注

- 这次“攻击投掷阶段无法打出这张牌”的直接假象，最终确认并不是领域规则拒绝出牌，而是旧 E2E 读错了本地交互状态。
- 现在的 E2E 改成了**验证真实 UI 选择态 + 最终核心状态**，可信度比之前高。
