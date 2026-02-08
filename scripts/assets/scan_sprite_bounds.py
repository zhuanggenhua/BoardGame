"""
精灵图内容边界扫描工具
- 用于识别图集每一帧真实内容区域（裁切掉黑边/透明边）
- 输出每帧的内容矩形与建议配置
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import List, Tuple
try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("缺少 Pillow 依赖，请先执行: python -m pip install Pillow") from exc


@dataclass
class FrameBounds:
    col: int
    row: int
    x: int
    y: int
    width: int
    height: int


def is_content(pixel: Tuple[int, int, int, int], threshold: int, alpha_threshold: int) -> bool:
    r, g, b, a = pixel
    if a <= alpha_threshold:
        return False
    return max(r, g, b) > threshold


def scan_bounds(
    img: Image.Image,
    x0: int,
    y0: int,
    w: int,
    h: int,
    threshold: int,
    alpha_threshold: int,
) -> Tuple[int, int, int, int]:
    pixels = img.load()
    left = None
    right = None
    top = None
    bottom = None

    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if is_content(pixels[x, y], threshold, alpha_threshold):
                top = y if top is None else min(top, y)
                bottom = y if bottom is None else max(bottom, y)
                left = x if left is None else min(left, x)
                right = x if right is None else max(right, x)

    if left is None or right is None or top is None or bottom is None:
        return x0, y0, 0, 0

    return left, top, right - left + 1, bottom - top + 1


def main() -> None:
    parser = argparse.ArgumentParser(description="扫描精灵图每帧的内容边界")
    parser.add_argument("--image", required=True, help="图片路径")
    parser.add_argument("--cols", type=int, required=True, help="列数")
    parser.add_argument("--rows", type=int, required=True, help="行数")
    parser.add_argument("--threshold", type=int, default=5, help="亮度阈值 (0-255)")
    parser.add_argument("--alpha-threshold", type=int, default=0, help="透明阈值 (0-255)")
    args = parser.parse_args()

    img = Image.open(args.image).convert("RGBA")
    image_w, image_h = img.size
    frame_w = image_w // args.cols
    frame_h = image_h // args.rows

    print(f"image_size={image_w}x{image_h}")
    print(f"frame_size={frame_w}x{frame_h}")

    bounds_list: List[FrameBounds] = []
    for row in range(args.rows):
        for col in range(args.cols):
            x0 = col * frame_w
            y0 = row * frame_h
            left, top, width, height = scan_bounds(
                img, x0, y0, frame_w, frame_h, args.threshold, args.alpha_threshold
            )
            bounds_list.append(FrameBounds(col, row, left, top, width, height))

    for idx, bounds in enumerate(bounds_list):
        print(
            f"frame[{idx}] col={bounds.col} row={bounds.row} x={bounds.x} y={bounds.y} "
            f"w={bounds.width} h={bounds.height}"
        )


if __name__ == "__main__":
    main()
