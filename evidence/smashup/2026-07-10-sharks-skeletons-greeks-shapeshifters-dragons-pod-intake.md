# 大杀四方五族 POD 卡图录入证据

## 范围

本轮用户提供五张 POD 卡图：鲨鱼、骷髅、希腊神话、变形者、龙。五张图均按 `4 x 5`、row-major 解析为 20 个物理卡槽。龙族沿用活跃 change `add-smashup-dragons-superheroes-magical-girls-mega-troopers-pod`，其余四族由 `add-smashup-sharks-skeletons-greeks-shapeshifters-pod` 承载。

## 真相源

| 派系 | 源图尺寸 | SHA-256 | 正式文件 |
| --- | --- | --- | --- |
| 鲨鱼 | 3750 x 4200 | `3A176F4109BA219EBCB7BF59498A253CB6D16977A7DE03B9E32AB71FE17BCAE3` | `public/assets/i18n/en/smashup/cards/sharks_pod.png` |
| 骷髅 | 1876 x 2100 | `4FCFEDDA0230418B37CBA4DF4DA2BD889EAD2776A3E8984D6967B1B57CAE10E8` | `public/assets/i18n/en/smashup/cards/skeletons_pod.png` |
| 希腊神话 | 3750 x 4200 | `A7CAE381519C53A4D4F103203BB5A5F1BB1AABBFA19B57EB81D02A559E8F0BF9` | `public/assets/i18n/en/smashup/cards/mythic_greeks_pod.png` |
| 变形者 | 3750 x 4200 | `EE5B80F58A857FA326997545C4F13F01A122FB0E3D390C7926F5588245F39279` | `public/assets/i18n/en/smashup/cards/shapeshifters_pod.png` |
| 龙 | 3750 x 4200 | `3B7A5D5A132E2AC2D67B61E8496CD87C58DC5B29C24BD3E20E96D18938724996` | `public/assets/i18n/en/smashup/cards/dragons_pod.png` |

## 槽位合同

### 鲨鱼

- 0 血腥水域 x2；2 撕裂；3 鱼饵；4 疯狂进食；5 激光束；6 飞鲨；7 危险水域；8 鲨鱼周 x2。
- 10 灰鲭鲨 x4；14 锤头鲨 x3；17 大白鲨 x2；19 巨齿鲨。

### 骷髅

- 0 诡异。可怕。x2；2 殉葬品 x2；4 往下埋；5 墓园；6 灵车队伍；7 墓碑；8 墓地爆发；9 他们出来了。
- 10 轮回者 x4；14 复仇者 x3；17 守墓人 x2；19 骸骨之王。

### 希腊神话

- 0-9 依次为哈迪斯、阿瑞斯、阿佛洛狄忒、狄俄尼索斯、雅典娜、赫尔墨斯、宙斯、赫拉、阿波罗、波塞冬的恩惠。
- 10 阿尔戈英雄 x4；14 斯巴达人 x3；17 赫拉克勒斯；18 伊阿宋；19 奥德修斯。

### 变形者

- 0 变形 x2；2 基因转变 x2；4 有丝分裂；5 ……你确定？；6 甲壳比赛；7 拼接很美子；8 细胞结合；9 巴卡塔维持的未来。
- 10 模仿者 x4；14 变形者 x3；17 G.E.L.F. x2；19 相似者。

### 龙

- 0 烧毁它；1 废墟 x2；3 夷平；4 险地；5 侧翼攻击；6 威压；7 龙之领地；8 推倒城墙 x2。
- 10 幼龙 x4；14 帝国龙 x3；17 飞龙 x2；19 巨龙。

## 共享玩法结论

逐图核对后，五套 POD 卡牌的玩法合同与仓库现有基础版定义一致。数据层使用完整 `_pod` 定义；能力、交互、持续效果、力量修正和基地能力通过 `SMASHUP_VARIANT_BINDING_PROFILES` 显式标记为 `shared`，基地池保持 `separate`。鲨鱼 POD 继续复用旋齿鲨，不创建重复泰坦。

## 验证状态

- `sharksSkeletonsGreeksShapeshiftersDragonsPodIntegration.test.ts`：7/7 通过。
- `openspec validate add-smashup-sharks-skeletons-greeks-shapeshifters-pod --strict --no-interactive`：通过。
- `npm run i18n:check`：通过。
- `npm run typecheck`：通过。
- `npm run assets:validate`：通过。
- R2 差异检查：执行 `npm run assets:check` 时返回 `401 Unauthorized`。当前工作区没有 `.env`，`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME` 均未配置，因此没有执行上传或远端 `HEAD 200` 回查。
- 真实入口 E2E：因既定资源发布链在 R2 鉴权步骤失败，本轮停在该失败点，未拿未发布资源继续冒充完整交付。
