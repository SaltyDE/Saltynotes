"""Generates the SaltyNotes app icons (notepad look, cream + brown)."""
from PIL import Image, ImageDraw

CREAM = (247, 238, 214, 255)
CREAM_DARK = (237, 224, 191, 255)
BROWN = (91, 62, 40, 255)
BROWN_LIGHT = (139, 98, 63, 255)
LINE = (196, 168, 122, 255)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * (0.14 if maskable else 0.04))
    box = [pad, pad, size - pad, size - pad]
    radius = int(size * 0.16)

    # page shadow
    shadow_box = [box[0] + size * 0.02, box[1] + size * 0.03, box[2] + size * 0.02, box[3] + size * 0.03]
    rounded_rect(d, shadow_box, radius, (60, 40, 25, 70))

    # page body
    rounded_rect(d, box, radius, CREAM)

    # spiral binding strip at top
    strip_h = (box[3] - box[1]) * 0.16
    d.rectangle([box[0], box[1], box[2], box[1] + strip_h], fill=CREAM_DARK)
    holes = 6
    hole_r = strip_h * 0.16
    usable = (box[2] - box[0]) * 0.78
    start_x = box[0] + (box[2] - box[0]) * 0.11
    for i in range(holes):
        cx = start_x + usable * i / (holes - 1)
        cy = box[1] + strip_h / 2
        d.ellipse([cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r], fill=BROWN)

    # ruled lines
    line_top = box[1] + strip_h + (box[3] - box[1]) * 0.10
    line_gap = (box[3] - box[1]) * 0.115
    line_x0 = box[0] + (box[2] - box[0]) * 0.14
    line_x1 = box[2] - (box[2] - box[0]) * 0.14
    for i in range(4):
        y = line_top + line_gap * i
        d.line([line_x0, y, line_x1, y], fill=LINE, width=max(2, int(size * 0.012)))

    # bold checkmark
    ck_w = max(3, int(size * 0.075))
    cx0, cy0 = box[0] + (box[2] - box[0]) * 0.30, box[1] + (box[3] - box[1]) * 0.68
    cx1, cy1 = box[0] + (box[2] - box[0]) * 0.46, box[1] + (box[3] - box[1]) * 0.82
    cx2, cy2 = box[0] + (box[2] - box[0]) * 0.74, box[1] + (box[3] - box[1]) * 0.52
    d.line([cx0, cy0, cx1, cy1], fill=BROWN, width=ck_w, joint="curve")
    d.line([cx1, cy1, cx2, cy2], fill=BROWN, width=ck_w, joint="curve")
    r = ck_w / 2
    for (x, y) in [(cx0, cy0), (cx1, cy1), (cx2, cy2)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=BROWN)

    return img


for size in (192, 512):
    make_icon(size).save(f"/home/user/Saltynotes/icons/icon-{size}.png")
    make_icon(size, maskable=True).save(f"/home/user/Saltynotes/icons/icon-{size}-maskable.png")

make_icon(64).save("/home/user/Saltynotes/icons/favicon.png")
print("done")
