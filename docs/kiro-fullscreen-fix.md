# Kiro 全屏状态保持修复

## 问题

之前的脚本每次发送 "continue" 时，都会将 Kiro 从全屏状态恢复为正常窗口大小。

## 原因

使用了 `ShowWindow` 函数的 `SW_RESTORE` (9) 参数，这个参数会：
- 将最小化的窗口恢复为正常大小 ✅
- 将最大化/全屏的窗口恢复为正常大小 ❌

## 解决方案

### 修改前

```powershell
# 总是调用 ShowWindow(9)，会取消全屏
[Win32]::ShowWindow($Process.MainWindowHandle, 9) | Out-Null
[Win32]::SetForegroundWindow($Process.MainWindowHandle) | Out-Null
```

### 修改后

```powershell
# 先检查窗口是否最小化
if ([Win32]::IsIconic($Process.MainWindowHandle)) {
    # 只有最小化时才恢复
    [Win32]::ShowWindow($Process.MainWindowHandle, 9) | Out-Null
}

# 激活窗口（不改变窗口状态）
[Win32]::SetForegroundWindow($Process.MainWindowHandle) | Out-Null
```

## Windows API 说明

### ShowWindow 参数

| 参数 | 常量名 | 效果 |
|------|--------|------|
| 0 | SW_HIDE | 隐藏窗口 |
| 1 | SW_SHOWNORMAL | 显示并激活窗口（正常大小） |
| 3 | SW_SHOWMAXIMIZED | 最大化窗口 |
| 6 | SW_MINIMIZE | 最小化窗口 |
| 9 | SW_RESTORE | 恢复窗口（取消最小化/最大化） |

### IsIconic 函数

检查窗口是否最小化：
- 返回 `true` - 窗口已最小化
- 返回 `false` - 窗口未最小化（正常/最大化/全屏）

### SetForegroundWindow 函数

将窗口置于前台（激活），不改变窗口大小状态。

## 修复的文件

1. ✅ `scripts/kiro-auto-timer.ps1` - 测试版定时器
2. ✅ `scripts/kiro-auto-timer-30min.ps1` - 正式版定时器
3. ✅ `scripts/kiro-smart-monitor.ps1` - 智能监控
4. ✅ `scripts/send-continue.ps1` - 手动触发

## 测试

### 测试步骤

1. 将 Kiro 设置为全屏
2. 运行测试脚本：`npm run monitor:kiro:timer`
3. 等待第一次发送（10 秒后）
4. 检查 Kiro 是否仍然是全屏状态 ✅

### 预期结果

- ✅ Kiro 保持全屏状态
- ✅ Kiro 窗口被激活（置于前台）
- ✅ "continue" 命令正常发送

## 技术细节

### 窗口状态判断流程

```
检查窗口状态
    ↓
┌─────────────────────┐
│ IsIconic(窗口句柄)   │
└─────────────────────┘
    ↓
┌───────┴───────┐
│               │
true          false
(最小化)      (正常/最大化/全屏)
│               │
↓               ↓
ShowWindow(9)   跳过 ShowWindow
恢复窗口        保持当前状态
│               │
└───────┬───────┘
        ↓
SetForegroundWindow
激活窗口（置于前台）
```

### 代码实现

```powershell
# 导入 Windows API
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        
        [DllImport("user32.dll")]
        public static extern bool IsIconic(IntPtr hWnd);
        
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@

# 获取窗口句柄
$handle = $Process.MainWindowHandle

# 检查是否最小化
if ([Win32]::IsIconic($handle)) {
    # 只有最小化时才恢复
    [Win32]::ShowWindow($handle, 9) | Out-Null
    Start-Sleep -Milliseconds 100
}

# 激活窗口（不改变大小状态）
[Win32]::SetForegroundWindow($handle) | Out-Null
```

## 常见问题

### Q1: 为什么不直接去掉 ShowWindow？

**A**: 因为如果 Kiro 被最小化了，只调用 `SetForegroundWindow` 无法将其恢复。

### Q2: 全屏和最大化有什么区别？

**A**: 
- **最大化**: 窗口占满屏幕，但保留标题栏和任务栏
- **全屏**: 窗口占满整个屏幕，隐藏标题栏和任务栏

对于 `IsIconic` 来说，两者都返回 `false`（未最小化）。

### Q3: 如果 Kiro 被最小化了怎么办？

**A**: 脚本会自动检测并恢复窗口，然后发送 "continue"。

### Q4: 修复后会影响性能吗？

**A**: 不会。只是增加了一个 `IsIconic` 检查，性能影响可以忽略不计。

## 总结

### 修复前

- ❌ 每次发送都会取消全屏
- ❌ 用户体验不好

### 修复后

- ✅ 保持 Kiro 的全屏状态
- ✅ 只在最小化时才恢复窗口
- ✅ 用户体验更好

