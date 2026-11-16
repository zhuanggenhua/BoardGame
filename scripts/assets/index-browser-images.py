"""整理浏览器 pageAssets 导出的图片，按文件内容去重并生成离线索引。"""

import argparse
import hashlib
import html
import json
import shutil
from pathlib import Path
from urllib.parse import quote


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="pageAssets 导出的 manifest.json")
    parser.add_argument("output", type=Path, help="新的输出目录")
    args = parser.parse_args()

    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    assets = [a for a in data["assets"] if a.get("kind") == "image"]
    if not assets:
        raise SystemExit("清单中没有图片")
    # 先核实全部输入，再创建输出，避免留下看似成功的不完整目录。
    records = []
    for asset in assets:
        path = Path(asset["path"])
        payload = path.read_bytes()
        records.append((asset, path, hashlib.sha256(payload).hexdigest()))

    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / "images").mkdir()
    unique = {}
    for asset, source, digest in records:
        if digest not in unique:
            filename = digest + source.suffix.lower()
            shutil.copyfile(source, args.output / "images" / filename)
            unique[digest] = {"file": filename, "sources": []}
        unique[digest]["sources"].append({"name": asset["name"], "url": asset["url"]})

    entries = list(unique.values())
    (args.output / "index.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    cards = []
    for entry in entries:
        source = entry["sources"][0]
        image = quote("images/" + entry["file"], safe="/")
        name = html.escape(source["name"])
        url = html.escape(source["url"], quote=True)
        cards.append(f'<figure><a href="{url}"><img loading="lazy" src="{image}" alt="{name}"></a><figcaption>{name}</figcaption></figure>')
    page = '<!doctype html><meta charset="utf-8"><title>游戏 UI 图片索引</title><style>body{font:14px sans-serif;background:#171a20;color:white}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}figure{margin:0;background:#292d36;padding:8px;overflow-wrap:anywhere}img{width:100%;height:auto}figcaption{padding-top:8px}</style><h1>游戏 UI 图片索引</h1><main>' + ''.join(cards) + '</main>'
    (args.output / "index.html").write_text(page, encoding="utf-8")
    print(f"输入 {len(records)} 张，去重后 {len(entries)} 张，完全重复 {len(records) - len(entries)} 张。")
    print(args.output.resolve() / "index.html")


if __name__ == "__main__":
    main()
