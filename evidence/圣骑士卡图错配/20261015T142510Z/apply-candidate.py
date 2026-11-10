from pathlib import Path
import json,shutil,subprocess,hashlib
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
candidate=json.loads((OUT/'candidate-receipt.json').read_text(encoding='utf-8'))
before=json.loads((OUT/'before-receipt.json').read_text(encoding='utf-8'))
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
for row in before:
    expected={row['sha256']}
    if Path(row['path']).suffix=='.webp': expected.add(candidate['webpSha256'])
    assert digest(row['path']) in expected,'生成候选后正式文件又被修改，拒绝覆盖'
stage=OUT/'manifest-stage';assets=stage/'public/assets'
generator=stage/'scripts/assets/generate_asset_manifests.js';generator.parent.mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'scripts/assets/generate_asset_manifests.js',generator)
for row in before:
    relative=Path(row['path']).relative_to(ROOT/'public/assets')
    dest=assets/relative;dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(candidate['webp'] if relative.suffix=='.webp' else row['path'],dest)
for args in [['--root',str(assets/'i18n/zh-CN'),'--id','dicethrone'],['--root',str(assets),'--id','i18n']]:
    subprocess.run(['node',str(generator),*args],cwd=ROOT,check=True)
    subprocess.run(['node',str(generator),*args,'--validate'],cwd=ROOT,check=True)
changes=[]
for row in before:
    target=Path(row['path']);staged=assets/target.relative_to(ROOT/'public/assets')
    if target.suffix=='.json':
        old=json.loads(target.read_text(encoding='utf-8'));new=json.loads(staged.read_text(encoding='utf-8'))
        assert {k:v for k,v in old.items() if k!='files'}=={k:v for k,v in new.items() if k!='files'}
        assert set(old['files'])==set(new['files'])
        changed=[key for key in old['files'] if old['files'][key]!=new['files'][key]]
        expected_key='zh-CN/dicethrone/images/paladin/compressed/ability-cards' if target.parent.name=='i18n' else 'images/paladin/compressed/ability-cards'
        assert changed==[expected_key],changed
        changes.append({'manifest':str(target),'changedKeys':changed})
for row in before:
    target=Path(row['path']);staged=assets/target.relative_to(ROOT/'public/assets')
    shutil.copy2(staged,target)
result={'applied':True,'webpSha256':digest(before[0]['path']),'bytes':Path(before[0]['path']).stat().st_size,'manifestChanges':changes}
assert result['webpSha256']==candidate['webpSha256']
(OUT/'applied-receipt.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
