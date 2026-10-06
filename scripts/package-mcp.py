"""Emit a reproducible connector deploy payload; contains code/public IDs only."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
paths = [
 'supabase/functions/wenyan-mcp/index.ts', 'supabase/functions/wenyan-mcp/deno.json',
 'src/mcp/server.js', 'src/mcp/tools.js', 'src/core.js', 'src/cloud/protocol.js',
 'src/english/config.js', 'src/english/session.js', 'src/english/smart.js',
 'src/english/queue.js', 'src/english/events.js', 'src/english/keys.js',
]
files = [{'name':p,'content':(root/p).read_text()} for p in paths]
# Tools need only stable IDs and ordering, never another copy of definitions.
catalog = json.loads((root/'public/data/english/netem-v1.json').read_text())['catalog']
files.append({'name':'public/data/english/netem-v1.json','content':json.dumps({'catalog':[{'id':w['id']} for w in catalog]})})
print(json.dumps({'project_id':'cmjhxvpkdeheujuteqoi','name':'wenyan-mcp',
 'entrypoint_path':paths[0],'import_map_path':paths[1],'verify_jwt':False,'files':files}))
