import os
import sys
import shutil
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError as exc:
    raise SystemExit("缺少 Pillow 依赖，请先执行: python -m pip install Pillow") from exc

DEFAULT_ROOT = Path.cwd() / "public" / "assets"
SKIP_DIR = "compressed"
VALID_EXTS = {".png", ".jpg", ".jpeg"}
MAX_EDGE = int(os.getenv("IMAGE_MAX_EDGE", "2048"))
WEBP_QUALITY = int(os.getenv("IMAGE_WEBP_QUALITY", "82"))
CLEAN_OUTPUT = os.getenv("IMAGE_CLEAN", "0") == "1"

WEBP_ENABLED = True

stats = {
    "file_count": 0,
    "skipped_count": 0,
    "total_bytes": 0,
    "output_bytes": 0,
    "variant_count": 0,
    "variant_bytes": 0,
    "variant_skipped": 0,
    "resized_count": 0,
}


def format_bytes(value: int) -> str:
    if value < 1024:
        return f"{value} B"
    kb = value / 1024
    if kb < 1024:
        return f"{kb:.2f} KB"
    mb = kb / 1024
    return f"{mb:.2f} MB"


def parse_args(argv: list[str]) -> tuple[Path, bool]:
    root = None
    clean = CLEAN_OUTPUT
    for arg in argv:
        if arg == "--clean":
            clean = True
            continue
        if arg.startswith("--"):
            continue
        if root is None:
            root = Path(arg).resolve()
    if root is None:
        root = DEFAULT_ROOT
    return root, clean


def clear_compressed_dirs(root: Path) -> int:
    removed = 0
    for current, dirnames, _ in os.walk(root):
        to_remove = [name for name in dirnames if name == SKIP_DIR]
        for name in to_remove:
            target = Path(current) / name
            shutil.rmtree(target, ignore_errors=True)
            removed += 1
        dirnames[:] = [name for name in dirnames if name != SKIP_DIR]
    return removed


def resize_image(img: Image.Image) -> tuple[Image.Image, bool]:
    if MAX_EDGE <= 0:
        return img, False
    width, height = img.size
    if max(width, height) <= MAX_EDGE:
        return img, False
    resized = img.copy()
    resized.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    return resized, True


def save_variant(
    img: Image.Image,
    dest: Path,
    format_name: str,
    quality: int,
    original_size: int,
    source_mtime: float,
) -> int | None:
    global WEBP_ENABLED

    if format_name == "WEBP" and not WEBP_ENABLED:
        return None

    if dest.exists():
        try:
            dest_stat = dest.stat()
            if dest_stat.st_size > 0 and dest_stat.st_mtime >= source_mtime:
                output_size = dest_stat.st_size
                if output_size >= original_size:
                    stats["variant_skipped"] += 1
                return output_size
        except OSError:
            pass

    try:
        save_img = img
        if img.mode == "P":
            save_img = img.convert("RGBA")
        save_kwargs = {"format": format_name, "quality": quality}
        if format_name == "WEBP":
            save_kwargs["method"] = 6
        save_img.save(dest, **save_kwargs)
    except Exception:
        if dest.exists():
            dest.unlink()
        if format_name == "WEBP":
            WEBP_ENABLED = False
            print("WEBP 不可用，已跳过后续 WEBP 输出。")
        return None

    output_size = dest.stat().st_size
    if output_size >= original_size:
        stats["variant_skipped"] += 1

    stats["variant_count"] += 1
    stats["variant_bytes"] += output_size
    return output_size


def handle_file(src: Path, root: Path) -> None:
    ext = src.suffix.lower()
    if ext not in VALID_EXTS:
        return

    output_dir = src.parent / SKIP_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    src_stat = src.stat()
    original_size = src_stat.st_size
    source_mtime = src_stat.st_mtime
    stats["total_bytes"] += original_size

    with Image.open(src) as img:
        img = ImageOps.exif_transpose(img)
        working, resized = resize_image(img)
        if resized:
            stats["resized_count"] += 1

        variant_base = output_dir / src.stem
        webp_size = save_variant(
            working,
            variant_base.with_suffix(".webp"),
            "WEBP",
            WEBP_QUALITY,
            original_size,
            source_mtime,
        )

        output_size = webp_size
        if output_size is None:
            stats["skipped_count"] += 1
            relative = src.relative_to(root)
            print(f"已跳过: {relative}（无法生成 WebP）")
            return

    stats["file_count"] += 1
    stats["output_bytes"] += output_size

    relative = src.relative_to(root)
    resize_note = ""
    if resized:
        resize_note = f" (已缩放至 {working.size[0]}x{working.size[1]})"
    print(f"已处理: {relative} {format_bytes(original_size)} -> webp {format_bytes(output_size)}{resize_note}")


def walk_dir(root: Path) -> None:
    for current, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if name != SKIP_DIR]
        for filename in filenames:
            handle_file(Path(current) / filename, root)


def main() -> None:
    root, clean = parse_args(sys.argv[1:])
    if not root.exists():
        raise SystemExit(f"路径不存在: {root}")

    if clean:
        removed = clear_compressed_dirs(root)
        if removed > 0:
            print(f"已清空 {removed} 个 {SKIP_DIR} 目录。")

    print(f"开始压缩与转码: {root}")
    walk_dir(root)

    saved = stats["total_bytes"] - stats["output_bytes"]
    summary = (
        f"完成。处理 {stats['file_count']} 张，原始 {format_bytes(stats['total_bytes'])}，"
        f"WebP 输出 {format_bytes(stats['output_bytes'])}，节省 {format_bytes(saved)}。"
    )
    skipped = (
        f"（{stats['skipped_count']} 张无法生成 WebP 已跳过）"
        if stats["skipped_count"] > 0
        else ""
    )
    resized_info = ""
    if stats["resized_count"] > 0:
        resized_info = f"（{stats['resized_count']} 张已缩放）"
    print(f"{summary}{skipped}{resized_info}")


if __name__ == "__main__":
    main()
