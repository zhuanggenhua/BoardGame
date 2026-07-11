# PR #88 美人鱼、希腊神话 POD 与主线合并审计记录（2026-07-10）

## 背景

- 原始 PR：`#88 接入美人鱼与希腊神话 POD 派系`
- PR 原 head：`ca2d83015587afa7e3bc87b4f44054c2ec94915b`
- 合入的主线提交：`49dbb13847156f31c35290c6d34f5a8480a8f92c`
- 共同父提交：`da82e67afbbe9af038e4897666f2cd564126ae99`
- 执行现场：独立临时目录的 detached HEAD；没有修改用户当前主工作区。

## 双侧内容

PR 一侧新增：

- 美人鱼 POD、希腊神话 POD。
- 对应卡牌、基地、能力、图集、派系选择元数据、中英文文案与测试。

主线一侧新增并已通过门禁的内容：

- 圣骑士 DIY、神圣炽天使及对应资源与注册。
- Pretty Pretty POD 的猫咪、小马、妖精、公主四个派系。
- 鲨鱼 POD、龙卷风 POD、全明星 POD。

## 双侧重叠文件

1. `public/locales/en/game-smashup.json`
   - 结构化三方合并，保留美人鱼、希腊神话、Pretty Pretty、三套既有 POD 与圣骑士全部英文键。
2. `public/locales/zh-CN/game-smashup.json`
   - 结构化三方合并，保留双方全部中文键。
3. `src/games/smashup/data/cards.ts`
   - 自动合并成功，同时保留双方卡牌注册。
4. `src/games/smashup/domain/atlasCatalog.ts`
   - 同时保留美人鱼、希腊神话、Pretty Pretty、三套既有 POD 与圣骑士图集注册。
5. `src/games/smashup/domain/ids.ts`
   - 同时保留双方派系标识、图集标识与中文显示名。
6. `src/games/smashup/ui/factionMeta.ts`
   - 自动合并成功，同时保留双方派系选择元数据。

两份文案、图集目录和标识注册出现 Git 文本冲突；文案使用 JSON 三方合并并拒绝同键异值，结果未发现同键异值。其余重叠文件逐项核对新增标识，最终没有整份采用任一父提交，也没有删除单边独有内容。

## 审查修复

- 英文雅典娜与宙斯恩惠文案补齐冠词和所有格。
- 中文抽牌术语统一为“抓一张牌”。
- 塞壬歌声删除“另一个随从位于同一基地”的矛盾限定。
- 宙斯恩惠将“临界点”改为更符合游戏语义的“爆分线”。
- 美人鱼的诱惑者 POD 是正式持续能力随从，注册审计改为要求它进入持续力量修正注册表。
- 持续力量测试同时覆盖基础版诱惑者和 POD 版诱惑者，确认二者均获得 +2 力量。

## 资源清单

- 聚合清单与 SmashUp 游戏级清单补入 10 组本轮合并结果中的 POD 图集资源。
- 美人鱼 POD 与希腊神话 POD 两张新图集均已进入清单。
- PR 新增的 `mermaids_pod.webp` 与 `mythic_greeks_pod.webp` 都是 4×5、20 张派系卡图集，不包含基地图片。
- 人鱼水池（`base_mermaid_pool_pod`）、人鱼暗礁（`base_mermaid_reef_pod`）、特尔斐的神谕（`base_oracle_at_delphi_pod`）与特洛伊木马（`base_wooden_horse_pod`）没有独立 POD 基地图，沿用现有基地图片并由文字覆盖层展示 POD 文案；资源映射测试将它们纳入既有文字回退名单。
- 保留游戏级清单原有 `id=i18n/zh-CN/smashup` 与 `basePrefix=official/i18n/zh-CN/smashup/`。
- 清除误执行全局增量扫描产生的 DiceThrone 哈希变化和其他游戏无关清单变化。
- Android 游戏包素材合同改为使用已提交的资源清单补齐被 Git 忽略的大素材元数据，避免本机完整素材环境与 CI 精简检出得到不同结论。
- SmashUp 资源合同改为逐项断言本次补齐的 10 组合法 POD 图集，不再依赖不同执行环境下不稳定的精确文件总数。

## 验证

- 新派系、基础能力、POD 注册审计、持续力量与既有齐柏林飞艇回归测试：6 个文件、179 条测试通过。
- 派系选择与 POD 基地图映射测试：46 条测试通过，确认四个无独立 POD 基地图的基地均走既有文字回退。
- 两份资源清单仅新增上述 10 组 SmashUp 资源，清单元数据未改变。
- `npm run typecheck`：通过。
- `npm run i18n:check`：通过。
- 11 个相关 TypeScript 文件的定向 ESLint：0 个错误；美人鱼能力文件保留 13 条既有 `any` 警告。
- `i18n/zh-CN/smashup` 资源清单增量校验：通过。
- Android 游戏包素材内容测试：8 条测试通过。
- 暂存差异格式检查：通过。

## 结果

- 美人鱼 POD、希腊神话 POD 与主线已有圣骑士、Pretty Pretty POD、鲨鱼 POD、龙卷风 POD、全明星 POD 均完整保留。
- 本文档随本次 merge commit 一同提交，供合并冲突质量门审计。
