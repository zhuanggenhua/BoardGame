# DiceThrone 交互真相边界重构记录（2026-05-04）

## 背景

本轮不是单点修 bug，而是收束 DiceThrone 在四人模式和枪手攻击链中的交互语义漂移：

- 不该弹 `simple-choice` 的链路误弹了选择。
- `targetingRoll` 选受击者、枪手 `Loaded token`、奖励骰特写、攻击修正前台互相串台。
- 阻塞前台和纯展示 overlay 混在一个通道里，导致“已经选好目标却又像在重新选”、“弹窗动画进行一半被别的前台抢走”的错觉与真实栈错位。

## 本轮设计约束

1. 一个 interaction kind 只能表达一种稳定业务语义。
2. `simple-choice` 只用于真正的分支/按钮选择。
3. 选受击者必须是独立 `defender-choice`，不能借壳通用选择。
4. 阻塞主流程的前台默认进入 modal stack。
5. 进入 modal stack 的前台，真实可点击内容禁止再二次 portal 到其他 HUD 根。
6. 奖励骰“是否还能点骰子重掷”和“是否需要显式确认收口”是两层职责，不能混成一个布尔量。

## 根因拆解

### 1. 语义借壳

`targetingRoll` 的 5/6 目标选择曾复用 `simple-choice`，于是“已知只是在选受击者”的链路被渲染成了通用选择弹窗。

### 2. modal stack ownership 与真实内容分裂

`compare-roll` 和 `bonus-dice` 已经被挂进 modal stack，但其内容组件内部还继续 portal 到 `hud-root`。结果变成：

- 栈里有一个空壳层负责 ownership、pointer 与遮罩。
- 真正可点击内容飞到另一棵树。
- 用户看到前台存在，但点击链可能被壳层截断。

### 3. 旧展示通道在交互期间复活

`useCardSpotlight` 会消费 `BONUS_DIE_REROLLED` 事件。阻塞式奖励骰仍未收口时，这条旧展示通道又把它当成“独立奖励骰特写”提交了一遍，造成第二份 bonus overlay 叠到 modal stack 之上。

### 4. 确认收口职责被错误绑到 `canReroll`

奖励骰组件原先只有在 `canReroll=true` 时才显示“确认伤害”。一旦达到重掷上限或无资源，就会退化成只能依赖容器通用关闭按钮收口，违反“攻击结算前台必须保留显式确认入口”的约束。

## 已落地改动

### 1. defender-choice 语义链彻底拆出

- `targetingRoll` 的 5/6 改为专用 `PendingDefenderChoice` / `SELECT_DEFENDER_TARGET`。
- `ChoiceModal` 退回纯 `simple-choice`。
- 新增专用 `DefenderChoiceModal`。
- `flowHooks.ts` / `systems.ts` 与 e2e mirror 同步补齐 resolve、auto-continue 与 cancel fallback。

### 2. 阻塞奖励骰与比较掷点进 modal stack，且禁止二次 portal

- `SpotlightContainer` 新增 `usePortal?: boolean`。
- `Board.tsx` / e2e mirror 中，`compare-roll` 与 `bonus-dice` 的 modal entry 都改为 `usePortal={false}` 原位渲染。
- 这一步修掉了“modal stack 有 ownership，但真实内容飞出栈外”的根因。

### 3. BoardOverlays 收缩回纯展示通道

- `BoardOverlays.tsx` 只承载 displayOnly 奖励骰与其它纯展示 overlay。
- 阻塞式奖励骰交互只走 modal stack，不再允许 overlay 通道同步起第二份前台。

### 4. `useCardSpotlight` 新增阻塞期抑制

- 新增 `suppressStandaloneBonusDie` 配置。
- 当当前 viewer 正处于阻塞式奖励骰 settlement 时，`BONUS_DIE_ROLLED / BONUS_DIE_REROLLED` 不再生成独立奖励骰特写。
- 进入阻塞期时会主动清空旧的 standalone bonus state，避免“旧展示态延迟冒出来”。

### 5. 奖励骰组件职责重新拆分

- 奖励骰节点继续保留为语义化 `button`，稳定锚点是 `data-testid="bonus-die-reroll-option-<index>"`。
- “是否能点骰子重掷”只看 `canReroll`。
- “是否必须显式确认收口”只看是否存在阻塞式 settlement handler（`onSkipReroll`）。
- 达到重掷上限或无资源时，仍保留“确认伤害”按钮；不会再退化成只能靠容器通用关闭键收口。

### 6. 规范更新

- `.spec/knowledge/standards/global-systems.md`
- `.spec/knowledge/standards/engine-systems.md`

新增通用约束：

- 阻塞前台默认入栈。
- 入栈前台禁止真实内容二次 portal。
- `simple-choice` 不能承载“选受击者”这类专用语义。
- 奖励骰结算前台里，“可重掷”与“可确认收口”必须分责。

## 验证

### 单测

已实际运行：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx --configLoader native
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts --configLoader native
```

结果：

- `BonusDieOverlay.test.tsx` 32/32 通过
- `flow.test.ts` 122/122 通过

说明：

- 已覆盖 `useCardSpotlight` 的阻塞期抑制。
- 已覆盖 `defender-choice` 语义链与 4 人 `targetingRoll` 关键流程。
- 本轮未额外运行 `typecheck`，因此不以 `typecheck` 作为收口证据。

### E2E

已实际运行：

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-wild-west 应触发弹药特写奖励骰，不改攻击骰盘"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player targeting roll: auto targets and choice owners stay correct in 2v2"
```

结果：

- `wild-west` 奖励骰链通过
- 4 人 `defender-choice / auto-target` 链通过

## 关键截图证据

### Wild West 奖励骰链

1. 特写出现

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-bonus-die-overlay.png`

肉眼结论：

- 画面中央直接可见奖励骰本体，不是通用选择列表。
- 文案是“点击骰子花费0装填重掷”，说明当前处于奖励骰重掷前台，而不是攻击骰盘改骰或其它 token 选择。
- 右侧攻击骰盘仍保持原攻击链状态，没有被奖励骰前台错误替换。

2. 重掷后状态变化

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-bonus-die-rerolled.png`

肉眼结论：

- 前台顶部文案已经切到“已达到本次重掷上限”，说明点击奖励骰后状态确实推进到了“已完成本次唯一可重掷机会”。
- 画面底部存在明确的“确认伤害”按钮，证明收口入口仍在，不会因为到上限而退化成只剩容器通用关闭键。
- 中央骰子和“总伤害: 6”同时可见，说明奖励骰结果已写回当前 settlement UI，而不是点了没反应。

3. 收口后返回可继续推进状态

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-bonus-die-closed.png`

肉眼结论：

- 奖励骰前台已关闭，视图回到正常棋盘与防御阶段，不存在“特写还挂着但状态已推进”的栈残留。
- 右上角攻击修正徽章显示 `+1`，符合 `Wild West` 的攻击修正归属；它没有在重掷特写阶段提前写进错误位置。
- 这张图证明“阻塞式奖励骰前台收口 -> 主流程继续”已经稳定完成。

4. 攻击修正徽章结算后状态

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-attack-modifier-badge.png`

肉眼结论：

- 徽章在收口后仍可见，且显示的是攻击修正 `+1`，没有把 `Loaded` 的 token 加伤混进攻击修正徽章。
- 这与测试断言中的 `bonusDamage=4 / attackModifierBonusDamage=1` 一致。

### 4 人 targeting roll / defender-choice 链

1. host 端出现专用受击者选择面板

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-targeting-roll-auto-targets-and-choice-owners-stay-correct-in-2v2\06-four-player-target-choice-panel-host.png`

肉眼结论：

- 中央前台标题是“技能结算选择”，正文是“选择本次攻击目标”，下面只有两名敌方候选，不包含队友。
- 这说明 4 人链已不再误弹 generic simple-choice，而是进入专用 defender-choice 语义。
- 候选项数量与 2v2 敌我关系一致，证明 owner 与可选目标集合正确。

2. 自动目标落到敌方队长后，目标方可直接进入防御

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-targeting-roll-auto-targets-and-choice-owners-stay-correct-in-2v2\04-four-player-paladin-defense-unlocked.png`

肉眼结论：

- 敌方队长视角已进入防御链，中央展示“对方选中了技能”并给出继续按钮，而不是再次要求其重选目标。
- 这证明 auto-target 到 defender 后，链路已把 owner 正确交给目标方的防御前台，没有回落成错误的通用选择弹窗。

3. 自动目标落到另一名敌方后，也能解锁对应防御前台

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-targeting-roll-auto-targets-and-choice-owners-stay-correct-in-2v2\05-four-player-barbarian-defense-unlocked.png`

肉眼结论：

- 另一名敌方视角同样进入可继续的防御前台。
- 这说明 1/2 的自动目标与 3/4/5/6 的 defender-choice 不会互相污染 owner 归属。

## 结论

本轮已闭环确认：

- 4 人 `targetingRoll` 的“伪 simple-choice”问题已从语义层拆掉。
- `bonus-dice` 与 `compare-roll` 的 modal stack 所有权和真实内容已重新对齐，不再二次 portal 逃逸。
- 阻塞式奖励骰期间，旧的事件流展示通道不会再复活第二份前台。
- 奖励骰到达重掷上限后仍保留显式“确认伤害”收口入口，避免前台职责再次混乱。

剩余风险：

- `BonusDieOverlay` 单测仍会打印 React 对 `whileHover / whileTap` 的历史 warning；这不是本轮行为回归，但后续可单独清理组件实现。
