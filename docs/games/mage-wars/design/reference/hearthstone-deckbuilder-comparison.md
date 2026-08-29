# Hearthstone Deck Builder 对照审计

> 角色：`evidence / drift-check`。本文件记录 Mage Wars 法术书构筑页对 Hearthstone 组牌编辑态的正反对照，不是独立规范来源。执行规则回到 `.spec/skills/game-ui-design/references/layout-interaction-patterns.md`、`.spec/skills/mage-wars-ui-design-memory/SKILL.md` 和 `user-correction-traceability-ledger.md`。

## 参考源

- Blizzard 官方 Card Library / Deck Builder 页面：`https://hearthstone.blizzard.com/en-us/deckbuilder`
- Blizzard 官方 Returning Player Guide：`https://hearthstone.blizzard.com/en-us/news/24244450/welcome-back-to-hearthstone-a-returning-player-s-guide`
- Blizzard 官方 Card Library 新闻：`https://news.blizzard.com/en-us/article/20056284/the-hearthstone-card-library-is-now-live`
- Blizzard 官方 Deck Recipes 新闻：`https://hearthstone.blizzard.com/en-us/news/20056279/lets-get-brewing-with-deck-recipes`
- HearthPwn in-game deck building guide：`https://www.hearthpwn.com/deckbuilding`
- Gamer Experience deck tutorial：`https://gamerexperience.com/hearthstone-how-to-build-a-deck/`

访问日期：2026-08-28。

## 参考不变量

Hearthstone 组牌编辑态可迁移的是结构和职责，不是木纹、卡背、英雄皮肤或具体尺寸。

- 主视觉是卡池 / 收藏册，玩家主要在这里浏览候选卡并点击加入。
- 右侧是已选 deck list，承担卡名、费用 / 曲线、数量和移除 / 调整。
- 搜索、过滤和 mana / 类型等筛选是工具条，不能变成主对象或解释面板。
- hero / class / deck identity 是单一 owner，不在标题、tab、摘要和卡池里反复复写。
- 当玩家最终选择的是可使用 deck / loadout 时，deck / loadout 是主对象；hero / class 只是绑定信息、筛选信息或详情入口。
- 完成 / 返回是编辑态的收口动作，不在卡池、牌表和 footer 多处重复。
- import / new deck / save 这类管理动作存在，但不应默认压过卡池和 deck list。
- Hearthstone 新建 deck 的身份归属发生在新建分支里：`New Deck` 后先选择 class，再进入推荐 deck / 编辑；可迁移不变量是“未绑定配置先绑定身份”，不是在编辑态常驻第二套 hero / class owner。
- 玩家自定义 / 命名保存副本必须有清楚身份标记；参考 Summoner Wars 时，迁移的是同一配置库末尾 `+` 入口和 DIY 身份标记在配置本体上可见这两个不变量，不是另造角落管理区。
- 每个常驻 UI 元素都要先通过职责自证：成熟参考没有的元素必须能由 Mage Wars 规则、保存模型、素材比例、错误恢复或可访问性解释；解释不了就删除、折叠或降权。

## 炉石有，而 Mage Wars 必须问为什么没有

| Hearthstone 细节 | Mage Wars 旧问题 | v18 裁定 |
| --- | --- | --- |
| 卡池是最大区域 | 顶部法术书库 / 保存 / 容量三栏占高，卡池被压低 | 顶栏压缩为 4.625rem，主区恢复为卡池 + 右侧清单 |
| 右侧 deck list 是已选集合 owner | 已有右侧清单，但 footer 又放完成动作和规则说明 | 右侧只保留法术书清单和数量调整，完成动作移到顶栏唯一入口 |
| 筛选是紧凑工具 | 搜索和 4 个 select + 范围按钮组成厚筛选墙；学派下拉一度混入蝙蝠、手套、靴子等子类型 | 保留类型 / 学派或元素 / 等级 / 法力费用 / 状态，压成 2.55rem 工具条；学派层只显示正式学派 / 元素词，子类型不得污染该层 |
| mana / 费用过滤 | Hearthstone 有法力费用筛选；Mage Wars 卡牌有 `manaCost` / `rawCost`，但旧版没有同层过滤 | 补法力费用筛选：全部、0-2、3-5、6-8、9+、X；它过滤打出法力费用，不替代构筑法术点 |
| 当前 deck / hero owner 单一 | 旧版把法师名、标准书、当前书、详情入口多处复写 | 顶栏左侧法师主控是唯一法师 owner，点击本体看规则卡 |
| deck list 可用文字行管理数量 | 曾担心右侧显示卡名违反“卡面不复写” | 右侧清单是 deck list 职责，允许短名；卡池卡图仍不在卡外复写正文 |
| 当前候选卡可读 | 旧版卡池卡牌过小，玩家需要靠外部文字猜卡 | 卡池最小宽度由实现锚点和 E2E 像素断言卡住；看不清先放大和滚动，不复写牌面字段 |
| 完成动作单一 | 旧版顶部和右侧 footer 各一套返回 / 确认 | 删除右侧 footer，保留顶栏返回 / 确认 |
| 导入 / 管理入口降权 | 旧版法术书库默认展开，占据主视觉 | 法术书库和导入改为按需弹层，默认态不渲染大管理列表 |

## Mage Wars 有，而必须问为什么要加

| Mage Wars 细节 | Hearthstone 是否有 | 保留 / 删除理由 |
| --- | --- | --- |
| 法术点 `当前 / 上限` | 没有同名机制 | 保留。Mage Wars 构筑合法性由法师能力牌法术点、训练 / 相斥成本决定，不是只看张数 |
| 训练 / 相斥成本 | 没有同名机制 | 保留在行级成本 / 详情里。它直接影响是否能加入和本条占用 |
| 每卡 `当前 / 上限` | Hearthstone 有数量限制但通常是 deck list 计数 | 保留在右侧清单唯一 owner。卡池不再贴 `xN` |
| 横向墙牌 | Hearthstone 卡牌比例统一 | 保留。Mage Wars 墙体法术是正式横向牌面，必须按源素材比例显示 |
| 右侧真实卡图缩略 | Hearthstone 右侧多为费用 + 文字列表 | 保留。用户已禁止简单几何；Mage Wars 牌名陌生且有横向墙牌，缩略图承担卡牌身份，不替代卡池 |
| 标准起始书 / 命名副本库 | Hearthstone 有 My Decks，但编辑态不默认展开 | 保留为按需库弹层。Mage Wars 新书不能藏成 DIY 空态；未绑定新书先选法师，再从该法师标准起始书开草稿 |
| 法术书库 `+` 新建入口 | Hearthstone / Summoner Wars 的配置库有明确 new deck / `+` 入口；Hearthstone 的新 deck 分支会先选 class | 保留。Mage Wars `+` 不隐式沿用当前法师：先选择绑定法师，再进入该法师标准起始书草稿；已保存副本可更新原副本或另存新 id；最多保存 10 本，数据层和 UI 扫描都要卡住 |
| 命名副本 DIY 徽章 | Hearthstone 没有同名标签；Summoner Wars 自定义牌组有 DIY 身份标记 | 保留在命名副本本体上。它区分玩家保存副本和标准起始书，不替代名称、绑定法师或数量 |
| 每张标准书卡常驻 `编辑并另存` | Hearthstone 不在每个预设 / deck 卡下放同权重编辑保存副本按钮 | 删除。点击标准书只负责选择；编辑从统一 `编辑选中书` 入口进入，保存 / 命名副本在构筑器内完成 |
| 导入列表 | Hearthstone 支持导入 deck code | 保留为低权重弹层，不默认占主视觉 |
| `全部卡牌 / 书内 / 可加入 / 墙体` 范围按钮 | Hearthstone 没有第二套同义范围按钮；Mage Wars 已有状态下拉和类型筛选 | 删除。`书内 / 可加入 / 不可加入` 留在状态筛选，`墙体` 进入类型筛选 |
| 规则说明块 | Hearthstone 编辑态不在右侧 footer 常驻规则说明 | 删除。具体合法性通过法术点、行级成本、限制状态和详情层表达 |
| 第二个完成 / 返回区 | Hearthstone 不需要重复完成区 | 删除。顶栏是唯一收口动作 |
| 默认展开法术书库 | Hearthstone 编辑态不默认铺开 deck 管理 | 删除 / 折叠。默认态只显示选中书入口 |

## 当前实现检查口径

- 默认态只能看到：已选法师主控、选中书入口、`+` 新建入口、命名输入 / 保存动作、唯一法术点容量、紧凑筛选工具条、卡池、右侧法术书清单、唯一确认入口。
- 默认态不能看到：展开法术书库、管理说明文案、规则说明块、第二个完成区、`当前法术书`、P1 / P2 / 席位、卡池 `xN`、独立详情按钮、第二套范围按钮、`全部卡牌`、每张标准书卡常驻 `编辑并另存`、把可点击性复述成状态的 `点击使用` / `Click to use`。
- Setup 选书页的主对象必须是法术书库：四本标准起始书、玩家命名副本和 `+` 新建入口同屏同级；旧法师卡选择器、先选法师再选书的截图名 / 测试名 / 文案都视为回归。
- `+` 新建入口是新配置的身份绑定分支，不是构筑器常驻法师切换器：选书页 `+`、构筑器顶部 `+` 和展开库 `+` 必须先打开绑定法师候选层，候选层显示四名法师；选择后以该法师标准起始书进入新草稿，保存出的命名副本绑定玩家选择的法师。
- 有命名副本时，选书页库卡和组书页法术书库行必须显示 DIY 徽章；标准起始书不显示 DIY。
- 组书页默认态必须有红圈标注版截图说明已选法师主控就是能力牌 / 法师详情入口，同时有详情打开态截图。
- 送验前必须跑 `.spec/tools/scan-ui-duplicate-owners.mjs --contract mage-wars-spellbook-selection temp/mage-wars-spellbook-selection-default-dom.html`、`.spec/tools/scan-ui-duplicate-owners.mjs --contract mage-wars-spellbook-builder temp/mage-wars-spellbook-builder-default-dom.html` 和 `mage-wars-spellbook-builder-with-saved` 对应扫描，并用真实截图确认选书卡无废话状态、`02-新建法术书-先选择绑定法师` 截图存在、卡池首屏连续、墙牌横向比例保真、右侧清单可滚动。
- 送验前必须对当前画面所有常驻 UI 元素做职责审计：成熟参考没有且 Mage Wars 规则 / 保存模型 / 素材比例解释不了的 UI 不得保留。
- 学派筛选送验前必须确认只含正式学派 / 元素词；蝙蝠、手套、靴子、传送门、胸甲等卡牌子类型不得出现在学派下拉。
- 类型筛选必须包含墙体；法力费用筛选必须存在，并且不能把打出法力费用和构筑法术点混成一个读数。
