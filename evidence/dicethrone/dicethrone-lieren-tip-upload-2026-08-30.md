# Dice Throne 女猎手提示卡资源上传回查

## 目标

女猎手提示卡必须在进入运行时审计前完成本地压缩、manifest 登记、服务器上传和公开 URL 回查。

## 资源链

| 项目 | 结果 |
|---|---|
| 源图 | `public/assets/i18n/zh-CN/dicethrone/images/lieren/tip.png` |
| 运行时文件 | `public/assets/i18n/zh-CN/dicethrone/images/lieren/compressed/tip.webp` |
| 服务器发布批次 | `20260830055240704` |
| 服务器发布对象 | `official/i18n/zh-CN/dicethrone/images/lieren/compressed/tip.webp` |
| 发布结果 | 已发布，服务器入口报告 `serverPrimaryObjects=4`，其中包含 `tip.webp` |

## 公开 URL 回查

`https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/lieren/compressed/tip.webp`

- HEAD 状态：`200`
- 本轮同时回查 `player-board.webp`、`ability-cards.webp`、`dice.webp`、`status-icons-atlas.webp`、`nyras-bond.webp`、`bleed.webp`，均为 `200`。

## 审计门禁

在本回查完成前，女猎手提示卡只能标记为资源未闭合，不能宣称运行时审计完成；本回查完成后才允许进入提示卡显示与审计收口。
