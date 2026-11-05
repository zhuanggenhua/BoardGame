# 本机入口与限制

以下是 2026-10-26 的工作区定位记录，不是固定适用于其他安装的常量。拿到新素材时重跑盘点。

## 路径和工具

```powershell
$boardProject = 'E:/zhanggenhua/temp/BoardGame'
$fgoWork = 'E:/zhanggenhua/temp/fgo/work'
$fgoCache = 'E:/zhanggenhua/temp/fgo/d713'
$fgoPython = "$fgoWork/.venv/Scripts/python.exe"
$fgoNode = 'D:/HUANJING/Nodejs/node221701/node.exe'
$fgoSkill = "$boardProject/.spec/skills/fgo-asset-h5-reproduction"
Set-Location -LiteralPath $boardProject
```

| 本地路径 | 用途 |
| --- | --- |
| `work/Android/AssetName.json` | 数组，行含 `AssetName`、`FileName`；名称不是素材本体 |
| `work/Android/AudioName.json`、`MovieName.json` | 音频、电影哈希映射 |
| `work/Android/gamedata/unpack_master/` | `mstSvt`、`mstBattleScript`、`mstTreasureDevice` 等表 |
| `work/DecryptedAssetBundles/`、`DecryptedAssetBundles.map.json` | 解密 bundle 和成功／失败记录 |
| `work/DecryptedNamed/` | 早期额外保留的命名 bundle；避免重复计数 |
| `work/ExportedGameAssets/` | 原始可见素材导出、纹理 PNG |
| `work/AnimationStudy/` | 动画状态与时间轴索引 JSON／CSV |
| `work/cutin_research.md` | 早期 CN 解包和战斗／ADV 入口研究记录；不是当前画面通过证明 |
| `work/ClientApk/com.bilibili.fgo.vivo-2.129.0.apk` | 本机 APK，约 2.00 GB 十进制；解包前重新计算可用空间 |
| `work/ClientApk/2.129.0-{armv7,arm64,UnityData}/` | 已分离的原生库／元数据／内置 Unity 资源 |
| `work/Tools/Il2CppDumper-6.7.46/` | 本机已下载的第三方工具，源文件保持只读 |
| `E:/zhanggenhua/temp/jiebao/` | APK 扫描、方法映射和网格矩阵诊断脚本；大量 PNG 是历史实验截图 |

Python 实测 3.13.5，FGO 虚拟环境中 UnityPy 1.25.3、Pillow 12.3.0、capstone 5.0.9。原生分析还使用 pyelftools；在目标环境先核实安装。前端 package 声明 three `^0.182.0`、pixi.js `^8.20.1`、Playwright `^1.58.0`、sharp `^0.34.5`；安装以 lockfile／当前项目要求为准，不把版本范围当实际安装版本。

## 已识别范围

本地命名解密 bundle 目录有 725 个文件；40 套严格匹配 `Servants@数字.unity3d` 的角色资源（包含 NPC、敌人和变体），导出目录共有 548 个 clip、61 个形态选项。其中 22 套资源含 67 个 `treasureArms…` 片段，不能称为 22 个独立完整宝具。

当前专用特效／sequence 配对只有 `NoblePhantasm@100101` 与 `NoblePhantasm@Sequence@100101`，服务于 Saber `100100` 的现有 18.5 秒演出。不要按 ID 相减推断所有角色的关联。

`NoblePhantasm@CutIns` 是通用 cut-in 动画库；导出的图片目录为空不代表 bundle 无动画。`Battle@Common` 也有通用粒子、镜头和 prefab，不能只按 UI 文件夹内容判断其用途。

映射之外的二进制尚不能据文件名断言无素材；对“只有一个完整宝具”的结论限定为目前已识别和已接入范围。

## 运行代码的当前主线

当前页面调用 Three 的 `createFgoSceneRuntime`／`createFgoCharacterRuntime`，单一 canvas。早期 `cutsceneDemoRuntime.ts` Pixi 和 `fgoThreeOpeningRuntime.ts` 仍在仓内，不是判断当前画面的依据；摘要里出现“Pixi-only”时回查实际页面 import。

`fgoScenePresentation.ts` 的数值是网页显示调整，不是 APK 恢复值。完整演出已经做过网页自检；没有据此获得原生 1:1 保证。

## 已知工具约束

- 导出器中的 `WORK_ROOT`、`PROJECT_ROOT`、Saber／APK 路径多为硬编码。异机执行前检查所有依赖模块的常量；在工程自有适配层或副本修改，不修改 UnityPy／第三方 SDK。
- `export-fgo-saber100100-skin.py` 需要保留的基础 JSON；贴图复制脚本也依赖已有 PNG 导出目录。详见 [导出与渲染](export-and-render.md)，不要声称无前置的一键重建。
- `verify-fgo-character-gallery.mjs` 桌面验证会生成缩略图并重写 catalog；`--ids` 局部导出也重写 catalog。
- Vite 通常无 HMR。页面打不开时先检查 4290 端口和实际 PID，再判断资源／代码问题。
- 本地 Node 22.17.1 可跑当前预览，项目 package 要求 Node 24.1.0；这只是本机已运行组合，不是新环境推荐覆盖项目要求的理由。
- Unity 2019／2021 曾因无许可证未能运行原生对照；这不阻碍 UnityPy 读取及 H5 播放。
- 全项目 app 类型检查有既有错误。创建此 Skill 前，`spec-lint` 也已有 4 项宿主链接问题；检查新增 Skill 时区分原有和新增错误，不篡改检查器消除报告。

## 新机器安装方向

先复用现有虚拟环境和 lockfile。确需新建工具环境时，可在新的工作目录创建 Python venv，安装相同解包依赖版本；不要把“工具安装成功”当成同版本资源可解密的证明。APK 库、元数据、缓存索引和脚本解密必须来自匹配版本／区服，具体入口见 [解包与 APK](unpack-and-apk.md)。
