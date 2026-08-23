# 场景注入测试指南

本文只说明 E2E 中如何看待状态注入。真实链路资格以 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md) 为准；TestHarness API 见 [`testing-tools-quick-reference`](testing-tools-quick-reference.md)。

## 分类边界

- 真实 E2E：只能通过玩家可执行的 UI 动作、页面控件和合法系统结算推进。
- 场景注入测试：通过 TestHarness、fixture、服务端测试注入或代表态构造局面，用来验证局部合同、边界状态或回归位点。

只要测试写入核心状态、骰子、随机数或领域命令跳点，就不能登记为主黄金链或连续真实 E2E。

## 允许用途

- 快速构造复杂中盘、近终局或非法分支。
- 消除随机性，稳定复现特定骰子、抽牌或洗牌结果。
- 在局部 UI / 状态合同已实现后，验证可见结果和拒绝分支。
- 缩短调试循环，再用真实入口或低层测试补齐证明。

## 不允许用途

- 用注入替代玩家动作来宣称“用户真实链路已完成”。
- 用 fixture 换段、状态替换或多次桥接登记主黄金链。
- 注入后不等待、不断言，直接把工具调用当作成功。
- 把调试 helper 的存在当成正式 UI 可触发。

## 当前入口

- TestHarness：[`testing-tools-quick-reference`](testing-tools-quick-reference.md)。
- E2E 总指南：[`e2e-testing-guide`](e2e-testing-guide.md)。
- 命令和截图产物：[`automated-testing`](automated-testing.md)。
