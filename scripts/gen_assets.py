"""
gen_assets.py — generates all media assets for vscode-digimon.
Uses only stdlib: struct, zlib, os.  No Pillow required.
Run with:  py scripts/gen_assets.py
"""
import struct, zlib, os

BASE = os.path.join(os.path.dirname(__file__), '..', 'media')

# ─── Minimal PNG writer ────────────────────────────────────────────────────────
def _chunk(tag: bytes, data: bytes) -> bytes:
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

def make_png(w: int, h: int, pixels: list[list[tuple]]) -> bytes:
    """pixels[y][x] = (R,G,B,A)"""
    raw = b''
    for row in pixels:
        raw += b'\x00'  # filter type None
        for r,g,b,a in row:
            raw += bytes([r,g,b,a])
    compressed = zlib.compress(raw)
    return (
        b'\x89PNG\r\n\x1a\n'
        + _chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
        + _chunk(b'IDAT', compressed)
        + _chunk(b'IEND', b'')
    )

def save_png(path: str, w: int, h: int, pixels):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(make_png(w, h, pixels))
    print(f'  PNG  {os.path.relpath(path, BASE)!s:60s} ({w}x{h})')

def solid_png(path, w, h, r, g, b, a=255):
    save_png(path, w, h, [[(r,g,b,a)]*w for _ in range(h)])

def transparent_png(path, w=1, h=1):
    solid_png(path, w, h, 0, 0, 0, 0)

# ─── Minimal GIF writer ───────────────────────────────────────────────────────
def lzw_encode(data: bytes, min_code_size: int) -> bytes:
    """Minimal LZW encoder for GIF."""
    clear = 1 << min_code_size
    eoi   = clear + 1
    table: dict[bytes, int] = {bytes([i]): i for i in range(clear)}
    next_code = eoi + 1
    code_size = min_code_size + 1

    codes: list[int] = [clear]
    buf = b''
    for byte in data:
        trial = buf + bytes([byte])
        if trial in table:
            buf = trial
        else:
            codes.append(table[buf])
            if next_code < 4096:
                table[trial] = next_code
                next_code += 1
                if next_code > (1 << code_size) and code_size < 12:
                    code_size += 1
            buf = bytes([byte])
    if buf:
        codes.append(table[buf])
    codes.append(eoi)

    # Pack codes into bytes
    out = bytearray()
    bit_buf = 0
    bit_len = 0
    for code in codes:
        bit_buf |= code << bit_len
        bit_len += code_size
        while bit_len >= 8:
            out.append(bit_buf & 0xFF)
            bit_buf >>= 8
            bit_len -= 8
        # Recompute code_size dynamically
        if next_code > (1 << code_size) and code_size < 12:
            code_size += 1
    if bit_len:
        out.append(bit_buf & 0xFF)

    # Sub-block it
    result = bytearray([min_code_size])
    data_bytes = bytes(out)
    i = 0
    while i < len(data_bytes):
        chunk = data_bytes[i:i+255]
        result.append(len(chunk))
        result.extend(chunk)
        i += 255
    result.append(0)
    return bytes(result)

def make_gif(frames: list[tuple], palette: list[tuple], loop=True) -> bytes:
    """
    frames = list of (pixels_2d, delay_cs)   pixels_2d[y][x] = palette_index
    palette = list of (R,G,B) up to 256 entries
    """
    W = len(frames[0][0][0])
    H = len(frames[0][0])
    pal_size = 1
    while pal_size < len(palette): pal_size <<= 1
    pal_size = max(pal_size, 2)
    pal_flag = int.bit_length(pal_size - 1) - 1  # 2^(N+1) colours

    # Build flat palette bytes
    pal_bytes = b''
    for r,g,b in palette:
        pal_bytes += bytes([r,g,b])
    pal_bytes += b'\x00\x00\x00' * (pal_size - len(palette))

    # Header
    out = b'GIF89a'
    out += struct.pack('<HH', W, H)
    out += bytes([0b10000000 | pal_flag, 0, 0])  # GCT flag, bg=0, ar=0
    out += pal_bytes

    # Netscape loop extension
    if loop:
        out += b'\x21\xFF\x0B' + b'NETSCAPE2.0' + b'\x03\x01\x00\x00\x00'

    min_cs = max(2, pal_flag + 1)

    for pixels_2d, delay_cs in frames:
        # Graphic control extension
        out += b'\x21\xF9\x04'
        out += bytes([0, delay_cs & 0xFF, (delay_cs >> 8) & 0xFF, 0, 0])

        # Image descriptor
        out += b'\x2C'
        out += struct.pack('<HHHHB', 0, 0, W, H, 0)

        # Flatten pixel data
        flat = bytes([pixels_2d[y][x] for y in range(H) for x in range(W)])
        out += lzw_encode(flat, min_cs)

    out += b'\x3B'
    return out

def save_gif(path, frames, palette, loop=True):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(make_gif(frames, palette, loop))
    w = len(frames[0][0][0])
    h = len(frames[0][0])
    print(f'  GIF  {os.path.relpath(path, BASE)!s:60s} ({w}x{h} x{len(frames)}f)')

# ─── Drawing helpers ──────────────────────────────────────────────────────────
def blank(w, h, bg=0):
    return [[bg]*w for _ in range(h)]

def rect(canvas, x, y, w, h, c):
    for dy in range(h):
        for dx in range(w):
            canvas[y+dy][x+dx] = c

def hline(canvas, y, x0, x1, c):
    for x in range(x0, x1+1):
        canvas[y][x] = c

def vline(canvas, x, y0, y1, c):
    for y in range(y0, y1+1):
        canvas[y][x] = c

def outline(canvas, x, y, w, h, c):
    hline(canvas, y, x, x+w-1, c)
    hline(canvas, y+h-1, x, x+w-1, c)
    vline(canvas, x, y, y+h-1, c)
    vline(canvas, x+w-1, y, y+h-1, c)

# ─── Digimon sprite generator ─────────────────────────────────────────────────
# We draw simple 32×32 pixel-art characters in a 64×64 canvas (centred).
# Each character has: head, body, arms, legs.  Idle = 2 frame breathe.
# Walk = 4 frame leg cycle (right leg forward, neutral, left leg forward, neutral).

TRANSPARENT = 0  # palette index 0 = transparent (GIF disposal)

def make_agumon_palette():
    return [
        (0,0,0,0),          # 0 transparent (for PNG) / bg-color for GIF
        (0,0,0),            # 1 black outline
        (230, 120, 20),     # 2 body orange
        (250, 160, 40),     # 3 highlight orange
        (200, 80, 10),      # 4 shadow orange
        (255, 255, 255),    # 5 white belly
        (80, 200, 80),      # 6 green eye
        (60, 140, 220),     # 7 blue claws
        (180, 60, 10),      # 8 dark claw
    ]

def draw_agumon(canvas, leg_offset=0, arm_offset=0):
    """Draw Agumon (orange dino) centred on 64x64 canvas. leg_offset: -2..2"""
    ox, oy = 16, 8  # offset to centre the 32x32 sprite

    # Body
    rect(canvas, ox+8, oy+14, 16, 14, 2)
    rect(canvas, ox+10, oy+13, 12, 2, 3)   # highlight top
    rect(canvas, ox+9, oy+24, 14, 4, 4)    # shadow bottom
    outline(canvas, ox+8, oy+14, 16, 14, 1)

    # Belly
    rect(canvas, ox+11, oy+17, 10, 8, 5)
    outline(canvas, ox+11, oy+17, 10, 8, 1)

    # Head
    rect(canvas, ox+7, oy+4, 18, 12, 2)
    rect(canvas, ox+8, oy+3, 16, 2, 3)    # top highlight
    outline(canvas, ox+7, oy+4, 18, 12, 1)

    # Eye
    canvas[oy+7][ox+19] = 6
    canvas[oy+7][ox+20] = 6
    canvas[oy+8][ox+19] = 6
    canvas[oy+6][ox+19] = 1
    canvas[oy+6][ox+20] = 1
    canvas[oy+9][ox+19] = 1

    # Snout bump
    rect(canvas, ox+5, oy+8, 4, 4, 2)
    outline(canvas, ox+5, oy+8, 4, 4, 1)

    # Left arm
    rect(canvas, ox+5, oy+16+arm_offset, 4, 6, 2)
    outline(canvas, ox+5, oy+16+arm_offset, 4, 6, 1)
    rect(canvas, ox+4, oy+21+arm_offset, 3, 2, 7)

    # Right arm
    rect(canvas, ox+23, oy+16-arm_offset, 4, 6, 2)
    outline(canvas, ox+23, oy+16-arm_offset, 4, 6, 1)
    rect(canvas, ox+25, oy+21-arm_offset, 3, 2, 7)

    # Left leg
    rect(canvas, ox+10, oy+27+max(0,leg_offset), 5, 5-max(0,leg_offset), 2)
    outline(canvas, ox+10, oy+27+max(0,leg_offset), 5, 5-max(0,leg_offset), 1)
    rect(canvas, ox+9, oy+31, 6, 2, 7)
    outline(canvas, ox+9, oy+31, 6, 2, 1)

    # Right leg
    rect(canvas, ox+17, oy+27+max(0,-leg_offset), 5, 5-max(0,-leg_offset), 2)
    outline(canvas, ox+17, oy+27+max(0,-leg_offset), 5, 5-max(0,-leg_offset), 1)
    rect(canvas, ox+17, oy+31, 6, 2, 7)
    outline(canvas, ox+17, oy+31, 6, 2, 1)

    # Tail
    rect(canvas, ox+24, oy+22, 5, 3, 4)
    rect(canvas, ox+27, oy+20, 4, 3, 4)
    rect(canvas, ox+29, oy+18, 3, 3, 4)
    canvas[oy+22][ox+24] = 1
    canvas[oy+24][ox+28] = 1

def make_gabumon_palette():
    return [
        (0,0,0,0),
        (0,0,0),          # 1 outline
        (60, 90, 160),    # 2 blue pelt
        (90, 130, 210),   # 3 highlight blue
        (40, 60, 120),    # 4 shadow blue
        (230, 210, 170),  # 5 cream snout/belly
        (200, 80, 80),    # 6 pink nose
        (255, 200, 40),   # 7 yellow horn
        (150, 50, 50),    # 8 dark horn
    ]

def draw_gabumon(canvas, leg_offset=0, arm_offset=0):
    ox, oy = 16, 8
    # Pelt body
    rect(canvas, ox+7, oy+12, 18, 16, 2)
    rect(canvas, ox+8, oy+11, 16, 3, 3)
    rect(canvas, ox+8, oy+24, 14, 4, 4)
    outline(canvas, ox+7, oy+12, 18, 16, 1)
    # Belly cream
    rect(canvas, ox+10, oy+16, 12, 9, 5)
    outline(canvas, ox+10, oy+16, 12, 9, 1)
    # Head (round)
    rect(canvas, ox+8, oy+3, 16, 11, 2)
    rect(canvas, ox+10, oy+2, 12, 3, 3)
    outline(canvas, ox+8, oy+3, 16, 11, 1)
    # Snout cream
    rect(canvas, ox+9, oy+8, 10, 6, 5)
    outline(canvas, ox+9, oy+8, 10, 6, 1)
    # Nose
    rect(canvas, ox+13, oy+9, 4, 2, 6)
    # Eyes
    canvas[oy+5][ox+11] = 1
    canvas[oy+5][ox+12] = 1
    canvas[oy+5][ox+19] = 1
    canvas[oy+5][ox+20] = 1
    # Horn
    rect(canvas, ox+12, oy+0, 4, 4, 7)
    rect(canvas, ox+13, oy+0, 2, 2, 8)
    outline(canvas, ox+12, oy+0, 4, 4, 1)
    # Arms
    rect(canvas, ox+4, oy+14+arm_offset, 4, 7, 2)
    outline(canvas, ox+4, oy+14+arm_offset, 4, 7, 1)
    rect(canvas, ox+24, oy+14-arm_offset, 4, 7, 2)
    outline(canvas, ox+24, oy+14-arm_offset, 4, 7, 1)
    # Legs
    rect(canvas, ox+10, oy+26+max(0,leg_offset), 5, 6-max(0,leg_offset), 2)
    outline(canvas, ox+10, oy+26+max(0,leg_offset), 5, 6-max(0,leg_offset), 1)
    rect(canvas, ox+17, oy+26+max(0,-leg_offset), 5, 6-max(0,-leg_offset), 2)
    outline(canvas, ox+17, oy+26+max(0,-leg_offset), 5, 6-max(0,-leg_offset), 1)

def make_patamon_palette():
    return [
        (0,0,0,0),
        (0,0,0),          # 1 outline
        (230, 180, 100),  # 2 orange-tan body
        (250, 210, 140),  # 3 highlight
        (190, 140, 70),   # 4 shadow
        (255, 255, 255),  # 5 white belly/wings
        (255, 100, 100),  # 6 pink cheeks/nose
        (80, 180, 255),   # 7 wing blue tint
        (60, 60, 200),    # 8 dark wing
    ]

def draw_patamon(canvas, leg_offset=0, arm_offset=0):
    ox, oy = 16, 10
    # Round body
    rect(canvas, ox+6, oy+12, 20, 16, 2)
    rect(canvas, ox+8, oy+10, 16, 4, 3)
    rect(canvas, ox+8, oy+24, 14, 4, 4)
    outline(canvas, ox+6, oy+12, 20, 16, 1)
    # Belly
    rect(canvas, ox+9, oy+16, 14, 9, 5)
    outline(canvas, ox+9, oy+16, 14, 9, 1)
    # Head (big round)
    rect(canvas, ox+7, oy+0, 18, 14, 2)
    rect(canvas, ox+9, oy+0, 14, 3, 3)
    outline(canvas, ox+7, oy+0, 18, 14, 1)
    # Eyes
    rect(canvas, ox+10, oy+4, 4, 5, 1)   # left eye socket
    rect(canvas, ox+11, oy+5, 2, 3, 5)
    rect(canvas, ox+18, oy+4, 4, 5, 1)
    rect(canvas, ox+19, oy+5, 2, 3, 5)
    # Cheek
    canvas[oy+8][ox+10] = 6
    canvas[oy+8][ox+21] = 6
    # Big bat ear/wing on top
    rect(canvas, ox+4, oy+0, 8, 6, 5)
    outline(canvas, ox+4, oy+0, 8, 6, 7)
    rect(canvas, ox+20, oy+0, 8, 6, 5)
    outline(canvas, ox+20, oy+0, 8, 6, 7)
    # Small legs
    rect(canvas, ox+10, oy+26+max(0,leg_offset), 4, 4-max(0,leg_offset), 2)
    outline(canvas, ox+10, oy+26+max(0,leg_offset), 4, 4-max(0,leg_offset), 1)
    rect(canvas, ox+18, oy+26+max(0,-leg_offset), 4, 4-max(0,-leg_offset), 2)
    outline(canvas, ox+18, oy+26+max(0,-leg_offset), 4, 4-max(0,-leg_offset), 1)

# Map from palette (R,G,B,A) to index
def build_pal_map(palette_rgba):
    return {(r,g,b,a): i for i,(r,g,b,a) in enumerate(palette_rgba)}

def gif_palette(rgba_list):
    """Return [(R,G,B)] for GIF (drop alpha, use idx 0 as transparent)."""
    result = []
    for entry in rgba_list:
        result.append((entry[0], entry[1], entry[2]))
    return result


def canvas_to_indexed(canvas_rgba, pal_rgba):
    h = len(canvas_rgba)
    w = len(canvas_rgba[0])
    pm = build_pal_map([(r,g,b,255) for r,g,b,_ in pal_rgba])
    transparent_idx = 0
    result = []
    for row in canvas_rgba:
        r_row = []
        for r,g,b,a in row:
            if a == 0:
                r_row.append(transparent_idx)
            else:
                r_row.append(pm.get((r,g,b,255), transparent_idx))
        result.append(r_row)
    return result

def make_rgba_canvas(w, h, pal_rgba, draw_fn, **kwargs):
    """Create a 64x64 RGBA canvas, call draw_fn, return indexed pixels."""
    # Start fully transparent
    canvas = [[0]*w for _ in range(h)]  # indexed canvas
    draw_fn(canvas, **kwargs)
    return canvas

# ─── Generate sprites for one Digimon ────────────────────────────────────────
def gen_digimon_sprites(name, palette_fn, draw_fn, dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    pal_gif = gif_palette(palette_fn())   # (R,G,B) list for GIF

    # ── idle: 2 frames, arms slightly different ───────────────────────────────
    f1 = make_rgba_canvas(64, 64, palette_fn(), draw_fn, leg_offset=0, arm_offset=0)
    f2 = make_rgba_canvas(64, 64, palette_fn(), draw_fn, leg_offset=0, arm_offset=1)
    idle_frames = [(f1, 60), (f2, 60)]   # 60cs = 600ms each
    save_gif(os.path.join(dest_dir, 'idle.gif'), idle_frames, pal_gif)

    # ── walk_right: 4 frames leg cycle ────────────────────────────────────────
    leg_seq = [2, 0, -2, 0]
    arm_seq = [1, 0, -1, 0]
    walk_frames = []
    for lo, ao in zip(leg_seq, arm_seq):
        f = make_rgba_canvas(64, 64, palette_fn(), draw_fn, leg_offset=lo, arm_offset=ao)
        walk_frames.append((f, 12))  # 12cs = 120ms each
    save_gif(os.path.join(dest_dir, 'walk_right.gif'), walk_frames, pal_gif)

    # ── walk_left: horizontal flip of walk_right ──────────────────────────────
    flipped = []
    for frame, delay in walk_frames:
        flipped.append(([row[::-1] for row in frame], delay))
    save_gif(os.path.join(dest_dir, 'walk_left.gif'), flipped, pal_gif)

# ─── Generate backgrounds ────────────────────────────────────────────────────
SIZES = {'small': (160, 360), 'medium': (220, 460), 'large': (300, 600)}
THEMES = ['forest', 'castle', 'beach', 'none']
VARIANTS = ['dark', 'light']

def stars(w, h, count=80, brightness=220):
    pix = [[(20,20,35,255)]*w for _ in range(h)]
    import random; random.seed(42)
    for _ in range(count):
        x = random.randint(0, w-1)
        y = random.randint(0, h//2)
        pix[y][x] = (brightness, brightness, brightness, 255)
    return pix

def forest_bg(w, h, dark=True):
    sky = (15, 20, 40) if dark else (135, 180, 230)
    pix = [[(sky[0], sky[1], sky[2], 255)]*w for _ in range(h)]
    if dark:
        # Stars
        import random; random.seed(7)
        for _ in range(60):
            x = random.randint(0, w-1)
            y = random.randint(0, h*2//5)
            pix[y][x] = (220, 220, 240, 255)
    # Distant trees (dark silhouette)
    import random; random.seed(3)
    tree_c = (20, 50, 20, 255) if dark else (60, 120, 60, 255)
    for i in range(w//12 + 2):
        tx = random.randint(0, w)
        th = random.randint(h//4, h//2)
        tw = random.randint(8, 20)
        for dy in range(th):
            for dx in range(max(0, tx-tw//2), min(w, tx+tw//2)):
                if h-1-dy >= 0:
                    pix[h-1-dy][dx] = tree_c
    # Ground
    gc = (30, 60, 30, 255) if dark else (80, 150, 60, 255)
    for y in range(h-40, h):
        for x in range(w):
            pix[y][x] = gc
    return pix

def forest_fg(w, h, dark=True):
    pix = [[(0,0,0,0)]*w for _ in range(h)]
    gc = (20, 90, 20, 255) if dark else (50, 160, 50, 255)
    import random; random.seed(11)
    # Grass tufts along bottom
    for x in range(0, w, 4):
        bh = random.randint(10, 28)
        for dy in range(bh):
            if h-1-dy >= 0:
                pix[h-1-dy][x] = gc
                if x+1 < w: pix[h-1-dy][x+1] = gc
    return pix

def castle_bg(w, h, dark=True):
    sky = (10, 10, 30) if dark else (100, 120, 200)
    pix = [[(sky[0],sky[1],sky[2],255)]*w for _ in range(h)]
    # Moon
    import random; random.seed(5)
    if dark:
        for _ in range(50):
            x = random.randint(0, w-1); y = random.randint(0, h//3)
            pix[y][x] = (210,210,240,255)
        mx, my, mr = w*3//4, h//6, 14
        for dy in range(-mr, mr+1):
            for dx in range(-mr, mr+1):
                if dx*dx+dy*dy <= mr*mr and 0<=my+dy<h and 0<=mx+dx<w:
                    pix[my+dy][mx+dx] = (240,240,200,255)
    # Battlements
    bc = (50,50,60,255) if dark else (120,120,140,255)
    for y in range(h-60, h):
        for x in range(w): pix[y][x] = bc
    merlons_y = h-60
    for x in range(0, w, 14):
        for dy in range(16):
            for dx in range(8):
                if x+dx < w: pix[merlons_y-dy][x+dx] = bc
    return pix

def castle_fg(w, h, dark=True):
    pix = [[(0,0,0,0)]*w for _ in range(h)]
    sc = (30,30,40,200) if dark else (100,100,120,200)
    for x in range(0, w, 6):
        pix[h-1][x] = sc
        if x+1<w: pix[h-1][x+1] = sc
    return pix

def beach_bg(w, h, dark=True):
    sky_top = (5,10,40) if dark else (135,200,240)
    sky_bot = (10,20,70) if dark else (200,230,255)
    pix = []
    for y in range(h):
        t = y/h
        r = int(sky_top[0]*(1-t)+sky_bot[0]*t)
        g = int(sky_top[1]*(1-t)+sky_bot[1]*t)
        b_v = int(sky_top[2]*(1-t)+sky_bot[2]*t)
        pix.append([(r,g,b_v,255)]*w)
    # Ocean
    oc = (10,40,100,255) if dark else (30,120,200,255)
    for y in range(h-80, h-30):
        for x in range(w): pix[y][x] = oc
    # Sand
    sc = (100,80,50,255) if dark else (220,200,140,255)
    for y in range(h-30, h):
        for x in range(w): pix[y][x] = sc
    return pix

def beach_fg(w, h, dark=True):
    pix = [[(0,0,0,0)]*w for _ in range(h)]
    import random; random.seed(9)
    pc = (80,65,40,255)
    for _ in range(w//6):
        x = random.randint(0, w-2)
        pix[h-1][x] = pc
        pix[h-1][x+1] = pc
    return pix

BG_FNS = {'forest': forest_bg, 'castle': castle_bg, 'beach': beach_bg}
FG_FNS = {'forest': forest_fg, 'castle': castle_fg, 'beach': beach_fg}

def gen_backgrounds():
    for theme in THEMES:
        for variant in VARIANTS:
            for size_name, (sw, sh) in SIZES.items():
                dark = (variant == 'dark')
                prefix = os.path.join(BASE, 'backgrounds', theme)

                bg_path = os.path.join(prefix, f'background-{variant}-{size_name}.png')
                fg_path = os.path.join(prefix, f'foreground-{variant}-{size_name}.png')

                if theme == 'none':
                    transparent_png(bg_path, sw, sh)
                    transparent_png(fg_path, sw, sh)
                else:
                    bg_pix = BG_FNS[theme](sw, sh, dark)
                    save_png(bg_path, sw, sh, bg_pix)
                    fg_pix = FG_FNS[theme](sw, sh, dark)
                    save_png(fg_path, sw, sh, fg_pix)

# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('\n=== Generating Digimon sprites ===')

    # ── Agumon ────────────────────────────────────────────────────────────────
    agumon_dest = os.path.join(BASE, 'agumon')
    existing = [f for f in ['idle.gif','walk_right.gif','walk_left.gif']
                if os.path.exists(os.path.join(agumon_dest, f))
                   and os.path.getsize(os.path.join(agumon_dest, f)) > 50000]
    if len(existing) == 3:
        print(f'  SKIP agumon — real sprites already present ({", ".join(existing)})')
    else:
        gen_digimon_sprites('Agumon', make_agumon_palette, draw_agumon,
                            os.path.join(BASE, 'agumon'))

    # ── Gabumon & Patamon ────────────────────────────────────────────────────
    gen_digimon_sprites('Gabumon', make_gabumon_palette, draw_gabumon,
                        os.path.join(BASE, 'gabumon'))
    gen_digimon_sprites('Patamon', make_patamon_palette, draw_patamon,
                        os.path.join(BASE, 'patamon'))

    print('\n=== Generating backgrounds ===')
    gen_backgrounds()

    print('\nDone! All assets written to media/')
