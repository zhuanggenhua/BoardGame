#!/usr/bin/env python3
"""
创建均匀网格图集
将多张图片按照指定的行列数排列成一个均匀网格图集
"""

import argparse
import os
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("缺少 Pillow 依赖，请先执行: python -m pip install Pillow") from exc


def parse_args():
    parser = argparse.ArgumentParser(description="创建均匀网格图集")
    parser.add_argument("input_dir", help="输入图片目录")
    parser.add_argument("--rows", type=int, required=True, help="行数")
    parser.add_argument("--cols", type=int, required=True, help="列数")
    parser.add_argument("--output", required=True, help="输出图集路径")
    parser.add_argument("--cell-width", type=int, help="单元格宽度（可选，默认使用第一张图片的宽度）")
    parser.add_argument("--cell-height", type=int, help="单元格高度（可选，默认使用第一张图片的高度）")
    parser.add_argument("--padding", type=int, default=0, help="单元格间距（默认0）")
    return parser.parse_args()


def collect_images(input_dir: Path, max_count: int):
    """收集图片文件，按数字排序"""
    valid_exts = {".png", ".jpg", ".jpeg", ".webp"}
    files = [
        path for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in valid_exts
    ]

    # 优先按文件名中的数字排序：
    # - 兼容纯数字命名："1.webp"
    # - 兼容带前缀的规则页："rule_page_01.webp"
    # 规则：提取 stem 中“最后一段连续数字”作为排序 key；无法提取数字则跳过。
    import re

    def extract_number(path: Path) -> int | None:
        match = re.search(r"(\d+)(?!.*\d)", path.stem)
        if not match:
            return None
        return int(match.group(1))

    numbered: list[tuple[int, Path]] = []
    for f in files:
        n = extract_number(f)
        if n is None:
            continue
        numbered.append((n, f))

    numbered.sort(key=lambda item: item[0])
    files = [f for _, f in numbered]
    
    # 只取前 max_count 张
    files = files[:max_count]
    
    if len(files) < max_count:
        print(f"警告：只找到 {len(files)} 张图片，需要 {max_count} 张")
    
    return files


def create_atlas(files, rows, cols, cell_width, cell_height, padding, output_path):
    """创建图集"""
    if not files:
        raise SystemExit("没有找到图片文件")
    
    # 如果没有指定单元格尺寸，使用第一张图片的尺寸
    if cell_width is None or cell_height is None:
        with Image.open(files[0]) as img:
            if cell_width is None:
                cell_width = img.width
            if cell_height is None:
                cell_height = img.height
    
    # 计算图集尺寸
    atlas_width = cols * cell_width + (cols - 1) * padding
    atlas_height = rows * cell_height + (rows - 1) * padding
    
    print(f"创建图集: {atlas_width}x{atlas_height} ({rows}行 x {cols}列)")
    print(f"单元格尺寸: {cell_width}x{cell_height}")
    print(f"间距: {padding}px")
    
    # 创建空白图集
    atlas = Image.new("RGBA", (atlas_width, atlas_height), (0, 0, 0, 0))
    
    # 放置图片
    for idx, file_path in enumerate(files):
        if idx >= rows * cols:
            break
        
        row = idx // cols
        col = idx % cols
        
        x = col * (cell_width + padding)
        y = row * (cell_height + padding)
        
        with Image.open(file_path) as img:
            # 转换为 RGBA
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            
            # 如果图片尺寸不匹配，调整大小
            if img.width != cell_width or img.height != cell_height:
                print(f"调整 {file_path.name} 尺寸: {img.width}x{img.height} -> {cell_width}x{cell_height}")
                img = img.resize((cell_width, cell_height), Image.Resampling.LANCZOS)
            
            atlas.paste(img, (x, y))
            print(f"放置 {file_path.name} 到位置 ({row}, {col}) -> ({x}, {y})")
    
    # 保存图集
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 根据输出格式保存
    if output_path.suffix.lower() == '.webp':
        # 保存为 WebP 格式（高质量压缩）
        atlas.save(output_path, 'WEBP', quality=90, method=6)
        print(f"\n图集已保存（WebP 格式）: {output_path}")
    else:
        atlas.save(output_path)
        print(f"\n图集已保存: {output_path}")
    
    print(f"图集尺寸: {atlas_width}x{atlas_height}")


def main():
    args = parse_args()
    
    input_dir = Path(args.input_dir).resolve()
    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"目录不存在: {input_dir}")
    
    output_path = Path(args.output).resolve()
    
    max_count = args.rows * args.cols
    files = collect_images(input_dir, max_count)
    
    create_atlas(
        files,
        args.rows,
        args.cols,
        args.cell_width,
        args.cell_height,
        args.padding,
        output_path
    )


if __name__ == "__main__":
    main()
