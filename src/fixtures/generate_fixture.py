#!/usr/bin/env python3
"""Deterministic mock snapshot generator for Dota 2 Pick Assistant.

Produces snapshot.json following data-model.md §5.
- 33 heroes: everything referenced in design-brief.md mock states,
  plus search-test heroes (legacy names, abbreviations) and one
  insufficient-data hero.
- Full antisymmetric matchup matrix and symmetric synergy matrix:
  a few hand-set notable pairs (incl. the Razor/Axe-vs-Troll test case
  from model-spec.md §7.2), the rest seeded noise.
- Hero ids are plausible Valve ids; verify against real data in the
  STRATZ pipeline before relying on them outside tests.

Regenerate (the Biome step collapses short arrays to match the committed,
formatter-owned file):
    python3 generate_fixture.py > snapshot.json && bunx biome format --write snapshot.json
"""
import json
import random

rng = random.Random(42)

# name, id, aliases, positions {pos: (share, meta_pp)}, side_radiant_pp,
# phase (p1, p2, last) pp, contest, sufficient
HEROES = [
    # --- bans in the brief's mock state ---
    ("Snapfire",        128, ["snap"],            {4: (0.65, 2.1), 5: (0.35, 1.9)}, 0.4, (0.2, 0.3, 0.1), 0.81, True),
    ("Invoker",          74, ["invo", "voker"],   {2: (0.75, 2.8), 1: (0.25, 1.1)}, -0.6, (0.6, -0.2, -0.4), 0.58, True),
    ("Bounty Hunter",    62, ["bh", "bounty"],    {4: (0.80, 6.2), 3: (0.20, 2.0)}, 0.2, (0.3, 0.1, -0.2), 0.13, True),
    ("Enigma",           33, ["nigma"],           {3: (0.55, 5.8), 4: (0.45, 4.9)}, 0.1, (-0.5, 0.6, 0.2), 0.09, True),
    ("Pudge",            14, ["butcher"],         {4: (0.85, 0.6), 2: (0.15, 0.2)}, 0.3, (0.1, 0.4, -0.3), 0.85, True),
    ("Winter Wyvern",   112, ["ww", "wyvern"],    {5: (0.70, 3.8), 4: (0.30, 3.2)}, 0.1, (0.2, 0.8, -0.4), 0.12, True),
    # --- my team mock picks ---
    ("Zeus",             22, ["zues"],            {2: (0.60, 0.3), 4: (0.40, 0.1)}, 0.2, (0.3, 0.2, -0.6), 0.55, True),
    ("Spirit Breaker",   71, ["sb", "bara"],      {4: (0.70, 2.4), 3: (0.30, 1.8)}, -0.3, (0.2, 0.4, -0.2), 0.38, True),
    # --- enemy mock picks ---
    ("Undying",          85, ["dirge"],           {5: (0.60, 2.2), 4: (0.40, 2.4)}, 0.5, (0.1, 0.3, 0.0), 0.29, True),
    ("Drow Ranger",       6, ["drow", "traxex"],  {1: (0.90, 2.1), 2: (0.10, 0.8)}, 0.7, (0.2, 0.2, 0.1), 0.49, True),
    ("Axe",               2, ["mogul khan"],      {3: (0.85, 0.9), 4: (0.15, 0.3)}, -0.1, (-0.4, 0.3, 0.4), 0.51, True),
    ("Lion",             26, ["demon witch"],     {4: (0.55, -0.6), 5: (0.45, -1.1)}, -0.2, (0.1, -0.1, 0.0), 0.55, True),
    # --- carry suggestion pool ---
    ("Spectre",          67, ["spec"],            {1: (0.95, 3.1), 2: (0.05, 0.5)}, 0.3, (-1.2, 0.4, 1.6), 0.30, True),
    ("Phantom Lancer",   12, ["pl"],              {1: (0.92, 2.7), 2: (0.08, 0.4)}, -0.4, (-1.5, 0.3, 1.4), 0.42, True),
    ("Lifestealer",      54, ["naix"],            {1: (0.97, 3.6), 3: (0.03, 0.2)}, 0.1, (-2.0, 0.5, 0.6), 0.27, True),
    ("Juggernaut",        8, ["jug", "jugger"],   {1: (0.96, 2.5), 3: (0.04, 0.1)}, 0.6, (-0.3, 0.2, 0.5), 0.24, True),
    ("Slark",            93, ["fish"],            {1: (0.94, 1.6), 2: (0.06, 0.3)}, 0.2, (-1.0, -0.4, 1.5), 0.25, True),
    # --- offlane suggestion pool ---
    ("Night Stalker",    60, ["ns", "balanar"],   {3: (0.80, 3.9), 4: (0.20, 2.6)}, 0.7, (0.4, 0.5, -0.5), 0.33, True),
    ("Dawnbreaker",     135, ["dawn", "valora"],  {3: (0.75, 1.7), 4: (0.25, 1.2)}, -0.6, (-0.6, 0.6, 0.7), 0.31, True),
    ("Tidehunter",       29, ["tide"],            {3: (0.90, 0.4), 5: (0.10, -0.3)}, 0.0, (-0.7, 0.1, 0.8), 0.17, True),
    ("Doom",             69, ["lucifer"],         {3: (0.85, 0.5), 1: (0.15, 0.1)}, -0.3, (-0.2, -0.1, 0.6), 0.23, True),
    ("Clockwerk",        51, ["clock", "rattletrap"], {4: (0.75, 2.3), 3: (0.25, 1.5)}, 0.0, (0.4, -0.1, -0.9), 0.18, True),
    # --- support suggestion pool ---
    ("Keeper of the Light", 90, ["kotl", "ezalor"], {5: (0.75, 4.2), 4: (0.25, 3.5)}, -0.3, (0.2, 0.1, 0.9), 0.22, True),
    ("Oracle",          111, ["ora"],             {5: (0.85, 3.0), 4: (0.15, 2.2)}, -0.4, (0.3, 0.4, 0.1), 0.15, True),
    ("Treant Protector", 83, ["treant", "rooftrellen"], {5: (0.70, 3.9), 4: (0.30, 3.3)}, 1.1, (0.2, 0.9, 0.3), 0.18, True),
    ("Bane",              3, ["atropos"],         {5: (0.80, 2.8), 4: (0.20, 2.1)}, 0.5, (0.1, 0.6, 0.0), 0.13, True),
    ("Lich",             31, ["ethreain"],        {5: (0.90, 1.3), 4: (0.10, 0.7)}, 0.4, (-0.1, 0.5, -0.7), 0.22, True),
    # --- search & model test cases ---
    ("Clinkz",           56, ["bone fletcher", "bone"], {1: (0.85, 2.0), 2: (0.15, 0.6)}, 1.4, (0.2, 0.3, -0.2), 0.13, True),
    ("Wraith King",      42, ["wk", "skeleton king", "sk"], {1: (0.90, 1.5), 3: (0.10, 0.4)}, 0.0, (-1.1, 0.6, 0.4), 0.12, True),
    ("Anti-Mage",         1, ["am", "magina"],    {1: (1.00, -0.7)}, 0.9, (-3.4, -1.1, 2.8), 0.24, True),
    ("Razor",            15, ["lightning revenant"], {1: (0.60, -1.2), 3: (0.40, -0.9)}, 0.9, (-0.9, 0.2, 0.4), 0.10, True),
    ("Troll Warlord",    95, ["troll"],           {1: (0.95, 0.2), 2: (0.05, 0.0)}, 0.4, (-2.6, 0.3, -0.5), 0.06, True),
    # insufficient-data hero (recently released)
    ("Largo",           150, [],                  {3: (0.55, 0.0), 1: (0.45, 0.0)}, 0.0, (0.0, 0.0, 0.0), 0.12, False),
]

# Hand-set matchup advantages, pp, from the row hero's perspective.
# Includes model-spec §7.2 acceptance case: Razor and Axe counter Troll.
NOTABLE_MATCHUPS = {
    ("Razor", "Troll Warlord"): 4.2,
    ("Axe", "Troll Warlord"): 3.5,
    ("Axe", "Phantom Lancer"): 3.9,
    ("Lifestealer", "Winter Wyvern"): -3.1,
    ("Anti-Mage", "Bane"): -2.8,
    ("Spectre", "Drow Ranger"): 2.6,
    ("Night Stalker", "Zeus"): 2.2,
    ("Doom", "Undying"): 2.4,
    ("Juggernaut", "Axe"): -2.5,
    ("Phantom Lancer", "Lich"): -3.4,
    ("Clinkz", "Axe"): -3.0,
    ("Slark", "Oracle"): -2.7,
    ("Tidehunter", "Lifestealer"): -2.2,
}

NOTABLE_SYNERGIES = {
    ("Spirit Breaker", "Snapfire"): 1.4,
    ("Zeus", "Keeper of the Light"): 1.2,
    ("Spectre", "Zeus"): 1.6,
    ("Phantom Lancer", "Bane"): 1.1,
    ("Juggernaut", "Winter Wyvern"): 1.3,
    ("Lifestealer", "Undying"): 1.5,
    ("Drow Ranger", "Clockwerk"): 1.2,
    ("Night Stalker", "Dawnbreaker"): 1.0,
    ("Anti-Mage", "Treant Protector"): 0.9,
}

names = [h[0] for h in HEROES]
ids = {h[0]: h[1] for h in HEROES}


def noise(scale):
    return round(rng.gauss(0, scale), 1)


heroes_json = []
for name, hid, aliases, positions, side_r, (p1, p2, plast), contest, sufficient in HEROES:
    pos_json = {}
    for pos, (share, meta) in positions.items():
        pos_json[str(pos)] = {
            "share": share,
            "meta": meta if sufficient else 0.0,
            "sufficient": sufficient,
        }
    heroes_json.append({
        "id": hid,
        "name": name,
        "short": name.lower().replace(" ", "-").replace("'", ""),
        "icon": f"/icons/{name.lower().replace(' ', '_').replace(chr(39), '')}.png",
        "aliases": aliases,
        "sufficient": sufficient,
        "contest": contest,
        "side": {"radiant": side_r if sufficient else 0.0,
                 "dire": round(-side_r * 0.8, 1) if sufficient else 0.0},
        "phase": {"p1": p1, "p2": p2, "last": plast} if sufficient
                 else {"p1": 0.0, "p2": 0.0, "last": 0.0},
    })
    heroes_json[-1]["positions"] = pos_json

# Full antisymmetric matchup matrix
matchups = {str(ids[n]): {} for n in names}
for i, a in enumerate(names):
    for b in names[i + 1:]:
        if not (next(h for h in HEROES if h[0] == a)[7] and next(h for h in HEROES if h[0] == b)[7]):
            adv = 0.0  # insufficient hero: neutral everywhere
        elif (a, b) in NOTABLE_MATCHUPS:
            adv = NOTABLE_MATCHUPS[(a, b)]
        elif (b, a) in NOTABLE_MATCHUPS:
            adv = -NOTABLE_MATCHUPS[(b, a)]
        else:
            adv = noise(1.1)
        matchups[str(ids[a])][str(ids[b])] = adv
        matchups[str(ids[b])][str(ids[a])] = round(-adv, 1)

# Full symmetric synergy matrix
synergies = {str(ids[n]): {} for n in names}
for i, a in enumerate(names):
    for b in names[i + 1:]:
        if not (next(h for h in HEROES if h[0] == a)[7] and next(h for h in HEROES if h[0] == b)[7]):
            syn = 0.0
        elif (a, b) in NOTABLE_SYNERGIES:
            syn = NOTABLE_SYNERGIES[(a, b)]
        elif (b, a) in NOTABLE_SYNERGIES:
            syn = NOTABLE_SYNERGIES[(b, a)]
        else:
            syn = noise(0.7)
        synergies[str(ids[a])][str(ids[b])] = syn
        synergies[str(ids[b])][str(ids[a])] = syn

bundle = {
    "snapshotId": 1,
    "createdAt": "2026-07-19T03:00:00Z",
    "patch": {"id": "7.41d", "isMajor": False, "detectedAt": "2026-07-14"},
    "stabilizing": False,
    "heroes": heroes_json,
    "matchups": matchups,
    "synergies": synergies,
}

# Tab indent so the committed fixture matches Biome's formatter.
print(json.dumps(bundle, indent="\t"))
