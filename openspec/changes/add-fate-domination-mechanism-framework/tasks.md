## 1. Proposal / evidence
- [ ] 1.1 审阅现有 `add-fate-domination-foundation` 与相关 engine changes，确认不重复已有机制内核。
- [ ] 1.2 固化重点机制族矩阵：阶段/资源、战斗、持续修正、规则改写、复制/借用、控制权/所有权、替代/防止、隐藏信息、多步选择、延迟/嵌套和终局。
- [ ] 1.3 为每类机制锁定唯一 owner、输入合同、输出事件和验证入口；不得用零散抽样掩盖机制族缺口。

## 2. Contract design
- [ ] 2.1 定义 Fate mechanism manifest / registry 只做能力边界声明，不成为第二套规则真相。
- [ ] 2.2 定义 Fate `ObjectRef / provenance / ZoneRef / modifier / lifecycle` 适配边界。
- [ ] 2.3 定义 TimingPoint / Opportunity / ChoiceRequest / ResponseWindow / ResolutionFrame 的 Fate 映射表。
- [ ] 2.4 定义战斗、资源、隐藏信息、淘汰和终局的 domain contract。
- [ ] 2.5 建立权限矩阵、命令-事件消费表和机制审计清单。
- [ ] 2.6 定义规则改写合同：限制、抑制、保护、替代、阻止、重算、临时规则和恢复顺序。
- [x] 2.6a 先落地已锁定的移动/地点查询：常规移动、效果移动、进出地点、交战豁免、路径成本和特殊攻击禁用。
- [ ] 2.7 定义复制/借用合同：被复制对象、复制模式、执行控制者、成本/次数、目标重绑定、递归深度和循环阻断。
- [ ] 2.8 定义 owner/controller/holder/sourceController 的分离与跨区快照规则，覆盖被借用的持续能力和控制权转移。
- [ ] 2.9 定义代理/变体/替身对象合同：打印定义、运行时实例、来源对象和当前承载对象不能互相冒充。

## 3. Runtime implementation after approval
- [ ] 3.1 先实现 S1 基础流程与共享 view/visibility seam。
- [ ] 3.2 实现 S2 攻击/战斗 frame，接入 modifier 和 EventCommit。
- [ ] 3.3 实现 S3 能力 registry、effect adapter、主动/被动能力消费，以及持续规则修正和复制上下文。
- [ ] 3.4 实现 S4 响应、替代、防止和父子 frame 恢复。
- [ ] 3.5 实现 S5 淘汰、终局、战果 tie-break 和 gameover 收口。

## 4. Verification
- [ ] 4.1 为每个机制族增加最小正向、拒绝、跳过/取消和恢复路径测试。
- [ ] 4.2 增加跨游戏框架回归：Ability、ChoiceRequest、ResponseWindow、ResolutionFrame、EffectGateway。
- [ ] 4.3 为 Fate 真实入口建立机制 smoke flow 和代表性 E2E 证据。
- [ ] 4.4 运行 `openspec validate add-fate-domination-mechanism-framework --strict --no-interactive`、类型检查与相关 Vitest。
- [ ] 4.5 为规则改写、复制/借用、控制权变化、代理对象分别增加正向、拒绝、递归/循环和跨回合恢复测试。

## 5. Explicitly skipped
- [ ] 5.1 本 change 不改设计稿与 Board 视觉实现。
- [ ] 5.2 本 change 不补全全部卡牌/局势/事件的中文全文。
- [ ] 5.3 本 change 不交付完整 AI 策略、教程、音频或生产资源发布。
