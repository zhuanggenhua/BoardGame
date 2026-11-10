"""通过正式增量生成器，只更新根索引内本轮的三个对象。"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
REPLACEMENT=OUT/'replacement-20261015T125417Z'
MANIFEST=ROOT/'public/assets/i18n/assets-manifest.json'
BACKUP=REPLACEMENT/'original/public/assets/i18n/assets-manifest.json'
assert hashlib.sha256(MANIFEST.read_bytes()).digest()==hashlib.sha256(BACKUP.read_bytes()).digest(), '根索引已被其它任务修改'
stage_root=REPLACEMENT/'manifest-stage'
stage=stage_root/'i18n'
stage.mkdir(parents=True,exist_ok=True)
shutil.copy2(BACKUP,stage/'assets-manifest.json')
selection=json.loads((OUT/'selection-preprocessed.json').read_text())
expected=set()
for row in selection['selection']:
    relative=Path(f"zh-CN/dicethrone/images/paladin/compressed/{row['name']}.webp")
    target=stage/relative
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'public/assets/i18n'/relative,target)
    expected.add(relative.with_suffix('').as_posix())
subprocess.run(['node','scripts/assets/generate_asset_manifests.js','--root',str(stage_root),'--id','i18n'],cwd=ROOT,check=True)
before=json.loads(BACKUP.read_text(encoding='utf-8'))
after=json.loads((stage/'assets-manifest.json').read_text(encoding='utf-8'))
changed={key for key in before['files'].keys()|after['files'].keys() if before['files'].get(key)!=after['files'].get(key)}
assert changed==expected,(changed,expected)
assert {k:v for k,v in before.items() if k!='files'}=={k:v for k,v in after.items() if k!='files'}
shutil.copy2(stage/'assets-manifest.json',MANIFEST)
print('Root manifest changed entries:',sorted(changed))
