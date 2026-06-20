## Context

当前 `betrayal` 已经完成三类前置工作：

1. 用户本地 `Mods/Images` 与 `Mods/PDF` 已完成首轮 intake；
2. 本地 PDF 被证实为扫描型 PDF，自动文本抽取为空，不能直接当规则真相源；
3. 首批 59 个明确对象已经从乱名图片中筛出、重命名并压缩上传。

但这还不等于 foundation 已经成立。当前还存在两个正式 blocker：

- 新游戏没有 OpenSpec change，范围和交付门禁没有被正式冻结；
- 首批候选资源当前暂存于 `public/assets/betrayal/`，与项目现有 `i18n/zh-CN/<gameId>/...` 运行时资源合同不一致。

## Goals / Non-Goals

- Goals:
  - 为 `betrayal` 建立正式 foundation change
  - 锁定首期资源目录、manifest 接入方式和最小运行时骨架
  - 把“拼版源图还未裁成单对象运行时资源”明确写成当前未完成项
- Non-Goals:
  - 本轮不实现完整玩法
  - 本轮不实现鬼屋剧本、叛徒逻辑、事件/物品牌堆规则
  - 本轮不把大拼版房间图直接当成正式运行时资源

## Decisions

- Decision: 首期 foundation 只交付最小入口和运行时主界面 skeleton
  - Why: 当前真正缺的是新游戏接入骨架、正式资源合同，以及不跑偏的运行时主界面方向；不是资料录入页，也不是完整玩法细节。

- Decision: 正式运行时资源一律迁到 `public/assets/i18n/zh-CN/betrayal/...`
  - Why: 这与现有 `ManifestGameThumbnail`、`AssetLoader`、`create-new-game` skill 的合同一致，避免继续在错误目录上堆实现。

- Decision: 大拼版房间图、楼层图继续停留在 source/candidate 层
  - Why: 它们还没有被裁成代码可直接引用的单对象资源；提前混入正式运行时目录会污染真相源。

- Decision: 附加能力矩阵本轮不做完整实现
  - Why: 当前 foundation 目标是接入基线，不是一次性交付完整玩法能力。

- Decision: foundation 之前必须补齐 UI 设计稿、需求对齐表和架构审查
  - Why: 否则协作者很容易把“资源结构对了”误当成“游戏方向也对了”，最后实现结果与需求脱节。

- Decision: `betrayal` 当前采用默认模式，不上升总框架
  - Why: 剧本 / 房间 / 楼层 / 私有信息边界都还没冻结，先抽共享能力风险高；本轮只记录候选共享抽取项。

## 附加能力矩阵

| 能力 | 本轮状态 | 说明 |
| --- | --- | --- |
| `action-log` | 仅保留底层接口，UI 暂不交付 | skeleton 可复用基础系统，但不承诺首批 HUD 日志 |
| `undo-system` | 仅保留底层接口，UI 暂不交付 | 与 action-log 同口径 |
| `game-ai-system` | 本轮明确跳过 | 首期不提供 AI 座位或策略 |
| `tutorial-engine` | 本轮明确跳过 | 先不写教程 manifest |
| `debug-config` | 本轮明确跳过 | 暂不补专属调试面板 |

## Risks / Trade-offs

- 如果继续保留 `public/assets/betrayal/` 作为正式目录，后续缩略图和本地化图片读取会与现有项目合同分叉。
- 如果在房间拼版未裁图前就开始真实 Board 布局，实现会被迫围绕错误粒度的资源搭壳。
- 如果在没有 `design-system/games/betrayal.md` 与需求对齐表时直接开工，协作者很容易做出“能跑但不对题”的 foundation。
- 如果在剧本对象模型未冻结前直接抽共享框架，后续大概率需要回滚或重写抽象边界。

## Migration Plan

1. 批准 foundation change。
2. 迁移首批候选资源到 `public/assets/i18n/zh-CN/betrayal/`。
3. 建立 `src/games/betrayal/` 最小骨架与大厅入口。
4. 用后续 change 继续承接房间板块裁图、卡牌目录和玩法实现。

## Post-Foundation Change Split

foundation 获批并交付后，后续默认拆为以下 change：

1. `card-catalog`
   - 房间板块裁图与正式对象目录
   - 楼层板 / 起始房间板对象目录
   - 剧本 / 鬼屋卡表与规则对象目录
   - 正式运行时资源与对象命名合同
2. `gameplay`
   - 探索流程
   - 牌堆、角色属性、鬼屋/叛徒/胜负逻辑
   - 私有信息与公开信息边界
3. `runtime-entry`
   - `manifest.enabled` 是否正式开放
   - loaderMap、入口可见性、建设中状态退出条件

当前判断：

- 房间板块与楼层板裁图 **应独立进入 `card-catalog`**
- 不继续塞在 foundation 后半段
- `manifest.enabled` 在 foundation 阶段可先保持 `under_construction` 可见入口，但是否正式开放为普通可玩入口，放到 `runtime-entry` 再裁定
