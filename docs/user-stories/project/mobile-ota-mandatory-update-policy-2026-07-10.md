# 移动 OTA 全部强制更新与轻量包策略

## 用户原始要求

- “全部强制更新。”
- OTA 应优先直接发布到服务器资源主源，不应因为 R2 容量或灾备阻塞正式发布。
- OTA 不应携带可由服务器资源链或移动游戏包提供的大体积图片、图集配置、二维码和游戏素材。

## 覆盖范围

- Android 与 iOS 的 H5 OTA / Live Update。
- `stable`、`gray`、`edge` 以及后续新增的所有 OTA channel。
- 本地发布脚本、统一发布入口、后台发布中心、服务端发布接口和 GitHub Actions。

## 强制裁定

1. 所有 OTA manifest 必须写入 `forceUpdate: true`，并提供强制更新标题和正文。
2. 发布入口不得提供关闭 OTA 强制更新的有效选项；传入 `--no-force-update` 或等价的 `false` 参数必须失败或被服务端固定改为 `true`。
3. 客户端启动自动检查发现新强制 OTA 时，必须显示阻塞式更新界面，下载完成后立即切换 bundle，不能继续按后台排队处理。
4. OTA zip 只承载 H5 代码、样式、中文语言包、字体、必要的小型公共文件和资源清单。
5. `assets/**` 下的嵌套游戏图片、音频、图集配置、状态图集 JSON、缩略图、首页大图和 `logos/**` 不进入 OTA；这些对象继续由服务器资源主源、移动游戏包或已安装资源提供。
6. Android embedded APK 可以为首装或离线兜底保留必要本地资源，但该 embedded 白名单不得直接复用于 OTA zip。

## 不覆盖范围

- 本裁定不把原生二进制更新改成 OTA。新增原生插件、权限、Android/iOS 原生代码、签名、图标或启动图时，仍需发布 APK/AAB 或 TestFlight build。
- Android 原生 APK 更新是否允许非强制安装，仍按原生更新规范处理；本裁定只强制 H5 OTA。

## 验收标准

- 任意 OTA 发布入口生成的 manifest 均包含 `forceUpdate: true`。
- 任意关闭 OTA 强制更新的参数均无法产出可发布 manifest。
- 自动启动检查遇到强制 OTA 时返回立即应用模式，并调用 bundle 切换而不是后台排队。
- OTA zip 不包含：
  - `assets/atlas-configs/smashup/2833984701.json`
  - `assets/common/images/home-v2/book-catalog-wide/1.png`
  - `assets/i18n/zh-CN/dicethrone/thumbnails/compressed/fengm.webp`
  - `assets/i18n/**/status-icons-atlas.json`
  - `logos/weixin.jpg`、`logos/zhifubao.jpg`
- 线上 `latest.json`、ZIP 大小、ZIP 文件清单和 `X-Asset-Source: server` 均完成回查后，才可称为发布完成。
