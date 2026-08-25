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
- UI 展示：主牌桌左上回合牌下方增加公开的“停滞区”入口，默认只显示入口和数量；玩家点击后向下展开停滞区面板，卡牌正面是主体，牌面左上用短“停滞 / 可”覆盖标记，右上用数字角标显示停滞指示物数量，归属玩家只保留在牌面底部一行。入口不再借用牌库 / 抽牌堆槽位；疯狂牌 / 怪物 / 宝藏供应行仍留在牌库上方，二者互不重叠。
- 视角遮罩：对手手牌、牌库和普通私密暂存牌仍隐藏；返时者停滞牌按公开信息保留真实牌面和指示物数量。
- i18n：补充中文和英文停滞区标题、短状态覆盖、指示物和可打出状态文案。
- UI 规范回代：项目 UI 门禁已新增“机制详情默认收纳”和“卡牌状态贴本体”规则，禁止机制详情 UI 常驻挤压核心牌桌，也禁止把卡牌状态做成卡外长说明段；此类信息默认进可点击入口，展开态必须可关闭，卡牌状态优先贴在牌面上用短标签和角标表达。

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

### 四人多停滞压力补测

补测日期：2026-08-24

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "四人局回合开始只处理当前玩家"
```

结果：通过。1 个测试文件，1 passed / 83 skipped。

覆盖点：

- 四人局中，进入玩家 0 回合开始时，只移除玩家 0 自己停滞牌上的停滞指示物；玩家 1、2、3 的停滞牌不被提前处理。
- 玩家 0 同时有 4 张停滞牌时，每张有指示物的牌都各自 -1；其中 3 张归零牌分别保留独立额外打出机会。
- 两张归零随从和一张归零行动不会被后一个提示覆盖：交互队列依次保留 2 个额外随从提示和 1 个额外行动提示，并且每个提示只允许打出对应那一张归零停滞牌。

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

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者停滞区显示指示物并在回合开始归零后提示额外打出\返时者停滞入口展开后显示1个指示物.jpg`
   - 玩家先看到左上回合牌下方“停滞区 1张”公开入口；默认不显示常驻大面板，也不借用抽牌堆槽位。
   - 点击入口后展开停滞区面板，面板随单张卡牌收缩，不再留下大说明框；牌面是返时者“古怪教授”，左上只显示短“停滞”覆盖，右上角显示 1 个停滞指示物。
2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者停滞区显示指示物并在回合开始归零后提示额外打出\返时者回合开始归零后额外打出提示.jpg`
   - 回合开始后，中央提示显示“立刻打出一个额外随从，或放弃这次机会”，并展示古怪教授可选牌面。
   - 该图证明归零后的真实玩家动作入口存在，不再依赖旧常驻停滞面板。
3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者停滞区显示指示物并在回合开始归零后提示额外打出\返时者额外打出后停滞区清空.jpg`
   - 古怪教授已打到基地“另类现在”下方。
   - 停滞入口不再显示该牌，右侧仍可继续正常出牌/结束回合。

AI 图面审计结论：PASS。本轮三项玩家可见要求都能从原图直接确认；截图未出现空白牌、错误路由、关键决策缺失、停滞区入口缺失或卡外长说明文本。

### 四人真实页面 E2E

补测日期：2026-08-24

命令：

```powershell
$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-excellent-movies-teens-five-factions.e2e.ts "返时者四人多停滞"
```

最终结果：通过。1 passed。

作废记录：

- 第一次四人 E2E 从 P4 的出牌阶段起跑，只能证明停滞区初始展示，不能触发下一名玩家回合开始的停滞移除和额外打出队列；该失败截图不能作为验收图。
- 第二次四人 E2E 虽然座位是 4 人，但测试构造把公共基地错误注入到 `extra.core.bases`，实际页面只剩 1 座基地；这组旧图和旧 PASS 清单作废，不能证明四人真实局面。
- 当前仓内 Smash Up 初始化合同是 `baseCount = playerIds.length + 1`，所以四人局应显示 5 座基地。本轮最终用例把 5 座基地放入 `setupScene` 顶层 `bases`，并额外构造 30 张疯狂牌供应行。新增状态断言、页面断言和几何断言：`core.bases.length === 5`、`madnessDeck.length === 30`、`base-zone-0..4` 可见、5 个基地本体与计分圆不被视口裁切、疯狂牌供应行可见且显示 `x 30`、停滞入口默认可见且常驻面板不存在、停滞入口不与疯狂牌供应行重叠、点击入口后面板可见且不被视口裁切、第一张额外打出的随从不被视口裁切。

截图：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者四人多停滞只处理当前玩家并保留多个额外打出提示\返时者四人五基地停滞入口初始态.jpg`
   - 画面是四人局记分板，当前 P4 回合结束阶段。
   - 画面中 5 座基地完整可见，符合当前仓内“玩家数 + 1”初始化合同。
   - 左上回合牌下方只显示“停滞区 7张”公开入口，没有常驻大面板挤压或覆盖 5 座基地。
   - 疯狂牌供应行显示 `x 30`，仍在牌库上方；停滞入口在左上中性 HUD 区，二者没有重叠。
2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者四人多停滞只处理当前玩家并保留多个额外打出提示\返时者四人五基地停滞面板展开.jpg`
   - 点击左上公开入口后展开停滞区面板，显示 7 张牌：P1 有 4 张，P2/P3/P4 各 1 张；每张牌都以卡牌正面为主体，左上只显示短“停滞”覆盖，右上角显示停滞指示物数量。P1 的一张“闪电击”显示 2，其余显示 1。
   - 展开面板带“关闭”按钮，属于临时查看层；5 座基地仍完整可见。
   - 疯狂牌供应行仍保留在牌库上方，未被左上停滞入口或展开面板压住。
3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者四人多停滞只处理当前玩家并保留多个额外打出提示\返时者四人五基地回合开始只归零玩家0.jpg`
   - 进入回合 9 后变为 P1 回合开始，停滞区仍显示 7 张。
   - 只处理 P1 的牌：P1 三张牌变为“可打出”，P1 的“闪电击”从 2 变 1；P2/P3/P4 的停滞牌仍各为 1。
   - 中央出现“立刻打出一个额外随从，或放弃这次机会”的第一张随从提示。
4. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者四人多停滞只处理当前玩家并保留多个额外打出提示\返时者四人五基地第一张打出后第二张仍提示.jpg`
   - 第一张 P1 归零随从已进入基地，停滞区数量从 7 变 6。
   - 第二张 P1 归零随从仍显示“可打出”，中央继续出现独立额外随从提示，证明前一张额外打出没有吞掉后续机会。
   - 第一张已打出的随从完整在屏内，不再被左侧视口裁切。
5. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-excellent-movies-teens-five-factions.e2e\返时者四人多停滞只处理当前玩家并保留多个额外打出提示\返时者四人五基地行动牌独立提示且其他玩家未处理.jpg`
   - 放弃第二个额外随从机会后，中央继续出现“立刻打出一张额外战术，或放弃这次机会”的行动牌提示。
   - 停滞区里 P2/P3/P4 的牌仍显示 1 个停滞指示物，未被 P1 回合开始提前处理。
   - 5 座基地仍完整可见，提示遮罩没有掩盖基地数量证据。

AI 图面审计结论：PASS。五张最终原图直接覆盖“四人局、5 座基地、左上公开停滞入口、疯狂牌供应行、点击展开面板、卡牌正面 + 短停滞覆盖、多张停滞、只处理当前玩家、多个归零提示队列、其他玩家停滞不变、关键对象不被视口裁切”。旧的一基地截图、旧顶部横向条截图、旧卡外长文本截图、旧牌库上方入口截图和旧 PASS 清单已作废，不能再作为验收材料。

### 静态检查

命令：

```powershell
npx eslint src/games/smashup/Board.tsx src/games/smashup/ui/DeckDiscardZone.tsx src/games/smashup/ui/layoutConfig.ts e2e/smashup/smashup-excellent-movies-teens-five-factions.e2e.ts
npm run typecheck -- --pretty false
npm run spec:lint
npm run audit:evidence:selfcheck -- evidence/smashup/2026-08-23-backtimers-stasis-fix.md
```

结果：

- ESLint：0 errors，25 warnings。警告为当前文件内既有未用变量、hook dependency、React purity warning 和测试 `any`，未阻断。
- Typecheck：通过。
- Spec lint：通过。
- Evidence 自检：OK。

## 同类扩审记录

搜索范围：

- 根因关键词：`backtimers_stasis`、`storedCards`、`fromStored`、`grantImmediateExtraPlayForStoredCard`、`buildBacktimersStartTurnStasisEvents`。
- 共享调用点：返时者牌能力、基地把牌置入停滞、回合开始生命周期、暂存牌释放、额外打出限制、玩家视角遮罩、主牌桌 UI 展示。
- 验证对象：返时者主动置入停滞、疯狂博士调整停滞指示物、将就一下移除停滞指示物、回合开始自动移除、普通私密暂存牌遮罩、公开停滞区展示。

命中项与处理：

- 命中回合开始只覆盖单张停滞牌的测试缺口，已补“四人局回合开始只处理当前玩家的多张停滞牌，并为每张归零牌保留独立额外打出机会”。
- 命中返时者停滞牌和普通“藏在某张牌下”的私密暂存牌共用 `storedCards`，已用公开遮罩测试证明二者分流：普通暂存仍隐藏，返时者停滞公开。
- 命中“归零释放”既来自回合开始，也来自疯狂博士 / 将就一下移除最后指示物，已在低层回归中覆盖这些入口。

残余扩审范围：

- 本轮已覆盖桌面真实页面单牌链、桌面真实页面四人多停滞压力态，以及低层四人多停滞压力态；移动端同状态仍未单独截图。
- 未把返时者每一张牌都升级成单独 E2E；当前按共享停滞生命周期和额外打出入口做代表链验证，独有牌面效果仍以低层用例覆盖。

## 漏审归因与复盘

这是返时者机制未充分覆盖却被误收口，不是玩家误解。

- 旧 progress 已写过返时者未完成，缺完整停滞生命周期、entry/exit effects、L3/L4。
- 后续 closeout 把五派系玩法写成 Passed，但真实入口截图只覆盖五派系详情页和异形变体蛋田代表链，没有覆盖返时者停滞区、指示物数量、归零释放提示和打出后清理。
- 漏审归因：证据停在中间态 / 代表链外推过度。异形变体的牌库额外随从链只能证明“额外打出”共享入口存在，不能证明返时者独有的公开停滞区、停滞指示物数量、回合开始释放链、四人局归属隔离和多张归零提示队列。

## 残余风险

- 本轮 E2E 覆盖桌面真实页面单牌链和四人多停滞链。移动端同状态未单独截图。
- 当前仓库仍有非本轮无关脏改动，本证据只覆盖返时者停滞修复链。
