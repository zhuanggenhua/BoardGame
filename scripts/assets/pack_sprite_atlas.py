import argparse
import json
import os
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("缺少 Pillow 依赖，请先执行: python -m pip install Pillow") from exc

VALID_EXTS = {".png", ".jpg", ".jpeg"}
DEFAULT_MAX_WIDTH = int(os.getenv("ATLAS_MAX_WIDTH", "2048"))
DEFAULT_PADDING = int(os.getenv("ATLAS_PADDING", "2"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="图集打包脚本（按行排列）")
    parser.add_argument("input_dir", help="输入图标目录，例如 public/assets/.../status-icons")
    parser.add_argument("--max-width", type=int, default=DEFAULT_MAX_WIDTH, help="图集最大宽度")
    parser.add_argument("--padding", type=int, default=DEFAULT_PADDING, help="图块间距")
    parser.add_argument("--name", type=str, default=None, help="输出文件名（不含扩展名）")
    parser.add_argument("--align-max", action="store_true", help="将图标对齐到最大宽高（透明填充）")
    parser.add_argument("--no-json", action="store_true", help="不输出 JSON 帧数据")
    return parser.parse_args()


def collect_images(input_dir: Path) -> list[dict]:
    files = [
        path for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in VALID_EXTS
    ]
    if not files:
        raise SystemExit(f"未找到可用图片: {input_dir}")

    entries: list[dict] = []
    for path in sorted(files):
        with Image.open(path) as img:
            converted = img.convert("RGBA") if img.mode != "RGBA" else img.copy()
        entries.append({
            "id": path.stem,
            "path": path,
            "image": converted,
            "w": converted.width,
            "h": converted.height,
        })

    entries.sort(key=lambda item: (item["h"], item["w"]), reverse=True)
    return entries


def pack_images(entries: list[dict], max_width: int, padding: int) -> tuple[dict, int, int]:
    if not entries:
        raise SystemExit("没有可打包的图像")

    widest = max(item["cell_w"] for item in entries)
    if widest > max_width:
        max_width = widest
        print(f"提示：最大单图宽度为 {widest}px，已自动提升 max-width。")

    x = 0
    y = 0
    row_height = 0
    atlas_width = 0
    positions: dict[str, dict] = {}

    for item in entries:
        w = item["cell_w"]
        h = item["cell_h"]
        if x > 0 and x + w > max_width:
            y += row_height + padding
            x = 0
            row_height = 0

        positions[item["id"]] = {"x": x, "y": y, "w": w, "h": h}
        x += w + padding
        row_height = max(row_height, h)
        atlas_width = max(atlas_width, x - padding)

    atlas_height = y + row_height
    return positions, atlas_width, atlas_height


def build_atlas(entries: list[dict], positions: dict[str, dict], width: int, height: int) -> Image.Image:
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for item in entries:
        frame = positions[item["id"]]
        atlas.paste(
            item["image"],
            (frame["x"] + item["offset_x"], frame["y"] + item["offset_y"])
        )
    return atlas


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()
    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"目录不存在: {input_dir}")

    entries = collect_images(input_dir)
    max_w = max(item["w"] for item in entries)
    max_h = max(item["h"] for item in entries)
    for item in entries:
        if args.align_max:
            item["cell_w"] = max_w
            item["cell_h"] = max_h
            item["offset_x"] = (max_w - item["w"]) // 2
            item["offset_y"] = (max_h - item["h"]) // 2
        else:
            item["cell_w"] = item["w"]
            item["cell_h"] = item["h"]
            item["offset_x"] = 0
            item["offset_y"] = 0

    positions, width, height = pack_images(entries, args.max_width, args.padding)

    output_dir = input_dir.parent
    output_name = args.name or f"{input_dir.name}-atlas"
    output_image = output_dir / f"{output_name}.png"
    output_json = output_dir / f"{output_name}.json"

    atlas = build_atlas(entries, positions, width, height)
    atlas.save(output_image)

    print(f"图集已生成: {output_image}")
    if args.no_json:
        print("已跳过 JSON 输出（--no-json）")
        return

    frames = {
        item_id: {"frame": frame}
        for item_id, frame in positions.items()
    }
    data = {
        "meta": {
            "image": output_image.name,
            "size": {"w": width, "h": height},
        },
        "frames": frames,
    }
    output_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"帧数据已生成: {output_json}")


if __name__ == "__main__":
    main()
