# Splendor 功能-测试-证据总表

更新时间：2026-03-27

## 当前状态

- 最近更新：2026-03-28
- 实现状态：基础玩法、联机开始门槛、建房先手配置、教程、雪碧图映射工具均已落地
- 领域测试：`src/games/splendor` 下 65/65 通过
- 前端 E2E：`e2e/splendor.e2e.ts` 下 11/11 通过

## 实现入口

| 模块 | 主要文件 | 说明 |
|---|---|---|
| 领域模型 | `src/games/splendor/domain/types.ts` | core、命令、事件、待处理状态定义 |
| 规则计算 | `src/games/splendor/domain/rules.ts` | 折扣、支付、贵族判定、终局比较、玩家视图遮罩 |
| 校验层 | `src/games/splendor/domain/commands.ts` | 房主开始、回合合法性、弃牌/贵族待处理门控 |
| 执行与归约 | `src/games/splendor/domain/reducer.ts` | 命令产出事件、回合收尾、终局推进 |
| 游戏接线 | `src/games/splendor/game.ts` | action log、引擎注册 |
| 主棋盘 UI | `src/games/splendor/Board.tsx` | 联机开始面板、银行、贵族、状态区、操作区 |
| 市场区 UI | `src/games/splendor/ui/MarketSection.tsx` | 公开牌、牌库顶保留入口 |
| 卡牌 UI | `src/games/splendor/ui/CardTile.tsx` | 购买/保留按钮 |
| 玩家状态 UI | `src/games/splendor/ui/PlayerStatusPanel.tsx` | 保留牌、已购牌、折扣、宝石总数 |
| 教程 | `src/games/splendor/tutorial.ts` | 教程步骤编排 |
| 资源映射 | `src/games/splendor/spriteMapping.ts` | 卡牌/贵族雪碧图真值映射 |
| 规则文档 | `src/games/splendor/rule/璀璨宝石规则.md` | 当前基础版规则与线上补充约定 |

## 功能矩阵

| 功能 | 实现 | 领域测试 | E2E | 最后验证 | 证据 |
|---|---|---|---|---|---|
| 2/3/4 人初始化、银行与贵族数量 | 已实现 | `smoke.test.ts` | 无需单独 E2E | 2026-03-27 | 规则文档 |
| 联机房主开始门槛 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：开始门槛](./splendor-e2e-test.md#start-gate) |
| 建房配置先手玩家 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：先手配置](./splendor-e2e-test.md#starting-player) |
| 拿 3 色宝石 | 已实现 | `smoke.test.ts` | 教程链路覆盖 | 2026-03-28 | [教程证据](./splendor-tutorial-e2e-test.md#tutorial-buy-endgame) |
| 拿 2 同色宝石 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：拿两枚同色](./splendor-e2e-test.md#take-two-same) |
| 保留公开牌 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：保留公开牌](./splendor-e2e-test.md#reserve-open) |
| 保留牌库顶牌 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：保留牌库顶](./splendor-e2e-test.md#reserve-deck-top) |
| 购买公开牌 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：购买公开牌](./splendor-e2e-test.md#buy-open) |
| 购买保留牌 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：购买保留牌](./splendor-e2e-test.md#buy-reserved) |
| 超过 10 宝石后的弃牌收口 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：弃牌收口](./splendor-e2e-test.md#discard-to-limit) |
| 多贵族选择 | 已实现 | `smoke.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [主玩法证据：多贵族选择](./splendor-e2e-test.md#choose-noble) |
| 终局触发与平分裁定 | 已实现 | `smoke.test.ts` | 教程说明覆盖，玩法链路间接覆盖 | 2026-03-28 | [教程证据](./splendor-tutorial-e2e-test.md#tutorial-buy-endgame) |
| 对手保留牌遮罩 | 已实现 | `smoke.test.ts` | 联机用例间接覆盖 | 2026-03-27 | 领域测试为主 |
| 操作记录文案与卡牌预览段落 | 已实现 | `smoke.test.ts` | 购买公开牌与拿两枚同色用例覆盖 | 2026-03-28 | [主玩法证据：购买公开牌](./splendor-e2e-test.md#buy-open) |
| 教程步骤：购买/贵族/终局说明 | 已实现 | 无单独领域测试 | `splendor.e2e.ts` | 2026-03-28 | [教程证据](./splendor-tutorial-e2e-test.md#tutorial-buy-endgame) |
| 雪碧图映射工具 | 已实现 | `sprites.test.ts` | `splendor.e2e.ts` | 2026-03-28 | [映射工具证据](./splendor-sprite-mapping-tool.md#mapping-tool) |

## 自动化测试清单

### Vitest

- `src/games/splendor/__tests__/smoke.test.ts`
  覆盖：规则流转、命令校验、终局、贵族、遮罩、日志、音频配置
- `src/games/splendor/__tests__/sprites.test.ts`
  覆盖：雪碧图映射完整性、唯一性、分层顺序

### E2E

- `Splendor：可通过 setupScene 购买公开牌并推进回合`
- `Splendor：可通过前端交互保留公开牌并自动补牌`
- `Splendor：可通过前端交互保留牌库顶牌并获得黄金`
- `Splendor：可通过前端交互购买自己的保留牌`
- `Splendor：可通过前端交互拿两枚同色宝石`
- `Splendor：超过 10 宝石后应进入弃牌流程并在弃到上限后推进回合`
- `Splendor：映射工具应支持切换图集并导出当前映射配置`
- `Splendor：教程应覆盖购买 贵族与终局说明步骤`
- `Splendor：联机房间在房主开始前不可操作，开始后才可操作`
- `Splendor：建房时选择先手后，联机对局应由指定玩家先行动`
- `Splendor：多贵族选择应只获得一个贵族并清除待处理状态`

## 证据文档入口

- `evidence/splendor-e2e-test.md`
  主玩法、联机开始门槛、先手配置、多贵族的 E2E 记录
- `evidence/splendor-tutorial-e2e-test.md`
  教程闭环记录
- `evidence/splendor-sprite-mapping-tool.md`
  雪碧图映射工具记录

## 建议的后续维护方式

- 新增 Splendor 功能时，先在本表补一行，再补实现、测试和证据
- 如果某功能只有领域测试没有 E2E，应在“功能矩阵”里明确写清楚
- 如果截图路径变化，优先更新对应证据文档，再回填本表
