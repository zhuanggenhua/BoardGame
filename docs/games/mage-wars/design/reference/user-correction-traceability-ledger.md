# Mage Wars 用户纠正覆盖账本

> 角色：`drift-check / evidence`。本文件只把用户在 Mage Wars PC Open Design 设计稿线上反复指出的纠正，映射到规则证据、项目设计合同和送验前检查项。它不是独立规范来源；新增硬规则必须回写到 `.spec/knowledge/standards/ui-change-gates.md`、`.spec/skills/ui-design-pipeline/SKILL.md`、`.spec/skills/ui-audit-loop/SKILL.md` 或 `.spec/skills/mage-wars-ui-design-memory/SKILL.md` 后，再由本账本引用。

## 使用方式

- 下一版 UI 设计、Open Design artifact、导出 PNG 或 AI 图面核验前，必须逐行复核本账本。
- 任一行的 `必须检查` 在整屏图里无法确认时，当前稿只能是 `REVISE` 或 `blocked`，不得打开给用户人工验收。
- 用户新增纠正时，先判断本账本是否已有等价覆盖；没有覆盖就补本账本或先回 canonical-source 补规则，再重审图。
- 本账本不允许替代规则书、素材合同或专项 skill；它只防止漏读、漏检和把同一错误反复带入下一稿。

## 覆盖矩阵

| 用户纠正 / 意图 | 现实问题 | 真相源 / 已落点 | 必须检查 | 当前覆盖 |
| --- | --- | --- | --- | --- |
| 不要凭直觉设计，一切基于规则 | 先画布局后找理由，导致规则对象和隐藏信息错 | `ui-design-pipeline` 设计启动硬门禁；`step1-runtime-board-saturated-ui-design.md` 规则到界面结论 | 本轮实际读取规则页、法术书合同、字段合同、素材矩阵，并写出三条以上会改变画面的规则结论 | covered |
| 使用 Open Design，不要生图 | 把 Open Design artifact 和 media 生图链混淆 | `ui-design-pipeline` 交付形态裁定；`docs/infra/open-design.md`；设计 README 当前状态 | artifact 元数据必须是 Open Design artifact；不得调用 `od media generate` 或 imagegen | covered |
| 先 UI 设计，再设计稿，再人工验收，再实现 | 设计未批就进真实页面 / E2E / 移动端 | `ui-design-pipeline` UI 设计先于设计稿；`ui-change-gates.md` 0.0C；设计 README 当前状态 | 用户未明确批准前，不启动真实 Board/UI、真实页面 E2E、移动端适配 | covered |
| PC 没好不要管移动端 | 用移动端或运行页截图替代 PC 设计通过 | `ui-design-pipeline` PC 基线先于移动端；`ui-change-gates.md` 0.0C | 当前交付只允许 PC Open Design 设计稿候选；移动端状态必须 blocked | covered |
| 设计稿通过前不能实施 | 把设计候选当实现依据 | `ui-design-pipeline` 设计稿不是实现；设计 README implementation-freeze | 最终汇报必须写明真实实现冻结，等用户批准设计稿 | covered |
| 规则里没有“手牌” | 套用卡牌游戏默认手牌概念 | `mage-wars-ui-design-memory`；`step1-runtime-board-saturated-ui-design.md`；学徒法术书合同 | 可见文案、aria、class、审计和汇报只能用法术书、已计划法术、弃牌堆、隐性结界 | covered |
| 法术书不是底边装饰，当前可支配对象要能看 | 可用法术被缩成不可读小牌或入口 | `mage-wars-ui-design-memory` 法术书裁决；`ui-design-pipeline` 当前可支配对象守恒 | 法术书一页 6 张、单张足够读卡面主体、分类标签左侧、分页贴近牌列 | covered |
| 计划牌大小和法术书一致 | 已计划法术被弱化成角落挂件 | `mage-wars-ui-design-memory` 法术书 / 已计划裁决 | 两张已计划法术与法术书当前页卡面同尺寸，并有独立计划槽 | covered |
| 已计划和已选法术不要重复 | 同一规则对象被画成两个实体 | `ui-design-pipeline` 规则对象实体锚点守恒；设计 README v49 / v50 裁定 | 当前来源只能引用已计划法术实体，不再额外画同名“已选法术”大卡 | covered |
| 卡面已有名字和费用，不要外部复写 | 用 UI chip 重写卡面字段，浪费空间且重复 | `ui-design-pipeline` 卡面字段不复写；`ui-ux.md` 正式素材已含信息不得复读 | 名称、费用、射程、目标、骰数默认由可读卡面承担；外部只补运行态 | covered |
| 不要常驻确认 / 执行 / 取消 | 规则没有授权时伪造二次确认，占空间 | `ui-design-pipeline` 确认控件授权；`step1-runtime-board-saturated-ui-design.md` 统一动作规则 | 选中来源后高亮合法目标，目标本体点击推进；没有常驻确认按钮 | covered |
| 开放式设计 / 场地直选优先 | 用代理面板、问号块、目标摘要替代真实对象 | `ui-design-pipeline` 开放式直选裁决；`ui-change-gates.md` 0.0 / 0.0D | 合法目标在棋盘格 / 场上卡 / token 本体高亮，代理 UI 仅在有规则理由时出现 | covered |
| 玩家提示挂角色头像，不挂场地 | 把“选择目标 / 行动中”做成卡在地图顶部或中央的提示条，会让玩家误以为竞技场本体是提示载体 | `mage-wars-ui-design-memory` 用户原话反思表；`ui-design-pipeline` 开放式直选裁决 | 当前玩家提示在法师头像 / 角色 HUD；竞技场只承接区域语义、来源 / 合法目标高亮、骰子、token 和结果反馈 | covered |
| 法师提示卡和代表法师本人的卡不是一个东西 | 把 HUD 提示卡、竞技场法师实体和详情层混用，会导致提示挂错层、战场实体职责被 UI 壳替代，且 E2E 用含混命名把错误固化 | `mage-wars-ui-design-memory` 法师对象职责与 v80 基线裁定；TTS / atlas 证据：`mages-core-atlas.json` 中 `2600/2605/2606/2603` 是密集文字法师规则 / 提示卡，`2601/2604/2607/2602` 是人物 / 肖像 frame | 规则对象覆盖矩阵必须拆 `法师战场实体 / 法师本体`、`玩家 / 法师规则提示卡`、`法师规则 / 提示卡详情` 三行；当前 v80 基线采用“竞技场人物本体 + 玩家 HUD 规则提示卡”。未来改布局时，只验是否继续拆清职责并避免图面混淆，不把 v80 坐标当全局硬规。 | current-baseline-v80 |
| 召唤师本身也是单位，必须和同格单位放一起 | 法师虽有 `mageZoneId` 却被单独渲染到另一层，导致同格时不进入双方单位的归属带和容量预算 | `design-system/game-ui/MASTER.md` 4.14；`mage-wars-ui-design-memory` 1.6 | 压力态把双方各一名法师和五个生物放入 A2；棋盘只渲染一组左右归属带，双方各有 6 个实体，法师不在 A3/D1 留副本 | covered-by-runtime-e2e |
| 场地里的红框牌密密麻麻写满了字是提示卡 | 把密集文字法师规则 / 提示卡当作场地本体，玩家会以为竞技场里摆的是说明书，不是法师本人 | `mage-wars-ui-design-memory` 1.6；`rule-to-ui-element-list.md` 法师 atlas 与 UI 元素清单 | 截图检查不得只看 role 名，要看图面是否把密集文字提示 / 参考卡误画成竞技场实体；当前 v80 基线用人物可识别素材承载场地本体。 | covered-by-v80 |
| 规则提示卡和玩家卡图的位置错了，应该交换 | v79 只把场地从密集规则卡改成人物本体，但玩家 HUD 仍是人物卡图；这只修了一半，仍没有执行用户反复强调的当前稿交换方案 | `mage-wars-ui-design-memory` 1.6；`rule-to-ui-element-list.md` v80 基线复核 | 当前 v80 基线：场地格子 = 人物 / 肖像法师本体；玩家 HUD = 密集文字规则提示卡。它是 Mage Wars 当前稿的已定设计，不是下个游戏的固定模板。 | current-baseline-v80 |
| 地图是最下层，不要躲着地图 | 把底图当不可遮挡矩形，导致牌区拥挤 | `ui-design-pipeline` 层级模型；`ui-change-gates.md` 0.0D | 底图拆成必须保护的规则热区和可覆盖纹理区；牌区可开放 overlay 覆盖低权重石砖 | covered |
| UI 是分层，不只是分布局 | 只看几何不重叠，玩家视角仍拥挤 | `ui-design-pipeline` 分层先于分区；`ui-audit-loop` 玩家视角审计 | 审计要看背景层、对象层、主交互 overlay、结算 overlay、辅助 HUD，不只看 DOM 几何 | covered |
| 右下 / 底部空白必须有职责 | 删除 UI 后留下死空，不把空间还给主对象 | `mage-wars-ui-design-memory` 底部空间裁决；`ui-design-pipeline` 空白职责 | 右下和底边若空着，必须承载法术书、已计划、弃牌堆、分页、回合结束或结算预留 | covered |
| 分页按钮保持原样，页码不要占大空间 | 改错对象，把按钮样式也改了 | `mage-wars-ui-design-memory` 分页专项裁决 | 按钮样式、方向、位置保持用户认可形态；页码轻量附属于法术书浏览，不撑大栏 | covered |
| 标签放左侧 | 分类标签挤占底部牌列 / 页码空间 | `mage-wars-ui-design-memory` 法术书裁决；设计 README v66 后裁定 | 分类标签在法术书左侧，不能压缩卡牌可读尺寸 | covered |
| 骰子、token 不能省略 | 为了干净删掉规则信息 | `mage-wars-ui-design-memory` 用户原话反思；`rule-to-ui-element-list.md` 规则对象矩阵 | 攻击骰、效果骰、燃烧 token、守卫 / 行动 token 在饱和态可见；伤害状态在受伤对象本体上用受伤遮罩 + 贴宿主剩余 / 总生命读数可见，不强制物理伤害 token 图 | covered |
| 伤害 token 没必要，现代 UI 代替更合适 | 把物理 token 存在机械等同为数字 UI 必须用 token 图，或反过来把现代 UI 误写成任意数字徽章都可用 | `ui-change-gates.md` 规则物件不等于强制贴图；`mage-wars-ui-design-memory` 伤害状态裁决；`rule-to-ui-element-list.md` 伤害状态行 | 伤害作为连续数值状态，默认由对象本体红色受伤遮罩 + 贴宿主剩余 / 总生命读数承载；只有燃烧、守卫、行动等离散状态 / 行动标记继续按 token 物件验收 | covered |
| 守卫必须用 token，伤害可以走现代 UI | 把“token 是否存在”误当成唯一标准，忽略守卫是离散规则身份而伤害是连续累计数值 | `ui-change-gates.md` 规则物件不等于强制贴图、token/角标不盖主体；`mage-wars-ui-design-memory` 用户原话反思表 | 守卫 / 护卫、燃烧、行动准备等可被规则引用的离散状态必须用真实 token 图或等价正式状态物件；伤害必须贴受伤对象本体并可读，但不强制物理 token 图 | covered |
| 护盾、爱心、右下角圆球都不是 Mage Wars 状态语法 | 用通用护盾 / 爱心 icon 或右下角数字球替代真实 token 与生命读数 | `ui-change-gates.md` 规则物件不等于强制贴图；`mage-wars-ui-design-memory` 护盾 / 爱心纠偏；`rule-to-ui-element-list.md` Token / 状态层 | 守卫 / 状态用真实 token 图；能力动作优先来源牌面 / 法师头像 / 正式对象；伤害 / 血量用受伤遮罩 + 剩余 / 总生命读数，不出现通用 SVG 护盾 / 爱心或右下角圆形数字球 | covered |
| 攻击掷骰应该在上层 / 目标附近 | 把结算主体边栏化 | `ui-design-pipeline` 当前结算主体；`step1-runtime-board-saturated-ui-design.md` 结算层 | 骰子、效果骰、伤害、燃烧 token 位于主舞台上层，并锚定来源 / 目标 / 动作链 | covered |
| token / 状态贴对象，不只在日志 | 状态离开宿主，玩家不知道谁受影响 | `step1-runtime-board-saturated-ui-design.md` 行动标记和状态 token；`ui-audit-loop` 保护槽位 | token 不脱离宿主，不压住关键卡面信息，数量或堆叠关系可读 | covered |
| 描边不贴边 | 把用户说的描边几何问题误读成“对象目标是否整格高亮”的语义问题，导致悬浮外扩框仍可能存在 | `ui-change-gates.md` 高亮必须清楚贴合、目标高亮要验几何；`mage-wars-ui-design-memory` 用户原话反思表 | 目标描边必须沿目标卡牌 / 法师本体可见边界；E2E 不能只查绿色存在，必须量目标框与本体四边差值，常规容差不超过 2px | covered |
| 对手计划放左上形成对称 | 隐藏计划法术挂到错误边栏 | `step1-runtime-board-saturated-ui-design.md` 对手计划镜像；`mage-wars-ui-design-memory` | 对手已计划只显示卡背 / 数量，位于左上，和己方计划槽形成席位镜像 | covered |
| 弃牌堆放右侧竖向空位，不能小过头 | 归档入口过小、放错位或抢位 | `mage-wars-ui-design-memory` 弃牌裁决；设计 README v73-v75 裁定 | 弃牌堆位于用户标注右侧空位，尺寸低权重但可识别，不压计划 / 回合结束 / 对手状态 | covered |
| 弃牌堆规则上能看就显示正面 | 公开归档被误画成隐藏信息 | 规则 `page_015.md`；`ui-design-pipeline` 公开归档；`mage-wars-ui-design-memory` | 弃牌堆显示紧凑顶牌正面 / 半露正面 + 数量；点击可展开完整公开弃牌 | covered |
| 卡背只用于隐藏信息 | 用卡背误导公开内容未知 | 规则 `page_015.md`；隐藏结界 `page_020.md`；设计合同隐藏信息边界 | 卡背只用于对手已计划、未公开法术书、隐性结界；公开弃牌不用卡背 | covered |
| 避免边框 / 容器感 / 普通蓝圆 | 壳层和粗糙程序化对象抢走游戏主体 | `ui-design-pipeline` 框体职责与 programmatic UI；`ui-ux.md` 开放式主舞台 | 不出现厚边框、封闭大卡片、无语义黑影、普通蓝圆效果骰；自制 UI 必须有材质和来源裁定 | covered |
| 选中态不要改变布局 | 选中后生成左右特大牌或挤压牌列 | `ui-design-pipeline` 选中态不得改变常驻布局占位；`mage-wars-ui-design-memory` | 选中只用描边、抬升、发光、短状态或临时检视；不改变牌列 / 计划槽尺寸 | covered |
| 用户标注图里的元素不能随意删 | 标注的骰子、token、弃牌、分页等被省略 | `ui-design-pipeline` 用户标注元素守恒；`ui-audit-loop` 用户点名元素逐项审计 | 送验前逐项回答用户标注元素是否仍在、规则名称是什么、若收起入口在哪里 | covered |
| 设计要按数据理解布局 | 只凭感觉看图，不核坐标、尺寸、比例 | `ui-design-pipeline` 空间预算 / 可读性预算；本账本 | 导出 geometry，核卡牌尺寸、弃牌堆尺寸、计划牌比例、压叠、可读性和槽位关系 | covered |
| 视觉肯定先 AI 验收，再人工验收 | 把未通过候选交给用户挑错 | `ui-audit-loop` 自见失败不得送验；`show-image-to-user` final gate | AI 自审发现基础问题时继续重构；只有 AI_PASS 且打开原图后才请用户看 | covered |
| 验收图不能是空态 | E2E 通过但截图缺已计划、弃牌、骰子、状态，导致用户纠正项被技术绿灯掩盖 | `mage-wars-ui-design-memory` 规则到 UI 到实现执行顺序；`e2e-verification.md` 状态型截图口径 | 设计稿 / 真实 Board/UI 送验截图必须构造饱和交互态：法术书 6 张、已计划 2 张、公开弃牌正面、骰子、效果骰、伤害状态、燃烧 / 守卫 / 行动 token、来源和合法目标高亮同时可见；空开局只能作诊断 | covered |
| 每次设计完用用户原话反思 | 审计只看几何 / DOM，不回看用户纠正 | `mage-wars-ui-design-memory` 用户原话反思表；本账本 | 最终审计必须逐条列用户原话自审和本账本自审，不得只报分数 | covered |
| 单个问题不要默认多层规范同时改 | 把问题本质误判成“改了多处”或制造多重真相 | `spec-steward` 多重真相定义；本账本角色声明 | 修改前先裁定 canonical-source / adapter / evidence；审计和本账本只能引用，不各自创造新规则 | covered |
| 规则到 UI 不能靠纠正账本兜底，必须先有对象覆盖矩阵 | 用户没有逐条骂到的规则对象可能继续被遗漏，例如骰子、token、公开弃牌、已计划法术或合法目标高亮 | `mage-wars-ui-design-memory` 规则对象覆盖矩阵；本账本仅作 drift-check / evidence | 设计 / 实现 / 送验前必须列出 foundation 规则对象，每行裁定可见性、实体锚点、素材 / 程序化来源和截图验收方式；无结论行按遗漏处理 | covered |
| 规则到 UI 再到实现不能只看最后一张图 | 规则对象、交互职责和用户纠正项在实现时被遗漏 | `mage-wars-ui-design-memory` 规则到 UI 到实现执行顺序；`generated-design-implementation.md` | 实现前必须重新锁规则对象、唯一实体锚点、主交互链，并逐条把本账本映射到真实 Board/UI 承载位置 | covered |
| 设计稿到实现不能漏掉纠正项 | 只按最后一张图的大致布局实现，容易重新漏骰子、token、公开弃牌堆正面、分页样式或规则术语 | `generated-design-implementation`；`.spec/knowledge/standards/generated-design-implementation.md`；`board-layout-contract.md` | 真实 Board/UI 实现前必须逐项消费本账本；实现截图必须回答每个用户纠正项在图面中的承载、是否可读、是否被省略或误改 | covered |
| 不允许自创未经验证的战棋主交互 | 把单位行动做成全局按钮栏、把结算做成常驻骰盘，脱离正常战棋的单位直选和攻击因果 | `design-system/game-ui/source-families.md` 的“棋盘对象 / 位置直选”“事件驱动主舞台结算”；`design-system/games/mage-wars.md` 的战术单位适配 | 验收图必须同时证明：法师和生物本体可选；合法移动 / 攻击候选只在棋盘；守卫仅在选中单位附近；无常驻动作栏或骰盘；真实攻击事件才短暂出现骰子 | covered-by-runtime-e2e |

## 当前下一稿 / 实现截图送验前最低勾选

- [ ] 规则真相源已在当前轮次实际读取，而不是继承摘要。
- [ ] 已按 `.spec/skills/mage-wars-ui-design-memory/SKILL.md` 的“规则到 UI 到实现执行顺序”锁定规则对象、唯一实体锚点和主交互链。
- [ ] 已建立规则对象覆盖矩阵；foundation 最低对象行都有 `visible`、`collapsed-with-visible-entry`、`hidden-by-rule`、`out-of-scope`、`blocked` 或 `approved-programmatic` 结论。
- [ ] Open Design artifact 路线确认，未调用 media 生图链。
- [ ] `法术书 / 已计划法术 / 弃牌堆 / 隐性结界` 牌区命名无“手牌”。
- [ ] 法术书 6 张可读，计划牌与法术书同尺寸，分页按钮样式未被误改。
- [ ] 对手计划在左上卡背，己方计划在己方槽位，二者席位镜像成立。
- [ ] 弃牌堆在右侧竖向空位，显示正面半露 + 数量，点击语义是公开检视。
- [ ] 攻击骰、效果骰、伤害状态 / 伤害数值、燃烧 token、守卫 / 行动 token 未省略；伤害不强制物理 token 图，但必须贴受伤对象本体并以受伤遮罩 + 生命读数可读，不出现通用护盾 / 爱心或右下角圆形数字球。
- [ ] 设计稿 / 真实 Board/UI 截图是饱和交互态，不是空开局或只证明页面可运行的技术截图。
- [ ] 当前动作由来源对象和棋盘 / 场上对象本体承接，合法目标高亮，不出现无授权常驻确认。
- [ ] 当前玩家提示挂在法师头像 / 角色 HUD；竞技场只保留阶段、区域语义和真实对象高亮，不承载第二个玩家提示条。
- [ ] 法师战场实体 / 法师本体、玩家 / 法师规则提示卡、法师规则 / 提示卡详情已在矩阵中分开命名、分开素材职责、分开验收；当前 v80 基线是竞技场人物本体 + 玩家 HUD 规则提示卡，后续改稿必须说明是否沿用该基线或如何等价替代。
- [ ] 地图是底层承载，不再为了避开地图牺牲法术书、计划牌、弃牌堆或结算层。
- [ ] 没有无职责大空白、厚边框容器、无语义黑影、普通蓝圆或粗糙占位。
- [ ] 几何数据与整屏玩家视角都通过；不能只用“不重叠”证明玩家友好。
- [ ] 审计输出逐条引用本账本，不在审计里新增独立 PASS/FAIL 规则。
- [ ] 若进入真实 Board/UI 实现，最新实现截图已逐项对照 v75 原图、v75 审计、几何证据和本账本；任何漏项都必须判 `REVISE`。
- [ ] 若进入真实 Board/UI 实现，每一条用户纠正都已映射到真实截图里的承载位置；没有承载位置或只由 E2E 文案证明的条目按未覆盖处理。
