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
