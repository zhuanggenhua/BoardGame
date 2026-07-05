## 0. Approval Gate
- [x] 0.1 Approval Gate：`add-the-gang-foundation` 的 proposal / design / tasks / spec delta 明确支持 The Gang 基础版完整闭环中的 foundation 边界：基础版 3-6 人、4 轮抢劫、德州扑克牌力、3 成功/3 失败、隐藏手牌、Board、manifest、i18n、缩略图；7-10 人、Joker、工具牌、Dealer、挑战/专家卡和其它扑克变体明确属于后续扩展，不阻塞基础版完成。用户已明确本轮判断口径是“不是所有扩展，而是全部基本功能都能完成”，因此本 Approval Gate 按基础版完整闭环范围关闭。

## 1. Intake & Contracts
- [x] 1.1 创建独立工作树并锁定 `feat/the-gang`
- [x] 1.2 将 The Gang 规则 PDF 转为可检索 Markdown
- [x] 1.3 建立需求对齐表与规则摘录文档
- [x] 1.4 建立素材候选清单，记录来源路径、大小、用途与准入状态

## 2. Foundation
- [x] 2.1 新增 `src/games/the-gang/` 目录骨架
- [x] 2.2 新增 manifest、thumbnail、audio config、tutorial 基础入口
- [x] 2.3 新增 i18n namespace：`game-the-gang`
- [x] 2.4 新增基础资源目录并接入压缩缩略图
- [x] 2.5 运行 `npm run generate:manifests`

## 3. Gameplay Core
- [x] 3.1 建立标准 52 张扑克牌、洗牌、发牌与公共牌推进
- [x] 3.2 实现 4 轮筹码选择与换筹码规则
- [x] 3.3 实现德州扑克牌型评估与平手比较
- [x] 3.4 实现抢劫成功/失败与 3 成功/3 失败胜负
- [x] 3.5 实现 `playerView`，隐藏非本人底牌直到摊牌

## 4. Board UI
- [x] 4.1 建立基础牌桌布局，展示公共牌、筹码池、玩家区
- [x] 4.2 接入筹码选择、推进轮次、摊牌、下一次抢劫按钮
- [x] 4.3 增加规则/状态短提示，避免主 UI 常驻长说明正文
- [x] 4.4 覆盖桌面与移动横屏基础布局

## 5. Verification
- [x] 5.1 添加领域层 smoke 与牌型评估测试
- [x] 5.2 添加 3 人完整抢劫流程测试
- [x] 5.3 验证 manifest 生成和游戏注册
- [x] 5.4 运行定向测试并记录结果

## Out Of Foundation Scope
- [x] S.1 7-10 人扩展、exit chips、0/7/8 星筹码（本 change 明确跳过）
- [x] S.2 挑战卡、专家卡、Joker、工具牌、Dealer 和其它扑克变体（本 change 明确跳过）
- [x] S.3 完整 AI、教程、action-log、undo UI（本 change 明确跳过）
