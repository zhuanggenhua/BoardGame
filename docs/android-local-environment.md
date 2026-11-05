# Android 本机构建环境

本文记录当前 BoardGame Windows 工作机上的 Android 构建事实。它只描述本机工具位置和排障顺序，不替代 [`android-app-build.md`](android-app-build.md) 的项目构建规则，也不代表其他机器一定拥有相同路径。

## 当前事实

- Java：由 `npm run mobile:android:doctor` 读取 `JAVA_HOME`。
- Gradle 8.7：
  - 发行版目录：`C:\Users\zhuagenbao\Downloads\gradle-8.7`
  - 可执行文件：`C:\Users\zhuagenbao\Downloads\gradle-8.7\bin\gradle.bat`
- Android SDK：`C:\Users\zhuagenbao\AppData\Local\Android\Sdk`
- ADB：`C:\Users\zhuagenbao\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- 项目 Gradle Wrapper：`android\gradlew.bat`
- Wrapper 默认下载地址：`https://services.gradle.org/distributions/gradle-8.7-bin.zip`

## 本机构建入口

标准入口仍然是：

```bash
npm run mobile:android:build:debug
npm run mobile:android:build:release
```

如果 Wrapper 试图联网下载 Gradle，但本机已有完整发行版，直接从 Android 目录复用本机 Gradle：

```powershell
& 'C:\Users\zhuagenbao\Downloads\gradle-8.7\bin\gradle.bat' assembleDebug --no-daemon
```

构建后必须检查：

```text
android/app/build/outputs/apk/debug/output-metadata.json
android/app/build/outputs/apk/debug/easyboardgame-debug.apk
```

不能只看 APK 文件存在；要同时核对 `applicationId`、`versionCode`、`versionName` 和文件修改时间。

## 真机连接

先执行：

```powershell
& 'C:\Users\zhuagenbao\AppData\Local\Android\Sdk\platform-tools\adb.exe' devices -l
```

安装测试包：

```powershell
& 'C:\Users\zhuagenbao\AppData\Local\Android\Sdk\platform-tools\adb.exe' install -r android/app/build/outputs/apk/debug/easyboardgame-debug.apk
```

安装后回读：

```powershell
& 'C:\Users\zhuagenbao\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell dumpsys package top.easyboardgame.app.debug
```

## CI 与本机的边界

- GitHub Actions 的 Android workflow 在 `ubuntu-latest` 上重新准备 Java、Android SDK 和 Gradle，再构建签名包。
- CI 能成功发布，不代表当前 Windows 工作机的 Wrapper 缓存完整。
- 本机测试包默认使用 `top.easyboardgame.app.debug` / `易桌游测试`；正式发布必须使用正式壳并走发布 workflow。
