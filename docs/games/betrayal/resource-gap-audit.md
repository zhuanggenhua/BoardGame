# 山屋惊魂资源缺口审计

这份审计只回答一个现实问题：

为什么你在 `山屋惊魂` 的素材目录里，看不到“像现有游戏那样已经成型的正式素材”。

结论先说：

- 不是素材丢了。
- 也不是这批图完全不能用。
- 真正缺的是“从素材候选层进入正式运行时层”的后半段收口。

也就是：现在很多对象还停在 `intake 暂存 / 拼版源图 / 扫描页 / 候选图`，还没有变成代码会直接消费的正式资源树。

## 1. 对照基线来自哪些现有游戏

本轮对照了两类现有游戏：

- `smashup`
  - 参考 `.spec/skills/smashup-faction-intake/SKILL.md`
  - 重点看“图片 intake 之后如何落到正式运行时目录、如何生成 manifest、如何进入代码”
- `qidahen`
  - 参考 `src/games/qidahen/rule/七大恨素材接入清单.md`
  - 重点看“单对象正式命名、正式资源树、哪些大图/帮助图可以进运行时，哪些只能当参考素材”

## 2. 现有游戏的正式资源结构长什么样

按现有 workflow，一个已经进入正式运行时层的新游戏，至少会同时具备下面几层：

1. 正式图片目录
   - `public/assets/i18n/zh-CN/<gameId>/...`
2. 游戏级资源清单
   - `public/assets/i18n/zh-CN/<gameId>/assets-manifest.json`
3. 聚合资源清单
   - `public/assets/i18n/assets-manifest.json`
4. 大厅入口与图片逻辑路径
   - `src/games/<gameId>/manifest.ts`
   - `thumbnailPath: '<gameId>/thumbnails/cover'`
5. 最小代码骨架
   - `src/games/<gameId>/thumbnail.tsx`
   - `src/games/<gameId>/game.ts`
   - `src/games/<gameId>/Board.tsx`
6. 本地化文案
   - `public/locales/zh-CN/game-<gameId>.json`
   - `public/locales/en/game-<gameId>.json`

如果缺其中前 4 层，素材即使已经被挑出来、改好名字、压好缩略图，用户从仓库结构上看，依然不会觉得它“像正式游戏素材”。

## 3. betrayal 当前实际状态

当前 `betrayal` 已经有的，只到这一步：

- 候选正式资源已筛出，并暂存在：
  - `public/assets/betrayal/`
- 当前暂存目录下有 6 个分类：
  - `cards/`
  - `explorers/`
  - `markers/`
  - `monsters/`
  - `thumbnails/`
  - `ui/`
- 对应压缩图也已经存在：
  - 每个分类下都有 `compressed/`
- 资料索引与命名合同已经建立：
  - `docs/games/betrayal/intake-contract.md`
  - `docs/games/betrayal/resource-migration-plan.md`
  - `docs/games/betrayal/foundation-implementation-map.md`
- 运行时地图 token 已先补到当前真实流程最小集合：
  - `杰登·琼斯`
  - `神父梁沃伦`
  - `丽贝卡·艾伦博士`
  - `达里尔·海拉`

也就是说：

- 候选对象识别：已经做了
- 单对象命名：已经做了首轮
- 压缩图：已经做了
- 资料文档：已经做了

但下面这些正式层还没发生：

- 还没迁到 `public/assets/i18n/zh-CN/betrayal/`
- 还没重建正式 manifest
- 还没有 `src/games/betrayal/` 代码骨架
- 还没有 `game-betrayal.json`

## 4. betrayal 缺的不是“几张图”，而是哪几层

### 4.1 缺正式目录层

当前路径：

- `public/assets/betrayal/...`

正式应为：

- `public/assets/i18n/zh-CN/betrayal/...`

这一步没完成，就意味着：

- `thumbnailPath`
- `AssetLoader`
- 聚合 manifest

都还不能按现有游戏合同稳定消费 `betrayal` 资源。

### 4.2 缺正式入口层

当前还没有：

- `src/games/betrayal/manifest.ts`
- `src/games/betrayal/thumbnail.tsx`
- `src/games/betrayal/game.ts`
- `src/games/betrayal/Board.tsx`

所以即使图片已经存在，也没有大厅入口和最小游戏壳层把它们挂起来。

### 4.3 缺文案层

当前还没有：

- `public/locales/zh-CN/game-betrayal.json`
- `public/locales/en/game-betrayal.json`

所以它还没有像现有游戏那样形成正式标题、描述、区块文案和状态文案。

### 4.4 缺“房间 / 楼层 / 规则”这三大正式对象层

这是你最容易感到“素材没出来”的地方。

当前已经识别的正式对象，主要是：

- 探索者牌
- 参考卡 / 牌背
- 标记
- 标题横幅

但 `山屋惊魂` 真正更像“正式游戏核心资源”的对象，其实是：

- 房间板块
- 楼层板 / 起始房间板
- 规则 / 剧本结构化文本

而这三层现在都还没进入正式运行时目录，原因分别是：

- 房间板块：仍停留在拼版源图，还没裁成单房间对象
- 楼层板：仍停留在整版素材，还没裁成运行时对象
- 规则文本：本地 PDF 基本是扫描件，自动抽取不到可读正文

所以你会觉得“应该出现的正式素材没看到”，本质上不是前面那 59 张候选图没做，而是这三层还没进入正式层。

## 5. 和 smashup / qidahen 的关键差别

### 5.1 和 Smash Up 的差别

`smashup` 的图片 intake 完成后，会立刻进入：

- 正式 i18n 资源树
- atlas / manifest
- 静态数据与 locale
- 大厅与运行时消费链

而 `betrayal` 目前只做到“图片挑出来、命名、压缩、留档”，还没进正式资源树，也还没进运行时代码。

### 5.2 和七大恨的差别

`qidahen` 的 intake 文档已经明确写成了“单对象正式目标路径表”，例如：

- 地图板
- 轮盘
- 标记
- 单位
- 牌背
- 图集

即使其中有些大图后续还要补 atlas 合同，它至少已经被定义成“正式运行时对象”。

而 `betrayal` 目前最核心的大对象：

- 房间
- 楼层
- 剧本

还没有这张“正式对象路径表”，因为裁图和 OCR 还没过门。

## 6. 当前已经可以认定的结论

可以明确认定：

1. `create-new-game` skill 的资源口径确实需要更新，这件事已经完成。
2. `betrayal` 当前看不到“像正式游戏那样完整”的素材结构，是合理现象。
3. 原因不是素材没了，而是正式资源链只完成了前半段。
4. 当前最像正式素材的 59 个对象，已经被筛出并命名，但还停在暂存目录。
5. 真正阻止它“看起来像正式游戏”的，是这几层还没完成：
   - 正式目录迁移
   - manifest 重建
   - `src/games/betrayal/` skeleton
   - 房间 / 楼层裁图
   - 预兆正面卡图 intake（物品正面 atlas 已确认；预兆当前证据仍只看到牌背、参考卡或剧本触发表，未见可用正面 atlas）
   - 规则 OCR / 结构化
   - 其余探索者 / 更多怪物的地图 token 还没全部接入；当前只是先补到实际运行时会出现的一批

## 7. 接下来一旦开始正式实施，顺序应是什么

按现有证据，正确顺序应是：

1. 先把 59 个已识别对象迁到 `public/assets/i18n/zh-CN/betrayal/`
2. 重建资源 manifest
3. 建 `src/games/betrayal/` 最小 skeleton，让大厅和 Board 能消费这些资源
4. 再处理房间板块与楼层板裁图
5. 最后处理规则 OCR / 结构化与正式玩法

也就是说，当前离“正式素材结构成型”还差两段：

- 一段是 foundation 收口
- 一段是房间 / 楼层 / 规则三大核心层
