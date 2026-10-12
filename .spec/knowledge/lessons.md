---
name: lessons
description: 经验教训：复发问题、reviewer 退回和用户纠偏的候选沉淀——开工前与复盘时查
metadata:
  type: doc
  status: 已交付
---

# 经验教训

复发问题的暂存区。条目在这里验证价值，稳定后升格到 `knowledge/standards/` 或 `rules/`，不在这里长期堆积。

## 收录准入

- 同类问题第二次出现才收录；单次偶发不收。
- 来源是 reviewer 退回、交付 known gaps、用户纠偏或已复现的同类事故。
- 待执行事项走 `.spec/tasks/`，不写进经验教训。

## 条目格式

### <一句话规避规则>

- 日期：YYYY-MM-DD
- 现象：踩了什么坑、复发几次
- 根因：为什么会发生
- 规避：怎么做能不再犯
- 来源：reviewer 报告 / known gaps / 用户纠偏

## 条目

### 点名参考图必须打开该文件本体，同产品另一张图不算看图

- 日期：2026-10-12
- 现象：用户给 `C:\Users\zhuagenbao\Desktop\个人主页.png`（Steam 资料 / 时侍页：左动态横条 + 右侧栏）。实现两次都按会话附件 Steam 库页封面墙做个人主页。第一次被纠偏后，第二次把失败改写成「缺前置条件就不能继续」。
- 根因：看图步骤被曲解到另一份对象；规范治理又把步骤失败改写成前置条件停手门禁。`打开真实参考截图` 被理解成任意同产品截图。
- 规避：需求拆成【看图】【实施】时，看图完成必须回答点名哪一份、实际打开哪一份、是否同一份，并把打开的同一份交给用户看见。对象不一致、或只私有读图不交付 = 该步骤失败，回到看图。不得新增「没看图就不能继续」前置门禁。canonical 在系统 `skill-governance`「点名动作是任务步骤」和 [`ui-change-gates`](standards/ui-change-gates.md)「点名参考必须量化过账」。
- 来源：用户纠偏（第二次：库页封面墙顶替资料页；治理误判为前置条件）

### 结算骰居中对象是玩家屏幕，不是可见石板

- 日期：2026-10-11
- 现象：用户要骰子居中且不改镜头。实现先后把 overlay 锚到整张竞技场、战斗格、整块棋盘视窗、可见石板几何中心；最后一版把红骰贴到石板中右 / 右上标志旁。子代理按错误合同（石板中部）给出 PASS，把未通过图交给用户。
- 根因：把「玩家正在看」错误特化成石板可见区域；验收合同跟着实现走，没有用用户原话「整屏中央」。已有「独立 overlay + 不改镜头」规则被特化，而不是被执行。
- 规避：结果骰 overlay 用整窗 `fixed inset-0` flex 居中。canonical 在 [`ui-ux.md`](standards/ui-ux.md)「玩家镜头由玩家持有」。石板中右、右上、标志旁 = REVISE。未按正确合同审图不得输出 VIEWER_URL。
- 来源：用户纠偏（第四次：arena-center / combat-anchor / viewport-center / visible-map-center）

### 陈述不是 bug，无变化媒体不重审

- 日期：2026-10-11
- 现象：用户说已经看到覆盖后的新截图，代理把它当成泄漏或 bug，发明暂存目录，并对已验收、本轮未改写的媒体再派子代理逐张核图。第三次：全量 capture 机械覆盖 16 张 PNG 后，按「被覆盖写入」把未改布局的主页、发现页也送子代理重读。
- 根因：把陈述当验收不合格；把 `all-media` 理解成每轮重读全部原图；把游戏 E2E 的 staging 外推到实时查看器；把机械全量覆盖 / mtime 变化当成实现改写。
- 规避：先按 [`conversation-handoff-target-lock`](standards/conversation-handoff-target-lock.md) 分类话语；增量核图与覆盖写回按 [`e2e-verification`](standards/e2e-verification.md)。「被覆盖写入」只指该屏实现或验收条件被改写后重新取证。机械全量覆盖、mtime、原地覆盖未改屏幕不得升级为必须重读。增量跑次必须过滤未改 PNG。
- 来源：用户纠偏（第三次）

### Acer 直连入口按 HTTP:8080 使用，隧道入口单独使用 HTTPS

- 日期：2026-10-06
- 现象：访问 `direct-home.easyboardgame.top` 的裸域名或 HTTPS 入口时出现 502 / 连接失败；带 `http://` 与 `:8080` 的直连入口正常。
- 根因：Acer 的直连 Nginx 只监听 `8080`，该域名没有可用的 80/443 直连服务；Cloudflare Tunnel 也不使用 `direct-home.easyboardgame.top` 这个直连主机名。
- 规避：BoardGame Acer 直连固定使用 `http://direct-home.easyboardgame.top:8080/`；需要无端口或 HTTPS 时改用已配置的隧道入口 `https://acer-check.easyboardgame.top/` 或 `https://home-test.easyboardgame.top/`。不得把直连域名自动改写成 HTTPS，也不得省略 `:8080`。
- 来源：用户纠偏；已复现并验证直连 200、隧道 200。

### BoardGame 素材术语：本地服务器与云服务器

- 日期：2026-10-06
- “本地服务器”固定指 Acer Linux 主机 acer-server；Windows PC 只是开发、控制和文件工作站，本地文件夹不等于图床。
- “云服务器”固定指公网主机 8.148.71.102，当前作为 Acer 素材源故障时的兜底源。
- “Acer 做图床/对象存储”表示素材服务真实部署在 Acer（当前采用 Nginx 静态源，未来可替换为 MinIO/S3 兼容存储），客户端通过 Acer 的公网隧道入口访问。
- 当前 BoardGame 素材链路：Acer 素材源优先，Cloudflare Worker 在 Acer 隧道不可用时回退云服务器；不要把 Windows 本地目录描述成“本地服务器图床”。
