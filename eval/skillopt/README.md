# SkillOpt 评测（call-pele-answer）

用 microsoft/SkillOpt 把 SKILL.md 的“写作契约”部分当参数训练。

- `skills/seed.md`：可训练部分（导语、§1 拆块、§2 载体、§3 稿件、§5 回复、§6 安全）。`skills/fixed-ops.md`：不参与训练的运维部分（§4 渲染输出、计时、调色、批注、路由器、参考文件）。
- `data/cases.jsonl`：评测题；`data/split/{train,val,test}`：划分。每题字段：`carrier`（chat/page）、`expect`（每组至少命中一种形式）、`forbid`。
- `callpele/grader.py`：离线跑真实 `pe answer --router local`（不联网、不发第三方），加结构检查和 LLM 评审，产出 hard/soft。技能超过 `CALLPELE_SKILL_BUDGET` 字节会轻微扣分。
- `callpele/`：SkillOpt env（软链到 SkillOpt 的 `skillopt/envs/callpele`，并在 `scripts/train.py`、`scripts/eval_only.py` 注册）。

```bash
source eval/skillopt/env.sh
python scripts/eval_only.py --config <repo>/eval/skillopt/configs/callpele.yaml --skill <repo>/eval/skillopt/skills/seed.md --split val
python scripts/train.py --config <repo>/eval/skillopt/configs/callpele.yaml --cfg-options env.out_root=/path/run
python <repo>/eval/skillopt/regrade.py /path/run/... seed.md   # 改评分器后重算旧结果
```
