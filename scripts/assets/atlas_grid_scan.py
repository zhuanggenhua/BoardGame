from __future__ import annotations

import argparse
import json
import sys
from typing import Iterable, List, Tuple

from PIL import Image


def analyze_grid(image_path: str, rows: int, cols: int) -> None:
    try:
        img = Image.open(image_path).convert('L')
        w, h = img.size
        print(f"Image: {image_path} ({w}x{h})")

        cell_w = w // cols
        cell_h = h // rows

        print(f"Assuming Grid: {rows}x{cols} (Cell: {cell_w}x{cell_h})")

        for r in range(rows):
            row_str = f"Row {r}: "
            for c in range(cols):
                idx = r * cols + c
                x = c * cell_w
                y = r * cell_h
                # Check center area (avoid borders)
                box = (x + 50, y + 50, x + cell_w - 50, y + cell_h - 50)
                cell = img.crop(box)

                pixels = list(cell.getdata())
                avg = sum(pixels) / len(pixels)

                if avg < 10:
                    mark = ".."  # Empty/Black
                else:
                    mark = f"{idx:02}"  # Content

                row_str += f"[{mark}] "
            print(row_str)

    except Exception as e:
        print(f"Error: {e}")


def build_segments(flags: Iterable[bool], gap_merge: int, min_segment: int) -> List[Tuple[int, int]]:
    flags_list = list(flags)
    segments: List[Tuple[int, int]] = []
    start = None
    for idx, flag in enumerate(flags_list):
        if flag and start is None:
            start = idx
        elif not flag and start is not None:
            segments.append((start, idx - start))
            start = None
    if start is not None:
        segments.append((start, len(flags_list) - start))

    if gap_merge > 0 and len(segments) > 1:
        merged: List[Tuple[int, int]] = [segments[0]]
        for seg in segments[1:]:
            prev_start, prev_len = merged[-1]
            gap = seg[0] - (prev_start + prev_len)
            if gap <= gap_merge:
                merged[-1] = (prev_start, (seg[0] + seg[1]) - prev_start)
            else:
                merged.append(seg)
        segments = merged

    return [seg for seg in segments if seg[1] >= min_segment]


def invert_segments(total: int, gaps: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    if total <= 0:
        return []
    if not gaps:
        return [(0, total)]
    segments: List[Tuple[int, int]] = []
    cursor = 0
    for start, length in gaps:
        if start > cursor:
            segments.append((cursor, start - cursor))
        cursor = start + length
    if cursor < total:
        segments.append((cursor, total - cursor))
    return segments


def scan_axis_metric(
    img: Image.Image,
    axis: str,
    metric: str,
    threshold: float,
    auto_threshold: float | None,
    detect_mode: str,
    scan_x: Tuple[int, int],
    scan_y: Tuple[int, int],
    gap_merge: int,
    gap_min_segment: int,
    min_segment: int,
    expected_segments: int | None,
) -> List[Tuple[int, int]]:
    pixels = img.load()
    w, h = img.size
    x_start, x_end = scan_x
    y_start, y_end = scan_y
    x_start = max(0, min(x_start, w))
    y_start = max(0, min(y_start, h))
    x_end = w if x_end <= 0 else max(0, min(x_end, w))
    y_end = h if y_end <= 0 else max(0, min(y_end, h))

    metric = metric.lower()
    if metric not in {'max', 'mean', 'variance', 'edge'}:
        raise ValueError(f"Unsupported metric: {metric}")
    detect_mode = detect_mode.lower()
    if detect_mode not in {'content', 'gap', 'gap-high'}:
        raise ValueError(f"Unsupported detect_mode: {detect_mode}")

    values: List[float] = []
    if axis == 'row':
        for y in range(y_start, y_end):
            if metric == 'edge':
                if y == 0:
                    values.append(0.0)
                    continue
                total = 0
                count = 0
                for x in range(x_start, x_end):
                    total += abs(pixels[x, y] - pixels[x, y - 1])
                    count += 1
                values.append(total / count if count else 0)
            elif metric == 'max':
                maxv = 0
                for x in range(x_start, x_end):
                    v = pixels[x, y]
                    maxv = v if v > maxv else maxv
                    if maxv > threshold:
                        break
                values.append(float(maxv))
            else:
                total = 0
                total_sq = 0
                count = 0
                for x in range(x_start, x_end):
                    v = pixels[x, y]
                    total += v
                    total_sq += v * v
                    count += 1
                mean = total / count if count else 0
                if metric == 'mean':
                    values.append(mean)
                else:
                    values.append((total_sq / count) - (mean * mean) if count else 0)
    elif axis == 'col':
        for x in range(x_start, x_end):
            if metric == 'edge':
                if x == 0:
                    values.append(0.0)
                    continue
                total = 0
                count = 0
                for y in range(y_start, y_end):
                    total += abs(pixels[x, y] - pixels[x - 1, y])
                    count += 1
                values.append(total / count if count else 0)
            elif metric == 'max':
                maxv = 0
                for y in range(y_start, y_end):
                    v = pixels[x, y]
                    maxv = v if v > maxv else maxv
                    if maxv > threshold:
                        break
                values.append(float(maxv))
            else:
                total = 0
                total_sq = 0
                count = 0
                for y in range(y_start, y_end):
                    v = pixels[x, y]
                    total += v
                    total_sq += v * v
                    count += 1
                mean = total / count if count else 0
                if metric == 'mean':
                    values.append(mean)
                else:
                    values.append((total_sq / count) - (mean * mean) if count else 0)
    else:
        raise ValueError(f"Unsupported axis: {axis}")

    def compute_threshold(quantile: float) -> float:
        if detect_mode in {'gap', 'gap-high'}:
            ordered = sorted(values)
            idx = int(round((len(ordered) - 1) * quantile))
            idx = max(0, min(idx, len(ordered) - 1))
            return ordered[idx]
        min_val = min(values)
        max_val = max(values)
        return min_val + (max_val - min_val) * quantile

    def compute_segments(threshold_value: float) -> List[Tuple[int, int]]:
        if detect_mode == 'content':
            flags = [value > threshold_value for value in values]
            return build_segments(flags, gap_merge, min_segment)
        if detect_mode == 'gap-high':
            gap_flags = [value > threshold_value for value in values]
        else:
            gap_flags = [value < threshold_value for value in values]
        gaps = build_segments(gap_flags, gap_merge, gap_min_segment)
        return [seg for seg in invert_segments(len(values), gaps) if seg[1] >= min_segment]

    if values:
        if expected_segments is not None:
            candidates = [i / 20 for i in range(1, 20)]
            if auto_threshold is not None:
                candidates = [auto_threshold] + [q for q in candidates if q != auto_threshold]
            best_threshold = threshold
            best_segments = compute_segments(best_threshold)
            best_diff = abs(len(best_segments) - expected_segments)
            for q in candidates:
                current_threshold = compute_threshold(q)
                current_segments = compute_segments(current_threshold)
                current_diff = abs(len(current_segments) - expected_segments)
                if current_diff < best_diff:
                    best_diff = current_diff
                    best_threshold = current_threshold
                    best_segments = current_segments
                    if best_diff == 0:
                        break
            threshold = best_threshold
            segments = best_segments
        else:
            if auto_threshold is not None:
                threshold = compute_threshold(auto_threshold)
            segments = compute_segments(threshold)
    else:
        segments = []

    offset = y_start if axis == 'row' else x_start
    return [(start + offset, length) for start, length in segments]


def resolve_metric(value: str | None, fallback: str) -> str:
    return value or fallback


def resolve_number(value: float | None, fallback: float | None) -> float | None:
    return fallback if value is None else value


def build_uniform_segments(total: int, count: int) -> List[Tuple[int, int]]:
    if count <= 0:
        raise ValueError("uniform count must be positive")
    base = total // count
    remainder = total % count
    segments: List[Tuple[int, int]] = []
    cursor = 0
    for i in range(count):
        size = base + (1 if i < remainder else 0)
        segments.append((cursor, size))
        cursor += size
    return segments


def build_config(
    image_path: str,
    metric: str,
    threshold: float,
    auto_threshold: float | None,
    row_metric: str | None,
    col_metric: str | None,
    row_threshold: float | None,
    col_threshold: float | None,
    row_auto_threshold: float | None,
    col_auto_threshold: float | None,
    row_gap_merge: int | None,
    col_gap_merge: int | None,
    row_min_segment: int | None,
    col_min_segment: int | None,
    row_detect_mode: str | None,
    col_detect_mode: str | None,
    row_gap_min_segment: int | None,
    col_gap_min_segment: int | None,
    uniform_rows: int | None,
    uniform_cols: int | None,
    gap_merge: int,
    min_segment: int,
    scan_x: Tuple[int, int],
    scan_y: Tuple[int, int],
    row_scan_x: Tuple[int, int] | None,
    row_scan_y: Tuple[int, int] | None,
    col_scan_x: Tuple[int, int] | None,
    col_scan_y: Tuple[int, int] | None,
    col_scan_from_row: int | None,
    expected_rows: int | None,
    expected_cols: int | None,
) -> dict:
    img = Image.open(image_path).convert('L')
    w, h = img.size

    row_metric = resolve_metric(row_metric, metric)
    col_metric = resolve_metric(col_metric, metric)
    row_threshold = resolve_number(row_threshold, threshold)
    col_threshold = resolve_number(col_threshold, threshold)
    row_auto_threshold = resolve_number(row_auto_threshold, auto_threshold)
    col_auto_threshold = resolve_number(col_auto_threshold, auto_threshold)

    row_scan_x = row_scan_x or scan_x
    row_scan_y = row_scan_y or scan_y
    col_scan_x = col_scan_x or scan_x
    col_scan_y = col_scan_y or scan_y
    row_gap_merge = row_gap_merge if row_gap_merge is not None else gap_merge
    col_gap_merge = col_gap_merge if col_gap_merge is not None else gap_merge
    row_min_segment = row_min_segment if row_min_segment is not None else min_segment
    col_min_segment = col_min_segment if col_min_segment is not None else min_segment
    row_gap_min_segment = row_gap_min_segment if row_gap_min_segment is not None else 1
    col_gap_min_segment = col_gap_min_segment if col_gap_min_segment is not None else 1
    row_detect_mode = (row_detect_mode or 'content').lower()
    col_detect_mode = (col_detect_mode or 'content').lower()

    if uniform_rows is not None:
        row_segments = build_uniform_segments(h, uniform_rows)
    else:
        row_expected = expected_rows
        row_segments = scan_axis_metric(
            img,
            'row',
            row_metric,
            row_threshold,
            row_auto_threshold,
            row_detect_mode,
            row_scan_x,
            row_scan_y,
            row_gap_merge,
            row_gap_min_segment,
            row_min_segment,
            row_expected,
        )

    if col_scan_from_row is not None and row_segments:
        if col_scan_from_row < 0:
            target_index = max(range(len(row_segments)), key=lambda i: row_segments[i][1])
        else:
            target_index = min(col_scan_from_row, len(row_segments) - 1)
        row_start, row_len = row_segments[target_index]
        col_scan_y = (row_start, row_start + row_len)

    if uniform_cols is not None:
        col_segments = build_uniform_segments(w, uniform_cols)
    else:
        col_expected = expected_cols
        col_segments = scan_axis_metric(
            img,
            'col',
            col_metric,
            col_threshold,
            col_auto_threshold,
            col_detect_mode,
            col_scan_x,
            col_scan_y,
            col_gap_merge,
            col_gap_min_segment,
            col_min_segment,
            col_expected,
        )

    rows = len(row_segments)
    cols = len(col_segments)
    if expected_rows is not None and expected_rows != rows:
        print(f"[warn] 预期行数={expected_rows}，实际识别行数={rows}")
    if expected_cols is not None and expected_cols != cols:
        print(f"[warn] 预期列数={expected_cols}，实际识别列数={cols}")

    # 行高归一化：当某行高度明显偏小（<中位数70%）时，补齐到中位数
    # 典型场景：最后一行只有部分卡牌，大片空白导致扫描提前截断行高
    row_heights = [length for _, length in row_segments]
    if len(row_heights) >= 2:
        sorted_heights = sorted(row_heights)
        median_height = sorted_heights[len(sorted_heights) // 2]
        for i, h_val in enumerate(row_heights):
            if h_val < median_height * 0.7:
                # 补齐到中位数，但不超过图片边界
                start = row_segments[i][0]
                max_possible = h - start
                new_height = min(median_height, max_possible)
                row_segments[i] = (start, new_height)
                print(f"[info] 行{i}高度{h_val}偏小（中位数{median_height}），已补齐到{new_height}")

    return {
        'imageW': w,
        'imageH': h,
        'rows': rows,
        'cols': cols,
        'deckX': 0,
        'deckY': 0,
        'deckW': w,
        'deckH': h,
        'rowStarts': [start for start, _ in row_segments],
        'rowHeights': [length for _, length in row_segments],
        'colStarts': [start for start, _ in col_segments],
        'colWidths': [length for _, length in col_segments],
        'scan': {
            'metric': metric,
            'threshold': threshold,
            'autoThreshold': auto_threshold,
            'rowMetric': row_metric,
            'colMetric': col_metric,
            'rowThreshold': row_threshold,
            'colThreshold': col_threshold,
            'rowAutoThreshold': row_auto_threshold,
            'colAutoThreshold': col_auto_threshold,
            'gapMerge': gap_merge,
            'minSegment': min_segment,
            'rowGapMerge': row_gap_merge,
            'colGapMerge': col_gap_merge,
            'rowMinSegment': row_min_segment,
            'colMinSegment': col_min_segment,
            'rowDetectMode': row_detect_mode,
            'colDetectMode': col_detect_mode,
            'rowGapMinSegment': row_gap_min_segment,
            'colGapMinSegment': col_gap_min_segment,
            'uniformRows': uniform_rows,
            'uniformCols': uniform_cols,
            'scanXStart': scan_x[0],
            'scanXEnd': scan_x[1],
            'scanYStart': scan_y[0],
            'scanYEnd': scan_y[1],
            'rowScanXStart': row_scan_x[0],
            'rowScanXEnd': row_scan_x[1],
            'rowScanYStart': row_scan_y[0],
            'rowScanYEnd': row_scan_y[1],
            'colScanXStart': col_scan_x[0],
            'colScanXEnd': col_scan_x[1],
            'colScanYStart': col_scan_y[0],
            'colScanYEnd': col_scan_y[1],
            'colScanFromRow': col_scan_from_row,
        },
    }


def main() -> None:
    if len(sys.argv) == 4 and not sys.argv[1].startswith('-'):
        analyze_grid(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]))
        return

    parser = argparse.ArgumentParser(description='扫描图集网格并输出 row/col 配置')
    parser.add_argument('--image', required=True, help='图片路径')
    parser.add_argument('--metric', default='max', help='扫描指标: max | mean | variance')
    parser.add_argument('--threshold', type=float, default=20, help='阈值 (亮度/均值/方差)')
    parser.add_argument('--auto-threshold', type=float, help='自动阈值比例 (0-1)')
    parser.add_argument('--row-metric', help='行扫描指标 (覆盖 metric)')
    parser.add_argument('--col-metric', help='列扫描指标 (覆盖 metric)')
    parser.add_argument('--row-threshold', type=float, help='行扫描阈值 (覆盖 threshold)')
    parser.add_argument('--col-threshold', type=float, help='列扫描阈值 (覆盖 threshold)')
    parser.add_argument('--row-auto-threshold', type=float, help='行扫描自动阈值比例 (覆盖 auto-threshold)')
    parser.add_argument('--col-auto-threshold', type=float, help='列扫描自动阈值比例 (覆盖 auto-threshold)')
    parser.add_argument('--row-detect-mode', help='行检测模式: content | gap')
    parser.add_argument('--col-detect-mode', help='列检测模式: content | gap')
    parser.add_argument('--gap-merge', type=int, default=2, help='允许合并的小间距')
    parser.add_argument('--min-segment', type=int, default=5, help='最小内容段长度')
    parser.add_argument('--row-gap-merge', type=int, help='行扫描允许合并的小间距')
    parser.add_argument('--col-gap-merge', type=int, help='列扫描允许合并的小间距')
    parser.add_argument('--row-min-segment', type=int, help='行扫描最小内容段长度')
    parser.add_argument('--col-min-segment', type=int, help='列扫描最小内容段长度')
    parser.add_argument('--row-gap-min-segment', type=int, help='行扫描间隙最小长度 (detect-mode=gap)')
    parser.add_argument('--col-gap-min-segment', type=int, help='列扫描间隙最小长度 (detect-mode=gap)')
    parser.add_argument('--uniform-rows', type=int, help='强制均分行数（覆盖扫描）')
    parser.add_argument('--uniform-cols', type=int, help='强制均分列数（覆盖扫描）')
    parser.add_argument('--scan-x-start', type=int, default=0, help='扫描 X 起始')
    parser.add_argument('--scan-x-end', type=int, default=-1, help='扫描 X 结束 (<=0 表示全宽)')
    parser.add_argument('--scan-y-start', type=int, default=0, help='扫描 Y 起始')
    parser.add_argument('--scan-y-end', type=int, default=-1, help='扫描 Y 结束 (<=0 表示全高)')
    parser.add_argument('--row-scan-x-start', type=int, help='行扫描 X 起始')
    parser.add_argument('--row-scan-x-end', type=int, help='行扫描 X 结束')
    parser.add_argument('--row-scan-y-start', type=int, help='行扫描 Y 起始')
    parser.add_argument('--row-scan-y-end', type=int, help='行扫描 Y 结束')
    parser.add_argument('--col-scan-x-start', type=int, help='列扫描 X 起始')
    parser.add_argument('--col-scan-x-end', type=int, help='列扫描 X 结束')
    parser.add_argument('--col-scan-y-start', type=int, help='列扫描 Y 起始')
    parser.add_argument('--col-scan-y-end', type=int, help='列扫描 Y 结束')
    parser.add_argument('--col-scan-from-row', type=int, help='列扫描使用指定行段 (-1=最长行)')
    parser.add_argument('--expected-rows', type=int, help='预期行数（仅提示）')
    parser.add_argument('--expected-cols', type=int, help='预期列数（仅提示）')
    parser.add_argument('--output', help='写入 JSON 文件')
    parser.add_argument('--pretty', action='store_true', help='格式化输出 JSON')
    args = parser.parse_args()

    row_scan_x = None
    row_scan_y = None
    col_scan_x = None
    col_scan_y = None
    if args.row_scan_x_start is not None or args.row_scan_x_end is not None:
        row_scan_x = (
            args.row_scan_x_start or 0,
            args.row_scan_x_end or -1,
        )
    if args.row_scan_y_start is not None or args.row_scan_y_end is not None:
        row_scan_y = (
            args.row_scan_y_start or 0,
            args.row_scan_y_end or -1,
        )
    if args.col_scan_x_start is not None or args.col_scan_x_end is not None:
        col_scan_x = (
            args.col_scan_x_start or 0,
            args.col_scan_x_end or -1,
        )
    if args.col_scan_y_start is not None or args.col_scan_y_end is not None:
        col_scan_y = (
            args.col_scan_y_start or 0,
            args.col_scan_y_end or -1,
        )

    config = build_config(
        args.image,
        args.metric,
        args.threshold,
        args.auto_threshold,
        args.row_metric,
        args.col_metric,
        args.row_threshold,
        args.col_threshold,
        args.row_auto_threshold,
        args.col_auto_threshold,
        args.row_gap_merge,
        args.col_gap_merge,
        args.row_min_segment,
        args.col_min_segment,
        args.row_detect_mode,
        args.col_detect_mode,
        args.row_gap_min_segment,
        args.col_gap_min_segment,
        args.uniform_rows,
        args.uniform_cols,
        args.gap_merge,
        args.min_segment,
        (args.scan_x_start, args.scan_x_end),
        (args.scan_y_start, args.scan_y_end),
        row_scan_x,
        row_scan_y,
        col_scan_x,
        col_scan_y,
        args.col_scan_from_row,
        args.expected_rows,
        args.expected_cols,
    )

    indent = 2 if args.pretty else None
    output = json.dumps(config, ensure_ascii=False, indent=indent)
    print(output)
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output)


if __name__ == '__main__':
    main()
