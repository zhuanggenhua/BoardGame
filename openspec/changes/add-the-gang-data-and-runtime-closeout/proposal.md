# Change: 补齐纸牌帮 The Gang 数据录入与运行时闭环

## Why
`add-the-gang-foundation` 只完成了基础版骨架、首期规则实现和缩略图接入，不能代表“新游戏整体完成”。The Gang 仍缺完整数据录入合同、外部图片用途裁定、真实页面运行验收、资源远端闭环，以及本体后附加能力的正式取舍。

## What Changes
- 将 The Gang 后续工作从 foundation 中拆出，作为独立可验收 change 管理。
- 补齐规则/素材数据录入合同：真相源、切图/预览、核对表、对照表、冲突待裁定表。
- 对 `Mods/Images` 做用途分类，只把基础版运行时需要且已证明语义的素材接入正式资源链。
- 补真实运行入口验收：大厅/本地或联机房间进入 The Gang，完成一次基础抢劫主路径。
- 重新裁定附加能力矩阵：测试 AI 路径、action-log、undo UI、教程、debug-config 分别进入本轮或后续 change。

## Impact
- Affected specs: `the-gang`
- Affected docs: `docs/games/the-gang/**`, `openspec/changes/add-the-gang-data-and-runtime-closeout/**`
- Affected code/resources: `src/games/the-gang/**`, `public/assets/i18n/zh-CN/the-gang/**`, generated asset/game manifests as needed

## Current Reality
- Foundation 已有探索实现和基础测试，后续 action-log、AI、tutorial、undo UI 与 runtime closeout 均已拆成独立 change 验收。
- `openspec/specs/the-gang/spec.md` 已补齐，The Gang 基础版整体主 spec 已归档为当前真相。
- 外部 `dom.txt` 长度为 0，不能作为布局真相源。
- 外部图片用途裁定已继续推进：缩略图、24 个基础筹码、隐藏牌背、52 张牌面、警报、金条、桌面/牌槽已接入运行时；规则参考已从 TTS 脚本参考板抽取并接入默认折叠入口；BGG 电子版桌面中局满元素截图已通过。当前剩余工作是资源远端状态裁定、手机验收、教程体验继续打磨和最终完成口径。
