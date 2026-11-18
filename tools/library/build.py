"""Write data/repertoire.json from lines.py + notes.py (run check.py first).
Decks already in repertoire.json but not in lines.py (e.g. rep-ruy) are kept as they are."""
import json, sys
from pathlib import Path
import chess
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from lines import D
from notes import N
OUT = HERE.parents[1] / "data/repertoire.json"
label = lambda i, s: f"{i // 2 + 1}{'.' if i % 2 == 0 else '...'}{s}"
old = {d["id"]: d for d in json.loads(OUT.read_text())["decks"]}
order = list(old) + [k for k in D if k not in old]
new = {}
for did, (name, colour, blurb, lines) in D.items():
    out = []
    for lname, mv, br in lines:
        ms, b = mv.split(), chess.Board()
        for s in ms: b.push_san(s)
        labels = {label(i, s): i for i, s in enumerate(ms)}
        bad = [k for k in N.get(lname, {}) if k not in labels]
        assert not bad, f"{lname}: unknown labels {bad}; line is {' '.join(labels)}"
        out.append({"name": lname, "moves": mv, "branch": br, "notes": {str(labels[k]): t for k, t in N.get(lname, {}).items()}})
    new[did] = {"id": did, "name": name, "color": colour, "blurb": blurb, "lines": out}
decks = [new.get(i) or old[i] for i in order]
OUT.write_text(json.dumps({"decks": decks}, indent=1, ensure_ascii=False))
print({d["id"]: len(d["lines"]) for d in decks})
