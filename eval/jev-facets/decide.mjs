// Judgments from JEV (atomic nouls), decisions in code (rules + priority).
const N = s => ({ type: 'noul', instructions: s });
// 原子判断：每题只问一件可观察的事
export const FACETS = {
  steps: N('Does the text give actions done in a fixed order?'),
  decision: N('Does the text say that different things happen under different conditions?'),
  roles_handoff: N('Does the text say which named person, team or role does each step?'),
  agent_tools: N('Does the text describe an AI agent calling tools?'),
  messages: N('Does the text describe two or more named parties sending messages or requests to each other?'),
  states: N('Does the text name states that one thing moves between?'),
  feelings: N('Does the text say how a person feels at each stage?'),
  status_columns: N('Does the text group work items by status such as to do, doing and done?'),
  infra: N('Does the text name infrastructure such as servers, databases or queues?'),
  db_tables: N('Does the text name database tables or entities with their fields?'),
  classes: N('Does the text name classes or types with their members?'),
  modules_grid: N('Does the text lay out modules in rows or layers?'),
  external_systems: N('Does the text name people or outside systems that use one system?'),
  role_actions: N('Does the text list which actions each role is allowed to do?'),
  requirements: N('Does the text list requirements and what satisfies them?'),
  events_commands: N('Does the text name commands and the events they produce?'),
  bit_layout: N('Does the text give the bit or byte layout of a format?'),
  subtopics: N('Does the text break one topic into named sub-topics?'),
  file_tree: N('Does the text show a directory or file tree?'),
  part_sizes: N('Does the text give a size or amount for each part of a whole?'),
  causes: N('Does the text list causes of one problem?'),
  dated_events: N('Does the text give events with dates or years?'),
  task_durations: N('Does the text give tasks with durations?'),
  git: N('Does the text describe git branches or merges?'),
  percentages: N('Does the text give percentages of one whole?'),
  same_unit_numbers: N('Does the text give numbers for three or more items in the same unit?'),
  over_time: N('Does the text give values of one measure at several points in time?'),
  flows_amounts: N('Does the text give amounts moving from sources to destinations?'),
  scores_criteria: N('Does the text score several items on several criteria?'),
  two_axes: N('Does the text place items on two dimensions that trade off?'),
  sets_overlap: N('Does the text describe what two or three groups have in common?'),
  evolution: N('Does the text place components by how mature or commoditized they are?'),
  domains: N('Does the text sort problems by how predictable they are?'),
  grammar: N('Does the text give grammar or syntax rules?'),
  items_attrs: N('Does the text compare two or more items on the same two or more attributes?'),
  warning: N('Does the text contain a warning or hard limit the reader must not miss?'),
  alternatives: N('Does the text present two or more named alternative approaches?'),
  parameter: N('Does the text explain how a result changes when one parameter grows or shrinks?'),
  code: N('Does the text contain a command or code to run or copy?'),
  system_parts: N('Does the text name parts of a system and how they connect?'),
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
  c4: s => Y(s,'external_systems') && Y(s,'system_parts'),
  usecase: s => Y(s,'role_actions'),
  requirement: s => Y(s,'requirements'),
  eventmodeling: s => Y(s,'events_commands'),
  packet: s => Y(s,'bit_layout'),
  mindmap: s => Y(s,'subtopics') && !Y(s,'steps'),
  treeView: s => Y(s,'file_tree'),
  treemap: s => Y(s,'subtopics') && Y(s,'part_sizes') && !Y(s,'percentages'),
  ishikawa: s => Y(s,'causes'),
  timeline: s => Y(s,'dated_events'),
  gantt: s => Y(s,'task_durations'),
  gitGraph: s => Y(s,'git'),
  pie: s => Y(s,'percentages'),
  bar: s => Y(s,'same_unit_numbers') && !Y(s,'over_time'),
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
export const PRIORITY = ['packet','gitGraph','treeView','erDiagram','classDiagram','railroad','wardley','cynefin','eventmodeling','requirement','c4','usecase','journey','kanban','agentflow','ishikawa','gantt','timeline','sankey','treemap','pie','radar','quadrant','venn','line','bar','swimlane','sequenceDiagram','stateDiagram','architecture','block','slider','table','tabs','flowchart','mindmap','steps','code','callout'];
// Lexical facts code can check exactly; JEV is not asked to count or parse.
const nums = t => (t.match(/\d+(?:\.\d+)?/g) || []).length;
export const HARD = {
  timeline: t => (t.match(/(1[5-9]|20)\d{2}\s*年|\d{4}-\d{2}/g) || []).length >= 2,
  gantt: t => /\d+\s*(天|周|个?月|小时|days?|weeks?)/.test(t),
  pie: t => (t.match(/\d+(?:\.\d+)?\s*%/g) || []).length >= 2,
  radar: t => nums(t) >= 6,
  sankey: t => nums(t) >= 3, treemap: t => nums(t) >= 3, bar: t => nums(t) >= 3, line: t => nums(t) >= 3, quadrant: t => true,
  packet: t => /\d+\s*(位|字节|bits?|bytes?)/i.test(t),
};
export function decide(s, text = '') {
  const cands = PRIORITY.filter(c => RULES[c](s) && (!HARD[c] || HARD[c](text)));
  return { primary: cands[0] || 'prose', cands };
}
