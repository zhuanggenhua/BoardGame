# Design: The Gang 数据录入与运行时闭环

## Context
The Gang foundation 已经证明基础版领域逻辑可以跑通，但新游戏流程要求继续闭合“规则数据、素材数据、运行入口、附加能力矩阵”，不能把 foundation 当成整体完成。

## Goals
- 形成可续跑的数据录入合同，而不是只有素材候选列表。
- 用轻量预览/contact sheet 分类外部大图，避免直接读取大图污染上下文。
- 只接入已证明属于基础版运行时的图片资源；未证明语义的素材继续留在候选池。
- 给真实页面验收定义起点、终点和证据路径。
- 将完整 AI、教程、日志、撤销 UI 等从“跳过”升级为明确后续 change 或本轮任务。

## Non-Goals
- 不在本 change 中默认实现所有扩展规则；扩展规则需要独立 change 批准。
- 不把文件名哈希式图片直接当作卡牌/筹码/桌面真相源。
- 不通过假素材、文字牌或低清裁片冒充正式运行时素材。
- 不修复既有 DiceThrone 资源 manifest 漂移；那是独立全局资源基线问题。

## Data Intake Plan
1. Source table: 记录 PDF、DOM、Images 的路径、大小、hash、获取时间和覆盖范围。
2. Preview table: 为图片生成低分辨率 contact sheet，记录每张图的可见用途分类。
3. Contract table: 对进入基础版运行时的对象建立合同，包含原始图、运行时对象、压缩产物、manifest key、验证方式。
4. Conflict table: 规则 PDF、图片、现有实现不一致时单独列出，不在代码里猜补。
5. Implementation matrix: 每个 locked 对象再映射到代码、i18n、资源和测试。

## Runtime Validation Plan
- 入口：从项目真实游戏注册表发现 `the-gang`。
- 起点：进入 The Gang 对局后第一次可操作状态。
- 终点：至少完成一次四轮抢劫并看到成功/失败结算；若本轮无法覆盖终局，必须明确只证明到一次抢劫。
- 证据：定向领域测试 + 真实页面截图/E2E 或等价页面级验证。

## Follow-Up Change Candidates
- `add-the-gang-ai-test-path`: 最低可重复人机测试路径或基础 AI 座位。
- `add-the-gang-tutorial`: 基础教程和规则帮助入口。
- `add-the-gang-action-log`: 记录选筹码、翻牌、摊牌和抢劫结果。
- `add-the-gang-expansions`: 7-10 人、Joker、工具、Dealer、扑克变体等扩展规则。
