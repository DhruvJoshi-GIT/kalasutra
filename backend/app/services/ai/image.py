"""Photo-studio image work with Pillow + numpy: fixture cutout, alpha clean-up, backdrops, compositing.

The browser (web/js/studio.js) implements the same backdrops on a canvas; keep the two in step.
"""
from __future__ import annotations

import io
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

SIZE = 1024
BACKDROPS = ["paper", "plain", "warm", "terracotta", "indigo", "haveli", "marigold", "ink"]


# ── io ───────────────────────────────────────────────────────────────
def load(data: bytes) -> Image.Image:
    im = Image.open(io.BytesIO(data))
    im.load()
    return ImageOps.exif_transpose(im)


def fit(im: Image.Image, max_px: int) -> Image.Image:
    im = im.copy()
    im.thumbnail((max_px, max_px), Image.LANCZOS)
    return im


def to_jpeg(im: Image.Image, quality: int = 88) -> bytes:
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=quality, progressive=True, optimize=True)
    return buf.getvalue()


def to_png(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ── cutout (fixture) ─────────────────────────────────────────────────
def keyed_cutout(im: Image.Image) -> Image.Image:
    """No-key fallback: alpha from the colour distance to the photo's border colour (works for plain backgrounds)."""
    rgb = np.asarray(im.convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    b = max(4, min(h, w) // 40)
    border = np.concatenate([rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3), rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
    med = np.median(border, axis=0)
    dist = np.sqrt(((rgb - med) ** 2).sum(axis=2))
    alpha = np.clip((dist - 22) * 255 / 50, 0, 255).astype(np.uint8)
    out = im.convert("RGBA")
    out.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1)))
    return out


# ── alpha clean-up ───────────────────────────────────────────────────
def clean_alpha(im: Image.Image, keep_ratio: float = 0.06) -> Image.Image | None:
    """Sharpen the matte, drop specks (keep the biggest blob and anything ≥ keep_ratio of it), crop to content."""
    im = im.convert("RGBA")
    a = np.asarray(im.getchannel("A")).astype(np.int16)
    H, W = a.shape
    s = 4
    small = a[::s, ::s] > 175          # only solid pixels count as "object"; semi-transparent wisps of backdrop do not
    h4, w4 = small.shape
    lab = -np.ones((h4, w4), dtype=np.int32)
    areas: list[int] = []
    for y in range(h4):
        for x in range(w4):
            if not small[y, x] or lab[y, x] >= 0:
                continue
            idx = len(areas)
            q = deque([(y, x)])
            lab[y, x] = idx
            n = 0
            while q:
                cy, cx = q.popleft()
                n += 1
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h4 and 0 <= nx < w4 and small[ny, nx] and lab[ny, nx] < 0:
                        lab[ny, nx] = idx
                        q.append((ny, nx))
            areas.append(n)
    if not areas:
        return None
    big = max(areas)
    keep_ids = {i for i, n in enumerate(areas) if n >= big * keep_ratio}
    keep = np.isin(lab, list(keep_ids))
    # dilate by one cell so edges are not nibbled
    pad = np.pad(keep, 1)
    dil = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:] | keep
    mask = np.kron(dil, np.ones((s, s), dtype=bool))[:H, :W]
    a2 = np.where(mask, a, 0)
    a2 = np.where(a2 < 96, 0, np.where(a2 > 200, 255, (a2 - 96) * 255 // 104)).astype(np.uint8)
    im.putalpha(Image.fromarray(a2))
    bbox = Image.fromarray((a2 > 8).astype(np.uint8) * 255).getbbox()
    if not bbox:
        return None
    m = round(max(W, H) * 0.01)
    bbox = (max(0, bbox[0] - m), max(0, bbox[1] - m), min(W, bbox[2] + m), min(H, bbox[3] + m))
    return im.crop(bbox)


# ── backdrops ────────────────────────────────────────────────────────
def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


def _gradient(size: int, top: str, bottom: str) -> Image.Image:
    t, b = np.array(_hex(top), dtype=np.float32), np.array(_hex(bottom), dtype=np.float32)
    k = np.linspace(0, 1, size, dtype=np.float32)[:, None, None]
    arr = (t * (1 - k) + b * k)
    return Image.fromarray(np.broadcast_to(arr, (size, size, 3)).astype(np.uint8), "RGB")


def _vignette(im: Image.Image, strength: float) -> Image.Image:
    size = im.size[0]
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.sqrt((x - size / 2) ** 2 + (y - size * 0.42) ** 2) / (size * 0.85)
    k = 1 - np.clip((d - 0.24) / 0.76, 0, 1) * strength
    arr = np.asarray(im).astype(np.float32) * k[:, :, None]
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def _floor(im: Image.Image, strength: float) -> Image.Image:
    size = im.size[0]
    k = np.ones(size, dtype=np.float32)
    start = int(size * 0.68)
    k[start:] = 1 - np.linspace(0, strength, size - start)
    arr = np.asarray(im).astype(np.float32) * k[:, None, None]
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def _tile(im: Image.Image, tile: Image.Image) -> Image.Image:
    out = im.convert("RGBA")
    tw, th = tile.size
    for y in range(0, out.size[1], th):
        for x in range(0, out.size[0], tw):
            out.alpha_composite(tile, (x, y))
    return out.convert("RGB")


def _motif_tile(kind: str, s: int) -> Image.Image:
    t = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    if kind == "buti":                      # Bagru flower with a stem and a leaf
        col = (255, 235, 210, 40)
        for cx, cy in ((s * 0.28, s * 0.2), (s * 0.78, s * 0.62)):
            r = s * 0.07
            for i in range(6):
                a = i * np.pi / 3
                px, py = cx + np.cos(a) * r, cy + np.sin(a) * r
                d.ellipse((px - r * 0.42, py - r * 0.42, px + r * 0.42, py + r * 0.42), fill=col)
            d.ellipse((cx - r * 0.35, cy - r * 0.35, cx + r * 0.35, cy + r * 0.35), fill=col)
            d.line((cx, cy + r * 1.2, cx + r * 0.3, cy + r * 2.2, cx, cy + r * 3), fill=col, width=max(1, s // 100))
            d.ellipse((cx - r * 1.6, cy + r * 1.8, cx - r * 0.2, cy + r * 2.4), fill=col)
    elif kind == "paisley":
        col = (246, 245, 240, 44)
        w = max(1, s // 100)
        for cx, cy in ((s * 0.3, s * 0.3), (s * 0.8, s * 0.8)):
            r = s * 0.11
            d.ellipse((cx - r, cy - r * 1.3, cx + r, cy + r), outline=col, width=w)
            d.polygon([(cx - r * 0.2, cy - r * 1.2), (cx + r * 0.9, cy - r * 2.0), (cx + r * 0.6, cy - r * 0.6)], outline=col)
            d.ellipse((cx - r * 0.28, cy - r * 0.38, cx + r * 0.28, cy + r * 0.18), fill=col)
        for cx, cy in ((s * 0.8, s * 0.28), (s * 0.3, s * 0.78)):
            d.ellipse((cx - s * 0.02, cy - s * 0.02, cx + s * 0.02, cy + s * 0.02), fill=col)
    elif kind == "jaali":                    # octagon-and-square lattice
        col = (90, 60, 30, 42)
        w = max(1, s // 60)
        o, r = s / 2, s * 0.31
        pts = [(o + np.cos(i * np.pi / 4 + np.pi / 8) * r, o + np.sin(i * np.pi / 4 + np.pi / 8) * r) for i in range(8)]
        d.polygon(pts, outline=col, width=w)
        for cx, cy in ((0, 0), (s, 0), (0, s), (s, s)):
            d.rectangle((cx - s * 0.08, cy - s * 0.08, cx + s * 0.08, cy + s * 0.08), outline=col, width=w)
    elif kind == "marigold":
        col = (255, 255, 255, 36)
        for cx, cy in ((s * 0.3, s * 0.3), (s * 0.8, s * 0.8)):
            R = s * 0.17
            for ring in (3, 2, 1):
                r = R * ring / 3
                for i in range(ring * 6):
                    a = i * 2 * np.pi / (ring * 6)
                    px, py = cx + np.cos(a) * r, cy + np.sin(a) * r
                    d.ellipse((px - R * 0.11, py - R * 0.11, px + R * 0.11, py + R * 0.11), fill=col)
    return t


def backdrop(key: str, size: int = SIZE) -> Image.Image:
    u = size / 1024
    if key == "plain":
        return Image.new("RGB", (size, size), (255, 255, 255))
    if key == "paper":
        return _vignette(Image.new("RGB", (size, size), _hex("#F6F5F0")), 0.05)
    if key == "warm":
        return _floor(_gradient(size, "#F6EBDB", "#D8B893"), 0.28)
    if key == "terracotta":
        im = _tile(_gradient(size, "#C8724B", "#9E4E2E"), _motif_tile("buti", round(120 * u)))
        return _floor(_vignette(im, 0.22), 0.35)
    if key == "indigo":
        im = _tile(_gradient(size, "#24405F", "#101F36"), _motif_tile("paisley", round(140 * u)))
        return _floor(_vignette(im, 0.3), 0.4)
    if key == "haveli":
        im = _tile(_gradient(size, "#EAD8B8", "#CDAE84"), _motif_tile("jaali", round(96 * u)))
        return _floor(im, 0.32)
    if key == "marigold":
        im = _tile(_gradient(size, "#F7C948", "#DE9A00"), _motif_tile("marigold", round(150 * u)))
        return _floor(_vignette(im, 0.14), 0.3)
    # ink
    return _vignette(Image.new("RGB", (size, size), (22, 22, 22)), -0.9)


# ── composite ────────────────────────────────────────────────────────
def compose(cut: Image.Image, key: str = "paper", shadow: bool = True, size: int = SIZE) -> Image.Image:
    cut = cut.convert("RGBA")
    bg = backdrop(key if key in BACKDROPS else "paper", size).convert("RGBA")
    pad = size * 0.09
    k = min((size - 2 * pad) / cut.width, (size - 2 * pad) / cut.height)
    w, h = max(1, round(cut.width * k)), max(1, round(cut.height * k))
    obj = cut.resize((w, h), Image.LANCZOS)
    px, py = round((size - w) / 2), round((size - h) / 2 + (0 if key == "plain" else size * 0.015))
    if shadow:
        sil = Image.new("RGBA", obj.size, (0, 0, 0, 0))
        sil.putalpha(obj.getchannel("A"))
        contact = sil.resize((max(1, round(w * 0.92)), max(1, round(h * 0.16))), Image.LANCZOS)
        layer = Image.new("RGBA", bg.size, (0, 0, 0, 0))
        layer.alpha_composite(contact, (round(px + w * 0.04), round(py + h * 0.9)))
        layer = layer.filter(ImageFilter.GaussianBlur(22 * size / 1024))
        layer.putalpha(layer.getchannel("A").point(lambda a: int(a * 0.28)))
        bg.alpha_composite(layer)
        drop = Image.new("RGBA", bg.size, (0, 0, 0, 0))
        drop.alpha_composite(sil, (px + 10, py + 18))
        drop = drop.filter(ImageFilter.GaussianBlur(26 * size / 1024))
        drop.putalpha(drop.getchannel("A").point(lambda a: int(a * 0.16)))
        bg.alpha_composite(drop)
    bg.alpha_composite(obj, (px, py))
    return bg.convert("RGB")
