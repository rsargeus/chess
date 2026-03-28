#!/bin/bash
# Fetch recent production logs from Render
# Usage: ./fetch-logs.sh [limit]

source "$(dirname "$0")/../.env" 2>/dev/null

LIMIT=${1:-50}

curl -s "https://api.render.com/v1/logs?resource=${RENDER_SERVICE_ID}&ownerId=tea-d6v6bmea2pns73ad16n0&limit=${LIMIT}" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Accept: application/json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for log in reversed(data.get('logs', [])):
    ts = log['timestamp'][:19].replace('T',' ')
    msg = log['message']
    try:
        obj = json.loads(msg)
        level = {10:'TRACE',20:'DEBUG',30:'INFO',40:'WARN',50:'ERROR',60:'FATAL'}.get(obj.get('level',30),'INFO')
        text = obj.get('msg','')
        if 'err' in obj:
            text += ' | ' + str(obj['err'])
        print(f'{ts} [{level}] {text}')
    except:
        import re
        clean = re.sub(r'\x1b\[[0-9;]*m', '', msg)
        if clean.strip():
            print(f'{ts} {clean.strip()}')
"
