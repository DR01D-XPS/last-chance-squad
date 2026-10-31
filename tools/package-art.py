"""Package only the art deliverable and its verification, never node_modules."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parent.parent
output = root / 'artifacts/LastChance-ArtKit-v0.1.zip'
output.parent.mkdir(exist_ok=True)
files = [root / name for name in (
    'README.md', 'ART_DIRECTION.md', 'PROJECT_PROGRESS.md', 'Открыть сцену.cmd',
    'package.json', 'package-lock.json', '.gitignore',
)]
for directory in ('assets', 'docs', 'preview', 'src', 'tools', 'tests', 'references', 'artifacts/verification'):
    files.extend(sorted(p for p in (root / directory).rglob('*') if p.is_file()))
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for file in files:
        archive.write(file, 'LastChance-ArtKit/' + file.relative_to(root).as_posix())
with ZipFile(output) as archive:
    assert archive.testzip() is None, 'Archive integrity check failed'
    names = archive.namelist()
    assert 'LastChance-ArtKit/preview/index.html' in names
    assert 'LastChance-ArtKit/assets/manifest.json' in names
    assert not any('node_modules/' in name for name in names)
result = {'path': output.relative_to(root).as_posix(), 'files': len(files), 'bytes': output.stat().st_size,
          'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'integrityChecked': True}
(root / 'artifacts/package.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
