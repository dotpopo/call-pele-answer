from __future__ import annotations

import json
from pathlib import Path

from skillopt.datasets.base import SplitDataLoader


def _norm(raw: dict) -> dict:
    return {"id": str(raw["id"]), "question": raw["question"], "task_type": raw.get("task_type", "callpele"),
            "carrier": raw.get("carrier", "page"), "expect": raw.get("expect", []), "forbid": raw.get("forbid", [])}


class CallPeleDataLoader(SplitDataLoader):
    def load_split_items(self, split_path: str) -> list[dict]:
        p = Path(split_path)
        files = sorted(p.glob("*.jsonl")) if p.is_dir() else [p]
        return [_norm(json.loads(l)) for f in files for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]

    def load_raw_items(self, data_path: str) -> list[dict]:
        return self.load_split_items(data_path)
