"""从用户提供的 FGO 参考包生成 Fate 运行时素材。"""

import base64
import gzip
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / '.tmp/FGO-H5-Reproduction.zip'
DEST = ROOT / 'public/assets/fate-domination/fgo/v2'
SOURCE = 'FGO-H5-Reproduction/public/assets/dev/'
CHARACTERS = ('100100', '300100', '400100')


def selected(name: str) -> bool:
    return (any(name.startswith(f'fgo-characters/{character}/') for character in CHARACTERS)
            or name.startswith('fgo-cutscene/np100100/'))


def runtime_image(name: str) -> str:
    path = PurePosixPath(name)
    return str(path.parent / 'compressed' / (path.stem + '.webp'))


def main() -> None:
    if DEST.exists():
        raise SystemExit(f'目标已存在，请先核实，不覆盖：{DEST}')
    with zipfile.ZipFile(ARCHIVE) as archive:
        files = {
            info.filename[len(SOURCE):]: info for info in archive.infolist()
            if info.filename.startswith(SOURCE) and not info.is_dir()
            and selected(info.filename[len(SOURCE):])
        }
        images = {name: runtime_image(name) for name in files if name.endswith('.png')}
        for name, info in files.items():
            data = archive.read(info)
            if name.endswith('.png'):
                target = images[name]
                with Image.open(io.BytesIO(data)) as image:
                    buffer = io.BytesIO()
                    image.save(buffer, 'WEBP', lossless=True, method=4)
                    data = buffer.getvalue()
            elif name.endswith('.json'):
                target = name
                base = PurePosixPath(name).parent
                # 参考数据中的贴图路径相对各自素材根目录，不改动动画数值。
                root = PurePosixPath('fgo-characters') if name.startswith('fgo-characters/') else base
                for original, converted in images.items():
                    try:
                        old = str(PurePosixPath(original).relative_to(root))
                        new = str(PurePosixPath(converted).relative_to(root))
                    except ValueError:
                        continue
                    data = data.replace(old.encode(), new.encode())
                json.loads(data)
                if len(data) > 1024 * 1024:
                    compressed = gzip.compress(data, compresslevel=6, mtime=0)
                    parts = []
                    part_size = 384 * 1024
                    for offset in range(0, len(compressed), part_size):
                        part = f'{name}.parts/{offset // part_size:04d}.json'
                        part_path = DEST.joinpath(*PurePosixPath(part).parts)
                        part_path.parent.mkdir(parents=True, exist_ok=True)
                        encoded = base64.b64encode(compressed[offset:offset + part_size]).decode('ascii')
                        part_path.write_text(json.dumps(encoded), encoding='utf-8')
                        parts.append(part)
                    data = json.dumps({'format': 'fgo-gzip-base64-v1', 'parts': parts}).encode('utf-8')
            else:
                continue
            destination = DEST.joinpath(*PurePosixPath(target).parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)

    entries = []
    for path in sorted(DEST.rglob('*')):
        if path.is_file():
            data = path.read_bytes()
            entries.append({'path': path.relative_to(DEST).as_posix(), 'bytes': len(data),
                            'sha256': hashlib.sha256(data).hexdigest()})
    (DEST / 'manifest.json').write_text(json.dumps({'version': 'v2', 'files': entries}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'已生成 {len(entries)} 个素材，总计 {sum(item["bytes"] for item in entries)} 字节：{DEST}')


if __name__ == '__main__':
    main()
