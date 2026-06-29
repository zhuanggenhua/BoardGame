# 幻想国度可选规则与新花色扩展任务

## 0. Approval Gate
- [x] 0.1 用户已确认本轮目标是“幻想国度房间可选规则”，并允许按“新花色扩展 + 二人变体开关，不含诅咒物品”收口

## 1. Spec and setup plumbing
- [ ] 1.1 新增幻想国度 `roomSetup.ts`，定义 setup 字段、默认值、人数联动与公开房间摘要
- [ ] 1.2 新增通用“按 setup 解析允许人数”入口，并接到建房页、本地页、测试页、AI 偏好与服务端建房校验
- [ ] 1.3 更新幻想国度 manifest 与本地化文案，暴露 setup 选项

## 2. Runtime rules
- [ ] 2.1 让幻想国度 domain setup 读取 setupData，而不是只按人数猜双人变体
- [ ] 2.2 接入 `ch_suits` 牌组、替换牌与新花色 suit 合同
- [ ] 2.3 按 setup 切换基础版 / 双人变体 / 新花色扩展的手牌上限、摸牌判定与终局阈值
- [ ] 2.4 扩展计分引擎，覆盖 `CH01`~`CH23` 与替换牌语义

## 3. Verification
- [ ] 3.1 补 room setup / 人数联动 / 公开摘要测试
- [ ] 3.2 补 fantasyrealms 领域与计分测试，覆盖基础版、双人变体与新花色扩展
- [ ] 3.3 运行 `openspec validate add-fantasyrealms-optional-variants --strict --no-interactive`
- [ ] 3.4 运行 fantasyrealms 与相关 room setup 定向测试

## 4. Explicit Non-Goals
- [ ] 4.1 本轮明确不实现 `ch_items` 的抽取、替换回合、面朝下物品与相关 UI
- [ ] 4.2 本轮明确不补扩展卡 atlas，只保证 fallback 卡面和规则可用
