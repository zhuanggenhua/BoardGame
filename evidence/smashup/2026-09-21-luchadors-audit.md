# 大杀四方《环游世界：国际事件》摔角手单派系审计

## 1. 基本信息

- 对象：摔角手（Luchadors）13 张唯一卡牌 + 2 张基地，共 15 个对象
- 日期：2026-09-21
- 作者：Codex
- 文档类型：`audit`
- 关联任务：国际事件四派系全面审计的摔角手单派系收口

## 2. 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：`smashup` / 国际事件 / 摔角手 15 个唯一对象
- 本轮覆盖的规则子句或共享链路：Set-Up 持续行动、牌库/弃牌堆搜索、天赋额外行动、行动附着与目标选择、压制与力量修正、摧毁后回收、计分前 special、基地 onMinionAffected / onMinionPlayed 触发
- 本轮使用的目标入口 / 环境：本地 Playwright Chromium 真实牌桌；从手牌点击、棋盘基地/随从点击、真实交互候选选择进入
- 明确不在本轮范围内的对象：R2 / CDN 远端资源发布；其它三个国际事件派系的残余 direct E2E；移动端逐张视觉验收

## 3. 结论等级

结论等级：`当前范围已收口`

判定理由：摔角手 15 个唯一对象均有对象级语义结论；已有 10 个对象的 direct E2E 证据，本轮新增 5 个对象的 direct E2E 全部通过；领域回归 62/62 通过；新增 E2E 结束时 interaction 与 triggerQueue 均清空。没有发现摔角手对象的功能实现阻塞或语义不一致。

## 4. 权威来源

- 主真相源：`src/games/smashup/data/factions/international_incident.ts`
- 规则实现：`src/games/smashup/abilities/international_incident.ts`、`src/games/smashup/abilities/ongoing_modifiers.ts`
- 玩家可见规则文字：`public/locales/zh-CN/game-smashup.json`
- 对照证据：`evidence/smashup/2026-09-18-international-incident-audit.md`、`evidence/smashup/2026-07-15-international-incident-effect-atom-matrix.md`
- 图片合同表：`evidence/smashup/2026-07-13-international-incident-intake-contract.md`；完整单卡主裁图、裁图清单、crop manifest、SHA256 由 intake 合同维护，本轮只核对运行时可见卡牌，不重新裁定资源真相。
- 合同状态：`locked`

## 5. 对象清单与结论

| 对象 | 语义审计状态 | 覆盖方式 | sharedFlowId / 直接证据 | 一致性核对 | 剩余差异 | 当前裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `luchadors_quick_set_up` 快速 Set-Up | 独立完成 | 直接验证 | `smashup-international-ongoing-attachment`；四派系 E2E `:276-500` | 打在另一位玩家随从；附着后授予额外行动；目标、附着和额度清理均验证 | 数值与文案属于配置差异 | 通过 |
| `luchadors_smart_set_up` 聪明 Set-Up | 独立完成 | 直接验证 | `smashup-international-smart-setup-trigger`；四派系 E2E `:276-500`、`:1661-1736` | 目标基地每回合第一次打出随从后，行动控制者抽 1 张；重复触发被抑制 | 仅抽牌数量和文本差异 | 通过 |
| `luchadors_reversal` 逆转 | 独立完成 | 直接验证 | `smashup-international-response-window`；四派系 E2E `:862-971` | 计分前选择未领先基地、夺控带 Set-Up 随从、可选摧毁己方行动、回合末归还控制权 | 选择数量允许 0..N | 通过 |
| `luchadors_pin` 压制 | 独立完成 | 直接验证 | `smashup-international-ongoing-suppression`；四派系 E2E `:702-862`、`:1661-1736` | 只能打在带己方行动的随从上；取消能力并从控制者基地力量中排除 | 允许重复卡实例 | 通过 |
| `luchadors_powerful_set_up` 强力 Set-Up | 独立完成 | 直接验证 | `smashup-international-ongoing-power`；本轮 E2E `:258-295` | 真实附着到对手随从后，同基地本方随从各 +1；对手随从不获得该修正 | 共享力量读取按行动控制者计 | 通过 |
| `luchadors_tag_team` 团队标记 | 独立完成 | 直接验证 | `smashup-international-extra-minion`；四派系 E2E `:1560-1661` | 先由玩家选择存在己方随从的基地，再授予额外随从额度；交互清空 | 基地数量属于场景差异 | 通过 |
| `luchadors_out_for_the_count` 点名出局 | 独立完成 | 直接验证 | `smashup-international-minion-destruction`；本轮 E2E `:193-255` | 玩家选择目标随从与一张己方行动；行动回手、随从摧毁、其余行动不被误回收 | 目标候选编码为组合选择 | 通过 |
| `luchadors_senor_muchoslam_vs_the_monsters` Muchoslam 先生大战怪物 | 独立完成 | 直接验证 | `smashup-international-discard-selection`；四派系 E2E `:1375-1499` | 弃牌堆任意数量选择；一个可打在随从上的行动回手，其余洗回牌库；允许空选 | 随机洗牌只影响顺序 | 通过 |
| `luchadors_cheap_pop` 廉价欢呼 | 独立完成 | 直接验证 | `smashup-international-minion-buff`；四派系 E2E `:1560-1661` | 真实选择己方随从；有 Set-Up 时 +4，否则 +2；临时修正回合结束清理 | 目标力量值属于配置差异 | 通过 |
| `luchadors_yellow_demon` 黄色恶魔 | 独立完成 | 直接验证 | `smashup-international-search-action`；本轮 E2E `:37-100` | 从牌库和/或弃牌堆只提供 Set-Up 行动候选；玩家选择后进入手牌，非法行动不出现在候选中 | 搜索候选数量属于场景差异 | 通过 |
| `luchadors_senor_muchoslam` Muchoslam 先生 | 独立完成 | 直接验证 | `smashup-international-minion-talent`；本轮 E2E `:103-190` | 出场回收弃牌堆行动；真实点击天赋后授予额外行动；额外行动可真实附着到对手随从 | 天赋每回合一次由通用状态控制 | 通过 |
| `luchadors_capa_roja` Capa Roja | 独立完成 | 直接验证 | `smashup-international-response-window`；四派系 E2E `:1112-1184` | 计分前按每位其它玩家选择印制力量 3 或以下随从；可跳过；摧毁后继续计分 | 多玩家候选数量属于场景差异 | 通过 |
| `luchadors_flor_loca` Flor Loca | 独立完成 | 直接验证 | `smashup-international-ongoing-power`；本轮 E2E `:298-345` | 真实打出后读取同基地对手随从上的己方行动；Flor Loca 显示 +2；没有把对手行动控制者误当成随从控制者 | 行动被压制时按共享压制规则不计入 | 通过 |
| `base_ringside` 擂台边 | 独立完成 | 直接验证 | `smashup-international-base-ability`；四派系 E2E `:1661-1736` | 真实行动直接影响另一位玩家随从后，由行动控制者抽 1 张；己方随从不误触发 | 只覆盖直接影响随从的行动集合 | 通过 |
| `base_the_squared_circle` 方形擂台 | 独立完成 | 直接验证 | `smashup-international-base-ability`；四派系 E2E `:1499-1560` | 每回合第一次在此打出随从后，从弃牌堆随机回收一个行动；第二次不重复触发 | 随机对象属于规则允许的随机差异 | 通过 |

### 代表链复用裁定

- 代表对象：`luchadors_quick_set_up` 代表行动附着与额外行动；`luchadors_reversal` 代表计分前 response window；`base_ringside` 代表基地触发队列；`luchadors_powerful_set_up` 与 `luchadors_flor_loca` 代表行动控制者驱动的持续力量修正。
- 判等依据：逐项核对触发时机、候选生成、权限判断、payload / command 结构、执行入口、最终权威状态和清理语义；差异只允许落在 `defId`、目标过滤、数值、文案或随机对象。
- 仅配置差异：Quick / Smart / Powerful / Pin 的卡牌 ID、目标控制者和附加效果不同，但都从真实手牌进入同一附着入口；Smart 与 Squared Circle 的每回合一次由领域测试验证第二次触发不再产生抽牌/回收。

## 6. 原子语义与实现消费

### 已核对的共享流程

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `smashup-international-ongoing-attachment` | 行动牌从手牌进入场上并附着到目标随从 | `playCard` 真实手牌点击、目标随从点击、附着状态断言 | 合法目标、行动消耗、宿主附着、交互清理一致 | 目标控制者、卡牌 defId、附加效果 | Quick / Smart / Powerful / Pin / Out |
| `smashup-international-ongoing-power` | 持续行动和随从能力计算有效力量 | `ongoing_modifiers.ts` + 本轮力量徽章证据 + 62 条领域回归 | 以行动控制者和随从控制者分开计算；压制行动会抑制来源 | +1 / +2、来源卡名、宿主对象 | Powerful Set-Up / Flor Loca / Cheap Pop |
| `smashup-international-search-action` | 从牌库与弃牌堆建立行动候选并让玩家选择 | 黄色恶魔本轮 `:37-100`；Muchoslam 大战怪物已有 `:1375-1499` | 候选过滤、来源区域、玩家选择、手牌/牌库最终状态和清理一致 | 过滤谓词、是否额外行动 | Yellow Demon / Senor Muchoslam vs Monsters |
| `smashup-international-response-window` | 计分前 special / reaction 的候选、提交和清理 | Reversal、Capa Roja 的 direct E2E + 领域测试 | 当前响应者、窗口、目标过滤、最终 VP/控制/摧毁、reaction session 清理一致 | 卡牌来源和目标过滤 | Reversal / Capa Roja |
| `smashup-international-base-ability` | 基地触发队列与计分前/随从打出后的基地能力 | Ringside、Squared Circle direct E2E + 基地注册测试 | 触发时机、来源玩家、一次性限制、最终抽牌/回收、队列清理一致 | 基地 ID、随机行动对象 | 两张摔角手基地 |

共享流程的统一核对清单：每条流程均已核对触发时机、候选生成、权限判断、payload / command 结构、执行入口、最终权威状态和清理语义；真实入口结束后没有残留 interaction、待处理状态或 triggerQueue。

### 每回合一次与负向证据

- `luchadors_smart_set_up`：第一次在宿主基地打出随从后抽牌；第二次同基地打出随从不再抽牌。领域测试 `聪明 Set-Up 只在宿主基地每回合第一次打出随从后为行动控制者抽牌` 覆盖二次触发拒绝。
- `base_the_squared_circle`：第一次在基地打出随从后回收行动；第二次不会重复回收。真实入口完成后触发队列清空，后续触发按钮/入口不可见；领域测试覆盖重复触发不产生第二次回收。
- `luchadors_senor_muchoslam`：天赋使用后记录 `talentUsed`，本回合再次使用被通用合法性校验拒绝；本轮 E2E 直接断言第一次点击后 `talentUsed: true`、额外行动额度增加，最终 interaction 与 triggerQueue 清空。

## 7. 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计 / 已收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 摔角手五个此前缺 direct E2E 的对象 | 审计留档缺口 | 否 | 是，已补齐 | 当前范围内，现已关闭 | 保留本轮 5 条 direct E2E 与截图证据 |
| 摔角手 15 个唯一对象的最终状态与生命周期 | 无残余 | 否 | 否 | 当前范围内，已收口 | 后续只在共享机制变更或新回归出现时重审 |
| R2 / CDN 远端资源发布 | 非阻塞扩展 | 否 | 否 | 当前范围外 | 另有凭据后走发布流程，不混入本地玩法审计 |
| 其它三个国际事件派系的非代表 direct E2E | 当前范围验证缺口 | 否 | 是四派系总账范围 | 当前范围外，归四派系总账另行推进 | 按派系继续逐个收口 |

## 8. 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 数据源列出 13 张唯一卡 + 2 张基地；本文件逐对象 15 行 |
| 真相源状态 | `passed` | 本地卡牌数据、中文规则文字、实现和旧矩阵一致 |
| 原子语义断言 | `passed` | 每个对象记录触发时机、目标、选择权、数值和负向边界 |
| 实现消费链 | `passed` | 静态定义、注册、handler / trigger / ongoing modifier、UI 入口均核对 |
| 最终权威结果 | `passed` | 手牌、弃牌堆、附着、力量徽章、额外额度、摧毁、回收、队列清理均有断言 |
| 交互真实入口 | `passed` | 15 个对象均有 direct E2E 或已有 direct E2E 证据 |
| 验证证据 | `passed` | 领域 62/62；本轮 direct E2E 5/5；类型、lint、diff check 通过 |
| 共享影响与代表链依据 | `passed` | 共享流程表记录不变量、配置差异和失效影响面 |
| 缺口分类与范围裁定 | `passed` | R2 与其它派系残余被明确排除，不冒充摔角手缺陷 |
| 旧 evidence / 旧结论回写 | `passed` | 四派系总账追加本轮摔角手收口记录 |
| 残余范围声明 | `passed` | 明确其它派系归四派系总账、远端发布归独立发布流程 |

## 9. 验证证据

- 命令：`npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts`
- 结果：`1 passed`，`62 tests passed`
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-luchadors-audit.e2e.ts`
- 结果：`5 passed`，约 31 秒
- 命令：`npx eslint e2e/smashup/smashup-international-incident-luchadors-audit.e2e.ts`
- 结果：退出码 0，无告警
- 命令：`npx tsc --noEmit`
- 结果：退出码 0
- 命令：`git diff --check -- e2e/smashup/smashup-international-incident-luchadors-audit.e2e.ts`
- 结果：退出码 0
- 本轮截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-international-incident-luchadors-audit.e2e\黄色恶魔从真实出牌入口在牌库与弃牌堆中选择-Set-Up-行动\03-黄色恶魔-选择后进入手牌并清理.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-international-incident-luchadors-audit.e2e\Muchoslam-先生的真实出牌与天赋入口都能回收并额外打出行动\07-Muchoslam-额外行动附着后.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-international-incident-luchadors-audit.e2e\点名出局真实入口返回己方行动并摧毁带行动的随从\10-点名出局-回收并摧毁后.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-international-incident-luchadors-audit.e2e\强力-Set-Up-真实附着后只增强同基地的本方随从\11-强力Set-Up-附着与本方加力后.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-international-incident-luchadors-audit.e2e\Flor-Loca-真实出牌后读取对手随从上的己方行动并获得持续加力\12-Flor-Loca-持续加力后.jpg`
- 人工观察结论：本轮新增五条用例均从真实手牌或棋盘点击开始；黄色恶魔显示牌库/弃牌堆候选，Muchoslam 显示天赋后额度变化，点名出局显示目标消失和行动回手，强力 Set-Up / Flor Loca 显示正确力量徽章；所有用例结束时交互和触发队列清空。

### 2026-09-21 逆转连续强制反应回归补充

- 首次回归失败发生在测试等待“无交互”阶段，不是逆转生产效果未执行。
- 权威状态诊断确认：目标随从已转为 0 号玩家控制；`rev-quick`、`rev-smart` 已进入 0 号玩家弃牌堆；剩余阻塞是夺控后连续出现的强制反应选择，先处理 `base_ringside`，再处理敌方 `musketeers_all_for_one`。
- 修复只补真实 E2E 的两段玩家选择，未修改 `src/games/smashup/abilities/international_incident.ts`；清理后阶段回到 `playCards`，interaction、resolution frame 和 triggerQueue 均为空。
- 完整四派系主基线 `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts`：24 条通过；摔角手领域 / 资源合同定向测试合计 68 条通过。

## 10. 修订 / 失效记录

- 旧文档路径：`evidence/smashup/2026-09-18-international-incident-audit.md`
- 旧结论：摔角手只有代表性 direct L3/L4，不能外推 15 个对象完成。
- 失效原因：本轮为此前缺失的黄色恶魔、Muchoslam 先生、点名出局、强力 Set-Up、Flor Loca 补齐独立真实入口和最终状态证据。
- 替代旧结论的新证据：本文件 15 行对象表、5/5 新增 direct E2E、62/62 领域回归。
- 新结论：摔角手单派系当前范围已收口；四派系批次状态继续由总账维护为 `in_progress`。
- 是否需要修改旧文档正文中的误导行：需要，已在总账追加并更新摔角手行。

## 11. 对外汇报口径

- 允许说：摔角手 15/15 唯一对象完成对象级审计；新增五条 direct E2E 全部通过；当前本地规则范围已收口。
- 禁止说：国际事件四派系全部发布收口；R2 / CDN 已发布；其它三派系已完成同等 direct E2E。
