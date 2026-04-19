# Splendor 教程 E2E 证据

更新时间：2026-03-28

## 文档定位

- 本文档对应 [splendor-feature-matrix.md](./splendor-feature-matrix.md) 中“教程步骤：购买/贵族/终局说明”的证据沉淀。
- 本文档只记录教程闭环相关的专门 E2E。

## 对应总表条目

- 教程步骤：购买/贵族/终局说明
- 拿 3 色宝石

## 覆盖范围

本文件覆盖教程链路中的以下内容：

1. 教程从开场说明推进到新增说明步骤
2. 购买发展卡说明步骤
3. 贵族结算时机说明步骤
4. 终局与平分规则说明步骤

## 对应用例与命令

```bash
npm run test:e2e:ci:file -- e2e/splendor.e2e.ts "Splendor：教程应覆盖购买 贵族与终局说明步骤"
```

## 自动化结果

- 教程专门 E2E：1/1 通过
- Splendor 全量 E2E：11/11 通过

## 证据截图

<a id="tutorial-buy-endgame"></a>
- `test-results/evidence-screenshots/splendor.e2e/Splendor：教程应覆盖购买-贵族与终局说明步骤/splendor-tutorial-buy-step.png`
- `test-results/evidence-screenshots/splendor.e2e/Splendor：教程应覆盖购买-贵族与终局说明步骤/splendor-tutorial-endgame-step.png`

## 验证点

### 1. 教程推进能力

- 教程可从 `intro` 连续推进到 `finish`。
- 中途包含 `take-gems-action` 的真实操作步骤，不是纯文案播放。

### 2. 购买说明步骤

- 教程推进到 `buy-action`。
- 截图展示购买说明文案与市场区高亮关系。

### 3. 贵族时机说明

- 教程推进到 `noble-timing`。
- 文案强调贵族在回合收尾自动判定，而不是主动点击获得。

### 4. 终局说明步骤

- 教程推进到 `endgame-detail`。
- 截图展示终局触发、同轮结束和平分裁定说明。

## 备注

- 本文档与 [splendor-feature-matrix.md](./splendor-feature-matrix.md) 保持一一对应。
- 本文档只记录教程专用证据，不重复展开主玩法与资源映射工具证据。
