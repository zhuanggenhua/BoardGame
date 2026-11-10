"""合并逐张人工读图结论，先锁图面身份再改生成器。"""
from pathlib import Path
import json,hashlib
OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[2]
inventory=json.loads((OUT/'inventory.json').read_text(encoding='utf-8'))
audits=[json.loads((OUT/name).read_text(encoding='utf-8')) for name in ['audit-00-10.json','audit-11-21.json','audit-22-32.json']]
items=[row for audit in audits for row in audit['items']]
assert sorted(row['frame'] for row in items)==list(range(33))
assert all(row['status'] not in ['partial','blocked'] for row in items)
actual_by_card={row['identifiedRuntimeCardId']:row for row in items}
assert len(actual_by_card)==33,'图面身份必须一一覆盖33张运行时卡'
planned=[]; diffs=[]
for old in inventory['frames']:
    card=old['expected']; actual=actual_by_card[card['id']]
    planned.append({'index':old['frame'],'cardId':card['id'],'sourceNumber':actual['sourceNumber'],
       'actualTitle':actual['actualTitle'],'actualCpCost':actual['actualCpCost'],'actualTimingColor':actual['actualTimingColor'],
       'bodyText':actual['bodyText'],'sourceFrameBeforeFix':actual['frame'],'sourceCrop':actual['sourceCrop'],
       'sourceCropSha256':actual['sourceCropSha256'],'runtimeCpCost':card['cpCost'],'runtimeTiming':card['timing'],
       'discrepancies':actual.get('discrepancies',[]),'mappingStatus':'locked','sourceDisposition':'runtime',
       'cropDisposition':'reference'})
    assert actual['actualCpCost']==card['cpCost'],f"身份核对后的费用仍冲突：{card['id']}"
    if old['sourceNumber']!=actual['sourceNumber']:
        diffs.append({'index':old['frame'],'cardId':card['id'],'wrongSourceNumber':old['sourceNumber'],
                     'correctSourceNumber':actual['sourceNumber'],'wrongTitle':next(row['actualTitle'] for row in items if row['frame']==old['frame']),
                     'correctTitle':actual['actualTitle']})
assert [d['index'] for d in diffs]==[8,10,20,21,22]
(OUT/'locked-mapping.json').write_text(json.dumps({'scope':'33张卡图身份/费用/source/index；不等同全部规则实现审计','agents':[a.get('agentId') for a in audits],
    'sourceByFrame':[row['sourceNumber'] for row in planned],'changes':diffs,'cards':planned},ensure_ascii=False,indent=2),encoding='utf-8')
lines=['# 圣骑士卡牌图集录入核对','',
'## 范围与真相源','',
'- 日期：2026-10-15；现场：BoardGame 当前 main 工作区；源图包：`D:/gongzuo/webgame/gameasset/王权骰铸（全26中文角色）/王权骰铸圣骑士/图片1.png` 至 `图片33.png`。',
'- 正式主图：`public/assets/i18n/zh-CN/dicethrone/images/paladin/compressed/ability-cards.webp`；专属坐标：`src/assets/atlas-configs/dicethrone/ability-cards-paladin.atlas.json`。',
'- 本轮完整读取33张原PNG同源完整单卡；裁图是读图证据，进入正式运行时的是完整原图重新排版后生成的WebP，不发布裁片。',
'- 原始图集及正式图集hash、裁图坐标、每张源/运行时裁图路径与hash，见 `evidence/圣骑士卡图错配/20261015T142510Z/inventory.json`；逐字读取记录见同目录 `audit-00-10.json`、`audit-11-21.json`、`audit-22-32.json`。',
'- 下表锁定图面卡牌身份、费用和运行时索引；完整正文与颜色/时机保留在逐卡记录。声明式 target、共享handler和分类差异不凭静态字段推定规则错误，单独记录，不冒充圣骑士全规则审计。',
'- `runtime`：图片1–33全部进入正式atlas；`reference`：对应66张源图/正式WebP核对裁图；没有排除、重复或不可读对象。','',
'## 已锁定图面身份到运行时索引','',
'| 运行时index | 卡牌ID | 新图源编号 | 图面标题 | CP | 图面类型/时机 | 映射状态 |',
'| ---: | --- | ---: | --- | ---: | --- | --- |']
for row in planned:
    lines.append(f"| {row['index']} | `{row['cardId']}` | 图片{row['sourceNumber']} | {row['actualTitle']} | {row['actualCpCost']} | {row['actualTimingColor'].replace('|','/')} | locked |")
lines+=['','## 修正的错配','',
'| index | 原错图 | 正确图 | 原因 |','| ---: | --- | --- | --- |']
for d in diffs:
    lines.append(f"| {d['index']} | 图片{d['wrongSourceNumber']}：{d['wrongTitle']} | 图片{d['correctSourceNumber']}：{d['correctTitle']} | 生成器源编号排列错误，运行时卡牌ID/索引未变 |")
lines+=['','## 完整图面原文与消费','']
for row in planned:
    lines += [f"### index {row['index']} / {row['cardId']} / 图片{row['sourceNumber']}",'',
      f"- 图题：{row['actualTitle']}；费用：{row['actualCpCost']}CP；{row['actualTimingColor']}。",
      f"- 来源：原始图集修复前frame{row['sourceFrameBeforeFix']}；完整单卡hash `{row['sourceCropSha256']}`。",
      '- 处置：图面卡牌身份/费用/骰面和图标正文消费到同名运行时卡牌；图案原样进入正式atlas。核对裁片为reference，不接运行时。','',
      '```text',row['bodyText'],'```','']
    if row['discrepancies']:
        lines+=['差异登记（不自动等同图序错误）：','',json.dumps(row['discrepancies'],ensure_ascii=False,indent=2),'']
lines+=['## 验收状态','',
'- 图面卡牌全集：33/33；源编号全集：1–33，一一对应；5个错误映射已定位，修正方案已锁定。',
'- 正式生成、全部帧重新核对、真实手牌/放大入口和远端发布结果：见同批evidence后续收据；本合同不先行宣称已发布或线上已修复。','']
target=ROOT/'src/games/dicethrone/rule/圣骑士卡牌录入核对.md'
target.write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'changes':diffs,'sourceByFrame':[r['sourceNumber'] for r in planned]},ensure_ascii=False,indent=2))
