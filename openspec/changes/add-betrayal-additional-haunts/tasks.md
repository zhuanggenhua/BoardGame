## 1. Specification

- [x] 1.1 确认 `add-betrayal-additional-haunts` proposal 范围被批准后再改正式玩法代码。
  - 当前状态：用户已批准；可以进入第 2-7 节正式实现任务。
- [x] 1.2 为 3、12、33 建立结构化剧本合同，逐项列出官方源、触发事件、叛徒规则、setup、tokens、怪物、动作、回合末效果、胜负条件和玩家视图边界。
- [x] 1.3 运行 `openspec validate add-betrayal-additional-haunts --strict --no-interactive` 并通过。

## 2. Shared Runtime

- [x] 2.1 扩展 `BetrayalScenarioId`、剧本配置和作祟编号开放列表，但只在对应剧本完成后开放编号。
  - 当前状态：作祟编号已开放 `[1, 3, 12, 33]`；剧本 12/33 通过独立运行态承接，不再落入未实现门禁。
- [x] 2.2 为新增剧本建立独立 runtime state 子结构，避免污染首剧本字段。
  - 当前状态：剧本 3/12/33 分别使用 `scenarioRuntime.dust`、`scenarioRuntime.hungryHouse`、`scenarioRuntime.magicCamera` 子结构。
- [x] 2.3 让事件牌成功作祟分支按对应剧本进入正式 haunt 状态，不再误进首剧本或通用占位态。
  - 当前状态：`一瓶微尘`、`大宅饿了`、`说“茄子”！` 成功分支均已通过真实浏览器代表链进入对应作祟牌桌。
- [x] 2.4 保留未完成剧本门禁，并为每个尚未完成编号保留清晰错误。

## 3. Haunt 3：灰尘

- [x] 3.1 实现隐藏叛徒与玩家视图隔离，确保只有本人可见自身 Sickness token。
- [x] 3.2 实现 Sickness token、Research token、Search 行动、Cure 行动和全员变叛徒/死亡胜负条件。
- [x] 3.3 补领域测试覆盖触发、隐藏信息、Search / Cure、英雄胜利和叛徒胜利。
- [x] 3.4 补真实页面 / E2E 代表链，并把 `一瓶微尘` 成功分支从门禁提升为正式作祟入口。

## 4. Haunt 12：大宅饿了

- [x] 4.1 实现 Ritual Room / Chasm 放置、邪教徒数量、Number Track 和叛徒 setup 奖励。
- [x] 4.2 实现搬运尸体、Feed Her、邪教徒死亡成为尸体、回合末全英雄通用伤害和胜负条件。
- [x] 4.3 补领域测试覆盖触发、尸体搬运/献祭、Number Track、英雄全灭和邪神苏醒胜利。
- [x] 4.4 补真实页面 / E2E 代表链，并把 `大宅饿了` 成功分支从门禁提升为正式作祟入口。

## 5. Haunt 33：魔法相机

- [x] 5.1 实现魔法相机归属决定叛徒、Phantom Photographers、Essence token 和摄影师放置。
- [x] 5.2 实现 Take a Photo、Smash the Magic Camera、Essence 加成、摄影师视线攻击和怪物被击杀/眩晕差异。
- [x] 5.3 补领域测试覆盖触发、相机归属、摧毁相机、击杀摄影师、英雄胜利和叛徒胜利。
- [x] 5.4 补真实页面 / E2E 代表链，并把 `说“茄子”！` 成功分支从门禁提升为正式作祟入口。

## 6. Documentation and Audit

- [x] 6.1 更新半实现专项审计，记录 3、12、33 的状态、证据和剩余缺口。
- [x] 6.2 更新事件牌审计，把正式运行事件牌堆数量与每张触发事件的状态写准。
- [x] 6.3 更新主 spec 视角和 README，明确当前能说什么、不能说什么。
- [x] 6.4 若任何剧本因为缺素材、视线规则或隐藏信息机制无法继续，实现前停下记录阻塞并问用户。
  - 当前状态：本轮 3/12/33 没有遇到必须停止的素材或规则阻塞；剩余边界记录在审计文档中，不冒充山屋整游戏完成。

## 7. Final Verification

- [x] 7.1 跑新增剧本领域测试和首剧本回归测试。
- [x] 7.2 跑每个新增剧本的真实页面 / E2E 代表链。
- [x] 7.3 跑审计文档自检。
- [x] 7.4 更新 `temp/betrayal-additional-haunts-task.json`，只有所有验收证据都成立后才把目标标为完成。
