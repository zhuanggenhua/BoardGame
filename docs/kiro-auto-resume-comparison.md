# Kiro 自动恢复方案对比

## 核心问题

**为什么窗口检测不可靠？**

Kiro 是一个 AI IDE，它的窗口标题变化模式取决于：
1. 当前执行的任务类型
2. 任务的进度显示方式
3. 是否有用户交互

**问题在于：**
- ❌ 有些任务执行时窗口标题不变（如长时间思考、等待 API 响应）
- ❌ 有些任务正常完成后窗口标题也不变（如等待用户输入）
- ❌ 无法区分"正在思考"和"已中断"

## 两种方案对比

### 方案 1：定时器方案（推荐 ⭐）

**文件**: `scripts/kiro-auto-timer.ps1`

**原理**: 每 N 分钟自动发送 "continue"，不管 Kiro 是否中断

**优点**:
- ✅ 真正的无人值守（不需要检测任何信号）
- ✅ 简单可靠（定时器 + 键盘模拟）
- ✅ 适合夜间运行（设置好就可以睡觉）
- ✅ 不会漏掉中断（定期发送）

**缺点**:
- ⚠️ 可能发送多余的 "continue"（任务正常时也会发送）
- ⚠️ 需要合理设置间隔（太短浪费，太长可能延迟）

**适用场景**:
- 夜间无人值守运行
- 长时间任务（数小时）
- 网络不稳定环境

**使用方法**:
```bash
# 每 3 分钟发送一次，最多 20 次
npm run monitor:kiro:timer

# 自定义间隔（每 5 分钟）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 20
```

---

### 方案 2：智能窗口监控（实验性 🧪）

**文件**: `scripts/kiro-smart-monitor.ps1`

**原理**: 监控窗口标题变化，长时间不变则判定为中断

**优点**:
- ✅ 只在检测到中断时才发送（更精确）
- ✅ 不会发送多余的 "continue"
- ✅ 可以看到 Kiro 的活动状态

**缺点**:
- ❌ 可能误判（任务正常但标题不变）
- ❌ 可能漏判（中断了但标题恰好变化）
- ❌ 依赖窗口标题变化模式（不同任务不同）

**适用场景**:
- 短时间任务（1-2 小时）
- 需要精确控制的场景
- 调试和测试

**使用方法**:
```bash
# 120 秒无变化视为中断
npm run monitor:kiro:smart

# 自定义超时（180 秒）
powershell -ExecutionPolicy Bypass -File scripts/kiro-smart-monitor.ps1 -Timeout 180 -MaxRetries 20
```

---

## 推荐方案

### 场景 1: 夜间无人值守（8+ 小时）

**推荐**: 定时器方案

```bash
# 每 3 分钟发送一次，最多 20 次（约 1 小时）
npm run monitor:kiro:timer

# 或者更长间隔（每 5 分钟，最多 100 次 = 8 小时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100
```

**理由**:
- 不需要检测，定期发送即可
- 即使 Kiro 正常运行，多发几次 "continue" 也无害
- 可以覆盖整个夜间时段

---

### 场景 2: 白天有人值守（1-2 小时）

**推荐**: 智能窗口监控

```bash
npm run monitor:kiro:smart
```

**理由**:
- 可以看到实时状态
- 只在需要时才发送
- 出问题可以及时介入

---

### 场景 3: 短任务或测试（< 30 分钟）

**推荐**: 手动触发

```bash
# 一键发送 "continue"
powershell -ExecutionPolicy Bypass -File scripts/send-continue.ps1
```

**理由**:
- 任务短，不需要自动化
- 手动控制更灵活
- 避免误操作

---

## 为什么判断"输出停止"很困难？

### 问题 1: 无法访问 Kiro 的内部状态

Kiro 是一个独立的应用程序，外部脚本无法直接访问：
- ❌ Kiro 的日志文件（位置未知）
- ❌ Kiro 的进程状态（是否在思考/等待/中断）
- ❌ Kiro 的网络连接状态

### 问题 2: 窗口标题不可靠

Kiro 的窗口标题变化模式不固定：

| 任务类型 | 标题变化 | 是否中断 |
|---------|---------|---------|
| 正在思考 | 不变 | ❌ 否 |
| 等待用户输入 | 不变 | ❌ 否 |
| 网络中断 | 不变 | ✅ 是 |
| 正在写代码 | 频繁变化 | ❌ 否 |
| 任务完成 | 不变 | ❌ 否 |

**结论**: 无法通过窗口标题可靠判断是否中断

### 问题 3: 没有标准的"心跳"机制

理想情况下，Kiro 应该提供：
- 心跳 API（定期报告状态）
- 状态文件（写入当前状态）
- 日志文件（记录活动）

但 Kiro 目前没有这些机制，所以外部脚本无法可靠检测。

---

## 最佳实践

### 1. 夜间运行：使用定时器方案

```bash
# 启动 Kiro
# 启动定时器（每 5 分钟，最多 100 次 = 8 小时）
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100
```

### 2. 白天运行：使用智能监控

```bash
# 启动 Kiro
# 启动智能监控（120 秒超时）
npm run monitor:kiro:smart
```

### 3. 短任务：手动触发

```bash
# Kiro 停止时，运行一次
powershell -ExecutionPolicy Bypass -File scripts/send-continue.ps1
```

### 4. 组合使用

```bash
# 定时器（兜底） + 智能监控（精确）
# 终端 1
npm run monitor:kiro:timer

# 终端 2
npm run monitor:kiro:smart
```

---

## 常见问题

### Q1: 为什么不能检测 Kiro 的日志？

**A**: Kiro 的日志文件位置和格式未知，且可能没有日志文件。`logs/` 目录下的是游戏服务器的日志，不是 Kiro 的。

### Q2: 定时器方案会不会发送太多 "continue"？

**A**: 会，但这是可接受的。Kiro 收到多余的 "continue" 时会忽略（如果没有任务在等待）。这是无人值守的代价。

### Q3: 智能监控的超时时间怎么设置？

**A**: 
- 快速任务（代码生成）: 60-90 秒
- 中等任务（重构）: 120-180 秒
- 慢速任务（大规模审计）: 300+ 秒

### Q4: 可以同时运行多个监控脚本吗？

**A**: 可以，但不推荐。多个脚本可能同时发送 "continue"，造成混乱。

### Q5: 如何知道脚本是否正常工作？

**A**: 
- 定时器方案：每次发送都会显示 "SUCCESS"
- 智能监控：会显示窗口标题变化和检测状态
- 查看计数文件：`.kiro-timer-count.json` 或 `.kiro-smart-count.json`

---

## 技术细节

### 为什么用 PowerShell 而不是 Node.js？

**原因**:
1. 需要模拟键盘输入（SendKeys API）
2. 需要激活窗口（Win32 API）
3. PowerShell 可以直接调用 Windows API
4. Node.js 需要额外的 native 模块（如 robotjs）

### 为什么用剪贴板而不是直接输入？

**原因**:
1. SendKeys 对中文支持不好
2. 剪贴板 + Ctrl+V 更可靠
3. 可以发送任意文本（包括多行）

### 为什么不用 AutoHotkey？

**原因**:
1. 需要额外安装
2. PowerShell 是 Windows 内置的
3. 功能足够满足需求

---

## 总结

| 方案 | 可靠性 | 精确性 | 适用场景 |
|-----|-------|-------|---------|
| 定时器 | ⭐⭐⭐⭐⭐ | ⭐⭐ | 夜间无人值守 |
| 智能监控 | ⭐⭐⭐ | ⭐⭐⭐⭐ | 白天有人值守 |

**推荐**: 
- 夜间运行 → 定时器方案
- 白天运行 → 智能监控
- 短任务 → 手动触发

**核心原则**: 
- 无法可靠检测 Kiro 的状态
- 定期发送是最可靠的无人值守方案
- 智能检测可以减少多余发送，但可能漏判

