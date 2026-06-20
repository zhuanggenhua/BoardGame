# Change: 建立山屋惊魂 foundation 接入基线

## Why

`betrayal` 的素材 intake 已经完成首轮真相源锁定、PDF 可读性判定和候选运行时资源筛选，但仓库里还没有任何正式 OpenSpec change 来定义这个新 `gameId` 的 foundation 范围。当前如果直接开始接 `src/games/betrayal/`，会同时踩中两个问题：一是没有批准边界，二是首批资源当前仍暂存在错误的运行时目录层级。

## What Changes

- 新增 `betrayal-foundation` capability，正式定义山屋惊魂首期 foundation 的范围、资源落点和交付门禁。
- 固定首期 foundation 的正式资源合同：
  - 缩略图与运行时图片必须落到 `public/assets/i18n/zh-CN/betrayal/...`
  - 当前 `public/assets/betrayal/...` 仅视为 intake 暂存目录，不能直接当正式运行时目录收口
- 约束首期 foundation 只交付：
  - 新游戏 manifest / thumbnail / 最小 runtime skeleton
  - 运行时主界面的最小 skeleton（优先 `pre-haunt`，不是完整玩法，也不是资料录入页）
  - 首批已识别资源的正式命名与访问合同
- 明确附加能力矩阵：
  - `action-log`：仅保留底层接口，UI 暂不交付
  - `undo-system`：仅保留底层接口，UI 暂不交付
  - `game-ai-system`：本轮明确跳过
  - `tutorial-engine`：本轮明确跳过
  - `debug-config`：本轮明确跳过

## Impact

- Affected specs: 新增 `betrayal-foundation`
- Affected code:
  - `src/games/betrayal/**`
  - `public/locales/{zh-CN,en}/game-betrayal.json`
  - `public/assets/i18n/zh-CN/betrayal/**`
  - `docs/games/betrayal/**`
  - `src/games/manifest.client.generated.tsx`（由生成脚本产出）
