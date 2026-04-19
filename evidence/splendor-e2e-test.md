# Splendor 主玩法 E2E 证据

更新时间：2026-03-28

## 文档定位

- 本文档对应 [splendor-feature-matrix.md](./splendor-feature-matrix.md) 中“主玩法、联机开始门槛、建房先手配置、多贵族选择”的证据沉淀。
- 本文档只记录 `e2e/splendor.e2e.ts` 里的主玩法与联机链路。
- 教程链路单独记录在 [splendor-tutorial-e2e-test.md](./splendor-tutorial-e2e-test.md)。
- 雪碧图映射工具单独记录在 [splendor-sprite-mapping-tool.md](./splendor-sprite-mapping-tool.md)。

## 对应总表条目

- 联机房主开始门槛
- 建房配置先手玩家
- 拿 2 同色宝石
- 保留公开牌
- 保留牌库顶牌
- 购买公开牌
- 购买保留牌
- 超过 10 宝石后的弃牌收口
- 多贵族选择
- 操作记录文案与卡牌预览段落

## 覆盖范围

本文件覆盖 9 条主玩法 E2E：

1. 公开牌购买主链
2. 保留公开牌并自动补牌
3. 保留牌库顶牌并获得黄金
4. 购买自己的保留牌
5. 拿两枚同色宝石
6. 超过 10 宝石后的弃牌收口
7. 联机房间开始前/开始后的操作门槛
8. 建房时配置先手并验证指定玩家首回合行动
9. 多贵族选择交互

## 对应用例与命令

```bash
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：可通过 setupScene 购买公开牌并推进回合"
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：可通过前端交互保留公开牌并自动补牌"
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：可通过前端交互保留牌库顶牌并获得黄金"
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：可通过前端交互购买自己的保留牌"
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：可通过前端交互拿两枚同色宝石"
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：超过 10 宝石后应进入弃牌流程并在弃到上限后推进回合"
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：联机房间在房主开始前不可操作，开始后才可操作"
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：建房时选择先手后，联机对局应由指定玩家先行动"
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：多贵族选择应只获得一个贵族并清除待处理状态"
```

## 自动化结果

- 主玩法 E2E：9/9 通过
- Splendor 全量 E2E：11/11 通过
- 运行方式：新框架 `import { test, expect } from './framework'`
- 场景构造：`game.setupScene()`

## 证据截图

<a id="buy-open"></a>
### 1. 公开牌购买主链

- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过-setupScene-购买公开牌并推进回合/splendor-buy-open-before.png`
- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过-setupScene-购买公开牌并推进回合/splendor-buy-open-after.png`

<a id="reserve-open"></a>
### 2. 保留公开牌并自动补牌

- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过前端交互保留公开牌并自动补牌/splendor-reserve-open-before.png`
- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过前端交互保留公开牌并自动补牌/splendor-reserve-open-after.png`

<a id="reserve-deck-top"></a>
### 3. 保留牌库顶牌并获得黄金

- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过前端交互保留牌库顶牌并获得黄金/splendor-reserve-deck-top-before.png`
- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过前端交互保留牌库顶牌并获得黄金/splendor-reserve-deck-top-after.png`

<a id="buy-reserved"></a>
### 4. 购买自己的保留牌

- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过前端交互购买自己的保留牌/splendor-buy-reserved-before.png`
- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过前端交互购买自己的保留牌/splendor-buy-reserved-after.png`

<a id="take-two-same"></a>
### 5. 拿两枚同色宝石

- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过前端交互拿两枚同色宝石/splendor-take-two-before.png`
- `test-results/evidence-screenshots/splendor.e2e/Splendor：可通过前端交互拿两枚同色宝石/splendor-take-two-after.png`

<a id="discard-to-limit"></a>
### 6. 超过 10 宝石后的弃牌收口

- `test-results/evidence-screenshots/splendor.e2e/Splendor：超过-10-宝石后应进入弃牌流程并在弃到上限后推进回合/splendor-discard-pending.png`
- `test-results/evidence-screenshots/splendor.e2e/Splendor：超过-10-宝石后应进入弃牌流程并在弃到上限后推进回合/splendor-discard-resolved.png`

<a id="start-gate"></a>
### 7. 联机房间开始门槛

- 本条以真实联机断言为主，当前不把截图作为唯一验收依据。

<a id="starting-player"></a>
### 8. 建房先手配置

- `test-results/evidence-screenshots/splendor-starting-player-before-start.png`
- `test-results/evidence-screenshots/splendor-starting-player-after-start.png`

<a id="choose-noble"></a>
### 9. 多贵族选择

- `test-results/evidence-screenshots/splendor.e2e/Splendor：多贵族选择应只获得一个贵族并清除待处理状态/splendor-choose-noble-pending.png`
- `test-results/evidence-screenshots/splendor.e2e/Splendor：多贵族选择应只获得一个贵族并清除待处理状态/splendor-choose-noble-resolved.png`

## 验证点

### 1. 公开牌购买主链

- 点击购买前，`splendor-buy-t1-white-1` 按钮可见。
- 点击购买后，玩家 `0` 的 `purchasedCardIds` 包含 `t1-white-1`。
- 公开区移除该卡。
- 回合推进到玩家 `1`。

### 2. 保留公开牌并自动补牌

- `splendor-reserve-t1-white-1` 按钮可见。
- 玩家 `0` 的 `reservedCardIds` 增加该公开牌。
- 玩家 `0` 获得 1 个黄金。
- 市场区移除被保留牌，并从对应牌库补进 1 张新牌。
- 回合推进到玩家 `1`。

### 3. 保留牌库顶牌并获得黄金

- 悬浮一级牌库后，`splendor-reserve-deck-top-1` 按钮可见。
- 玩家 `0` 的 `reservedCardIds` 增加该牌库顶牌。
- 玩家 `0` 获得 1 个黄金。
- 一级牌库数量减少 1。
- 回合推进到玩家 `1`。

### 4. 购买自己的保留牌

- 展开保留牌区后，`splendor-buy-t1-white-1` 按钮可见。
- 点击后，玩家 `0` 的 `reservedCardIds` 变为空。
- 同一张牌进入 `purchasedCardIds`。
- 回合推进到玩家 `1`。

### 5. 拿两枚同色宝石

- 点击白色宝石后，`splendor-take-two-white` 按钮出现。
- 点击后，玩家 `0` 获得 2 个白色宝石。
- 白色宝石供应从 `4` 变为 `2`。
- 回合推进到玩家 `1`。
- 操作记录出现“拿取两枚同色宝石”语义。

### 6. 超过 10 宝石后的弃牌收口

- 拿到第 11 个宝石后，`pendingResolution.type === 'discardToLimit'`。
- 弃掉 1 个宝石后，`pendingResolution === null`。
- 玩家宝石总数回到 `10`。
- 回合推进到玩家 `1`。

### 7. 联机房间开始门槛

- 房主开始前，host 页面显示开始按钮。
- guest 页面显示等待房主开始的提示。
- 房主当前回合的宝石按钮为禁用态。
- 房主点击开始后，开始按钮消失。
- 房主可以执行一次拿宝石动作。
- 回合推进到 guest。

### 8. 建房先手配置

- host 与 guest 页面都显示相同的先手玩家名称。
- 房主点击开始后，被指定为先手的玩家先获得操作权。
- 非先手玩家的宝石按钮保持禁用。

### 9. 多贵族选择

- 多个可选贵族按钮同时出现。
- 点击其中一个贵族后，`pendingResolution` 被清除。
- 玩家只获得被选择的那 1 个贵族。
- 公共贵族区移除已选择贵族。
- 回合推进到下一位玩家。

## 备注

- 本文档与 [splendor-feature-matrix.md](./splendor-feature-matrix.md) 保持一一对应。
- 若未来新增主玩法 E2E，应先更新总表，再扩充本文件。
