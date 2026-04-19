# Kiro 定时器使用说明

## 两个版本

### 测试版（每 10 秒）

**用途**: 快速测试脚本是否正常工作

**命令**:
```bash
npm run monitor:kiro:timer
```

**参数**:
- 间隔: 10 秒
- 最大次数: 5 次（约 50 秒）

**使用场景**:
- 第一次使用，测试脚本是否正常
- 验证 Kiro 窗口能否被找到
- 验证 "continue" 能否正常发送

**测试步骤**:
1. 启动 Kiro
2. 运行测试脚本：`npm run monitor:kiro:timer`
3. 观察输出，确认每 10 秒发送一次
4. 检查 Kiro 是否收到 "continue" 命令
5. 测试通过后，按 Ctrl+C 停止

---

### 正式版（每 30 分钟）

**用途**: 夜间无人值守运行

**命令**:
```bash
npm run monitor:kiro:timer:30min
```

**参数**:
- 间隔: 30 分钟（1800 秒）
- 最大次数: 20 次（约 10 小时）

**使用场景**:
- 夜间长时间运行
- 无人值守自动恢复
- 生产环境使用

**使用步骤**:
1. 启动 Kiro，开始你的任务
2. 运行正式脚本：`npm run monitor:kiro:timer:30min`
3. 观察第一次发送（30 分钟后）
4. 确认正常后，最小化窗口
5. 睡觉 😴

---

## 自定义参数

### 测试版自定义

```bash
# 每 5 秒，最多 10 次
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalSeconds 5 -MaxRetries 10
```

### 正式版自定义

```bash
# 每 15 分钟，最多 40 次（10 小时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer-30min.ps1 -IntervalMinutes 15 -MaxRetries 40

# 每 60 分钟，最多 12 次（12 小时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer-30min.ps1 -IntervalMinutes 60 -MaxRetries 12
```

---

## 输出示例

### 测试版输出

```
============================================
   Kiro Auto-Continue Timer v4.0.0 (TEST)
============================================

⚠️  TEST MODE - Every 10 seconds
Interval: 10 seconds
Max Retries: 5 times

How it works:
  - Automatically send 'continue' every 10 seconds
  - No need to detect interruption
  - True unattended solution

Press Ctrl+C to stop
============================================

Timer started...

Waiting 10 seconds... (23:45:30)
Sending 'continue' (attempt 1/5)...
SUCCESS! Sent 'continue'
Remaining: 4

Waiting 10 seconds... (23:45:40)
Sending 'continue' (attempt 2/5)...
SUCCESS! Sent 'continue'
Remaining: 3

...
```

### 正式版输出

```
============================================
   Kiro Auto-Continue Timer v4.0.0
   Production Mode - Every 30 Minutes
============================================

Interval: 30 minutes (1800 seconds)
Max Retries: 20 times (~10 hours)

How it works:
  - Automatically send 'continue' every 30 minutes
  - No need to detect interruption
  - True unattended solution

Press Ctrl+C to stop
============================================

Timer started...

Waiting 30 minutes... (next at 00:15:30)
Sending 'continue' (attempt 1/20)...
SUCCESS! Sent 'continue'
Remaining: 19

Waiting 30 minutes... (next at 00:45:30)
Sending 'continue' (attempt 2/20)...
SUCCESS! Sent 'continue'
Remaining: 18

...
```

---

## 常见问题

### Q1: 测试版和正式版有什么区别？

**A**: 只有间隔时间和最大次数不同

| 版本 | 间隔 | 最大次数 | 总时长 | 用途 |
|------|------|---------|--------|------|
| 测试版 | 10 秒 | 5 次 | ~50 秒 | 快速测试 |
| 正式版 | 30 分钟 | 20 次 | ~10 小时 | 夜间运行 |

### Q2: 如何知道脚本是否正常工作？

**A**: 观察输出和 Kiro 的反应

1. **脚本输出**: 每次发送都会显示 "SUCCESS" 或 "FAILED"
2. **Kiro 反应**: 观察 Kiro 是否收到 "continue" 命令
3. **计数文件**: 查看 `.kiro-timer-count.json`

```powershell
# 查看计数文件
Get-Content .kiro-timer-count.json

# 输出示例：
# {
#   "count": 3,
#   "lastUpdate": "2026-03-03 23:45:30"
# }
```

### Q3: 测试通过后如何切换到正式版？

**A**: 停止测试版，运行正式版

```bash
# 1. 停止测试版（Ctrl+C）
# 2. 运行正式版
npm run monitor:kiro:timer:30min
```

### Q4: 可以同时运行测试版和正式版吗？

**A**: 不推荐

- 两个脚本会同时发送 "continue"
- 可能造成混乱
- 建议只运行一个

### Q5: 如何重置计数？

**A**: 删除计数文件

```powershell
# 删除计数文件
Remove-Item .kiro-timer-count.json

# 然后重新运行脚本
npm run monitor:kiro:timer:30min
```

### Q6: 30 分钟间隔会不会太长？

**A**: 取决于你的需求

- **30 分钟**: 适合稳定的任务，减少多余发送
- **15 分钟**: 适合不稳定的网络，更快恢复
- **60 分钟**: 适合非常稳定的环境

**推荐**: 先用 30 分钟，如果经常中断，改为 15 分钟

---

## 推荐工作流

### 第一次使用

```bash
# 1. 测试脚本（10 秒版本）
npm run monitor:kiro:timer

# 2. 观察 5 次发送（约 50 秒）
# 3. 确认正常后，停止（Ctrl+C）
# 4. 切换到正式版（30 分钟）
npm run monitor:kiro:timer:30min
```

### 日常使用

```bash
# 直接运行正式版
npm run monitor:kiro:timer:30min
```

### 调试问题

```bash
# 使用测试版快速验证
npm run monitor:kiro:timer
```

---

## 相关文档

- [快速开始](./kiro-auto-resume-quick-start.md) - 5 分钟上手
- [方案对比](./kiro-auto-resume-comparison.md) - 两种方案详细对比
- [窗口监控原理](./window-title-monitoring-principle.md) - 技术实现详解
- [完整文档](./kiro-auto-resume.md) - 所有功能和配置

