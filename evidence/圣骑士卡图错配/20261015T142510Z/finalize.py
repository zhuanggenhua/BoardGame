from pathlib import Path
import json,hashlib
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
def read(name):return json.loads((OUT/name).read_text(encoding='utf-8'))
review=read('browser-all-media-review.json')
assert review['status']=='PASS' and len(review['media'])==7
assert read('delivery-review.json')['verdict']=='APPROVE'
assert not read('frame-identity-after.json')['mismatchFrames']
assert all(row['matches'] for row in read('public-verification.json'))
assert all(row['checksumMatches'] and all(c['matches'] for c in row['checks']) for row in read('android-index-verification.json'))
media_dir=ROOT/'test-results/evidence-screenshots/dicethrone/paladin-card-art-review.e2e/圣骑士五张错配卡的正式手牌与放大入口'
files=['圣骑士五张修正卡_出牌前手牌.jpg','圣骑士_正义战法二级_正式放大卡面.jpg','圣骑士_正义战法三级_正式放大卡面.jpg',
       '圣骑士_惊不惊喜_正式放大卡面.jpg','圣骑士_不愧是我_正式放大卡面.jpg','圣骑士_意不意外_正式放大卡面.jpg','圣骑士_正义战法二级_扣2CP并升级成功.jpg']
descriptions=['出牌前五张手牌费用与对应卡面一致','正义战法二级完整卡面与两点费用清晰可读','正义战法三级完整卡面与四点费用及执着子区清晰可读',
              '惊不惊喜显示两点费用及改变任意一颗骰子的正文','不愧是我显示一点费用及重掷至多两骰的正文','意不意外显示三点费用及改变任意两骰的正文',
              '正义战法二级已落入技能槽且左侧行动点由十降到八']
index={'gameId':'dicethrone','evidenceCategory':'independent','media':[]}
for i,(file,desc) in enumerate(zip(files,descriptions)):
    index['media'].append({'path':str(media_dir/file),'chainId':'paladin-card-art-mapping','chainStep':str(i+1),
      'sourceRun':'e2e/dicethrone/paladin-card-art-review.e2e.ts / 圣骑士五张错配卡的正式手牌与放大入口',
      'sourceDir':str(media_dir),'stage':'前态' if i==0 else '后态' if i==6 else '中态','role':'main-flow','viewport':'desktop',
      'transition':'合法主要阶段代表态' if i==0 else '拖动正式手牌并由规则结算升级' if i==6 else '玩家点击正式手牌进入放大后关闭',
      'description':desc,'gameId':'dicethrone','evidenceCategory':'independent'})
(media_dir/'.e2e-image-index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding='utf-8')
manifest={'verdict':'PASS','scope':'current-user-request','scopeDescription':'圣骑士33张卡图身份核对及5张错配卡的手牌/放大修复；不涵盖已延期的玩法差异',
 'gameId':'dicethrone','evidenceCategory':'independent','evidenceIndex':str(media_dir/'.e2e-image-index.json'),
 'display':{'purpose':'final-user-visible-delivery','trigger':'task-final-delivery','viewer':'web','finalPassBeforeOpen':True},
 'requirements':[{'requirement':'五张错配牌在正式手牌和放大入口显示正确卡面、费用及正文','status':'PASS','evidence':files},
                 {'requirement':'正义战法二级实际打出后扣除两点行动点并落入正确技能槽','status':'PASS','evidence':['browser-assertions.json：CP10→8、等级1→2、升级来源card-righteous-combat-2']},
                 {'requirement':'源图身份映射33张一致且线上对象/Android素材索引对应修正版','status':'PASS','evidence':['frame-identity-after.json','public-verification.json','android-index-verification.json']}],
 'media':[str(media_dir/file) for file in files],
 'visualReview':{'mode':'all-media','claimScope':'interaction-ui','status':'PASS','reviewer':{'kind':'subagent','id':'/root/audit_frames_11_21'},'reviewFile':'browser-all-media-review.json'},
 'behavioralVerification':{'owner':'vitest','status':'PASS','commands':['node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/paladin-abilities.test.ts --configLoader native'],
 'evidence':['19项既有技能定义测试通过，含正义战法II主伤害5/III主伤害6及执着变体差异。','E2E另直接断言CP10→8、等级1→2；不是由截图证明数值结算。']}}
(OUT/'pass-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
verification={'vitest':{'command':manifest['behavioralVerification']['commands'][0],'passed':19,'failed':0},
 'e2e':{'command':'node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/paladin-card-art-review.e2e.ts --workers=1','passed':1,'failed':0},
 'visual':{'media':7,'subagent':'/root/audit_frames_11_21','verdict':'PASS'},
 'resourcePublish':{'jobId':'f09e900d-7c5d-4525-af00-a0deab4b4741','release':'20261015144311320','objects':1,'uploaderExitCode':0},
 'runtimeWebpBytes':2040596,'totalThreeAssetsBytes':3086552,'localeDelivery':'本地修改，尚未提交/部署前端版本','ruleChanges':'无，用户选择先修图序和明确文案'}
(OUT/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf-8')
doc=ROOT/'src/games/dicethrone/rule/圣骑士卡牌录入核对.md'
text=doc.read_text(encoding='utf-8')
text+='\n## 本轮消费修正与完成边界\n\n'
text+='- 生成器仅修正index8/10/20/21/22；卡牌ID、运行时previewRef.index、技能/规则效果和atlas坐标保持。33张原图身份与修正后正式WebP逐帧对应。\n'
text+='- 中文英雄专属卡名同步图面：威势、祝圣、神佑、神的恩宠；赦免中英文说明修正为剑3伤害、头盔防3、心防5、祈祷防2并获得2CP，保留“仅能在被攻击后打出”；教皇税笔误修正为教会税。前面的差异登记保留为修复前历史，以上项目现已在本地文案修正。\n'
text+='- 旧正式图的5个对应位置已复看，确认旧顺序为正义战法III/II、惊不惊喜/不愧是我/意不意外；新图修正恢复同一索引语义，保留新图尺寸和压缩方案。\n'
text+='- 用户明确选择本轮先修图序和明确错误文案；威势选人、部分通用卡作用范围/时机等既存玩法差异列为scoped-debt，见runtime-differences.json，未宣称已修复。\n'
text+='- 资源：上传1个卡图对象成功，公开URL4种请求的hash/大小/尺寸一致；Android edge/stable索引校验和、卡图及玩家板/提示板条目均与本地一致。\n'
text+='- 验证：33张人工读图；修复前5处失败/修复后33帧匹配；真实手牌/放大E2E1项、既有技能定义Vitest19项通过；7张整屏经子代理逐图PASS。数值差分为行动点10→8、等级1→2。\n'
text+='- 图集资源已发布；locale文案尚待前端版本发布。证据见同批verification.json/pass-manifest.json，不把资源发布等同代码发布或整英雄规则收口。\n'
doc.write_text(text,encoding='utf-8')
readme=OUT/'README.md';text=readme.read_text(encoding='utf-8')
text+='\n## 修复与验证结果\n\n'
for change in read('locked-mapping.json')['changes']:
    text+=f"- index {change['index']} / {change['cardId']}：图片{change['wrongSourceNumber']}「{change['wrongTitle']}」改为图片{change['correctSourceNumber']}「{change['correctTitle']}」。\n"
text+='\n- 开工时最后正常尚未锁定；已补读旧正式WebP的5张完整单卡，见legacy-reference.json/legacy-five-full-cards.png，确认旧顺序语义正确。此次等价恢复旧索引含义，不还原旧低分辨率图。\n'
text+='- 首个偏移：bb2779b45的SOURCE_BY_FRAME在生成新图时错误排列5个编号；数量一一覆盖校验仍能通过。既有E2E只检查ability-cards.webp加载和少量升级动作，没有把每张图片身份与卡牌ID/费用/效果逐一绑定。后续压缩继续消费了这张未完整核对的图集，少数压缩抽样也不能证明全牌库映射正确。\n'
text+='- 原有data-entry规则已覆盖完整单对象、当前图逐槽合同、索引/消费映射、不可读阻塞和替换资源验收；规范入口与相关条款可达。问题是语义核对步骤和验收覆盖被绕过，本轮补齐33张合同及消费证据，不再增加重复“必须看清楚”条款。\n'
text+='- 源图登记/audit-*.json：33张完整牌面全部已读；frame-identity-before.json：28/33匹配，5处红证据；frame-identity-after.json：33/33匹配。\n'
text+='- candidate-receipt.json：正式图7380×4720、2,040,596字节，比之前仅增加706字节；三图总计3,086,552字节。全部源图可见RGB/alpha拼入新PNG时完全一致。\n'
text+='- 上传成功：release20261015144311320/job f09e900d-7c5d-4525-af00-a0deab4b4741；公开4条GET与Android两个渠道索引回查均匹配。网页已经缓存旧URL图像时仍需强制刷新，不能由公网新响应推断用户已有缓存已失效。\n'
text+='- 实际E2E1项通过，5张正式手牌逐一放大，再真实拖动正义战法II，CP10→8且等级1→2；7张整屏已全量AI核图。相关既有Vitest19项通过。\n'
text+='- 中文4个英雄卡名、教会税笔误、赦免中英文旧数值已在本地修正；未提交/推送/部署前端，不能声称线上文案已更新。\n'
text+='- 用户选择限定范围：先修图序和明确错误文案。runtime-differences.json中较早的目标范围/时机缺口保持后续范围；状态牌target:self的静态疑点已排除，不扩大规则改动。\n'
text+='- 无关七大恨修改、其暂存状态及既有压缩改动保留。独立交付审查APPROVE，见delivery-review.json。\n'
readme.write_text(text,encoding='utf-8')
print('已写最终验证记录、7图索引和PASS清单；补齐数据合同完成边界。')
