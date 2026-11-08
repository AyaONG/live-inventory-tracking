#!/usr/bin/env python3
"""Foreground health sampling. Does not imply coverage while stopped or asleep."""
import argparse,csv,datetime,time,urllib.request
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--url',default='http://localhost:3000/api/health');p.add_argument('--seconds',type=int,default=60);a=p.parse_args()
out=Path(__file__).resolve().parents[1]/'endterm_output/health.csv';out.parent.mkdir(exist_ok=True)
print('Sampling in this Terminal. Stop with Control+C. Gaps are unobserved, not uptime.')
try:
 while True:
  start=time.monotonic();ok=False;status=''
  try:
   with urllib.request.urlopen(a.url,timeout=10) as r:status=r.status;ok=r.status==200
  except Exception as e:status=str(e)
  fresh=not out.exists()
  with out.open('a',newline='') as f:
   w=csv.writer(f)
   if fresh:w.writerow(['timestamp_utc','url','ok','status','elapsed_ms'])
   w.writerow([datetime.datetime.now(datetime.timezone.utc).isoformat(),a.url,ok,status,round((time.monotonic()-start)*1000,2)])
  time.sleep(max(1,a.seconds))
except KeyboardInterrupt:print('\nSaved:',out)
