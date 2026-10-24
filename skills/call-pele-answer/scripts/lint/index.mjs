// Built-in lint rules over the IR. A rule is { id, check(doc, report, ctx) }; plugins add domain rules
// (e.g. "every number in a finance page cites a source") the same way.
import { walk } from '../core/markdown.mjs';
import { lintProse, lintRouting, normLang, detectLang } from './rules.mjs';

export function proseUnits(nodes) {
  const units = [];
  walk(nodes, n => {
    if (n.quiet) return;
    if (n.kind === 'p') units.push({ text: n.text, line: n.line, kind: 'desc', para: true });
    else if (n.kind === 'quote') units.push({ text: n.text, line: n.line, kind: 'desc', para: true });
    else if (n.kind === 'list') n.items.forEach(it => units.push({ text: it.text, line: it.line, kind: n.ordered ? 'step' : 'desc' }));
    else if (n.kind === 'table') n.rows.forEach((r, k) => { if (!r.some(c => /^no(\s|$)/.test(c))) r.forEach(c => units.push({ text: c.replace(/^(ok|warn)\s*/, ''), line: n.line + 2 + k, kind: 'desc' })); });
  });
  return units;
}
export const docLang = doc => normLang(doc.meta.lang) || detectLang([...proseUnits(doc.lead), ...doc.panels.flatMap(p => proseUnits(p.nodes))].map(u => u.text).join('\n'));

export default {
  name: 'builtin-rules', apiVersion: 1,
  setup(api) {
    api.rule({
      id: 'ste', describe: 'STE 风格文字：句长、段长、“的”链、轻动词、空话、开场白…（语气词不查）',
      check(doc, report, ctx) {
        const lang = docLang(doc);
        const units = [...proseUnits(doc.lead), ...doc.panels.flatMap(p => proseUnits(p.nodes))];
        for (const f of lintProse(units, { lang, mode: ctx.ste || doc.meta.ste || 'flavored' })) report(...f);
      },
    });
    api.rule({
      id: 'route', describe: '形式选择：缺结论、文字墙、正文写流程/比较、两列表格、数据图无来源…',
      check(doc, report) {
        const legacy = {
          lead: doc.lead.map(n => n.text || '').join('\n'),
          panels: doc.panels.map(p => {
            const fences = []; walk(p.nodes, n => { if (n.kind === 'fence') fences.push({ type: n.form || 'code', line: n.line, edges: n.data?.edges || 0, kind: n.data?.kind, src: n.data?.src || '' }); });
            return { title: p.title, line: p.line, prose: proseUnits(p.nodes), tables: p.nodes.filter(n => n.kind === 'table').map(t => ({ line: t.line, cols: t.head.length, rows: t.rows.length })), blocks: fences };
          }),
        };
        for (const f of lintRouting(legacy)) report(...f);
      },
    });
    api.rule({
      id: 'evidence', describe: '可机械判断的形式与出处问题：装饰交互、图重复表格、具体数字无出处',
      check(doc, report) {
        const textOf = nodes => { let t = ''; walk(nodes, n => { if (n.text) t += n.text + '\n'; if (n.kind === 'table') t += [n.head, ...n.rows].flat().join(' ') + '\n'; }); return t; };
        const hasVisual = nodes => { let v = false; walk(nodes, n => { if (n.kind === 'table' || (n.kind === 'fence' && n.form && !['callout', 'code'].includes(n.form))) v = true; }); return v; };
        for (const p of doc.panels) {
          // 1. interaction whose every step/tab/value only swaps a short paragraph: a list or table says the same
          walk(p.nodes, n => {
            if (n.kind !== 'fence' || !['tabs', 'slider', 'steps'].includes(n.form) || !n.children?.length) return;
            const kids = n.children.map(c => c.nodes || []);
            if (kids.every(k => !hasVisual(k) && textOf(k).trim().length <= 160 && !/\d/.test(textOf(k).replace(/\d+[.、)]/g, ''))))
              report(n.line, 'route/decorative-interaction', `${n.form} 每一档只换一小段文字`, '改成列表或表格；交互只用在图或数字随档位变化时');
          });
          // 2. a diagram that redraws a table in the same block
          const cells = p.nodes.filter(n => n.kind === 'table').flatMap(t => t.rows.flat()).map(c => c.replace(/[*`]/g, '').trim()).filter(c => c.length >= 2);
          if (cells.length) walk(p.nodes, n => {
            if (n.kind !== 'fence' || n.form !== 'mermaid') return;
            const src = (n.body || []).join('\n');
            const labels = [...src.matchAll(/[\[\(\{"]+([^\]\)\}"\n]{2,40})[\]\)\}"]+/g)].map(m => m[1].trim());
            const hit = labels.filter(l => cells.some(c => c.includes(l) || l.includes(c)));
            if (labels.length >= 4 && hit.length / labels.length >= 0.7)
              report(n.line, 'route/duplicate-figure', `图里 ${hit.length}/${labels.length} 个标签已在同块表格里`, '删掉图或表其一；图只画表格表达不了的关系');
          });
          // 3. specific statistics with no source / 示意 / 估算 marker in the same block
          const prose = textOf(p.nodes.filter(n => n.kind !== 'fence'));
          const stats = prose.match(/[>≥<≤约]?\s?\d[\d,.]*\s?(%|％|倍|亿|万(?![一个])|美元|元|小时|GB|TB|ms\b)|[$¥€]\s?\d[\d,.]*\s?[BMK亿万]?/g) || [];
          if (stats.length >= 2 && !/(来源|出处|据|引自|示意|估算|估计|约|大约|左右|未核实|报告|论文|官方|文档|source|estimate|approx|~)/i.test(prose))
            report(p.line, 'route/unsourced-number', `「${p.title}」有 ${stats.length} 个具体数字没写来源（如 ${stats.slice(0, 2).join('、')}）`, '同一块里写出来源，或标“示意/估算”；写不出就改成定性说法');
        }
      },
    });
    api.rule({
      id: 'forms', describe: '各形式自己的检查（form.lint）',
      check(doc, report, ctx) { walk([...doc.lead, ...doc.panels.flatMap(p => p.nodes)], n => { const f = n.form && ctx.registry.form(n.form); if (f?.lint) f.lint(n, report); }); },
    });
  },
};
