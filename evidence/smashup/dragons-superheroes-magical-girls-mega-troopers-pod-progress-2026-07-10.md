# 龙族、超级英雄、魔法少女、超级战队 POD 实装进度证据

## 当前结论

本批次已完成静态接入、独立图集、POD 基地身份、泰坦 fallback、双语文案、变体绑定、超级战队 POD 差异规则主体，以及龙族、超级英雄、魔法少女 shared handler 的 POD 运行时身份修复。定向对象级与集成回归现为 `49/49` 通过。发布链尚未完成，因此当前只能判定为“本地实现与 L1/L2 行为合同通过，远端资源与真实入口 L3/L4 阻塞”。

## 已验证合同

| 对象 | 当前证据 | 结论 |
| --- | --- | --- |
| 龙族 POD | 20 张物理牌、独立 `4x5` atlas、POD 基地池、shared ability/ongoing 注册 | passed（本地合同） |
| 超级英雄 POD | 20 张物理牌、独立 `4x5` atlas、POD 基地池、全能手套 fallback | passed（本地合同） |
| 魔法少女 POD | 20 张物理牌、独立 `4x5` atlas、POD 基地池、移动城堡 fallback | passed（本地合同） |
| 超级战队 POD | 20 张物理牌、独立 `4x5` atlas、POD 基地池、超级佐德 fallback、独立差异 handler | passed（本地合同） |

## Shared Handler POD 运行时修复

- 龙族 POD：
  - 巨龙、废墟的基础 VP 修正现在同时识别基础版与 `_pod` 对象。
  - 夷为平地的基地能力压制现在识别 `_pod` 持续行动。
- 超级英雄 POD：
  - 超赞男、强化能力、秘密基地、改造洞穴的保护检查现在识别 `_pod` 对象。
  - 我唯一的弱点现在能压制附着目标上的 POD 能力来源。
- 魔法少女 POD：
  - 魔法杖离场拦截器识别 `_pod`，并保留真实 `payload.defId` 作为回牌库顶事件来源。
  - 花哨装男孩的保护检查识别 `_pod`。
  - 白魔猫与黑魔猫按来源版本搜索同版本女仆/月之队长，不混搜基础版与 POD。
  - 女仆移动交互按触发卡 UID 和真实 `sourceDefId` 定位来源，不会串到同场基础版女仆。

## 超级战队 POD 已实装差异

- 闪电剑攻击：有己方泰坦的计分基地消灭力量 4 或以下随从。
- 合体超级佐德：打出超级佐德，或将任意数量己方随从移到其基地。
- 闪电时刻：己方随从直到回合结束 `+4`。
- 闪电救援：满足己方随从与非最高力量条件时可额外打出行动。
- 胜利姿态：计分前落后抓 2；获胜后可预约力量 3 或以下手牌随从到替换基地。
- 闪电水晶：消灭行动牌或泰坦。
- 欧米伽协议：其他玩家回合中基地临界点 `-10`。
- 谋划更多：查看顶三张，抓一张或额外打出其中一个随从，其余可任意排序到牌库顶/底。
- 贝塔6号：计分前可给己方随从放置 `+1` 力量指示物。
- 蓝骑士：计分前可抓牌或自身获得临时 `+2`。
- 绿骑士：走统一 `beforeScoringPlayable` 手牌打出合同。
- 红骑士：泰坦上限 `+1`，并可在另一基地打出或移动超级佐德。

## 自动验证

- TypeScript：`npm run typecheck -- --pretty false` 通过。
- 定向 Vitest：
  - `src/games/smashup/__tests__/abilities/mega-troopers.test.ts`：`37/37` 通过。
  - `src/games/smashup/__tests__/dragonsSuperheroesMagicalGirlsMegaTroopersPodIntegration.test.ts`：`12/12` 通过。
  - 合计：`49/49` 通过。
- i18n：`npm run i18n:check` 通过，无缺失键。
- OpenSpec strict：通过。
- manifest：`npm run assets:manifest` 通过；根级 `public/assets/i18n/assets-manifest.json` 已包含四张 POD PNG/WebP。
- 正式资源检查：`npm run assets:check` 在获取 R2 远端文件列表时返回 `401 Unauthorized`。

## 发布阻塞

- 失败步骤：`npm run assets:check` 获取 R2 远端文件列表。
- 实际错误：S3/R2 `ListObjectsV2` 返回 `401 Unauthorized`。
- 类别：环境/凭据问题。
- 未完成交付物：R2/CDN 上传、代表 URL `HEAD 200`、基于真实远端素材的派系选择/对局 E2E 与截图。
- 当前凭据审计：
  - 当前工作树不存在 `.env`，上传脚本回退到 `.env.example`。
  - 用户级与机器级环境均未配置四个 R2 必需变量。
  - 所有已登记 git worktree 均不存在 `.env`，只有相同的 `.env.example` 入口。
- 最小恢复动作：提供或恢复当前仓库可用的 `.env` R2 凭据，依次重跑 `npm run assets:check`、`npm run assets:upload`、代表 URL `HEAD 200`；成功后继续既定真实入口 E2E，不使用临时预览或本地截图替代。
