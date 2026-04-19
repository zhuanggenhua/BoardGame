# 大杀四方 - After Scoring 重新计分测试创建

## 创建日期
2026-03-04

## 测试文件
`src/games/smashup/__tests__/afterScoring-rescoring.test.ts`

## 测试场景

### 1. 基本重新计分测试
**场景**：力量变化后重新计分

**步骤**：
1. 设置初始状态：基地达到临界点，p0 有"我们乃最强"卡牌
2. 推进到 scoreBases 阶段
3. 所有玩家 pass beforeScoring 响应窗口
4. 验证第一次 BASE_SCORED 事件
5. p0 打出"我们乃最强"，转移指示物（从 m1 转移 2 个到 m2）
6. 所有玩家 pass afterScoring 响应窗口
7. 验证第二次 BASE_SCORED 事件（重新计分）
8. 验证排名变化
9. 验证 BASE_CLEARED 和 BASE_REPLACED 在重新计分后发出

**预期结果**：
- 应该有两次 BASE_SCORED 事件
- 第二次计分的排名与第一次不同
- BASE_CLEARED 和 BASE_REPLACED 在重新计分后发出

### 2. 无力量变化测试
**场景**：打出 afterScoring 卡牌但不影响该基地力量

**步骤**：
1. 设置初始状态：基地达到临界点，p0 有 afterScoring 卡牌（但不影响该基地力量）
2. 推进到 scoreBases 阶段
3. 所有玩家 pass beforeScoring 响应窗口
4. 验证第一次 BASE_SCORED 事件
5. p0 打出 afterScoring 卡牌（不影响该基地力量）
6. 所有玩家 pass afterScoring 响应窗口
7. 验证只有一次 BASE_SCORED 事件（不重新计分）
8. 验证 BASE_CLEARED 和 BASE_REPLACED 正常发出

**预期结果**：
- 应该只有一次 BASE_SCORED 事件
- BASE_CLEARED 和 BASE_REPLACED 正常发出

**注意**：这个测试需要一个不影响该基地力量的 afterScoring 卡牌。如果没有这样的卡牌，可以跳过这个测试。

### 3. 多玩家力量变化测试
**场景**：三个玩家，力量变化后重新计分，排名正确

**步骤**：
1. 设置初始状态：三个玩家，基地达到临界点
2. 推进到 scoreBases 阶段
3. 所有玩家 pass beforeScoring 响应窗口
4. 验证第一次计分排名（p0 第一，p1 第二，p2 第三）
5. p0 打出"我们乃最强"，转移指示物（从 m1 转移 2 个到 m3）
6. 所有玩家 pass afterScoring 响应窗口
7. 验证第二次计分排名（p2 第一，p1 第二，p0 第三）
8. 验证 VP 分配正确（根据新的排名）

**预期结果**：
- 应该有两次 BASE_SCORED 事件
- 第二次计分的排名与第一次不同
- VP 分配正确（p2 > p0）

## 测试实现注意事项

### 1. "我们乃最强"卡牌实现
测试假设"我们乃最强"卡牌的实现如下：
- `defId`: `'alien_we_are_the_champions'`
- `specialTiming`: `'afterScoring'`
- 效果：转移指示物从一个随从到另一个随从

**需要确认**：
- 卡牌 defId 是否正确
- 交互实现是否正确（如何选择源随从和目标随从）
- 交互 ID 是什么

### 2. GameTestRunner API
测试使用 `GameTestRunner` API：
- `applyState()`: 设置初始状态
- `command()`: 执行命令
- `respond()`: 响应交互
- `getEvents()`: 获取所有事件
- `getState()`: 获取当前状态

**需要确认**：
- `respond()` 的参数格式是否正确
- 交互 ID 是否需要显式指定

### 3. 测试数据
测试使用的卡牌和基地：
- 基地：`'the_homeworld'`（外星人母舰）
- 随从：`'alien_invader'`、`'ninja_shinobi'`、`'zombie_walker'`
- 行动卡：`'alien_we_are_the_champions'`（我们乃最强）

**需要确认**：
- 这些 defId 是否正确
- 基地的 breakpoint 是否足够低（能被测试中的随从达到）

## 下一步工作

1. ⏳ 确认"我们乃最强"卡牌的实现细节
2. ⏳ 运行测试并修复错误
3. ⏳ 添加更多边界条件测试
4. ⏳ 创建 E2E 测试（使用 Playwright）

## 测试运行命令

```bash
# 运行单个测试文件
npm run test -- afterScoring-rescoring.test.ts

# 运行所有 SmashUp 测试
npm run test -- smashup
```

## 预期问题

1. **"我们乃最强"卡牌可能尚未实现**：
   - 如果卡牌尚未实现，测试会失败
   - 需要先实现卡牌，或使用其他 afterScoring 卡牌

2. **交互实现可能不同**：
   - 测试假设的交互格式可能与实际实现不同
   - 需要根据实际实现调整测试

3. **GameTestRunner API 可能不支持某些操作**：
   - 例如：`respond()` 可能需要不同的参数格式
   - 需要查看 GameTestRunner 的文档或源码

## 总结

已创建 afterScoring 重新计分功能的单元测试，包含三个测试场景：
1. 基本重新计分（力量变化）
2. 无力量变化（不重新计分）
3. 多玩家力量变化（排名正确）

下一步需要确认卡牌实现细节并运行测试。
