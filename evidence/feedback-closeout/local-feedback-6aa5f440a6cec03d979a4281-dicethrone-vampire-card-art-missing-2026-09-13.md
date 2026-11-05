# 本地反馈收口：DiceThrone 吸血鬼“我打了啥，卡图都没”

- 时间：2026-09-13 13:20 +08:00
- 口径：本地反馈数据库
- 反馈 ID：`6aa5f440a6cec03d979a4281`
- 游戏：DiceThrone
- 反馈原文：`我打了啥，卡图都没`
- 反馈创建时间：`2026-09-13T00:54:24.207Z`

## 原始症状保真

玩家反馈的是显示缺失类问题：打出或看到被打出的牌时，牌图没有显示，玩家不知道实际是哪张牌。这里不能把原话降级成“图片位置偏了”或“某张图不好看”；本轮目标是确认真实牌对象为什么没有卡图，并让之后从吸血鬼实际牌库抽到 / 打出的牌都带有可显示卡图。

## 当前现场

本地数据库记录带有状态快照和行动记录：

- 入口：`/play/dicethrone/match/SbVsYB0f3dm?playerID=0`
- 页面版本：`appVersion=0.6.47`，`appCommitSha=49574b290901`
- 行动记录尾部中出现的 `AI 2 号位: 打出卡牌 惊不惊喜？！` 是对手打出的 `card-surprise`，它的效果是“改变任意 1 颗骰子的数值”，不是本条缺图目标
- 状态快照中吸血鬼玩家 `player-0 / vampire_lord` 的弃牌堆存在 `card-unexpected`，名称为 `cards.card-unexpected.name`；按当前中文文案它是“意不意外？！”、效果是“改变任意 2 颗骰子的数值”，但当时 `previewRef` 为 `undefined`
- 同一快照中吸血鬼玩家手牌与牌库其它可见牌均带 `dicethrone:vampire_lord-cards` 图集引用
- 对手私有手牌 / 牌库中的 `???` 与无 `previewRef` 是隐藏信息脱敏，不是这条反馈的缺图目标

## 图集复核

主真相源是用户指定素材目录里的吸血鬼卡牌图集：

- 正式图源：`public/assets/i18n/zh-CN/dicethrone/images/xixuegui/compressed/ability-cards.webp`
- 图集配置：`src/assets/atlas-configs/dicethrone/ability-cards-vampire_lord.atlas.json`
- 2026-09-13 重裁目录：`temp/dicethrone-intake/xixuegui/ability-card-slots-current-scaled/`
- 35 格总览图：`temp/dicethrone-intake/xixuegui/ability-card-slots-current-scaled/vampire-lord-ability-cards-35-slot-contact-sheet.png`

逐格复核结论：

- `slot-32` 是吸血鬼专属牌“血石！”，不是公共牌“意不意外？！”
- `slot-33` 明确是公共牌“意不意外?!”（`card-unexpected`），图面效果为“改变任意 2 颗骰子的数值”
- `slot-34` 是空白格，不是正式卡牌对象

因此，上一版“`card-unexpected` 没有吸血鬼物理卡槽，所以不进入吸血鬼实际牌库”的结论作废。正确结论是：`card-unexpected` 是吸血鬼实际牌库里的通用牌，必须绑定吸血鬼本英雄图集 `slot-33`。

## 根因

这是图集索引录入 / 消费链不一致：

1. 2026-08-29 提交 `d4ca329fe0dd5409e46916e1676bb9801e41773d` 为吸血鬼新增了专用通用卡映射 `VAMPIRE_LORD_COMMON_ATLAS_INDEX`。
2. 该映射因为 `slot-32` 被“血石！”占用，把 `card-unexpected` 从吸血鬼映射里排除了。
3. 但当时没有完整复核 5x7 图集的 `slot-33`，导致 `card-unexpected` 仍在吸血鬼实际牌库，却没有吸血鬼图集 `previewRef`。
4. 玩家实际抽到 / 打出该牌时，就会看到“卡图都没”。

根因类型：数据 / 录入消费缺陷。图集文件本身存在，真实缺口是吸血鬼公共牌索引漏了 `slot-33`。

## 已作废误判

本轮重审前曾错误把修复方向写成“从吸血鬼实际牌库剔除 `card-unexpected`”。该方向已经作废，原因是它只证明 `slot-32` 不是该牌，没有完整复核 `slot-33`。当前修复已撤掉这条过滤，并把证据、测试、规则文档和反馈回写说明改为正确口径。

## 修复

- `src/games/dicethrone/heroes/vampire_lord/cards.ts`
  - `card-unexpected` 保留在吸血鬼实际牌库
  - 吸血鬼专用通用卡映射改为 `card-unexpected -> slot-33`
  - `card-vampire-lord-bloodstone` 继续独占 `slot-32`
- `src/games/dicethrone/__tests__/cardPreviewHelper.test.ts`
  - 保留全角色实际牌库横扫：每张实际牌库牌必须有 `previewRef`
  - 新增吸血鬼 `card-unexpected` 正向断言：必须使用 `dicethrone:vampire_lord-cards` 的 `slot-33`
- `src/games/dicethrone/__tests__/vampire-lord-intake.test.ts`
  - 吸血鬼牌库数量恢复为 34 张
  - 断言所有吸血鬼实际牌都有吸血鬼图集 `previewRef`
  - 断言“血石！”是 `slot-32`，“意不意外?!”是 `slot-33`
- `src/games/dicethrone/README_ASSETS.md`
  - 回代 DiceThrone 卡图规范：不能因为旧共享映射冲突或某个 slot 被占用就直接删通用牌；必须先完整复核本英雄图集，找不到真实卡槽时才允许过滤
- `src/games/dicethrone/rule/吸血鬼领主真相源表.md`
- `src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md`
- `src/games/dicethrone/rule/吸血鬼领主录入核对.md`
  - 同步 `slot-32` / `slot-33` 裁定和实际牌库数量

## 同类扩审

执行全 DiceThrone 角色实际牌库横扫，结果如下：

- `monk`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:monk-cards` index `22`
- `barbarian`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:barbarian-cards` index `22`
- `pyromancer`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:pyromancer-cards` index `22`
- `shadow_thief`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:shadow_thief-cards` index `22`
- `moon_elf`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:moon_elf-cards` index `22`
- `paladin`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:paladin-cards` index `22`
- `gunslinger`：32 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:gunslinger-cards` index `10`
- `samurai`：32 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:samurai-cards` index `10`
- `treant`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:treant-cards` index `32`
- `ninja`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:ninja-cards` index `32`
- `zhanshujia`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:zhanshujia-cards` index `32`
- `cursed_pirate`：34 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:cursed_pirate-cards` index `33`
- `artificer`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:artificer-cards` index `32`
- `tianshi`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:tianshi-cards` index `32`
- `lieren`：33 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:lieren-cards` index `32`
- `vampire_lord`：34 张，缺图 `[]`，`card-unexpected` 使用 `dicethrone:vampire_lord-cards` index `33`

本轮同类扩审结论：当前所有 DiceThrone 角色的实际起始牌库都不存在“能抽到 / 能打出但没有卡图”的牌。

## 验证

- `npx tsx -e "<遍历 CHARACTER_DATA_MAP 的 getStartingDeck 并检查 !previewRef 与 card-unexpected previewRef>"`
  - 结果：所有角色 `missing: []`；`vampire_lord` 牌库 34 张；`card-unexpected` 指向 `dicethrone:vampire_lord-cards` index `33`
- `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/games/dicethrone/__tests__/cardPreviewHelper.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts --maxWorkers 1`
  - 结果：2 个测试文件通过，8 条测试通过
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/vampire-lord-real-entry.e2e.ts "真实在线玩家选角入口应显示实施中的吸血鬼领主并可进入牌桌"`
  - 结果：1 条 Playwright 真实入口 E2E 通过
  - 关键截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应显示实施中的吸血鬼领主并可进入牌桌\03-牌桌-吸血鬼意不意外通用牌slot33放大卡图可见.jpg`
  - 肉眼核验：吸血鬼牌桌背景下，点击吸血鬼手牌 `card-unexpected` 后打开正式放大预览；画面直接显示“意不意外?!”卡图，左侧费用为 `3CP`，正文为“改变任意2颗骰子的数值”，证明真实页面消费的是吸血鬼本英雄图集 `slot-33`
- `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json`
  - 结果：`feedback-status: ok`
- `npm run spec:lint`
  - 结果：`spec-lint: OK`

## 状态回写

- 本地状态镜像：`temp/feedback-closeout/status-board.json`
  - `6aa5f440a6cec03d979a4281` 已登记为 `resolved`
  - `lastFetchedStatus` 已同步为 `resolved`
  - 处理说明已改为 `card-unexpected` 保留在吸血鬼牌库并绑定 `slot-33`
- 本地数据库：Mongo 容器 `boardgame-mongodb`，数据库 `boardgame.feedbacks`
  - 回写目标：`ObjectId('6aa5f440a6cec03d979a4281')`
  - 回查原文：`我打了啥，卡图都没`
  - 回查状态：`resolved`
  - 回查更新时间：`2026-09-13T06:27:22.000Z`
  - 回查处理说明：`已修复吸血鬼“意不意外？！”无卡图的问题：重新按吸血鬼本英雄 5x7 图集裁出全部 slot 后确认，slot-32 是“血石！”，slot-33 才是公共牌“意不意外？！”（card-unexpected）。该牌已保留在吸血鬼实际牌库，并绑定到吸血鬼图集 slot-33；不会再无图，也不会错用其它英雄的同名公共牌图。当前全 DiceThrone 角色实际牌库已横扫，均不存在能抽到 / 打出但没有卡图的牌；真实入口 E2E 已点击吸血鬼手牌并打开“意不意外?!”放大卡图确认页面可见。`

## 漏审复盘 / 规范回代

旧审计没有挡住的直接原因不是“图集少一张”，而是只核到 `slot-32` 冲突，未完成 5x7 图集全槽复核，导致 `slot-33` 的“意不意外?!”被漏掉。随后又把“`slot-32` 不是这张牌”误判成“这张牌没有吸血鬼物理卡槽”，产生了错误过滤方向。

已回代：

- 测试层：全角色实际牌库必须逐张有 `previewRef`
- 单游戏合同层：吸血鬼 `slot-32` 是“血石！”，`slot-33` 是“意不意外?!”
- DiceThrone 卡图规范层：遇到通用牌索引冲突时，必须先逐格复核本英雄完整图集；只有确认没有真实卡槽时才允许过滤，不能直接删牌或回退其它英雄图集
