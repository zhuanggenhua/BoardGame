---
name: audio-integration
description: "音频接入入口。用于挑选、接入、审计 SFX/BGM、音量、循环、触发、资源路径和播放验证。"
---

# 音频接入 Workflow

目标：让音效/BGM 改动可审计，而不是只说“改了一个 key”。交付必须能回答：改了哪些声音、哪些是通用池、哪些绑定到具体对象、每个声音的人类含义是什么、预览工具里该复制哪个 id/key。

## 分类

编辑前先把任务分到一个或多个类别：

- `generic-pool`：派系、角色、敌人家族、技能家族、UI 家族、BGM 组等共享声音。
- `object-specific`：绑定到具体卡牌、技能、武器、动画、状态或单个对象。
- `new-asset`：新增音频文件。
- `runtime-fix`：id 正确，但播放、加载或路由坏了。

最终报告必须区分 generic 与 object-specific；不能混成一张含糊列表。

## 候选发现

优先使用仓库已有语义发现层：

1. 语义 catalog / 分组 sound index。
2. AI-friendly 或 slim registry。
3. 完整 registry / 原始资源列表。
4. 预览页、试听工具或 sound browser。

存在语义 catalog 时，不直接跳完整 registry。最终候选还必须在真实音频源树中存在；不能只信过期 registry。

## 选择证据

每个选中声音都记录：

- 搜索关键词。
- 命中的语义组或类别。
- 考虑过的候选 id。
- 最终 id。
- 至少一个被拒候选或语义组。
- 最终选择理由。

高频玩法触发（出牌、召唤、装备、附着、点击等）还要记录时长判断：

- `short-transient`：默认优先，适合重复触发。
- `medium`：语义明显更好且重复触发不脏时可用。
- `long-tail / loop-like`：默认拒绝，除非用户明确要戏剧化提示。

普通玩法 SFX 默认以 4 秒为实用上限。保留超过 4 秒的声音时，必须解释例外理由。

若只复用现有库，报告写明：`本次未新增音频素材，仅复用现有音效库 key/id`。

## 接入层级

不要停在“找到了声音”。必须检查实际接入点：

- 音频源 registry 或生成 registry。
- 应用运行时导入的 registry snapshot。
- 游戏 audio config。
- 事件 resolver。
- preload / critical sounds。
- BGM 组与循环规则。
- 卡牌、技能、动画、FX impact 的对象级绑定。

需要区分三层：

- `shared/generated registry`：由资源生成的完整声音目录。
- `runtime/static registry snapshot`：应用构建或运行时实际导入的快照。
- `gameplay config`：事件映射、sound pools、BGM、preload、对象绑定。

新增音频文件时，说明三层是否更新。只 remap 已有 id 时，说明 registry 未变，只改 gameplay config。

## Generic 与对象绑定

Generic sound 是池子或类别复用，不归某个单对象，例如共享点击、拒绝音、战斗 BGM、某类出牌池。

Object-specific sound 显式绑定具体对象，例如某张卡、某个技能、某个动画 impact。对象绑定报告必须写目标对象中文名。

## 中文友好名

报告中必须给每个声音一个中文友好名，优先来源：

1. 现有 friendly-name / phrase mapping。
2. 预览工具显示名。
3. 根据原始短语人工翻译。

没有官方中文名时，写可读中文并标 `中文友好名待补`。不得让审查者只看英文 id、enum 或文件名。

## 试听

仓库有预览页、dev tool、sound browser 或等价试听面时，接入后询问是否打开。没有试听工具时直接说明，不静默跳过。

## 报告格式

两类声音同时存在时，最终报告拆两张表。

Generic：

| 用途/池子 | 音效中文名 | 音效 id/key | 配置位置 | 备注 |
| --- | --- | --- | --- | --- |

Object-specific：

| 目标对象中文名 | 对象类型 | 音效中文名 | 音效 id/key | 配置位置 | 备注 |
| --- | --- | --- | --- | --- | --- |

短修复可用紧凑表，但顺序仍必须是中文对象/用途、中文音效名、raw id/key、备注：

| 对象/用途 | 音效中文名 | 音效 id/key | 备注 |
| --- | --- | --- | --- |

收口还必须说明：

- 本次是复用现有声音还是新增素材。
- shared/generated registry 是否改变。
- runtime/static registry snapshot 是否改变。
- 改了哪些文件或配置。
- 是否已试听。
- 是否需要现在打开预览工具或启动服务器。

## 禁止

- 禁止只报 id/key，不写中文名。
- 禁止把 generic pool 和 object-specific 绑定混在一类。
- 禁止把通用池说成具体对象绑定，或反过来。
- 禁止对象绑定时隐藏目标对象。
- 禁止说“音频已接入”但没有表格。
- 禁止默认把 loop、ambient 或长尾声音用作高频玩法触发。
- 禁止 registry 有条目但本地真实音频源缺失时仍选择该声音。
