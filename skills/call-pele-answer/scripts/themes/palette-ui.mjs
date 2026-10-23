// palette-ui — the 调色器 for html output: CSS + JS built from the registered palettes.
// Pick mode outlines every component (lead, panel, figure, table, views, steps, …); click one, click a
// swatch, and only that component re-tints, live (diagrams read the same CSS tokens, so no re-render).
// Page presets swap the whole page. Choices persist in localStorage and copy out as one front-matter line
//   palette: page=warm s2=tomato s3.1=cobalt
// which the next render bakes in, so an agent regenerating the page keeps the reader's colours.
const COMP = '.pe-views,.pe-fig,.pe-table,.pe-callout,.pe-steps,.pe-slider,.pe-tabs,.pe-code';

export function parsePalette(str = '') {
  const out = {}; for (const kv of String(str).split(/[\s,;]+/)) { const m = kv.match(/^([\w.]+)=([\w-]+)$/); if (m) out[m[1]] = m[2]; } return out;
}

export function paletteCss(registry) {
  const pages = registry.palettes('page');
  const decl = o => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';');
  const pageCss = pages.filter(p => Object.keys(p.light || {}).length).map(p =>
    `html[data-pal=${p.name}]{${decl(p.light)}}@media (prefers-color-scheme:dark){html[data-pal=${p.name}]:not([data-theme=light]){${decl(p.dark || {})}}}html[data-pal=${p.name}][data-theme=dark]{${decl(p.dark || {})}}`).join('\n');
  const tint = `--pe-accent:var(--pk-m);--pe-blue:var(--pk-m);--pe-surface:color-mix(in srgb,var(--pk-l) 22%,var(--pe-paper));--pe-surface-2:color-mix(in srgb,var(--pk-l) 42%,var(--pe-paper));--pe-border:color-mix(in srgb,var(--pk-m) 45%,var(--pe-paper))`;
  const tintDark = `--pe-accent:var(--pk-l);--pe-blue:var(--pk-l);--pe-surface:color-mix(in srgb,var(--pk-d) 55%,var(--pe-paper));--pe-surface-2:color-mix(in srgb,var(--pk-d) 80%,var(--pe-paper));--pe-border:color-mix(in srgb,var(--pk-l) 35%,var(--pe-paper))`;
  return `${pageCss}
[data-pk]{${tint}}
@media (prefers-color-scheme:dark){html:not([data-theme=light]) [data-pk]{${tintDark}}}
html[data-theme=dark] [data-pk]{${tintDark}}
[data-pk]>h2 .pe-n{color:var(--pe-accent)}
[data-pk] th{color:var(--pe-accent);background:var(--pe-surface)}[data-pk] th:first-child{padding-left:.5rem}[data-pk] td:first-child{padding-left:.5rem}
.pe-callout[data-pk]{border-left-color:var(--pe-accent);background:var(--pe-surface)}
.pe-fig[data-pk],.pe-views[data-pk]{border-color:var(--pe-border)}
.pe-pal{margin-left:0;height:1.6rem;min-width:auto;padding:0 .5rem;font:11px var(--pe-mono);color:var(--pe-muted)}
.pe-pal[aria-pressed=true]{color:var(--pe-ink);border-color:var(--pe-ink)}
.pe-picking [data-pe-id]{cursor:crosshair}
.pe-picking [data-pe-id]:hover{outline:1.5px dashed var(--pe-muted);outline-offset:3px}
.pe-picking [data-pe-sel]{outline:2px solid var(--pe-ink)!important;outline-offset:3px}
.pe-studio{position:fixed;right:1rem;bottom:1rem;width:19rem;max-height:calc(100vh - 2rem);overflow:auto;z-index:10;background:var(--pe-paper);color:var(--pe-ink);border:1px solid var(--pe-ink);border-radius:var(--pe-radius);padding:.85rem .9rem;font-size:.8125rem;box-shadow:4px 4px 0 color-mix(in srgb,var(--pe-ink) 14%,transparent)}
.pe-studio[hidden]{display:none}
.pe-studio h3{margin:0 0 .6rem;font:600 12px var(--pe-mono);letter-spacing:.04em;display:flex;justify-content:space-between;align-items:center}
.pe-studio h3 button{height:1.5rem;min-width:1.5rem;border:0;font-size:14px}
.pe-st-l{font:11px var(--pe-mono);color:var(--pe-muted);margin:.7rem 0 .35rem}
.pe-st-tgt{color:var(--pe-ink);font-family:var(--pe-font)}
.pe-st-row{display:flex;flex-wrap:wrap;gap:.35rem}
.pe-st-page{height:auto;padding:.3rem .5rem;display:flex;gap:.4rem;align-items:center;font-size:12px}
.pe-st-page i{display:flex;gap:2px}.pe-st-page i b{width:.55rem;height:.55rem;border-radius:1px;border:1px solid color-mix(in srgb,var(--pe-ink) 25%,transparent)}
.pe-sw{width:2.6rem;height:auto;min-width:0;padding:.25rem .2rem .2rem;display:flex;flex-direction:column;align-items:center;gap:.2rem;font-size:10px;color:var(--pe-muted)}
.pe-sw i{display:flex;flex-direction:column;width:1.6rem;height:1.6rem;border:1px solid var(--pe-ink);border-radius:2px;overflow:hidden}
.pe-sw i b{flex:1}
.pe-sw[aria-pressed=true],.pe-st-page[aria-pressed=true]{border-color:var(--pe-ink);color:var(--pe-ink);box-shadow:inset 0 0 0 1px var(--pe-ink)}
.pe-sw:disabled{opacity:.35;cursor:default}
.pe-st-foot{display:flex;gap:.4rem;margin-top:.85rem;padding-top:.7rem;border-top:1px solid var(--pe-border)}
.pe-st-foot button{height:1.7rem;padding:0 .55rem;font-size:12px}
@media (max-width:640px){.pe-studio{left:.5rem;right:.5rem;bottom:.5rem;width:auto;max-height:55vh}}
.nojs .pe-pal{display:none}
@media print{.pe-pal,.pe-studio{display:none!important}[data-pe-sel]{outline:0!important}}`;
}

export function paletteJs(registry) {
  const data = { pages: registry.palettes('page').map(p => ({ n: p.name, t: p.label, c: [p.light?.['--pe-paper'] || '#FFFCF0', p.light?.['--pe-ink'] || '#100F0F', p.light?.['--pe-accent'] || '#205EA6'] })),
    sw: registry.palettes('swatch').map(s => ({ n: s.name, t: s.label, l: s.l, m: s.m, d: s.d })) };
  return `(()=>{const D=${JSON.stringify(data)},d=document.documentElement,btn=document.querySelector('.pe-pal');if(!btn)return;
const SW=Object.fromEntries(D.sw.map(s=>[s.n,s])),KIND={'pe-views':'多视图','pe-fig':'图','pe-table':'表','pe-callout':'提示','pe-steps':'步骤','pe-slider':'滑杆','pe-tabs':'标签页','pe-code':'代码'};
const top=(root)=>[...root.querySelectorAll('${COMP}')].filter(e=>!e.parentElement.closest('${COMP}')||e.parentElement.closest('${COMP}')===root);
const lead=document.querySelector('.pe-lead');if(lead){lead.dataset.peId='lead';lead.dataset.peName='导语'}
document.querySelectorAll('section.pe-panel').forEach((s,k)=>{s.dataset.peId='s'+(k+1);const h=s.querySelector('h2')?.textContent.replace(/^\\d+/,'')||'';s.dataset.peName=h;
  [...s.querySelectorAll('${COMP}')].filter(e=>e.parentElement.closest('${COMP}')===null).forEach((c,j)=>{c.dataset.peId='s'+(k+1)+'.'+(j+1);c.dataset.peName=h+' · '+(KIND[[...c.classList].find(x=>KIND[x])]||'组件')+(j+1)})});
const key='pe-pal:'+location.pathname+':'+document.title;
const parse=s=>Object.fromEntries(String(s||'').split(/[\\s,;]+/).map(x=>x.split('=')).filter(x=>x.length===2&&x[1]));
let st=(()=>{try{const v=localStorage.getItem(key);if(v)return JSON.parse(v)}catch(e){}return parse(d.dataset.palette)})();
const el=id=>document.querySelector('[data-pe-id="'+id+'"]');
const paint=(e,n)=>{const s=SW[n];if(!e)return;if(!s){e.removeAttribute('data-pk');['--pk-l','--pk-m','--pk-d'].forEach(v=>e.style.removeProperty(v));return}e.dataset.pk=n;e.style.setProperty('--pk-l',s.l);e.style.setProperty('--pk-m',s.m);e.style.setProperty('--pk-d',s.d)};
const apply=()=>{if(st.page&&st.page!=='ink')d.dataset.pal=st.page;else d.removeAttribute('data-pal');document.querySelectorAll('[data-pk]').forEach(e=>paint(e,null));for(const[k,v]of Object.entries(st))if(k!=='page')paint(el(k),v)};
const save=()=>{try{localStorage.setItem(key,JSON.stringify(st))}catch(e){}};
const line=()=>'palette: '+Object.entries(st).map(([k,v])=>k+'='+v).join(' ');
apply();
const P=document.createElement('div');P.className='pe-studio';P.hidden=true;P.setAttribute('role','dialog');P.setAttribute('aria-label','调色器');
const b=(cls,html,attrs={})=>{const x=document.createElement('button');x.type='button';x.className=cls;x.innerHTML=html;for(const[k,v]of Object.entries(attrs))x.setAttribute(k,v);return x};
P.innerHTML='<h3>调色器<button type="button" aria-label="关闭">×</button></h3><div class="pe-st-l">页面</div><div class="pe-st-row pe-st-pages"></div><div class="pe-st-l">组件 · <span class="pe-st-tgt">点选页面上的任一组件</span></div><div class="pe-st-row pe-st-sws"></div><div class="pe-st-foot"></div>';
const pages=P.querySelector('.pe-st-pages'),sws=P.querySelector('.pe-st-sws'),tgt=P.querySelector('.pe-st-tgt'),foot=P.querySelector('.pe-st-foot');
D.pages.forEach(p=>{const x=b('pe-st-page','<i>'+p.c.map(c=>'<b style="background:'+c+'"></b>').join('')+'</i>'+p.t,{'data-n':p.n});x.onclick=()=>{st.page=p.n;apply();save();sync()};pages.append(x)});
const none=b('pe-sw','<i><b style="background:var(--pe-surface)"></b><b style="background:var(--pe-paper)"></b><b style="background:var(--pe-surface-2)"></b></i>默认',{'data-n':''});sws.append(none);
D.sw.forEach(s=>sws.append(b('pe-sw','<i><b style="background:'+s.l+'"></b><b style="background:'+s.m+'"></b><b style="background:'+s.d+'"></b></i>'+s.t,{'data-n':s.n,'aria-label':s.t})));
let sel=null;
sws.addEventListener('click',e=>{const x=e.target.closest('.pe-sw');if(!x||!sel)return;const n=x.dataset.n;if(n)st[sel.dataset.peId]=n;else delete st[sel.dataset.peId];apply();save();sync()});
const copy=b('','复制配色');copy.onclick=()=>{navigator.clipboard?.writeText(line());copy.textContent='已复制'; setTimeout(()=>copy.textContent='复制配色',1200)};
const reset=b('','重置全部');reset.onclick=()=>{st={};apply();save();sync()};foot.append(copy,reset);
const sync=()=>{pages.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String((st.page||'ink')===x.dataset.n)));
  const cur=sel&&st[sel.dataset.peId]||'';sws.querySelectorAll('button').forEach(x=>{x.disabled=!sel;x.setAttribute('aria-pressed',String(!!sel&&x.dataset.n===cur))});tgt.textContent=sel?sel.dataset.peName:'点选页面上的任一组件'};
const pick=e=>{if(!d.classList.contains('pe-picking')||P.contains(e.target)||e.target.closest('.pe-head'))return;const t=e.target.closest('[data-pe-id]');if(!t)return;const ctl=e.target.closest('button,a[href],input,select,textarea,label,summary,[role=tab],[role=button],.pe-an-btn');if(!(ctl&&t.contains(ctl))){e.preventDefault();e.stopPropagation()}sel?.removeAttribute('data-pe-sel');sel=t;t.setAttribute('data-pe-sel','');sync()};
const open=o=>{P.hidden=!o;d.classList.toggle('pe-picking',o);btn.setAttribute('aria-pressed',String(o));if(!o){sel?.removeAttribute('data-pe-sel');sel=null}sync()};
document.addEventListener('click',pick,true);
P.querySelector('h3 button').onclick=()=>open(false);btn.onclick=()=>open(P.hidden);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!P.hidden)open(false)});
document.body.append(P);sync();})();`;
}
