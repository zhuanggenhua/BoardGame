---
name: fgo-asset-h5-reproduction
description: 处理 FGO 本地 APK、d713 缓存解包、角色与宝具素材导出、H5 动画复现及画面对照时使用。
---

# FGO 素材解包与 H5 复现

复用原始网格、骨骼、贴图、材质、粒子参数和演出事件，做出可播放、可定位时间的 H5 预览。普通角色动作和完整宝具演出是两个交付范围；先盘点，再确定能还原到哪一层。

## 开始时

1. 确定 APK／缓存目录、工作目录、目标 H5 工程、目标角色或演出。已有会话路径可直接复用；本机现状见 [本机入口与限制](references/local-workspace.md)。
2. 运行 [只读盘点脚本](scripts/audit_inventory.py)，检查源 bundle、资源映射、已有角色目录和宝具片段数量。报告写到目标工程的 `test-results/`，不写入原始缓存。
3. 区分这些证据：

   | 发现的内容 | 可以说明什么 |
   | --- | --- |
   | master 表／AssetName 映射 | 有逻辑、名称或资源索引；不能证明本地有素材 |
   | `Servants@…` 网格、骨骼、AnimationClip | 可还原角色、武器及实际存在的动作 |
   | `treasureArms…` 片段 | 有宝具身体动作；不代表有完整宝具演出 |
   | 专用 `NoblePhantasm@…` 和 `Sequence@…` | 具备特效／事件时间轴入口；仍需检查外部依赖 |
   | 渲染和交互验证通过 | 能在受测 H5 环境播放；不等于与原游戏逐帧一致 |

4. 确定本次是盘点、解包、角色预览、完整演出或故障排查。只读相关分卷：
   - 从 APK／原始缓存开始：[解包与 APK 代码分析](references/unpack-and-apk.md)。
   - 已有 bundle，需导出、播放或修正错位：[导出与渲染](references/export-and-render.md)。
   - 已有网页，需检查画面、角色切换或完成度：[验证与交付](references/verification.md)。

## 复现原则

- 第三方工具、SDK、UnityPy、插件源代码保持只读。适配放在工程自有脚本或临时副本中。保留原始 APK、缓存、bundle，不就地改写。
- 先恢复网格和骨骼，再处理武器、挂点、材质、镜头和粒子。角色姿态不对时，先查绑定、坐标和片段采样，不靠调特效掩盖。
- 原始资源存在时，不用手绘贴图、手写 cut-in、临时光束或凭观感猜出的关键帧替代。为了适配 WebGL 做的实现差异要能追溯到源字段或 APK 方法。
- 从原文件建立 `bundle → PathID／层级路径 → clip／binding → material／shader → timeline event → 网页消费点` 的对应关系。PathID 要带所属文件命名空间，不能跨 bundle 当成全局 ID。
- 一次演出采用一致的坐标和相机约定。不要将旧 Pixi 和新 Three 画布叠加后拿截图判断；先确认实际挂载的 runtime 和 canvas 数量。
- 通过 APK 代码确定公式、采样或绘制规则时，记录版本、架构和方法位置。地址不能跨版本照抄；Unity 原生内部行为无法从游戏 C# 完整得到时，明确证据边界。
- 原生 Unity 对照是可选手段；H5 播放不依赖 Unity 编辑器许可证。原始效果不可获取时，可按用户授权做网页自检，但不能报告原游戏 1:1 对照通过。
- 新角色复用已经支持的网格、骨骼、材质和动作管线；完整宝具必须核对自身特效和时间轴，不能把 Saber 的编排换贴图套用。
- 菜单展示中文名，保留原始 ID 和片段键。编号代表片段区分，不凭名称把变式解释成伤害等级、连续阶段或第几个宝具。

## 最短入口

在项目根目录执行；变量先按真实目录设置，示例值见本机参考：

```powershell
& $fgoPython "$fgoSkill/scripts/audit_inventory.py" --work-root $fgoWork --cache-root $fgoCache --project-root $boardProject --output "$boardProject/test-results/fgo-skill-inventory.json"
```

脚本只读文件名、映射和已有导出目录；不解密、不访问游戏服务器，也不把成对出现的 bundle 自动判为完整复现。上例显式写出报告；要求纯只读时省略 `--output`，JSON 只输出到 stdout。

## 收口

按 [验证与交付](references/verification.md) 保留真实浏览器截图、失败清单和运行命令。交付写清：入口链接、可播放角色／动作、完整演出与片段的区别、哪些结论来自源数据、哪些仍缺原生参考。已有授权内继续修正已发现的问题，不把未完成的技术自检交给用户验收。
