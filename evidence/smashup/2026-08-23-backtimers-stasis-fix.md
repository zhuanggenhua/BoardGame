# Smash Up 返时者停滞修复证据

日期：2026-08-23

## 原始症状

用户反馈的三条玩家可见问题：

1. 返时者看不到停滞区。
2. 玩家不知道停滞指示物数量。
3. 回合开始没有询问是否把停滞状态取消的牌额外打出去。

本轮目标对象锁定为 Smash Up / Excellent Movies + Teens / Backtimers 返时者的停滞牌生命周期与 UI 展示。

## 规则合同

- 停滞牌是正面公开的暂存牌，不应作为对手私密暂存牌隐藏。
- 拥有者回合开始，每张自己的停滞牌移除 1 个停滞指示物。
- 指示物归零后，该牌在出牌阶段可作为额外牌打出；玩家必须看到并选择是否打出。

## 实现覆盖

- 回合开始生命周期：进入回合开始时对返时者停滞牌移除 1 个指示物，归零时生成即时额外随从/战术打出窗口。
- 触发牌释放：疯狂博士和将就一下移除最后一个停滞指示物时，也开放即时额外打出窗口。
- UI 展示：主牌桌增加公开的返时者停滞区，显示牌面、归属玩家、停滞指示物数量，归零后显示“可打出”。
- 视角遮罩：对手手牌、牌库和普通私密暂存牌仍隐藏；返时者停滞牌按公开信息保留真实牌面和指示物数量。
- i18n：补充中文和英文停滞区标题、指示物和可打出状态文案。

## 验证

### 低层规则回归

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "返时者|疯狂博士|将就一下|停滞"
```

结果：通过。1 个测试文件，14 passed / 68 skipped。

覆盖点：

- 疯狂博士移除最后 1 个停滞指示物后出现 `smashup_immediate_extra_action`，候选来源是 stored。
- 返时者回合开始会从自己的停滞牌移除指示物，归零后出现 `smashup_immediate_extra_minion`。
- 将就一下移除最后一个停滞指示物后开放该牌额外打出窗口。

### 公开视角遮罩回归

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/playerViewBuriedMask.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
```

结果：通过。1 个测试文件，3 passed。

覆盖点：

- 普通对手手牌、牌库和私密暂存牌仍隐藏。
- 对手返时者停滞牌公开保留真实牌名、uid、停滞指示物数量和 `backtimers_stasis` 原因。

### 真实页面 E2E

命令：

```powershell
$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-excellent-movies-teens-five-factions.e2e.ts "返时者停滞区显示指示物"
```

结果：通过。1 passed。

首跑记录：第一次 E2E 功能链已跑通，但断言错误地期待“额外随从会消耗普通随从额度”；实际额外打出不应消耗普通额度，所以把断言修正为 `minionsPlayed: 0` 后同一用例通过。

截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者停滞区显示指示物并在回合开始归零后提示额外打出\返时者停滞区显示1个指示物.jpg`
   - 画面左上可见“停滞区”，显示 1 张牌。
   - 牌面是返时者“古怪教授”，右上角和状态条均显示 1 个停滞指示物。
2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者停滞区显示指示物并在回合开始归零后提示额外打出\返时者回合开始归零后额外打出提示.jpg`
   - 回合开始后，停滞区仍可见同一张牌，状态变为“可打出”。
   - 中央提示显示“立刻打出一个额外随从，或放弃这次机会”，并展示古怪教授可选牌面。
3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者停滞区显示指示物并在回合开始归零后提示额外打出\返时者额外打出后停滞区清空.jpg`
   - 古怪教授已打到基地“另类现在”下方。
   - 停滞区不再显示该牌，右侧仍可继续正常出牌/结束回合。

AI 图面审计结论：PASS。本轮三项玩家可见要求都能从原图直接确认；截图未出现空白牌、错误路由、遮挡关键决策或停滞区缺失。

### 静态检查

命令：

```powershell
npx eslint src/games/smashup/Board.tsx src/games/smashup/domain/index.ts src/games/smashup/__tests__/playerViewBuriedMask.test.ts e2e/smashup/smashup-excellent-movies-teens-five-factions.e2e.ts
npm run typecheck -- --pretty false
```

结果：

- ESLint：0 errors，24 warnings。警告为当前文件内既有未用变量、hook dependency 和测试 `any`，未阻断。
- Typecheck：通过。

## 漏审复盘

这是返时者机制未充分覆盖却被误收口，不是玩家误解。

- 旧 progress 已写过返时者未完成，缺完整停滞生命周期、entry/exit effects、L3/L4。
- 后续 closeout 把五派系玩法写成 Passed，但真实入口截图只覆盖五派系详情页和异形变体蛋田代表链，没有覆盖返时者停滞区、指示物数量、归零释放提示和打出后清理。
- 旧审计的问题不是“测试不够多”这么简单，而是代表链外推过度：异形变体的牌库额外随从链不能证明返时者的公开停滞区和回合开始释放链。

## 残余风险

- 本轮 E2E 覆盖桌面真实页面。移动端同状态未单独截图。
- 当前仓库仍有非本轮无关脏改动，本证据只覆盖返时者停滞修复链。
