## ADDED Requirements

### Requirement: Betrayal 新游戏 foundation 必须先进入正式 change 管理
系统 SHALL 在 `betrayal` 进入正式实现前，先存在一条定义 foundation 范围、资源合同和附加能力矩阵的 OpenSpec change。

#### Scenario: 新游戏开始从 intake 进入正式接入
- **WHEN** `betrayal` 已完成素材 intake，准备建立 `src/games/betrayal/` 运行时骨架
- **THEN** 系统 MUST 先具备一条 `betrayal-foundation` change
- **AND** change MUST 明确首期做什么、不做什么，以及附加能力矩阵状态

### Requirement: Betrayal foundation 运行时资源必须落到本地化资源树
系统 SHALL 让 `betrayal` 的缩略图和运行时图片正式落到 `public/assets/i18n/zh-CN/betrayal/...`，而不是把 intake 暂存目录当正式目录收口。

#### Scenario: 首批图片资源准备接入 manifest
- **WHEN** 首批探索者牌、牌背、标记和封面图准备进入正式运行时资源树
- **THEN** 缩略图 MUST 落到 `public/assets/i18n/zh-CN/betrayal/thumbnails/cover.png`
- **AND** 其它运行时图片 MUST 落到 `public/assets/i18n/zh-CN/betrayal/<category>/...`
- **AND** `public/assets/betrayal/...` MUST 只被视为 intake 暂存目录

### Requirement: Betrayal foundation 不得把拼版源图误判成正式运行时对象
系统 SHALL 在房间板块、楼层板和其他大拼版源图尚未裁成单对象资源前，将其保留在 source/candidate 层，而不是直接混入正式运行时目录。

#### Scenario: 发现大拼版房间图仍未切成单对象
- **WHEN** intake 中存在 6300x5400、6076x6376、3376x2550 等大拼版图
- **THEN** 系统 MUST 不把这些文件直接放进正式运行时目录
- **AND** 系统 MUST 将它们标记为待裁图的 source/candidate

### Requirement: Betrayal foundation 首期只交付最小 runtime skeleton
系统 SHALL 将 `betrayal` foundation 的首期交付限定为最小入口与建设中 Board，而不是把完整玩法实现混进同一阶段。

#### Scenario: foundation change 获批后开始实施
- **WHEN** 团队按照 `add-betrayal-foundation` 进入实现
- **THEN** 首期交付 MUST 至少包含 `manifest.ts`、`thumbnail.tsx`、`game.ts`、`Board.tsx` 和双语 locale
- **AND** Board MUST 先落成运行时主界面的最小 skeleton，优先对齐 `pre-haunt` 主牌桌布局
- **AND** Board MUST NOT 退化成资料录入页或资源目录墙
- **AND** 房间板块裁图、正式玩法、剧本逻辑 MUST 保持为后续任务

### Requirement: Betrayal foundation 必须显式记录附加能力矩阵
系统 SHALL 为 `betrayal` foundation 显式记录 `action-log`、`undo-system`、`game-ai-system`、`tutorial-engine`、`debug-config` 的本轮状态。

#### Scenario: 用户或实现者审计本轮 foundation 范围
- **WHEN** 团队查看 `betrayal` foundation proposal、design 或 tasks
- **THEN** 文档 MUST 明确列出五项能力分别是“实施本轮”“本轮明确跳过”或“仅保留底层接口，UI 暂不交付”
