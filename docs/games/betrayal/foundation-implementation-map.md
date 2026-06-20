# 山屋惊魂 foundation 实施映射

本文件只回答一件事：`add-betrayal-foundation` 的首期 skeleton 应该怎样落到代码与资源目录里。

当前状态：proposal 已校验，foundation skeleton 已按本文件首轮落地；本文件既是实施合同，也是当前落点回查入口。

## 1. 实施边界

本轮 foundation 只做以下内容：

- `src/games/betrayal/` 最小骨架
- 大厅可见的 manifest / thumbnail
- 一个运行时主界面的最小 skeleton（优先 `pre-haunt`，不是完整玩法，也不是资料录入页）
- 已识别资源的正式目录收口与访问合同

本轮明确不做：

- 房间板块拼版裁图
- 楼层板 / 起始房间板裁图
- 扫描 PDF OCR
- 完整玩法、流程、命令、领域规则
- AI、教程、debug 面板的正式交付

## 2. 对照游戏与借鉴点

### 2.1 manifest 对照

- 结构基线参考：
  - `src/games/smashup/manifest.ts`
  - `src/games/qidahen/manifest.ts`
- `betrayal` foundation 已对齐方式：
  - 采用 `qidahen` 的 `statusTag: 'under_construction'`
  - 采用 `smashup` / `qidahen` 的 `thumbnailPath: 'betrayal/thumbnails/cover'`
  - 首期 `enabled: true`，让大厅能看到入口
  - `ai` 仅补 manifest 生成器强制字段，全部保持 `false`，不误报成“AI 已支持”

### 2.2 thumbnail 对照

- 直接复用：
  - `src/games/smashup/thumbnail.tsx`
  - `src/games/qidahen/thumbnail.tsx`
- `betrayal/thumbnail.tsx` 应直接走 `ManifestGameThumbnail`，不自写图片路径

### 2.3 Board 运行界面对照

- 不提前实现完整玩法 Board
- 但也不再把“资源目录 / 录入页”当作 UI 目标
- 只参考“最小运行态入口”的职责边界：
  - 中央房间板块拼接主视区
  - 当前探索者与其他玩家摘要
  - 牌堆 / 弃牌 / 参考卡的紧凑侧区
  - 顶部轻量阶段 / 回合状态
  - 仅保留必要提示入口，不做大日志面板

也就是说，`Board.tsx` 本轮不是完整玩法面板，但也不是资源与录入进度壳层；它应该先落成 `pre-haunt` 运行态主界面的结构骨架。

## 3. 获批后要创建的文件

### 3.1 代码文件

应新增：

- `src/games/betrayal/manifest.ts`
- `src/games/betrayal/thumbnail.tsx`
- `src/games/betrayal/game.ts`
- `src/games/betrayal/Board.tsx`

首期不要求新增：

- `domain/`
- `tutorial.ts`
- `audio.config.ts`
- `debug-config.tsx`

原因：当前 proposal 边界还是 foundation skeleton，不是可游玩的完整游戏。

### 3.2 文案文件

应新增：

- `public/locales/zh-CN/game-betrayal.json`
- `public/locales/en/game-betrayal.json`

最小文案至少覆盖：

- `games.betrayal.title`
- `games.betrayal.description`
- `games.betrayal.players`
- `board.phase.preHaunt`
- `board.sections.players`
- `board.sections.decks`
- `board.sections.rooms`
- `board.status.currentTurn`
- `board.status.move`

## 4. manifest 最小字段合同

`src/games/betrayal/manifest.ts` 至少应包含：

- `id: 'betrayal'`
- `type: 'game'`
- `enabled: true`
- `statusTag: 'under_construction'`
- `titleKey: 'games.betrayal.title'`
- `descriptionKey: 'games.betrayal.description'`
- `category: 'card'`
- `playersKey: 'games.betrayal.players'`
- `icon`
- `thumbnailPath: 'betrayal/thumbnails/cover'`
- `allowLocalMode: false`
- `playerOptions`
- `bestPlayers`
- `tags`

当前仍不建议在 foundation 里先写死：

- `criticalImages`
- `warmImages`
- `setupOptions`
- `mobileBattlefieldZoom`

这些字段要么依赖正式玩法，要么依赖后续裁图与 UI 家族裁定。

## 5. 资源到代码的最小映射

当前首批已识别资源里，foundation 可以直接消费的对象如下。

### 5.1 大厅与标题

- `thumbnails/cover.png`
  - 用于 manifest 缩略图
- `ui/title-banner.png`
  - 用于 Board 顶部主视觉
- `ui/trait-track-0-9.png`
  - 用于 Board 中展示“角色属性轨道素材已锁定”

### 5.2 探索者

来源目录：

- `explorers/`

当前已识别 13 张探索者牌，可在 Board 中做成只读角色墙，证明资源已能被访问，但不承担交互规则。

### 5.3 参考卡与牌背

来源目录：

- `cards/`

当前可直接展示：

- 事件 / 物品 / 预兆 / 叛徒 / 怪物牌背
- 中英玩家参考卡
- 中文叛徒 / 怪物参考卡

Board 中的职责是提供运行时牌堆与参考区的视觉锚点，不提前承诺完整牌堆规则。

### 5.4 标记

来源目录：

- `markers/`

当前 28 个标记可在 Board 中做成紧凑状态对象或预留槽位，用于证明资源路径和缩略加载已经接通。

### 5.5 本轮禁止接入的资源

以下对象即使存在图片，也不能在 foundation 里冒充正式运行时对象：

- 房间拼版大图
- 楼层板大图
- 扫描页
- 整版说明页
- 无法唯一判断语义的候选图

## 6. 目录迁移顺序

本轮已按以下顺序落地：

1. 把 `public/assets/betrayal/` 下已筛出的正式分类迁到 `public/assets/i18n/zh-CN/betrayal/`
2. 重新运行：
   - `npm run compress:images -- public/assets/i18n/zh-CN/betrayal`
   - `npm run assets:manifest`
   - `npm run assets:check`
3. 若远端缺口出现，再执行：
   - `npm run assets:upload`
4. 再开始 `src/games/betrayal/` skeleton 接入

这里先迁资源、再建代码，是为了让 `thumbnailPath`、Board 图片访问路径和 manifest 聚合键一次到位。

## 7. Board 首屏建议

`Board.tsx` 首屏建议先按运行时主界面组织，只保留 4 个主区：

1. 中央房间区
   - 以房间板块拼接区为主视图
   - 当前缺正式裁图时允许用结构占位，但不做资源目录墙
2. 探索者区
   - 当前探索者大卡
   - 其他玩家紧凑摘要
3. 牌堆 / 参考区
   - `Omen / Item / Event` 牌堆、弃牌、参考卡紧凑摆放
4. 顶部轻量状态区
   - 阶段、当前回合、步数等短状态

首屏不应出现：

- 资料录入清单作为主视图
- 资源目录墙
- 假装已经进入 haunt / traitor / scenario 的交互
- 常驻大段规则说明

## 8. 验证链

本轮已完成的最小验证链为：

1. `npm run generate:manifests`
2. 确认 `src/games/manifest.client.generated.tsx` 已纳入 `betrayal`
3. 运行最小类型检查或定向测试，证明 skeleton 可加载
4. 确认大厅能看到 `betrayal`，且进入后展示的是运行时 skeleton，而不是资料录入页或错误页

## 9. 当前剩余缺口

当前不再是批准阻塞，剩余缺口是：

- 房间板块与楼层板正式裁图
- 角色选择页与终局页的正式代码落地
- haunt / 叛徒 / 剧本 / 怪物的正式领域逻辑
- 远端资源正式上传（当前 `assets:check` 已列出新增项，尚未执行 `assets:upload`）
