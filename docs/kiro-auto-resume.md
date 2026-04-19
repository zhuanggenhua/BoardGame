# Kiro 自动恢复系统

## 概述

Kiro 自动恢复系统用于夜间无人值守运行，当 Kiro 因网络中断停止时，自动发送 "continue" 命令恢复任务。

## 两种方案

### 方案 1: 定时器方案（推荐 ⭐）

**原理**: 每 N 分钟自动发送 "continue"，不管是否中断

**优势**:
- ✅ 真正的无人值守（不需要检测）
- ✅ 简单可靠（定时器 + 键盘模拟）
- ✅ 适合夜间运行（设置好就可以睡觉）
- ✅ 不会漏掉中断

**使用方法**:
```bash
# 每 3 分钟，最多 20 次
npm run monitor:kiro:timer

# 自定义参数（每 5 分钟，最多 100 次 = 8 小时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100
```

---

### 方案 2: 智能监控方案（实验性）

**原理**: 监控窗口标题变化，长时间不变则判定为中断

**优势**:
- ✅ 只在检测到中断时才发送（更精确）
- ✅ 可以看到 Kiro 的活动状态

**劣势**:
- ⚠️ 可能误判（任务正常但标题不变）
- ⚠️ 可能漏判（中断了但标题恰好变化）

**使用方法**:
```bash
# 120 秒无变化视为中断
npm run monitor:kiro:smart

# 自定义超时（180 秒）
powershell -ExecutionPolicy Bypass -File scripts/kiro-smart-monitor.ps1 -Timeout 180 -MaxRetries 20
```

---

## 快速开始

### 夜间运行（推荐）

```bash
# 启动 Kiro，开始你的任务
# 然后运行定时器脚本（每 5 分钟，100 次 = 8 小时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100
```

### 白天运行

```bash
# 启动 Kiro，开始你的任务
# 然后运行智能监控脚本
npm run monitor:kiro:smart
```

---

## 参数说明

### 定时器方案参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `IntervalMinutes` | 发送间隔（分钟） | 3 |
| `MaxRetries` | 最大发送次数 | 20 |

### 智能监控参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `CheckInterval` | 检查间隔（秒） | 30 |
| `Timeout` | 超时阈值（秒） | 120 |
| `MaxRetries` | 最大重试次数 | 20 |

---

## 常见问题

### Q1: 定时器会不会发送太多 "continue"？

**A**: 会，但这是可接受的。Kiro 收到多余的 "continue" 时会忽略（如果没有任务在等待）。这是无人值守的代价。

### Q2: 如何设置合适的间隔？

**A**: 根据任务类型：

| 任务类型 | 推荐间隔 |
|---------|---------|
| 快速任务（代码生成） | 2-3 分钟 |
| 中等任务（重构） | 3-5 分钟 |
| 慢速任务（大规模审计） | 5-10 分钟 |

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

**A**: 不会。脚本只是发送 "continue" 命令，Kiro 会判断是否需要继续。如果没有任务在等待，Kiro 会忽略。

### Q5: 如何知道脚本是否正常工作？

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

### 问题 3: 发送失败

**原因**: 窗口激活失败或键盘模拟失败

**解决**:
1. 确保 Kiro 窗口没有被其他窗口遮挡
2. 不要在脚本运行时使用键盘

---

## 相关文档

- [快速开始](./kiro-auto-resume-quick-start.md) - 5 分钟上手
- [方案对比](./kiro-auto-resume-comparison.md) - 两种方案详细对比
- [为什么窗口检测不可靠](./why-window-detection-fails.md) - 技术原理

