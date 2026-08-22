---
name: audio-assets
description: 音频资源标准：共享包、registry、触发路径和迁移策略——接入或排查音效时查
metadata:
  type: doc
  status: 已交付
---

# 音频资源标准

## 适用范围

本文只定义音频运行时合同：共享音频包、registry、语义目录、触发路径和迁移边界。执行命令、外部素材查找、试听和新增素材产物归项目 [`audio-integration`](../../skills/audio-integration/SKILL.md) 与 [`docs/audio/`](../../../docs/audio/)。

## 架构合同

| 层 | 职责 | 禁止 |
| --- | --- | --- |
| 通用注册表 | `src/assets/audio/registry.json` 是音频 key 与物理路径映射的唯一来源 | 游戏层重复声明资源、维护短 key 或私有 basePath |
| 事件策略 | 领域事件声明 `ui`、`immediate`、`fx`、`silent` 等播放策略 | 依赖命名猜测、按钮文案或组件位置决定音效 |
| FX 系统 | 有动画的事件由 `FeedbackPack` 或 impact 回调在正确视觉时机播放 | 同一事件同时走即时音和动画音两条正式路径 |
| UI 交互音 | 点击、拒绝、确认等本地交互走共享 UI 音效入口 | 在业务组件里散写游戏态音效逻辑 |

新增游戏默认使用 registry 完整 key；旧短 key 只作历史兼容，不得继续扩展。

## 路径合同

共享音频包 `common-audio` 的运行时路径以 `public/assets` 下相对路径为准，例如 `common/audio/bgm/...`、`common/audio/sfx/...`。以下四层必须同构：

1. zip entry 路径；
2. file index / installed-files-index 记录；
3. 原生 `current/assets` 落盘路径；
4. H5 传给 `readInstalledAsset` 的 `relativePath`。

BGM / SFX 只是 `common/audio/...` 下的子树，不是独立根路径。真实机读不到已安装音频包时，先定位是哪一层路径失配，再决定修打包、原生、索引还是 H5 兼容。

## 移动端读取

当音频来自 Android 已安装包或共享音频包时，不能只依赖浏览器直读本地 URL。首个本地候选失败后，必须优先走原生 `readInstalledAsset -> blob URL` 或等价桥接，并让当前播放请求续到新候选实例。

官方远端 URL 只能作最后兜底；它能播放不代表本地包路径合同正确。只要真实机仍记录本地读取失败，就不能宣称音频链路完全修复。

## 触发时机

事件生成和动画冲击帧不是同一时刻：

- 无动画事件可由 `feedbackResolver` 即时播放；
- 有 FX 的事件由 `FeedbackPack` 声明音效时机；
- 飞行动画或 impact 型表现由 impact 回调播放；
- UI 点击、拒绝、确认走 UI 交互音；
- 同一事件只能选择一个正式播放路径。

目标状态是 `FeedbackPack` 承担有动画事件的音效时机和 key 声明。未迁移的旧游戏可保留过渡配置，但触碰时必须判断是否迁到目标架构。

## 迁移边界

- 新游戏直接采用目标架构，不新增过渡期两路径模式。
- 旧游戏如果暂留 adapter，adapter 只能映射旧入口到目标合同，不能成为第二套音频规则源。
- 历史路径兼容只用于已发包与当前合同不一致且短期无法要求重装的场景；必须保留当前标准路径不变，并用回归测试同时覆盖标准路径和历史路径。
- 具体游戏迁移状态不在本标准维护；放入对应任务、evidence 或专项 workflow。

## 禁止项

- 禁止在游戏层维护音频资源目录、短 key 或重复 registry。
- 禁止配置中手写 `compressed/`；优化路径由统一加载函数处理。
- 禁止把远端可读当作本地包合同修复。
- 禁止因为单类音频失败就改写整套目录语义。
- 禁止用日志安静、兜底成功或自动播放绕过来替代真实播放链路验收。
