"""Create a deterministic two-button menu asset; no documents or network."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path('design/line')
out.mkdir(parents=True, exist_ok=True)
image = Image.new('RGB', (2500, 843), '#c84912')
draw = ImageDraw.Draw(image)
draw.rectangle((1250, 0, 2499, 842), fill='#f7dc77')
bold = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
regular = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
def text(center, y, value, size, color, heavy=False):
    font = ImageFont.truetype(bold if heavy else regular, size)
    draw.text((center, y), value, font=font, fill=color, anchor='mt')

# Document and guide outlines are simple UI symbols, not scanned content.
draw.rounded_rectangle((540, 100, 710, 285), radius=18, outline='white', width=10)
for y in (156, 200, 244):
    draw.line((577, y, 673, y), fill='white', width=9)
draw.rounded_rectangle((1790, 100, 1960, 285), radius=18, outline='#123c2f', width=10)
text(1875, 128, 'i', 110, '#123c2f', True)
text(625, 338, '書類をPDFに', 100, 'white', True)
text(625, 497, 'ブラウザーで開く', 57, '#fff3e8')
text(625, 665, 'docPDF', 40, '#fff3e8', True)
text(1875, 338, '使い方・安全', 100, '#123c2f', True)
text(1875, 497, '保存先と共有先を確認', 57, '#34483b')
text(1875, 665, '検証版', 40, '#34483b', True)
path = out / 'rich-menu.png'
image.save(path, optimize=True)
assert image.size == (2500, 843)
assert path.stat().st_size < 1_000_000
print(f'{path}: 2500×843, {path.stat().st_size} bytes, PNG')
