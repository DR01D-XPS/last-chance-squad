"""Check the exported pixels, including all 224 animation frames."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'assets/manifest.json').read_text(encoding='utf-8'))
errors = []
frame_count = 0
for player in manifest['characters']:
    with Image.open(root / 'assets' / player['path']) as image:
        if image.size != (1024, 896) or image.mode != 'RGBA':
            errors.append(f"{player['path']}: expected RGBA 1024 x 896")
        for row, animation in enumerate(manifest['animations']):
            for col in range(8):
                cell = image.crop((col * 128, row * 128, (col + 1) * 128, (row + 1) * 128))
                bounds = cell.getchannel('A').getbbox()
                frame_count += 1
                if bounds is None:
                    errors.append(f"Player {player['id'] + 1} {animation['name']} {col}: empty")
                elif bounds[0] == 0 or bounds[1] == 0 or bounds[2] == 128 or bounds[3] == 128:
                    errors.append(f"Player {player['id'] + 1} {animation['name']} {col}: clipping at {bounds}")
for district in manifest['districts']:
    with Image.open(root / 'assets/previews' / f"arena-{district['id']}.png") as image:
        if image.size != (1600, 800):
            errors.append(f"Arena {district['id']}: incorrect resolution")
result = {'passed': not errors, 'framesChecked': frame_count, 'errors': errors}
out = root / 'artifacts/verification/asset-checks.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(bool(errors))
