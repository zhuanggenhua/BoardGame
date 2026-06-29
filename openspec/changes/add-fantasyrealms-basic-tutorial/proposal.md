# Change: 为幻想国度补基础教程能力

## Why

- 当前 `fantasyrealms` 已经具备正式对局、计分与多人流程，但仍缺少教程入口；用户目标已经明确转到“开始做教程”，这在当前仓库里属于真实缺口，而不是已存在能力的小修。
- 现有教程体系已经服务于多个游戏，但 `fantasyrealms` 当前既没有 `tutorial.ts`，也没有把教程系统接入 `game.ts`，更没有给棋盘主交互区提供稳定的 `data-tutorial-id` 锚点。
- `fantasyrealms` 的正式玩法门槛主要集中在“回合只做一次抓牌 + 一次弃牌”“可以从牌库或公开弃牌拿牌”“抓牌后必须弃到手牌上限”，这些都适合用最小基础教程直接落到真实牌桌，而不是继续依赖外部说明。

## What Changes

- 为 `fantasyrealms` 新增一套基础教程 manifest，并接入现有教程运行时。
- 在 `fantasyrealms` 引擎配置中接入教程系统，使教程步骤可以基于命令白名单、事件推进和固定随机策略运行。
- 为 `fantasyrealms` 牌桌补充最小必要的教程锚点，覆盖牌库抓牌、中央公开弃牌、手牌区与弃牌动作承接区。
- 为 `fantasyrealms` 基础教程提供最小教学步骤，至少覆盖：
  - 牌桌总览
  - 从牌库抓牌
  - 从中央公开弃牌拿牌
  - 抓牌后必须弃一张
  - 回合循环与终局条件说明
- 补齐对应的静态测试与教程属性测试，保证教程不会只存在 manifest 而没有真实 UI 落点。

## Impact

- Affected specs:
  - `tutorial-engine`
  - `fantasyrealms-tutorials`
- Affected code:
  - `src/games/fantasyrealms/game.ts`
  - `src/games/fantasyrealms/Board.tsx`
  - `src/games/fantasyrealms/tutorial.ts`
  - `src/games/fantasyrealms/__tests__/*`
  - `public/locales/*/game-fantasyrealms.json`
  - `src/games/manifest.client.generated.tsx`（由生成脚本派生）
