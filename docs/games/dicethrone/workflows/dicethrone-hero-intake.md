# Dice Throne 角色图片录入工作流

## 适用范围

适用于 Dice Throne 单个角色或新英雄的 intake 流程，覆盖：

- 真相源锁定
- 角色板 / 提示板 / 卡图裁图
- 骰面、Token、能力、卡牌静态数据录入
- i18n 与规则文档同步
- 资源 manifest 重建
- R2 上传与 CDN 回查
- Vitest / E2E / evidence 收口

本工作流面向“已有图片与规则材料，先完成正确录入”的场景，不替代复杂机制设计本身。

## 输入物

至少需要以下素材：

- `player-board` 原图
- `tip` 原图
- `ability-cards` 原图
- `dice` 原图或等价骰面来源
- 角色英文 canonical 名称来源
- 角色对照源：官方规则书、官方 PDF、Wiki 或用户指定来源

## 权威来源分工

默认口径如下：

- 汉化图 / 当前任务约定图片：中文名称、中文描述、图内顺序、裁图定位
- 官方规则书 / 官方 PDF / 官方图：高优先级英文对照源
- Wiki：辅助英文名、补充裁定、发现冲突，不反向覆盖中文主真相源
- 当前任务 worktree：本轮资源、裁图、manifest、上传结果的唯一工作现场

## 资源完成判据

Dice Throne 的资源交付不能只看 `git status`，因为图片目录常被忽略。

这套流程里“资源已完成”至少要同时满足：

- 本地 `public/assets/i18n/zh-CN/dicethrone/images/<hero>/compressed/*.webp` 存在
- `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json` 已重建
- 运行时代码已接入引用
- 远端 R2 / CDN 对代表性 URL 返回 `200`

补充口径：

- `crops/...` 默认只算录入核对中间产物，不计入“正式资源已完成”。
- 为了看清文字而额外做的后处理图，必须放 `temp/dicethrone-intake/<hero>/...` 或等价临时目录，禁止继续落在 `public/assets/.../crops/**`
- 对 Dice Throne 角色，正式运行时默认必须优先走 atlas：
  - 先尝试公共 atlas 配置
  - 若局部位点看起来异常，先回到原始 `compressed/ability-cards.webp` 与老角色同位裁图对照，先证伪是不是核对图生成链路错了
  - 只有在逐格对照、老角色比对和真实 UI 验证后，才能裁定 atlas 合同本身是否失效
- 因此不能把“单卡图能显示”当成 Dice Throne 新英雄 intake 的默认收口条件。

## 执行步骤

### 1. 锁定 worktree 与本轮范围

先确认：

- 当前处理的是哪个 `heroId`
- 对应任务 worktree 是哪个
- 本轮只做录入，还是包含后续机制实现

禁止在根工作树或错误分支下看完素材后，直接对当前任务下结论。

### 2. 锁定主真相源与对照源

先在 `src/games/dicethrone/rule/` 下建立或更新：

- `<角色>真相源表.md`
- `<角色>录入核对.md`
- 必要时的 `<角色>卡牌录入核对.md`

至少写清：

- 主真相源路径
- 对照源链接或路径
- 获取日期
- 当前工作树
- 这轮 scope
- 是否已有冲突项

### 3. 先裁图，再录入

必须先把整图切到单对象可读粒度：

- 角色板：每个技能 / 被动 / 防御技 / 终极技
- 提示板：每个 Token / 关键词 / 骰面说明
- 卡图：逐卡或逐 slot

当前项目里 Dice Throne 已有角色专用裁图脚本时，优先复用或仿照：

- `scripts/games/dicethrone/assets/extract-dicethrone-gunslinger-crops.mjs`
- `scripts/games/dicethrone/assets/extract-dicethrone-samurai-crops.mjs`

强制补充：

- `crops/ability-cards/` 默认只是真相源裁图，不自动等于运行时素材。
- 只要是为了 OCR / 看清文字 / 看清局部版式额外做的拆分图、放大图、normalized preview，都必须进 `temp/`；禁止把这类后处理图继续放在 `public/assets/.../crops/**`
- 默认优先级永远是：
  - 能直接复用原 `ability-cards` atlas 的，继续走 atlas
  - 如果核对图看起来像“一格里有两张”，先检查核对图是不是后处理产物或裁图参数错了，不能直接把它升级成 atlas 结论
  - 只有 atlas 合同被证伪且用户明确批准时，才允许升级 atlas 配置或正式单卡图方案
- `previewRef` 可以指向两类正式资源：
  - `type = 'atlas'`：原 `ability-cards` atlas + 正确 index
  - `type = 'image'`：仅限用户已明确批准的正式单卡图
- 不得为了迁就少数特殊牌，额外发明 `hand-cards-atlas.webp` 这类并行运行时方案；`gunslinger` / `samurai` 的历史 hand atlas 已确认是错误方向。
- 真相源裁图与正式运行时 atlas 必须分开登记；前者服务核对合同，后者服务手牌 UI。
- 禁止因为“已有 slot 裁图”就直接把复合裁图、临时 hand preview 或未进 manifest 的中间产物接到 `cards.ts` 的手牌图引用上。
- 禁止从 `public/assets/.../crops/**` 里的历史核对图反推“这就是正式 slot 结果”；若该目录中已有历史产物，必须先核它是不是后处理图。
- 手牌 atlas 的使用方式必须先对照旧角色的 `cards.ts`、`previewRef`、图集配置和现有手牌渲染逻辑；禁止只凭新角色原图外观判断“一格是不是两张”“角落那格是不是牌”“需不需要额外 split/topCrop”。
- 如果用户指出“这个升级看起来是复合型”，必须先去旧角色里找同类基线，再判断这是：
  - 一张升级卡替换同一个基础技能，内部 `variants` / 子效果同类取最高
  - 还是图片源里真的存在多张独立手牌
- 在完成这一步之前，禁止把复合升级素材拆成多个 runtime frame。
- 新角色录入默认必须优先复用老派系已经跑通的共享运行时合同：
  - 同类档位自动取最高
  - 同卡复合子技能按共享逻辑做选择
  - 升级卡只替换基础技能，下半区进入该技能的 `variants`
- 除非已有确凿证据证明老派系合同不适用，否则禁止因为“新角色素材长得不一样”就单独发明新的手牌模型、atlas 语义、选择逻辑或结算时序。
- 如果新角色素材看起来和旧角色不同，但旧实现与专项文档都不能唯一说明接线方式，必须先问用户；不得擅自发明新的图集语义。

#### 3.2 复合物理牌阻断门禁

只要出现下面任一证据，即视为进入阻断态，不得继续沿现有实现修补：

- 原始 `ability-cards.webp` 能直接看出“同一张物理牌里有上下两个子区 / 多个标题 / 升级标题 + 子技能区”
- 用户已明确指出“这不是两张牌，而是一张复合牌”
- 新角色素材与老派系同类升级相比，出现明显的“复合升级而非复合手牌”信号

进入阻断态后，必须先完成下面三件事，才能继续改代码：

1. 写清素材语义裁定：这是“一张物理牌 + 复合升级语义”，还是“多张独立手牌”
2. 和老派系同类升级逐张对照，确认它们是否同样遵守“同类取最高 / 一个基础技能目标”的合同
3. 把真相源、临时核对图、正式运行时资源分层登记，禁止再混用

阻断态下明确禁止：

- 继续在 `cards.ts` 里维持或新增“两个子区 = 两张牌”的录入
- 继续改 atlas/frame/`previewRef` 试图把错模型显示得更像对的
- 继续堆 E2E 并把“测试过了”当成素材合同正确的证据

### 4. 建立 Markdown 核对契约

至少维护三类文档：

- 真相源表：素材、路径、用途、状态
- 录入核对表：对象、触发条件、原文、结构化结论、对照结果
- 卡牌录入表：slot、类别、费用、名称、正文、当前状态

每个条目都必须保留：

- 原图或裁图定位
- 原始文本
- 结构化结论
- 不确定项 / 冲突项

### 5. 录入静态数据与资源索引

按角色实际情况更新：

- `src/games/dicethrone/heroes/<hero>/diceConfig.ts`
- `src/games/dicethrone/heroes/<hero>/tokens.ts`
- `src/games/dicethrone/heroes/<hero>/abilities.ts`
- `src/games/dicethrone/heroes/<hero>/cards.ts`
- `src/games/dicethrone/heroes/<hero>/index.ts`
- `src/games/dicethrone/domain/ids.ts`
- `src/games/dicethrone/domain/characters.ts`
- `src/games/dicethrone/domain/index.ts`
- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`

强制要求：

- 卡图顺序必须以 `ability-cards` 裁图和合同表为唯一来源
- 不得沿用旧角色的 slot 顺序假设
- 不得伪造未确认的 `abilityTags`、费用、数值或时机
- 如果正式 `ability-cards.webp` 看起来和老角色不同，先做“逐格对照 + 旧角色合同比对 + 真实 UI 验证”；只有这些证据都证明现有 atlas 合同不成立时，才允许讨论新 atlas 配置或 `previewRef.type = 'image'`
- 必须先把手牌卡分清：`type = 'action'` 表示“打出后直接结算卡牌自身效果”；`type = 'upgrade'` 才表示“替换玩家面板上的基础技能”
- 升级卡可以替换一个基础技能定义，而这个基础技能定义内部可以有多个 `variants`；但这些 `variants` 不是新的手牌卡对象，也不会自动占用新的卡图索引
- Dice Throne 老派系里大量升级都属于“复合升级”：
  - `monk/card-thrust-punch-2/3 -> fist-technique`
  - `barbarian/upgrade-slap-2/3 -> slap`
  - `paladin/upgrade-righteous-combat-2/3 -> righteous-combat`
  - `samurai/upgrade-katana-slice-2/3 -> katana-slice`
  - 它们共同遵守“同一基础技能被逐级替换，同类取最高”的执行合同
- 因此“升级卡内部有多个档位/子区/子效果”默认解释为能力层复合，不是多张手牌图
- 只要老角色已有对应模式，新角色必须优先复用老角色模式；禁止为新角色单独重写一套“更适合它”的选择规则或运行时语义。
- `targetAbilityId` 必须始终指向基础技能 ID，不能指向技能变体、技能子集或临时 UI 槽位
- 如果原图出现复合排版，必须先区分“真相源 slot”和“运行时合同”：
  - 共享 `source slot` 只说明源图定位可能共用，不自动等于运行时也该共用同一个 `previewRef.index`
  - 如果真实 UI 已经出现“打出 A 显示成 B”，先核原始图、老角色同位和核对图生成链路，再决定是 atlas 错、裁图错还是 UI 消费错
  - 禁止无证据把后处理拆分图反向升级成正式运行时 atlas 索引
  - 也禁止因为一格里有上下两个标题，就直接下结论“这是两张正式卡”
- 如果用户反馈的是“看起来打成了另一张牌 / 看起来进了弃牌堆 / 看起来没贴到技能槽”，不得先把用户降级成“看错了”；必须同时核：
  - 稳定态截图
  - 运行时 DOM / `previewRef`
  - 权威状态字段（如 `discardIds`、`upgradeCardByAbilityId`、`abilityLevels`）
- 但也不得把用户对画面对象的解释直接当作权威状态；当视觉现象与状态不一致时，必须明确区分“视觉误导”与“状态错误”
- 对“上下叠放拆卡”或“源图布局与通用 atlas 不一致”的角色，合同表里必须显式写出：
  - 哪些文件是主真相源裁图
  - 哪些文件是正式运行时 atlas
  - 哪些文件是正式单卡图
  - 哪些只是核对或生成过程中的临时中间产物
  - 三者的目录与引用规则
- 如果某个新角色要靠新增特判才能表现正确，默认先怀疑录入模型错了；在证伪老派系共享逻辑之前，不得先给新角色开逻辑分叉。

#### 5.1 新角色必须做老角色共享契约对比

录完新角色后，禁止只验证“这个角色自己能跑”。至少要挑 1 个成熟老角色；如果本轮争议点是“复合升级 / 复合排版”，则必须逐个挑同类老角色对照，并把下面共享契约并排核一遍：

- 手牌类别合同：老角色里哪些是“直接结算行动牌”，哪些是“升级基础技能的升级牌”；禁止把两类都混叫成“技能牌”后再做实现
- 升级卡状态落点：是否和老角色一样落在 `abilityLevels` / `upgradeCardByAbilityId`，而不是混进 `discard`
- `previewRef` / atlas：是否仍沿用老角色手牌预览合同，而不是临时发明新的 atlas 语义
- 通用卡索引：如果顺序和老角色不同，是否已有显式映射与专项 evidence
- AI / 阶段门禁：响应牌、roll 牌、main 牌是否仍走共享验证函数
- UI 消费链：技能槽升级展示、card spotlight、magnify overlay 是否仍吃同一组状态字段
- 选择逻辑：是否仍复用老角色“同类档位自动取最高、同卡复合子技能再选择”的共享逻辑，而不是在新角色上另写一套
- 复合升级合同：老角色中相同类型的升级，是否也是“一个 `card.id` -> 一个基础技能 ID -> 内部 variants / 同类取最高”，而不是一张升级牌拆多个 runtime card
- 被动能力建模：该角色的被动是走 `player.passiveAbilities`、`ability.type = 'passive'`，还是额外的 `flowHooks` 特判；只要出现多条路径，就必须在规则文档和 evidence 里显式说明原因
- 被动定义自洽性：如果某个 `ability.type = 'passive'` 只是展示壳，缺少 `trigger/effects`，却靠别处硬编码触发，必须直接记为未收口；若旁路链也不存在，则按未实现重大 bug 处理
- 槽位展示与能力执行分离：如果某个技能条目只是为了占据棋盘槽位、提供名称/描述或支撑 `abilityLevels` / 升级展示，不能继续把它伪装成完整 `AbilityDef`。要么补齐真实执行合同，要么拆成 display-only 槽位元数据并在文档里显式登记

不满足上面这一步，不能对外说“新角色已经和老角色一致 / 已全部收口”。

### 6. 同步规则文档

录入影响规则、文案或资源映射时，至少同步：

- `src/games/dicethrone/rule/<角色>真相源表.md`
- `src/games/dicethrone/rule/<角色>录入核对.md`
- `src/games/dicethrone/rule/<角色>卡牌录入核对.md`（如适用）

如已进入机制实现，再补读并同步：

- `src/games/dicethrone/rule/王权骰铸规则.md`

### 7. 资源上传前的固定检查

先执行：

```bash
node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id dicethrone
```

再检查：

- 运行时最终 URL 是否会自动补 `i18n/<locale>/` 与 `compressed/`
- 正式 atlas / 正式单图是否已经落到 `compressed/`
- 本轮临时裁图、核对图、临时 atlas 是否留在 `temp/` / `test-results/` / 忽略目录，而不是 `public/assets/`
- `CardPreview` / `OptimizedImage` / `getOptimizedImageUrls()` 最终请求的路径是否真实存在

### 8. 上传 R2 并回查

本步骤的“是否必须上传、失败后如何汇报”按通用规则执行：

- `docs/ai-rules/data-entry.md` § 资源上传收口
- `docs/ai-rules/asset-pipeline.md` § R2 / CDN 上传收口规则（强制）

建议顺序：

```bash
npm run assets:check
npm run assets:upload
```

上传后必须至少回查这些代表性 URL：

- 主 atlas 1 个
- 正式单卡图 1 个（如果本轮新增）
- `crops/player-board/compressed/` 1 个
- `crops/tip/compressed/` 1 个

如果任一代表性 URL 仍是 `404`，本轮资源 intake 不算完成。

### 9. 进入机制实现前的建模门禁

如果本轮不只是录入，还要补技能或 Token 机制实现，必须再读：

- `docs/ai-rules/engine-systems.md`

并先完成：

- 术语到事件的映射
- 决策点识别
- 冲突项裁定

禁止跳过建模，直接凭图片正文硬写 handler。

### 10. 验证

至少按改动面选择验证：

- 静态数据 / 机制实现：相关 Vitest
- 资源引用 / 预加载：相关资源或 resolver 测试
- UI 卡图展示 / 手牌预览：相关 E2E 与截图证据

如果这轮改动触及 UI 展示，必须人工看图，不得只看断言通过。

## 推荐交付物

- `src/games/dicethrone/rule/<角色>真相源表.md`
- `src/games/dicethrone/rule/<角色>录入核对.md`
- `src/games/dicethrone/rule/<角色>卡牌录入核对.md`
- `evidence/<task>-e2e-test.md`

## 当前可参考的现成样本

- `src/games/dicethrone/rule/枪手真相源表.md`
- `src/games/dicethrone/rule/枪手录入核对.md`
- `src/games/dicethrone/rule/枪手卡牌录入核对.md`
- `src/games/dicethrone/rule/武士真相源表.md`

这些文件适合作为 Dice Throne 角色 intake 的现成模板，不需要每次从零发明格式。
