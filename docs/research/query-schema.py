import json,sys,re
D=json.load(open(sys.argv[1]))['data']['__schema']
T={t['name']:t for t in D['types']}
def tn(t):
    while t and t.get('ofType'): 
        if t['kind']=='NON_NULL': pass
        t=t['ofType']
    return t['name'] if t else '?'
def show(name, only=None):
    t=T.get(name)
    if not t: print(f'!! no type {name}'); return
    print(f'== {name} ({t["kind"]}) {(t.get("description") or "")[:120]}')
    for f in (t.get('fields') or []):
        if only and not re.search(only,f['name'],re.I): continue
        args=','.join(f'{a["name"]}:{tn(a["type"])}' for a in (f.get('args') or []))
        print(f'   {f["name"]}({args}) -> {tn(f["type"])}   {(f.get("description") or "")[:100]}')
    for f in (t.get('inputFields') or []):
        if only and not re.search(only,f['name'],re.I): continue
        print(f'   in {f["name"]}: {tn(f["type"])}   {(f.get("description") or "")[:100]}')
    for e in (t.get('enumValues') or [])[:60]:
        print(f'   | {e["name"]}')
if __name__=='__main__':
    for n in sys.argv[2:]: show(n)
