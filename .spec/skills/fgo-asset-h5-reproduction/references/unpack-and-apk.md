# 解包与 APK 代码分析

## 1. 环境和输入

只处理用户提供的本地 APK、缓存和表数据。优先复用现有输出；整理流程不要求重解密全部原始文件。第三方工具按只读使用，新增适配器写在工程自有目录。

本机所用工具与版本见 [本机入口](local-workspace.md)。新的工具环境可按下面方式建立，Python／.NET／Node 本身缺失时按目标工程要求安装，不把编辑器 Unity 作为解包前置：

```powershell
python -m venv "$fgoWork/.venv"
& "$fgoWork/.venv/Scripts/python.exe" -m pip install UnityPy==1.25.3 Pillow==12.3.0
# 仅在需要原生方法／指令分析时安装：
& $fgoPython -m pip install capstone==5.0.9 pyelftools unicorn
```

不要在已有 venv 上为整理文档重建环境。FGOAssetsModifyTool 的本机程序集目标为 .NET 6；先用 `dotnet --list-runtimes` 判断是否可直接运行。可执行文件和配套依赖 DLL 必须一起保留，不单拷 exe。

工具缺失时，从原项目获取到专用工具目录。下面是本次核查的项目布局；换版本先看实际 csproj，不修改它以绕过编译问题：

```powershell
$fgoTools = "$fgoWork/Tools"
git clone https://github.com/hexstr/FGOAssetsModifyTool "$fgoTools/FGOAssetsModifyTool"
dotnet build "$fgoTools/FGOAssetsModifyTool/FGOAssetsModifyTool/FGOAssetsModifyTool.csproj" -c Release -o "$fgoTools/FGOAssetsModifyTool-bin"
```

已有源码与二进制可用时不重 clone／build。编译只生成工具产物，不修改第三方 cs／csproj；需要诊断不兼容时用临时副本。UnityPy 可直接读原 bundle；AssetStudio 等可视化工具只在需要人工看对象时使用，不作为脚本导出的必装前提。

确认以下输入各自的来源：

- `d713` 内的哈希缓存文件是素材候选，和同区服／版本 AssetStorage 配合识别。
- `AssetStorage.txt` 是加密索引，不是图片包。解密成功后才有资源名与哈希文件的映射。
- master／FGOData 仓库提供表与脚本逻辑，不等于有 Unity bundle、音频、视频。
- APK 的游戏代码、metadata 和内置资源可以补部分默认特效／绘制规则，但不保证包含后续下载的从者宝具。
- CN／JP／EN 的解密配置不能混用。现有研究记录中本地缓存由 CN 解密成功，不因角色原始名是日文就改用 JP。

## 2. 本地 AssetStorage 解密与映射

本机第三方源码和二进制在外部工作区：

```text
E:/zhanggenhua/temp/jiebao/.cache/FGOAssetsModifyTool/FGOAssetsModifyTool/
  Program.cs
  CatAndMouseGame.cs
  Configuration.cs
  bin/Debug/net6.0/FGOAssetsModifyTool.exe
```

菜单号来自该版本 `Program.cs`，换版本要重读菜单分支。该工具是交互程序，**没有有效的 `--help` CLI**，启动参数不会把它切换为帮助模式。

```powershell
$fgoDecryptExe = 'E:/zhanggenhua/temp/jiebao/.cache/FGOAssetsModifyTool/FGOAssetsModifyTool/bin/Debug/net6.0/FGOAssetsModifyTool.exe'
Set-Location -LiteralPath $fgoWork
& $fgoDecryptExe
```

工具按当前目录找 `Android` 等文件夹。现有数据要重做时先备份输出；新输入先在独立 staging 工作目录中放置 `Android/AssetStorage.txt`，避免覆盖已验证结果。

在交互菜单中：

1. `67`：选择 CN；当前版本 `69` 是 EN，没有 `68` 切换分支。其他区服设置回查该版本源码，不编造菜单号。
2. `5`：读取 `Android/AssetStorage.txt`，调用 `MouseGame8`，写 `Android/AssetStorage_dec.txt`。
3. `6`：解析解密索引，写 `AssetName.json`、`AudioName.json`、`MovieName.json` 及 extra-key 类型索引。

检查解密文本的版本行、CSV 列结构和 JSON 是否可解析，再运行盘点脚本核对哪些哈希文件真实存在。名字在索引里、文件不在缓存里，应报告缺失本地资源，不算解密失败。

## 3. bundle 解密和命名

该版本工具的真实批量入口：

- 菜单 `0` 载入本地 `assetbundleKey.json` 和 extra-key 类型映射；不是“选择解密模式”。
- 菜单 `2` 扫描当前工作目录的 `Android/*.bin`，调用 `MouseGame4`，输出 `Decrypted/`，保留哈希文件名；带额外 key 的资源按索引分支处理。
- 菜单 `1` 是重新加密，不是本任务的解包命令。

因此不能对着 `d713` 直接输入 `2` 就声称会生成命名的 `DecryptedAssetBundles/`。新批次可用工程自有适配器／staging 执行以下确定流程：

1. 读取 AssetName 数组中的 `AssetName`／`FileName`；只处理缓存中存在的 bundle 候选。AudioName 对应的 CPK、MovieName 对应的 CRID 和 `.data` 伴随文件不要送入 bundle 解密。
2. 在 staging 的 `Android/` 准备选中的哈希 `.bin` 和匹配的配置／extra-key 索引；使用对应区服。不得修改原始缓存和第三方解密源码。
3. 通过现有工具的 `MouseGame4` 分支解密。先用一个已知样本验证，再按用户目标批量做；JP 或新版本缺少 extra-key 时不能静默降级。
4. 检查输出头及 `UnityPy.load` 能否读取。Unity 对象计数和名称是成功证据，单纯生成非空文件不够。
5. 按映射把成功输出命名为 `<AssetName>.unity3d`，拒绝路径穿越和文件名冲突；记录 `AssetName`、`FileName`、`Output`、`Status`、`Bytes` 到 map JSON，失败单独保留。

当前 725 个命名 bundle 及 `DecryptedAssetBundles.map.json` 已存在、均记录 `ok`。历史中生成它们的完整批处理 wrapper 未保存／未找到；本 Skill 记录上述实际调用链和缺口，不把菜单 `2` 冒充已验证的“一键原样重建 725 个命名输出”工具。无需为了使用现成素材重跑这一阶段。

## 4. master、剧情脚本与战斗入口

- 菜单 `8` 从本地准备好的游戏数据解包到 `Android/gamedata/unpack_master/`；本机已有 441 个表文件。检查菜单分支要求的本地输入，不为补表自动执行联网菜单 `3`、`4`。
- `mstSvt` 用于角色身份；`mstTreasureDevice` 等用于演出关系；`mstBattleScript.script` 可含 `CHARA_UP`、`cameraTargetData`、`targetNodeName`、`cutInId` 等。
- ADV 的 `charaCutinPause`／`charaCutinStart` 和战斗的 `CHARA_UP`／`cutInId` 是两条入口，不因都叫 cut-in 就混为一套资源。
- 先从 ScriptAction bundle 的 TextAsset 导出加密文本。工具菜单 `10` 读取 `Android/Scripts/**/*.txt`，用当前区服 `MouseGame3` 写 `DecryptedScripts/`；不是直接读 bundle。
- 当前 `Android/Scripts` 已无输入，`DecryptedScriptsCN/` 有 1664 个历史输出，但对应 wrapper／导出链未保存完整。保留有效输出；新批次在工程适配器中显式记录 bundle、TextAsset 名、解密区服和输出路径。
- 在原脚本中找到切入 ID 后，沿 `Effect@CutIn@…`、从者、相机／动作、专用 NP／Sequence 逐项检查实际文件。FGOData 表有条目而本地没有 bundle 时，记录资源名和哈希，不生成替代素材。

## 5. APK 提取和原生证据

先读 APK ZIP 条目、文件大小和剩余空间，再只提取需要的架构、metadata 和 `assets/bin/Data/`。保留版本、ABI 和 SHA-256。路径先归一化到目标目录，拒绝 `..`；不要解压覆盖原 APK。

本机已有 `2.129.0-armv7`、`2.129.0-arm64` 和 `2.129.0-UnityData`。ARM64 目录有 `global-metadata.dat`、`libil2cpp.so`、`libunity.so`；ARMv7 目录当前至少保留了 `libil2cpp.so`。不要假设两个架构的文件齐全或 metadata 已经是标准格式。

诊断工具在外部目录 `E:/zhanggenhua/temp/jiebao`，它们是工程自有脚本，但含当前版本路径／解码假设：

| 脚本 | 用途及限制 |
| --- | --- |
| `scan_fgo_apk_assets.py` | 从固定 APK 提取 UnityData 并扫描对象；会写文件、加载整目录，不是只读 `--help` 工具 |
| `map_fgo_methods.py` | 在当前 ARM64 metadata／ELF 中找类型与方法；metadata 路径固定，`--binary` 不能自动切换 metadata 版本／架构 |
| `inspect_fgo_native.py` | 查字符串、符号或指定地址指令；支持 `--binary`、`--address`、`--size`，需分清 VA 与文件偏移 |
| `map_unity_icalls.py` | 在 ARM64 libunity 中解析指定 icall，受 ELF 重定位格式限制 |
| `probe_fgo_mesh_matrix.py` | 通过 Unicorn 执行已定位的网格矩阵组合尾段；地址、存储偏移和解码方式固定，只证明所测尾段 |

安全参数入口（不会实际分析或导出）：

```powershell
& $fgoPython 'E:/zhanggenhua/temp/jiebao/map_fgo_methods.py' --help
& $fgoPython 'E:/zhanggenhua/temp/jiebao/inspect_fgo_native.py' --help
& $fgoPython 'E:/zhanggenhua/temp/jiebao/map_unity_icalls.py' --help
& $fgoPython 'E:/zhanggenhua/temp/jiebao/probe_fgo_mesh_matrix.py' --help
```

当前版本的有范围分析示例；输出仍放目标工程 test-results：

```powershell
& $fgoPython 'E:/zhanggenhua/temp/jiebao/map_fgo_methods.py' UVScroll USFGOChrColorChangeEvent USFGOTimeScaleEditEvent --out "$boardProject/test-results/fgo-methods.json"
& $fgoPython 'E:/zhanggenhua/temp/jiebao/map_unity_icalls.py' 'UnityEngine.ParticleSystemRenderer::get_lengthScale' --out "$boardProject/test-results/fgo-icalls.json"
& $fgoPython 'E:/zhanggenhua/temp/jiebao/probe_fgo_mesh_matrix.py' --out "$boardProject/test-results/fgo-native-mesh-matrices.json"
```

Il2CppDumper 6.7.46 已在 `work/Tools/`，但下载或启动成功不等于已完整 dump。IL2CPP metadata／代码可能受保护：先验证头、节边界、注册表和方法地址是否匹配。不能看到磁盘上的指令异常就认定动画 clip 加密，也不能把内置 Unity 引擎行为当成必有可读 C# 源码。

对需要恢复的公式，在 `ClientApk/<version>-<abi>/analysis/` 找已有 provenance／方法与反汇编记录，回查源二进制的版本和哈希；换版本重新定位。区分游戏事件逻辑、Unity 原生模块和网页显示调整，避免用最后一类去“证明”前两类。
