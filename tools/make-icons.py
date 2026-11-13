#!/usr/bin/env python3
"""Генератор иконок приложения (3D-кубик в изометрии).

Запуск из корня проекта:   python tools/make-icons.py
Нужен Pillow (pip install pillow). Результат — папка icons/:
  icon.svg                  — векторная иконка (favicon и «any»)
  icon-32.png               — favicon
  apple-touch-icon.png      — 180×180 для iOS (без прозрачности)
  icon-192.png, icon-512.png            — «any», со скруглённым тёмным фоном
  icon-maskable-512.png     — «maskable», фон на весь квадрат, куб в безопасной зоне
"""
import math
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "icons")

# те же цвета, что и в js/cube-core.js
YELLOW, GREEN, ORANGE = (255, 213, 0), (0, 158, 96), (255, 122, 0)
BODY = (13, 16, 23)
BG_EDGE, BG_CENTER = (11, 14, 23), (27, 34, 56)

# жёлтый сверху, зелёный на тебя, справа оранжевый — как «держать куб» на сайте
FACES = [  # (название, цвет, множитель яркости)
    ("top", YELLOW, 1.00),
    ("left", GREEN, 0.92),
    ("right", ORANGE, 0.84),
]
GAP = 0.075      # зазор между наклейками (доля от размера клетки грани)
RADIUS = 0.17    # скругление наклейки (доля от размера грани)
ARC_STEPS = 6


def hexagon(r):
    """Вершины изометрического куба вокруг (0, 0); ось Y экрана направлена вниз."""
    c = math.cos(math.radians(30)) * r
    return {
        "top": (0, -r), "ur": (c, -r / 2), "lr": (c, r / 2),
        "bottom": (0, r), "ll": (-c, r / 2), "ul": (-c, -r / 2), "c": (0, 0),
    }


def face_frames(r):
    """Для каждой грани — начало O и два вектора u, v (по сторонам грани)."""
    p = hexagon(r)

    def vec(a, b):
        return (b[0] - a[0], b[1] - a[1])

    return {
        "top": (p["top"], vec(p["top"], p["ur"]), vec(p["top"], p["ul"])),
        "left": (p["ul"], vec(p["ul"], p["c"]), vec(p["ul"], p["ll"])),
        "right": (p["c"], vec(p["c"], p["ur"]), vec(p["c"], p["bottom"])),
    }


def rounded_rect_points(x0, y0, x1, y1, rad):
    """Скруглённый прямоугольник в плоскости грани (0..1 × 0..1) в виде ломаной."""
    pts = []
    corners = [
        (x1 - rad, y0 + rad, -90), (x1 - rad, y1 - rad, 0),
        (x0 + rad, y1 - rad, 90), (x0 + rad, y0 + rad, 180),
    ]
    for cx, cy, start in corners:
        for k in range(ARC_STEPS + 1):
            a = math.radians(start + 90 * k / ARC_STEPS)
            pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    return pts


def sticker_polys(r):
    """Список (цвет, множитель, [точки на экране]) для всех 27 наклеек."""
    frames = face_frames(r)
    out = []
    for name, color, shade in FACES:
        (ox, oy), (ux, uy), (vx, vy) = frames[name]
        for i in range(3):
            for j in range(3):
                x0, x1 = (i + GAP) / 3, (i + 1 - GAP) / 3
                y0, y1 = (j + GAP) / 3, (j + 1 - GAP) / 3
                local = rounded_rect_points(x0, y0, x1, y1, RADIUS / 3 * 1.6)
                pts = [(ox + ux * s + vx * t, oy + uy * s + vy * t) for s, t in local]
                out.append((color, shade, pts))
    return out


def body_polygon(r, grow=0.0):
    """Тёмный корпус куба — слегка расширенный шестиугольник."""
    h = hexagon(r * (1 + grow))
    return [h["top"], h["ur"], h["lr"], h["bottom"], h["ll"], h["ul"]]


def shade(color, k):
    return tuple(min(255, int(round(ch * k))) for ch in color)


def background(size, rounded):
    """Радиальный тёмный фон; при rounded=True углы прозрачные."""
    small = 256
    img = Image.new("RGB", (small, small), BG_EDGE)
    px = img.load()
    cx = cy = small / 2
    maxd = math.hypot(cx, cy) * 0.82
    for y in range(small):
        for x in range(small):
            t = min(1.0, math.hypot(x - cx, y - cy * 1.1) / maxd)
            t = t * t * (3 - 2 * t)
            px[x, y] = tuple(int(BG_CENTER[n] + (BG_EDGE[n] - BG_CENTER[n]) * t) for n in range(3))
    img = img.resize((size, size), Image.BICUBIC).convert("RGBA")
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.225), fill=255)
        img.putalpha(mask)
    return img


def render(size, radius_ratio, rounded, ss=4):
    """Рисуем в 4-кратном размере и уменьшаем — получается гладкое сглаживание."""
    big = size * ss
    img = background(big, rounded)
    d = ImageDraw.Draw(img)
    r = big * radius_ratio
    c = big / 2
    # центр куба чуть выше: оптическая компенсация острого низа
    cy = c + r * 0.0

    def to_px(pts):
        return [(c + x, cy + y) for x, y in pts]

    # мягкая тень под кубом
    shadow = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon(
        to_px([(x, y + r * 0.06) for x, y in body_polygon(r, 0.05)]), fill=(0, 0, 0, 120)
    )
    from PIL import ImageFilter
    shadow = shadow.filter(ImageFilter.GaussianBlur(big * 0.018))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img)

    d.polygon(to_px(body_polygon(r, 0.0)), fill=BODY)
    # лёгкая обводка корпуса, чтобы «закруглить» острые вершины
    d.line(to_px(body_polygon(r, 0.0)) + [to_px(body_polygon(r, 0.0))[0]], fill=BODY, width=max(1, int(big * 0.012)), joint="curve")
    for color, k, pts in sticker_polys(r):
        d.polygon(to_px(pts), fill=shade(color, k))
    return img.resize((size, size), Image.LANCZOS)


def write_svg(path, radius_ratio=0.40):
    size = 512
    r = size * radius_ratio
    c = size / 2

    def fmt(pts):
        return " ".join("%.2f,%.2f" % (c + x, c + y) for x, y in pts)

    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
        '<defs><radialGradient id="g" cx="50%" cy="46%" r="62%">',
        '<stop offset="0" stop-color="#1b2238"/><stop offset="1" stop-color="#0b0e17"/></radialGradient></defs>',
        '<rect width="512" height="512" rx="115" fill="url(#g)"/>',
        '<polygon fill="#0d1017" points="%s"/>' % fmt(body_polygon(r)),
    ]
    for color, k, pts in sticker_polys(r):
        parts.append('<polygon fill="#%02x%02x%02x" points="%s"/>' % (*shade(color, k), fmt(pts)))
    parts.append("</svg>")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts) + "\n")


def main():
    os.makedirs(OUT, exist_ok=True)
    write_svg(os.path.join(OUT, "icon.svg"))
    render(512, 0.385, True).save(os.path.join(OUT, "icon-512.png"), optimize=True)
    render(192, 0.385, True).save(os.path.join(OUT, "icon-192.png"), optimize=True)
    # maskable: фон на весь квадрат, а куб целиком внутри безопасной зоны (круг 80%)
    render(512, 0.34, False).convert("RGB").save(os.path.join(OUT, "icon-maskable-512.png"), optimize=True)
    render(180, 0.37, False).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
    render(32, 0.44, True).save(os.path.join(OUT, "icon-32.png"), optimize=True)
    print("Иконки записаны в", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
