# Kiro 自动恢复 - 快速开始

## 你的问题

**问题**: Kiro 执行长任务时，网络中断会导致任务停止，需要手动输入 "continue" 恢复。

**需求**: 夜间无人值守运行，自动检测中断并恢复，最多重试 20 次。

---

## 解决方案

### 方案 1: 定时器方案（推荐 ⭐）

**原理**: 每 N 分钟自动发送 "continue"，不管是否中断

**为什么推荐**:
- ✅ 真正的无人值守（不需要检测）
- ✅ 简单可靠（定时器 + 键盘模拟）
- ✅ 适合夜间运行（设置好就可以睡觉）

**使用方法**:

```bash
# 方法 1: 使用 npm 命令（每 3 分钟，最多 20 次）
npm run monitor:kiro:timer

# 方法 2: 自定义参数（每 5 分钟，最多 100 次 = 8 小时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100
```

**参数说明**:
- `IntervalMinutes`: 发送间隔（分钟），默认 3
- `MaxRetries`: 最大发送次数，默认 20

**示例**:

```bash
# 夜间运行 8 小时（每 5 分钟，100 次）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100

# 短时间运行 1 小时（每 3 分钟，20 次）
npm run monitor:kiro:timer
```

---

### 方案 2: 智能监控（实验性）

**原理**: 监控窗口标题变化，长时间不变则判定为中断

**为什么不是首选**:
- ⚠️ 可能误判（任务正常但标题不变）
- ⚠️ 可能漏判（中断了但标题恰好变化）

**使用方法**:

```bash
# 方法 1: 使用 npm 命令（120 秒超时）
npm run monitor:kiro:smart

# 方法 2: 自定义参数（180 秒超时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-smart-monitor.ps1 -Timeout 180 -MaxRetries 20
```

**参数说明**:
- `CheckInterval`: 检查间隔（秒），默认 30
- `Timeout`: 超时阈值（秒），默认 120
- `MaxRetries`: 最大重试次数，默认 20

---

## 为什么窗口检测不可靠？

### 核心问题

Kiro 的窗口标题变化模式不固定：

| 情况 | 窗口标题 | 是否中断 |
|-----|---------|---------|
| 正在思考 | 不变 | ❌ 否 |
| 等待用户输入 | 不变 | ❌ 否 |
| 网络中断 | 不变 | ✅ 是 |
| 正在写代码 | 频繁变化 | ❌ 否 |
| 任务完成 | 不变 | ❌ 否 |

**结论**: 无法通过窗口标题可靠判断是否中断

### 为什么定时器方案更可靠？

1. **不需要检测**: 定期发送，不管是否中断
2. **不会漏掉**: 即使检测失败，定时器也会发送
3. **简单可靠**: 没有复杂的判断逻辑

**代价**: 可能发送多余的 "continue"（但 Kiro 会忽略）

---

## 完整使用流程

### 步骤 1: 启动 Kiro

正常启动 Kiro，开始你的任务

### 步骤 2: 启动监控脚本

```bash
# 推荐：定时器方案（夜间运行 8 小时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100
```

### 步骤 3: 观察输出

脚本会显示：
```
============================================
   Kiro Auto-Continue Timer v4.0.0
============================================

Interval: 5 minutes
Max Retries: 100 times

How it works:
  - Automatically send 'continue' every 5 minutes
  - No need to detect interruption
  - True unattended solution

Press Ctrl+C to stop
============================================

Timer started...

Waiting 5 minutes... (23:45:30)
```

### 步骤 4: 等待完成

脚本会自动：
1. 每 5 分钟发送一次 "continue"
2. 显示当前进度（第 X/100 次）
3. 达到最大次数后自动停止

### 步骤 5: 查看结果

第二天早上检查：
- Kiro 的任务是否完成
- 脚本是否达到最大次数
- 是否有错误信息

---

## 常见问题

### Q1: 定时器会不会发送太多 "continue"？

**A**: 会，但这是可接受的。

- Kiro 收到多余的 "continue" 时会忽略（如果没有任务在等待）
- 这是无人值守的代价
- 好处是不会漏掉任何中断

### Q2: 如何设置合适的间隔？

**A**: 根据任务类型：

| 任务类型 | 推荐间隔 | 原因 |
|---------|---------|------|
| 快速任务（代码生成） | 2-3 分钟 | 中断后快速恢复 |
| 中等任务（重构） | 3-5 分钟 | 平衡恢复速度和发送频率 |
| 慢速任务（大规模审计） | 5-10 分钟 | 减少多余发送 |

### Q3: 如何设置合适的最大次数？

**A**: 根据运行时长：

```
最大次数 = 运行时长（小时） × 60 / 间隔（分钟）

例如：
- 8 小时，每 5 分钟 → 8 × 60 / 5 = 96 次（设置 100）
- 4 小时，每 3 分钟 → 4 × 60 / 3 = 80 次（设置 80）
- 1 小时，每 3 分钟 → 1 × 60 / 3 = 20 次（设置 20）
```

### Q4: 脚本会不会影响 Kiro 的正常工作？

**A**: 不会。

- 脚本只是发送 "continue" 命令
- Kiro 会判断是否需要继续
- 如果没有任务在等待，Kiro 会忽略

### Q5: 可以在后台运行吗？

**A**: 可以，但不推荐。

```powershell
# 后台运行（隐藏窗口）
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100" -WindowStyle Hidden

# 查看后台进程
Get-Process powershell | Where-Object {$_.CommandLine -like "*kiro-auto-timer*"}

# 停止后台进程
Get-Process powershell | Where-Object {$_.CommandLine -like "*kiro-auto-timer*"} | Stop-Process
```

**不推荐原因**:
- 无法看到实时输出
- 难以判断是否正常工作
- 出问题不容易发现

### Q6: 如何知道脚本是否正常工作？

**A**: 查看输出和计数文件

```powershell
# 查看计数文件
Get-Content .kiro-timer-count.json

# 输出示例：
# {
#   "count": 15,
#   "lastUpdate": "2026-03-03 23:45:30"
# }
```

### Q7: 脚本停止后如何重新开始？

**A**: 直接重新运行即可

```bash
# 脚本会自动加载上次的计数
npm run monitor:kiro:timer

# 或者清除计数重新开始
Remove-Item .kiro-timer-count.json
npm run monitor:kiro:timer
```

---

## 故障排查

### 问题 1: 脚本报错 "无法加载文件"

**原因**: PowerShell 执行策略限制

**解决**:
```powershell
# 临时允许执行
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 然后运行脚本
npm run monitor:kiro:timer
```

### 问题 2: 找不到 Kiro 窗口

**原因**: Kiro 未运行或窗口标题不包含 "Kiro"

**解决**:
1. 确保 Kiro 正在运行
2. 检查窗口标题是否包含 "Kiro"
3. 如果标题不同，修改脚本中的匹配规则

### 问题 3: 发送失败

**原因**: 窗口激活失败或键盘模拟失败

**解决**:
1. 确保 Kiro 窗口没有被其他窗口遮挡
2. 不要在脚本运行时使用键盘
3. 增加延迟时间（修改脚本中的 `Start-Sleep`）

### 问题 4: 达到最大次数但任务未完成

**原因**: 最大次数设置太小

**解决**:
```bash
# 增加最大次数
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 200

# 或者清除计数继续运行
Remove-Item .kiro-timer-count.json
npm run monitor:kiro:timer
```

---

## 最佳实践

### 1. 夜间运行前的准备

```bash
# 1. 确保 Kiro 正常运行
# 2. 启动任务
# 3. 启动监控脚本
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100

# 4. 观察几次发送，确认正常
# 5. 最小化窗口（不要关闭）
# 6. 睡觉 😴
```

### 2. 第二天早上检查

```bash
# 1. 查看 Kiro 任务状态
# 2. 查看脚本输出
# 3. 查看计数文件
Get-Content .kiro-timer-count.json

# 4. 如果任务完成，停止脚本（Ctrl+C）
# 5. 清理计数文件
Remove-Item .kiro-timer-count.json
```

### 3. 多任务运行

```bash
# 不要同时运行多个监控脚本
# 一个 Kiro 窗口只需要一个监控脚本

# 如果有多个 Kiro 窗口，可以运行多个脚本
# 但要确保它们监控不同的窗口
```

---

## 总结

**推荐方案**: 定时器方案

**使用命令**:
```bash
# 夜间运行 8 小时
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100
```

**核心优势**:
- ✅ 真正的无人值守
- ✅ 简单可靠
- ✅ 不会漏掉中断

**代价**:
- ⚠️ 可能发送多余的 "continue"（但无害）

**为什么不用窗口检测**:
- ❌ 无法可靠判断是否中断
- ❌ 可能误判或漏判
- ❌ 依赖窗口标题变化模式

---

## 相关文档

- [方案对比文档](./kiro-auto-resume-comparison.md) - 详细对比三种方案
- [完整文档](./kiro-auto-resume.md) - 所有功能和配置
- [README](../README.md) - 项目主文档

