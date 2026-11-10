"""用正式生成函数重建三个候选，验证结果可复现。"""
from pathlib import Path
import ast
import hashlib
import importlib.util
import json

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
script=ROOT/'scripts/assets/prepare_dicethrone_paladin_preview.py'
ast.parse(script.read_text(encoding='utf-8'))
spec=importlib.util.spec_from_file_location('paladin_preview',script)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sources=json.loads((OUT/'sources.json').read_text(encoding='utf-8'))
selection=json.loads((OUT/'selection-preprocessed.json').read_text())
target=OUT/'replacement-20261015T125417Z/regenerated'
target.mkdir(parents=True,exist_ok=True)
records=[]
for row in selection['selection']:
    dest=target/f"{row['name']}.webp"
    module.write_webp(Path(sources[row['name']]['source']['path']),dest)
    digest=hashlib.sha256(dest.read_bytes()).hexdigest()
    assert digest==row['sha256'],f"正式生成参数未复现候选: {row['name']}"
    records.append({'asset':row['name'],'bytes':dest.stat().st_size,'sha256':digest,'matchesSelected':True})
    print(records[-1],flush=True)
(target.parent/'generator-verification.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
