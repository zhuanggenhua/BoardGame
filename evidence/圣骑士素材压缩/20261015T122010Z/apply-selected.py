"""按本轮授权备份并应用已验收的三个派生 WebP。"""
from pathlib import Path
from datetime import datetime,timezone
import hashlib
import json
import shutil

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
RUNTIME=ROOT/'public/assets/i18n/zh-CN/dicethrone/images/paladin/compressed'
selection=json.loads((OUT/'selection-preprocessed.json').read_text())
sources=json.loads((OUT/'sources.json').read_text(encoding='utf-8'))
names={'ability-cards','player-board','tip'}
assert {r['name'] for r in selection['selection']}==names
digest=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
for row in selection['selection']:
    assert digest(row['file'])==row['sha256'], '候选文件已变化'
    assert digest(RUNTIME/f"{row['name']}.webp")==sources[row['name']]['baseline']['sha256'], '正式 WebP 已被其它任务改动'

backup=OUT/'replacement-20261015T125417Z'
backup.mkdir(exist_ok=False)
targets=[RUNTIME/f'{name}.webp' for name in sorted(names)]+[
    ROOT/'scripts/assets/prepare_dicethrone_paladin_preview.py',
    ROOT/'public/assets/i18n/zh-CN/dicethrone/assets-manifest.json',
    ROOT/'public/assets/i18n/assets-manifest.json']
entries=[]
for target in targets:
    relative=target.relative_to(ROOT)
    saved=backup/'original'/relative
    saved.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(target,saved)
    entries.append({'target':str(target),'backup':str(saved),'beforeSha256':digest(target)})
receipt={'authorizedScope':'替换已验收的圣骑士三个压缩 WebP，同步生成参数及索引，发布并回查公开文件与素材包索引',
         'truth':'selection-preprocessed.json 与用户当轮先替换的指令',
         'environment':str(ROOT),'acceptance':'目标文件 hash/尺寸/alpha、manifest、公开 GET 与包内索引一致',
         'createdAtUtc':datetime.now(timezone.utc).isoformat(),'entries':entries}
(backup/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
for row in selection['selection']:
    target=RUNTIME/f"{row['name']}.webp"
    shutil.copy2(row['file'],target)
    assert digest(target)==row['sha256']
    print(row['name'],target.stat().st_size,row['sha256'])
print('backup',backup)
