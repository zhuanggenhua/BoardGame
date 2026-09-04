#!/usr/bin/env python3
"""Create PureRef-friendly labeled copies for ordered screenshot handoff."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:  # pragma: no cover - environment guard
    raise SystemExit("Pillow is required: python -m pip install pillow") from exc


INVALID_NAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]+')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate full-size labeled screenshot copies and an order index for PureRef."
    )
    parser.add_argument("--out-dir", required=True, help="Directory for labeled output files.")
    parser.add_argument("--title", default="截图顺序", help="Title shown on the optional index image.")
    parser.add_argument("--image", action="append", default=[], help="Image path. Repeat in display order.")
    parser.add_argument("--label", action="append", default=[], help="User-facing label. Repeat to match --image.")
    parser.add_argument(
        "--transition",
        action="append",
        default=[],
        help="What changed from the previous image. Repeat to match --image.",
    )
    parser.add_argument(
        "--manifest",
        help=(
            "Optional JSON manifest. Accepts a list of paths, a list of {path,label}, "
            "or an object with title/items/images."
        ),
    )
    parser.add_argument("--no-index", action="store_true", help="Skip generating 00-sequence-index.png.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing labeled files.")
    return parser.parse_args()


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path(r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\msyhbd.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
        Path(r"C:\Windows\Fonts\arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                return ImageFont.truetype(str(candidate), size)
            except OSError:
                continue
    return ImageFont.load_default()


def sanitize_filename(value: str, fallback: str) -> str:
    cleaned = INVALID_NAME_CHARS.sub("-", value).strip(" .")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:90] or fallback


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> int:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    if text_width(draw, text, font) <= max_width:
        return [text]

    lines: list[str] = []
    current = ""
    for char in text:
        candidate = current + char
        if current and text_width(draw, candidate, font) > max_width:
            lines.append(current)
            current = char
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:2]


def truncate_to_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> str:
    if text_width(draw, text, font) <= max_width:
        return text
    suffix = "..."
    trimmed = text
    while trimmed and text_width(draw, trimmed + suffix, font) > max_width:
        trimmed = trimmed[:-1]
    return (trimmed + suffix) if trimmed else suffix


def manifest_entries(manifest_path: Path) -> tuple[str | None, list[dict[str, str]]]:
    data: Any = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    title: str | None = None
    raw_items: Any = data

    if isinstance(data, dict):
        title = data.get("title")
        raw_items = data.get("items", data.get("images", []))

    if not isinstance(raw_items, list):
        raise SystemExit("Manifest must contain a list, items list, or images list.")

    entries: list[dict[str, str]] = []
    for item in raw_items:
        if isinstance(item, str):
            entries.append({"path": item, "label": "", "transition": ""})
        elif isinstance(item, dict):
            path = item.get("path") or item.get("image") or item.get("file")
            if not path:
                raise SystemExit(f"Manifest item is missing path: {item!r}")
            transition = item.get("transition") or item.get("relation") or item.get("note") or ""
            entries.append({"path": str(path), "label": str(item.get("label", "")), "transition": str(transition)})
        else:
            raise SystemExit(f"Unsupported manifest item: {item!r}")
    return title, entries


def collect_entries(args: argparse.Namespace) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    if args.manifest:
        manifest_title, manifest_items = manifest_entries(Path(args.manifest))
        if manifest_title and args.title == "截图顺序":
            args.title = manifest_title
        entries.extend(manifest_items)

    if args.image:
        if args.label and len(args.label) != len(args.image):
            raise SystemExit("--label count must match --image count.")
        if args.transition and len(args.transition) != len(args.image):
            raise SystemExit("--transition count must match --image count.")
        for index, image in enumerate(args.image):
            label = args.label[index] if index < len(args.label) else ""
            transition = args.transition[index] if index < len(args.transition) else ""
            entries.append({"path": image, "label": label, "transition": transition})

    if not entries:
        raise SystemExit("Provide at least one --image or --manifest entry.")

    for index, entry in enumerate(entries, 1):
        path = Path(entry["path"]).expanduser().resolve()
        if not path.exists() or not path.is_file():
            raise SystemExit(f"Image does not exist: {path}")
        entry["path"] = str(path)
        if not entry.get("label"):
            entry["label"] = path.stem
        if "transition" not in entry:
            entry["transition"] = ""
        entry["sequence"] = str(index)
    return entries


def draw_labeled_image(
    image_path: Path,
    out_path: Path,
    label: str,
    transition: str,
    sequence: int,
    total: int,
    overwrite: bool,
) -> None:
    if out_path.exists() and not overwrite:
        raise SystemExit(f"Refusing to overwrite existing file: {out_path}")

    with Image.open(image_path) as source:
        image = source.convert("RGBA")

    width, height = image.size
    banner_height = max(112, min(190, int(height * 0.16)))
    padding = max(18, int(width * 0.018))
    badge_font = load_font(max(30, min(52, int(banner_height * 0.46))))
    label_font = load_font(max(24, min(42, int(banner_height * 0.34))))
    transition_font = load_font(max(20, min(30, int(banner_height * 0.22))))
    small_font = load_font(max(14, min(21, int(banner_height * 0.15))))

    canvas = Image.new("RGBA", (width, height + banner_height), (17, 24, 39, 255))
    canvas.alpha_composite(image, (0, banner_height))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, width, banner_height), fill=(17, 24, 39, 220))
    draw.rectangle((0, banner_height - 4, width, banner_height), fill=(37, 99, 235, 255))

    badge = f"{sequence:02d} / {total:02d}"
    badge_box = draw.textbbox((0, 0), badge, font=badge_font)
    badge_width = badge_box[2] - badge_box[0]
    badge_height = badge_box[3] - badge_box[1]
    badge_x = padding
    badge_y = max(10, (banner_height - badge_height) // 2 - 4)
    badge_pad_x = 18
    badge_pad_y = 8
    draw.rounded_rectangle(
        (
            badge_x - badge_pad_x,
            badge_y - badge_pad_y,
            badge_x + badge_width + badge_pad_x,
            badge_y + badge_height + badge_pad_y,
        ),
        radius=12,
        fill=(37, 99, 235, 245),
    )
    draw.text((badge_x, badge_y), badge, fill=(255, 255, 255, 255), font=badge_font)

    label_x = badge_x + badge_width + badge_pad_x * 2 + 28
    max_label_width = max(120, width - label_x - padding)
    label_lines = wrap_text(draw, label, label_font, max_label_width)
    label_y = max(8, int(banner_height * 0.12))
    for line in label_lines:
        draw.text((label_x, label_y), line, fill=(255, 255, 255, 255), font=label_font)
        label_y += int(label_font.size * 1.15) if hasattr(label_font, "size") else 32

    if transition:
        transition_text = truncate_to_width(draw, f"承接: {transition}", transition_font, max_label_width)
        transition_y = max(label_y + 4, int(banner_height * 0.55))
        draw.text((label_x, transition_y), transition_text, fill=(253, 230, 138, 255), font=transition_font)

    source_text = truncate_to_width(draw, f"原图: {image_path.name}", small_font, max_label_width)
    draw.text((label_x, banner_height - 30), source_text, fill=(209, 213, 219, 255), font=small_font)

    labeled = canvas.convert("RGB")
    labeled.save(out_path, format="PNG", optimize=True)


def draw_index(out_path: Path, title: str, entries: list[dict[str, str]], overwrite: bool) -> None:
    if out_path.exists() and not overwrite:
        raise SystemExit(f"Refusing to overwrite existing file: {out_path}")

    width = 1800
    title_font = load_font(48)
    row_font = load_font(34)
    small_font = load_font(24)
    row_height = 112
    height = 150 + row_height * len(entries) + 48

    image = Image.new("RGB", (width, height), (248, 250, 252))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 112), fill=(17, 24, 39))
    draw.text((44, 30), title, fill=(255, 255, 255), font=title_font)
    draw.text((width - 280, 42), f"共 {len(entries)} 张", fill=(191, 219, 254), font=row_font)

    y = 140
    for index, entry in enumerate(entries, 1):
        fill = (255, 255, 255) if index % 2 else (241, 245, 249)
        draw.rectangle((32, y - 12, width - 32, y + row_height - 18), fill=fill)
        draw.rectangle((32, y - 12, 112, y + row_height - 18), fill=(37, 99, 235))
        draw.text((50, y + 8), f"{index:02d}", fill=(255, 255, 255), font=row_font)

        label = truncate_to_width(draw, entry["label"], row_font, width - 270)
        transition = truncate_to_width(draw, f"承接: {entry['transition']}", small_font, width - 270) if entry.get("transition") else ""
        source = truncate_to_width(draw, f"原图: {Path(entry['path']).name}", small_font, width - 270)
        draw.text((142, y), label, fill=(15, 23, 42), font=row_font)
        if transition:
            draw.text((142, y + 42), transition, fill=(146, 64, 14), font=small_font)
            draw.text((142, y + 72), source, fill=(71, 85, 105), font=small_font)
        else:
            draw.text((142, y + 48), source, fill=(71, 85, 105), font=small_font)
        y += row_height

    image.save(out_path, format="PNG", optimize=True)


def main() -> int:
    args = parse_args()
    entries = collect_entries(args)
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    output_entries: list[dict[str, str]] = []
    for index, entry in enumerate(entries, 1):
        source_path = Path(entry["path"])
        safe_stem = sanitize_filename(source_path.stem, f"image-{index:02d}")
        out_path = out_dir / f"{index:02d}-labeled-{safe_stem}.png"
        draw_labeled_image(source_path, out_path, entry["label"], entry.get("transition", ""), index, len(entries), args.overwrite)
        output_entries.append(
            {
                "sequence": index,
                "label": entry["label"],
                "transition": entry.get("transition", ""),
                "original": str(source_path),
                "labeled": str(out_path),
            }
        )

    index_path: Path | None = None
    if not args.no_index:
        index_path = out_dir / "00-sequence-index.png"
        draw_index(index_path, args.title, entries, args.overwrite)

    result = {
        "title": args.title,
        "out_dir": str(out_dir),
        "index": str(index_path) if index_path else None,
        "images": output_entries,
        "pureref_order": ([str(index_path)] if index_path else []) + [item["labeled"] for item in output_entries],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
