# dicethrone-team-mode Specification

## Purpose
TBD - created by archiving change add-dicethrone-2v2-team-mode. Update Purpose after archive.
## Requirements
### Requirement: DiceThrone 2v2 开局能力
系统 SHALL 支持 DiceThrone 以 2 人或 4 人开局；当人数为 4 时，系统 MUST 启用 2v2 团战规则集。

#### Scenario: 4 人房间进入 2v2 模式
- **WHEN** 房主以 4 人创建 DiceThrone 对局
- **THEN** 系统按 2v2 团战规则初始化对局
- **AND** 不得退化为 1v1 规则流程

### Requirement: 站位驱动分队与共享体力
系统 SHALL 在 2v2 模式下采用官方座位分队（1&3 为一队，2&4 为一队），并允许在开局前调整玩家站位；队伍关系 MUST 由当前站位自动推导。站位调整仅允许移动到空位，不允许交换位。系统 MUST 为每队维护共享体力，初始值为 50。

#### Scenario: 使用默认站位开局
- **WHEN** 玩家以 4 人创建 DiceThrone 对局且未调整站位
- **THEN** 系统按默认站位推导分队（1&3 vs 2&4）

#### Scenario: 点击空位移动站位
- **WHEN** 玩家先选中一个已占用位置并点击空位
- **THEN** 系统将该玩家移动到目标空位
- **AND** 队伍关系按新站位自动更新

#### Scenario: 点击已占用位置不交换
- **WHEN** 玩家尝试将已选中玩家移动到另一个已占用位置
- **THEN** 系统 MUST 拒绝交换位并保持原站位

#### Scenario: 开始后锁定站位
- **WHEN** 对局进入正式阶段
- **THEN** 系统 MUST 禁止继续调整站位

#### Scenario: 对队员造成伤害时扣减队伍共享体力
- **GIVEN** 玩家 1 与玩家 3 属于同一队
- **WHEN** 玩家 1 受到 6 点伤害
- **THEN** 该队共享体力减少 6
- **AND** 队伍另一名队员的生命显示与结算同步反映该变化

#### Scenario: 共享体力治疗上限
- **GIVEN** 某队共享体力已恢复到上限
- **WHEN** 该队再次获得治疗
- **THEN** 系统不得使该队共享体力超过“起始体力 + 10”

### Requirement: 队伍交替回合顺序
系统 SHALL 在 2v2 模式下按照“队伍交替”推进回合；起始玩家确定后，后续顺序 MUST 满足同队第二位玩家随后行动，再切换到对方队伍两位玩家。

#### Scenario: 起始玩家为 1 号位
- **GIVEN** 1 号位为起始玩家
- **WHEN** 系统推进 4 个连续回合
- **THEN** 回合顺序为 1→3→2→4

#### Scenario: 起始玩家为 2 号位
- **GIVEN** 2 号位为起始玩家
- **WHEN** 系统推进 4 个连续回合
- **THEN** 回合顺序为 2→4→1→3

### Requirement: 2v2 目标掷骰阶段
系统 SHALL 在 2v2 模式下提供 Targeting Roll Phase，并按 d6 结果决定防御方。

#### Scenario: 掷出 1 或 2
- **WHEN** 进攻方在目标掷骰阶段掷出 1 或 2
- **THEN** 系统将左手边对手设为本次攻击目标

#### Scenario: 掷出 3 或 4
- **WHEN** 进攻方在目标掷骰阶段掷出 3 或 4
- **THEN** 系统将右手边对手设为本次攻击目标

#### Scenario: 掷出 5
- **WHEN** 进攻方在目标掷骰阶段掷出 5
- **THEN** 系统 MUST 要求对手队伍选择由谁成为本次目标

#### Scenario: 掷出 6
- **WHEN** 进攻方在目标掷骰阶段掷出 6
- **THEN** 系统 MUST 允许进攻方自由选择任一对手作为目标

### Requirement: 2v2 目标选择交互流程
系统 SHALL 为 2v2 目标掷骰提供完整交互流程，并在目标确定后立即锁定与回显。

#### Scenario: 掷出 1/2 或 3/4 时自动锁定目标
- **WHEN** 目标掷骰结果为 1/2（左侧）或 3/4（右侧）
- **THEN** 系统自动确定 defenderId
- **AND** UI 展示目标高亮与结果文案

#### Scenario: 掷出 5 时由防守队选择目标
- **WHEN** 目标掷骰结果为 5
- **THEN** 系统打开“防守队选择目标”交互
- **AND** 面板展示 3 个他人目标项供选择

#### Scenario: 掷出 6 时由进攻方选择目标
- **WHEN** 目标掷骰结果为 6
- **THEN** 系统打开“进攻方选择目标”交互
- **AND** 面板展示 3 个他人目标项供选择

#### Scenario: 目标确定后锁定并回显
- **WHEN** 任一目标选择流程完成
- **THEN** 系统写入并锁定 `pendingAttack.defenderId`
- **AND** UI 显示“本次目标”并推进后续流程

### Requirement: 顶部三悬浮窗信息区
系统 SHALL 在 2v2 战斗主界面顶部并排展示 3 个他人悬浮窗，并通过边缘高亮区分敌我。

#### Scenario: 顶部并排展示三个他人悬浮窗
- **WHEN** 玩家进入 2v2 战斗主界面
- **THEN** 顶部固定区域并排展示 3 个他人悬浮窗

#### Scenario: 边缘高亮区分敌我
- **WHEN** 系统渲染顶部悬浮窗
- **THEN** 敌方与友方使用不同边缘高亮样式
- **AND** 用户可直观看出敌我身份

### Requirement: 攻击阶段结束后三目标选择面板
系统 SHALL 在攻击阶段结束后提供目标选择面板：展示 3 个可选目标，样式复用顶部悬浮窗并纵向排列。

#### Scenario: 攻击阶段结束后弹出目标面板
- **WHEN** 玩家结束攻击阶段并进入目标选择
- **THEN** 系统弹出纵向目标面板
- **AND** 面板包含 3 个可点击目标项

#### Scenario: 目标项复用悬浮窗样式
- **WHEN** 系统渲染目标选择项
- **THEN** 目标项复用顶部悬浮窗的视觉样式
- **AND** 仅调整布局为纵向排列

### Requirement: 攻击目标显式化
系统 SHALL 在 2v2 模式下使用显式目标玩家 ID 发起与结算攻击，禁止通过“排除自己后取唯一对手”的推断方式确定目标。

#### Scenario: 攻击仅对显式目标进入防御流程
- **WHEN** 一次攻击已在目标掷骰阶段确定 defenderId
- **THEN** 仅该 defenderId 进入防御掷骰与后续伤害结算
- **AND** 另一名对手不得被错误拉入同一次防御流程

### Requirement: 2v2 干预与防御边界
系统 SHALL 允许队友在合法掷骰窗口干预骰面；系统 MUST 禁止队友默认直接防御或减免队友受到的输出伤害，除非卡牌/效果目标语义明确允许影响任意玩家。系统 MUST 保证同队玩家不会进入同队响应队列（队友不响应队友）。

#### Scenario: 队友可通过改骰卡干预
- **WHEN** 队友在目标掷骰或掷骰响应窗口打出合法改骰效果
- **THEN** 系统允许该效果生效并更新当前骰面

#### Scenario: 队友不可默认替队友减免输出伤害
- **WHEN** 队友尝试使用仅作用于“你”的减伤效果替队友承伤
- **THEN** 系统必须拒绝该结算路径

#### Scenario: 队友不响应队友
- **WHEN** 同队玩家触发响应窗口
- **THEN** 系统不得将另一名同队玩家加入响应队列

### Requirement: 团队胜负判定
系统 SHALL 在 2v2 模式下按队伍共享体力判定胜负。

#### Scenario: 单队体力归零
- **WHEN** 某队共享体力小于等于 0 且另一队大于 0
- **THEN** 系统判定另一队获胜

#### Scenario: 双方同时归零
- **WHEN** 两队共享体力在同一结算窗口内同时小于等于 0
- **THEN** 系统判定平局

### Requirement: 2v2 队友信息可见性
系统 SHALL 在 2v2 模式下允许玩家查看队友手牌；系统 MUST 继续隐藏对手手牌与牌库详情。

#### Scenario: 队友手牌可见
- **WHEN** 玩家查看己方队友视图
- **THEN** 系统展示队友手牌明文信息

#### Scenario: 对手手牌与牌库仍隐藏
- **WHEN** 玩家查看任意对手视图
- **THEN** 系统隐藏对手手牌与牌库详情

### Requirement: 选角界面红框站位面板
系统 SHALL 在 2v2 选角界面右下红框区域提供站位面板，默认显示官方站位，并采用“点击空位移动”这一最简交互。

#### Scenario: 红框面板显示默认站位
- **WHEN** 玩家进入 4 人 2v2 选角界面
- **THEN** 红框面板展示默认站位与对应分队关系

#### Scenario: 红框面板执行点击空位移动
- **WHEN** 房主选中一个已占用位置并点击空位
- **THEN** 系统完成移动并实时更新左/右对手语义

#### Scenario: 红框面板禁止交换位
- **WHEN** 房主选中一个已占用位置并点击另一个已占用位置
- **THEN** 系统不交换位置并提示该操作不支持

### Requirement: 服务端 4 座位创建与入座一致性
系统 SHALL 在 DiceThrone 创建对局时按游戏配置校验人数范围，并在 4 人模式下维护 4 个有效座位的创建、入座与状态切换。

#### Scenario: 非法人数被拒绝
- **WHEN** 客户端提交不在 DiceThrone 允许范围内的人数
- **THEN** 服务端返回参数错误并拒绝创建

#### Scenario: 4 座位全部入座后切换 playing
- **GIVEN** 4 人 DiceThrone 房间处于 waiting
- **WHEN** 第 4 个座位成功 claim-seat
- **THEN** 房间状态切换为 playing

### Requirement: Batch 2 自目标状态交互兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 2 范围内仅限自身的状态交互；共享 UI、验证层与执行层 MUST 共同按真实 self-only 约束工作，不得因为多人模式扩张出额外候选玩家。

#### Scenario: Steadfast II 在 4 人模式下仍只允许移除自己的状态
- **GIVEN** 4 人 / 2v2 对局中狂战士触发 `Steadfast II`
- **WHEN** 系统打开 `remove-status-self` 对应的状态选择交互
- **THEN** 面板只展示狂战士自己的可移除状态 / token
- **AND** 客户端不得提交其他玩家作为 `targetPlayerId`

### Requirement: Batch 2 对手集合效果兼容
系统 SHALL 在 4 人 / 2v2 模式下，按真实敌方集合解析 `allOpponents` 与同类对手集合效果；执行层 MUST 区分“所有对手”与“所有非自己玩家”，不得把 ally 一并纳入。

#### Scenario: Meteor 的 collateral 只命中两名敌方玩家
- **GIVEN** 4 人 / 2v2 对局中炎术士触发 `Meteor`
- **WHEN** 系统结算 `collateral damage`
- **THEN** collateral 只会命中两名敌方玩家
- **AND** 不会误伤施放者本人或其队友

#### Scenario: Ultimate Inferno 的 collateral 在 2v2 下不会退化成“除自己外所有玩家”
- **GIVEN** 4 人 / 2v2 对局中炎术士触发 `Ultimate Inferno`
- **WHEN** 系统同时结算主目标效果与 `collateral damage`
- **THEN** 主目标效果仍按真实 defender 结算
- **AND** collateral 只会命中敌方集合，不会把 ally 一并纳入

### Requirement: Batch 3 多步骰子交互的骰池归属语义兼容
系统 SHALL 在 4 人 / 2v2 模式下，按真实当前骰池归属与观察视角驱动 `modifyDie` / `selectDie` 交互；共享 UI、文案与验证层 MUST 不得继续把“当前不是自己的骰子”压缩成泛化的“对手骰子”。

#### Scenario: 队友干预当前 roller 的骰池时仍保留正确的骰池归属语义
- **GIVEN** 4 人 / 2v2 对局中，当前存在合法的掷骰干预窗口
- **WHEN** 一名非 roller 玩家触发 `modifyDie` 或 `selectDie` 多步骰子交互
- **THEN** 系统按当前 roller 的骰池执行交互
- **AND** UI hint / 元数据不会把该骰池错误地固定描述成“对手骰子”

### Requirement: Batch 3 合法干预窗口与响应队列边界兼容
系统 SHALL 在 4 人 / 2v2 模式下，同时满足“队友可在合法掷骰窗口干预骰面”与“队友不进入同队响应队列”两条边界；共享规则层 MUST 不得把这两条规则误合并成“只有单一对手能发起骰子交互”。

#### Scenario: 队友可合法改骰但不会进入同队响应队列
- **GIVEN** 4 人 / 2v2 对局中，一名玩家正在合法掷骰窗口内操作当前骰池
- **WHEN** 其队友使用可作用于当前骰池的合法改骰效果
- **THEN** 系统允许该效果对当前骰池生效
- **AND** 同队玩家默认仍不会被加入同队 `responderQueue`

#### Scenario: self-only 骰子卡不会因 2v2 自动扩张到队友骰池
- **GIVEN** 4 人 / 2v2 对局中存在共享掷骰干预窗口
- **AND** 一张骰子卡的规则语义仅允许“修改自己的骰子”
- **WHEN** 该卡的使用者尝试把它作用到队友当前正在操作的骰池
- **THEN** 系统不得仅因 2v2 队友关系或共享响应窗口就允许该效果生效
- **AND** 这类 `self-only` 效果仍只允许作用于使用者自己的骰池

### Requirement: Batch 3 代表性多步骰子入口兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持通用 `modifyDie/selectDie` 入口与 `shadow_thief-shadow-manipulation` 这类共享多步骰子交互；共享交互链、验证层与真实页面 MUST 对选择数量和确认语义保持一致。

#### Scenario: Shadow Manipulation 在 4 人模式下保留稳定的多步选骰语义
- **GIVEN** 4 人 / 2v2 对局中暗影盗贼触发 `Shadow Manipulation`
- **WHEN** 当前玩家拥有 `Sneak` 并进入该交互
- **THEN** 系统仍允许按 `2` 颗骰子的语义完成多步修改
- **AND** 不会因为 4 人视角或共享窗口变化而退化成错误的单骰或旧 2 人路径

### Requirement: Batch 1 任意玩家授 token 交互兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“给任意玩家 token”的技能交互；玩家选择面板、验证层与执行层 MUST 共同按真实候选玩家集工作，不得退化为 2 人 `self/opponent` 假设。

#### Scenario: Vengeance II 在 4 人模式下展示完整候选集并授予队友 Retribution
- **GIVEN** 4 人 / 2v2 对局中，圣骑士触发 `Vengeance II`
- **WHEN** 系统打开玩家选择交互
- **THEN** 面板展示所有合法候选玩家，并能稳定区分 `self / ally / enemy`
- **AND** 当玩家选择合法队友并确认后，系统授予该队友 `Retribution`

#### Scenario: Consecrate 在 4 人模式下授予任意玩家多 token
- **GIVEN** 4 人 / 2v2 对局中，圣骑士打出 `Consecrate`
- **WHEN** 玩家选择一名合法目标并确认
- **THEN** 系统 MUST 一次性授予该目标 `Protect / Retribution / Crit / Accuracy`
- **AND** host 页与目标页都能同步观察到相同的 token 结果

#### Scenario: 非法授 token 目标会被验证层拒绝
- **GIVEN** 当前存在“给任意玩家 token”的交互
- **WHEN** 客户端提交不在 `targetPlayerIds` 内的目标玩家
- **THEN** 验证层 MUST 拒绝该命令
- **AND** 不得仅因“存在 pendingInteraction”就默认放行

### Requirement: Batch 1 任意玩家移除状态交互兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“移除 1 个状态 / token”与“移除一名玩家全部可移除状态 / token”的交互；合法目标约束与目标页权威态同步 MUST 一致。

#### Scenario: remove-status-1 只允许选择合法状态拥有者并移除目标效果
- **GIVEN** 4 人 / 2v2 对局中触发 `remove-status-1`
- **WHEN** 系统打开状态拥有者与状态效果选择交互
- **THEN** 面板只展示合法候选玩家及其可移除状态 / token
- **AND** 当玩家确认后，目标效果会从权威状态中被移除

#### Scenario: remove-all-status 会拦截空目标并清空可移除效果
- **GIVEN** 4 人 / 2v2 对局中触发 `remove-all-status`
- **WHEN** 玩家尝试选择没有任何可移除状态 / token 的目标
- **THEN** 确认操作 MUST 保持禁用
- **AND** 当玩家改为选择合法目标并确认后，该目标的所有可移除状态 / token 都会被清空

### Requirement: Batch 1 状态与可移除 token 转移交互兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“从一名玩家转移状态或可移除 token 到另一名玩家”的双阶段交互；共享 UI、验证层与执行层 MUST 一致理解来源玩家、目标玩家与可转移效果。

#### Scenario: Transfer Status 在 4 人模式下以四宫格完成双阶段选择
- **GIVEN** 4 人 / 2v2 对局中触发 `Transfer Status`
- **WHEN** 玩家先完成来源状态 / token 选择，再进入目标玩家选择阶段
- **THEN** 第二阶段仍展示同一组 4 张玩家卡
- **AND** 已选来源玩家卡会以锁定禁用态保留在原位
- **AND** 其余合法目标玩家卡可继续被选择

#### Scenario: Transfer Status 不能把效果转回来源玩家自己
- **GIVEN** 当前存在状态 / token 转移交互
- **WHEN** 客户端把 `toPlayerId` 提交为 `fromPlayerId`
- **THEN** 验证层 MUST 拒绝该命令
- **AND** 不得执行任何状态或 token 转移

#### Scenario: 不可移除 token 不会被 Transfer Status 转移
- **GIVEN** 目标玩家身上同时存在可移除与不可移除 token
- **WHEN** 玩家尝试触发状态 / token 转移
- **THEN** 系统只允许转移可移除状态 / token
- **AND** 不可移除 token 必须被排除在可选与可执行结果之外

### Requirement: Batch 1 无单一敌方目标的无伤害技能流程兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确处理 Batch 1 范围内“无单一敌方目标、但仍会触发玩家交互或 postDamage 效果”的无伤害技能；攻击流程 MUST 按实际效果阻塞与继续，不得误走普通单体攻击分支。

#### Scenario: 无默认 defender 的无伤害技能不会误进 targetingRoll
- **GIVEN** 4 人 / 2v2 对局中触发一个没有默认 defender 的无伤害技能
- **WHEN** 该技能需要进入玩家选择交互
- **THEN** 系统不得因为当前是 4 人模式就强制进入 `targetingRoll`
- **AND** 攻击流程应停在交互前，等待玩家完成选择

#### Scenario: INTERACTION_REQUESTED 会阻塞该类无伤害技能的后续推进
- **GIVEN** 上述技能在 `preDefense` 阶段发出了 `INTERACTION_REQUESTED`
- **WHEN** 交互尚未完成
- **THEN** 攻击流程 MUST 保持阻塞
- **AND** 不得提前推进到后续 phase 或吞掉交互

#### Scenario: 无默认 defender 的无伤害技能仍会执行 postDamage 结果
- **GIVEN** 上述技能交互已完成
- **WHEN** 攻击流程继续结算
- **THEN** 系统仍会执行该技能的 `postDamage` 效果
- **AND** 相关资源或 token 结果会正确写回权威状态

