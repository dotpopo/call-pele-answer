"""Re-score saved rollouts with the current grader: python regrade.py <out_root> [skill.md]"""
import json, sys
from pathlib import Path
sys.path.insert(0, "/workspace/work/ref/SkillOpt")
from skillopt.model import set_backend, configure_openai_compatible
set_backend("openai_compatible")
from skillopt.envs.callpele.grader import grade
root = Path(sys.argv[1]); skill = Path(sys.argv[2]).read_text() if len(sys.argv) > 2 else ""
cases = {json.loads(l)["id"]: json.loads(l) for l in open(Path(__file__).parent / "data/cases.jsonl")}
rs = json.loads((root / "rollouts.json").read_text())
H = S = 0
for r in rs:
    g = grade(cases[r["id"]], r["predicted_answer"], skill)
    H += g["hard"]; S += g["soft"]
    print(r["id"], g["hard"], g["soft"], "|", g["fail_reason"][:260])
print(f"hard={H/len(rs):.3f} soft={S/len(rs):.3f}")
