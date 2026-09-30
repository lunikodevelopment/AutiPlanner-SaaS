#!/usr/bin/env python3
"""Generates the PWA icons.

Kept in the repository so the artwork is reproducible and reviewable instead of
an unexplained binary. Mirrors tools/make_brand_icon.py in the AutiPlanner
repository so the two products look like one family.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "icons"
BACKGROUND = (46, 74, 98)
FOREGROUND = (255, 255, 255)
CHECK = ((0.28, 0.53, 0.43, 0.68), (0.43, 0.68, 0.74, 0.33))
STROKE = 0.085
CORNER_RADIUS = 0.22
SAMPLES = 4
SIZES = (192, 512)


def _rounded_square_coverage(x: float, y: float, size: float, radius: float) -> float:
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    if radius <= x <= size - radius or radius <= y <= size - radius:
        inside = 0 <= x <= size and 0 <= y <= size
    else:
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius**2
    return 1.0 if inside else 0.0


def _distance_to_segment(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return ((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2) ** 0.5


def _check_coverage(x: float, y: float, size: float) -> float:
    half = STROKE * size / 2
    for x1, y1, x2, y2 in CHECK:
        if _distance_to_segment(x, y, x1 * size, y1 * size, x2 * size, y2 * size) <= half:
            return 1.0
    return 0.0


def render(size: int, background_opaque: bool) -> bytes:
    radius = CORNER_RADIUS * size
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            bg = 0.0
            fg = 0.0
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    px = x + (sx + 0.5) / SAMPLES
                    py = y + (sy + 0.5) / SAMPLES
                    if background_opaque:
                        bg = 1.0
                    else:
                        bg += _rounded_square_coverage(px, py, size, radius)
                    fg += _check_coverage(px, py, size)
            samples = SAMPLES * SAMPLES
            if not background_opaque:
                bg /= samples
            fg = min(fg / samples, bg)
            if bg == 0.0:
                rows.extend((0, 0, 0, 0))
                continue
            blend = fg / bg if bg else 0.0
            colour = tuple(round(BACKGROUND[i] + (FOREGROUND[i] - BACKGROUND[i]) * blend) for i in range(3))
            rows.extend((*colour, round(bg * 255)))
    return bytes(rows)


def _chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def encode_png(raw: bytes, size: int) -> bytes:
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(raw, 9))
        + _chunk(b"IEND", b"")
    )


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        # Any-purpose icon: rounded, transparent corners.
        (OUTPUT / f"icon-{size}.png").write_bytes(encode_png(render(size, False), size))
        # Maskable icon: Android crops it, so the artwork must fill the square.
        (OUTPUT / f"maskable-{size}.png").write_bytes(encode_png(render(size, True), size))
        print(f"wrote icon-{size}.png and maskable-{size}.png")


if __name__ == "__main__":
    main()
