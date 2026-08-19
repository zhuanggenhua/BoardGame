---
name: dicethrone-hero-intake
description: "Dice Throne 角色图片、骰面、Token、卡牌、裁图、资源上传与规则文档录入 workflow。"
---

# Dice Throne 角色图片录入工作流

## 适用范围

适用于 Dice Throne 单个角色或新英雄的 intake 流程，覆盖：

- 真相源锁定
- 角色板 / 提示板 / 卡图裁图
- 骰面、Token、能力、卡牌静态数据录入
- i18n 与规则文档同步
- 资源 manifest 重建
- 发布到服务器资源主源并回查公开资源域名
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
- FAQ 补充裁定源：`docs/games/dicethrone/sources/faq/王权骰铸常见问题总览2.1.1.docx`

补充门禁：

- 只要 `player-board` 能直接看出技能槽 / 被动槽 / 防御槽 / 终极槽 / 展示槽 / 空槽 的图面分布，必须在录入阶段逐槽建立 `玩家板图面合同`，并把每个槽位的运行时对象、允许状态和是否可交互写清楚。
- 禁止用“共享槽位名看起来像”“旧英雄同名位置应该一样”“先按感觉映射，后面再审”来补录槽位；槽位合同必须由本英雄本图直出，不能靠猜。
- 任何 `ui/abilitySlotMapping.ts` / `AbilityOverlays.tsx` 这类槽位消费链，必须能回指到该合同表；若合同表缺行、缺空槽、缺被动/防御槽说明，录入不得收口。
- 旧英雄迁到新版面板、新英雄复用旧坐标、或任何“共享坐标 + 专属底图标题”的场景，必须把“物理槽坐标”和“槽位对应技能”分开录入。共享坐标只说明格子在哪里，不说明格子里是谁；每个物理槽必须按当前底图中文标题建立 `slotId -> abilityId` 合同。
- 升级牌覆盖槽位不能按 `abilities.ts` 里的基础技能英文名或旧共享槽位语义猜。必须逐张读取运行时升级牌的 `replaceAbility(targetAbilityId)`，再用升级牌中文名、目标技能 id、玩家板中文槽位标题三者对齐；三者缺一时合同只能标 `blocked/disputed`，不得标 `locked`。
- 一旦发现某张升级牌盖错槽、点错槽或和底图标题不一致，默认必须横扫同英雄、同批次和同一共享槽位消费链的全部升级牌；最低覆盖 `cards.ts` 全部 `type='upgrade'` 且 `replaceAbility` 的条目、`abilityOverlayHelpers.ts` 覆盖槽、`abilitySlotMapping.ts` 点击/高亮反查槽，以及 E2E 真实升级稳定态。禁止只修用户点名的一张卡后收口。
- 只要用户反馈的是“某张卡的图和效果对不上”“怀疑枪手/忍者这类角色卡牌录入错了”“怀疑 atlas/索引用错”，必须先直接打开对应 `ability-cards` 主真相源里的完整单卡，再去看 `cards.ts`、`abilities.ts`、AI、日志或测试。没完成这步前，只能说“代码层暂未发现分叉”，不能裁定“不是录入错误”。
- 给用户看图由项目开图入口承担；AI 看图验收按项目入口继承的区分口径执行。本流程只额外要求：Dice Throne 卡牌录入需要 AI 验收时，必须核对正式 `ability-cards` 主真相源，写出图面可见文字、分支结构、数值和当前实现差异后，才允许把合同标记为 `passed/locked`。
- 对 Dice Throne 角色，`public/assets/i18n/zh-CN/dicethrone/images/<hero>/compressed/ability-cards.webp` 或对应正式 atlas 永远是卡牌语义主真相源；`temp/dicethrone-intake/<hero>/ability-card-slots/*.webp` 之类临时裁片只能辅助读字，不能单独推翻正式 atlas 读法。
- 桌游卡牌、玩家板和提示板默认存在唯一官方图面真相源。只要用户口径、现有实现、i18n、测试快照或旧 evidence 任意两者不一致，默认先判为“录入合同可能错或实现消费可能错”，必须回完整单卡/玩家板/提示板重新录入；禁止把用户随口提到的词直接写成官方卡名、分支名、规则字段或测试期望。
- 重新录入前必须先形成最小字段合同：对象、正式图源路径、正式 atlas/index 或槽位、完整单对象裁图路径、图面可见原文、分支/槽位结构、当前实现差异、合同状态。缺这份合同时不得继续改运行时数据。
- 对“共享坐标 + 不同英雄底图”的槽位系统，`slotId` 只能表示物理位置，不能表示该英雄的技能名。任何覆盖层、点击反查、高亮反查、测试断言都必须消费同一份 `当前英雄 + 物理槽 -> 玩家板图面技能` 合同；禁止在不同文件各维护一套看似等价的槽位表。
- 发现某个 `replaceAbility` 升级牌错槽后，必须把同类问题视为批量录入风险：至少重跑全英雄替换型升级牌矩阵、重新生成玩家板槽位裁图或 contact sheet，并把当前测试覆盖数量写进 evidence；代表样本通过不等于全量通过。

## 权威来源分工

默认口径如下：

- 汉化图 / 当前任务约定图片：中文名称、中文描述、图内顺序、裁图定位
- 官方规则书 / 官方 PDF / 官方图：高优先级英文对照源
- `docs/games/dicethrone/sources/faq/王权骰铸常见问题总览2.1.1.docx`：补充常见规则裁定，用于核对状态花费/移除、响应窗口、攻击是否成立、防御是否仍可用等边界；不得替代图面主真相源
- Wiki：辅助英文名、补充裁定、发现冲突，不反向覆盖中文主真相源
- 当前任务 worktree：本轮资源、裁图、manifest、服务器资源主源发布结果的唯一工作现场
- Fandom / Rulepop / 其他页面如果被转录成项目内静态快照、fixture、JSON 或 TS 常量，必须为每个对象或每批对象保留可访问来源链接与获取日期；没有这些链接的本地快照只能算“历史对照数据”，不得继续写成“官方 Wiki 权威快照”
- 任何本地对照快照一旦与 `ability-cards.webp` 完整单卡、角色板、提示板或官方 PDF 冲突，默认先判本地快照失信，回到主真相源重录；不得要求图片去迁就旧 fixture
- 用户反馈也是冲突信号，不是可直接落库的权威文本。用户说出的名称、分支或效果只能作为定位线索；若与主真相源图面不一致，最终录入必须以主真相源图面或用户明确指定的权威来源为准，并把被否定的用户口径写入冲突记录，防止再次误录。

## 资源完成判据

Dice Throne 的资源交付不能只看 `git status`，因为图片目录常被忽略。

这套流程里“资源已完成”至少要同时满足：

- 本地 `public/assets/i18n/zh-CN/dicethrone/images/<hero>/compressed/*.webp` 存在
- `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json` 已重建
- 运行时代码已接入引用
- `https://assets.easyboardgame.top/official/...` 公开资源域名对代表性 URL 返回 `200`，且内容来自服务器主源

## 禁止提前收口（强制）

只要用户要求“新增角色 / 新增派系 / 两个新角色一起做 / 数据录入、上传、审计、端到端全流程”，不得把“可选角 + 资源能显示 + 少量 smoke 测试通过”误报为完成。

默认执行口径补充：

- **Dice Throne 新英雄 intake 默认需要审计留档，但不自动扩大范围**：只要任务语义是“新增英雄 / 新角色接入 / 新派系从素材做到可玩”，默认产出当前锁定对象范围的审计 evidence；是否覆盖整英雄、整批次，必须由用户或已批准任务明确写出，不能由“新增英雄”标签自动推断。
- **同一批新英雄的继续补审只在当前锁定范围内持续授权**：用户说“继续”或继续补审时，默认消费当前 evidence 并推进已列对象；要加入其它卡、Token、状态或兄弟链路，必须有用户点名、共享消费者直接影响、新真相源冲突或明确整批范围证据。
- **发现单点漏项时按直接影响扩审**：如果某张升级技、防御技、Token、状态或奖励骰对象暴露出录入错、共享消费合同错、实现漏项或旧审计失效，先闭环当前对象；只有能证明缺口直接影响同一共享消费者或同一合同源的对象才纳入复审，并把触发证据和对象集回写到 evidence。
- **未形成对象矩阵结论前不得称为 intake 完成**：只要当前锁定范围内还有对象没有明确写成 `passed / blocked / scoped-debt(经用户确认冻结)`，就只能汇报为“局部修复完成”或“当前仍有残余范围”，不得把当前范围写成已完成；未被锁定的兄弟对象另列为范围外候选。
- **双面英雄必须按两张面分别建对象矩阵**：只要同一英雄存在 `playerBoardFace`、翻面、两套玩家板技能文本、两张玩家板底图或双面状态语义，就必须把两张面分别建立对象行、逐槽图面合同、翻面前后能力集合同与 completion audit；禁止把一张面的通过外推成整英雄已完成。
- **底图/选图接入不等于双面实现完成**：即使 `human-player-board` / `player-board` 已进入运行时、`ASSETS.PLAYER_BOARD` 可按面取图、选角后能看到新底图，也只能证明资源链和首批图面合同接上；若尚未证明自动翻面链、逐槽对象合同、每张面逐对象最终权威结果、真实入口与双面重审计，就不得写“规则都实施了”或“该英雄已完成”。

必须同时清空以下门禁，才允许对外说“已完成”：

1. **数据录入门禁**
   - 每个角色必须有逐项真相源表、技能/Token 录入核对、卡牌录入核对。
   - 每张卡、每个技能、每个 Token 都必须有“来源定位 + 原文/图文要点 + 结构化字段 + 当前实现结论”。
   - Dice Throne 伤害类技能/卡牌必须把图面规则信号录成独立字段，至少包括：图面颜色/框色/伤害图标或关键词、是否属于攻击伤害、是否会触发防御投、是否为直接/附属/不可防御/终极伤害。不能只因为效果最终产生伤害事件，就把该对象录成可防御攻击；也不能只因为写着伤害数值，就跳过卡面颜色和伤害类型核对。
   - 如果伤害来自 custom action、目标选择回调、奖励骰、分支或附属目标，录入合同必须额外写清这段伤害是“攻击主伤害”还是“非攻击/附属/直接伤害”，以及该结论如何被 `pendingAttack.isDefendable` 或等价防御入口消费。缺这列合同，不能把对象标成 `locked`。
   - 如果只录了名称、费用、图片索引或静态展示，不得写“卡牌已录完”；必须标成 `静态接入 / 行为与真实入口待实现`。
   - 若角色存在双面/翻面机制，录入门禁还必须分别写清两张面的槽位合同、对象矩阵和翻面语义；缺任一面的逐槽合同都不得收口。
2. **机制门禁**
   - 被动、Token、状态、攻击、防御、延迟结算、可选目标、响应时机必须逐项裁定是否已实现。
   - 不完整机制必须在 `rule/` 与 `evidence/` 同步列成剩余风险，禁止藏在“复杂精确机制债务”这种泛化句子里。
   - 若用户要求“彻底完成才停”，存在最终状态或真实入口未实现项时不得停；只能继续实现或明确硬阻塞。
3. **资源门禁**
   - 原始图、正式压缩图、atlas JSON、manifest、运行时代码引用必须逐项对上。
   - 若 `public/**/*.webp` 被 `.gitignore` 忽略，必须在证据文档里单列“忽略但必须存在/已发布到服务器资源主源”的资源清单；不得只看 `git status`。
   - 共享资源（如 `Common/compressed/background.webp`、`character-portraits.webp`）也必须在隔离 worktree 中存在并被截图证明，否则 E2E 图像证据无效。
   - 新增或修改 Token / 状态图标时，资源审计不能只查 `webp`、manifest、服务器资源主源发布结果；必须逐项核对 `status-icons-atlas.json` 是否被运行时真实消费，并证明对应徽章命中 sprite，而不是退成纯色 fallback。
4. **发布门禁**
   - `npm run assets:upload` 成功只是必要条件；必须对本轮新增/依赖的代表性远端 URL 做 `HEAD` 回查。
   - atlas JSON 若按项目现有规则不发布到服务器资源主源，必须明确写“本地 `/assets/atlas-configs/**` 加载”，并验证构建产物能引用，不得误报“atlas 已发布”。
5. **审计门禁**
   - 审计文档必须写明权威来源、逐项结论、原子语义、实现消费、最终权威结果、测试/截图证据和未覆盖风险。
   - 如果只完成静态接入或领域行为验证，不得说成“发布级完成”。
6. **E2E 门禁**
   - 至少覆盖真实在线双玩家：两个新角色都被选择，两个玩家都能进入对局。
   - 截图必须分别能看到两个新角色的玩家面板、提示板、手牌/卡图和 HUD；只看 host 一边不够。
   - 只要最终回复说 E2E 通过，必须给出本轮实际核对过的截图绝对路径。

如果任何一项未满足，当前状态只能汇报为“已完成某层 / 未完成全流程”，不得停止长期任务。

- **防御重投专项门禁（强制）**：凡防御技卡面写有“可重掷 / 可再投 / 至多 N 颗 / 再次投掷”之类语义，不能只验证 `diceCount` 和最终结算。必须额外逐项留证：
  - 触发定义是否显式声明了共享消费字段（如 `rollLimit` 或等价字段）；
  - `ABILITY_ACTIVATED -> defensiveRoll` 后的权威状态是否真的把 `rollLimit` 提升到预期值；
  - 真实 UI 是否允许“保留部分骰子后继续重投其余骰子”，而不是只在代码里看起来可配。
- **禁止收口口径**：如果只证明“防御掷出了 3 颗骰并按结果结算”，还不能说这张防御升级技已实现；含重投语义的防御技必须把“可继续投”的窗口单独验收。

补充口径：

- `crops/...` 默认只算录入核对中间产物，不计入“正式资源已完成”。
- 为了看清文字而额外做的后处理图，必须放 `temp/dicethrone-intake/<hero>/...` 或等价临时目录，禁止继续落在 `public/assets/.../crops/**`
- 对 Dice Throne 角色，正式运行时默认必须优先走 atlas：
  - 先尝试公共 atlas 配置
  - 若局部位点看起来异常，先回到原始 `compressed/ability-cards.webp` 与老角色同位裁图对照，先证伪是不是核对图生成链路错了
  - 只有在逐格对照、老角色比对和真实 UI 验证后，才能裁定 atlas 合同本身是否失效
- 角色选择头像是共享运行时资源，必须单独保护：
  - 老角色头像继续使用既有 `character-portraits` 合同；新角色即使有不同规格头像来源，也不得把新来源的尺寸、行列或索引覆盖到老角色共享合同上
  - 如果新角色头像确实来自另一张图集，必须做按角色分流或新增独立头像合同；禁止直接替换全局 `PORTRAIT_ATLAS` / `CHARACTER_PORTRAIT_INDEX` / `ASSETS.AVATAR` 让老角色跟着变
  - 新头像图集接入前必须建立完整的 `角色 ID -> 从 0 开始的图集索引` 对照表；不能只登记当轮点名的部分角色。每个正式启用角色都必须有“命中新图集 + 精确裁切位置”的合同测试，禁止缺项后通过旧图集或 `?? 0` 静默显示另一名角色
  - 任何修改共享头像合同的尝试，必须先列出所有受影响老角色，并提供 PC 与移动端至少各一个老角色选角截图；没有这些证据，不允许合并
  - 如果只有移动端异常、PC 正常，先检查浏览器缓存、CDN 缓存、manifest hash、实际请求 URL 与响应体；不得把缓存问题当成 atlas 合同问题修
- 因此不能把“单卡图能显示”当成 Dice Throne 新英雄 intake 的默认收口条件。

## 执行步骤

### 1. 锁定 worktree 与本轮范围

先确认：

- 当前处理的是哪个 `heroId`
- 对应任务 worktree 是哪个
- 本轮只做录入，还是包含后续机制实现

禁止在根工作树或错误分支下看完素材后，直接对当前任务下结论。

若用户一次给出多个新角色，必须先建立批次矩阵：

| heroId | 素材 | 数据录入 | 机制 | 资源发布 | E2E | 审计 |
| --- | --- | --- | --- | --- | --- | --- |

每格只能填可验证状态：`pending / in_progress / passed / blocked / scoped-debt`。未跑证据不得填 `passed`。

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

若本轮起因是“卡图和效果不一致 / 怀疑录入错误 / 怀疑索引用错”，这里还必须额外写清：

- 已直接查看的原图对象是哪一张完整单卡 / 哪个玩家板槽位 / 哪个提示板块
- 图上文字、图上顺序、图上槽位分别对应到哪个运行时对象
- 当前结论究竟是“录入错”“索引错”还是“运行时消费错”；若还没看图，只能标成“未完成录入真相核对”

### 3. 先裁图，再录入

必须先把整图切到单对象可读粒度：

- 角色板：每个技能 / 被动 / 防御技 / 终极技
- 提示板：每个 Token / 关键词 / 骰面说明
- 卡图：逐卡或逐 slot

当前项目里 Dice Throne 已有角色专用裁图脚本时，优先复用或仿照：

- `npm run dicethrone:intake:crops -- --hero <heroId> --source ability-cards --max-index <n>`
- `scripts/games/dicethrone/assets/extract-dicethrone-gunslinger-crops.mjs`
- `scripts/games/dicethrone/assets/extract-dicethrone-samurai-crops.mjs`
- 历史角色脚本仍位于 `scripts/assets/extract-dicethrone-gunslinger-crops.mjs` 与 `scripts/assets/extract-dicethrone-samurai-crops.mjs`；新增批量任务优先使用上面的 npm / `scripts/games/dicethrone/` 入口。

强制补充：

- `crops/ability-cards/` 默认只是真相源裁图，不自动等于运行时素材。
- 只要是为了录入生成的裁图，不论只是普通几何裁切，还是额外做了 OCR / 放大 / normalized preview，都必须进 `temp/`；禁止把这类图继续放在 `public/assets/.../crops/**`、manifest 或服务器资源主源发布链
- 默认优先级永远是：
  - 能直接复用原 `ability-cards` atlas 的，继续走 atlas
  - 录入时可以参考同源 `slot-xx.webp` 裁片；但正式 `ability-cards.webp` / 正式 atlas 的读法高于任何临时裁片，若两者冲突，先重切高清裁片再裁定
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

新增角色的核对契约不得只写高层摘要。最低粒度：

- 玩家面板：每个基础技能、被动、防御技、终极技各一行。
- 提示板：每个 Token / 状态 / 关键字各一行。
- 卡牌：每个 `card.id` 各一行，含费用、类型、名称、正文、`previewRef`、当前实现等级。

实现状态统一按证据轴记录：

- `真相源`：素材、规则原文、对象归属和结构化字段已锁定。
- `静态接入`：静态数据、文案、图片索引和 registry 已接入。
- `最终状态`：领域行为、数值结算或状态变化已有单测或等价逻辑验证。
- `真实入口`：真实 UI / E2E 正路径验证。
- `生命周期`：复杂交互、响应窗、finalState / triggerQueue / reaction session 或等价完整链路验证。

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
- 批量审计升级牌时，不能只扫描 `cards.ts` 里的本地变量。`replaceAbility(targetAbilityId, NEW_ABILITY_DEF, level, ...)` 的 `NEW_ABILITY_DEF` 很多来自同角色 `abilities.ts` 导入；审计脚本必须同时解析 `cards.ts` 与 `abilities.ts`，再读取替换后技能定义的 `variants`、custom action、奖励骰和条件分支。只看 `cards.ts` 会漏掉战术家 `摇鼓运动 II` 这类复合升级牌。
- 生成“高风险候选清单”后，必须和正式单卡裁图总表对账：每个已知复合排版、上下子区、显式 variants 的升级牌都必须在清单中有行。若 contact sheet 肉眼可见下半区分支但清单没列，先修审计脚本，不得把“清单未命中”当成该牌无风险。
- Dice Throne 老派系里大量升级都属于“复合升级”：
  - `monk/card-thrust-punch-2/3 -> fist-technique`
  - `barbarian/upgrade-slap-2/3 -> slap`
  - `paladin/upgrade-righteous-combat-2/3 -> righteous-combat`
  - `samurai/upgrade-katana-slice-2/3 -> katana-slice`
  - 它们共同遵守“同一基础技能被逐级替换，同类取最高”的执行合同
- 因此“升级卡内部有多个档位/子区/子效果”默认解释为能力层复合，不是多张手牌图
- 只要老角色已有对应模式，新角色必须优先复用老角色模式；禁止为新角色单独重写一套“更适合它”的选择规则或运行时语义。
- `targetAbilityId` 必须始终指向基础技能 ID，不能指向技能变体、技能子集或临时 UI 槽位
- 新角色如果还处于“实施中 / 未完整收口”状态，角色目录中的 `implementation_in_progress` 徽标只有一套实现：既有斜向覆盖横幅。
  - `id: 'implementation_in_progress'`
  - `labelKey: 'common:status_tags.under_construction'`
  - `tone: 'warning'`
  - `variant: 'disabled-overlay'`
  - 禁止新增第二套实施中样式、第二套实施中组件，或为了单个角色改 `CharacterSelectionBadge` 的视觉样式。
  - 只有角色完成并关闭实施中状态时，才允许移除该 badge；不得把“换成更小的提示”当成关闭实施中的替代方案。
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
- Token / 状态图标运行时消费链：只要新增或修改 `tokens.ts`、状态、`statusAtlasId`、`statusAtlasPath` 或 `status-icons-atlas.*`，必须和至少 1 个成熟老角色逐项对比下面链路，不能只看资源文件存在：
  `TokenDef.frameId / atlasId -> ALL_TOKEN_DEFINITIONS -> STATUS_EFFECT_META / TOKEN_META / getVisualMetaById -> CHARACTER_DATA_MAP.statusAtlasId / statusAtlasPath -> loadStatusAtlases -> getStatusEffectIconNode -> StatusEffectsContainer / TokensContainer -> 血条上方徽章 hasSprite=true`
- `status-icons-atlas.json` 是本地配置文件，应走 `/assets/i18n/<locale>/...` 或等价本地路径加载；它不属于必须发布到服务器资源主源的媒体资源。旧角色远端 JSON 404 不能直接推导为“资源缺失”，必须回到本地 JSON 加载链和真实 DOM 消费结果核对。
- Token / 状态图标核对必须覆盖 frame key 与定义 ID 是否一致，例如 `frameId`、`atlasId`、`statusAtlasId`、`statusAtlasPath`、JSON `frames` key 是否能被 `getVisualMetaById` 命中；只验证“徽章数量存在 / 可见 / 可点击”不得算图标显示通过。
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

### 7. 资源发布前的固定检查

先执行：

```bash
node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id dicethrone
```

再检查：

- 运行时最终 URL 是否会自动补 `i18n/<locale>/` 与 `compressed/`
- 正式 atlas / 正式单图是否已经落到 `compressed/`
- 本轮临时裁图、核对图、临时 atlas 是否留在 `temp/` / `test-results/` / 忽略目录，而不是 `public/assets/`
- `CardPreview` / `OptimizedImage` / `getOptimizedImageUrls()` 最终请求的路径是否真实存在

### 8. 发布到服务器资源主源并回查

本步骤的“是否必须发布、失败后如何汇报”按通用规则执行：

- `.spec/knowledge/standards/data-entry.md` § 资源上传收口
- `docs/deploy.md` § 生产素材域名：服务器主源

建议顺序：

```bash
npm run assets:check
npm run assets:upload
```

发布后必须至少用公开资源域名回查这些代表性 URL：

- `player-board.webp` 1 个
- `tip.webp` 1 个
- `ability-cards.webp` 1 个
- `dice.webp` 1 个
- `status-icons-atlas.webp` 1 个（如该角色有 Token / 状态图标）
- 共享 DiceThrone `Common/compressed/background.webp` 与 `character-portraits.webp`（隔离 worktree 中首次跑 E2E 时必须确认）

如果任一代表性 URL 仍是 `404`，本轮资源 intake 不算完成。

注意：当前上传脚本只上传压缩媒体 / SVG / 音频，默认不上传 atlas JSON。若本轮新增 atlas JSON，必须在证据中写清：

- JSON 本地路径
- 构建是否通过
- E2E 是否真实消费该 atlas
- 远端媒体是否已发布到服务器资源主源

禁止把 JSON 的 404 写成资源发布成功。

### 9. 进入机制实现前的建模门禁

如果本轮不只是录入，还要补技能或 Token 机制实现，必须再读：

- `.spec/knowledge/standards/engine-systems.md`

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

新增 Dice Throne 角色的最低验证包：

1. `npx eslint -- <本轮修改 ts/tsx>`
2. `npx tsc --noEmit --pretty false`
3. `npm run i18n:check`
4. 角色 intake / registry / criticalImageResolver 相关 Vitest
5. `npm run assets:manifest`
6. `npm run assets:validate`
7. `npm run assets:upload` + 代表性 URL `HEAD`
8. `npm run build`
9. 真实在线双玩家 E2E，至少证明：
   - 两个新角色都能在选角入口选中。
   - Host 和 Guest 都能进入对局。
   - Host/Guest 截图分别看到对应新角色玩家面板、提示板、手牌/卡图、HUD。
   - 只要涉及翻面、形态切换、状态切换、阶段推进或多段结算，截图证据至少覆盖“初始态 + 结束态”；若有可见中间交互，还必须补“交互中”截图，且每张图都要能肉眼证明对应状态已成立。
   - 如果新角色有 Token / 状态图标，必须至少有一条真实 DOM 断言证明血条上方 `[data-tutorial-id="status-tokens"]` 内的徽章命中 `status-icons-atlas` sprite，且父徽章不含纯色 fallback 类（如 `bg-gradient-to-br`）。只证明 token/status 徽章可见，不得算图标显示通过。

若机制实现超出静态接入或领域行为，还必须补对应真实入口和生命周期成功路径截图；不能用“进入对局成功”替代复杂机制验证。

## 推荐交付物

- `src/games/dicethrone/rule/<角色>真相源表.md`
- `src/games/dicethrone/rule/<角色>录入核对.md`
- `src/games/dicethrone/rule/<角色>卡牌录入核对.md`
- `evidence/<task>-e2e-test.md`

最终证据文档必须包含：

- 批次矩阵最终状态。
- 每个角色的数据录入覆盖表。
- 资源本地路径与远端回查表。
- 测试命令与结果。
- 每张关键截图的绝对路径与肉眼观察。
- 明确剩余风险；若无剩余风险，必须逐项说明为什么已清空。

## 当前可参考的现成样本

- `src/games/dicethrone/rule/枪手真相源表.md`
- `src/games/dicethrone/rule/枪手录入核对.md`
- `src/games/dicethrone/rule/枪手卡牌录入核对.md`
- `src/games/dicethrone/rule/武士真相源表.md`

这些文件适合作为 Dice Throne 角色 intake 的现成模板，不需要每次从零发明格式。
