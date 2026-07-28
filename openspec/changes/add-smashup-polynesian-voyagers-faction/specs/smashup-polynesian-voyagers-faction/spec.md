## ADDED Requirements

### Requirement: Smash Up SHALL register Polynesian Voyagers as a complete playable faction

系统 SHALL 将波利尼西亚航海者注册为独立、可选择、可初始化且可完整结算的 Smash Up 派系。

#### Scenario: Polynesian Voyagers appears in the formal faction picker

- **WHEN** 玩家打开正式派系选择入口
- **THEN** 系统 MUST 显示波利尼西亚航海者
- **AND** 该派系 MUST 使用 `POLYNESIAN_VOYAGERS` faction ID、独立 card/base IDs、locale 和 faction metadata

#### Scenario: Polynesian Voyagers initializes with exact deck composition

- **WHEN** 波利尼西亚航海者被选入玩家牌库
- **THEN** 系统 MUST 构建恰好 20 张实体牌
- **AND** 莫艾 MUST 有 4 张
- **AND** 蒂基 MUST 有 3 张
- **AND** 寻路者 MUST 有 2 张
- **AND** 毛伊人 MUST 有 1 张
- **AND** 八种行动牌 MUST 合计 10 张
- **AND** 该派系 MUST 将岛链、岛峰和热带天堂 3 张基地加入基地池

### Requirement: Polynesian Voyagers SHALL use auditable card and shared base atlas contracts

系统 SHALL 使用用户提供的 3 行 × 4 列卡牌图集和既有《文化冲击》共享基地 atlas，并保持槽位、资源路径、manifest、PR 文件和运行时引用可追溯。

#### Scenario: Card atlas slots map to Polynesian Voyagers unique cards

- **WHEN** 系统解析波利尼西亚航海者卡图
- **THEN** 槽位 `0-11` MUST 按 row-major 顺序映射用户图中的 12 张唯一卡面
- **AND** 每张运行时 card definition MUST 使用对应 `previewRef.index`
- **AND** 图集源图、压缩 WebP 和 manifest 条目 MUST 随 PR 一并提交或明确说明为何被 Git 忽略但已发布到服务器素材主源

#### Scenario: Existing Culture Shock base atlas is reused

- **WHEN** 系统注册波利尼西亚航海者基地
- **THEN** 岛链 MUST 使用共享基地 atlas 槽位 `8`
- **AND** 岛峰 MUST 使用共享基地 atlas 槽位 `9`
- **AND** 热带天堂 MUST 使用共享基地 atlas 槽位 `10`
- **AND** 系统 MUST NOT 新增重复的波利尼西亚基地 atlas ID、资源路径或 manifest key

### Requirement: Every Polynesian Voyagers printed clause SHALL resolve through the authoritative runtime

系统 SHALL 将波利尼西亚航海者每张卡牌和基地的规则子句实现到最终权威状态，而不是只完成静态展示或交互入口。

#### Scenario: Movement-to-empty-base effects resolve

- **WHEN** 玩家使用寻路者、毛伊人、海洋纹身、部落的成长或火山爆发等移动到目标基地的能力
- **THEN** 系统 MUST 只允许规则文本允许的移动目标
- **AND** 对需要“你没有随从的基地”的效果 MUST 排除已有己方随从的基地
- **AND** 对应 +1 力量指示物、额外打出或后续清理 MUST 落入最终权威状态

#### Scenario: Tattoo actions and ongoing modifiers resolve

- **WHEN** 玩家把纹身行动打在随从身上
- **THEN** 系统 MUST 正确记录行动附着、持续力量修正、起始回合触发、天赋移动和计分后特殊保留
- **AND** 太阳纹身的计分后特殊 MUST 只允许打在该基地上没有行动的己方随从身上，并把它移动到另一基地来代替进入弃牌堆

#### Scenario: Extra base and base abilities resolve

- **WHEN** 毛伊人、火山爆发或岛链创建额外基地，或岛峰、热带天堂检查自身能力
- **THEN** 系统 MUST 按规则从基地牌库打出/替换基地或调整断点
- **AND** 测试 MUST 验证基地数量、断点、VP、触发时机和最终状态

### Requirement: Polynesian Voyagers delivery SHALL satisfy validation, upload and PR gates

系统 SHALL 在交付波利尼西亚航海者前完成 intake evidence、自动化验证、资源上传、远端回查、提交推送和 PR 创建。

#### Scenario: The faction is ready for PR

- **WHEN** 本 change 准备提交并打开 PR
- **THEN** 定向 Vitest、相关审计测试、i18n check、typecheck 和 OpenSpec strict validation MUST 通过，或将失败明确登记为当前 blocker
- **AND** 真实入口 E2E MUST 覆盖派系可选、资源可见和至少一条代表 movement/tattoo 交互链
- **AND** 代表截图 MUST 没有 atlas shimmer、白板卡面或错误槽位
- **AND** 资源服务器代表 URL MUST 返回成功响应，除非环境阻塞已在最终汇报中明确列出
- **AND** PR MUST 包含本轮图集资源、manifest、实现代码、测试与 evidence 改动
