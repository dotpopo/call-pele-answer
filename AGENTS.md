# Working on call-pele-answer

One skill, one source: `skills/call-pele-answer/`. Everything else (plugin manifests, installed copies, `pe --help`) is generated from it.

## Sources of truth
| What | Source | Generated / checked by |
|---|---|---|
| version, summary | `skills/call-pele-answer/SKILL.md` front matter | `node scripts/sync.mjs` → `.claude-plugin/*.json` |
| commands and flags | `skills/call-pele-answer/scripts/core/commands.mjs` | `pe --help`; docs checked by `test/skill.mjs` |
| context budget | `test/budget.json` | `node scripts/budget.mjs [--update]` |
| per-agent install | `scripts/install.mjs` | Codex and `.agents` get front matter trimmed to `name` + `description` |

## When a test fails
1. Run the focused group first: `node test/skill.mjs` (static, milliseconds). Each failure line names the source to fix and the command to run.
2. Assume this change caused it. Say "it was already broken" only after reproducing it on the previous tag.
3. Fix the source named in the message, never the generated copy:
   - sync drift → `node scripts/sync.mjs`; never hand-edit `plugin.json` or `marketplace.json`.
   - unknown `pe` command or flag in docs → a typo is fixed in the doc; a new command or flag goes into `commands.mjs` first, then gets implemented.
   - budget over ceiling → accidental growth: cut it. Real feature: `node scripts/budget.mjs --update` in the same commit, with the reason in the message. Never raise a ceiling quietly.
   - structure contract → if a part the flow depends on was removed (the `pe options → pe assemble → pe answer` order, the `pe:use` marker, the safety section, a referenced file), restore it. If only wording changed, keep the test checking keywords and order; never pin whole sentences.
4. Never delete or weaken a test to get green.
5. Then run everything: `node test/run.mjs`, plus the 34-draft regression before a release.
6. Commit with `git add <files>`, not `git add .`; keep source edits, regenerated manifests and budget updates in separate commits when they are separate decisions.
