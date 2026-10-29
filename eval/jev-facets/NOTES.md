# JEV routing eval — history (moved out of the project skill)

- Round 1 (2026-10-27 13:05, synthetic 82 blocks): held-out 61.0% (old JEV "best form") → 90.2%. Integrated d1e0841, released 0.5.4.
- Round 2 (15:37): real.json = 108 real blocks from answers/*.md (realx.mjs). Iters 9–17: domain vocab HARD, line time points, gridShape, bar same unit, tabs/slider vocab, table needs items_attrs≥0.9. Real h 23.1%→67.3% (old 55.8%). Released 0.5.5.
- Round 3 (16:24, her: patient, quality first, I label): LABELING.md guideline; real.json relabeled (19); runs.json = 164 target-model blocks (pele-skillopt runs, split by question odd=t); strip.mjs drops figure-pointing sentences; gate.mjs = wrongly drawn / left as text; ref/facets055.mjs + bench055/gate055 = baseline. Iters 18–25 (decision.tsv). Held-out real+runs 136: top1 62.5%→75.0%, wrongly drawn 30→23/68 (process 12→7), left-as-text 6→6; synthetic h 90.2→87.8 (sankey lost to 0.85 gate). pe answer 1.5–2.2 s (50 q). Released 0.5.6/0.5.7 GitHub+SkillHub; ClawHub CLI needs reinstall + device code.
- Known gaps: railroad vocab too broad (vault#2), single annotator, remaining errors spread over many narrow forms.
- Run: `SET=blocks|real|runs|real,runs node bench.mjs t|h`, `node gate.mjs t|h`. Held-out only at the end of a round.
- Round 4 (16:42, her: patiently fix scattered errors): fresh.json = 81 sealed target-model blocks labeled before tuning; tuned on real+runs t+h (271, all seen). Iters 26–35. real+runs all .782→.904, wrongly drawn 38→16/132. Fresh (run once): top1 0.5.5 59.3% / 0.5.7 67.9% / now 77.8%; wrongly drawn 16/13/9 of 33; left as text 2/4/7 of 48 (cost). 3 of the 7 fresh misses contradict LABELING.md (1-attr or 2x2 lists labeled table) — not relabeled. Biggest fresh error: callout over-firing (4). Plans vs procedures still unsolved (steps blocked by decision).
- Round 5 (16:53, her: no sealing, fix labels when found; fold fresh in; procedure vs plan; callout): relabeled 3 fresh blocks; callout needs a flagged caution; new JEV one_task lets conditional list procedures be steps (DITA task / Horn procedure) — left-as-text 14→9 with no new wrongly drawn; new JEV side_by_side for tables: precise (0/167 prose ≥.85) but sees only 33/150 flattened tables, so code grid stays. real+runs+fresh 352: .884→.918, wrongly drawn 25→20, left as text 13→9. No untouched set remains.

## Final check (2026-10-27 17:20, final.json, 72 unused target-model blocks, labeled before the run, run once)
top1/recall: 0.5.5 .681/.667, 0.5.7 .736/.722, 0.5.8 .833/.806, 0.5.9 .833/.806.
Prose wrongly drawn (of 33): 17, 15, 11, 11 (process forms 7,6,4,4). Drawables left as text (of 39): 0,0,2,2.
0.5.9 errors (12): steps on a checklist (016#6) and a ranked metric list (077#6) — one_task too loose;
flowchart on a one-line condition (019#6); sequenceDiagram on a prose explanation (025#2); tabs (028#6),
mindmap (035#3 time buckets), code (038#5 fill-in form), block (064#5), table (084#5), line (098#4), treemap (011#1);
missed table 063#4 (定义/怎么用/健康信号).

## Round 6 — minimum evidence per form (2026-10-27 17:50; final folded into tuning, no untouched set left)
Expert framing (Ng error analysis / selective prediction): the 12 "single" errors share one cause — JEV answers
"does the text mention X" (one 30%, one inline `winver`, one SYN), not "is X how the whole block is organized".
A drawing is the riskier error (prose is the safe abstain), so each form now needs its own minimum evidence in code:
flowchart in prose ≥3 ordering/branch words (list: jump/loop + ≥3 units); sequenceDiagram ≥3 messages (arrows/exchange verbs);
code = fence, ≥2 statement lines, or a shell command in prose; tabs = ≥2 named alternatives; line = ≥3 distinct time points;
steps not on a checklist ("- [ ]") or a ranked list ("按优先级"); mindmap not on time buckets.
real .925→.935, runs .921→.933, fresh .901→.951, final .833→.931, synthetic .927 unchanged.
All 424 real blocks: top1 90.3%→93.6%; wrongly drawn 31→18 of 201 prose; left as text 11→11.

## Root cause probe (2026-10-27 17:45, probe7.mjs, live jev-1.13.0)
Facets are bare "Does the text give X?" with no criteria or context, so a mention counts. Adding block context
("one part of a longer answer; draw only when the block is about X") + concrete true/false criteria:
negatives SYN 025#2 .95→.07, 025#4 .90→.10, winver 038#5 .92→.19, 30% 019#6 .69→.02, 1915 098#4 .99→.32,
quadrant-usage 028#6 .93→.36, 097#1 .84→.65, layers 064#5 .94→.27, 036#1 .94→.12; positives stay .87–.99.
Caveat: examples paraphrase the failing cases (TypeSafe yellow flag). Next (asked her): rewrite all facets with
generic criteria, rerun 424, validate on an unseen batch, then drop HARD rules that become redundant.

## Round 7 — JEV-native questions (2026-10-27 18:00, her: 深刻反思如何用好 JEV, no wrongly drawn)
Read TypeSafe docs (jaggedness: literal reading → exact condition + boundary case in criteria; keep direct evidence in code;
autoformat cookbook: ask the narrowest observable fact, "mid-sentence" not "same paragraph"; uncertainty band).
Changes (facets.mjs): every facet now a Noul with criteria.true/false written as generic situations (no test text);
state = {about: STATE_NOTE, block} (shared context once: "a word/number/command it mentions is not how it is organized");
steps "by the reader or anyone" + uses_previous ≥ .8; role_actions = permissions in a system (not responsibilities);
git = one branch history in order (not variants/policy); subtopics = a map of a topic whose part names are the takeaway;
same_unit_numbers = comparison is the point; NARROW += subtopics, part_sizes, over_time; gridShape needs grid rows ≥60%
of the list, or a partial grid + JEV items_attrs ≥ .85; a block that is itself code stays code; callout marker "callout".
Relabels (per LABELING.md): slim-eval-result#3 → prose/steps (≥3 dependent ordered steps); fresh 052#5 + callout (flagged).
Results (wrongly drawn = prose gold drawn as a form not in gold):
- 424 real tuning: top1 .936 → .965, wrongly drawn 18 → 0 / 201, left as text 11 → 25 (cost of strictness).
- synthetic 82: .927 → .915.
- new.json 52 unused, labeled first, run once BEFORE folding: v1 .923 / wrong 3 of 30; v2 .962 / wrong 1 (line on 2 time points);
  after folding (over_time NARROW, callout marker) 1.0 / 0.
- new2.json 30 unused, labeled first, run once, nothing folded: wrong 0 of 9 for v2 (and v1); 3 misses are blocks whose
  answers failed (429 daily quota, resets ~08:00 CST) → rerun new2 once quota returns.
Next: recover recall (25 left as text: flattened tables JEV can't see, plan-steps under time_buckets) without new wrongs.
- Released 0.5.12 2026-10-28 (her OK): merged feature/optimized-routing-and-views + review fixes; GitHub tag v0.5.12.

## Round 8 (2026-10-28, merged 0.5.12 + live key)
- CLASSIFIER_API_KEY live again (no 429). new2 fully judged: 1 wrongly drawn — pele-063#2 (advice on how to design kanban columns: 列 = 阶段, WIP Limit, 泳道) → kanban.
- Fix: HARD kanban rejects column-design advice (列的设计|列 =|每列|WIP Limit|泳道). Gold kanban1/2 unaffected.
- After: wrongly drawn 0 on all sets — new2 9 prose/0, new 30/0, 424 real 201/0, blocks 4/0. top1 new2 .933→.967; 424 .965; missed draws 424: 25 (unchanged).
- Released 0.5.13.

## 0.5.14 (2026-10-28)
One source, many artifacts (from caveman): scripts/sync.mjs (SKILL.md version/summary → .claude-plugin/*.json, --check fails on drift; plugin.json had drifted at 0.4.1), scripts/install.mjs (claude/codex/agents/cursor/opencode, copy or --link, --dry-run), .github/workflows/ci.yml (sync --check, install dry run, tests). Caveman-compress before JEV tested and rejected (see eval/caveman, not committed).

## 0.5.15 (2026-10-28)
From gstack: core/commands.mjs command table (pe --help generated; fixed help truncation), test/skill.mjs static contracts with fix hints, scripts/budget.mjs + test/budget.json ratchet (+5 % headroom), install.mjs trims front matter for codex/agents, AGENTS.md fix discipline, CI step.

## 0.5.16 (2026-10-29)
From diagram-design: admission gates auto-drawing (route can't draw what pe options rejects), SVG a11y (role=img, title=block title, desc=kind+size), route/too-complex (>9 nodes or >12 links on graph diagrams; 4/52 drafts warned), core/geometry.mjs (overlap, label-node; 0/52 false positives; text-fit dropped: renderer sizes boxes, static estimate flagged 4 good boxes), SKILL delete-test line.
