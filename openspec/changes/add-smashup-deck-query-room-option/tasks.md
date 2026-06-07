## 1. Spec And Data Contract

- [x] 1.1 为大杀四方新增 `余牌查询` 房间设置项，并定义默认开启的 setup 合同。
- [x] 1.2 为大厅房间广播补充“公开 setup 摘要”合同，只携带可公开的扩展信息。

## 2. SmashUp Runtime

- [x] 2.1 调整大杀四方 setup/状态读取，让 `余牌查询` 房间开关进入运行时可读状态。
- [x] 2.2 调整牌库区 UI，在 `余牌查询` 关闭时隐藏精确余牌查询能力，在开启时保持现有行为。

## 3. Lobby UI

- [x] 3.1 在创建房间弹窗接入 `余牌查询` 配置项。
- [x] 3.2 在大厅房间卡片展示已开启扩展摘要，tag 文案显示完整扩展名。

## 4. Verification

- [x] 4.1 为 setup 解析、lobby payload/房间列表摘要补充单测。
- [x] 4.2 为大杀四方新增或更新端到端测试，覆盖“余牌查询关闭/开启”“对手视角余牌查询”和“房间扩展 tag 展示”。
- [x] 4.3 运行 `openspec validate add-smashup-deck-query-room-option --strict --no-interactive`。
