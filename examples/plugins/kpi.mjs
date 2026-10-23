// Example plugin: a "kpi" form, a deriver that produces it from routed chart blocks, and a lint rule.
// Load it by listing it in .call-pele-answer.json → "plugins": ["./plugins/kpi.mjs"].
export default {
  name: 'kpi', apiVersion: 1,
  setup(api) {
    api.form({
      name: 'kpi',
      fences: ['kpi'],                  // ```kpi  then lines "label | value | note"
      routes: ['chart'],
      parse(node) { node.data = node.body.filter(l => l.trim()).map(l => l.split('|').map(s => s.trim())); },
      render: {
        html: (n, r) => `<div class="pe-kpi">${n.data.map(([k, v, d = '']) => `<div><span>${r.esc(k)}</span><b>${r.esc(v)}</b>${d ? `<i>${r.esc(d)}</i>` : ''}</div>`).join('')}</div>`,
        markdown: n => n.data.map(([k, v, d = '']) => `- **${k}**：${v}${d ? `（${d}）` : ''}`).join('\n'),
      },
      lint(node, report) { if (node.data.length > 4) report(node.line, 'kpi/too-many', `${node.data.length} 个指标`, '一行最多 4 个，其余放表格'); },
      assets: { css: `.pe-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:.75rem;margin:1rem 0}.pe-kpi div{border:1px solid var(--pe-border);border-radius:var(--pe-radius);padding:.6rem .8rem}.pe-kpi span{display:block;font-size:.8125rem;color:var(--pe-muted)}.pe-kpi b{font:650 1.5rem/1.3 var(--pe-font)}.pe-kpi i{display:block;font:normal 12px var(--pe-mono);color:var(--pe-muted)}` },
    });
    // a deriver: chart blocks with ≤ 4 numbers can also be shown as KPI cards (offered as a view)
    api.deriver('chart', b => {
      const kv = [...b.text.matchAll(/([\u4e00-\u9fa5A-Za-z]{1,8})\s*[：:]?\s*(\d+(?:\.\d+)?\s*(?:%|万|亿|元)?)/g)].map(m => [m[1], m[2]]);
      return kv.length >= 2 && kv.length <= 4 ? { label: '指标卡', md: ['```kpi', ...kv.map(([k, v]) => `${k} | ${v}`), '```'].join('\n') } : null;
    });
  },
};
