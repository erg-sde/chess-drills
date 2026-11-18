"""Engine-check every line in lines.py: your side's moves within 0.5 pawns of Stockfish's best,
the opponent's moves not blunders (unless the line is about punishing one).

Usage: python tools/library/check.py [deck-id ...]   (needs `pip install chess` and a stockfish binary on PATH)
"""
import shutil, sys
from pathlib import Path
import chess, chess.engine
sys.path.insert(0, str(Path(__file__).parent))
from lines import D

eng = chess.engine.SimpleEngine.popen_uci(shutil.which("stockfish") or "/usr/games/stockfish")
lim = chess.engine.Limit(depth=16)
cp = lambda b: eng.analyse(b, lim)["score"].white().score(mate_score=10000)
try:
    for did, (name, colour, blurb, lines) in D.items():
        if sys.argv[1:] and did not in sys.argv[1:]:
            continue
        me = chess.WHITE if colour == "white" else chess.BLACK
        for lname, mv, br in lines:
            b, probs = chess.Board(), []
            assert (br % 2 == 0) == (colour == "black"), f"{lname}: branch must be an opponent move"
            for i, s in enumerate(mv.split()):
                m = b.parse_san(s)
                info = eng.analyse(b, lim); best = info["score"].white().score(mate_score=10000)
                b2 = b.copy(); b2.push(m); after = cp(b2)
                loss = (best - after) if b.turn == chess.WHITE else (after - best)
                if b.turn == me and loss > 50: probs.append(f"MINE {s} -{loss}")
                if b.turn != me and loss > 150: probs.append(f"OPP {s} -{loss}")
                b.push(m)
            print(f"{did:16s} {lname[:44]:44s} end {cp(b) / 100:+.2f}  {'OK' if not probs else ' | '.join(probs)}")
finally:
    eng.quit()
