# 山屋惊魂正式资源迁移清单

## 1. 当前对象

- 当前暂存目录：`public/assets/betrayal/`
- 正式目标目录：`public/assets/i18n/zh-CN/betrayal/`
- 当前结论：这批文件已经完成首轮命名、压缩和远端上传验证，但目录层级仍不符合项目新游戏正式资源合同。

## 2. 目录级迁移映射

| 当前目录 | 正式目录 | 对象数 | 说明 |
| --- | --- | ---: | --- |
| `public/assets/betrayal/thumbnails/` | `public/assets/i18n/zh-CN/betrayal/thumbnails/` | 1 原图 + 1 压缩图 | 大厅封面 |
| `public/assets/betrayal/ui/` | `public/assets/i18n/zh-CN/betrayal/ui/` | 2 原图 + 2 压缩图 | 标题横幅、0-9 轨道 |
| `public/assets/betrayal/cards/` | `public/assets/i18n/zh-CN/betrayal/cards/` | 12 原图 + 12 压缩图 | 牌背、玩家参考卡、叛徒/怪物参考卡 |
| `public/assets/betrayal/explorers/` | `public/assets/i18n/zh-CN/betrayal/explorers/` | 13 原图 + 13 压缩图 | 探索者角色牌 |
| `public/assets/betrayal/monsters/` | `public/assets/i18n/zh-CN/betrayal/monsters/` | 3 原图 + 3 压缩图 | 怪物/特殊角色卡 |
| `public/assets/betrayal/markers/` | `public/assets/i18n/zh-CN/betrayal/markers/` | 28 原图 + 28 压缩图 | 数字/状态/资源标记 |

## 3. 必须重建的产物

迁移后以下文件不能直接沿用，必须重新生成：

1. `public/assets/betrayal/assets-manifest.json`
2. `public/assets/i18n/assets-manifest.json`
3. `public/assets/i18n/zh-CN/betrayal/assets-manifest.json`
4. 根级或其它受 `assets:manifest` 影响的聚合 manifest

原因：

- 现有 `public/assets/betrayal/assets-manifest.json` 的 `basePrefix` 仍是 `official/betrayal/`
- 正式本地化资源树切换后，哈希登记键会变成 `i18n/zh-CN/betrayal/...`
- 当前 `AssetLoader` / `ManifestGameThumbnail` 的运行时合同需要从本地化资源树解析

## 4. 已识别的重复候选

以下对象当前内容高度可疑地重复，迁移时应一并复核是否保留两份语义入口：

| 文件 | 现象 | 当前判断 |
| --- | --- | --- |
| `thumbnails/cover.png` 与 `ui/title-banner.png` | 当前 manifest hash 一致 | 可能是同一张图被同时用作大厅封面与 UI 横幅，迁移时应保留两条语义路径，但要确认是否确实需要两份物理文件 |

## 5. 迁移后最小闭环

批准后应按以下顺序执行：

1. 把 6 个正式分类目录整体迁到 `public/assets/i18n/zh-CN/betrayal/`
2. 重新运行：
   - `npm run compress:images -- public/assets/i18n/zh-CN/betrayal`
   - `npm run assets:manifest`
   - `npm run assets:check`
3. 若远端缺口重新出现，再执行：
   - `npm run assets:upload`
4. 对代表性 URL 再做远端回查

## 6. 本轮不随迁移解决的事项

以下事项与“目录层级迁移”不同，仍属于后续资源实施：

- 房间板块拼版裁图
- 楼层板/起始房间板裁图
- 扫描 PDF OCR
- 规则文本结构化录入
- 正式 Board 对这些房间/楼层资源的消费合同
