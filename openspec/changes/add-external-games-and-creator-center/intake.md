# 指定外站收录草稿与检查证据

## 目标
将用户指定的外部游戏加入外链目录候选，iframe 优先。当前是收录草稿，不是已创建的投稿、正式目录或已通过的游戏入口。

| 字段 | 草稿值 | 真相来源/状态 |
| --- | --- | --- |
| 候选标识 | `external-yuanyi-games` | 仅供本提案引用，正式 ID 由目录创建流程生成 |
| 游戏网址 | https://yuanyigames.top/ | 用户指定，首页 HTTP 200 |
| 游戏名称 | 山中小屋 | 本轮 HTML title；暂作标题，未完成游戏界面核验 |
| 作者 | 鸢一桑 | 用户明确指定，不等于账号已通过作者认证 |
| 作者 B 站主页 | https://space.bilibili.com/31976469 | 用户明确指定；必须在介绍内可点击，不只放隐藏字段 |
| 管理账号 | 未认领 | 用户没有提供作者账号控制证据，不授予当前登录者管理权 |
| 首选打开方式 | iframe | 用户已选择；当前站点响应策略阻止嵌入 |
| 封面、分类、人数、建议时长、规则介绍 | 待确认 | 不拿本站同名游戏或一般桌游规则补录 |

建议的最小介绍文本：

> 作者：鸢一桑。作者 B 站主页：[鸢一桑](https://space.bilibili.com/31976469)。游戏网站：[山中小屋](https://yuanyigames.top/)。

该文本只记录已知信息，不虚构玩法、人数、价格或作者授权。

## 2026-10-27 本轮检查

执行：`curl.exe -sS -L -D - --max-time 25 https://yuanyigames.top/`

响应摘录：

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Date: Tue, 27 Oct 2026 02:21:28 GMT
Permissions-Policy: camera=(), microphone=(), geolocation=()
Via: 1.1 Caddy
X-Frame-Options: DENY
X-Robots-Tag: noindex, nofollow
<title>山中小屋</title>
```

内置浏览器直接打开后初始状态只有“山中小屋 / 载入中…”，后续读取超时。本轮没有完整主界面、开局、全屏或可玩性通过证据。

## 现实后果与最小补救

浏览器会拒绝在本站 iframe 中显示该页面。不是本站加上 `allowfullscreen` 或调整 CORS 就能解决。需要作者在站点响应配置中允许实际本站嵌入，通常用 CSP `frame-ancestors` 指定允许的宿主来源，并处理仍在阻止嵌入的 X-Frame-Options；不能使用已废弃的 ALLOW-FROM。

配置由作者操作，本站不擅自修改第三方服务器，也不反向代理外站绕过其策略。允许来源必须以真实生产入口和获准的测试来源为准，不能直接放开所有站点。

作者调整后复查最终响应，再在本站真实入口验证 iframe 加载、第三方登录/存储、资源、横竖屏、全屏菜单、返回和计时。此前只能标记“站内嵌入受限”，外站打开是明确的替代入口，不是 iframe 修复。
