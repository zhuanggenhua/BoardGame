# Smash Up 泰坦冲突反馈复核（69d8ffc570d52ddbd0c19516）

- 反馈 ID：`69d8ffc570d52ddbd0c19516`
- 标题：`泰坦冲突没反应`
- 时间：`2026-04-11`
- 结论：`resolved`

## 生产快照事实

根据生产 Mongo 里的反馈快照与动作日志，可确认当时牌局里出现了标准基地双泰坦同处一地但未结算冲突：

- 路由：`/play/smashup/match/QarEgg2UiwX?playerID=0`
- 阶段：`playCards`
- 当前玩家：`1`
- 当前无活跃交互：`interaction.current = null`
- 基地 `base_greenhouse`（索引 1）上同时存在两张泰坦：
  - `titan_0_tricksters_big_funny_giant`（`tricksters_big_funny_giant`，controller=`0`，`powerCounters=1`，`talentUsed=true`）
  - `titan_1_pirates_the_kraken`（`pirates_the_kraken`，controller=`1`，`powerCounters=0`，`talentUsed=false`）
- 动作日志里没有任何“titan clash / 泰坦移除”痕迹。

这说明反馈不是视觉误解，而是**当时状态里确实遗留了标准基地双泰坦并存**。

## 规则口径

`src/games/smashup/rule/泰坦机制与卡牌抄录.md` 明确当前项目遵循标准泰坦规则；标准基地默认不允许双泰坦并存，进入同一标准基地后应立即按当前战力判定并移除败者。仓库里既有冒烟测试也已有基础 clash 规则：`第二个泰坦进入标准基地时触发 clash，平局保留先在场者`。

## 根因判断

本条更像是**交互解决后产生的 `TITAN_MOVED` / `TITAN_PLAYED` 没继续走泰坦冲突后处理**，而不是泰坦规则本身缺失。

依据：

- 反馈快照里 `Big Funny Giant` 已经 `talentUsed=true`，符合“通过交互移动泰坦”的链路特征。
- 当前仓库里的 `smashup-event-system` 已经会把交互处理器返回的领域事件送入 `postProcessSystemEvents(...)`，其中包含标准基地双泰坦自动 clash 逻辑。
- 本轮补了一条定向 smoke 回归，直接锁定“交互解决产生的泰坦移动进入已有其他泰坦的标准基地时，仍要继续触发 clash”。

> 上述“根因判断”是根据生产快照 + 当前代码路径做的推断，但与现象和修复点一致。

## 本轮补充回归

文件：`src/games/smashup/__tests__/smashup.smoke.test.ts`

新增用例：

- `交互解决产生的泰坦移动进入已有其他泰坦的标准基地时，会继续触发泰坦冲突`

该用例覆盖：

1. `The Kraken` 先通过 talent 交互选择目标基地；
2. 目标基地已有另一张泰坦 `Big Funny Giant`；
3. 交互解决后，事件系统继续执行泰坦冲突后处理；
4. 败者被立即移回 `setaside`，标准基地只保留一张泰坦。

## 验证

- `npx eslint src/games/smashup/__tests__/smashup.smoke.test.ts --quiet`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "交互解决产生的泰坦移动进入已有其他泰坦的标准基地时，会继续触发泰坦冲突"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "海怪克拉肯天赋会移动泰坦，并让目标基地敌方随从直到你下回合开始时 -1 战力"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "海怪克拉肯的替换基地进场交互在补发计分后事件时会真正把泰坦落到新基地"`

## 收口判断

按当前主线代码与本轮回归，**交互生成的泰坦移动/进场事件现在会继续走 clash 后处理**，因此这条反馈可以按 `resolved` 收口。
