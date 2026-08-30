"""Dump named types from a STRATZ GraphQL introspection response.

    python3 query-schema.py <schema.json> HeroStatsQuery MatchType ...

Type references are printed as GraphQL writes them, wrappers included:
`[HeroLaneOutcomeType]` is a list and `Short!` is non-null, and a reader who
cannot tell a list from a single value cannot write the query.

Descriptions are cut at DESCRIPTION_CHARS and marked with an ellipsis where
they were: this is a map of the surface, and the console holds the prose. The
marker is the point — an unmarked cut reads as a sentence the API ended
mid-clause.
"""

import json
import sys

#: Description prefix kept per field. Marked with `…` where a cut happened.
DESCRIPTION_CHARS = 100


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


def desc(node):
    """A node's description, cut to DESCRIPTION_CHARS and marked if cut."""
    text = " ".join((node.get("description") or "").split())
    return text if len(text) <= DESCRIPTION_CHARS else text[:DESCRIPTION_CHARS] + "…"


def show(types, name):
    t = types.get(name)
    if not t:
        print(f"!! no type {name}")
        return
    print(f'== {name} ({t["kind"]}) {desc(t)}')
    for f in t.get("fields") or []:
        args = ", ".join(f'{a["name"]}: {tn(a["type"])}' for a in f.get("args") or [])
        print(f'   {f["name"]}({args}) -> {tn(f["type"])}   {desc(f)}')
    for f in t.get("inputFields") or []:
        print(f'   in {f["name"]}: {tn(f["type"])}   {desc(f)}')
    for e in (t.get("enumValues") or [])[:60]:
        print(f'   | {e["name"]}')


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as handle:
        schema = json.load(handle)["data"]["__schema"]
    types = {t["name"]: t for t in schema["types"]}
    for name in sys.argv[2:]:
        show(types, name)
