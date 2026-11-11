"""仅在指定测试窗口居前时，按窗口标题采集真实桌面画面。"""
import json
import ctypes
import os
import subprocess
import sys
import time
from pathlib import Path

import imageio_ffmpeg
import win32gui
import win32process
import win32ui
from PIL import Image
import psutil

needle, destination, worker_pid = sys.argv[1:]
out = Path(destination)
windows = []
owned = {int(worker_pid)}
owned.update(child.pid for child in psutil.Process(int(worker_pid)).children(recursive=True))
diagnostic = []
def collect(hwnd, _):
    pid = win32process.GetWindowThreadProcessId(hwnd)[1]
    if pid in owned:
        title = win32gui.GetWindowText(hwnd)
        visible = bool(win32gui.IsWindowVisible(hwnd))
        diagnostic.append({'hwnd': hwnd, 'pid': pid, 'visible': visible, 'title': title})
        if visible and needle in title:
            windows.append(hwnd)
    return True
win32gui.EnumWindows(collect, None)
(out / 'battle-desktop-windows.json').write_text(json.dumps(diagnostic), encoding='utf-8')
if len(windows) != 1:
    raise RuntimeError(f'Expected one visible test window, found {len(windows)}')
hwnd = windows[0]
title = win32gui.GetWindowText(hwnd)
rect = win32gui.GetWindowRect(hwnd)
target_pid = win32process.GetWindowThreadProcessId(hwnd)[1]
def occluded():
    covering = []
    passed_target = False
    def visit(other, _):
        nonlocal passed_target
        if other == hwnd:
            passed_target = True
            return True
        if passed_target:
            return True
        if not win32gui.IsWindowVisible(other) or win32process.GetWindowThreadProcessId(other)[1] == target_pid:
            return True
        left, top, right, bottom = win32gui.GetWindowRect(other)
        if min(right, rect[2]) > max(left, rect[0]) and min(bottom, rect[3]) > max(top, rect[1]):
            cloaked = ctypes.c_int()
            result = ctypes.windll.dwmapi.DwmGetWindowAttribute(other, 14, ctypes.byref(cloaked), ctypes.sizeof(cloaked))
            covering.append({'hwnd': other, 'pid': win32process.GetWindowThreadProcessId(other)[1], 'rect': [left, top, right, bottom], 'exStyle': win32gui.GetWindowLong(other, -20), 'cloaked': bool(cloaked.value) if result == 0 else None})
        return True
    win32gui.EnumWindows(visit, None)
    (out / 'battle-desktop-occlusion.json').write_text(json.dumps(covering), encoding='utf-8')
    return bool(covering)
foreground_before = win32gui.GetForegroundWindow()
focus_error = None
attached = False
detached = None
if foreground_before != hwnd:
    if os.environ.get('QIDAHEN_WAIT_USER_FOCUS') == 'true':
        deadline = time.monotonic() + 45
        while win32gui.GetForegroundWindow() != hwnd and time.monotonic() < deadline:
            time.sleep(.1)
    else:
        foreground_thread = win32process.GetWindowThreadProcessId(foreground_before)[0]
        current_thread = ctypes.windll.kernel32.GetCurrentThreadId()
        try:
            attached = bool(ctypes.windll.user32.AttachThreadInput(current_thread, foreground_thread, True))
            win32gui.SetForegroundWindow(hwnd)
        except Exception as exc:
            focus_error = str(exc)
        finally:
            if attached:
                detached = bool(ctypes.windll.user32.AttachThreadInput(current_thread, foreground_thread, False))
        time.sleep(.2)
foreground_after = win32gui.GetForegroundWindow()
(out / 'battle-desktop-focus.json').write_text(json.dumps({'targetHwnd': hwnd, 'targetPid': target_pid, 'foregroundBefore': foreground_before, 'foregroundAfter': foreground_after, 'attached': attached, 'detached': detached, 'error': focus_error}), encoding='utf-8')
if attached and not detached:
    raise RuntimeError('Failed to detach foreground input thread; no recording started')
if foreground_after != hwnd:
    raise RuntimeError('Isolated test window is not foreground; no recording started')
was_topmost = bool(win32gui.GetWindowLong(hwnd, -20) & 0x8)
topmost_meta = {'targetHwnd': hwnd, 'wasTopmost': was_topmost, 'set': False, 'restored': False}
try:
    win32gui.SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0003 | 0x0010)
    topmost_meta['set'] = True
    if win32gui.GetForegroundWindow() != hwnd or occluded():
        raise RuntimeError('Another window overlaps the test window or focus was lost; no recording started')
    if os.environ.get('QIDAHEN_WINDOW_CAPTURE_PROBE') == 'true':
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        width, height = right - left, bottom - top
        dc = win32gui.GetWindowDC(hwnd)
        source = win32ui.CreateDCFromHandle(dc)
        memory = source.CreateCompatibleDC()
        bitmap = win32ui.CreateBitmap()
        bitmap.CreateCompatibleBitmap(source, width, height)
        memory.SelectObject(bitmap)
        try:
            ok = ctypes.windll.user32.PrintWindow(hwnd, memory.GetSafeHdc(), 2)
            Image.frombuffer('RGB', (width, height), bitmap.GetBitmapBits(True), 'raw', 'BGRX', 0, 1).save(out / 'battle-printwindow-probe.png')
            (out / 'battle-window-probe.json').write_text(json.dumps({'printWindowOk': bool(ok), 'rect': [left, top, right, bottom], 'dpi': ctypes.windll.user32.GetDpiForWindow(hwnd)}), encoding='utf-8')
        finally:
            win32gui.DeleteObject(bitmap.GetHandle())
            memory.DeleteDC()
            source.DeleteDC()
            win32gui.ReleaseDC(hwnd, dc)
    meta = {'title': title, 'rect': list(rect), 'startedUtcMs': time.time_ns() / 1e6, 'foregroundLost': False}
    process = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-f', 'gdigrab', '-framerate', '30', '-draw_mouse', '1', '-i', 'title=' + title,
                                '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '5', str(out / 'battle-desktop-window.webm')],
                               stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    (out / 'battle-desktop-ready.json').write_text(json.dumps(meta), encoding='utf-8')
    try:
        while not (out / 'battle-desktop-stop').exists() and process.poll() is None:
            if win32gui.GetForegroundWindow() != hwnd or not win32gui.IsWindowVisible(hwnd) or occluded():
                meta['foregroundLost'] = True
                break
            time.sleep(.05)
    finally:
        if process.poll() is None:
            process.stdin.write(b'q\n')
            process.stdin.flush()
            process.wait(timeout=30)
        meta.update({'endedUtcMs': time.time_ns() / 1e6, 'exitCode': process.returncode, 'finalRect': list(win32gui.GetWindowRect(hwnd)) if win32gui.IsWindow(hwnd) else None})
        (out / 'battle-desktop-diagnostic.json').write_text(json.dumps(meta), encoding='utf-8')
finally:
    if topmost_meta['set'] and win32gui.IsWindow(hwnd):
        win32gui.SetWindowPos(hwnd, -1 if was_topmost else -2, 0, 0, 0, 0, 0x0003 | 0x0010)
        topmost_meta['restored'] = True
    (out / 'battle-desktop-topmost.json').write_text(json.dumps(topmost_meta), encoding='utf-8')
