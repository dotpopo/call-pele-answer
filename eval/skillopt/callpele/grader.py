"""Deterministic grader for call-pele-answer rollouts.

Runs the real `pe` CLI offline (--router local, no network, no third party)
and scores carrier choice, render success, form choice and lint warnings.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
PE = REPO / "skills" / "call-pele-answer" / "scripts" / "pe.mjs"

INTERACTIVE = {"slider", "tabs", "views", "steps", "callout"}
SKILL_BUDGET = int(os.environ.get("CALLPELE_SKILL_BUDGET", "4500"))  # bytes, trainable part

FENCE_RE = re.compile(r"^\s*(`{3,}|~{3,})\s*([A-Za-z][\w-]*)?", re.M)


def split_carrier(text: str) -> tuple[str, str]:
    t = (text or "").strip()
    m = re.match(r"^\s*CARRIER\s*[:：]\s*(chat|page)\s*\n?", t, re.I)
    if m:
        return m.group(1).lower(), t[m.end():].strip()
    return "", t


def strip_outer_fence(body: str) -> str:
    """Model sometimes wraps the whole manuscript in ```markdown ... ```."""
    m = re.match(r"^(`{3,})(?:markdown|md)?\s*\n(.*)\n\1\s*$", body.strip(), re.S)
    return m.group(2) if m else body


def extract_forms(body: str) -> list[str]:
    forms: list[str] = []
    lines = body.split("\n")
    for i, line in enumerate(lines):
        m = FENCE_RE.match(line)
        if not m or not m.group(2):
            continue
        lang = m.group(2)
        if lang == "mermaid":
            for nxt in lines[i + 1:i + 6]:
                tok = nxt.strip().split(" ")[0] if nxt.strip() else ""
                if tok and not tok.startswith("%%") and not tok.startswith("---"):
                    forms.append("mermaid")
                    forms.append(tok.rstrip(":"))
                    break
        elif lang in INTERACTIVE:
            forms.append(lang)
        else:
            forms.append("code")
    if re.search(r"^\s*\|.*\|\s*\n\s*\|\s*:?-{2,}", body, re.M):
        forms.append("table")
    if len(re.findall(r"^\s*\d+[.)、]\s+\S", body, re.M)) >= 3:
        forms.append("olist")
    return forms


def guess_carrier(body: str, forms: list[str]) -> str:
    heads = len(re.findall(r"^## ", body, re.M))
    if body.lstrip().startswith("---") or heads >= 2 or any(f in forms for f in INTERACTIVE | {"mermaid"}):
        return "page"
    return "chat"


def run_pe(body: str, timeout: int = 60) -> dict:
    with tempfile.TemporaryDirectory(prefix="pe-eval-") as d:
        md = Path(d, "draft.md")
        md.write_text(body, encoding="utf-8")
        env = dict(os.environ, PE_TRACE="0", PE_CACHE="0", PE_PALETTE="0", PE_ANNOTATE="0",
                   PE_LOG_DIR=str(Path(d, "logs")))
        env.pop("NODE_USE_ENV_PROXY", None)
        try:
            p = subprocess.run(["node", str(PE), "answer", str(md), "-o", str(Path(d, "out.html")),
                                "--router", "local"], capture_output=True, text=True,
                               timeout=timeout, env=env)
            out = (p.stdout or "") + (p.stderr or "")
            rc = p.returncode
        except subprocess.TimeoutExpired:
            out, rc = "timeout", 124
    errors = [l.strip() for l in out.splitlines() if re.match(r"^\s+L\d+ \[", l)]
    warns = [l.strip() for l in out.splitlines() if l.startswith("! ")]
    ste = re.search(r"STE (\d+) warn", out)
    ok = "✓" in out and not out.count("✗")
    return {"ok": ok, "rc": rc, "errors": errors, "warnings": warns,
            "ste": int(ste.group(1)) if ste else 0, "log": out[-2500:]}


def structure(body: str) -> list[str]:
    """Cheap checks for rules the skill states (lead first, 3-8 blocks, no walls of text)."""
    issues: list[str] = []
    text = re.sub(r"^---\n.*?\n---\n", "", body, flags=re.S)
    lead = text.split("\n## ", 1)[0].strip()
    sentences = [x for x in re.split(r"[。！？.!?]\s*", re.sub(r"`{3}.*?`{3}", "", lead, flags=re.S)) if x.strip()]
    if not lead:
        issues.append("缺少结论块（第一个 ## 之前应有一到两句结论）")
    elif len(sentences) > 3 or len(lead) > 220:
        issues.append(f"结论块过长（{len(sentences)} 句 / {len(lead)} 字），应一到两句")
    if re.match(r"^\s*(核心结论|结论|总结)\s*[:：]", lead):
        issues.append("结论块以“核心结论：”之类标签开头，多余")
    blocks = re.findall(r"^## ", text, re.M)
    if blocks and not (2 <= len(blocks) <= 8):
        issues.append(f"块数 {len(blocks)}，应为 3–8")
    prose = re.sub(r"(`{3,}|~{3,}).*?\1", "", text, flags=re.S)
    long_paras = [p for p in prose.split("\n\n") if not p.lstrip().startswith(("|", "#", "-", "*")) and len(p) > 260]
    if long_paras:
        issues.append(f"{len(long_paras)} 段文字超过 260 字，应拆开或换形式")
    for m in re.finditer(r"```mermaid\n(.*?)```", text, re.S):
        edges = len(re.findall(r"--|->|==>", m.group(1)))
        if edges > 22:
            issues.append(f"一张图约 {edges} 条连线，超过约 20，应拆块")
    return issues


JUDGE = """你是严格的技术编辑，给一份“讲解稿件/聊天回复”打分。只看读者体验，不看排版代码。
用户问题：{q}

稿件：
<<<
{a}
>>>

按 1–5 分打四项（5 最好），只输出 JSON：{{"lead":n,"focus":n,"form":n,"concise":n,"worst":"一句话说最大问题"}}
- lead：第一段是否一到两句直接给出答案，读者不点开页面也拿到结论。
- focus：每块是否只回答一个子问题，同一事实没有在正文、表格、图里重复。
- form：每块形式是否恰好消除理解障碍——该画图的画了，不该画的没为凑数画；简单问题没被做成大页面。
- concise：有没有废话、套话、过长段落；能删一半而不丢信息就给 2 分以下。"""


def judge(item: dict, body: str) -> tuple[float, str]:
    if os.environ.get("CALLPELE_JUDGE", "1") == "0":
        return 1.0, ""
    try:
        from skillopt.model import chat_optimizer
        raw, _ = chat_optimizer(system="只输出 JSON。", user=JUDGE.format(q=item["question"], a=body[:9000]),
                                max_completion_tokens=400)
        m = re.search(r"\{.*\}", raw or "", re.S)
        d = json.loads(m.group(0))
        vals = [float(d[k]) for k in ("lead", "focus", "form", "concise")]
        return (sum(vals) / 4 - 1) / 4, f"评审 {d.get('lead')}/{d.get('focus')}/{d.get('form')}/{d.get('concise')}：{d.get('worst','')}"
    except Exception as e:  # judge failure must not crash training
        return 0.5, f"评审失败：{e}"


def grade(item: dict, prediction: str, skill_content: str = "") -> dict:
    declared, body = split_carrier(prediction)
    body = strip_outer_fence(body)
    forms = extract_forms(body)
    carrier = declared or guess_carrier(body, forms)
    want = item.get("carrier", "page")
    notes: list[str] = []
    if not declared:
        notes.append("没有按要求在第一行声明 CARRIER")

    carrier_ok = carrier == want
    if not carrier_ok:
        notes.append(f"载体选错：应为 {want}，实际 {carrier}")

    forbid_hit = sorted({f for f in forms if f in set(item.get("forbid", []))})
    if forbid_hit:
        notes.append("用了不该用的形式：" + ", ".join(forbid_hit))

    groups = item.get("expect", [])
    hit = [any(f in forms for f in g) for g in groups]
    recall = (sum(hit) / len(groups)) if groups else 1.0
    for g, h in zip(groups, hit):
        if not h:
            notes.append("缺少合适的形式，期望其一：" + " / ".join(g))

    pe = {"ok": True, "errors": [], "warnings": [], "ste": 0, "log": ""}
    if carrier == "page":
        pe = run_pe(body)
        if not pe["ok"]:
            notes.append("pe 渲染失败：" + "; ".join(pe["errors"][:4] or [pe["log"][-300:]]))
        if pe["warnings"]:
            notes.append("pe 警告：" + "; ".join(pe["warnings"][:4]))
    n_warn = len(pe["warnings"])
    struct = structure(body) if carrier == "page" else []
    notes += struct
    jscore, jnote = judge(item, body)
    if jnote:
        notes.append(jnote)

    rule = (0.30 * carrier_ok + 0.25 * pe["ok"] + 0.30 * recall
            + 0.15 * (1 - min(n_warn, 3) / 3) - 0.30 * bool(forbid_hit) - 0.05 * (not declared))
    rule -= 0.05 * len(struct)
    soft = 0.6 * rule + 0.4 * jscore
    soft = max(0.0, min(1.0, soft))
    size = len((skill_content or "").encode("utf-8"))
    if size > SKILL_BUDGET:
        factor = 1 - 0.10 * min(1.0, (size - SKILL_BUDGET) / SKILL_BUDGET)
        soft *= factor
        notes.append(f"技能文档 {size} 字节，超出预算 {SKILL_BUDGET}（扣分系数 {factor:.2f}）")
    hard = int(carrier_ok and pe["ok"] and recall == 1.0 and not forbid_hit and n_warn <= 1
               and len(struct) == 0 and jscore >= 0.7)
    return {"hard": hard, "soft": round(soft, 4), "carrier": carrier, "forms": forms,
            "pe_ok": pe["ok"], "pe_errors": pe["errors"], "pe_warnings": pe["warnings"],
            "fail_reason": "；".join(notes), "pe_log": pe["log"], "judge": jscore, "structure": struct}


if __name__ == "__main__":  # quick manual check: python grader.py case_id file.txt
    import sys
    cases = {json.loads(l)["id"]: json.loads(l) for l in open(HERE.parent / "data" / "cases.jsonl", encoding="utf-8")}
    print(json.dumps(grade(cases[sys.argv[1]], Path(sys.argv[2]).read_text(encoding="utf-8")), ensure_ascii=False, indent=2))
