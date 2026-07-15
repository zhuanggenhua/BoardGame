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
CLEAN_OUTPUT = os.getenv("IMAGE_CLEAN", "0") == "1"
VALID_MODES = {"runtime", "display"}
MODE_DEFAULTS = {
    "runtime": {"max_edge": 0, "quality": 95},
    "display": {"max_edge": 2048, "quality": 82},
}

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


def parse_int(value: str, label: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise SystemExit(f"{label} 必须是整数: {value}") from exc


def parse_mode(value: str) -> str:
    mode = value.strip().lower()
    if mode not in VALID_MODES:
        raise SystemExit(f"图片压缩模式无效: {value}，只能是 runtime 或 display")
    return mode


def parse_args(argv: list[str]) -> tuple[Path, bool, str, int, int, bool]:
    root = None
    clean = CLEAN_OUTPUT
    mode = parse_mode(os.getenv("IMAGE_ASSET_MODE", "runtime"))
    max_edge_override = os.getenv("IMAGE_MAX_EDGE")
    quality_override = os.getenv("IMAGE_WEBP_QUALITY")
    allow_runtime_resize = os.getenv("IMAGE_ALLOW_RUNTIME_RESIZE", "0") == "1"

    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg in {"--clean", "--clear"}:
            clean = True
        elif arg == "--allow-runtime-resize":
            allow_runtime_resize = True
        elif arg == "--mode":
            index += 1
            if index >= len(argv):
                raise SystemExit("--mode 需要指定 runtime 或 display")
            mode = parse_mode(argv[index])
        elif arg.startswith("--mode="):
            mode = parse_mode(arg.split("=", 1)[1])
        elif arg == "--max-edge":
            index += 1
            if index >= len(argv):
                raise SystemExit("--max-edge 需要指定整数")
            max_edge_override = argv[index]
        elif arg.startswith("--max-edge="):
            max_edge_override = arg.split("=", 1)[1]
        elif arg == "--quality":
            index += 1
            if index >= len(argv):
                raise SystemExit("--quality 需要指定整数")
            quality_override = argv[index]
        elif arg.startswith("--quality="):
            quality_override = arg.split("=", 1)[1]
        elif arg.startswith("--"):
            raise SystemExit(f"未知参数: {arg}")
        elif root is None:
            root = Path(arg).resolve()
        else:
            raise SystemExit(f"只能指定一个资源根目录，重复参数: {arg}")
        index += 1

    if root is None:
        root = DEFAULT_ROOT

    defaults = MODE_DEFAULTS[mode]
    max_edge = (
        parse_int(max_edge_override, "IMAGE_MAX_EDGE / --max-edge")
        if max_edge_override is not None
        else defaults["max_edge"]
    )
    webp_quality = (
        parse_int(quality_override, "IMAGE_WEBP_QUALITY / --quality")
        if quality_override is not None
        else defaults["quality"]
    )

    if max_edge < 0:
        raise SystemExit("--max-edge / IMAGE_MAX_EDGE 不能小于 0")
    if webp_quality < 1 or webp_quality > 100:
        raise SystemExit("--quality / IMAGE_WEBP_QUALITY 必须在 1-100 之间")
    if mode == "runtime" and max_edge > 0 and not allow_runtime_resize:
        raise SystemExit(
            "runtime 模式用于正式对局素材，禁止降采样。"
            "如需压缩展示图，请使用 --mode display；"
            "如确有用户当轮授权降采样正式素材，才可加 --allow-runtime-resize。"
        )

    return root, clean, mode, max_edge, webp_quality, allow_runtime_resize


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


def resize_image(img: Image.Image, max_edge: int) -> tuple[Image.Image, bool]:
    if max_edge <= 0:
        return img, False
    width, height = img.size
    if max(width, height) <= max_edge:
        return img, False
    resized = img.copy()
    resized.thumbnail((max_edge, max_edge), Image.LANCZOS)
    return resized, True


def output_matches_expected(dest: Path, source_mtime: float, expected_size: tuple[int, int]) -> bool:
    try:
        dest_stat = dest.stat()
    except OSError:
        return False
    if dest_stat.st_size <= 0 or dest_stat.st_mtime < source_mtime:
        return False
    try:
        with Image.open(dest) as existing:
            return existing.size == expected_size
    except Exception:
        return False


def save_variant(
    img: Image.Image,
    dest: Path,
    format_name: str,
    quality: int,
    original_size: int,
    source_mtime: float,
    expected_size: tuple[int, int],
) -> int | None:
    global WEBP_ENABLED

    if format_name == "WEBP" and not WEBP_ENABLED:
        return None

    if dest.exists():
        if output_matches_expected(dest, source_mtime, expected_size):
            output_size = dest.stat().st_size
            if output_size >= original_size:
                stats["variant_skipped"] += 1
            return output_size

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


def handle_file(src: Path, root: Path, max_edge: int, webp_quality: int) -> None:
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
        working, resized = resize_image(img, max_edge)
        if resized:
            stats["resized_count"] += 1

        variant_base = output_dir / src.stem
        webp_size = save_variant(
            working,
            variant_base.with_suffix(".webp"),
            "WEBP",
            webp_quality,
            original_size,
            source_mtime,
            working.size,
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


def walk_dir(root: Path, max_edge: int, webp_quality: int) -> None:
    for current, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if name != SKIP_DIR]
        for filename in filenames:
            handle_file(Path(current) / filename, root, max_edge, webp_quality)


def main() -> None:
    root, clean, mode, max_edge, webp_quality, allow_runtime_resize = parse_args(sys.argv[1:])
    if not root.exists():
        raise SystemExit(f"路径不存在: {root}")

    if clean:
        removed = clear_compressed_dirs(root)
        if removed > 0:
            print(f"已清空 {removed} 个 {SKIP_DIR} 目录。")

    resize_policy = "不降采样" if max_edge <= 0 else f"最长边 {max_edge}px"
    print(f"开始压缩与转码: {root}")
    print(f"模式: {mode}；尺寸策略: {resize_policy}；WebP 质量: {webp_quality}")
    if mode == "runtime" and allow_runtime_resize:
        print("警告：runtime 模式已显式允许降采样，必须已有用户当轮授权。")
    walk_dir(root, max_edge, webp_quality)

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
