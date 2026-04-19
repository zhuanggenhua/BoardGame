# 大杀四方 狮身人面像起始回合后埋葬牌刷新 E2E 证据

## 覆盖的真实业务链路

- 链路：`endTurn -> startTurn -> titan_sphinx_start_turn -> bury_uncover_start_turn`
- 业务问题：狮身人面像在回合开始先把一张埋葬牌回手后，进入标准“翻开埋葬牌”阶段时，候选列表不应继续包含刚刚已经被回手的那张埋葬牌。
- 本次用例不是代理场景，直接走真实起始回合自动生成的两段交互。

## 运行命令

```powershell
$env:PW_START_SERVERS='true'
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
npx playwright test e2e/smashup-phase-transition-simple.e2e.ts --grep "Oops Sphinx 起始回合回收埋葬牌后，标准翻开阶段不应再出现刚消耗的埋葬牌"
```

## 关键截图

### 1. 狮身人面像起始回合交互出现前

![狮身人面像起始回合前的埋葬牌选择](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Sphinx-起始回合回收埋葬牌后，标准翻开阶段不应再出现刚消耗的埋葬牌/Oops-Sphinx-起始回合回收埋葬牌后，标准翻开阶段不应再出现刚消耗的埋葬牌-sphinx-real-start-turn-before-return.png)

人工观察结论：

- 金字塔下方能看到两张埋葬牌叠放，说明问题前态确实有两张可供狮身人面像选择。
- 顶部文案明确是“狮身人面像：选择一张你的埋葬牌，将其回手并把此泰坦放到其所在基地”，链路触发时机是回合开始，不是手造代理弹窗。
- 中央只有一个“跳过”按钮，实际选择位点在基地下方埋葬牌区域，符合真实业务交互形态。

### 2. 回收一张埋葬牌后，进入标准翻开阶段

![回收后一张埋葬牌进入标准翻开阶段](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-Sphinx-起始回合回收埋葬牌后，标准翻开阶段不应再出现刚消耗的埋葬牌/Oops-Sphinx-起始回合回收埋葬牌后，标准翻开阶段不应再出现刚消耗的埋葬牌-sphinx-real-start-turn-after-return-before-uncover.png)

人工观察结论：

- 顶部文案已切换为“你可以揭开一张你控制的埋葬牌，并立刻作为额外牌打出”，说明已进入后续真实业务阶段 `bury_uncover_start_turn`。
- 金字塔下方只剩 1 张埋葬牌可点，刚才被狮身人面像回手的那张已经不在该候选位点里。
- 手牌区新增 1 张牌，和“先回手再进入翻开阶段”的业务顺序一致。
- 本地测试环境此时未稳定拉到全部牌面美术，手牌区出现白卡面占位；但数量、位置、层级和问题位点仍可清楚判断，不影响本轮验收。

## 交互数据核对

- 狮身人面像交互初始候选：`['sphinx-buried-return', 'sphinx-buried-keep']`
- 选择 `sphinx-buried-return` 后，后续 `bury_uncover_start_turn` 候选变为：`['sphinx-buried-keep']`
- 同时校验：
  - `state.core.players['0'].hand` 包含 `sphinx-buried-return`
  - 场上 `data-buried-card-uid="sphinx-buried-return"` 数量为 `0`
  - 场上 `data-buried-card-uid="sphinx-buried-keep"` 数量为 `1`

## 结论

- 这条真实业务链路下，“狮身人面像先消耗埋葬牌，再进入标准翻开阶段仍看到刚消耗那张牌”的问题已消失。
- 这次修复覆盖的是全局交互刷新语义在 `bury_uncover_start_turn` 上的漏接，不是单个代理测试的假通过。
