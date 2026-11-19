# 线上索尔状态图集索引缺失

- 对象：王权骰铸索尔状态图集索引；此问题是在追查 React #520 记录的相邻访问时发现，尚无证据表明两者同因。
- 北京时间 2026-11-19 线上真实 `/play/dicethrone/local` 入口，选择索尔和武僧、准备并开始，索尔 `mjolnir` 标记存在但无图片，画面显示为空色圆点。实际网络记录中本地及官方资源候选的中文、英文图集 JSON 均为 404；正式中文压缩图集图片为 200、长度 233066 字节，与本地长度一致。仅依据文件大小不能证明远端图片字节完全一致。
- 用浏览器路由仅对中文官方 JSON 请求注入本地文件，再执行同一角色选择及开局：`mjolnir` 标记出现图集图片，图片解码宽度 2049，截图可见锤子图标。原始生产服务器没有被修改；该验证不覆盖其它状态、线上多人、安卓资源包或历史 React 异常。
- 本地索引 `public/assets/i18n/zh-CN/dicethrone/images/thor/status-icons-atlas.json` 为已跟踪文件，1183 字节，SHA-256 `48eaeefed37911e61e77b0d9ed9a959789ee84581e0af417b555d09fd87d945f`；本地发布检查仅命中一个对象，服务器正式目标为 `official/i18n/zh-CN/dicethrone/images/thor/status-icons-atlas.json`。
- 已准备精确发布命令：`node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/dicethrone/images/thor/status-icons-atlas.json`。发布入口会刷新涉及游戏的 Android 素材索引，属于生产资源发布；本轮没有执行。若发布，需回查官方地址内容和哈希，再通过未拦截的实际对局确认索尔图标，并分别核实 Android 索引。不能把浏览器注入说成线上已修复。
- 证据：`temp/feedback-closeout/live-thor-atlas-settled.png` 为原始线上棋盘；`temp/feedback-closeout/live-thor-atlas-injected.png` 为注入索引的对照，仍有开局动画，只用于确认左侧锤子图标，不作完整界面验收。
