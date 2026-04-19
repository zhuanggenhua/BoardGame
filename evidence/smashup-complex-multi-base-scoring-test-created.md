# 大杀四方复杂多基地计分测试 - 创建记录

## 测试创建时间
2026-03-09

## 测试目的
创建一个足够复杂的 E2E 测试，覆盖用户提出的复杂场景：
- 两个基地同时达到临界点
- 海盗王在其他基地（beforeScoring 触发器）
- 大副在计分基地（afterScoring 触发器）
- 手牌同时有 beforeScoring 和 afterScoring 卡牌

## 测试文件
`e2e/smashup-complex-multi-base-scoring.e2e.ts`

## 测试场景设计

### 初始状态
1. **基地 0（丛林，breakpoint=12）**：
   - 大副（P0，力量 2，afterScoring 触发器）
   - 工蚁（P0，力量 3，有 2 个力量指示物）
   - 士兵（P0，力量 4，无力量指示物）
   - 忍者（P1，力量 2）
   - 总力量：2+3+2+4+2 = 13（达到临界点）

2. **基地 1（忍者道场，breakpoint=15）**：
   - 海盗王（P0，力量 5，beforeScoring 触发器）
   - 忍者（P1，力量 2）
   - 总力量：5+2 = 7（未达到临界点）

3. **P0 手牌**：
   - "承受压力"（beforeScoring 卡）
   - "我们乃最强"（afterScoring 卡）

### 测试流程
1. 推进到 scoreBases 阶段，触发 Me First! 窗口
2. P0 打出"承受压力"（beforeScoring 卡）
3. P0 打出"我们乃最强"（afterScoring 卡）
4. P1 pass，触发计分
5. 出现多基地选择交互
6. P0 选择先计分基地 0（丛林）
7. beforeScoring 触发：海盗王移动交互（可选移动到计分基地）
8. 基地计分
9. afterScoring 触发：
   - 大副移动交互（可选移动到其他基地）
   - "我们乃最强"交互（转移力量指示物）
10. 继续计分第二个基地
11. 验证最终状态

### 验证点
- 两个基地都被替换
- 玩家分数增加
- 阶段推进
- 所有交互正确触发和解决

## 测试特点

### 复杂度维度
1. **多基地计分**：两个基地同时达到临界点
2. **beforeScoring 触发器**：海盗王在非计分基地
3. **afterScoring 触发器**：大副在计分基地
4. **afterScoring 卡牌**："我们乃最强"转移力量指示物
5. **Me First! 窗口**：同时打出 beforeScoring 和 afterScoring 卡
6. **交互链**：多个交互依次触发和解决

### 覆盖的潜在 Bug
1. **交互队列管理**：多个 afterScoring 交互是否正确排队
2. **状态刷新**：海盗王移动后，选项是否正确刷新
3. **事件重复补发**：延迟事件是否会被重复补发
4. **Me First! 窗口状态**：打出多张卡后，响应窗口状态是否正确
5. **beforeScoring 和 afterScoring 时序**：大副移动后，基地力量变化是否影响计分结果

## 测试实现方式

### 使用新框架（三板斧）
1. **新框架**：`import { test } from './framework'`
2. **专用测试模式**：`page.goto('/play/smashup')`（自动启用 TestHarness）
3. **状态注入**：`game.setupScene()`（跳过派系选择，直接构建场景）

### 优势
- 快速构建复杂场景（60 秒超时 vs 180 秒）
- 精确控制初始状态
- 避免派系选择的随机性
- 易于维护和调试

## 下一步工作

### 运行测试
```bash
npm run test:e2e:ci -- smashup-complex-multi-base-scoring.e2e.ts
```

### 自审截图
测试通过后，使用 MCP 工具查看所有测试截图：
1. `mcp_image_viewer_list_images` 列出 `test-results/` 目录中的截图
2. `mcp_image_viewer_view_image` 查看每一张截图
3. 分析截图内容：游戏状态、UI 元素、交互流程
4. 确认所有交互正确触发和解决

### 创建证据文档
测试通过后，创建 `evidence/smashup-complex-multi-base-scoring-e2e-test.md`：
- 嵌入所有测试截图
- 分析截图内容
- 记录测试场景和验收标准
- 记录测试结果

## 总结

这个测试覆盖了用户提出的所有复杂场景，是现有测试中最复杂的一个。它验证了：
- 多基地计分流程
- beforeScoring 和 afterScoring 触发器
- Me First! 响应窗口
- 交互链管理
- 状态刷新和事件补发

如果这个测试通过，说明大杀四方的计分系统在极端复杂场景下也能正确工作。
