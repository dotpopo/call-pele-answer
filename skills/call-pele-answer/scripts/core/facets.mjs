// Judgments from JEV (atomic nouls), decisions in code (rules + priority).
const N = s => ({ type: 'noul', instructions: s });
// 原子判断：每题只问一件可观察的事
export const FACETS = {
  steps: N('Does the text give actions done in a fixed order?'),
  decision: N('Does the text say that different things happen under different conditions?'),
  roles_handoff: N('Does the text say which named person, team or role does each step?'),
  agent_tools: N('Does the text describe an AI agent that calls named tools?'),
  messages: N('Does the text describe two or more named parties sending messages or requests to each other?'),
  states: N('Does the text name states that one object is in at different times?'),
  feelings: N('Does the text say how a person feels at each stage?'),
  status_columns: N('Does the text group work items by status such as to do, doing and done?'),
  infra: N('Does the text name infrastructure such as servers, databases or queues?'),
  db_tables: N('Does the text name database tables or entities with their fields?'),
  classes: N('Does the text name programming classes or types with fields or methods?'),
  modules_grid: N('Does the text lay out modules in rows or layers?'),
  users: N('Does the text name kinds of people who use the system?'),
  external_systems: N('Does the text name outside systems that the described system calls?'),
  role_actions: N('Does the text list which actions each role is allowed to do?'),
  requirements: N('Does the text list numbered or named requirements?'),
  events_commands: N('Does the text name events that happened in a system as a result of named commands?'),
  bit_layout: N('Does the text give the bit or byte layout of a format?'),
  subtopics: N('Does the text split one named topic into named parts, each with its own sub-points?'),
  file_tree: N('Does the text show a directory or file tree?'),
  nested_parts: N('Does the text break some of its parts into smaller sub-parts?'),
  part_sizes: N('Does the text give a size or amount for each part of a whole?'),
  causes: N('Does the text list several causes of one named problem?'),
  dated_events: N('Does the text give events with dates or years?'),
  task_durations: N('Does the text give a duration such as days or weeks for each of several tasks?'),
  git: N('Does the text describe git branches or merges?'),
  percentages: N('Does the text give percentages of one whole?'),
  same_unit_numbers: N('Does the text give numbers for three or more items in the same unit?'),
  over_time: N('Does the text give values of one measure at several points in time?'),
  flows_amounts: N('Does the text give amounts moving from sources to destinations?'),
  scores_criteria: N('Does the text give each item a number score on each of several criteria?'),
  two_axes: N('Does the text rate each item as high or low on the same two named dimensions?'),
  sets_overlap: N('Does the text say which members belong to both of two named groups?'),
  evolution: N('Does the text place components by how mature or commoditized they are?'),
  domains: N('Does the text sort problems by how predictable they are?'),
  grammar: N('Does the text give grammar or syntax rules?'),
  items_attrs: N('Does the text compare two or more items on the same two or more attributes?'),
  warning: N('Does the text contain a warning that something bad will happen if the reader does a specific thing?'),
  alternatives: N('Does the text present two or more named alternative approaches?'),
  parameter: N('Does the text explain how a result changes when one parameter grows or shrinks?'),
  code: N('Does the text contain a command or code to run or copy?'),
  // structure a list cannot show (the draw gate for process forms)
  loop_back: N('Does the text say that after some step the work goes back to an earlier step?'),
  paths_merge: N('Does the text describe two different paths that later continue with the same step?'),
  multi_branch: N('Does the text contain two or more separate checks, each deciding what happens next?'),
  any_order: N('Could the listed items be done in any order without changing the result?'),
  uses_previous: N('Does a later step need the result of an earlier step?'),
  back_and_forth: N('Does work pass between the same two roles more than once?'),
  transitions: N('Does the text say what event moves one object from one named state to another named state?'),
  advice: N('Is the text mainly a set of separate recommendations, rules or plan items?'),
  system_parts: N('Does the text name components of a software or hardware system and which connects to which?'),
};
export const YES = 0.7;
// Forms with a narrow vocabulary need a clearer yes: JEV says "yes" readily on long text, and a wrong
// specialised diagram costs the reader more than a missed one.
export const STRICT = +(process.env.PE_STRICT || 0.85);
const NARROW = new Set(['usecase','requirements','events_commands','bit_layout','causes','dated_events','task_durations','git','flows_amounts','scores_criteria','two_axes','sets_overlap','evolution','domains','grammar','parameter','agent_tools','modules_grid','external_systems','users','warning','role_actions']);
const Y = (s, k) => s[k] >= (NARROW.has(k) ? STRICT : YES);
// 每个组件 = 原子判断的布尔组合（代码里，可审、可测）
export const RULES = {
  // parts that feed each other also make a flow, but only when the text draws the links (two or more arrows)
  flowchart: s => (Y(s,'steps') && Y(s,'decision')) || (Y(s,'system_parts') && !Y(s,'infra') && s.__arrows >= 2),
  swimlane: s => Y(s,'steps') && Y(s,'roles_handoff'),
  agentflow: s => Y(s,'agent_tools'),
  sequenceDiagram: s => Y(s,'messages'),
  stateDiagram: s => Y(s,'states') && Y(s,'decision'),
  journey: s => Y(s,'feelings'),
  kanban: s => Y(s,'status_columns'),
  architecture: s => Y(s,'infra') && Y(s,'system_parts'),
  erDiagram: s => Y(s,'db_tables'),
  classDiagram: s => Y(s,'classes'),
  block: s => Y(s,'modules_grid'),
  c4: s => Y(s,'users') && Y(s,'external_systems'),
  usecase: s => Y(s,'role_actions'),
  requirement: s => Y(s,'requirements'),
  eventmodeling: s => Y(s,'events_commands'),
  packet: s => Y(s,'bit_layout'),
  mindmap: s => Y(s,'subtopics') && !Y(s,'steps'),
  treeView: s => Y(s,'file_tree'),
  treemap: s => Y(s,'nested_parts') && Y(s,'part_sizes') && !Y(s,'percentages'),
  ishikawa: s => Y(s,'causes'),
  timeline: s => Y(s,'dated_events'),
  gantt: s => Y(s,'task_durations'),
  gitGraph: s => Y(s,'git'),
  pie: s => Y(s,'percentages') && !Y(s,'parameter') && !Y(s,'over_time'),
  bar: s => Y(s,'same_unit_numbers') && !Y(s,'over_time') && !Y(s,'items_attrs'),
  line: s => Y(s,'over_time'),
  sankey: s => Y(s,'flows_amounts'),
  radar: s => Y(s,'scores_criteria'),
  quadrant: s => Y(s,'two_axes'),
  venn: s => Y(s,'sets_overlap'),
  wardley: s => Y(s,'evolution'),
  cynefin: s => Y(s,'domains'),
  railroad: s => Y(s,'grammar'),
  table: s => s.items_attrs >= 0.9 && s.__grid, // only content already shaped as a grid; JEV alone says yes to any multi-point list
  callout: s => Y(s,'warning'),
  steps: s => Y(s,'steps') && !Y(s,'decision'),
  tabs: s => Y(s,'alternatives'),
  slider: s => Y(s,'parameter'),
  code: s => Y(s,'code'),
};

// Specific forms outrank generic ones; first match is the primary.
export const PRIORITY = ['packet','gitGraph','treeView','erDiagram','classDiagram','railroad','wardley','cynefin','eventmodeling','requirement','c4','usecase','journey','kanban','agentflow','ishikawa','gantt','timeline','sankey','treemap','pie','radar','quadrant','venn','line','bar','swimlane','sequenceDiagram','stateDiagram','architecture','block','slider','table','tabs','flowchart','mindmap','code','steps','callout'];
// Lexical facts code can check exactly; JEV is not asked to count or parse.
// Parents that carry two or more sub-items: an indented list under a list item, or a list under a heading or a
// "label：" line. A hierarchy is what a mindmap or tree shows that a flat list cannot.
export function branchingParents(t) {
  const lines = t.split('\n'); let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], ind = l.match(/^\s*/)[0].length;
    const item = /^\s*([-*]|\d+[.)])\s/.test(l);
    if (!(/^\s*#{2,6}\s/.test(l) || /[:：]\s*$/.test(l) || item)) continue;
    let kids = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const m = lines[j], mi = m.match(/^\s*/)[0].length;
      if (/^\s*#{2,6}\s/.test(m)) break;
      if (/^\s*([-*]|\d+[.)])\s/.test(m) && (mi > ind || !item)) kids++;
      else if (m.trim()) break;
    }
    if (kids >= 2) n++;
  }
  // inline: "所有权（借用、生命周期）、类型系统（trait、泛型）" — a part followed by its sub-parts in brackets
  n += (t.match(/[^，。；、\s（(]{1,20}[（(](?!如|例如|比如|e\.g)[^）)]*[、,，][^）)]*[）)]/g) || []).length;
  return n;
}
// The text is already a list of three or more items that make up most of it.
export const listShaped = t => { const ls = t.split('\n').filter(l => l.trim()); const it = ls.filter(l => /^\s*([-*]|\d+[.)])\s/.test(l)).length; return it >= 2 && it >= ls.length * 0.6; };
// An item points at another item: a jump or a loop that a list cannot draw.
export const crossRef = t => /(回到|返回|退回|跳到|跳回|重复)(第\s*\d+\s*步|步骤|上一步|前一步|开头|起点|[A-Z①-⑨]\b)?|再走一遍|go back to|return to step|repeat from/i.test(t);
// the most numbers that share one unit ("72 美元 … 68 美元 … 65 美元" → 3)
// Counting words (块、个、项…) count things, they are not a measure to compare on a bar.
const COUNTERS = new Set('块个项页次题条处份张名人轮步种类位件段行列组批篇章节号年根台'.split(''));
// thresholds (≥90 cm) and range ends (18.5–23.9) are limits, not magnitudes to compare
const sameUnit = t => { const c = {}; for (const m of t.matchAll(/(?<![≥≤<>＜＞~–\-\d.])\d+(?:\.\d+)?\s*(%|[a-zA-Z]+|[\u4e00-\u9fa5])/g)) if (!COUNTERS.has(m[1]) && !/^\s*[–~-]/.test(t.slice(m.index + m[0].length - m[1].length - 1, m.index + m[0].length))) c[m[1]] = (c[m[1]] || 0) + 1; return Math.max(0, ...Object.values(c)); };
const nums = t => (t.match(/\d+(?:\.\d+)?/g) || []).length;
export const HARD = {
  // a timeline needs three or more distinct dates, each carrying its own event
  // ...and each date opens its own clause or item, so the dates order the events rather than decorate them
  timeline: t => new Set([...t.matchAll(/(?:^|[\n；;。，,])\s*(?:[-*]|\d+[.)])?\s*\**\s*((?:1[5-9]|20)\d{2})(?=\s*年|-\d{2}|\s*[–-]|\s*[)）:：])/g)].map(m => m[1])).size >= 3,
  gantt: t => /\d+\s*(天|周|个?月|小时|days?|weeks?)/.test(t),
  // a pie shows shares of one whole: three or more single percentages (not ranges) adding up to about 100
  pie: t => { const v = [...t.matchAll(/(?<![\d.–~-])(\d+(?:\.\d+)?)\s*%(?!\s*[–~-])/g)].map(m => +m[1]); const sum = v.reduce((a, b) => a + b, 0); return v.length >= 3 && sum >= 90 && sum <= 110; },
  radar: t => nums(t) >= 6,
  sankey: t => nums(t) >= 3, bar: t => sameUnit(t) >= 3,
  // a line needs at least three points on a time axis written out in the text
  line: t => (t.match(/(1[5-9]|20)\d{2}\s*年?|\d{1,2}\s*月|第\s*\d+\s*(天|周|月|轮|季度?)|Q[1-4]\b|\b\d{1,2}:\d{2}\b|周[一二三四五六日]|(day|week|month)\s*\d+/gi) || []).length >= 3, quadrant: t => true,
  packet: t => /\d+\s*(位|字节|bits?|bytes?)/i.test(t),
  // a parameter sweep says how far it moves: "越 X 越 Y" or "从 A 调到 B" with the numbers
  // a slider shows one parameter's effect; a list of several actions is not one parameter
  slider: t => !listShaped(t) && /(越.{1,8}越|从\s*\S+\s*(调|升|降|涨|增|减)到|the (larger|higher|more|smaller|lower)|as .{1,20} (increases|grows|shrinks))/i.test(t) && nums(t) >= 2,
  // alternatives are named as such: 方案 A / 可以选 X，也可以选 Y / option
  tabs: t => /(方案|选项|做法|路线|可以选|也可以|还是|或者|二选一|option|alternative|approach|either)/i.test(t),
  // a list whose branches stay inside its own items is still a list: draw a flow only when items jump or loop
  flowchart: t => !listShaped(t) || crossRef(t),
  swimlane: t => !listShaped(t) || crossRef(t),
  stateDiagram: t => !listShaped(t) || crossRef(t),
  // steps need three or more actions written in order: a list, or ordering words in prose
  steps: t => (t.match(/^\s*([-*]|\d+[.)])\s/gm) || []).length >= 3 || (t.match(/(先|再|然后|接着|随后|最后|第[一二三四五六]步|first|then|next|finally)/gi) || []).length >= 2 || /分\s*[\d一二三四五六七八九十]+\s*步/.test(t),
  // a mindmap shows a hierarchy: two or more parts that each have their own sub-points
  mindmap: t => branchingParents(t) >= 2,
  treemap: t => branchingParents(t) >= 1 && sameUnit(t) >= 3,
  // a journey needs three or more stages, each with how the person feels
  journey: t => new Set(t.match(/(兴奋|烦躁|焦虑|开心|高兴|不错|烦|放松|失望|满意|沮丧|紧张|期待|愉快|生气|困惑|舒服|难受|惊喜|担心|安心|无聊|frustrat\w*|happy|anxious|relieved|annoyed|delighted)/gi) || []).size >= 3,
  // a callout is a caution the text itself flags (⚠️, 注意：, 切勿…); a list of caveats is a list
  callout: t => /(⚠️|❗|(^|\n)\s*>?\s*\**\s*(注意|重要|警告|风险提示|小心|warning|caution|important)\**\s*[:：]|绝对不要|切勿|务必)/i.test(t),
  kanban: t => new Set(t.match(/(待办|进行中|已完成|阻塞|待验收|todo|doing|done|in progress|backlog)/gi) || []).size >= 2,
  // forms bound to a domain vocabulary: the text must use that vocabulary
  // a requirement diagram needs numbered requirements or binding wording, not just the word 需求
  requirement: t => /(REQ-\d|\bR\d+\b|requirement|shall\b)/i.test(t) || (/(需求|验收)/.test(t) && (t.match(/(必须|应当|不得|须)/g) || []).length >= 2),
  railroad: t => /(语法|文法|BNF|正则|产生式|开头|后面跟|分隔|可以是|syntax|grammar|token)/i.test(t),
  // use cases: the vocabulary, or two or more clauses that each open with a role and what it can do
  usecase: t => /(用例|权限|use case|actor|permission)/i.test(t) || (t.match(/(?:^|[；;，,。：:])\s*[^，。；;：:\s]{1,10}?(只能|可以|能|还能|\bcan\b)/g) || []).length >= 2,
  c4: t => /(外部|第三方|C4|系统上下文|external|third-party)/i.test(t),
  // a fishbone groups causes under named categories
  ishikawa: t => /(原因|导致|为什么|根因|cause|because)/i.test(t) && (branchingParents(t) >= 2 || t.split(/[；;]/).filter(x => x.trim()).length >= 3),
  eventmodeling: t => /(事件|命令|event|command)/i.test(t),
  wardley: t => /(演进|成熟度|商品化|定制|Wardley|commodit|evolution)/i.test(t),
  cynefin: t => /(Cynefin|混沌|繁杂|复杂域|清晰域|可预测|chaotic|complicated)/i.test(t),
  erDiagram: t => /(表|字段|主键|外键|实体|table|column|entity|primary key)/i.test(t),
  classDiagram: t => /(类|方法|属性|接口|继承|class|method|interface|inherit)/i.test(t),
  gitGraph: t => /(git|分支|合并|branch|merge|commit)/i.test(t),
};
// A generic form drawing the same content as a more specific primary is redundant.
const GENERIC = { flowchart: 'process', steps: 'process', table: 'compare', tabs: 'compare', bar: 'numbers', mindmap: 'parts' };
const COVERS = {
  process: ['swimlane','sequenceDiagram','stateDiagram','agentflow','gantt','gitGraph','timeline','journey','eventmodeling','requirement','erDiagram','classDiagram','block','c4','usecase','architecture','wardley','packet','code'],
  compare: ['radar','quadrant','sankey','venn','cynefin','slider','bar','pie'],
  numbers: ['pie','treemap','radar','sankey','line','gantt','packet'],
  parts: ['treemap','ishikawa','treeView','table','tabs'],
};
// Three or more list items that each carry two or more values under the same attribute labels
// ("- A：价格 3，耗时 5" / "- B：价格 4，耗时 2"): the text already has a grid's shape. Sentences in a list
// rarely start their clauses with the same words, so a repeated label is the tell.
export function gridShape(t) {
  const items = (t.match(/^\s*([-*]|\d+[.)])\s+.+$/gm) || []).map(l => new Set([...l.matchAll(/[：:，,]\s*([^\s，,：:；;]{1,24})\s/g)].map(m => m[1])));
  if (items.length < 2) return false;
  // a table rewritten as a list ("- 行名：列 A 值，列 B 值") repeats the same column words across its rows;
  // grid = 3+ rows sharing 2+ column words, or 2 rows sharing 3+
  const count = new Map(); items.forEach(s => s.forEach(k => count.set(k, (count.get(k) || 0) + 1)));
  const cols = [...count].filter(([, v]) => v >= 2).sort((x, y) => y[1] - x[1]).map(([k]) => k);
  for (let c = Math.min(cols.length, 6); c >= 2; c--) {
    const rows = items.filter(s => cols.slice(0, c).every(k => s.has(k))).length;
    if ((rows >= 3 && c >= 2) || (rows >= 2 && c >= 3)) return true;
  }
  return false;
}

// A comparison written in a sentence: three or more items split by "；", each giving two or more attributes.
export const proseGrid = t => { const segs = t.split(/[；;]/).map(x => x.trim()).filter(Boolean); return segs.length >= 3 && segs.every(x => (x.match(/[、，,]/g) || []).length >= 1); };
export function decide(s, text = '') {
  s = { ...s, __grid: gridShape(text) || proseGrid(text), __arrows: (text.match(/→|->|⟶/g) || []).length };
  let cands = PRIORITY.filter(c => RULES[c](s) && (!HARD[c] || HARD[c](text)));
  if (gridShape(text)) cands = ['table', ...cands.filter(c => c !== 'table')];
  const primary = cands[0] || 'prose';
  cands = cands.filter(c => c === primary || !GENERIC[c] || !COVERS[GENERIC[c]].includes(primary));
  return { primary, cands };
}

// Where each component renders: the family and diagram type the scaffold and derivers understand.
const FORM = { table: ['table', null], tabs: ['tabs', null], slider: ['slider', null], steps: ['steps', 'numbered'], callout: ['prose', null], code: ['prose', null] };
export function formOf(name, TYPES, s = {}) {
  if (FORM[name]) return FORM[name];
  if (name === 'flowchart') return [Y(s, 'steps') ? 'steps' : 'structure', 'flowchart'];
  for (const [fam, types] of Object.entries(TYPES)) if (types[name]) return [fam, name];
  return ['prose', null];
}
