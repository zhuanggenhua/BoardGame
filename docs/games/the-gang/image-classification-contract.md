# The Gang 图片分类合同

## 口径

- 真相来源：`temp/the-gang-intake/contact-sheets/mapping.csv` 与 10 张低分辨率 contact sheet。
- 本轮没有直接把原始大图交给模型反复读取；分类用于素材 intake 与运行时准入裁定。
- `base-runtime-candidate` 表示可能服务基础版，但不是已接入运行时；不能把候选或阻塞项当作已完成资源。
- 当前合同已被规则对象素材矩阵更新：缩略图、24 个基础筹码、隐藏牌背、52 张牌面、警报、金条、桌面/牌槽和规则参考均已接入运行时或形成脚本参考板接入合同。

## 汇总

| 状态 | 数量 | 含义 |
| --- | ---: | --- |
| base-runtime-locked | 26 | 已锁定进入基础版运行时：缩略图、24 个基础筹码、隐藏牌背 |
| base-runtime-candidate | 56 | 基础版候选或布局参考，当前未接入运行时 |
| expansion-candidate | 30 | 扩展、工具、事件或后续玩法候选 |
| unrelated | 54 | 无关 TTS/音乐/其它游戏/外部装饰素材 |
| decorative | 6 | 背景、纹理、空图或纯装饰素材 |
| blocked | 25 | 低分辨率下无法可靠识别，需要裁图/OCR 或规则表补证据 |

## 运行时准入裁定

| 对象 | 裁定 | 理由 | 后续动作 |
| --- | --- | --- | --- |
| 扑克牌牌面 | 已接入运行时 | #29 已建立 52 张普通扑克牌裁切合同并正式落盘；#184 因重叠/旋转/缺边排除 | 保持 `rank/suit -> 源图/坐标/文件名` 裁切合同与运行时引用 |
| 扑克牌牌背 | 已接入运行时 | `card_portraits.csv` #105 已完成语义命名、正式落盘、压缩、manifest 和 Board 隐藏牌引用 | 页面验证确认隐藏牌背加载真实资源 |
| 白/黄/橙/红 1-6 星筹码 | 已接入运行时 | 基础版 24 个筹码已完成图面核验、语义命名、正式落盘、压缩、manifest 和 Board 筹码按钮引用 | 页面验证确认筹码图片加载真实资源 |
| 0/7/8/exit/扩展筹码 | 不进基础版 | 这些不属于当前基础版必需对象，不能拿来替代基础版警报或金条 | 后续扩展 change 再处理 |
| 庄家标记 | 暂不接入图片 | 当前基础版可用文本/徽章表达庄家；图片 #131 作为候选保留 | UI 精修阶段再决定是否落正式资源 |
| 桌面/牌槽组件 | 已接入运行时 | TTS 原始对象合同锁定 19 个共用 `Custom_Tile` 图片的牌槽对象；完整 playmat 不作为交互层真相源 | `board/slot-tile` 已用于公共牌和摊牌结果承载区 |
| 工具/事件/扩展卡 | 不进基础版 | 属于扩展或附加能力，已拆到后续 change | 后续扩展 change 处理 |
| 无关/装饰素材 | 排除 | 不是 The Gang 基础玩法必要素材 | 不复制、不压缩、不上传 |

## 冲突与待裁定

| 冲突点 | 当前裁定 | 阻塞字段 | 最小补证动作 |
| --- | --- | --- | --- |
| 牌面图片是否必须接入 | 已接入运行时 | 逐张牌面文件与点数花色映射 | 保持 `source-29-card-face-contract.json` 与正式资源 |
| 警报和金条是否能程序化替代 | 已接入真实对象素材 | TTS `Alarm` 对象与 `GoldIngot` 模型对象 | 保持警报贴图合同与金条 OBJ 渲染合同 |
| 扩展卡是否进入本轮 | 不进入基础版 | 工具/事件/扩展卡规则原文与触发语义 | 单独建立扩展规则录入 change |
| TTS 桌面图是否可作为 UI 真相源 | 不能直接作为完整 UI 真相源；牌槽对象素材可接入 | DOM 为空，完整桌面图无法提供交互合同；TTS 牌槽对象有独立合同 | 完整布局仍以规则和现有 UI 合同为准，牌槽视觉使用 `board/slot-tile` |

## 明细

| # | Sheet | 文件名 | 尺寸 | 状态 | 可见分类 | 是否进入基础版运行时 | 下一步 |
| ---: | ---: | --- | --- | --- | --- | --- | --- |
| 1 | 1 | `httpssteamusercontentaakamaihdnetugc456979546401498697D975742481DDE0E2DA86784243A1F49CAAB6CF0.jpg` | 9250x7684 | blocked | 疑似扑克或拼版源图 | 否 | 需要裁图/OCR 后才能判断是否进基础版 |
| 2 | 1 | `httpssteamusercontentaakamaihdnetugc1021122917462126535750A033ACAB90901C7FA1D944908B2A89BC66D600.png` | 8325x7684 | blocked | 疑似扑克点数或筹码总图 | 否 | 需要裁图确认 |
| 3 | 1 | `httpssteamusercontentaakamaihdnetugc135326666965071411811D17D11246EA558F63A7795D7FA9F7DDCFE40FB9.png` | 4096x4096 | blocked | 疑似数字/计数 UI | 否 | 需要裁图确认 |
| 4 | 1 | `httpssteamusercontentaakamaihdnetugc9957657732789178840B75959E6E8F39D781F1FFC8E1EF80E9D2CA8B3E.jpg` | 2224x3108 | blocked | 规则或外部素材拼版 | 否 | 基础版不接入；仅未来视觉复刻或扩展资源 change 需要 OCR |
| 5 | 1 | `httpssteamusercontentaakamaihdnetugc10977373900749790722EBCFA1E46362134F2D2E8EC799FB16A9A88B213D.jpg` | 6752x3706 | blocked | 规则或外部素材拼版 | 否 | 基础版不接入；仅未来视觉复刻或扩展资源 change 需要 OCR |
| 6 | 1 | `httpssteamusercontentaakamaihdnetugc1184549141186079224812DE4068E7C6D1AE8F8E869DCF5EC0801C45E9B6.png` | 4625x2561 | blocked | 规则或外部素材拼版 | 否 | 基础版不接入；仅未来视觉复刻或扩展资源 change 需要 OCR |
| 7 | 1 | `httpssteamusercontentaakamaihdnetugc10518445026819377903E2AD4F917A3EF5EC2FC9A60193E3EA5FE8EB165C.png` | 8325x7684 | blocked | 疑似扑克点数或组件源图 | 否 | 需要裁图确认 |
| 8 | 1 | `httpssteamusercontentaakamaihdnetugc11150178257462815859B26889FF2BB711962C1798B79C870A35A62A80CF.png` | 9250x7684 | pass | 52 张普通扑克牌牌面源图，已建立 `source-29-card-face-contract` 并裁切为基础版牌面 | 是：已语义命名为 `ace-clubs` 到 `king-spades`，落盘到 `public/assets/i18n/zh-CN/the-gang/cards/` 与 `cards/compressed/`，并由 `Board.tsx` 可见牌面引用 | 旧 `blocked/需要裁图确认` 口径错误；不得再把该源图列为未找到或基础版不接入 |
| 9 | 1 | `httpssteamusercontentaakamaihdnetugc11874844131830064782CFFB4FA80FFBD943A1597D75153186E72096F6AF.jpg` | 1253x1724 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 10 | 1 | `httpssteamusercontentaakamaihdnetugc168204724499189050975DF2367C90076C52A211FF4345C6BA5226E7D1F0.jpg` | 1253x1724 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 11 | 1 | `httpssteamusercontentaakamaihdnetugc17890363859445490F5B1B970FEA46A3F5565554B6554B3370E3F0F4.png` | 900x1282 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 12 | 1 | `httpssteamusercontentaakamaihdnetugc13734586999524601530D9213C550E4AF0253841A2B3C346B7031860AC9D.png` | 2000x1000 | base-runtime-candidate | TTS 桌面总览/布局参考 | 否：首期基础版暂不直接接入，作为候选/参考保留 | 只作为布局参考，不直接接入运行时 |
| 13 | 1 | `httpssteamusercontentaakamaihdnetugc26558834947060402CF2130AB515F567366ACDC85CBED44C438C202BD.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 14 | 1 | `httpssteamusercontentaakamaihdnetugc1794100629948335EB43707C87540757CD93CF041F17ABE345711FCC.png` | 1200x1200 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 15 | 1 | `httpssteamusercontentaakamaihdnetugc2279447674645388631F252B8C619921FFDC8534AE2030785341F75A5D1.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 16 | 1 | `httpssteamusercontentaakamaihdnetugc229521027336339557767FA37CBB0603D5979A5E7B0A29BE2776AB4BDA5.png` | 1045x1045 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 17 | 1 | `httpssteamusercontentaakamaihdnetugc134175824741583609261987774F596B41086BECB9256AFECB9A2ABA96BA.jpg` | 5982x2863 | expansion-candidate | Turn It Up 扩展/模式组件 | 否 | 后续扩展 change 裁定 |
| 18 | 1 | `httpssteamusercontentaakamaihdnetugc59204767667192397D1427B684831D2797CB174637D532BCF3335E663.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 19 | 1 | `httpssteamusercontentaakamaihdnetugc102883392520613495015F5CF87613291411D9B40BE8C9FB1C7650AC888F.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 20 | 1 | `httpssteamusercontentaakamaihdnetugc1459839223253777493392B6CD5822E44A58B2CBD806A04129FC4ED2BEB1.png` | 741x1000 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 21 | 2 | `httpssteamusercontentaakamaihdnetugc231547680589076432907A30A5749C12CAA3A8D4AEDC52D7E1C2F472F94.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 22 | 2 | `httpssteamusercontentaakamaihdnetugc2315476471677781069A12BAAAC094B844E5433C71E14878DC5CCB32741.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 23 | 2 | `httpssteamusercontentaakamaihdnetugc239093522700540640528157431B9E11A5A1C4427CDCE66DB9A3CB25256.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 24 | 2 | `httpssteamusercontentaakamaihdnetugc513291764097364930EF357BDDF579A5453D7F96D3AF3A63C5BF13E6D.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 25 | 2 | `httpssteamusercontentaakamaihdnetugc1280533307592862472211EEF42A9E5FC4C1CD280E6B86C9B0BEE996FED2.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 26 | 2 | `httpssteamusercontentaakamaihdnetugc1150705339639850759714E87D279EE60362113C7591928793FB2BCA7C24.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 27 | 2 | `httpssteamusercontentaakamaihdnetugc13046249692238107442113A35FC4257C9FEA5B637A20145FBAE2E9EAB97.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 28 | 2 | `httpssteamusercontentaakamaihdnetugc2315476805894903613D3ECB5971B2677E40ADFBFD059F6F83E2551F70C.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 29 | 2 | `httpssteamusercontentaakamaihdnetugc2315476805890845478A486DAC7EC24BBE42D07BF91FAF529F9C4347224.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 30 | 2 | `httpssteamusercontentaakamaihdnetugc13204342867524070254331CE9F79CFFCA527A1FB2CC626B3A9CEBEE4169.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 31 | 2 | `httpssteamusercontentaakamaihdnetugc157813525487366432472BC61C446576FD2F51D637170C4AF5AF0A1402F0.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 32 | 2 | `httpssteamusercontentaakamaihdnetugc23143531221180088352C2A429A49C77ECA302E29F7519F83BF7EDF82E0.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 33 | 2 | `httpiimgurcomkp8fFK0jpg.jpg` | 1024x1024 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 34 | 2 | `httpssteamusercontentaakamaihdnetugc170309836588525517673707E21E0FDC33AAB465623DCEFDE11C4EC5EE08.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 35 | 2 | `httpssteamusercontentaakamaihdnetugc2315476471678118326E80078FF426DEF79F9D5C758D80E31F4C85228A3.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 36 | 2 | `httpssteamusercontentaakamaihdnetugc1411645409291620757177D2E7E46CB810EBC528E1492E8B270C69A0DA66.jpg` | 8520x2280 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 37 | 2 | `httpssteamusercontentaakamaihdnetugc1107926518229494417325EB9A53ECC5BDB856794068E5A6A287E61C00F4.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 38 | 2 | `httpssteamusercontentaakamaihdnetugc1768379952224664382932B57582E3F9FFE3C94B4BF511C0FDBE608B9E2A.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 39 | 2 | `httpssteamusercontentaakamaihdnetugc2315476471678046668EAAD7014C8F23F47C0F0B4EF5517AF697736B4F7.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 40 | 2 | `httpssteamusercontentaakamaihdnetugc513228340419026258F83BE89197805787934A3BE9E246C17AED80291.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 41 | 3 | `httpssteamusercontentaakamaihdnetugc15158830918378994990588D821856A4024D17BCF72460EFD66F75D02E7E.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 42 | 3 | `httpssteamusercontentaakamaihdnetugc2470878647716255565E78C7AAFC3633A28AA8B13E43664CBD957F47F62.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 43 | 3 | `httpssteamusercontentaakamaihdnetugc17971859058512245D53D063C9B35DFBC429FAA7338B6469FE523023.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 44 | 3 | `httpssteamusercontentaakamaihdnetugc23154768058908011021BDC53C2A8C9A341BB8088B629B2B0480CC91E8A.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 45 | 3 | `httpssteamusercontentaakamaihdnetugc14371430339048293195611231ADEC0F2ABD025F6F0156B63F8E6A884E55.png` | 557x776 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 46 | 3 | `httpssteamusercontentaakamaihdnetugc117085840306283030372818E0C63E6D3708E0729D2C89F2EA06A1512416.png` | 557x776 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 47 | 3 | `httpssteamusercontentaakamaihdnetugc16932209233496101421F9C8DDB9137DC10A2D79F2A75E149B74948C2FC4.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 48 | 3 | `httpssteamusercontentaakamaihdnetugc1005911866522254698407E3118CB3EAB1A9F57186EDCEA21C868984EF9E.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 49 | 3 | `httpssteamusercontentaakamaihdnetugc1651413324307656744854A8B3BC8B46FBE54CF72620278BF442C2E446BC.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 50 | 3 | `httpssteamusercontentaakamaihdnetugc2378551596310340027052D10F4E0758E02BB543A311626483B9793CB68.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 51 | 3 | `httpssteamusercontentaakamaihdnetugc123994372952640156314817E3F6CFD5E3A8189142DF6BC4D4F56FC5FF36.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 52 | 3 | `httpssteamusercontentaakamaihdnetugc10101135416701402732F5794F29DC3AA40F54CEB5C373BB494841527652.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 53 | 3 | `httpssteamusercontentaakamaihdnetugc2376297984911464654C444186C7ED83C3BFBB368CD494F2F6E9CE5ADD6.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 54 | 3 | `httpssteamusercontentaakamaihdnetugc11147621173955549940377DFAE98A1E91C72E2C4D626A235D9A7D28E00E.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 55 | 3 | `httpssteamusercontentaakamaihdnetugc15811818585773844224B06BE9C8DE19ADD0259818816D4033166F49B3DC.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 56 | 3 | `httpssteamusercontentaakamaihdnetugc1713413713707919997064BBE87929E852B93769C4BFC65D23C7AA0BE6DE.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 57 | 3 | `httpssteamusercontentaakamaihdnetugc1579809870894058350718706E5BB00FB834A1395131C70D00C48A36A9E6.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 58 | 3 | `httpssteamusercontentaakamaihdnetugc17265614136479643387C94657960D864228A632AC213F228A896E4F3E5E.png` | 557x776 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 59 | 3 | `httpssteamusercontentaakamaihdnetugc183116387825999458366F8FA14E1CD87F7E87DD429091060D49DB18E297.png` | 557x776 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 60 | 3 | `httpssteamusercontentaakamaihdnetugc146242923925384549318686DA9289241024E1ED711F7A93EC92C6E16A31.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 61 | 4 | `httpssteamusercontentaakamaihdnetugc10363212634879461769E69F1BCA0947B414E337D3BD02BD5043A0A4516A.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 62 | 4 | `httpssteamusercontentaakamaihdnetugc94661913266287061442242AA511356FC9EBC8328E7349E89F1A6CF7CEE.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 63 | 4 | `httpssteamusercontentaakamaihdnetugc127613058794760112467B6E3886C67605399D4EFA01A6F2EA55B5E5A556.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 64 | 4 | `httpssteamusercontentaakamaihdnetugc9751387357493713088D60E57A9BA7CCF74F3B8A20D93081E34A6658B56.png` | 1045x1044 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 65 | 4 | `httpssteamusercontentaakamaihdnetugc1196737308820139365390685318B471634F11A76438B7EBA95E9A1ABE89.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 66 | 4 | `httpssteamusercontentaakamaihdnetugc96756059420292349078DC520C032951E5D79C09F0CD7DE75DD0CB7049B.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 67 | 4 | `httpssteamusercontentaakamaihdnetugc1271932980301033149066C7A89A95E17AA07E13128EFC7C37A09262D50F.png` | 557x557 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 68 | 4 | `httpssteamusercontentaakamaihdnetugc200358913943097816120A648352F788DA73793416C29096DD9EF91CDE4.png` | 1045x1045 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 69 | 4 | `httpssteamusercontentaakamaihdnetugc12694119435681899676646B20A638D79A8E84C41F2AF6CBF131A259C294.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 70 | 4 | `httpssteamusercontentaakamaihdnetugc16075339704440513978E8CBBAE4543ADF919DFFB3BACA203BA7B8266353.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 71 | 4 | `httpssteamusercontentaakamaihdnetugc134562343891251027067EDB5E7D89D29990017F83F0D1ACC03586A42ACB.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 72 | 4 | `httpssteamusercontentaakamaihdnetugc146927010446826864158FDCCAC5D887F5BC84E7B06AFA01BAF6E036FBDC.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 73 | 4 | `httpssteamusercontentaakamaihdnetugc1841227845327862616737A634A6530166FD391966C5FCBF4B47EA497C1C.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 74 | 4 | `httpssteamusercontentaakamaihdnetugc150035692490981368752F9D04199092FC56CAFAA7E55465D57A18E9CFC0.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 75 | 4 | `httpssteamusercontentaakamaihdnetugc16929026118263557891883768427A2ABAC8332499AC9114BCF7CD01601B.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 76 | 4 | `httpssteamusercontentaakamaihdnetugc176695590104210663534FE6E98F8E433003F2DA46017B92C311FD961D04.png` | 998x1000 | expansion-candidate | 工具/事件/扩展卡候选 | 否 | 非基础版运行时资源，后续扩展 change 裁定 |
| 77 | 4 | `httpssteamusercontentaakamaihdnetugc2504654921729737871B8F4233C31C3AB55D3140171B5E2C39C1ACC96A8.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 78 | 4 | `httpssteamusercontentaakamaihdnetugc269475820105111062563C59BB569C8A4C829690BB25418DCA0B281BB3.png` | 1024x1024 | base-runtime-candidate | 盒子/组件图 | 否：首期基础版暂不直接接入，作为候选/参考保留 | 只作为参考或缩略图候选 |
| 79 | 4 | `httpssteamusercontentaakamaihdnetugc141794897711758538454751C619EA1156F86C19A3875569B8151A25DC8A.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 80 | 4 | `httpssteamusercontentaakamaihdnetugc1190368320293635919428D646C88806809FB7C250A1B48C8A57D0E0F2C6.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 81 | 5 | `httpssteamusercontentaakamaihdnetugc16456906754596595115A11D2D5AEB2194346DA76219EDD87C427A4C4F13.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 82 | 5 | `httpssteamusercontentaakamaihdnetugc179718590583945292F511C690E565CC3088D13B83218DE87FFDADDF.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 83 | 5 | `httpssteamusercontentaakamaihdnetugc176534472810051736817F95B647710A37665DDAE25F695C415A1EF1C93E.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 84 | 5 | `httpssteamusercontentaakamaihdnetugc23154768058908446307AFEB0EC9B67E4445A1F99AF1DD28C86AD4E3AA9.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 85 | 5 | `httpssteamusercontentaakamaihdnetugc1749550217963136594437DEFC103AD524652EC3A1B4132F5489A99EF961.png` | 8325x7684 | blocked | 角落局部/无法可靠识别 | 否 | 需要裁图确认 |
| 86 | 5 | `httpssteamusercontentaakamaihdnetugc1385842118791612453743FA2F242BEEC6BFDD7468762E08C1B57A24ED52.png` | 741x1000 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 87 | 5 | `httpssteamusercontentaakamaihdnetugc13118728092159358628491AEBDD9147D47EB212620DDF992D7FCF9E904F.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 88 | 5 | `httpssteamusercontentaakamaihdnetugc125488263509463326271A1DF262466C20D68A27C7745764DAC6008E0667.png` | 741x1000 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 89 | 5 | `httpssteamusercontentaakamaihdnetugc1297610873076916878929B093049FB959DDB2D45E4BEADD28A91614EC5A.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 90 | 5 | `httpssteamusercontentaakamaihdnetugc10623820205292512978C232284A2054B385E571ACCDD28C27C7BF5B4C54.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 91 | 5 | `httpssteamusercontentaakamaihdnetugc513291764087535366B188833832C6DF44D6BFA62F93B622BED0713AC.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 92 | 5 | `httpssteamusercontentaakamaihdnetugc1103987223904217678351D826BC422DEC57988135A0EF87F0A96AB4680D.jpg` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 93 | 5 | `httpssteamusercontentaakamaihdnetugc113609727693316478046FAEA41C755E0AEC2A93554BDD7937C12F44FA24.png` | 998x1000 | expansion-candidate | 工具/事件/规则卡 | 否 | 非基础版运行时资源 |
| 94 | 5 | `httpssteamusercontentaakamaihdnetugc1522600934537450466342A64372509480C5A5724C35F72A4A3F6CC6DDE7.png` | 8325x7684 | blocked | 角落局部/无法可靠识别 | 否 | 需要裁图确认 |
| 95 | 5 | `httpssteamusercontentaakamaihdnetugc11081358720557635249CD76F30BB12B8F76755C63EAF4BCEB41D0DAE17D.jpg` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 96 | 5 | `httpssteamusercontentaakamaihdnetugc2268188042486994795CD56D72C9B87860179E4C2E78D2E613032C1EA3F.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 97 | 5 | `httpssteamusercontentaakamaihdnetugc1557483659531237963243766BBDAF47578DFBEE241C9E40E3834CF54F17.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 98 | 5 | `httpssteamusercontentaakamaihdnetugc128962144506617217764CD6AD6BEB19DE6717162056AD1CD9CCCB701771.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 99 | 5 | `httpssteamusercontentaakamaihdnetugc151065001803428737355DA34BB32F07C9493B61528583FE9F4FC0F8C8B5.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 100 | 5 | `httpssteamusercontentaakamaihdnetugc1146004705444848354465453AC420635F8DB562BA22C4BA129A9B48EF41.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 101 | 6 | `httpssteamusercontentaakamaihdnetugc17844387233252448563AE957D0EE4374A2C1E01699A1C46627646AF80E1.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 102 | 6 | `httpssteamusercontentaakamaihdnetugc14529533356625751410F32EC7C11AE672965104DA87B93C1D0DAC68DC19.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 103 | 6 | `httpssteamusercontentaakamaihdnetugc116317136597655832023587E63614FDE954AE00208C9BC8E9E665960963.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 104 | 6 | `httpssteamusercontentaakamaihdnetugc172688489538957873032E2FBE7144AF761B47EB9B501993AA4089D54BAE.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 105 | 6 | `httpssteamusercontentaakamaihdnetugc135539899052889457213AC79B9CE4C77A2A235C42A2D71410CE48D4B397.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 106 | 6 | `httpssteamusercontentaakamaihdnetugc17810018629909902628B4CC56808A606E3052E08E4453570CC632A16885.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 107 | 6 | `httpssteamusercontentaakamaihdnetugc13724611946288219880AB9D1036F1B72901A1AE83C5B45B7C0BC1ACC74E.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 108 | 6 | `httpssteamusercontentaakamaihdnetugc1653269910491359701963797382C48A14FBEB75936C144F38047F66AF89.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 109 | 6 | `httpssteamusercontentaakamaihdnetugc10961633839351505851FBBD27FEC487317E9DFBA64D06C659CB5A089038.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 110 | 6 | `httpssteamusercontentaakamaihdnetugc1318163399045773701261342053BF368F8B7C120B29506B10DABF88FB5C.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 111 | 6 | `httpssteamusercontentaakamaihdnetugc11221934380700718071461F4808A2345175BEA985BF5C450D36E094FE52.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 112 | 6 | `httpssteamusercontentaakamaihdnetugc11017374334604962960E944BF513C9FF386F32316ED71CA65AA93F24DB5.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 113 | 6 | `httpssteamusercontentaakamaihdnetugc16542727920229874065F0A22452290E9B61D53D5A2D4490E29CB8D4390A.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 114 | 6 | `httpssteamusercontentaakamaihdnetugc17644997680390387588ACC79C7C4DF2A39CB50FFDA72A6E70BBD54C6470.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 115 | 6 | `httpssteamusercontentaakamaihdnetugc99786760335903478528D9C8B59FDBE9D379A6586DAF396FFCCE9D2060E.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 116 | 6 | `httpssteamusercontentaakamaihdnetugc10152143283639704807DCDC6DA11F563476FF9881188AA635B6CF4AB183.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 117 | 6 | `httpssteamusercontentaakamaihdnetugc231547583855646169558483641CFD6563AA494A6DBFA777B59C9B7D1B9.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 118 | 6 | `httpssteamusercontentaakamaihdnetugc13634243838528082421A2AF98DA721B9DC93523D86F34A388AB816C5443.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 119 | 6 | `httpssteamusercontentaakamaihdnetugc14249560630513869147FAC0BFCE71AA3CF7C7B7AE53AD87DE0C01E79510.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 120 | 6 | `httpssteamusercontentaakamaihdnetugc14393830319064649105B79E580DFF4350446AF24424BAE9203C9BF7F829.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 121 | 7 | `httpssteamusercontentaakamaihdnetugc11987405096524596318574FB816D62B89EB7C1B0114ED0F4375322FBC79.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 122 | 7 | `httpssteamusercontentaakamaihdnetugc10786799574894239096F0E97861996C226E63D18A7A7D4D2CAFE7F97304.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 123 | 7 | `httpssteamusercontentaakamaihdnetugc17373869624735383543C4EA49012E5F5AE3F02CDACF2A305D153132DE8F.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 124 | 7 | `httpssteamusercontentaakamaihdnetugc166170615011694107130FE764B860C2B97F21CC94B8BDEC5B18DF10D571.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 125 | 7 | `httpssteamusercontentaakamaihdnetugc178867901473509445408E5B7583E7881D0CCCDA81B8A23681698F404DA9.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 126 | 7 | `httpssteamusercontentaakamaihdnetugc24719867026387595926CDAC5A3E9A8A34B86CF74EAE23FCE29306FF395.png` | 474x474 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 127 | 7 | `httpssteamusercontentaakamaihdnetugc17916234193815972285EA0707D1E7EC527DF9F92CFC77BE23B2F9092476.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 128 | 7 | `httpssteamusercontentaakamaihdnetugc10684311133752477489AE44B9C30CE6B1A33F3494E28C90E634CCBEDA9C.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 129 | 7 | `httpssteamusercontentaakamaihdnetugc16768007231131611572291FD0348C4501026580C7143C948D57A95184DC.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 130 | 7 | `httpssteamusercontentaakamaihdnetugc16175807943331585835CE091524CB49CFB7597DDEE24EFBC7EEE20D7AF4.png` | 741x1000 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 131 | 7 | `httpssteamusercontentaakamaihdnetugc2627237592284412792F45034833D5C0A19658886B51D213D64A28AE30.png` | 709x709 | base-runtime-candidate | 庄家标记 | 否：首期基础版暂不直接接入，作为候选/参考保留 | 基础版可用程序化标记，图片暂不接入 |
| 132 | 7 | `httpssteamusercontentaakamaihdnetugc1113491608288322905618919FC46382FEBE811603A7B25DFEE46494174A.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 133 | 7 | `httpssteamusercontentaakamaihdnetugc11182987155233613566C4B1146DB98A8BF4756E1DF3B17152A07D36B32B.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 134 | 7 | `httpssteamusercontentaakamaihdnetugc456979546314493439BDF22D5715537FD62B82F19A7FCE50F9B5F6A64.jpg` | 420x591 | base-runtime-candidate | 组件/桌面元素 | 否：首期基础版暂不直接接入，作为候选/参考保留 | 只作为布局参考，不直接接入运行时 |
| 135 | 7 | `httpssteamusercontentaakamaihdnetugc15445045831690822843C0B09BF1439004AEC33B04327746C66AE88D9861.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 136 | 7 | `httpssteamusercontentaakamaihdnetugc11269391835149698935297DDBCEB4AC0BC83022FD63475879C102F247B8.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 137 | 7 | `httpssteamusercontentaakamaihdnetugc142005501094194242482182A56BC783B840DFB88DDC0C8B8E8BAA316865.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 138 | 7 | `httpssteamusercontentaakamaihdnetugc107435280755021460130B00B0090FA4239DD119B5FE5330A60D60845BCC.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 139 | 7 | `httpssteamusercontentaakamaihdnetugc12264234665669209442DB0AAA200B6B1D4D1B590D85EA8BDE2B3DE59103.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 140 | 7 | `httpssteamusercontentaakamaihdnetugc11157241499543713167482A610993DC939C479ECAEBC5EABB17D5F200B6.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 141 | 8 | `httpssteamusercontentaakamaihdnetugc120703249530162780979D59EF7E6616306212F1D12AB4D6AFC88ED62F10.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 142 | 8 | `httpssteamusercontentaakamaihdnetugc16791423258341181242B32FB490FAF3D74716B0B668CB9290BEA5032CAD.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 143 | 8 | `httpssteamusercontentaakamaihdnetugc14249171099268012968D09489BB6FC18B479BCDB23EB303A256B3D3DD78.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 144 | 8 | `httpssteamusercontentaakamaihdnetugc17285235853995777955B837CBA1A526F4E8F1721B04C65ADEE27DE20F1A.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 145 | 8 | `httpssteamusercontentaakamaihdnetugc1201705084211415652707DDA4153B526E98DB813A40D49A37A913A2BE48.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 146 | 8 | `httpssteamusercontentaakamaihdnetugc15623154852545790020D34915CCC9B883A3C45BD2DE7BF6F39FFF26A947.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 147 | 8 | `httpssteamusercontentaakamaihdnetugc1005463459123760860764CB76688728D677ED721827C735A5060C7D6652.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 148 | 8 | `httpssteamusercontentaakamaihdnetugc18347545512396143179A6B1DA437CD63B0503FA8F7EF5C3E78C2B375129.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 149 | 8 | `httpssteamusercontentaakamaihdnetugc15455652944305300852A429F3B0B6EBE7CC6A37B75C1C3272275EB3FE3B.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 150 | 8 | `httpssteamusercontentaakamaihdnetugc45697954631449926872393759AC29365160FE8AAE94EA1075274FFDC.jpg` | 420x591 | base-runtime-candidate | 组件/桌面元素 | 否：首期基础版暂不直接接入，作为候选/参考保留 | 只作为布局参考，不直接接入运行时 |
| 151 | 8 | `httpssteamusercontentaakamaihdnetugc1534964144657903748995F138F104AB3E4E4E68915B302BCBA1F71604C2.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 152 | 8 | `httpssteamusercontentaakamaihdnetugc12286229277875785814AE99FEF9BF99FC6D12A57B253220FBD424108528.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 153 | 8 | `httpssteamusercontentaakamaihdnetugc1089670365124162768407FD9536B2AAC710FD7F1977E36EEB3D300817F9.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 154 | 8 | `httpssteamusercontentaakamaihdnetugc14212780619057696158A0089C7FE1FFDB2A3FFFA21CE43A163BCEC55B10.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 155 | 8 | `httpssteamusercontentaakamaihdnetugc132191385358340388715C1A9334D4A38334309B9C63523E55D18B710ACD.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 156 | 8 | `httpssteamusercontentaakamaihdnetugc17427526211488775258C615BCAC316D264D28041081E9C73406E7C7E62B.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 157 | 8 | `httpssteamusercontentaakamaihdnetugc183602425055995252434D471F4A74D09469BA9B8CA97D078BBDB350DCDD.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 158 | 8 | `httpssteamusercontentaakamaihdnetugc15641453187732440859CF4EE14562A417DC916B1A8AD4E5452F4B4F554D.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 159 | 8 | `httpssteamusercontentaakamaihdnetugc17600988817879609125E7331EA45F13BFC5EB9C02C2859067E602BFB23E.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 160 | 8 | `httpssteamusercontentaakamaihdnetugc18023887570746140005A3F4C92E674C8E755B84C2F03631105937D93949.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 161 | 9 | `httpssteamusercontentaakamaihdnetugc155952209303973022080F80372C043991AFC8027565B1D7DB7F95A1DCB5.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 162 | 9 | `httpssteamusercontentaakamaihdnetugc4569795463144976185EFD1E19BB309827CA07F401C90BC49D49A209E.jpg` | 420x591 | base-runtime-candidate | 桌面/牌槽组件 | 否：首期基础版暂不直接接入，作为候选/参考保留 | 只作为布局参考，不直接接入运行时 |
| 163 | 9 | `httpssteamusercontentaakamaihdnetugc4569795463144922545E941D1A875AA291C533BB7F493F39592B71435.jpg` | 420x591 | base-runtime-candidate | 桌面/牌槽组件 | 否：首期基础版暂不直接接入，作为候选/参考保留 | 只作为布局参考，不直接接入运行时 |
| 164 | 9 | `httpssteamusercontentaakamaihdnetugc96800358254966404518984FCE5E970A4B90DAA2A689E739414423F19C9.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 165 | 9 | `httpssteamusercontentaakamaihdnetugc144027579249863107838D94C74EBE631AA7F782676EF4B048B902042723.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 166 | 9 | `httpssteamusercontentaakamaihdnetugc106652262508299861073782110CA412AB99C4D2B1D648A2AF36B5A781B1.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 167 | 9 | `httpssteamusercontentaakamaihdnetugc173434324873388557173323292C86B32B2D73B8993894D99942C9BE1D29.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 168 | 9 | `httpssteamusercontentaakamaihdnetugc1383289909648009793139549CEA71105DD8C481CEEA2DA583F2BCAF127A.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 169 | 9 | `httpssteamusercontentaakamaihdnetugc12104976791784665035E1D7758E9A0F9A0F4CE70B8719EC1709F4B4361F.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 170 | 9 | `httpssteamusercontentaakamaihdnetugc11078717860909085314A4A363EB576F78CCF5EC357F61541FD1814828A3.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 171 | 9 | `httpssteamusercontentaakamaihdnetugc16458568933973505585B0E81D5F14CF30D0AF86B9E3E65F21474F539E50.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 172 | 9 | `httpssteamusercontentaakamaihdnetugc184408611743592467021023266401CFBE1E2A7807E0F93B0B2930635385.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 173 | 9 | `httpssteamusercontentaakamaihdnetugc14904590831411609020381931E2BD782CFB39FBA88FC86714F7AD459722.jpg` | 5982x2863 | decorative | 背景/纹理 | 否 | 不进入基础版运行时 |
| 174 | 9 | `httpsimgfreepikcomfreephotophotogroundtexturepattern5870213741jpg.jpg` | 626x418 | decorative | 背景/纹理 | 否 | 不进入基础版运行时 |
| 175 | 9 | `httpssteamusercontentaakamaihdnetugc121112465663003047051CFB700BEEB458DDAACCB8E4B003728243AA93C3.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 176 | 9 | `httpssteamusercontentaakamaihdnetugc1662728351679747550158FAEA5E5616791C26872BF587E6FC94039CE10F.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 177 | 9 | `httpssteamusercontentaakamaihdnetugc16223853708228978131CE016FBAEABF76032ED02C19E7B27CBE6E12D530.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 178 | 9 | `httpssteamusercontentaakamaihdnetugc14327890135211747723A6013980EA018ED18F7320DCA413D6A96C8B3770.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 179 | 9 | `httpssteamusercontentaakamaihdnetugc122521981228926640068BDC9172E4DBDB77DBE8CCB71EC3509C756DFF8B.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 180 | 9 | `httpssteamusercontentaakamaihdnetugc1687088232373542766807BBB14C14A8D4A67CF1F9FEA330E36575B90A09.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 181 | 10 | `httpssteamusercontentaakamaihdnetugc9896918828875038359EF8717DA90F926BBED892B23556064D43768875C.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 182 | 10 | `httpssteamusercontentaakamaihdnetugc10613945943568826350A768019842DC67D292BAE6503AC5EFC64B159162.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 183 | 10 | `httpssteamusercontentaakamaihdnetugc121536444833636127512CF600F7EA9513F1E8646DEFD0038B2017D77B23.png` | 500x500 | base-runtime-candidate | 筹码/牌背/标记候选簇 | 候选未接入；不属于已锁定的 24 个基础筹码时不得冒充完成资源 | 保留为候选；按规则对象矩阵继续裁定是否为警报、金条、扩展筹码或无关素材 |
| 184 | 10 | `httpiimgurcomAuSbzyDjpg.jpg` | 500x500 | decorative | 背景/纹理/空图 | 否 | 不进入基础版运行时 |
| 185 | 10 | `httpssteamusercontentaakamaihdnetugc1401764526943104534080D51B97E363FF4B436254ECBA441DB671534D72.jpg` | 1084x282 | base-runtime-candidate | 桌面/牌槽条形组件 | 否：首期基础版暂不直接接入，作为候选/参考保留 | 只作为布局参考，不直接接入运行时 |
| 186 | 10 | `httpssteamusercontentaakamaihdnetugc2504655556651574754543602047AF5FABC27E70484CB4D39FD350B6A11.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 187 | 10 | `httpssteamusercontentaakamaihdnetugc229633617325927762854DDCC2DA288CBDFDF453DEC033F31A4E6DC1263.png` | 1045x1045 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 188 | 10 | `httpssteamusercontentaakamaihdnetugc45696505832205890540C52EACE38DF089D3A0608E7E123AA762F47A0.png` | 500x500 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 189 | 10 | `httpssteamusercontentaakamaihdnetugc841461304086487634CB3D46B59C2E8069A12139285FF70F6D81CDCB03.png` | 1024x1024 | decorative | 背景/纹理/空图 | 否 | 不进入基础版运行时 |
| 190 | 10 | `httpssteamusercontentaakamaihdnetugc45696505832205928CB480B08C85FB6425293C4D4E9FC155678BD5B20.png` | 500x500 | blocked | 低分辨率 sheet 无法稳定识别 | 否 | 需裁图/OCR 或按规则表补证据 |
| 191 | 10 | `httpssteamusercontentaakamaihdnetugc841461480713881779CD6C266B339DB1273D2E62EFF216E9AD1280DA2E.png` | 1024x1024 | decorative | 背景/纹理/空图 | 否 | 不进入基础版运行时 |
| 192 | 10 | `httpssteamusercontentaakamaihdnetugc2268188042478734570E6F659C0202FA017F9CBC01B5D05EF8065B36B9A.png` | 1045x1044 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 193 | 10 | `httpssteamusercontentaakamaihdnetugc2039621568219050918329FE6BDC96C00CC6783E81F4402BAAA594F8D84.jpg` | 321x507 | decorative | 背景/纹理/空图 | 否 | 不进入基础版运行时 |
| 194 | 10 | `httpssteamusercontentaakamaihdnetugc2296336173258106565781A9071945ECA94EF512A53DE5908AFE8A672EC.png` | 1045x1045 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 195 | 10 | `httpiconsiconarchivecomiconsdanleechsimple1024steamiconpng.png` | 1024x1024 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 196 | 10 | `httpssteamusercontentaakamaihdnetugc17783359680289797419DA6ABA2450EBDA4E967816C4FA92289A638DB53.png` | 477x478 | unrelated | TTS/音乐/其它游戏封面/装饰来源 | 否 | 排除，不进入 The Gang 基础版运行时 |
| 197 | 10 | `httpssteamusercontentaakamaihdnetugc1763290978418052741896674A67ECAB7F12FD96B08682DBD8F721C36E2D.png` | 16x16 | blocked | 16x16 极小图标/无法可靠识别 | 否 | 基础版排除；未来资源复刻时再判定是否为无效小图 |
