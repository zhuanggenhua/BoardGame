#!/usr/bin/env python3
"""Create and apply a reversible local preview of the refreshed Paladin assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = Path(r"D:\gongzuo\webgame\gameasset\王权骰铸（全26中文角色）\王权骰铸圣骑士")
RUNTIME = ROOT / "public/assets/i18n/zh-CN/dicethrone/images/paladin"
ATLAS_CONFIG = ROOT / "src/assets/atlas-configs/dicethrone/ability-cards-paladin.atlas.json"
BOARD_LAYOUT = ROOT / "src/games/dicethrone/ui/abilitySlotLayout.ts"
MANIFEST = ROOT / "public/assets/i18n/zh-CN/dicethrone/assets-manifest.json"
ROOT_MANIFEST = ROOT / "public/assets/i18n/assets-manifest.json"
ATLAS_COLUMNS = 10
ATLAS_ROWS = 4
CELL_GUTTER = 2

# Source image number for each existing runtime previewRef index (0 through 32).
# This preserves the order consumed by PALADIN_CARDS while using the new source scans.
SOURCE_BY_FRAME = [
    28, 29, 30, 31, 32, 27, 19, 26, 23, 25,
    24, 33, 20, 21, 22, 18, 17, 16, 15, 14,
    12, 11, 13, 10, 9, 8, 7, 6, 5, 4,
    3, 2, 1,
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_webp(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.save(target, "WEBP", quality=95, method=6)


def source_card_path(source: Path, image_number: int) -> Path:
    return source / f"图片{image_number}.png"


def build_atlas(source: Path, target: Path) -> dict:
    first = source_card_path(source, SOURCE_BY_FRAME[0])
    with Image.open(first) as sample:
        card_width, card_height = sample.size
    canvas_width = ATLAS_COLUMNS * (card_width + CELL_GUTTER)
    canvas_height = ATLAS_ROWS * (card_height + CELL_GUTTER)
    atlas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    frames = []

    for index, image_number in enumerate(SOURCE_BY_FRAME):
        card_path = source_card_path(source, image_number)
        with Image.open(card_path) as image:
            if image.size != (card_width, card_height):
                raise ValueError(f"单卡尺寸不一致: {card_path.name}: {image.size}")
            card = image.convert("RGBA")
        col, row = index % ATLAS_COLUMNS, index // ATLAS_COLUMNS
        x = col * (card_width + CELL_GUTTER) + CELL_GUTTER // 2
        y = row * (card_height + CELL_GUTTER) + CELL_GUTTER // 2
        atlas.alpha_composite(card, (x, y))
        frames.append({"x": x, "y": y, "width": card_width, "height": card_height})

    target.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(target, "PNG", optimize=True)
    return {"imageW": canvas_width, "imageH": canvas_height, "frames": frames}


def backup_targets(backup: Path, target_paths: list[Path]) -> dict:
    backup.mkdir(parents=True, exist_ok=False)
    entries = []
    for target in target_paths:
        exists = target.exists()
        relative = target.relative_to(ROOT).as_posix() if target.is_relative_to(ROOT) else None
        saved_copy = backup / "original" / (relative or f"external/{target.name}")
        if exists:
            saved_copy.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, saved_copy)
        entries.append({
            "target": str(target),
            "relative": relative,
            "existed": exists,
            "savedCopy": str(saved_copy) if exists else None,
        })
    return {"entries": entries}


def record_applied_hashes(entries: list[dict]) -> None:
    for entry in entries:
        target = Path(entry["target"])
        entry["appliedSha256"] = sha256(target) if target.is_file() else None


def restore_backup(backup: Path) -> None:
    receipt_path = backup / "receipt.json"
    if not receipt_path.is_file():
        raise FileNotFoundError(f"找不到可恢复的备份收据: {receipt_path}")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    for entry in receipt["entries"]:
        target = Path(entry["target"])
        current_hash = sha256(target) if target.is_file() else None
        if current_hash != entry.get("appliedSha256"):
            raise RuntimeError(f"文件在预览替换后又被修改，拒绝覆盖恢复: {target}")
    for entry in receipt["entries"]:
        target = Path(entry["target"])
        if entry["existed"]:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(Path(entry["savedCopy"]), target)
        elif target.exists():
            target.unlink()
    subprocess.run(
        ["node", str(ROOT / "scripts/assets/generate_asset_manifests.js"), "--root", "public/assets/i18n/zh-CN", "--id", "dicethrone"],
        cwd=ROOT,
        check=True,
    )
    print(f"已恢复旧圣骑士素材和配置。备份保留在: {backup}")


def apply_preview(source: Path, backup_root: Path) -> None:
    if not source.is_dir():
        raise FileNotFoundError(f"新素材目录不存在: {source}")
    required = [source / "面板.png", source / "说明.png"] + [source_card_path(source, n) for n in range(1, 34)]
    missing = [path for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("新素材不完整: " + ", ".join(path.name for path in missing))
    if len(SOURCE_BY_FRAME) != 33 or sorted(SOURCE_BY_FRAME) != list(range(1, 34)):
        raise ValueError("图集帧映射必须一一覆盖图片1-33")

    backup = backup_root / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    targets = [
        RUNTIME / "player-board.png", RUNTIME / "tip.png",
        RUNTIME / "compressed/player-board.webp", RUNTIME / "compressed/tip.webp",
        RUNTIME / "compressed/ability-cards.webp", ATLAS_CONFIG, BOARD_LAYOUT, MANIFEST, ROOT_MANIFEST,
    ]
    receipt = backup_targets(backup, targets)
    entries = receipt["entries"]
    try:
        shutil.copy2(source / "面板.png", RUNTIME / "player-board.png")
        shutil.copy2(source / "说明.png", RUNTIME / "tip.png")
        atlas_png = backup / "generated/ability-cards.png"
        atlas_config = build_atlas(source, atlas_png)
        write_webp(source / "面板.png", RUNTIME / "compressed/player-board.webp")
        write_webp(source / "说明.png", RUNTIME / "compressed/tip.webp")
        write_webp(atlas_png, RUNTIME / "compressed/ability-cards.webp")
        ATLAS_CONFIG.parent.mkdir(parents=True, exist_ok=True)
        ATLAS_CONFIG.write_text(json.dumps(atlas_config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        subprocess.run(
            ["node", str(ROOT / "scripts/assets/generate_asset_manifests.js"), "--root", "public/assets/i18n/zh-CN", "--id", "dicethrone"],
            cwd=ROOT,
            check=True,
        )
        record_applied_hashes(entries)
        receipt.update({
            "source": str(source),
            "createdAtUtc": datetime.now(timezone.utc).isoformat(),
            "sourceByFrame": SOURCE_BY_FRAME,
            "entries": entries,
        })
        (backup / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception:
        for entry in entries:
            target = Path(entry["target"])
            if entry["existed"]:
                shutil.copy2(Path(entry["savedCopy"]), target)
            elif target.exists():
                target.unlink()
        raise

    print("已应用本地圣骑士素材预览：面板、提示图、33 张卡图集。")
    print(f"旧素材和回滚收据: {backup}")
    print(f"新面板尺寸: {Image.open(source / '面板.png').size}；提示图尺寸: {Image.open(source / '说明.png').size}")
    print(f"卡图集尺寸: {atlas_config['imageW']}x{atlas_config['imageH']}；图集帧数: {len(atlas_config['frames'])}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--apply", action="store_true", help="备份并应用本地预览素材")
    group.add_argument("--restore", type=Path, help="使用某次预览目录中的 receipt.json 恢复")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="新素材目录")
    parser.add_argument("--backup-root", type=Path, help="备份根目录，默认写在新素材目录的父目录下")
    args = parser.parse_args()

    if args.restore:
        restore_backup(args.restore.resolve())
        return

    source = args.source.resolve()
    backup_root = args.backup_root.resolve() if args.backup_root else source.parent / "圣骑士预览备份"
    apply_preview(source, backup_root)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"圣骑士素材预览失败: {error}", file=sys.stderr)
        raise
