"""Dump named types from a STRATZ GraphQL introspection response.

    python3 query-schema.py <schema.json> HeroStatsQuery MatchType ...

Type references are printed as GraphQL writes them, wrappers included:
`[HeroLaneOutcomeType]` is a list and `Short!` is non-null, and a reader who
cannot tell a list from a single value cannot write the query.
"""

import json
import sys


def tn(t):
    """A type reference as GraphQL spells it, following `ofType` outwards."""
    if not t:
        return "?"
    kind = t.get("kind")
    if kind == "NON_NULL":
        return tn(t.get("ofType")) + "!"
    if kind == "LIST":
        return "[" + tn(t.get("ofType")) + "]"
    return t.get("name") or "?"


def show(types, name):
    t = types.get(name)
    if not t:
        print(f"!! no type {name}")
        return
    print(f'== {name} ({t["kind"]}) {(t.get("description") or "")[:120]}')
    for f in t.get("fields") or []:
        args = ", ".join(f'{a["name"]}: {tn(a["type"])}' for a in f.get("args") or [])
        print(f'   {f["name"]}({args}) -> {tn(f["type"])}   {(f.get("description") or "")[:100]}')
    for f in t.get("inputFields") or []:
        print(f'   in {f["name"]}: {tn(f["type"])}   {(f.get("description") or "")[:100]}')
    for e in (t.get("enumValues") or [])[:60]:
        print(f'   | {e["name"]}')


if __name__ == "__main__":
    schema = json.load(open(sys.argv[1]))["data"]["__schema"]
    types = {t["name"]: t for t in schema["types"]}
    for name in sys.argv[2:]:
        show(types, name)
