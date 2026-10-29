// mermaid — any Mermaid 12.1 diagram, rendered to SVG by the vendored renderer at parse time (twice: wide and narrow,
// so small screens get a re-laid-out diagram instead of a shrunken one). Rendering at parse time means
// syntax errors stop the build with a draft line number, and every output sees the same SVG.
import { render as peleRender, PeleError } from '../vendor/pele.mjs';
import { geometry } from '../core/geometry.mjs';

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
let seq = 0;
const GRAPH = new Set(['flowchart', 'flowchart-elk', 'state', 'class', 'er', 'architecture', 'block', 'c4', 'requirement']);
const KIND = { flowchart: '流程图', 'flowchart-elk': '流程图', sequence: '时序图', state: '状态图', class: '类图', er: '实体关系图', gantt: '甘特图', pie: '饼图', xychart: '数据图', mindmap: '思维导图', timeline: '时间线', kanban: '看板', quadrant: '四象限图', sankey: '桑基图', treemap: '矩形树图', radar: '雷达图', journey: '用户旅程图', gitGraph: 'Git 分支图' };
const xesc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// accessible figure (diagram-design §12): role=img, labelled by a <title> (the block title) and a <desc> (what kind of diagram, how big)
function accessible(svg, id, title, d) {
  if (!svg) return svg;
  const kind = KIND[d.type] || d.type || '图';
  const desc = d.nodes ? `${kind}，${d.nodes} 个节点${d.edges ? `、${d.edges} 条连线` : ''}` : kind;
  return svg.replace(/^<svg\b([^>]*)>/, (_, a) => `<svg role="img" aria-labelledby="${id}-t ${id}-d"${a.replace(/\srole="[^"]*"/, '')}><title id="${id}-t">${xesc(title || kind)}</title><desc id="${id}-d">${xesc(desc)}</desc>`);
}

export default {
  name: 'mermaid',
  fences: ['mermaid'],
  routes: ['steps', 'sequence', 'state', 'structure', 'hierarchy', 'timeline', 'chart', 'landscape', 'grammar'],
  parse(node, ctx) {
    const src = node.body.join('\n');
    const id = `pe${++seq}`;
    node.data = { id, src, kind: src.trim().split(/\s/)[0], edges: (src.match(/-->|---|-\.->|==>|->>|-->>|--\)|-x/g) || []).length };
    // `%% 图例: bad=违反规则; fixed=已修复` (or `%% legend:`) → a legend row of theme-coloured chips above the diagram
    const lg = src.match(/^\s*%%\s*(?:图例|legend)\s*[:：]\s*(.+)$/im);
    if (lg) node.data.legend = lg[1].split(/[;；,，]\s*/).map(x => x.split(/\s*=\s*/)).filter(x => x[0] && x[1]).map(([k, v]) => ({ k: k.trim(), v: v.trim() }));
    if (/\b(style|classDef)\b[^\n]*#[0-9a-f]{3,6}/i.test(src)) ctx.warn(node.line, 'route/fixed-color', '图里写了固定颜色', '删掉 style/classDef 里的 #色值：固定色不随主题切换。改用语义类 `class A,B bad`（bad/ok/fixed/warn/new/muted 或 blue/green/red… 色名），配 `%% 图例: bad=违反规则`');
    try {
      const opt = { fontFamily: FONT, fontFamilyMono: MONO, fontSize: 15, responsive: true };
      const wide = peleRender(src, { ...opt, maxWidth: 880, idPrefix: id + 'w' });
      let narrow = null;
      if (wide.width > 400) { try { const n = peleRender(src, { ...opt, maxWidth: 360, idPrefix: id + 'n' }); if (n.svg !== wide.svg) narrow = n.svg; } catch {} }
      Object.assign(node.data, { type: wide.type, width: wide.width, height: wide.height, svg: wide.svg, narrowSvg: narrow });
      const nodes = (wide.svg.match(/class="pele-node\b/g) || []).length, edges = (wide.svg.match(/class="pele-edge"/g) || []).length;
      Object.assign(node.data, { nodes, edges });
      // complexity budget (diagram-design §7): a graph past 9 nodes or 12 links needs a guide to read; split it
      for (const [rule, msg] of GRAPH.has(wide.type) ? geometry(wide.svg) : []) ctx.warn(node.line, `route/geometry-${rule}`, msg, '减少节点或连线标签，或改变方向（LR ↔ TD）重新排版');
      if (GRAPH.has(wide.type) && (nodes > 9 || edges > 12)) ctx.warn(node.line, 'route/too-complex', `图有 ${nodes} 个节点、${edges} 条连线（上限 9 个节点、12 条连线）`, '拆成一张总览加一张细节图，或合并总是一起出现的节点、删掉布局已经说明的连线');
    } catch (e) {
      if (!(e instanceof PeleError || e?.code)) throw e;
      ctx.err(e.line ? node.line + e.line : node.line, `mermaid/${e.code || 'error'}`,
        String(e.message).split('\n')[0] + (e.snippet ? `\n    ${e.snippet.replace(/\n/g, '\n    ')}` : ''),
        '图表引擎按 Mermaid 12.1 语法解析：修这一行；文字含括号/冒号时加引号，如 A["f(x): 值"]；xychart 的中文类目要加引号');
    }
  },
  render: {
    html: (n, r) => n.data?.svg ? `<figure class="pe-fig" data-type="${r.esc(n.data.type)}">${n.data.legend ? `<div class="pe-legend">${n.data.legend.map(x => `<span class="pe-chip ${r.esc(x.k.replace(/[^\w-]/g, ''))}">${r.esc(x.v)}</span>`).join('')}</div>` : ''}<div class="pe-svg pe-wide">${accessible(n.data.svg, n.data.id + 'w-a11y', r.panelTitle, n.data)}</div>${n.data.narrowSvg ? `<div class="pe-svg pe-narrow">${accessible(n.data.narrowSvg, n.data.id + 'n-a11y', r.panelTitle, n.data)}</div>` : ''}</figure>` : '',
    markdown: n => ['```mermaid', ...n.body, '```'].join('\n'),
  },
  lint(node, report) {
    if (node.data?.edges > 25) report(node.line, 'route/diagram-dense', `图里有 ${node.data.edges} 条边`, '一张图只讲一件事：拆成两张，或用 subgraph 折叠');
  },
};
