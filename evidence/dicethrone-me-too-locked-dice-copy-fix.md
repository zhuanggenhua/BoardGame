# DiceThrone 锁定骰子无法作为复制源/目标修复证据

## 问题

用户反馈：在 `dicethrone` 中打出 `俺也一样！`（`card-me-too`）后，已锁定的骰子无法被选为复制交互中的可选骰子。

期望行为：

- 已锁定骰子可以作为复制源
- 已锁定骰子也可以作为复制目标
- 复制完成后，骰子的锁定状态仍然保留

## 调用链检查

### 1. 卡牌效果定义

- [src/games/dicethrone/domain/commonCards.ts](../src/games/dicethrone/domain/commonCards.ts)
  - `card-me-too` 使用 `modify-die-copy`

### 2. 自定义动作到交互

- [src/games/dicethrone/domain/customActions/common.ts](../src/games/dicethrone/domain/customActions/common.ts)
  - `handleModifyDieCopy` 会创建 `type: 'modifyDie'`
  - `dieModifyConfig.mode = 'copy'`
  - `selectCount = 2`

### 3. 交互系统

- [src/games/dicethrone/domain/systems.ts](../src/games/dicethrone/domain/systems.ts)
  - `modifyDie` 交互被转换为 multistep choice
  - `copy` 模式的 reducer：
    - 第 1 次点击记录源骰值
    - 第 2 次点击把目标骰设为源骰值

### 4. 命令校验

- [src/games/dicethrone/domain/commandValidation.ts](../src/games/dicethrone/domain/commandValidation.ts)
  - `validateModifyDie` 只校验：
    - 有 pending interaction
    - 骰子存在
    - 新值在 1-6
  - **没有**禁止已锁定骰子

### 5. 根因

- [src/games/dicethrone/ui/DiceTray.tsx](../src/games/dicethrone/ui/DiceTray.tsx)
  - 在 `modifyDie` 交互下，UI 原本用了 `!d.isKept` 过滤可选骰子
  - 导致前端把锁定骰子直接置灰、不可点
  - 后端和规则链路本来允许修改，只有 UI 错误拦截了它

## 修复

- 修改 [src/games/dicethrone/ui/DiceTray.tsx](../src/games/dicethrone/ui/DiceTray.tsx)
  - `modifyDie` 的所有模式（`set/copy/any/adjust`）不再因 `isKept` 被禁用
  - 注释明确说明：锁定只影响重投保留，不影响卡牌/效果改骰

## 验证

### 类型检查

已通过：

- `npm run typecheck`

### E2E

已在现有文件中补回归用例：

- [e2e/dicethrone-watch-out-spotlight.e2e.ts](../e2e/dicethrone-watch-out-spotlight.e2e.ts)
  - `俺也一样 copy 模式应允许选择已锁定骰子作为源和目标`

已通过：

- `npm run test:e2e:ci -- e2e/dicethrone-watch-out-spotlight.e2e.ts`

### 用例覆盖内容

同一个 E2E 用例内验证了两件事：

1. 第一次使用 `俺也一样！`
   - 选择已锁定骰子 `die0` 作为复制源
   - 选择未锁定骰子 `die3` 作为复制目标
   - 结果：`die3` 成功变为 `6`

2. 第二次使用 `俺也一样！`
   - 选择未锁定骰子 `die4` 作为复制源
   - 选择已锁定骰子 `die1` 作为复制目标
   - 结果：`die1` 成功变为 `3`

最终断言：

- 骰值为 `[6, 3, 4, 6, 3]`
- 锁定状态仍为 `[true, true, false, false, false]`

## 截图分析

关键截图：

- 历史截图已按新规则清理；如需复查，请重跑 `e2e/dicethrone-watch-out-spotlight.e2e.ts`，新统一目录为 `test-results/evidence-screenshots/`

可见信息：

- 当前仍处于 `Offensive Roll Phase`
- 右侧前两颗骰子仍显示 `LOCKED`
- 玩家资源与回合信息正常

结合 E2E 断言可确认：

- 锁定骰子在复制后没有被错误解锁
- 锁定骰子确实参与了复制流程，否则最终骰值断言不会通过

## 结论

本次 bug 不是规则实现错误，也不是命令校验错误，而是单纯的前端可点击过滤写错了。

修复后：

- 锁定骰子可以作为 `copy` 的源和目标
- 其他 `modifyDie` 类交互也不再被 `isKept` 误拦截
- 锁定状态语义保持不变，只影响重投，不影响改骰
