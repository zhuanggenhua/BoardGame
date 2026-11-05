"""Read original Unity bundles and retain reconstruction evidence, without editing them."""
import argparse
import collections
import json
from pathlib import Path

import UnityPy


def inspect_bundle(path):
    env = UnityPy.load(str(path))
    objects = list(env.objects)
    scripts = {
        obj.path_id: obj.read().m_ClassName
        for obj in objects if obj.type.name == 'MonoScript'
    }
    result = {'source': str(path), 'counts': dict(collections.Counter(
        obj.type.name for obj in objects)), 'clips': [], 'sequenceRecords': []}
    for obj in objects:
        if obj.type.name == 'AnimationClip':
            clip = obj.read()
            result['clips'].append({
                'pathId': str(obj.path_id), 'name': clip.m_Name,
                'duration': clip.m_MuscleClip.m_StopTime,
                'bindings': len(clip.m_ClipBindingConstant.genericBindings),
            })
        elif obj.type.name == 'MonoBehaviour':
            tree = obj.read_typetree()
            script = scripts.get(tree.get('m_Script', {}).get('m_PathID'))
            if (script in {'USFGOPlayStandardCutInEvent', 'MultiplyTargetMatrix',
                           'XWeaponTrail', 'SimpleAnimation'}
                    or tree.get('affectedObjectPath') == '/CutIns/Start_nf'
                    or tree.get('propertyName') == 'eulerAngles'):
                result['sequenceRecords'].append({'script': script, 'data': tree})
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--work', type=Path, default=Path(r'E:\zhanggenhua\temp\fgo\work'))
    parser.add_argument('--output', type=Path, default=Path('test-results/fgo-source-audit.json'))
    args = parser.parse_args()
    report = [inspect_bundle(args.work / folder / (name + '.unity3d'))
              for folder, name in [
                  ('DecryptedAssetBundles', 'Servants@100100'),
                  ('DecryptedAssetBundles', 'NoblePhantasm@100101'),
                  ('DecryptedAssetBundles', 'NoblePhantasm@Sequence@100101'),
                  ('DecryptedNamed', 'NoblePhantasm@CutIns'),
              ]]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=True), encoding='utf-8')
    print(args.output)


if __name__ == '__main__':
    main()
