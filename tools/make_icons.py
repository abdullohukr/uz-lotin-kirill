"""Draws the ribbon icons (PNG) without any extra libraries."""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "addin", "assets")

# 5x7 bitmap glyphs
GLYPHS = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "Б": ["11111", "10000", "10000", "11110", "10001", "10001", "11110"],
}


def png(path, size, pixels):
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in pixels)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(data)


def icon(size, letters, bg):
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]
    r = max(2, size // 6)
    for y in range(size):
        for x in range(size):
            dx = max(r - x, 0, x - (size - 1 - r))
            dy = max(r - y, 0, y - (size - 1 - r))
            if dx * dx + dy * dy <= r * r:
                px[y][x] = bg + (255,)
    n = len(letters)
    scale = max(1, (size * 7 // 10) // (6 * n))
    gw = 6 * n * scale - scale
    gh = 7 * scale
    ox, oy = (size - gw) // 2, (size - gh) // 2
    for i, ch in enumerate(letters):
        for gy, row in enumerate(GLYPHS[ch]):
            for gx, bit in enumerate(row):
                if bit == "1":
                    for sy in range(scale):
                        for sx in range(scale):
                            px[oy + gy * scale + sy][ox + (i * 6 + gx) * scale + sx] = (255, 255, 255, 255)
    return px


os.makedirs(OUT, exist_ok=True)
for size in (16, 32, 64, 80):
    png(os.path.join(OUT, f"icon-{size}.png"), size, icon(size, "LK", (31, 111, 235)))
    png(os.path.join(OUT, f"cyr-{size}.png"), size, icon(size, "Б", (46, 125, 50)))
    png(os.path.join(OUT, f"lat-{size}.png"), size, icon(size, "A", (198, 40, 40)))
print("icons written to", os.path.abspath(OUT))
