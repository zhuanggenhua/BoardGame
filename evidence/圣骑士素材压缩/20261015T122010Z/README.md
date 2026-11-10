# 圣骑士 WebP 压缩方案实测

目标状态：complete
当前目标：找出兼顾兼容性、体积和可读性的圣骑士素材压缩方案，并按用户授权先替换当前已验证方案。
非当前历史背景：最初反馈为 DiceThrone 变卡；本报告不把离线压缩收益当作线上卡顿修复。
禁止自动接管：本次三图发布已获授权；不得自动扩大到其它角色、反馈回写、共享压缩默认值或降采样正式素材。
更新时间：2026-10-15

## 最新状态：已替换线上

用户已明确要求“你先替换一下，现在至少好一点”。已备份并替换正式目录内三张 WebP，更新本地两级 manifest，并将相同处理参数接入既有 `prepare_dicethrone_paladin_preview.py`。用正式生成函数重建三图，SHA-256 与已验收候选完全一致。

- 当前三图：**3,085,846 字节**，比替换前 12,292,110 字节少 **74.90%**。分辨率、alpha 与图集坐标不变，原始 PNG 未修改。
- 发布范围：仅 `official/i18n/zh-CN/dicethrone/images/paladin/compressed/ability-cards.webp`、`player-board.webp`、`tip.webp`。
- 公开回查：旧客户端版本查询、新版本查询、Android 直连源各三次，共 **9 个 GET**，全部 `200`，大小和 SHA-256 与候选一致。
- Android `edge` / `stable` 最新游戏 manifest 均指向 **0.6.4-dicethrone-idx-04b563a73e5e**；两个 file-index 的整体 checksum 及三个目标条目的 hash/size 全部一致。
- 发布命令发生过连接重置，按现有流程降级 128 KiB / 单并发后执行。服务器实际发布 release `20261015130007729` 并刷新两渠道索引，但在收尾日志 `Object.keys(assetIndex)` 处报 `ReferenceError`，上传 CLI 最终返回 503/退出 1。因此不把命令退出码说成成功；替换生效结论来自上述公开文件与索引的独立核验。此服务器收尾日志故障尚未修复。
- 本次没有提交或推送代码，没有部署整个应用或发布 OTA；静态图片与 Android 差异素材索引已生效。完整冷缓存进房耗时与原反馈的卡顿尚未复测。

备份和证据位于 `replacement-20261015T125417Z/`：receipt.json、generator-verification.json、public-image-verification.json、android-index-verification.json。以下“未替换/未发布”的表述均为发布前实验阶段状态，不代表当前状态。

## 目标与证据边界

- 问题对象：本次替换的圣骑士 ability-cards、player-board、tip 三张图片。
- 真相源：替换脚本、源 PNG、替换前备份和当前正式 WebP；尺寸、大小与 SHA-256 见 sources.json。
- 目标环境：当前主工作区的离线压缩候选比较；格式固定为已有运行链使用的静态 WebP。
- 验收：比较原尺寸编码体积，检查完整单卡、文字/数字/图标、角色板和透明边缘；核对全部帧和 alpha；做浏览器解码检查。
- 历史正常：备份证明旧图集 1860×2048、357952 字节；旧板 2048×1250、517586 字节；旧提示 1113×2048、317698 字节。尚无原反馈的设备、房间或卡顿 trace，因此线上原症状未复现。
- 保护项：新素材语义、33 帧映射、尺寸、alpha 和运行时引用不变；不引入 AVIF。

## 实验 owner

实验阶段脚本只负责可重现的比较，不作为新的正式素材入口。替换阶段按本轮授权修改了三张正式派生素材、既有 Paladin 生成函数和对应两级索引，远端实际状态见上方最新状态。正式压缩 owner 仍为 scripts/assets/compress_images.py 及现有 Paladin 生成脚本。

## 复现

```powershell
python -X utf8 evidence/圣骑士素材压缩/20261015T122010Z/prepare.py
node evidence/圣骑士素材压缩/20261015T122010Z/benchmark.cjs pilot
```

## 推荐方案与实测结果

**补测后的当前推荐：保护高对比边缘的轻度去噪预处理，再使用下面的静态 WebP 参数。三张合计 3,085,846 字节（3.09 MB），比当前 12.29 MB 少 74.90%，比第一轮 4.16 MB 再少 25.79%。**

| 对象 | 第一轮只调编码 | 补测保边预处理 | 原始尺寸 |
| --- | ---: | ---: | --- |
| 卡牌图集 | 2,723,654 | 2,039,890 | 7380×4720 |
| 角色板 | 1,188,936 | 859,280 | 4005×2476 |
| 提示板 | 245,436 | 186,676 | 967×1804 |
| 合计 | 4,158,026 | **3,085,846** | 全部保持 |

新候选位于 `selected-preprocessed/compressed/`，压缩包为 `paladin-webp-preprocessed.zip`，校验信息为 selection-preprocessed.json。原 4.16 MB 编码候选仍保留作比较。两组候选均未替换正式素材，未发布。

预处理不依赖手动 Photoshop。脚本在派生 PNG 上用 Canny 90/180 的边缘加 3×3 膨胀保护高对比细节，并保护透明边界，仅对其它位置使用 sigma=0.9 的轻度 Gaussian 平滑。高对比边缘掩模并不能等同于“全部文字像素”，也不能宣称逐字无损。源 PNG 不变，派生图 alpha 不变；去噪会削弱纸纹和扫描细节。

新增 6 组样本比较：普通 Gaussian sigma=0.4/0.6、保边 sigma=0.6/0.9、两档 bilateral。直接 sigma=0.6 模糊虽更小，但图像边缘误差明显增加，已排除；保边 sigma=0.9 样本比第一轮再省 26.09%，进入完整图片实测。过程见 preprocess-metrics.json。

完整 3 图的尺寸、alpha 与原图一致，预处理保护掩模内的 RGB 在 WebP 编码前与源图一致，详见 preprocess-full-metrics.json。最终有损编码的边缘亮度 RMSE 比第一轮增加约 3–5%，这项代价换取约 26% 的额外体积下降；不能称为画质完全不变。

人工复看了新候选完整卡牌帧 0/32、角色板与提示板整图，以及两张板的原生尺寸文字对照，抽查文字、数字、图标仍可辨。证据为 preprocessed-frame-0-pair.png、preprocessed-frame-32-pair.png、preprocessed-*-text-comparison.png 和 preprocessed-*-overview.png。本机 Chromium 完成全部三图解码和图集 33 帧非空裁片，见 browser-verification-preprocessed.json；没有真机或线上性能结论。

新候选总量仍为旧交付 1,193,236 字节的约 **2.59 倍**。这进一步证明固定原尺寸时预处理仍有收益，也说明不能因为文件更小就宣称已经达到旧版体积或解决原始线上卡顿。

### 原图比较口径纠正

- 角色板原 PNG：旧 **9,831,345 字节、3160×1929**，新 **16,660,274 字节、4005×2476**；文件约 1.69 倍、像素约 1.63 倍。
- 提示板原 PNG：旧 7,347,544 字节、1526×2807，新 3,799,573 字节、967×1804；新原图反而更小。
- 旧卡牌原 PNG 未找到，不能用旧 WebP 交付图冒充旧原图。前述 9.14 倍仅比较新卡牌图集像素与旧版已缩小 WebP 的像素，不是新旧原图的普遍比例。原图对照见 raw-source-comparison.json。

Photoshop 的 Reduce Noise 也可调节降噪与细节保护，见 [Adobe 官方说明](https://helpx.adobe.com/photoshop/desktop/effects-filters/artistic-stylize-filters/reduce-image-noise-and-jpeg-artifacts.html)。本次收益来自确定性的预处理，而非重新另存或依赖特定软件。

### 第一轮编码参数（补测继续沿用）

静态 WebP 有损编码，原始像素尺寸保持不变，alpha 无损保留：

```js
sharp(source).webp({
  quality: 75,
  effort: 6,
  preset: 'text',
  smartSubsample: true,
  alphaQuality: 100,
})
```

以上只是本批素材经比较后的参数，不是跨游戏的新默认值。使用仓库已安装 sharp 0.34.5 / libwebp 1.6.0，没有新增项目依赖；原生成脚本的 Pillow 使用 libwebp 1.3.2。

| 对象 | 当前 WebP 字节 | 推荐 WebP 字节 | 十进制 MB | 像素尺寸 |
| --- | ---: | ---: | ---: | --- |
| 33 张卡图集 | 8,452,896 | 2,723,654 | 2.72 | 7380×4720 |
| 角色板 | 3,095,888 | 1,188,936 | 1.19 | 4005×2476 |
| 提示板 | 743,326 | 245,436 | 0.25 | 967×1804 |
| 合计 | 12,292,110 | 4,158,026 | 4.16 | 全部保持源尺寸 |

第一轮方案节省 **66.17%**。已生成 `selected/compressed/*.webp` 与 `paladin-webp-selected.zip`；SHA-256 见 selection.json。当前更省体积的推荐见本节开头。

## 为什么选择这组参数

首轮用 3 张完整单卡、角色板文字区和提示板文字区组成不缩放样本，共比较 18 组：质量 65/70/75/80/82/85/90/95、sharp YUV、text/drawing 预设、自动去块、无损与近无损。随后对三张完整源图比较 5 组，共 15 个完整候选。

| 完整候选 | 合计字节 | 判断 |
| --- | ---: | --- |
| 普通 q85 | 6,215,876 | 更接近原纹理，但当前体积目标下收益不足 |
| 普通 q80 | 4,977,724 | 可用，体积比推荐方案多约 20% |
| 普通 q75 | 3,908,448 | 最小的完整入围候选，字体/图标边缘误差较大 |
| sharp YUV q75 | 3,958,386 | 比普通 q75 稍大，整体指标变化有限 |
| text + sharp YUV q75 | **4,158,026** | 推荐；比普通 q75 多约 6.4% 字节，图像边缘亮度误差降低约 15–17% |

这里的边缘误差为源图 Canny 边缘附近的亮度 RMSE，不只统计文字。它与人工查看的文字清晰度共同支持选择，不能单独证明可读性。扫描纸纹、图画纹理也会影响 SSIM；例如提示板 text-q75 的整体亮度 SSIM 为 0.8912，低于普通 q75 的 0.9021，但文字区边缘误差更小。该方案是有损压缩，不能称为逐像素画质不变。

样本 q65 出现更明显的字边柔化；相对 q75 节省继续收窄，因此没有作为完整候选。样本近无损约 2.88 MB、无损约 4.20 MB，均明显大于推荐样本约 0.57 MB；近无损样本还未保持 alpha 逐像素一致，因此排除。自动去块与独立 sharp YUV 均未带来足以替代推荐方案的收益。

## 核图与结构校验

- 对全部 15 个完整候选检查源尺寸与 alpha：全部一致，详见 full-metrics.json。
- 对推荐图集逐帧检查 33 帧：尺寸均为 736×1178，alpha 全部与源图逐像素一致，详见 frame-metrics.json。
- 完整单卡核图：样本帧 0、以及推荐整图中 SSIM 最低的帧 24/32/17；另查看帧 12 文字区、角色板整体和文字区、提示板整体与文字区。标题、数字、费用、规则文字和图标在所查区域保持可辨，边缘、颜色没有发现明显异常。扫描纹理细节有所损失。
- 原生尺寸对照：compare-*-text.png；误差最高的完整单卡对照：worst-frame-24-pair.png、worst-frame-32-pair.png、worst-frame-17-pair.png。不是全部 33 张卡都做了人工逐字审查。
- 本机 Chromium 完成 3 张推荐图及 3 张当前图的解码；当前与推荐图集各 33 帧 Canvas 裁片均非空。详见 browser-verification.json。
- 浏览器首跑因诊断页是 about:blank，读取跨来源 Canvas 报 tainted；改为同源本机页面后通过，没有关闭浏览器安全策略。这是诊断入口问题，不能视为线上 CORS 故障。
- 检查实验前后正式源图和当前 WebP 的哈希一致；没有修改运行时路径和 atlas 配置。

## 兼容性与性能边界

当前与推荐交付均是静态 WebP（VP8X + ALPH + VP8），没有增加 AVIF、动画或其它客户端解码格式要求。text、sharp YUV 和 effort 都是服务端编码选择，不要求客户端安装新解码器。

参考：MDN [WebP 格式与兼容性](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types#webp_image)、Google [cwebp 参数](https://developers.google.com/speed/webp/docs/cwebp)、Sharp [WebP 输出选项](https://sharp.pixelplumbing.com/api-output#webp)。保留现有 WebP 兼容范围，不承诺所有历史浏览器支持；Safari/iOS/Android 真机尚未实测。

该实验直接证明下载字节减少和本机解码成功。图集仍有 3480 万像素，完整 RGBA 表面的理论像素存储仍约 133 MiB；此方案没有证明移动端内存下降，也未复测原反馈的线上入口或静态资源路由。不能把候选生成称为线上卡顿已修复。

## 历史纠正

已找到替换前二进制备份。旧图集像素数量约为新图集的 1/9.14，旧板/旧提示的最长边也均为 2048。

更早版本压缩器（`git show fd6e57fba^:scripts/assets/compress_images.py`）默认 `IMAGE_WEBP_QUALITY=82`、`IMAGE_MAX_EDGE=2048`。这与之前只检查替换前一版 runtime 默认值 95 是两份不同时间的证据，不能由后者推出旧二进制一定也是 q95。

用旧源 PNG、q82、最长边 2048 和当前 Pillow/libwebp 复现后，旧板生成 517692 字节（备份 517586），旧提示生成 317596 字节（备份 317698），均尺寸吻合、体积极接近，但 SHA-256 不相同。因此只能确认旧默认配置及旧文件尺寸，不能宣称精确复现了旧编码过程。详见 old-encoder-reproduction.json。

提示板这次的源尺寸其实比旧交付尺寸更小，但文件更大，也表明体积增长不能全部归因于尺寸；编码参数、源图纹理与透明通道共同参与决定字节数。

## 复现后续步骤

```powershell
node evidence/圣骑士素材压缩/20261015T122010Z/benchmark.cjs full default-q75 default-q80 default-q85 sharp-yuv-q75 text-q75
python -X utf8 evidence/圣骑士素材压缩/20261015T122010Z/analyse.py full default-q75 default-q80 default-q85 text-q75 sharp-yuv-q75
python -X utf8 evidence/圣骑士素材压缩/20261015T122010Z/rank_frames.py
node evidence/圣骑士素材压缩/20261015T122010Z/verify.cjs
python -X utf8 evidence/圣骑士素材压缩/20261015T122010Z/preprocess.py full
node evidence/圣骑士素材压缩/20261015T122010Z/preprocess-encode.cjs full
python -X utf8 evidence/圣骑士素材压缩/20261015T122010Z/preprocess-full-verify.py
node evidence/圣骑士素材压缩/20261015T122010Z/verify.cjs preprocess
```

本轮只完成方案选择与候选交付。若进入正式替换，应沿现有资源 owner 接入这些参数，更新受影响 manifest、校验远端对象与移动包索引，再回到原线上入口复测；不应把实验脚本提升为第二套正式压缩流程。本轮不需要新增规范或修改全局默认质量。
