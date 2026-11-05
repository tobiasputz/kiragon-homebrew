#!/usr/bin/env python3
"""Build a Foundry installable ZIP plus release manifest; no third-party dependencies."""
import argparse, json, pathlib, re, shutil, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--repository',default='tobiasputz/kiragon-homebrew')
parser.add_argument('--tag',default='v1.0.0')
args=parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',args.repository):parser.error('Invalid owner/repository')
if not re.fullmatch(r'v\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9.-]+)?',args.tag):parser.error('Invalid version tag')
manifest=json.loads((ROOT/'module.json').read_text(encoding='utf8'))
version=args.tag.removeprefix('v')
manifest.update(version=version,url=f'https://github.com/{args.repository}',manifest=f'https://github.com/{args.repository}/releases/latest/download/module.json',download=f'https://github.com/{args.repository}/releases/download/{args.tag}/kiragon-homebrew.zip')
OUT=ROOT/'dist';OUT.mkdir(exist_ok=True)
(OUT/'module.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
with zipfile.ZipFile(OUT/'kiragon-homebrew.zip','w',zipfile.ZIP_DEFLATED) as z:
    for path in [ROOT/'module.json',*sorted((ROOT/'scripts').glob('*.mjs')),*sorted((ROOT/'styles').glob('*.css')),*sorted((ROOT/'packs').glob('*.json'))]:
        relative=path.relative_to(ROOT).as_posix()
        if relative=='module.json':z.writestr(relative,json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
        else:z.write(path,relative)
with zipfile.ZipFile(OUT/'kiragon-homebrew.zip') as z:
    assert 'module.json' in z.namelist()
    assert json.loads(z.read('module.json'))['download']==manifest['download']
print('Created',OUT/'kiragon-homebrew.zip', 'and',OUT/'module.json')
