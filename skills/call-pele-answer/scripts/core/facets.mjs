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
  system_parts: N('Does the text name components of a software or hardware system and which connects to which?'),
};
export const YES = 0.7;
const Y = (s, k) => s[k] >= YES;
// 每个组件 = 原子判断的布尔组合（代码里，可审、可测）
export const RULES = {
  flowchart: s => (Y(s,'steps') && Y(s,'decision')) || (Y(s,'system_parts') && !Y(s,'infra')),
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
  table: s => Y(s,'items_attrs'),
  callout: s => Y(s,'warning'),
  steps: s => Y(s,'steps') && !Y(s,'decision'),
  tabs: s => Y(s,'alternatives'),
  slider: s => Y(s,'parameter'),
  code: s => Y(s,'code'),
};

// Specific forms outrank generic ones; first match is the primary.
export const PRIORITY = ['packet','gitGraph','treeView','erDiagram','classDiagram','railroad','wardley','cynefin','eventmodeling','requirement','c4','usecase','journey','kanban','agentflow','ishikawa','gantt','timeline','sankey','treemap','pie','radar','quadrant','venn','line','bar','swimlane','sequenceDiagram','stateDiagram','architecture','block','slider','table','tabs','flowchart','mindmap','code','steps','callout'];
// Lexical facts code can check exactly; JEV is not asked to count or parse.
const nums = t => (t.match(/\d+(?:\.\d+)?/g) || []).length;
export const HARD = {
  timeline: t => (t.match(/(1[5-9]|20)\d{2}\s*年|\d{4}-\d{2}/g) || []).length >= 2,
  gantt: t => /\d+\s*(天|周|个?月|小时|days?|weeks?)/.test(t),
  pie: t => (t.match(/\d+(?:\.\d+)?\s*%/g) || []).length >= 2,
  radar: t => nums(t) >= 6,
  sankey: t => nums(t) >= 3, treemap: t => nums(t) >= 3, bar: t => nums(t) >= 3,
  // a line needs at least three points on a time axis written out in the text
  line: t => (t.match(/(1[5-9]|20)\d{2}\s*年?|\d{1,2}\s*月|第\s*\d+\s*(天|周|月|轮|季度?)|Q[1-4]\b|\b\d{1,2}:\d{2}\b|周[一二三四五六日]|(day|week|month)\s*\d+/gi) || []).length >= 3, quadrant: t => true,
  packet: t => /\d+\s*(位|字节|bits?|bytes?)/i.test(t),
  // forms bound to a domain vocabulary: the text must use that vocabulary
  requirement: t => /(需求|验收|REQ-|requirement|shall\b)/i.test(t),
  railroad: t => /(语法|文法|BNF|正则|产生式|开头|后面跟|分隔|可以是|syntax|grammar|token)/i.test(t),
  usecase: t => /(用例|权限|use case|actor|permission)/i.test(t) || (t.match(/(可以|能|只能|can)/g) || []).length >= 2,
  c4: t => /(外部|第三方|C4|系统上下文|external|third-party)/i.test(t),
  ishikawa: t => /(原因|导致|为什么|根因|cause|because)/i.test(t),
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
  const items = (t.match(/^\s*([-*]|\d+[.)])\s+.+$/gm) || []).filter(l => (l.match(/[，,；;]/g) || []).length >= 2);
  if (items.length < 3) return false;
  const seen = new Map();
  for (const l of items) for (const k of new Set(l.split(/[，,；;：:]/).slice(1).map(x => x.trim().slice(0, 2)).filter(Boolean))) seen.set(k, (seen.get(k) || 0) + 1);
  return [...seen.values()].some(v => v >= Math.max(3, items.length - 1));
}
export function decide(s, text = '') {
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
