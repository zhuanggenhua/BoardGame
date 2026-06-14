# smashup-10th-anniversary-factions Specification (delta)

## ADDED Requirements

### Requirement: 系统必须接入 10th Anniversary 三派系的 atlas 与静态数据
系统 SHALL 将 `Mermaids / Skeletons / World Champs` 的 card/base atlas、faction/card/base 元数据、locale 与 UI metadata 正式接入 Smash Up。

#### Scenario: 接入本地 wangling atlas
- **WHEN** `wangling.png` 与 `wangling_base.png` 已通过来源合同校验
- **THEN** 系统 MUST 为其分配正式 atlas 标识与图片路径
- **AND** 系统 MUST 以合同中确认的索引表写入 `previewRef`
- **AND** 系统 MUST 在 faction 选择、卡牌预览与基地预览链路中可见

### Requirement: 系统必须按派系顺序完成正式玩法实现
系统 SHALL 以可审计的逐派系节奏完成 `Mermaids / Skeletons / World Champs` 的能力、交互与基地实现。

#### Scenario: 批量实施三个新派系
- **WHEN** AI 开始实现本轮三派系玩法
- **THEN** 系统 MUST 明确每个派系的完成边界
- **AND** 每完成一个派系，系统 MUST 立即补齐其测试与 evidence
- **AND** 系统 MUST NOT 把“只完成其中一个派系”误报成“三派系全部完成”

#### Scenario: 单派系实施时继续拆分子任务
- **WHEN** 系统开始实施某一个具体派系
- **THEN** 系统 MUST 把该派系拆成“配置复用批 / 新机制与共享扩展批 / 新 UI 与交互 + 对应 E2E 批”
- **AND** 系统 MUST 按批次逐段完成，不得把“仍有未实现批次”的状态说成该派系已完成
- **AND** 若发现共享抽象缺口，系统 MUST 直接做可复用扩展重构并同步测试，而不是留临时代码债务

### Requirement: World Champs 必须被视为混源 one-of deck
系统 SHALL 将 `World Champs` 视为混源 one-of deck，并对每张卡执行“直接复用 / 复制改名 / 全新实现”的显式裁定。

#### Scenario: 评估 World Champs 卡牌复用
- **WHEN** 系统准备实现 `World Champs`
- **THEN** 系统 MUST 逐张核对该卡与当前仓库已有实现的语义关系
- **AND** 系统 MUST NOT 仅因卡名相同就默认直接复用 handler
- **AND** 对于仓库中没有现成实现的来源卡，系统 MUST 提供新的实现或明确 blocker

### Requirement: 三派系交付必须同时包含自动化验证与视觉证据
系统 SHALL 为本轮三派系交付相关 Vitest、E2E 与 evidence，并在涉及资源接入时完成远端资源回查。

#### Scenario: 三派系准备收口
- **WHEN** `Mermaids / Skeletons / World Champs` 均已接入并实现
- **THEN** 系统 MUST 运行相关 Smash Up 测试
- **AND** 系统 MUST 为关键真实交互提供 E2E 与截图证据
- **AND** 若新增 atlas 已进入运行时资源链路，系统 MUST 完成上传与远端可访问性验证
