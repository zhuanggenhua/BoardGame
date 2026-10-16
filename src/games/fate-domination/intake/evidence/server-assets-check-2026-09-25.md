# Fate/Domination 服务器素材核对

最近核对日期：2026-09-30

## 核对命令

- `node D:\gongzuo\webgame\BoardGame\scripts\assets\download-from-server.mjs --game fate-domination --dry-run`
- `node D:\gongzuo\webgame\BoardGame\scripts\assets\download-from-server.mjs --game fate-domination`
- 通过 `fetchAssetInventory()` 读取服务器 inventory，筛选 `official/i18n/zh-CN/fate-domination/`。
- 对代表性 Fate 资源 URL 执行 `HEAD` 请求，并对继续目录文件做字节数 / SHA-256 对账。

## 结果

- 服务器 inventory 总对象数：`13,342`。
- Fate 专属 namespace `official/i18n/zh-CN/fate-domination/`：`57` 个对象。
- 继续目录执行下载命令：`选择 592，下载 0，跳过未变化 592`。
  - `57` 个 Fate 专属对象已在本地且与服务器清单一致。
  - 其余对象是共享运行时资源，不能计入 Fate 专属素材数量。
- 代表性公开 URL 均返回 `200`：
  - `board/compressed/fuyuki-city.webp`：`359,298` bytes，`image/webp`
  - `cards/compressed/attack-magic-low.webp`：`52,700` bytes，`image/webp`
  - `events/compressed/fate-battle.webp`：`76,450` bytes，`image/webp`
  - `masters/compressed/emiya-shirou.webp`：`73,754` bytes，`image/webp`
  - `servants/compressed/saber.webp`：`473,940` bytes，`image/webp`
- `official/i18n/zh-CN/fate-domination/assets-manifest.json` 返回 `404`。这是预期结果：服务器发布对象是图片资源，`assets-manifest.json` 是仓内生成的本地索引，不作为服务器图片对象发布。
- 57/57 个 Fate 专属本地文件的大小和 SHA-256 与 inventory 一致；下载脚本因此全部跳过未变化文件。

## 当前素材结论

- Fate 运行时素材服务器闭环已确认，可以继续本地 OpenDesign / 运行时接入。
- 本地继续目录使用服务器校验过的 `public/assets/i18n/zh-CN/fate-domination/**` 副本；OpenDesign 的 `artifacts/fate-domination-open-design/assets/*.webp` 仍作为设计稿源素材记录，不与运行时 manifest 混为一谈。
- 本轮只做下载与核对，没有执行上传、部署或生产发布。
