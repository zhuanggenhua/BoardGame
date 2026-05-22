# 七大恨数字化可行性初评（2026-05-11）

## 结论

可做，但不建议一口气做成完整规则自动化。该游戏是三势力非对称、点对点地图、轮盘行动、手牌资源、区域控制、木块隐藏信息与多阶段战斗结合的中重策略游戏；最稳妥路线是先做“可玩 MVP + 关键自动结算”，再逐步自动化人物、事件、战术与剧本细节。

## 有利条件

- 规则 PDF 为原生文字，可稳定转 Markdown 并建立规则索引。
- 素材包覆盖主地图、行动轮盘、牌背、整版牌库、单位贴纸、标记、帮助卡、剧本设置表与封面。
- 游戏核心状态可以用现有引擎表达：玩家、牌堆/弃牌、区域、控制标记、部队、人口、阶段、事件流。
- 战斗骰面与单位等级清晰，适合做确定性测试与状态注入。

## 引擎映射初稿

| 规则对象 | 建议实现 | 说明 |
| --- | --- | --- |
| 三势力玩家 | `players` + `currentPlayer` + 顺位表 | 大明、蒙古、后金为固定阵营，不建议做自由阵营混搭。 |
| 行动轮盘 | FlowSystem 阶段 + 轮盘位置字段 | 每回合先转轮盘，再由玩家自行排序执行手牌行动/轮盘行动。 |
| 牌堆/弃牌 | zones/deck 抽弃模型 | 势力牌堆“弃牌堆倒转，不洗牌”是关键差异，不能用默认洗牌回收。 |
| 地图区域 | `regions` 配置 + `regionState` | 需要结构化区域、相邻、边界类型、城市、首都、民族、马匹、船锚、人口上限。 |
| 部队木块 | 单位实体 + owner/faction/kind/grade/hiddenTo | 贴纸朝向代表私有信息，UI 必须按 playerID 脱敏。 |
| 人口/控制/本土/破败 | regionState 字段或 tag | 这些直接影响税赋、补给、外交、维护费和胜利。 |
| 战斗流程 | InteractionSystem 多步交互 | 避战、守城、战术、战损分配、撤退都需要玩家选择。 |
| 纪年/人物/事件/战术 | 数据驱动能力 + 分批白名单 | 第一版不建议一次性全自动化，先覆盖基础公共规则。 |

## 主要风险

1. **隐藏信息/木块朝向**：实体桌游用“贴纸面朝玩家”隐藏兵种与等级；网页端需要为每位玩家做私有视角与观战脱敏。
2. **地图数据量大**：约 35 个一般区域 + 朝鲜区域 + 多种边界（山脉、河流、长城、水路、城市/首都/马匹/民族/人口上限），必须先结构化地图图层。
3. **战斗流程复杂**：公开部队、避战、守城、劫掠、战术、炮/骑/步顺序、战损分配、撤退、战败标记、城战/野战差异都需要 InteractionSystem 分阶段处理。
4. **卡牌与人物自动化成本高**：势力牌、朝鲜牌、人物、纪年卡包含大量例外效果；建议先实现基础资源/移动/战斗，再按卡牌优先级分批接入。
5. **素材仍需裁切合同**：当前牌库多为整版 atlas，需要补坐标/卡名顺序，部分单卡姓名也需要复核。

## 本轮资源结论

- 2026-05-21 修订：旧结论中“缩略图位于 `public/assets/qidahen/thumbnails/`”已失效；缩略图按新游戏资源实施规范归入 `public/assets/i18n/zh-CN/qidahen/thumbnails/`，`thumbnail.tsx` 统一通过 `ManifestGameThumbnail` 读取 `manifest.thumbnailPath`。
- 正式资源已落到 `public/assets/i18n/zh-CN/qidahen/`，缩略图同样归入 `public/assets/i18n/zh-CN/qidahen/thumbnails/`。
- 已生成 71 个运行时 WebP，其中主资源目录 70 个、缩略图目录 1 个。
- `npm run assets:manifest` 与 `npm run assets:validate` 已通过。
- `npm run assets:upload` 已上传本轮新增 71 个远端对象，失败 0。
- 远端抽查通过：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/qidahen/board/compressed/main-board.webp`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/qidahen/cards/atlases/compressed/ming-deck-atlas.webp`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/qidahen/thumbnails/compressed/cover.webp`

## 推荐实现阶段

- **S0 规则/素材合同**：完成规则 Markdown、素材清单、地图区域表、牌库/人物/纪年卡裁切合同。
- **S1 壳与状态模型**：3 玩家联机、地图展示、私有手牌、公开标记/人口/控制/部队容器。
- **S2 基础轮盘与手牌资源**：轮盘推进、抽/弃牌、手牌上限、年中/新年框架。
- **S3 地图与行动 MVP**：开垦、外交、雇佣、徵兵/训练、基础进攻调度。
- **S4 战斗 MVP**：公开部队、骰子、战损、胜负、撤退；先不覆盖所有人物/战术例外。
- **S5 剧本与胜利**：1619/1622/二人丁卯胡乱起始设置、三类胜利条件。
- **S6 卡牌/人物分批自动化**：按势力与触发窗口分批做事件、军备、战术、人物判定。

## MVP 范围建议

第一版可交付标准建议定义为：三人在线可进入 1619 剧本，轮盘行动与基础势力行动可执行，基础地图移动/战斗/胜利条件可自动结算；复杂人物、事件和战术牌先以“人工确认/日志记录 + 白名单自动化”方式逐步补齐。

## 当前已落地材料

- 规则 Markdown：`src/games/qidahen/rule/七大恨规则.md`
- 素材清单：`src/games/qidahen/rule/七大恨素材接入清单.md`
- 正式图片资源：`public/assets/i18n/zh-CN/qidahen/`
- 缩略图：`public/assets/i18n/zh-CN/qidahen/thumbnails/cover.png`
- 临时核对图：`temp/qidahen-intake/contact-*.png`
