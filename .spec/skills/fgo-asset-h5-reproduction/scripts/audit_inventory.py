"""Read-only FGO source/export inventory. No UnityPy or game keys required."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import re


def read_json(path: Path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding='utf-8-sig'))


def inventory(work: Path, cache: Path, project: Path | None):
    bundle_root = work / 'DecryptedAssetBundles'
    bundles = sorted(path.name for path in bundle_root.glob('*.unity3d'))
    names = set(bundles)
    names.update(path.name for path in (work / 'DecryptedNamed').glob('*.unity3d'))
    servants = sorted(match[1] for name in names if (match := re.fullmatch(r'Servants@(\d+)\.unity3d', name)))
    effects = {match[1] for name in names if (match := re.fullmatch(r'NoblePhantasm@(\d+)\.unity3d', name))}
    sequences = {match[1] for name in names if (match := re.fullmatch(r'NoblePhantasm@Sequence@(\d+)\.unity3d', name))}
    cache_files = {path.name for path in cache.iterdir() if path.is_file()} if cache.is_dir() else set()
    indexes = {}
    all_index_files = set()
    for name in ('AssetName.json', 'AudioName.json', 'MovieName.json'):
        path = work / 'Android' / name
        data = read_json(path)
        if data is not None and not isinstance(data, list):
            raise ValueError(f'Expected an array in {path}')
        files = {row['FileName'] for row in (data or []) if isinstance(row, dict) and row.get('FileName')}
        all_index_files.update(files)
        indexes[name] = {'exists': data is not None, 'rows': len(data or []),
                         'cacheMatches': len(files & cache_files), 'referencedFilesAbsent': len(files - cache_files)}

    mapping = read_json(work / 'DecryptedAssetBundles.map.json')
    warnings = []
    if not bundle_root.is_dir():
        warnings.append('DecryptedAssetBundles is absent; source bundles have not been inventoried.')
    if not cache.is_dir():
        warnings.append('Cache directory is absent; zero cache matches does not prove assets are missing elsewhere.')
    report = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'paths': {'work': str(work), 'cache': str(cache), 'project': str(project) if project else None},
        'source': {'bundleFiles': len(bundles), 'servantResourceIds': servants,
                   'servantResourceCount': len(servants), 'nobleEffectIds': sorted(effects),
                   'nobleSequenceIds': sorted(sequences), 'effectSequencePairIds': sorted(effects & sequences),
                   'effectWithoutSequence': sorted(effects - sequences), 'sequenceWithoutEffect': sorted(sequences - effects),
                   'standardCutInBundle': 'NoblePhantasm@CutIns.unity3d' in names,
                   'battleCommonBundle': 'Battle@Common.unity3d' in names,
                   'decryptStatuses': dict(Counter(row.get('Status', 'unspecified') for row in (mapping or [])))},
        'cache': {'exists': cache.is_dir(), 'fileCount': len(cache_files), 'indexes': indexes,
                  'filesNotInTheseIndexes': len(cache_files - all_index_files)},
        'catalog': None,
        'limits': ['Bundle names and catalog flags are inventory evidence, not proof of visual fidelity.',
                   'Effect/sequence IDs need not equal servant IDs; do not infer their association arithmetically.',
                   'Unindexed cache files remain unclassified; this script does not decrypt or identify their content.'],
        'warnings': warnings,
    }
    if project:
        asset_root = project / 'public/assets/dev/fgo-characters'
        catalog_path = asset_root / 'catalog.json'
        catalog = read_json(catalog_path)
        if catalog is None:
            warnings.append(f'No exported character catalog at {catalog_path}')
        else:
            characters = catalog['characters']
            noble_roles = []
            for entry in characters:
                clips = [clip for clip in entry['animations'] if re.fullmatch(r'treasureArms\d+_a', clip['name'])]
                if clips:
                    noble_roles.append({'id': entry['id'], 'name': entry.get('sourceName', entry.get('name')),
                                        'clipCount': len(clips), 'clipNames': [clip['name'] for clip in clips]})
            report['catalog'] = {
                'characterResources': len(characters),
                'animationClips': sum(len(entry['animations']) for entry in characters),
                'formChoices': sum(len(entry['evolutions']) for entry in characters),
                'resourcesWithNobleClips': len(noble_roles),
                'nobleClipCount': sum(role['clipCount'] for role in noble_roles),
                'nobleRoles': noble_roles,
                'registeredFullPerformanceIds': [entry['id'] for entry in characters if entry.get('noblePhantasm')],
                'exportFailures': catalog.get('failures', []),
                'missingModelFiles': [entry['id'] for entry in characters if not (asset_root / entry['asset']).is_file()],
            }
            if len(characters) != len(servants):
                warnings.append('Exported catalog and source servant counts differ; check partial exports or stale generated files.')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work-root', type=Path, required=True)
    parser.add_argument('--cache-root', type=Path)
    parser.add_argument('--project-root', type=Path)
    parser.add_argument('--output', type=Path, help='Optional report file; otherwise print JSON only.')
    args = parser.parse_args()
    work = args.work_root.resolve()
    if not work.is_dir():
        parser.error(f'Work directory does not exist: {work}')
    cache = (args.cache_root or work.parent / 'd713').resolve()
    project = args.project_root.resolve() if args.project_root else None
    try:
        report = inventory(work, cache, project)
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.error(str(error))
    content = json.dumps(report, ensure_ascii=True, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content, encoding='utf-8')
    print(content, end='')


if __name__ == '__main__':
    main()
