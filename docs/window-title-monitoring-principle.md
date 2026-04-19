# 窗口标题监控原理详解

## 核心原理

监控窗口标题变化来判断 Kiro 是否还在工作。

### 基本假设

**Kiro 工作时，窗口标题会频繁变化**

例如：
```
"Kiro - 项目名称"
↓
"Kiro - 正在分析代码..."
↓
"Kiro - 正在生成测试..."
↓
"Kiro - 正在写文档..."
```

**如果窗口标题长时间不变，可能是中断了**

---

## 技术实现

### 1. 查找 Kiro 窗口

```powershell
function Find-KiroWindow {
    # 获取所有进程
    $processes = Get-Process | Where-Object { 
        # 筛选窗口标题包含 "Kiro" 的进程
        $_.MainWindowTitle -like "*Kiro*" 
    }
    
    if ($processes.Count -eq 0) {
        return $null  # 未找到
    }
    
    # 返回第一个匹配的进程
    return $processes | Select-Object -First 1
}
```

**工作流程**:
1. `Get-Process` - 获取所有正在运行的进程
2. `Where-Object` - 筛选窗口标题包含 "Kiro" 的进程
3. `MainWindowTitle` - 进程的主窗口标题
4. `-like "*Kiro*"` - 模糊匹配（通配符）

**返回值**:
- `Process` 对象 - 包含进程信息（PID、窗口句柄、标题等）
- `$null` - 未找到 Kiro 窗口

---

### 2. 保存窗口状态

```powershell
function Set-WindowState {
    param([string]$Title)
    
    # 创建状态对象
    $data = @{
        title = $Title                                    # 窗口标题
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")  # 时间戳
    }
    
    # 保存到 JSON 文件
    $data | ConvertTo-Json | Set-Content $StateFile
}
```

**状态文件示例** (`.kiro-smart-state.json`):
```json
{
  "title": "Kiro - 正在分析代码...",
  "timestamp": "2026-03-03 23:45:30"
}
```

**作用**:
- 记录上次检查时的窗口标题
- 记录上次标题变化的时间
- 用于下次检查时对比

---

### 3. 检测中断

```powershell
function Test-Interruption {
    param([System.Diagnostics.Process]$Process)
    
    # 1. 获取当前窗口标题
    $currentTitle = $Process.MainWindowTitle
    
    # 2. 读取上次保存的状态
    $lastState = Get-WindowState
    
    # 3. 首次运行 → 保存状态，不判定为中断
    if ($null -eq $lastState) {
        Set-WindowState -Title $currentTitle
        return $false
    }
    
    # 4. 标题发生变化 → 说明还在工作
    if ($currentTitle -ne $lastState.title) {
        Set-WindowState -Title $currentTitle
        Write-ColorOutput "检测到活动: $currentTitle" "Gray"
        return $false
    }
    
    # 5. 标题未变化 → 检查是否超时
    $timeSinceChange = (Get-Date) - $lastState.timestamp
    $secondsSinceChange = [int]$timeSinceChange.TotalSeconds
    
    if ($secondsSinceChange -gt $Timeout) {
        # 超时 → 判定为中断
        Write-ColorOutput "检测到中断 (${secondsSinceChange}秒无变化)" "Yellow"
        return $true
    }
    
    # 6. 未超时 → 继续等待
    $remaining = $Timeout - $secondsSinceChange
    Write-ColorOutput "等待中... (${secondsSinceChange}/${Timeout}秒)" "Gray"
    return $false
}
```

**判断逻辑**:

```
当前标题 vs 上次标题
    ↓
┌───────────────────────────────────┐
│ 标题变化了？                       │
└───────────────────────────────────┘
    ↓ 是                    ↓ 否
保存新标题              计算时间差
返回 false              ↓
(没有中断)          时间差 > 超时阈值？
                        ↓ 是        ↓ 否
                    返回 true    返回 false
                    (中断了)     (继续等待)
```

---

### 4. 监控循环

```powershell
function Start-Monitoring {
    while ($true) {
        # 1. 查找 Kiro 窗口
        $kiroProcess = Find-KiroWindow
        
        if ($null -eq $kiroProcess) {
            # 未找到窗口 → 等待
            Start-Sleep -Seconds $CheckInterval
            continue
        }
        
        # 2. 检测是否中断
        $isInterrupted = Test-Interruption -Process $kiroProcess
        
        if ($isInterrupted) {
            # 3. 中断了 → 发送 "continue"
            Send-Continue -Process $kiroProcess
        }
        
        # 4. 等待下次检查
        Start-Sleep -Seconds $CheckInterval
    }
}
```

**时间轴示例**:

```
时间    窗口标题                    状态
00:00   "Kiro - 项目名称"           保存状态
00:30   "Kiro - 正在分析代码..."    标题变化 → 保存新状态
01:00   "Kiro - 正在分析代码..."    标题不变 → 等待 (30秒)
01:30   "Kiro - 正在分析代码..."    标题不变 → 等待 (60秒)
02:00   "Kiro - 正在分析代码..."    标题不变 → 等待 (90秒)
02:30   "Kiro - 正在分析代码..."    标题不变 → 超时 (120秒) → 判定中断
        ↓
        发送 "continue"
```

---

## 为什么这个方案不可靠？

### 问题 1: 正常工作时标题也可能不变

**场景**: Kiro 正在深度思考（AI 推理）

```
时间    窗口标题                状态
00:00   "Kiro - 正在思考..."    保存状态
00:30   "Kiro - 正在思考..."    标题不变 (30秒)
01:00   "Kiro - 正在思考..."    标题不变 (60秒)
01:30   "Kiro - 正在思考..."    标题不变 (90秒)
02:00   "Kiro - 正在思考..."    标题不变 (120秒) → 误判为中断
        ↓
        实际：Kiro 还在思考，没有中断
        ↓
        发送 "continue" → 多余的操作
```

### 问题 2: 中断时标题也可能变化

**场景**: 网络中断后，Kiro 显示错误信息

```
时间    窗口标题                    状态
00:00   "Kiro - 正在写代码..."      保存状态
00:30   网络中断
00:31   "Kiro - 网络错误"           标题变化 → 保存新状态
01:00   "Kiro - 网络错误"           标题不变 (29秒)
01:30   "Kiro - 网络错误"           标题不变 (59秒)
02:00   "Kiro - 网络错误"           标题不变 (89秒)
02:30   "Kiro - 网络错误"           标题不变 (119秒)
03:00   "Kiro - 网络错误"           标题不变 (149秒) → 判定中断
        ↓
        实际：00:30 就中断了，但 03:00 才检测到
        ↓
        延迟了 2.5 分钟
```

### 问题 3: 不同任务的标题变化模式不同

| 任务类型 | 标题变化频率 | 是否中断 | 能否检测 |
|---------|-------------|---------|---------|
| 代码生成 | 频繁（每 10 秒） | ❌ 否 | ✅ 可以 |
| 深度思考 | 不变（数分钟） | ❌ 否 | ❌ 误判 |
| 等待用户输入 | 不变 | ❌ 否 | ❌ 误判 |
| 网络中断 | 不变或显示错误 | ✅ 是 | ⚠️ 延迟检测 |

---

## 与定时器方案对比

### 窗口监控方案

```
时间轴：
00:00 - 开始监控
00:30 - 检查标题（变化了 → 没中断）
01:00 - 检查标题（变化了 → 没中断）
01:30 - 检查标题（没变化 → 等待）
02:00 - 检查标题（没变化 → 等待）
02:30 - 检查标题（没变化 → 超时 → 判定中断）
        ↓
        发送 "continue"
```

**问题**:
- ⚠️ 可能误判（正在思考被判定为中断）
- ⚠️ 可能漏判（中断了但标题恰好变化）
- ⚠️ 延迟检测（中断后需要等待超时才能检测到）

### 定时器方案

```
时间轴：
00:00 - 开始监控
00:03 - 发送 "continue"（第 1 次）
00:06 - 发送 "continue"（第 2 次）
00:09 - 发送 "continue"（第 3 次）
...
```

**优势**:
- ✅ 不需要检测（定期发送）
- ✅ 不会漏判（定期发送覆盖所有情况）
- ✅ 不会延迟（固定间隔）

**代价**:
- ⚠️ 可能发送多余的 "continue"（但无害）

---

## 技术细节

### Windows API 调用

```powershell
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@
```

**说明**:
- `DllImport` - 导入 Windows API
- `user32.dll` - Windows 用户界面库
- `SetForegroundWindow` - 激活窗口（置于前台）
- `ShowWindow` - 显示/隐藏窗口

### 键盘模拟

```powershell
# 1. 复制到剪贴板
[System.Windows.Forms.Clipboard]::SetText("continue")

# 2. 激活窗口
[Win32]::SetForegroundWindow($Process.MainWindowHandle)

# 3. 粘贴（Ctrl+V）
[System.Windows.Forms.SendKeys]::SendWait("^v")

# 4. 回车
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
```

**说明**:
- `Clipboard.SetText` - 设置剪贴板内容
- `SendKeys.SendWait` - 模拟键盘输入
- `^v` - Ctrl+V（粘贴）
- `{ENTER}` - 回车键

### 状态持久化

```powershell
# 保存状态
$data = @{ title = "...", timestamp = "..." }
$data | ConvertTo-Json | Set-Content $StateFile

# 读取状态
$data = Get-Content $StateFile -Raw | ConvertFrom-Json
```

**说明**:
- `ConvertTo-Json` - 对象转 JSON
- `ConvertFrom-Json` - JSON 转对象
- `Set-Content` - 写入文件
- `Get-Content` - 读取文件

---

## 总结

### 窗口标题监控原理

1. **查找 Kiro 窗口** - 通过进程列表查找标题包含 "Kiro" 的窗口
2. **保存窗口状态** - 记录当前标题和时间戳
3. **检测标题变化** - 对比当前标题和上次标题
4. **判断是否中断** - 标题长时间不变 → 判定为中断
5. **发送恢复命令** - 激活窗口 + 模拟键盘输入 "continue"

### 为什么不可靠？

- **窗口标题不变 ≠ 中断了**（可能是正在思考）
- **不同任务的标题变化模式不同**（无法统一判断）
- **可能误判和漏判**（不够精确）

### 推荐方案

**夜间无人值守**: 定时器方案（简单可靠，不会漏判）

```bash
powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 5 -MaxRetries 100
```

**白天有人值守**: 智能监控方案（可以看到状态，减少多余发送）

```bash
npm run monitor:kiro:smart
```

---

## 相关文档

- [快速开始](./kiro-auto-resume-quick-start.md)
- [方案对比](./kiro-auto-resume-comparison.md)
- [为什么窗口检测不可靠](./why-window-detection-fails.md)

