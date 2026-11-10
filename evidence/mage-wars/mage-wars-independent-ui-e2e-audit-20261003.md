# Mage Wars 独立新 UI / 新交互端到端审计

> 审计日期：2026-10-04
> 游戏：`mage-wars`
> 证据类别：`independent`
> 当前状态：`PASS`
> 最终证据目录：`test-results/evidence-screenshots/mage-wars/independent-final-20261003-r4`
> 最终清单：`mage-wars-independent-pass-manifest-20261003-r4.json`
> 查看器索引：`image-index.json`，逐图提供类别、步骤、动作/结果与流程承接说明

## 范围

- 只处理当前 `mage-wars`。
- 只消费 `independent` 端到端；排除 `golden`、`tutorial`、其它游戏、诊断图和历史图。
- 证据链是：真实入口 -> 真实玩家动作 -> 可见结果 -> 当前工作树截图 / GIF -> 逐图图面审计。
- 代表态、单元测试、静态 `data-testid` 扫描不能单独替代真实玩家动作和截图。
- 本轮 independent 全量共 4 个入口文件、29 条真实用例；元素魔杖只是其中 1 条。

### Independent 全量入口

| 入口文件 | 用例数 | 结果 | 覆盖范围 |
| --- | ---: | --- | --- |
| `create-room-entry.e2e.ts` | 1 | `1/1 passed` | 大厅创建房间、选书、进入正式牌桌 |
| `mage-selection.e2e.ts` | 5 | `5/5 passed` | 选书页、窄桌面、新建书、组书编辑器、命名副本与计划 |
| `foundation-board-runtime.e2e.ts` | 5 | `5/5 passed` | 行动 token、牌桌素材、放大/拖拽、触控长按、移动横屏 |
| `online-runtime.e2e.ts` | 18 | `18/18 passed` | 公开视角、计划部署、施法、攻击、召唤、能力、响应、墙、推斥、传送、终局及 FX |

> 联机批次曾出现 1 次时序抖动；失败用例已用同一真实入口单独复跑通过。最终有效结果为 `29/29`，没有把第一次批次的 `17/18` 直接当成结论。

## 全部新 UI / 新交互对象

- 入口与构筑：大厅建房、法师席位选择、标准法术书、新建法术书绑定法师、组书筛选 / 搜索 / 分页 / 加减卡、法师详情、命名副本保存 / 使用 / 编辑 / 删除。
- 牌桌信息层：双方 HUD、阶段轨道、生命 / 法力 / 聚魔 tooltip、公开视角横幅、同一弃牌槽切换、对手计划隐藏、准备区与计划槽、行动 token / 快速施法 token / 守卫 token、状态 token rail。
- 本体交互：法术书牌列、准备牌、场上法师、场上单位、附件卡、墙边界、目标高亮、卡牌放大、桌面拖拽 / 缩放、移动横屏与触控长按检视。
- 动作与选择层：来源卡下方动作 dock、守卫、治疗之光、复原术、群兽法杖模式选择、法师魔杖绑定 / 快速重绑、元素魔杖绑定 / 快速重绑、结界窃取目标 / 来源 / 新目标、法力失效响应、取消与确认分支。
- 结果与反馈层：标准强化法术结算、日志 / 撤回申请与审批、墙牌实体与穿越伤害、召唤、远程 / 近战攻击、效果骰、治疗、推斥、传送、伤害 / 状态落地、终局胜负遮罩。

## 复跑与修复结果

- `create-room-entry.e2e.ts`：`1/1 passed`
- `mage-selection.e2e.ts`：`5/5 passed`
- `foundation-board-runtime.e2e.ts`：`5/5 passed`
- `online-runtime.e2e.ts`：单独复跑后 `18/18 passed`
- 法力失效响应窗口单测：`13/13 passed`
- 代码修复：响应窗口改用正式卡名 `法力失效`，不再把 `mw-e2e-hidden-mana-failure` 或其它内部对象 ID 显示给玩家。

## 逐图图面验收

最终目录从当前四个 independent 源目录复制生成，共 159 个候选媒体；去除 6 个逐字节重复文件后，最终交付 153 个媒体。

已核对的关键图面：

| 图面 | 验收结论 |
| --- | --- |
| 组书编辑器 / 卡池 | PASS；卡牌本体可读，无卡外重复名称，无额外包裹框 |
| 法师魔杖候选 | PASS；候选卡与手牌同等卡体语义，候选区自然排列，未见测试标签 |
| 群兽法杖模式选择 | PASS；治疗 / 近战加成是当前来源对象的直接选择 |
| 公开视角 / 同一弃牌槽 | PASS；顶部横幅居中，弃牌槽随视角复用，没有平行重复槽 |
| 动作 dock / 治疗之光 | PASS；按钮归属当前来源对象，卡牌与动作同屏 |
| 墙体实体 | PASS；墙牌作为场上实体落点可见，边界和结果仍能读 |
| 移动横屏 | PASS；桌面缩放与手牌保持稳定，目标区域可读 |
| 近战命中 / 伤害反馈 | PASS；来源、目标、伤害飘字和落地状态同屏 |
| 法力失效响应窗 | PASS；显示正式卡名 `法力失效`，不泄漏 `mw-e2e-*` |
| 终局遮罩 | PASS；胜利遮罩、背景虚化和后续按钮同屏 |

最终清单额外做了机械范围审计：只包含 `mage-wars / independent`，排除 `golden`、`tutorial`、其它游戏、诊断文件、GIF 帧缓存、旧 manifest 和逐字节重复媒体。

查看器交付不再只依赖压缩后的文件名：`image-index.json` 为每张媒体补充可读标题和流程承接说明，用户可以按“入口 / 组书 / 基础牌桌 / 正式联机”以及具体动作结果回查对应图片。

## 静态锚点裁定

对 `src/games/mage-wars` 的非测试运行时代码扫描仍得到 126 个静态锚点，其中 124 个已被 independent E2E 直接引用。以下两个是未注册的普通移动 FX 死代码，不属于玩家可见独立 UI：

- `mage-wars-fx-move-trail`
- `mage-wars-fx-move-step`

裁定：`not-applicable`。`MovementRenderer` 没有在 `ui/fxSetup.ts` 注册；普通 `MAGE_MOVED / ARENA_OBJECT_MOVED` 不产生 `MW_FX.MOVE`。不为填静态锚点新增不存在的玩家可见动效链。

## 结论

本轮 `mage-wars / independent` 新 UI / 新交互已完成独立端到端收口：

- 有效 E2E：`29/29`
- 当前最终媒体：`153`
- 旧 `r3` 不复用
- 23C 测试 ID 泄漏已修复
- 关键图面验收：PASS
- 下一步仅需通过 evidence self-check、`spec:lint`、`git diff --check`，再注册最终 `VIEWER_URL`
