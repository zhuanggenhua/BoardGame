"""Generate cinematic Fate-style command seal emblems (Imagine API was 502)."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent
SIZE = 512


def blank() -> Image.Image:
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def stamp(base: Image.Image, layer: Image.Image) -> Image.Image:
    out = base.copy()
    out.alpha_composite(layer)
    return out


def glow_stroke(points: list[tuple[float, float]], color: tuple[int, int, int], width: float, blur: int, alpha: int) -> Image.Image:
    img = blank()
    draw = ImageDraw.Draw(img)
    xy = [(p[0], p[1]) for p in points]
    draw.line(xy, fill=(*color, alpha), width=int(width), joint="curve")
    if len(xy) > 2 and math.hypot(xy[0][0] - xy[-1][0], xy[0][1] - xy[-1][1]) < 4:
        draw.polygon(xy, outline=(*color, alpha))
    return img.filter(ImageFilter.GaussianBlur(blur))


def polyline(cx: float, cy: float, scale: float, pts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [(cx + x * scale, cy + y * scale) for x, y in pts]


def render_seal_branch() -> Image.Image:
    """Three-pronged branching crest."""
    img = blank()
    cx, cy = SIZE / 2, SIZE / 2 + 12
    prongs = [
        [(0, 78), (-8, 20), (-54, -62), (-28, -18), (0, -70)],
        [(0, 78), (8, 20), (54, -62), (28, -18), (0, -70)],
        [(0, 78), (0, 8), (-18, -8), (0, -86), (18, -8), (0, 8)],
    ]
    for prong in prongs:
        pts = polyline(cx, cy, 1.55, prong)
        img = stamp(img, glow_stroke(pts, (120, 8, 12), 38, 22, 90))
        img = stamp(img, glow_stroke(pts, (220, 24, 32), 18, 8, 180))
        img = stamp(img, glow_stroke(pts, (255, 90, 70), 7, 2, 255))
        img = stamp(img, glow_stroke(pts, (255, 220, 200), 2, 0, 255))
    core = blank()
    d = ImageDraw.Draw(core)
    d.ellipse((cx - 18, cy + 70, cx + 18, cy + 106), fill=(255, 70, 50, 200))
    img = stamp(img, core.filter(ImageFilter.GaussianBlur(8)))
    return img


def render_seal_ring() -> Image.Image:
    """Nested rings with a dagger stroke."""
    img = blank()
    cx = cy = SIZE / 2
    rings = [(168, 28), (118, 18), (72, 12)]
    for radius, width in rings:
        ring = blank()
        d = ImageDraw.Draw(ring)
        box = (cx - radius, cy - radius, cx + radius, cy + radius)
        d.ellipse(box, outline=(210, 30, 36, 220), width=width)
        img = stamp(img, ring.filter(ImageFilter.GaussianBlur(10)))
        img = stamp(img, ring.filter(ImageFilter.GaussianBlur(3)))
        sharp = blank()
        d2 = ImageDraw.Draw(sharp)
        d2.ellipse(box, outline=(255, 120, 90, 255), width=max(2, width // 3))
        img = stamp(img, sharp)
    dagger = [(cx, cy - 190), (cx, cy + 188)]
    img = stamp(img, glow_stroke(dagger, (140, 10, 16), 30, 16, 120))
    img = stamp(img, glow_stroke(dagger, (255, 70, 55), 10, 3, 255))
    img = stamp(img, glow_stroke(dagger, (255, 230, 210), 3, 0, 255))
    bar = [(cx - 70, cy + 24), (cx + 70, cy + 24)]
    img = stamp(img, glow_stroke(bar, (255, 80, 60), 8, 3, 240))
    return img


def render_seal_wing() -> Image.Image:
    """Curved flame-wing hook."""
    img = blank()
    cx, cy = SIZE / 2, SIZE / 2
    wing = [
        (cx - 20, cy + 150),
        (cx - 70, cy + 40),
        (cx - 40, cy - 80),
        (cx + 30, cy - 170),
        (cx + 90, cy - 70),
        (cx + 40, cy + 10),
        (cx + 110, cy + 70),
        (cx + 20, cy + 40),
        (cx - 10, cy + 150),
    ]
    fill = blank()
    d = ImageDraw.Draw(fill)
    d.polygon(wing, fill=(180, 18, 24, 140))
    img = stamp(img, fill.filter(ImageFilter.GaussianBlur(18)))
    img = stamp(img, glow_stroke(wing, (120, 8, 12), 36, 20, 90))
    img = stamp(img, glow_stroke(wing, (230, 30, 36), 14, 6, 200))
    img = stamp(img, glow_stroke(wing, (255, 110, 80), 5, 1, 255))
    hook = [(cx - 10, cy + 20), (cx + 50, cy - 90), (cx + 8, cy - 150)]
    img = stamp(img, glow_stroke(hook, (255, 200, 170), 3, 0, 255))
    return img


def vignette(img: Image.Image) -> Image.Image:
    overlay = blank()
    d = ImageDraw.Draw(overlay)
    d.ellipse((36, 36, SIZE - 36, SIZE - 36), fill=(8, 0, 0, 40))
    overlay = overlay.filter(ImageFilter.GaussianBlur(24))
    return stamp(overlay, img)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("seal-branch.png", render_seal_branch),
        ("seal-ring.png", render_seal_ring),
        ("seal-wing.png", render_seal_wing),
    ]
    for name, fn in jobs:
        art = vignette(fn())
        path = OUT / name
        art.save(path)
        print(path, art.size)


if __name__ == "__main__":
    main()
