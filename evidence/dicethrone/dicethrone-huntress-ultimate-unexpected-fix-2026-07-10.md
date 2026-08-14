# 王权骰铸：猎手头像、大招发动前响应与“意不意外”双骰修改修复

## 1. 基本信息

- 日期：2026-07-10
- 文档类型：`closeout`
- 对象：
  - 猎手角色选择头像
  - 所有英雄的终极招式发动前响应边界
  - 通用卡牌“意不意外？！”一次修改两颗骰子的交互
- 结论等级：`原始反馈链路已验证`
- 最终验收时间：2026-07-11
- 当前说明：猎手头像合同、终极招式发动前响应边界、“意不意外”双骰修改，以及咒缚海盗终极招式被改骰后取消选择的双玩家真实页面链均已通过。
- 追加说明：2026-07-11 复查确认终极招式选择本应与普通“确认骰面”共用发动前响应流程；同点数重掷也已改为按真实重掷事件播放动画。

## 2. 用户原始症状

1. 猎手头像使用了错误图集索引；第二套英雄头像图集从 `0` 开始计数时，猎手应为索引 `10`。
2. 所有英雄只要凑齐并选中终极招式，对手就无法再改骰。正确边界应为：
   - 正式发动前仍可使用合法改骰牌破坏骰型；
   - 正式发动后，伤害和效果才不可阻止。
3. “意不意外？！”在部分情况下不能一次修改两颗骰子；已知现场是咒缚海盗从 `3 个 6` 补成 `5 个 6`。
4. 随机重掷即使旧点数和新点数相同，也必须播放骰子动画；不能因为画面数值没变而让玩家感觉没有执行重掷。

## 3. 真相源与合同

| 对象 | 真相源 | 合同状态 | 结论 |
| --- | --- | --- | --- |
| 猎手头像 | 用户确认第二套图集从 0 开始计数，猎手为索引 10；运行时裁切函数 | `locked` | 实现映射遗漏 |
| 终极招式 | `docs/games/dicethrone/card-timing-terms.md` 的“终极招式响应边界” | `locked` | 实现把“选中”错误当成“已发动” |
| 意不意外 | 卡牌已有 `modifyDie / any / selectCount=2` 合同 | `locked` | 共享多步骤交互在同一批次连续操作时消费旧结果 |
| 重掷动画 | `DIE_REROLLED` 事件代表真实重掷发生 | `locked` | 动画触发只看骰子编号，连续同骰重掷可能被合并 |

## 4. 根因

### 4.1 猎手头像

- `d2487d685` 引入第二套头像图集分流时，只登记了忍者和树人。
- `e8c07e92d` 后续只补了战术家和咒缚海盗。
- 猎手没有加入 `NEW_CHARACTER_PORTRAIT_INDEX`，继续通过旧图集合同显示错误头像。
- 原头像合同测试只检查少量已登记角色是否命中新图集，没有建立完整角色索引表，也没有锁精确裁切位置。

### 4.2 终极招式发动前无法响应

- `getResponderQueue()` 在看到 `pendingAttack.isUltimate` 后，直接把 `afterRollConfirmed` 响应队列清空。
- `pendingAttack.isUltimate` 在玩家选中终极槽位时就已写入，但此时招式尚未正式发动。
- `execute.ts` 的改骰和重掷分支又对终极招式跳过 `ABILITY_RESELECTION_REQUIRED`，即使骰型被改变也不会取消当前终极选择。
- 结果是“选中终极招式”被错误等同于“终极招式已经发动”。

### 4.3 “意不意外”偶发只保留一颗骰子

- `useMultistepInteraction.step()` 使用 `resultRef.current` 计算下一步，但原实现只调用 React 状态更新，没有立即同步 `resultRef.current`。
- 当两次 `step()` 落在同一批更新中时，第二次仍可能基于旧结果计算，从而覆盖第一颗骰子的修改。
- 领域层连续发送两条 `MODIFY_DIE` 命令本身能够正确完成咒缚海盗 `3 个 6 -> 5 个 6`；问题位于界面本地累积结果的时序。

### 4.4 同点数重掷动画可能被吞掉

- 领域层 `REROLL_DIE` 无论旧点数和新点数是否相同，都会产生真实的 `DIE_REROLLED` 事件。
- 旧界面动画状态只有“哪些骰子正在重掷”，没有“这是第几次重掷”的编号。
- 同一颗骰子的下一次重掷如果发生在上一段动画尚未收口时，物理骰盘会因为骰子编号相同而把它合并掉。
- 当新旧点数又相同时，画面没有数值变化可补偿，玩家会看到“重掷执行了但骰子没有动”。

## 5. 修改范围

### 5.1 实现

- `src/games/dicethrone/ui/assets.ts`
  - 猎手加入第二套图集映射：`huntress: 10`。
- `src/games/dicethrone/domain/rules.ts`
  - 删除“选中终极招式后清空发动前改骰响应队列”的提前封锁。
- `src/games/dicethrone/domain/execute.ts`
  - 改骰和重掷后，所有已选攻击（包括终极招式）都按骰面变化要求重新选技能。
- `src/engine/systems/useMultistepInteraction.ts`
  - 每次本地步骤计算后立即同步结果引用和步骤计数引用，保证同批次后续步骤读取最新值。
- `src/games/dicethrone/hooks/useDieRerollAnimationConsumer.ts`
  - 每条真实 `DIE_REROLLED` 事件都会推进重掷动画编号，即使旧点数和新点数相同。
- `src/lib/dice-physics/DiceBoxPhysicsSource.tsx`
  - 重掷动画 key 从单纯骰子编号升级为“动画编号 + 骰子编号”。
  - 上一段同骰重掷未结束时，下一段重掷进入待播队列，上一段结束后补播，不再被合并。
- `src/games/dicethrone/ui/Dice3D.tsx`
  - 中央 3D 骰台也读取重掷动画编号；同一颗骰子的下一次重掷会重新触发滚动初始速度。
- `src/games/dicethrone/ui/DiceTray.tsx`、`src/games/dicethrone/Board.tsx`
  - 移除确认按钮和被动重掷点击处的手动动画点亮，统一以真实重掷事件作为动画真相源，避免同一次重掷重复播放。

### 5.2 测试

- `src/games/dicethrone/ui/__tests__/portraitAtlasContract.test.ts`
  - 锁定猎手命中第二套图集。
  - 锁定猎手精确裁切位置 `80.0000% 16.6634%`。
- `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`
  - 终极招式选中后仍生成发动前响应者队列。
  - 发动前骰面变化会产生技能重选事件。
  - 咒缚海盗 `3 个 6 -> 5 个 6` 精确领域回归。
- `src/engine/systems/__tests__/useMultistepInteraction.test.ts`
  - 同一个 React 批次连续修改两颗骰子时，两项结果都必须保留。
- `src/games/dicethrone/ui/__tests__/DiceTray.test.tsx`
  - 右侧传统骰盘在“任意改面”模式下必须为两颗目标骰子分别提供可操作的加减按钮。
  - 精确锁定两颗 `6` 分别发出改为 `5` 的本地步骤。
- `src/games/dicethrone/__tests__/useDieRerollAnimation.rollback.test.tsx`
  - 同点数 `DIE_REROLLED` 事件也必须推进动画编号。
- `src/lib/__tests__/DiceBoxPhysicsSource.test.tsx`
  - 同一颗骰子的连续同面重掷，在第一段动画未结束时不能吞掉第二段；第一段结束后必须补播第二段。
- `e2e/dicethrone/dicethrone-unexpected-card-interaction.e2e.ts`
  - 使用现行真实上抛拖拽出牌入口。
  - 真实页面验证咒缚海盗 `3 个 6 -> 5 个 6`。
- `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
  - 新增咒缚海盗无情劫掠发动前，对手持有“意不意外”时进入响应并取消大招选择的双玩家链。
  - 关闭会截走拖拽的攻击技能特写，并通过真实命中点完成上抛拖拽。

### 5.3 文档

- `.spec/skills/dicethrone-hero-intake/SKILL.md`
  - 新头像图集必须维护完整的“角色 ID -> 从 0 开始的索引”表。
  - 每个角色必须锁定图集来源和精确裁切位置，禁止通过旧图集或 `?? 0` 静默兜底。
- `docs/games/dicethrone/card-timing-terms.md`
  - 明确终极招式的不可阻止边界从正式发动后开始。
  - 明确发动前改骰后必须取消当前终极选择并重新选技能。

## 6. 验证结果

### L1/L2：结构与领域行为

命令：

```text
npx vitest run src/games/dicethrone/ui/__tests__/portraitAtlasContract.test.ts src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts src/engine/systems/__tests__/useMultistepInteraction.test.ts
```

结果：`3 files / 21 tests passed`

命令：

```text
npx vitest run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts
```

结果：`2 files / 175 tests passed`

### L3：真实页面

命令：

```text
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-unexpected-card-interaction.e2e.ts "咒缚海盗三个 6 应能用意不意外一次补成五个 6"
```

结果：`1 passed`

当前截图：

- `test-results/evidence-screenshots/_shared/王权骰铸-咒缚海盗-意不意外-双骰修改前.png`
- `test-results/evidence-screenshots/_shared/王权骰铸-咒缚海盗-意不意外-五个6确认后.png`

右侧骰盘组件回归：

```text
npx vitest run src/games/dicethrone/ui/__tests__/DiceTray.test.tsx
```

结果：`1 file / 11 tests passed`

同点数重掷动画回归：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/useDieRerollAnimation.rollback.test.tsx src/lib/__tests__/DiceBoxPhysicsSource.test.tsx src/games/dicethrone/ui/__tests__/DiceTray.test.tsx src/games/dicethrone/ui/__tests__/BoardDiceBoxTray.test.tsx --configLoader native
```

结果：`4 files / 16 tests passed`

类型检查：

```text
npm run typecheck
```

结果：通过。

双玩家终极招式响应 E2E：

```text
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "无情劫掠正式发动前应允许对手用意不意外改骰并取消大招选择"
```

结果：`1 passed`

最终权威状态：

- 骰子：`[5, 5, 6, 6, 6]`
- 当前终极招式选择：已取消
- 掷骰确认状态：已恢复为未确认，可重新选择技能
- 改骰交互：已正常结束

最终截图：

- `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/无情劫掠正式发动前应允许对手用意不意外改骰并取消大招选择/110a-无情劫掠发动前-对手可打出意不意外.jpg`
- `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/无情劫掠正式发动前应允许对手用意不意外改骰并取消大招选择/110b-意不意外-两颗骰子改为5待确认.jpg`
- `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/无情劫掠正式发动前应允许对手用意不意外改骰并取消大招选择/110c-改骰确认后-大招选择已取消.jpg`

轻量图面核验：

- 发动前画面中“意不意外？！”仍作为可介入手牌显示。
- 改骰待确认画面中，两颗骰子为 `5`，另外三颗保持 `6`。
- 确认后画面中终极招式选中态消失，没有残留阻塞交互或临时诊断 UI。

## 7. 同类扩审

- 搜索终极招式运行时提前封锁逻辑：
  - 发动前提前清空响应队列的路径已删除。
  - 改骰和重掷的三处“终极招式跳过技能重选”例外已删除。
  - 正式发动后的不可防御、不可减伤、不可回避逻辑仍保留。
- 搜索 `uninterruptible`：
  - 当前仅存在于类型和英雄标签，没有发现另一条发动前提前封锁路径。
- 共享多步骤交互：
  - 修复落在引擎共享 hook，而不是只给“意不意外”打单卡补丁。
  - 新增同批次连续步骤回归，覆盖所有复用该 hook 的多步骤交互。
- 重掷动画：
  - 事件生成、事件消费、物理引擎目标点数应用均未按“点数是否变化”过滤。
  - 实际缺口在 UI 动画触发粒度：只看骰子编号，不看独立重掷次数。
  - 本次修复把“真实重掷事件”作为唯一动画入口，避免点击层提前播放和事件层再播放造成重复。

## 8. 漏审复盘

1. **头像对象全集未建立**
   - 旧测试只列出当时已登记的四名新图集角色，不会发现遗漏角色。
   - 测试只判断“用了哪张图”，没有判断“裁到了哪一格”。
2. **终极招式测试只覆盖发动后**
   - 旧规则测试重点保护终极伤害不可防御、不可减伤和不可回避。
   - 旧真实入口大招用例把对手手牌清空，只验证大招结算，没有覆盖“选中后、发动前”的响应窗口。
3. **双骰测试没有覆盖同批次状态累积**
   - 领域测试逐条执行命令，天然读取最新权威状态，无法暴露 React 本地结果引用滞后。
   - 旧页面用例还沿用“单击手牌直接出牌”的过时入口；现行交互是单击预览、上抛拖拽出牌。

## 9. 对外口径

- 可以说：
  - 猎手头像已改为第二套图集索引 `10`。
  - 终极招式发动前仍可被合法改骰牌破坏骰型；发动后才不可阻止。
  - 终极招式选择阶段已经回到普通确认骰面的响应流程；不是一选中就锁死。
  - “意不意外”已修复同批次连续操作丢失第一颗骰子结果的问题。
  - 随机重掷即使随机到相同点数，也会按真实重掷事件播放骰子动画。
- 不能说：
  - 不能把所有历史上“意不意外”异常都归因于这一处竞态；当前精确验证的是已知 `3 个 6 -> 5 个 6` 场景和同批次连续步骤。
  - 当前只完成本地代码、测试和 evidence，不代表已部署，也没有回写外部反馈系统状态。
