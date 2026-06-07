from __future__ import annotations

import argparse
import json
import os
from typing import Dict, Iterable, List, Optional, Tuple

from PIL import Image


Frame = Dict[str, float]


def sanitize_name(name: str) -> str:
    return ''.join('_' if ch in '/\\:*?"<>|' else ch for ch in name).strip() or 'frame'


def load_config(path: str) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def is_frame_list(frames: object) -> bool:
    if not isinstance(frames, list):
        return False
    if not frames:
        return True
    sample = frames[0]
    return isinstance(sample, dict) and all(key in sample for key in ('x', 'y', 'width', 'height'))


def is_frame_map(frames: object) -> bool:
    if not isinstance(frames, dict):
        return False
    for value in frames.values():
        if not isinstance(value, dict):
            return False
        frame = value.get('frame')
        if not isinstance(frame, dict):
            return False
        if not all(key in frame for key in ('x', 'y', 'w', 'h')):
            return False
    return True


def resolve_image_size_from_meta(cfg: dict) -> Tuple[int, int]:
    meta = cfg.get('meta') or {}
    size = meta.get('size') or {}
    if isinstance(size, dict) and isinstance(size.get('w'), (int, float)) and isinstance(size.get('h'), (int, float)):
        return int(size['w']), int(size['h'])
    raise ValueError('frame-map config missing meta.size.w/h')


def build_uniform_grid_config(image_w: int, image_h: int, rows: int, cols: int,
                              start_x: float = 0.0, start_y: float = 0.0,
                              gap_x: float = 0.0, gap_y: float = 0.0,
                              cell_w: Optional[float] = None, cell_h: Optional[float] = None) -> dict:
    if rows <= 0 or cols <= 0:
        raise ValueError('rows/cols must be positive')
    if cell_w is None:
        cell_w = (image_w - start_x - gap_x * (cols - 1)) / cols
    if cell_h is None:
        cell_h = (image_h - start_y - gap_y * (rows - 1)) / rows
    col_starts = [start_x + i * (cell_w + gap_x) for i in range(cols)]
    row_starts = [start_y + i * (cell_h + gap_y) for i in range(rows)]
    col_widths = [cell_w for _ in range(cols)]
    row_heights = [cell_h for _ in range(rows)]
    return {
        'imageW': image_w,
        'imageH': image_h,
        'cols': cols,
        'rows': rows,
        'colStarts': col_starts,
        'colWidths': col_widths,
        'rowStarts': row_starts,
        'rowHeights': row_heights,
    }

def build_scaled_grid_config(cfg: dict, img_w: int, img_h: int) -> dict:
    if 'imageW' not in cfg or 'imageH' not in cfg:
        raise ValueError('config missing imageW/imageH')
    scale_x = img_w / cfg['imageW']
    scale_y = img_h / cfg['imageH']
    return {
        **cfg,
        'imageW': img_w,
        'imageH': img_h,
        'colStarts': [v * scale_x for v in cfg['colStarts']],
        'colWidths': [v * scale_x for v in cfg['colWidths']],
        'rowStarts': [v * scale_y for v in cfg['rowStarts']],
        'rowHeights': [v * scale_y for v in cfg['rowHeights']],
    }


def apply_global_shift(cfg: dict, shift_x: float, shift_y: float) -> dict:
    return {
        **cfg,
        'colStarts': [v + shift_x for v in cfg['colStarts']],
        'rowStarts': [v + shift_y for v in cfg['rowStarts']],
    }


def crop_with_scaled_grid(img: Image.Image, cfg: dict, max_index: int, out_dir: str, fmt: str) -> None:
    cols = cfg['cols']
    rows = cfg['rows']
    for idx in range(max_index + 1):
        col = idx % cols
        row = idx // cols
        if row >= rows:
            break
        left = int(round(cfg['colStarts'][col]))
        top = int(round(cfg['rowStarts'][row]))
        width = int(round(cfg['colWidths'][col]))
        height = int(round(cfg['rowHeights'][row]))

        left = max(0, min(left, img.width - 1))
        top = max(0, min(top, img.height - 1))
        width = max(1, min(width, img.width - left))
        height = max(1, min(height, img.height - top))

        crop = img.crop((left, top, left + width, top + height))
        out_path = os.path.join(out_dir, f'slot-{idx:02}.{fmt}')
        if fmt == 'webp':
            crop.save(out_path, 'WEBP', quality=95)
        else:
            crop.save(out_path, fmt.upper())


def crop_with_frames(
    img: Image.Image,
    frames: Iterable[Tuple[str, Frame]],
    image_w: int,
    image_h: int,
    out_dir: str,
    fmt: str,
    shift_x: float,
    shift_y: float,
    max_index: Optional[int],
) -> None:
    scale_x = img.width / image_w
    scale_y = img.height / image_h
    shift_x_scaled = shift_x * scale_x
    shift_y_scaled = shift_y * scale_y
    for idx, (name, frame) in enumerate(frames):
        if max_index is not None and idx > max_index:
            break
        left = int(round(frame['x'] * scale_x + shift_x_scaled))
        top = int(round(frame['y'] * scale_y + shift_y_scaled))
        width = int(round(frame['width'] * scale_x))
        height = int(round(frame['height'] * scale_y))

        left = max(0, min(left, img.width - 1))
        top = max(0, min(top, img.height - 1))
        width = max(1, min(width, img.width - left))
        height = max(1, min(height, img.height - top))

        crop = img.crop((left, top, left + width, top + height))
        safe_name = sanitize_name(name) if name else f'slot-{idx:02}'
        out_path = os.path.join(out_dir, f'{safe_name}.{fmt}')
        if fmt == 'webp':
            crop.save(out_path, 'WEBP', quality=95)
        else:
            crop.save(out_path, fmt.upper())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='通用图集裁切工具（不规则网格）')
    parser.add_argument('--image', required=True, help='图集图片路径')
    parser.add_argument('--config', help='图集配置 JSON 路径（SpriteAtlasConfig 或 TexturePacker JSON）')
    parser.add_argument('--out', required=True, help='输出目录')
    parser.add_argument('--shift-x', type=float, default=0.0, help='全局 X 偏移（像素，基于配置坐标系）')
    parser.add_argument('--shift-y', type=float, default=0.0, help='全局 Y 偏移（像素，基于配置坐标系）')
    parser.add_argument('--max-index', type=int, default=None, help='最大 slot 索引（含）')
    parser.add_argument('--format', default='webp', choices=['webp', 'png', 'jpg'], help='输出格式')
    parser.add_argument('--grid-rows', type=int, help='无配置时使用：规则网格行数')
    parser.add_argument('--grid-cols', type=int, help='无配置时使用：规则网格列数')
    parser.add_argument('--cell-w', type=float, help='规则网格单元宽（可选）')
    parser.add_argument('--cell-h', type=float, help='规则网格单元高（可选）')
    parser.add_argument('--start-x', type=float, default=0.0, help='规则网格起始 X（可选）')
    parser.add_argument('--start-y', type=float, default=0.0, help='规则网格起始 Y（可选）')
    parser.add_argument('--gap-x', type=float, default=0.0, help='规则网格列间距（可选）')
    parser.add_argument('--gap-y', type=float, default=0.0, help='规则网格行间距（可选）')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not os.path.exists(args.image):
        raise FileNotFoundError(args.image)
    img = Image.open(args.image).convert('RGB')
    os.makedirs(args.out, exist_ok=True)

    if args.config:
        if not os.path.exists(args.config):
            raise FileNotFoundError(args.config)
        cfg = load_config(args.config)

        frames = cfg.get('frames')
        if is_frame_list(frames):
            if cfg.get('imageW') is None or cfg.get('imageH') is None:
                raise ValueError('frame-list config missing imageW/imageH')
            image_w = int(cfg.get('imageW'))
            image_h = int(cfg.get('imageH'))
            frame_list = [(f'frame-{idx:02}', {
                'x': float(frame.get('x')),
                'y': float(frame.get('y')),
                'width': float(frame.get('width')),
                'height': float(frame.get('height')),
            }) for idx, frame in enumerate(frames or [])]
            crop_with_frames(
                img,
                frame_list,
                image_w,
                image_h,
                out_dir=args.out,
                fmt=args.format,
                shift_x=args.shift_x,
                shift_y=args.shift_y,
                max_index=args.max_index,
            )
            print(f'[done] {args.out}')
            return

        if is_frame_map(frames):
            image_w, image_h = resolve_image_size_from_meta(cfg)
            items = sorted(frames.items(), key=lambda item: item[0])
            frame_items = []
            for name, entry in items:
                frame = entry.get('frame', {})
                frame_items.append((name, {
                    'x': float(frame.get('x')),
                    'y': float(frame.get('y')),
                    'width': float(frame.get('w')),
                    'height': float(frame.get('h')),
                }))
            crop_with_frames(
                img,
                frame_items,
                image_w,
                image_h,
                out_dir=args.out,
                fmt=args.format,
                shift_x=args.shift_x,
                shift_y=args.shift_y,
                max_index=args.max_index,
            )
            print(f'[done] {args.out}')
            return

        if 'rows' in cfg and 'cols' in cfg:
            if 'colStarts' not in cfg or 'rowStarts' not in cfg:
                cfg = build_uniform_grid_config(
                    int(cfg.get('imageW', img.width)),
                    int(cfg.get('imageH', img.height)),
                    int(cfg['rows']),
                    int(cfg['cols']),
                )
            scaled = build_scaled_grid_config(cfg, img.width, img.height)
            scale_x = img.width / cfg['imageW']
            scale_y = img.height / cfg['imageH']
            adjusted = apply_global_shift(scaled, args.shift_x * scale_x, args.shift_y * scale_y)

            max_index = args.max_index
            if max_index is None:
                max_index = adjusted['cols'] * adjusted['rows'] - 1
            crop_with_scaled_grid(img, adjusted, max_index=max_index, out_dir=args.out, fmt=args.format)
            print(f'[done] {args.out}')
            return

        if 'grid' in cfg and isinstance(cfg['grid'], dict):
            grid = cfg['grid']
            if 'rows' in grid and 'cols' in grid:
                uniform_cfg = build_uniform_grid_config(
                    img.width,
                    img.height,
                    int(grid['rows']),
                    int(grid['cols']),
                )
                adjusted = apply_global_shift(uniform_cfg, args.shift_x, args.shift_y)
                max_index = args.max_index
                if max_index is None:
                    max_index = adjusted['cols'] * adjusted['rows'] - 1
                crop_with_scaled_grid(img, adjusted, max_index=max_index, out_dir=args.out, fmt=args.format)
                print(f'[done] {args.out}')
                return

        raise ValueError('Unsupported config format')

    if args.grid_rows is None or args.grid_cols is None:
        raise ValueError('Missing --config or --grid-rows/--grid-cols')

    uniform_cfg = build_uniform_grid_config(
        img.width,
        img.height,
        args.grid_rows,
        args.grid_cols,
        start_x=args.start_x,
        start_y=args.start_y,
        gap_x=args.gap_x,
        gap_y=args.gap_y,
        cell_w=args.cell_w,
        cell_h=args.cell_h,
    )
    adjusted = apply_global_shift(uniform_cfg, args.shift_x, args.shift_y)
    max_index = args.max_index
    if max_index is None:
        max_index = adjusted['cols'] * adjusted['rows'] - 1
    crop_with_scaled_grid(img, adjusted, max_index=max_index, out_dir=args.out, fmt=args.format)
    print(f'[done] {args.out}')


if __name__ == '__main__':
    main()
