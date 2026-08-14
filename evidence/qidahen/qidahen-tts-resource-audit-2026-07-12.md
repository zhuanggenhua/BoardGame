# 七大恨 TTS 资源核对与补缺记录（2026-07-12）

## 本轮结论

- TTS 存档 `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json` 只有 1 个默认空壳 Lua/XML 模板：`onLoad`、`onUpdate` 内都是注释，没有规则逻辑、自动化 UI 或交互实现可复用。
- TTS 仍可作为三类参照：资源对象清单、牌组顺序、实体摆位线索。
- 当前项目不应把 TTS 地图替换为正式区域绘制系统；正式区域仍以 `region-mask`、`runtime region`、`region graph` 和项目区域文档为准。
- 当前项目不是只有一个剧本：`post-sarhu-1619`、`shanhaiguan-1622`、`dingmao-rebellion-1627` 三套起始剧本都已有运行时预设。本轮之前的证据写法只把 1619 审到同等级，属于覆盖范围收窄。
- 本轮已把 `roomSetup.test.ts` 的起始设置回归补齐到 1622、1627：覆盖规则书中的区域控制、部队、人口、手牌、人物、军备、移出游戏人物和二人剧本座位。
- `朵颜部` 在 TTS 里有“朵颜部人口”计数器坐标，但当前正式地图/区域文档仍未确认它是独立闭合命名区；本轮不把它硬塞进既有运行时区域。

## 已核对来源

| 来源 | 路径 | 结论 |
| --- | --- | --- |
| TTS 存档 | `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json` | 含容器内对象共 358 个；仅 1 个默认空壳 Lua/XML 模板，不能作为规则脚本来源 |
| TTS 图片目录 | `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Images` | 70 个本地图片文件，可作为资源核对入口 |
| 当前正式资源 | `public/assets/i18n/zh-CN/qidahen/assets-manifest.json` | 当前资源树统计为 133 个文件，清单已覆盖正式运行资源，不能仅按 TTS 文件名判断缺失 |
| 规则真相源 | `src/games/qidahen/rule/七大恨规则.md` | 1619、1622、1627 起始设置以规则书为强真相源 |
| 区域拓扑文档 | `docs/games/qidahen/records/qidahen-region-topology-truth-sources.md` | 明确 `朵颜部` 尚未作为已确认独立闭合命名区落入正式印刷区表 |

## TTS 对象观察

TTS 有用对象主要是：

- 牌组：普通牌、朝鲜牌、纪年/剧本牌、军备/辅助卡。
- 标记：控制/外交标记、本土标记、汉城胜利点、玉玺胜利点、行动轮盘标记、干旱、破败/战败、人口。
- 部队：大明、蒙古、后金的主力/次级部队实体。
- 摆位：地图上控制标记、部队、人口计数器的三维位置。

TTS 没有提供：

- 规则执行脚本。
- 可直接复用的 UI 逻辑。
- 可替换当前区域 mask/graph 的权威区域边界。
- 逐牌 `Nickname / Description` 规则文本。

## 已实施补缺

### 三套剧本 setup 覆盖状态

当前项目并不是只实现了一个剧本：

- `post-sarhu-1619`：三人剧本，规则书起始区域、手牌、人物、军备已由房间初始化测试覆盖。
- `shanhaiguan-1622`：三人剧本，运行时预设已存在；本轮补充同等级房间初始化测试，覆盖建州、长白、辽北、辽东、叶赫部、乌喇部、辉发部、哈达部、察哈尔、外喀尔喀部、喀喇沁部、鄂尔多斯部、扎鲁特部、克什克腾部、巴林部、内喀尔喀部、奈曼部、敖汉部、蓟镇、顺天、东江、宣府、大同、登莱、延绥、山西、保定、山东、辽西、朝鲜三地、科尔沁部、土默特部。
- `dingmao-rebellion-1627`：二人剧本，运行时预设已存在；本轮补充同等级房间初始化测试，覆盖建州、长白、叶赫部、乌喇部、辉发部、哈达部、辽东、辽北、科尔沁部、咸兴、敖汉部、奈曼部、内喀尔喀部、顺天、蓟镇、山东、宣府、大同、登莱、延绥、山西、保定、东江、辽西、平壤、汉城、喀喇沁部、鄂尔多斯部、扎鲁特部、巴林部、克什克腾部、察哈尔、外喀尔喀部、土默特部。

本轮新增测试还锁住了 1627 的二人剧本特例：只开放大明、后金两个玩家座位，蒙古保持中立占位；大明 5 张手牌、后金 6 张手牌、蒙古 0 张手牌；熊廷弼、努尔哈赤、额亦都移出游戏；大明和后金的起始军备按规则书落地。

注意：`顺天 / 蓟镇` 是当前运行时拆模口径，兵力集中在 `蓟镇` 运行时区，`顺天` 只保留人口壳层；这不是 TTS 替代区域系统，也不反向修改正式印刷区。

### 1619 起始区域

已在 `src/games/qidahen/domain/scenarioRuntimeRegionPresets.ts` 增加 `post-sarhu-1619` 运行时区域预设，补齐规则书明确的起始区域状态：

- 后金：建州、长白、辉发部、哈达部。
- 蒙古：察哈尔、叶赫部、扎鲁特部、克什克腾部、巴林部、内喀尔喀部、奈曼部、敖汉部。
- 大明：顺天、辽北、辽东、辽西、东江、蓟镇、宣府、大同、延绥、登莱、山西、保定、山东、朝鲜三地。
- 中立：乌喇部、喀喇沁部、科尔沁部、外喀尔喀部、土默特部、鄂尔多斯部。

### 1619 起始手牌/人物/军备

已在 `src/games/qidahen/__tests__/roomSetup.test.ts` 增加房间初始化回归：

- 大明 3 张手牌，火炮技术 1 级。
- 蒙古 6 张手牌，林丹·乎图克图在场，骑兵铁甲 1 级。
- 后金 10 张手牌，努尔哈赤和默认择一人物额亦都在场，范文程未默认在场，步兵铁甲 1 级。
- 开局可见普通手牌按 TTS `deckKey 16` 的阵营顺序绑定 `atlas05` 预览。

## 朵颜部判断

TTS 确实存在：

```text
朵颜部人口    TTS 坐标 x=-10.005, z=-2.678
```

用 31 个已命名人口计数器和当前运行时区域中心做仿射拟合后，朵颜部投影大致在当前地图坐标：

```text
x≈558, y≈469
```

最近的当前运行时区域依次接近：

| 候选 | 距离 | 判断 |
| --- | ---: | --- |
| 锦州 | 约 63 | 最近，但规则书不是把朵颜部等同锦州 |
| 山海关 | 约 84 | 接近，但语义不匹配 |
| 察哈尔 | 约 118 | 接近但仍不是同一区域 |
| 辽西 / 顺天 / 宣府 / 敖汉部 / 蓟镇 | 约 171-183 | 只能说明位置在中部边界带附近 |

结论：TTS 摆位能证明“朵颜部是实体摆位线索”，但不能证明当前运行时应把它并入某个已有区域，也不能绕过正式区域闭合区确认流程。若后续要补朵颜部，必须先重新核正式地图图面和区域 mask，再按七大恨区域拓扑 workflow 新增正式区或逻辑区。

## 验证记录

本轮最新已通过：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/roomSetup.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000

1 file passed, 19 tests passed
```

之前同轮曾通过：

```text
assetPaths.test.ts + manifest.test.ts + Board.test.ts
3 files passed, 201 tests passed
```

```text
payment-selection.test.ts + defeatInDetail.test.ts 定向事件回归
封贡敕书 / 各个击破 / 反间计 / 王公大会 / 人参貂皮 / 东北大军 / 开门迎降 相关用例通过
```

## 后续可继续利用 TTS 的方向

- 标记图片：继续核对控制/外交、本土、干旱、破败/战败、胜利点和轮盘行动标记是否都已进入正式资源和关键预加载。
- 军备/辅助卡：只做资源与图集绑定核对，不把 TTS 当规则文本来源。
- 牌组顺序：继续作为普通手牌抽牌顺序和 `previewRef` 的回归真相源。
- 地图摆位：只作为“候选摆位证据”，不得直接替代区域 mask、区域图或图面闭合区判断。

## 标记资源补充核对

TTS 中能命名确认的标记素材已经与当前正式资源清单对齐：

| TTS 标记 | 当前正式资源 | 当前处理 |
| --- | --- | --- |
| 轮盘行动 | `qidahen/markers/chronology-year-marker` | Board 轮盘当前位置使用，已纳入游戏清单与关键图片解析器预加载，并由资源路径合同锁住 |
| 干旱 | `qidahen/markers/drought-marker` | 事件状态会派生地图标记；同时纳入暖图预加载 |
| 破败/战败 | `qidahen/markers/battle-defeat-marker` | 当前战败和防线破败由玩家面板/防线条展示；素材纳入暖图预加载，暂不硬塞地图 |
| 汉城胜利点 | `qidahen/markers/hanseong-victory-point-marker` | 胜利点素材纳入暖图预加载，胜利分数仍以运行态威望计算为准 |
| 玉玺胜利点 | `qidahen/markers/imperial-seal-victory-point-marker` | 胜利点素材纳入暖图预加载，胜利分数仍以运行态威望计算为准 |
| 后金本土 | `qidahen/markers/jin-homeland-marker` | 本土目前是规则判定语义，素材纳入暖图预加载，暂不作为区域系统重构入口 |
| 蒙古本土 | `qidahen/markers/mongol-homeland-marker` | 本土目前是规则判定语义，素材纳入暖图预加载，暂不作为区域系统重构入口 |

这次只补资源链与测试合同：`src/games/qidahen/manifest.ts`、`src/games/qidahen/criticalImageResolver.ts` 和 `src/games/qidahen/__tests__/assetPaths.test.ts`。其中轮盘行动标记已经同时覆盖 Board 使用、游戏清单关键图片和关键图片解析器预加载。没有把 TTS 标记直接变成新的地图区域真相，也没有改当前 `region-mask / region-graph` 区域系统。

### 进一步资源链补齐

继续核对 TTS 存档后，确认当前项目里已有但清单预加载覆盖不足的正式素材包括：

- 友好/附庸标记 B 面：`ming-control-diplomacy-marker-b`、`mongol-control-diplomacy-marker-b`、`jin-control-diplomacy-marker-b`。
- 破败与积分标记：`ruin-marker`、`ming-score-marker`、`mongol-score-marker`、`jin-score-marker`。
- 地图运行时可能显示的部队素材：大明、蒙古、后金、neutral 的正规军、雇佣军、炮兵、骑兵、步兵，以及大明川兵。

本轮已把这些资源补进 `QIDAHEN_MANIFEST.warmImages` 与 `qidahenCriticalImageResolver(...).warm`，并在 `assetPaths.test.ts` 增加合同测试，要求这些 TTS 已确认正式素材同时满足：

- 游戏清单可发现；
- 关键图片解析器会预加载；
- 对应压缩运行时文件存在。

这仍然只是补齐资源可达性，不代表引入新的规则脚本、替换 UI 逻辑，或重做区域绘制系统。

### 普通手牌正面图集预加载补齐

继续核对当前运行时消费链后，确认正式普通手牌已经通过 `qidahen/cards/atlases/ordinary-hand-atlas05` 承载正面图集，但该图集原先没有进入 `QIDAHEN_MANIFEST.criticalImages` 与 `qidahenCriticalImageResolver(...).critical`。本轮已补齐这条关键图片链路，并在 `assetPaths.test.ts` 增加“正式卡牌图集资源路径合同”，锁住当前运行时会消费的六组卡牌图集都必须满足：

- 游戏清单可发现；
- 关键图片解析器会预加载；
- 对应压缩运行时文件存在。

这属于 TTS 普通手牌顺序和正式图集消费链的补缺，不改变逐牌规则实现，也不替换当前 UI 结构。

## 事件结算文案核对

TTS 没有脚本可补，但当前仓库已有 `temp/qidahen-completion-implementation/final-card-semantic-audit.json` 记录 49 张普通手牌逐牌语义审计均为 `pass`。因此正式运行态不应在每次事件牌结算后继续固定显示“其它完整事件效果仍待逐张实现”。本轮已把 `执行事件` 摘要收回到当前真实信息：牌名、规则摘要、实际结算效果、移出游戏/持续事件去向；同时把行动入口说明改成“按当前已接入的逐牌效果结算”。这不等于声明 OpenSpec `2.4 / 4.5` 完成，只是移除一条已经会误导玩家的过期运行态兜底文案。

## TTS 普通手牌牌堆核对

TTS 仍没有 Lua/XML 规则脚本可对照逐牌效果，但 `deckKey 16` 可以作为普通手牌牌堆顺序证据继续发挥作用。本轮重新统计后确认：

- 当前正式普通手牌身份表有 49 张，TTS `deckKey 16` 普通手牌唯一索引也是 49 张。
- 大明、蒙古、后金三方 TTS 普通手牌牌堆合计 84 张实体顺序；其中所有索引都能回到当前已确认的 49 张 `atlas05` 普通手牌身份。
- 当前没有发现 TTS 普通手牌中存在“项目缺失的普通手牌定义”，也没有发现项目里多出不在 TTS 普通手牌集合内的 1600 段正式普通手牌。
- TTS 中其它牌堆更适合作为纪年/剧本/朝鲜/玩家辅助卡的资源与摆位参考，不能当规则脚本来源；本轮没有把这些牌堆硬转成规则逻辑。

继续抽取 TTS 其它牌堆后，确认它们应保持“资源/顺序参考”定位，而不是回流成普通手牌或逐牌规则来源：

- `deckKey 17`：纪年牌堆，24 张实体顺序，唯一索引 15 个。
- `deckKey 15`：朝鲜特殊牌堆，5 张实体顺序。
- `deckKey 13`：辅助/相关牌堆，14 张实体顺序。
- `deckKey 2`：剧本/参考牌堆，9 张实体顺序。
- `deckKey 26-31`：三方军备/辅助卡单张自定义牌素材，可作为资源和摆位参考。

已在 `src/games/qidahen/__tests__/roomSetup.test.ts` 增加合同测试，锁住三方 TTS 普通手牌牌堆顺序只能引用已确认的 `atlas05` 普通手牌身份，并明确排除未验收索引 `47` 回流；同时记录其它 TTS 牌堆不能被误当成 `deckKey 16` 普通手牌规则来源。

## 最新验证记录

资源合同已通过：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/assetPaths.test.ts src/games/qidahen/__tests__/manifest.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000

2 files passed, 7 tests passed
```

七大恨聚焦套件已通过：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/assetPaths.test.ts src/games/qidahen/__tests__/roomSetup.test.ts src/games/qidahen/__tests__/manifest.test.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 300000 --hookTimeout 300000 --reporter=json --outputFile=temp/qidahen-focused-report.json

14 suites passed, 677 tests passed, 0 failed
```
