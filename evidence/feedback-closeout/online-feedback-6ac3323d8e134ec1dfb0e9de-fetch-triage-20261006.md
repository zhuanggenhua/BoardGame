# 线上反馈 6ac3323d8e134ec1dfb0e9de：Failed to fetch

## 反馈原文

`[auto][unhandledrejection] Failed to fetch`

来源：2026-10-06 重新读取生产 `https://api.easyboardgame.top/admin-api/feedback` 的反馈记录。

## 发现的问题

- 真实路由是 `/?homeStyle=classic`，错误来自 `window.unhandledrejection`，堆栈落在旧 bundle `http://8.148.71.102/assets/App--O0x6oX3.js` 的压缩函数 `Al`，并经过 `lobbyDirectorySorting-CjljyDab.js`。
- 反馈没有 actionLog、stateSnapshot、请求 URL、响应码或 CORS 现场；仅凭 `TypeError: Failed to fetch` 无法区分网络失败、CORS、API 不可达、旧 bundle 漂移或页面生命周期竞态。
- 当前不能把“没有新增同类记录”或对错误做静默吞掉称为修复。

## 处理方式 / 当前结果

- 保留线上记录 `in_progress`，本轮不添加吞错或泛化 fallback。
- 最小补救动作：从同一首页入口重新采集当前 bundle、实际 fetch URL/响应码、CORS 响应头、浏览器网络错误和页面可见结果；再按首个失败请求定位根因。

## 阻塞关系

- 现实后果：用户在经典首页可能遇到未处理网络异常。
- 直接证据：旧 IP bundle 堆栈存在，但缺少请求级现场。
- 阻塞：没有首个失败请求和当前版本映射，不能安全改 API、CORS 或前端请求链，也不能关闭反馈。

## 当前线上入口复核（2026-10-06）

- 同一入口 `http://8.148.71.102/?homeStyle=classic` 返回 `200`，当前 HTML 只加载 `/assets/index-Bi-ayEaE.js`。
- 反馈堆栈中的旧文件 `/assets/App--O0x6oX3.js` 当前返回 `404`，说明该反馈指向的 bundle 已不再是当前线上入口。
- Playwright 无头浏览器从同一入口等待页面完成并继续观察 8 秒：页面标题为“易桌游 - 桌游教学与联机平台”，首屏大厅内容正常；未捕获 `pageerror`、`requestfailed`、`fetch/xhr >= 400` 或新的 `unhandledrejection`。
- 当前唯一网络异常是无关的 Mage Wars 缩略图 `http://8.148.71.102/official/i18n/zh-CN/mage-wars/thumbnails/compressed/cover.webp?v=c1334802` 返回 `404`，未触发本反馈中的 `Failed to fetch`。

## 结论

- 本轮没有发现当前入口仍可复现的 `Failed to fetch`；不能把已消失的旧 bundle 堆栈冒充当前 API/CORS 根因。
- 该反馈按“旧 bundle 已下线、当前同一入口未复现”关闭；不对现有 API、CORS 或请求链做无证据改动。
