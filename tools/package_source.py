#!/usr/bin/env python3
"""Package actual current source; omit dependencies, credentials, backups and private videos."""
from pathlib import Path
from datetime import datetime
import zipfile,argparse
p=argparse.ArgumentParser();p.add_argument('--include-videos',action='store_true');a=p.parse_args()
root=Path(__file__).resolve().parents[1];out=root/'endterm_output';out.mkdir(exist_ok=True)
dest=out/('a4_source_'+datetime.now().strftime('%Y%m%d_%H%M%S')+'.zip')
excluded={'node_modules','.git','.vscode','.venv','.endterm-venv','endterm_output','__pycache__','ICT_Backups'}
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
 for f in root.rglob('*'):
  if not f.is_file()or f.is_symlink():continue
  rel=f.relative_to(root)
  if any(x in excluded for x in rel.parts)or f.name.startswith('.env')or f.suffix in {'.dump','.bak','.pyc','.log','.code-workspace'}or f.name=='.DS_Store':continue
  if not a.include_videos and rel.parts[:2]==('storage','videos'):continue
  z.write(f,'a4/'+rel.as_posix())
print('SOURCE PACKAGE:',dest)
print('Database dumps are separate. Product videos are excluded unless --include-videos was explicitly selected.')
