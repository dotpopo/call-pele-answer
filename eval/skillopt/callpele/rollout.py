from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from skillopt.model import chat_target

from .grader import grade

HARNESS = (
    "你是一个装了 call-pele-answer 技能的 Agent，下面是用户的问题。按技能决定载体并作答。\n"
    "输出协议（评测用，不属于技能）：第一行写 `CARRIER: chat` 或 `CARRIER: page`。"
    "chat：其后是要发给用户的回复全文。page：其后是要交给 `pe answer` 的完整 Markdown 稿件，"
    "不要再包一层代码围栏，不要写渲染命令，也不要写给用户的回复。\n\n用户问题：\n"
)


def _rollout_one(item: dict, skill_content: str, prediction_dir: Path, max_tokens: int) -> dict:
    user = HARNESS + item["question"]
    try:
        prediction, _usage = chat_target(system=skill_content, user=user,
                                         max_completion_tokens=max_tokens)
    except Exception as e:  # keep the batch alive; score as failure
        prediction = f"(target error: {e})"
    g = grade(item, prediction or "", skill_content)
    task_dir = prediction_dir / str(item["id"])
    task_dir.mkdir(parents=True, exist_ok=True)
    feedback = (f"[评分] hard={g['hard']} soft={g['soft']} 载体={g['carrier']}（期望 {item.get('carrier')}）"
                f" 形式={g['forms']}\n问题：{g['fail_reason'] or '无'}")
    conversation = [
        {"role": "system", "content": skill_content},
        {"role": "user", "content": user},
        {"role": "assistant", "content": prediction},
        {"role": "user", "content": feedback},
    ]
    (task_dir / "conversation.json").write_text(json.dumps(conversation, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "id": str(item["id"]), "hard": g["hard"], "soft": g["soft"],
        "predicted_answer": prediction, "question": item["question"],
        "task_description": item["question"], "task_type": item.get("task_type", "callpele"),
        "fail_reason": g["fail_reason"], "forms": g["forms"], "carrier": g["carrier"],
        "expected_carrier": item.get("carrier"), "expected_forms": item.get("expect"),
        "pe_errors": g["pe_errors"], "pe_warnings": g["pe_warnings"],
        "target_system_prompt": skill_content, "target_user_prompt": user, "n_turns": 1,
    }


def run_batch(*, items, skill_content, out_root, workers=2, max_completion_tokens=6000):
    os.makedirs(out_root, exist_ok=True)
    pred = Path(out_root, "predictions")
    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        results = list(ex.map(lambda it: _rollout_one(it, skill_content, pred, max_completion_tokens), items))
    Path(out_root, "rollouts.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return results
