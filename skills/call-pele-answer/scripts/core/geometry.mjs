// geometry.mjs — static checks on a rendered diagram (rules borrowed from diagram-design §6), no browser.
// Reads the boxes the renderer wrote: node groups (translate + rect/polygon/circle), edge-label plates.
//   overlap      two node boxes intersect
//   label-node   an edge-label plate sits on a node it is not drawn for (the node covers it)
// Text fit is not checked here: the renderer measures each label and sizes its box (a static estimate
// flagged 4 good boxes on 52 real drafts), so a mismatch only shows in a browser with other fonts.
const num = s => parseFloat(s);
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function box(inner, tx, ty) {
  let m = inner.match(/<rect[^>]*\bx="(-?[\d.]+)"[^>]*\by="(-?[\d.]+)"[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/);
  if (m) return { x: tx + num(m[1]), y: ty + num(m[2]), w: num(m[3]), h: num(m[4]) };
  m = inner.match(/<polygon[^>]*points="([^"]+)"/);
  if (m) { const p = m[1].trim().split(/\s+/).map(q => q.split(',').map(num)); const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return { x: tx + Math.min(...xs), y: ty + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), diamond: true }; }
  m = inner.match(/<circle[^>]*\br="([\d.]+)"/);
  if (m) { const r = num(m[1]); return { x: tx - r, y: ty - r, w: 2 * r, h: 2 * r }; }
  return null;
}
const hit = (a, b, pad = 0) => a.x + pad < b.x + b.w && b.x + pad < a.x + a.w && a.y + pad < b.y + b.h && b.y + pad < a.y + a.h;

export function geometry(svg) {
  const found = [], nodes = [];
  const nodeRx = /<g class="pele-node[^"]*" data-id="([^"]*)" transform="translate\((-?[\d.]+),\s*(-?[\d.]+)\)">([\s\S]*?)<\/g>/g;
  for (const m of svg.matchAll(nodeRx)) {
    const b = box(m[4], num(m[2]), num(m[3])); if (!b) continue;
    const lines = [...m[4].matchAll(/<(?:text|tspan)[^>]*>([^<]+)</g)].map(x => decode(x[1]).trim()).filter(Boolean);
    nodes.push({ id: m[1], ...b, label: lines.join(' ') });
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++)
    if (hit(nodes[i], nodes[j], 2)) found.push(['overlap', `「${nodes[i].label || nodes[i].id}」和「${nodes[j].label || nodes[j].id}」两个方框重叠`]);
  for (const m of svg.matchAll(/<g class="pele-edge-label" data-id="([^"]*)">\s*<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*\/?>(?:<\/rect>)?\s*<text[^>]*>([^<]*)</g)) {
    const plate = { x: num(m[2]), y: num(m[3]), w: num(m[4]), h: num(m[5]) };
    const ends = (m[1].match(/^L_(.+)_(.+)_\d+$/) || []).slice(1);
    for (const n of nodes) if (!ends.includes(n.id) && hit(plate, n, 1)) found.push(['label-node', `连线标签「${decode(m[6])}」压在「${n.label || n.id}」上`]);
  }
  return found;
}
