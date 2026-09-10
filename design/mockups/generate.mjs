// Generates the StockScan mockup artboards (.dc.html) + canvas.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || '.';
mkdirSync(OUT, { recursive: true });

// ---------- tokens (from blueprint §45, chrome kept neutral so mode colors own meaning)
const C = { bg: '#F6F7F9', surf: '#FFFFFF', ink: '#171A1F', sub: '#6F7682', faint: '#9AA0AA', line: '#E5E7EB', soft: '#F1F2F4', hi: '#F5F6FF' };
const SANS = `'IBM Plex Sans', 'Noto Sans SC', 'Segoe UI', 'Microsoft YaHei', sans-serif`;
const MONO = `'IBM Plex Mono', Consolas, 'Courier New', monospace`;
const M = {
  IN: { key: 'F1', en: 'STOCK IN', zh: '进货', sign: '+', c: '#047857', tint: '#ECFDF5', bd: '#A7F3D0', icon: 'in' },
  SALE: { key: 'F2', en: 'SALE', zh: '售出', sign: '−', c: '#4F46E5', tint: '#EEF0FF', bd: '#C7CBFB', icon: 'out' },
  RETURN: { key: 'F3', en: 'RETURN', zh: '退货', sign: '+', c: '#0E7490', tint: '#ECFEFF', bd: '#A5E4EE', icon: 'ret' },
  ADJUST: { key: 'F4', en: 'ADJUST', zh: '调整', sign: '±', hint: 'set count', c: '#475569', tint: '#F1F5F9', bd: '#CBD5E1', icon: 'adj' },
};
const REV = { en: 'REVERSAL', c: '#6F7682', tint: '#F1F2F4', bd: '#E5E7EB', icon: 'undo' };
const BASE = { en: 'BASELINE', c: '#171A1F', tint: '#F1F2F4', bd: '#E5E7EB', icon: 'file' };
const WARN = { c: '#B45309', tint: '#FFFBEB', bd: '#FCD34D' };
const OK = { c: '#047857', tint: '#ECFDF5', bd: '#A7F3D0' };
const NEG = '#C2410C';

// ---------- icons
const P = {
  barcode: '<path d="M4 5v14"></path><path d="M7.5 5v14"></path><path d="M10.5 5v14"></path><path d="M14 5v14"></path><path d="M17 5v14"></path><path d="M20 5v14"></path>',
  in: '<path d="M12 3v11"></path><path d="M7.5 9.5L12 14l4.5-4.5"></path><path d="M4 16v4h16v-4"></path>',
  out: '<path d="M12 14V3"></path><path d="M7.5 7.5L12 3l4.5 4.5"></path><path d="M4 16v4h16v-4"></path>',
  ret: '<path d="M9 14L4 9l5-5"></path><path d="M4 9h11a5 5 0 0 1 0 10h-3"></path>',
  adj: '<path d="M4 7h9"></path><path d="M17 7h3"></path><path d="M4 17h3"></path><path d="M11 17h9"></path><circle cx="15" cy="7" r="2"></circle><circle cx="9" cy="17" r="2"></circle>',
  undo: '<path d="M3 12a9 9 0 1 0 2.6-6.4"></path><path d="M3 4v5h5"></path>',
  warn: '<path d="M12 3.5L2.5 20h19z"></path><path d="M12 10v4.5"></path><path d="M12 17.5v.01"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  warehouse: '<path d="M3 21V9l9-5 9 5v12"></path><path d="M7 21v-8h10v8"></path><path d="M7 17h10"></path>',
  gear: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2.5v3"></path><path d="M12 18.5v3"></path><path d="M2.5 12h3"></path><path d="M18.5 12h3"></path><path d="M5.3 5.3l2.1 2.1"></path><path d="M16.6 16.6l2.1 2.1"></path><path d="M5.3 18.7l2.1-2.1"></path><path d="M16.6 7.4l2.1-2.1"></path>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>',
  file: '<path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v4h4"></path>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>',
  x: '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
  chev: '<path d="M6 9l6 6 6-6"></path>',
  plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
  minus: '<path d="M5 12h14"></path>',
  box: '<path d="M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5z"></path><path d="M3 7.5l9 4.5 9-4.5"></path><path d="M12 12v9"></path>',
  down: '<path d="M12 3v12"></path><path d="M7 10l5 5 5-5"></path><path d="M4 21h16"></path>',
  arrowR: '<path d="M4 12h16"></path><path d="M14 6l6 6-6 6"></path>',
  swap: '<path d="M4 8h15l-4-4"></path><path d="M20 16H5l4 4"></path>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"></path><path d="M8.5 12l2.5 2.5 4.5-5"></path>',
  hdd: '<rect x="3" y="13" width="18" height="7" rx="2"></rect><path d="M3 13l3-8h12l3 8"></path><path d="M7 16.5h.01"></path>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"></path><path d="M3 13h5l1 2h6l1-2h5"></path>',
  kb: '<rect x="2.5" y="6" width="19" height="12" rx="2"></rect><path d="M6 10h.01"></path><path d="M10 10h.01"></path><path d="M14 10h.01"></path><path d="M18 10h.01"></path><path d="M7 14h10"></path>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
};
const ic = (n, s = 20, c = 'currentColor', w = 1.75) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0">${P[n]}</svg>`;

// ---------- formatting
const n = (x) => (x < 0 ? '−' : '') + Math.abs(x).toLocaleString('en-US');
const sn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toLocaleString('en-US');
const ctnPcs = (q, isi) => {
  if (q < 0) return 'below zero';
  const c = Math.floor(q / isi), r = q % isi;
  return r === 0 ? `${n(c)} ctn` : `${n(c)} ctn + ${r} pcs`;
};
const ctnDec = (q, isi) => (q < 0 ? '−' : '') + Math.abs(q / isi).toFixed(2);

// ---------- primitives
const doc = (body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&amp;family=IBM+Plex+Sans:wght@400;500;600;700&amp;family=Noto+Sans+SC:wght@400;500;700&amp;display=swap">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: ${C.bg}; color: ${C.ink}; font-family: ${SANS}; -webkit-font-smoothing: antialiased; }
    a { color: #4F46E5; }
    a:hover { color: #3730A3; }
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
const root = (inner) => `<div style="width: 1440px; height: 900px; background: ${C.bg}; color: ${C.ink}; font-family: ${SANS}; display: flex; flex-direction: column; overflow: hidden">
${inner}
</div>`;
const kbd = (t, dark = false) =>
  `<span style="font-family: ${MONO}; font-size: 11px; line-height: 16px; padding: 1px 6px; border-radius: 4px; border: 1px solid ${dark ? 'rgba(255,255,255,0.45)' : C.line}; color: ${dark ? '#FFFFFF' : C.sub}; background: ${dark ? 'transparent' : C.surf}; font-weight: 500">${t}</span>`;
const label = (t) => `<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${C.sub}">${t}</div>`;
const pill = (inner, col) =>
  `<span style="display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 600; color: ${col.c}; background: ${col.tint}; border: 1px solid ${col.bd}; white-space: nowrap">${inner}</span>`;
const dot = (c) => `<span style="width: 7px; height: 7px; border-radius: 50%; background: ${c}; flex-shrink: 0"></span>`;
const btn = (text, o = {}) => {
  const h = o.h || 40;
  const kind = o.kind || 'secondary';
  const bg = kind === 'primary' ? (o.color || C.ink) : kind === 'ghost' ? 'transparent' : C.surf;
  const fg = kind === 'primary' ? '#FFFFFF' : (o.fg || C.ink);
  const bd = kind === 'secondary' ? `1px solid ${C.line}` : kind === 'ghost' ? '1px solid transparent' : `1px solid ${o.color || C.ink}`;
  return `<div style="height: ${h}px; padding: 0 ${o.px || 16}px; border-radius: 10px; background: ${bg}; color: ${fg}; border: ${bd}; display: inline-flex; align-items: center; gap: 10px; font-size: ${o.fs || 14}px; font-weight: 600; white-space: nowrap; flex-shrink: 0">${o.icon ? ic(o.icon, 18, fg, 2) : ''}${text}${o.k ? kbd(o.k, kind === 'primary') : ''}</div>`;
};
const card = (inner, extra = '') => `<div style="background: ${C.surf}; border: 1px solid ${C.line}; border-radius: 14px; ${extra}">${inner}</div>`;
const seg = (opts, active) =>
  `<div style="display: inline-flex; padding: 3px; border-radius: 10px; background: ${C.soft}; gap: 2px">${opts
    .map(([k, t]) => `<div style="height: 34px; padding: 0 16px; display: flex; align-items: center; border-radius: 8px; font-size: 14px; font-weight: ${k === active ? 600 : 500}; background: ${k === active ? C.surf : 'transparent'}; color: ${k === active ? C.ink : C.sub}; box-shadow: ${k === active ? '0 1px 2px rgba(23,26,31,0.14)' : 'none'}; white-space: nowrap">${t}</div>`)
    .join('')}</div>`;
const src = (t) => `<span style="font-size: 11px; font-weight: 500; padding: 2px 7px; border-radius: 4px; background: ${C.soft}; color: ${C.sub}; white-space: nowrap">${t}</span>`;

// ---------- header
const logo = () => `<div style="display: flex; align-items: center; gap: 10px">
  <div style="width: 32px; height: 32px; border-radius: 8px; background: ${C.ink}; display: flex; align-items: center; justify-content: center">${ic('barcode', 18, '#FFFFFF', 2)}</div>
  <div style="display: flex; flex-direction: column; line-height: 1.15"><span style="font-size: 16px; font-weight: 700; letter-spacing: -0.01em">StockScan</span><span style="font-size: 11px; color: ${C.sub}">扫码库存工作台</span></div>
</div>`;
const whChip = () => `<div style="display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border: 1px solid ${C.line}; border-radius: 8px; font-size: 13px">${ic('warehouse', 16, C.sub)}<span style="color: ${C.sub}">Warehouse</span><span style="font-weight: 600">GS 8A NO 21</span></div>`;
let LANG = 'en';
const langSeg = () => `<div style="display: flex; padding: 3px; border-radius: 8px; background: ${C.soft}; font-size: 12px; font-weight: 600">${[['en', 'EN'], ['zh', '中文'], ['id', 'ID']]
  .map(([k, t]) => (k === LANG ? `<span style="padding: 5px 9px; border-radius: 6px; background: ${C.surf}; box-shadow: 0 1px 2px rgba(23,26,31,0.12)">${t}</span>` : `<span style="padding: 5px 9px; color: ${C.sub}">${t}</span>`))
  .join('')}</div>`;
function header({ active, op = 'Alex', opId = '1024', exc = 3 }) {
  const tabs = ['Scan', 'Inventory', 'History', 'Data']
    .map((t) => {
      const on = t === active;
      return `<div style="padding: 8px 14px; border-radius: 8px; font-size: 14px; font-weight: ${on ? 600 : 500}; color: ${on ? C.ink : C.sub}; background: ${on ? C.soft : 'transparent'}">${t}</div>`;
    })
    .join('');
  return `<div style="height: 60px; flex-shrink: 0; background: ${C.surf}; border-bottom: 1px solid ${C.line}; display: flex; align-items: center; gap: 36px; padding: 0 24px">
  ${logo()}
  <div style="display: flex; gap: 4px">${tabs}</div>
  <div style="flex-grow: 1"></div>
  <div style="display: flex; align-items: center; gap: 10px">
    ${whChip()}
    <div style="display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 8px; background: ${WARN.tint}; border: 1px solid ${WARN.bd}; color: ${WARN.c}; font-size: 13px; font-weight: 600">${ic('warn', 16, WARN.c, 2)}Exceptions<span style="min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: ${WARN.c}; color: #FFFFFF; font-size: 12px; display: flex; align-items: center; justify-content: center">${exc}</span></div>
    <div style="display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px 0 6px; border: 1px solid ${C.line}; border-radius: 8px; font-size: 13px"><span style="width: 26px; height: 26px; border-radius: 50%; background: ${C.ink}; color: #FFFFFF; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center">${op.slice(0, 2).toUpperCase()}</span><span style="font-weight: 600">${op}</span><span style="font-family: ${MONO}; color: ${C.sub}">#${opId}</span>${ic('chev', 14, C.sub)}</div>
    ${langSeg()}
    <div style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid ${C.line}; display: flex; align-items: center; justify-content: center">${ic('gear', 18, C.sub)}</div>
  </div>
</div>`;
}

// ---------- scan building blocks
function modeBar(active) {
  return `<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px">${Object.entries(M)
    .map(([k, m]) => {
      const on = k === active;
      return `<div style="height: 80px; border-radius: 12px; border: ${on ? `2px solid ${m.c}` : `1px solid ${C.line}`}; background: ${on ? m.c : C.surf}; color: ${on ? '#FFFFFF' : C.ink}; display: flex; align-items: center; gap: 14px; padding: 0 16px; box-shadow: ${on ? `0 8px 18px -10px ${m.c}` : 'none'}">
      <div style="width: 42px; height: 42px; border-radius: 10px; background: ${on ? 'rgba(255,255,255,0.18)' : m.tint}; display: flex; align-items: center; justify-content: center">${ic(m.icon, 22, on ? '#FFFFFF' : m.c, 2)}</div>
      <div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1">
        <div style="font-size: 18px; font-weight: 700; letter-spacing: 0.04em">${m.en}</div>
        <div style="font-size: 13px; color: ${on ? 'rgba(255,255,255,0.88)' : C.sub}">${m.zh} · ${m.hint || m.sign + ' qty'}</div>
      </div>
      <div style="align-self: flex-start; margin-top: 12px">${kbd(m.key, on)}</div>
    </div>`;
    })
    .join('')}</div>`;
}
function scannerStrip(last, state = 'ready') {
  const w = state === 'warn';
  return `<div style="height: 52px; flex-shrink: 0; background: ${C.surf}; border: 1px solid ${C.line}; border-radius: 12px; display: flex; align-items: center; gap: 16px; padding: 0 16px">
  <div style="display: flex; align-items: center; gap: 10px"><span style="width: 10px; height: 10px; border-radius: 50%; background: #10B981; box-shadow: 0 0 0 4px #D1FAE5"></span><span style="font-size: 14px; font-weight: 600">Scanner ready</span><span style="font-size: 13px; color: ${C.sub}">扫描器就绪</span></div>
  <div style="width: 1px; height: 22px; background: ${C.line}"></div>
  <div style="display: flex; align-items: center; gap: 10px; font-size: 13px"><span style="color: ${C.sub}">Last scan</span><span style="font-family: ${MONO}; font-size: 14px; font-weight: 500; color: ${w ? WARN.c : C.ink}">${last}</span>${w ? pill('Not found', WARN) : ''}</div>
  <div style="flex-grow: 1"></div>
  <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${C.sub}">${ic('kb', 18, C.sub)}Type barcode manually</div>
</div>`;
}
const eqItem = (lab, val, cap, color, size, strong) =>
  `<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 12px; color: ${C.sub}; white-space: nowrap">${lab}</span><span style="font-family: ${MONO}; font-size: ${size}px; line-height: 1.1; font-weight: ${strong ? 600 : 500}; color: ${color}">${val}</span><span style="font-size: 12px; color: ${C.faint}; white-space: nowrap">${cap}</span></div>`;
const opSign = (s) => `<span style="font-family: ${MONO}; font-size: 22px; color: ${C.faint}; padding-bottom: 22px">${s}</span>`;
const stepBtn = (name) => `<div style="width: 60px; height: 60px; flex-shrink: 0; border-radius: 12px; border: 1px solid ${C.line}; background: ${C.surf}; display: flex; align-items: center; justify-content: center">${ic(name, 22, C.ink, 2)}</div>`;

function productCard(p, o) {
  const m = M[o.mode];
  const change = o.unit === 'CTN' ? o.qty * p.isi : o.qty;
  const after = p.cur + (m.sign === '−' ? -change : change);
  const top = `<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 22px 28px 20px">
  <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0">
    <div style="display: flex; align-items: center; gap: 10px">${pill(ic('check', 13, OK.c, 2.5) + 'Found', OK)}<span style="font-size: 13px; color: ${C.sub}">Scanned ${o.time}</span></div>
    <div style="font-size: 24px; font-weight: 600; letter-spacing: -0.01em">${p.name}</div>
    <div style="display: flex; gap: 22px; font-size: 13px; color: ${C.sub}">
      <span>Model <span style="color: ${C.ink}; font-weight: 500">${p.model}</span></span>
      <span>Barcode <span style="font-family: ${MONO}; color: ${C.ink}">${p.barcode}</span></span>
      <span>Ref. price <span style="color: ${C.ink}">${p.price}</span></span>
    </div>
  </div>
  <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; background: ${C.soft}; flex-shrink: 0">${ic('box', 20, C.sub)}<div style="display: flex; flex-direction: column"><span style="font-size: 12px; color: ${C.sub}">Pack size · ISI</span><span style="font-size: 15px; font-weight: 600">${p.isi} pcs / carton</span></div></div>
</div>`;
  const stock = `<div style="display: flex; flex-direction: column; gap: 12px">
    ${label('Stock · 库存')}
    <div style="display: flex; align-items: flex-end; gap: 14px">
      ${eqItem('ACCURATE baseline', n(p.base), '09 Sep 2026', C.sub, 26)}
      ${opSign(p.delta < 0 ? '−' : '+')}
      ${eqItem('Live change', n(Math.abs(p.delta)), 'StockScan', C.sub, 26)}
      ${opSign('=')}
      ${eqItem('Current', n(p.cur), ctnPcs(p.cur, p.isi), p.cur < 0 ? NEG : C.ink, 44, true)}
    </div>
  </div>`;
  const qty = `<div style="display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; align-items: center; justify-content: space-between">${label('Quantity · 数量')}${seg([['PCS', 'PCS 件'], ['CTN', 'CTN 箱']], o.unit)}</div>
    <div style="display: flex; align-items: center; gap: 10px">
      ${stepBtn('minus')}
      <div style="flex-grow: 1; height: 60px; border: 2px solid ${m.c}; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: ${MONO}; font-size: 34px; font-weight: 600">${o.qty}<span style="font-size: 15px; font-weight: 500; color: ${C.sub}">${o.unit.toLowerCase()}</span></div>
      ${stepBtn('plus')}
    </div>
    <div style="font-size: 13px; color: ${C.sub}">${o.unit === 'CTN' ? `${o.qty} ctn × ${p.isi} = <b style="color: ${C.ink}">${n(change)} pcs</b>` : 'Type a number or press + / −'}</div>
  </div>`;
  let band;
  if (o.band === 'negative') {
    band = `<div style="margin: 0 20px 20px; padding: 18px 20px; border-radius: 12px; background: ${WARN.tint}; border: 1.5px solid ${WARN.bd}; display: flex; align-items: center; gap: 18px">
    <div style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; background: ${WARN.c}; display: flex; align-items: center; justify-content: center">${ic('warn', 24, '#FFFFFF', 2)}</div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0">
      <span style="font-size: 18px; font-weight: 700; color: ${WARN.c}">Insufficient recorded stock · 库存不足</span>
      <span style="font-size: 14px">Current <b>${n(p.cur)}</b> · Sale <b>${n(change)}</b> · Result <b style="color: ${NEG}">${n(after)}</b></span>
      <span style="font-size: 13px; color: ${C.sub}">The record may be behind the shelf. You can continue; this sale is flagged for admin review.</span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px; font-family: ${MONO}; font-size: 30px; font-weight: 600; flex-shrink: 0"><span style="color: ${C.sub}">${n(p.cur)}</span>${ic('arrowR', 22, C.faint, 2)}<span style="color: ${NEG}">${n(after)}</span></div>
    <div style="display: flex; flex-direction: column; gap: 8px; flex-shrink: 0">
      ${btn('Continue sale', { kind: 'primary', color: WARN.c, k: 'Enter', h: 42 })}
      ${btn('Cancel', { k: 'Esc', h: 42 })}
    </div>
  </div>`;
  } else {
    band = `<div style="margin: 0 20px 20px; padding: 16px 20px; border-radius: 12px; background: ${m.tint}; border: 1px solid ${m.bd}; display: flex; align-items: center; gap: 24px">
    <div style="display: flex; align-items: center; gap: 12px; min-width: 190px">
      <div style="width: 42px; height: 42px; border-radius: 10px; background: ${m.c}; display: flex; align-items: center; justify-content: center">${ic(m.icon, 22, '#FFFFFF', 2)}</div>
      <div style="display: flex; flex-direction: column"><span style="font-size: 19px; font-weight: 700; color: ${m.c}; letter-spacing: 0.03em">${m.en} ${m.sign}${n(change)}</span><span style="font-size: 12px; color: ${C.sub}">${m.zh} · pcs</span></div>
    </div>
    <div style="flex-grow: 1; display: flex; align-items: center; gap: 14px; font-family: ${MONO}; font-size: 34px; font-weight: 600"><span style="color: ${C.sub}">${n(p.cur)}</span>${ic('arrowR', 26, C.faint, 2)}<span>${n(after)}</span></div>
    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px">
      ${btn('Confirm ' + m.en.toLowerCase(), { kind: 'primary', color: m.c, k: 'Enter', h: 52, fs: 16, px: 22 })}
      <span style="font-size: 12px; color: ${C.sub}">Esc to cancel</span>
    </div>
  </div>`;
  }
  return card(`${top}
  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 36px; padding: 20px 28px 22px; border-top: 1px solid ${C.line}">
    ${stock}
    ${qty}
  </div>
  ${band}`, 'display: flex; flex-direction: column');
}

function unknownPanel(code) {
  return `<div style="flex-grow: 1; background: ${C.surf}; border: 1.5px solid ${WARN.bd}; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 32px">
  <div style="width: 68px; height: 68px; border-radius: 50%; background: ${WARN.tint}; border: 1px solid ${WARN.bd}; display: flex; align-items: center; justify-content: center">${ic('warn', 32, WARN.c, 2)}</div>
  <div style="display: flex; flex-direction: column; align-items: center; gap: 4px"><span style="font-size: 30px; font-weight: 600; letter-spacing: -0.01em">Barcode not found</span><span style="font-size: 16px; color: ${C.sub}">未找到条码</span></div>
  <div style="font-family: ${MONO}; font-size: 30px; font-weight: 500; letter-spacing: 0.06em; padding: 12px 26px; border-radius: 10px; background: ${C.soft}">${code}</div>
  <div style="display: flex; align-items: center; gap: 8px; font-size: 15px; color: ${OK.c}; font-weight: 600">${ic('shield', 20, OK.c, 2)}No inventory has been changed. · 库存没有发生变化。</div>
  <div style="display: flex; gap: 12px; margin-top: 10px">
    ${btn('Scan again', { kind: 'primary', k: 'Enter', h: 48 })}
    ${btn('Cancel', { k: 'Esc', h: 48 })}
    ${btn('Link in Barcode Setup', { kind: 'ghost', icon: 'link', h: 48, fg: C.sub })}
  </div>
  <div style="font-size: 12px; color: ${C.faint}">Warning beep played · logged to Exceptions for the admin</div>
</div>`;
}

function recentCard(list, no) {
  const rows = list.length
    ? list
        .map((r) => {
          const m = M[r.mode];
          return `<div style="display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-top: 1px solid ${C.soft}">
      <div style="width: 34px; height: 34px; flex-shrink: 0; border-radius: 8px; background: ${m.tint}; display: flex; align-items: center; justify-content: center">${ic(m.icon, 17, m.c, 2)}</div>
      <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 14px; font-weight: 600">${r.model}</span><span style="font-size: 12px; color: ${C.sub}">${m.en} · ${r.q} · ${r.t}</span></div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px"><span style="font-family: ${MONO}; font-size: 15px; font-weight: 600; color: ${m.c}">${sn(r.ch)}</span><span style="font-family: ${MONO}; font-size: 12px; color: ${C.sub}">${n(r.b)} → ${n(r.b + r.ch)}</span></div>
    </div>`;
        })
        .join('')
    : `<div style="padding: 36px 18px; display: flex; flex-direction: column; align-items: center; gap: 10px; border-top: 1px solid ${C.soft}">${ic('barcode', 26, C.faint)}<span style="font-size: 13px; color: ${C.sub}">No transactions in this session yet.</span></div>`;
  return card(`<div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 18px"><span style="font-size: 15px; font-weight: 600">Recent activity</span><span style="font-size: 12px; color: ${C.sub}">Session #${no}</span></div>${rows}`, 'display: flex; flex-direction: column; overflow: hidden');
}
function shortcutsCard() {
  const rows = [['Switch mode', 'F1 – F4'], ['Change quantity', '+ / −'], ['Pieces / cartons', 'Tab'], ['Confirm', 'Enter'], ['Cancel', 'Esc'], ['Undo last', 'Ctrl+Z']];
  return card(`<div style="display: flex; flex-direction: column; gap: 10px; padding: 16px 18px">
    <div style="display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600">${ic('kb', 18, C.sub)}Keyboard</div>
    ${rows.map(([a, b]) => `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: ${C.sub}"><span>${a}</span>${kbd(b)}</div>`).join('')}
  </div>`);
}
function sessionBar(s) {
  const stat = (v, l) => `<span style="font-size: 13px; color: ${C.sub}; white-space: nowrap"><b style="font-family: ${MONO}; color: ${C.ink}; font-weight: 600">${v}</b> ${l}</span>`;
  return `<div style="height: 64px; flex-shrink: 0; background: ${C.surf}; border-top: 1px solid ${C.line}; display: flex; align-items: center; gap: 22px; padding: 0 24px">
  <div style="display: flex; align-items: baseline; gap: 10px"><span style="font-size: 15px; font-weight: 600">Session #${s.no}</span><span style="font-size: 13px; color: ${C.sub}">${s.op} · started ${s.started}</span></div>
  <div style="width: 1px; height: 24px; background: ${C.line}"></div>
  <div style="display: flex; gap: 22px">${stat(s.tx, 'transactions')}${stat(s.pcs, 'pcs')}${stat(s.products, 'products')}${stat(s.net, 'net change')}</div>
  <div style="flex-grow: 1"></div>
  ${btn('Undo last', { icon: 'undo', k: 'Ctrl+Z' })}
  ${btn('Finish session', { kind: 'primary' })}
</div>`;
}
function scanScreen({ op = 'Alex', opId = '1024', mode, last, lastState, center, recent, session }) {
  return root(`${header({ active: 'Scan', op, opId })}
<div style="flex-grow: 1; display: flex; gap: 24px; padding: 22px 24px; min-height: 0">
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px; min-width: 0">
    ${label('Current mode · 当前模式')}
    ${modeBar(mode)}
    ${scannerStrip(last, lastState)}
    ${center}
  </div>
  <div style="width: 360px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px">
    ${recentCard(recent, session.no)}
    ${shortcutsCard()}
  </div>
</div>
${sessionBar(session)}`);
}

// ---------- sample data (EMERGENCY report rows are real; the rest are marked sample on the canvas)
const PR = {
  EM296: { name: 'EMERGENCY LAMP KISEKI CK-EM296', model: 'CK-EM296', barcode: '6914791234567', price: 'Rp 32,500', isi: 100, base: 50 },
  EM196: { name: 'EMERGENCY LAMP KISEKI CK-EM196', model: 'CK-EM196', barcode: '6914791234574', price: 'Rp 36,500', isi: 100, base: 4697 },
  K805: { name: 'EMERGENCY LAMP SMARTSONIC SM-K805', model: 'SM-K805', barcode: '6921234508056', price: 'Rp 12,500', isi: 450, base: 4992 },
  K837: { name: 'EMERGENCY LAMP KISEKI CK-K837PB', model: 'CK-K837PB', barcode: '6914791238374', price: '—', isi: 60, base: 120 },
  EM838: { name: 'EMERGENCY LAMP KISEKI CK-EM838', model: 'CK-EM838', barcode: null, price: '—', isi: 80, base: 280 },
  K808: { name: 'EMERGENCY LAMP SMARTSONIC SM-K808', model: 'SM-K808', barcode: '6921234508087', price: '—', isi: 100, base: 2 },
};
const alexRecent = [
  { mode: 'SALE', model: 'CK-EM296', q: '4 pcs', t: '15:36:05', b: 50, ch: -4 },
  { mode: 'SALE', model: 'SM-K805', q: '1 ctn × 450', t: '15:33:47', b: 4992, ch: -450 },
  { mode: 'SALE', model: 'CK-EM196', q: '12 pcs', t: '15:31:20', b: 4697, ch: -12 },
];
const alexSession = { no: '042', op: 'Alex', started: '15:30', tx: 3, pcs: 466, products: 3, net: '−466' };

function buildAll() {
const files = {};

// 1. Operator select
files['Operator.dc.html'] = doc(root(`<div style="height: 60px; flex-shrink: 0; background: ${C.surf}; border-bottom: 1px solid ${C.line}; display: flex; align-items: center; gap: 12px; padding: 0 24px">
  ${logo()}
  <div style="flex-grow: 1"></div>
  ${whChip()}
  ${langSeg()}
</div>
<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; padding-top: 96px; gap: 28px">
  <div style="display: flex; flex-direction: column; align-items: center; gap: 8px">
    <div style="font-size: 34px; font-weight: 600; letter-spacing: -0.02em">Who is scanning today?</div>
    <div style="font-size: 17px; color: ${C.sub}">选择操作员工 · Pick your name to start</div>
  </div>
  <div style="width: 640px; height: 54px; background: ${C.surf}; border: 1px solid ${C.line}; border-radius: 12px; display: flex; align-items: center; gap: 12px; padding: 0 18px; box-shadow: 0 1px 2px rgba(23,26,31,0.05)">${ic('search', 20, C.sub)}<span style="flex-grow: 1; font-size: 16px; color: ${C.faint}">Search name or employee ID</span></div>
  <div style="width: 760px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px">
    ${[['Alex', '1024', true], ['Amy', '1031', false], ['John', '1068', false]]
      .map(([nm, id, last]) => `<div style="height: 172px; border-radius: 14px; background: ${C.surf}; border: ${last ? `2px solid ${C.ink}` : `1px solid ${C.line}`}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; position: relative">
      ${last ? `<div style="position: absolute; top: 12px; right: 12px; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: ${C.soft}; color: ${C.sub}">Last used</div>` : ''}
      <div style="width: 58px; height: 58px; border-radius: 50%; background: ${last ? C.ink : C.soft}; color: ${last ? '#FFFFFF' : C.ink}; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600">${nm.slice(0, 2).toUpperCase()}</div>
      <div style="font-size: 19px; font-weight: 600">${nm}</div>
      <div style="font-family: ${MONO}; font-size: 13px; color: ${C.sub}">#${id}</div>
    </div>`)
      .join('')}
  </div>
  <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${C.sub}">${kbd('↑ ↓')} move ${kbd('Enter')} start · no password needed</div>
  <div style="flex-grow: 1"></div>
  <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${C.sub}; padding-bottom: 32px">${ic('hdd', 18, C.sub)}Works offline · Data is stored on this computer · Last backup today 08:02</div>
</div>`));

// 2. Scan — Sale (main)
files['Main.dc.html'] = doc(scanScreen({
  mode: 'SALE', last: PR.EM296.barcode,
  center: productCard({ ...PR.EM296, delta: -4, cur: 46 }, { mode: 'SALE', qty: 3, unit: 'PCS', time: '15:38:12' }),
  recent: alexRecent, session: alexSession,
}));

// 3. Unknown barcode
files['UnknownBarcode.dc.html'] = doc(scanScreen({
  mode: 'SALE', last: '8997012345678', lastState: 'warn',
  center: unknownPanel('8997012345678'),
  recent: alexRecent, session: alexSession,
}));

// 4. Negative stock warning (John, earlier in the day)
files['NegativeStock.dc.html'] = doc(scanScreen({
  op: 'John', opId: '1068', mode: 'SALE', last: PR.K808.barcode,
  center: productCard({ ...PR.K808, delta: 0, cur: 2 }, { mode: 'SALE', qty: 5, unit: 'PCS', time: '13:40:02', band: 'negative' }),
  recent: [], session: { no: '040', op: 'John', started: '13:39', tx: 0, pcs: 0, products: 0, net: '0' },
}));

// 5. Inventory + drawer
const inv = [
  { ...PR.EM196, d: -12, t: '15:31' },
  { ...PR.EM296, d: -4, t: '15:36', sel: true },
  { ...PR.EM838, d: 0, t: '09 Sep' },
  { ...PR.K837, d: 300, t: '14:13' },
  { ...PR.K805, d: -450, t: '15:33' },
  { ...PR.K808, d: -5, t: '13:40' },
];
const invCols = 'minmax(0, 1fr) 112px 60px 92px 84px 96px 80px 72px';
const th = (t, right) => `<div style="font-size: 12px; font-weight: 600; color: ${C.sub}; text-align: ${right ? 'right' : 'left'}">${t}</div>`;
const chip = (t, cnt, on) => `<div style="height: 34px; padding: 0 12px; border-radius: 999px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: ${on ? 600 : 500}; background: ${on ? C.ink : C.surf}; color: ${on ? '#FFFFFF' : C.ink}; border: 1px solid ${on ? C.ink : C.line}; white-space: nowrap">${t}<span style="font-family: ${MONO}; font-size: 12px; color: ${on ? 'rgba(255,255,255,0.7)' : C.sub}">${cnt}</span></div>`;
const invRow = (r) => {
  const cur = r.base + r.d;
  return `<div style="display: grid; grid-template-columns: ${invCols}; gap: 12px; align-items: center; height: 58px; padding: 0 20px; border-top: 1px solid ${C.soft}; background: ${r.sel ? C.hi : C.surf}">
    <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 14px; font-weight: 600">${r.model}</span><span style="font-size: 12px; color: ${C.sub}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${r.name}</span></div>
    <div>${r.barcode ? `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px">${dot(OK.c)}Linked</span>` : `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: ${WARN.c}; font-weight: 600">${dot(WARN.c)}Unlinked</span>`}</div>
    <div style="font-family: ${MONO}; font-size: 13px; text-align: right; color: ${C.sub}">${r.isi}</div>
    <div style="font-family: ${MONO}; font-size: 13px; text-align: right; color: ${C.sub}">${n(r.base)}</div>
    <div style="font-family: ${MONO}; font-size: 13px; text-align: right; color: ${r.d === 0 ? C.faint : C.ink}">${r.d === 0 ? '0' : sn(r.d)}</div>
    <div style="font-family: ${MONO}; font-size: 15px; font-weight: 600; text-align: right; color: ${cur < 0 ? NEG : C.ink}; display: flex; align-items: center; justify-content: flex-end; gap: 6px">${cur < 0 ? ic('warn', 14, NEG, 2) : ''}${n(cur)}</div>
    <div style="font-family: ${MONO}; font-size: 13px; text-align: right; color: ${C.sub}">${ctnDec(cur, r.isi)}</div>
    <div style="font-size: 12px; text-align: right; color: ${C.sub}">${r.t}</div>
  </div>`;
};
const kv = (k, v, tag) => `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid ${C.soft}"><span style="font-size: 13px; color: ${C.sub}">${k}</span><span style="display: flex; align-items: center; gap: 10px">${tag ? src(tag) : ''}<span style="font-size: 14px; font-weight: 600">${v}</span></span></div>`;
files['Inventory.dc.html'] = doc(root(`${header({ active: 'Inventory' })}
<div style="flex-grow: 1; display: flex; min-height: 0">
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; padding: 24px; min-width: 0">
    <div style="display: flex; align-items: flex-end; justify-content: space-between">
      <div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 24px; font-weight: 600; letter-spacing: -0.01em">Inventory</span><span style="font-size: 13px; color: ${C.sub}">GS 8A NO 21 · 1,284 products · baseline from ACCURATE, 09 Sep 2026</span></div>
      ${btn('Export', { icon: 'down' })}
    </div>
    <div style="height: 44px; background: ${C.surf}; border: 1px solid ${C.line}; border-radius: 10px; display: flex; align-items: center; gap: 10px; padding: 0 14px">${ic('search', 18, C.sub)}<span style="font-size: 14px; color: ${C.faint}">Search product name, model or barcode</span></div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap">${chip('All', '1,284', true)}${chip('Barcode unlinked', '352')}${chip('Negative stock', '1')}${chip('Zero stock', '0')}${chip('Changed today', '5')}${chip('Exceptions', '3')}</div>
    ${card(`<div style="display: grid; grid-template-columns: ${invCols}; gap: 12px; align-items: center; height: 42px; padding: 0 20px">${th('Product')}${th('Barcode')}${th('ISI', 1)}${th('Baseline', 1)}${th('Live Δ', 1)}${th('Current', 1)}${th('Cartons', 1)}${th('Updated', 1)}</div>
    ${inv.map(invRow).join('')}
    <div style="padding: 12px 20px; border-top: 1px solid ${C.line}; font-size: 12px; color: ${C.sub}">Showing 6 of 1,284 · Current = Baseline + Live Δ · Cartons = Current ÷ ISI</div>`, 'overflow: hidden')}
  </div>
  <div style="width: 440px; flex-shrink: 0; background: ${C.surf}; border-left: 1px solid ${C.line}; display: flex; flex-direction: column">
    <div style="padding: 22px 24px 18px; display: flex; flex-direction: column; gap: 6px">
      <div style="display: flex; justify-content: space-between; align-items: center">${label('Product')}${ic('x', 18, C.sub)}</div>
      <div style="font-size: 20px; font-weight: 600">EMERGENCY LAMP KISEKI CK-EM296</div>
      <div style="font-size: 13px; color: ${C.sub}">Model CK-EM296 · Warehouse GS 8A NO 21</div>
    </div>
    <div style="padding: 0 24px 18px; display: flex; align-items: baseline; gap: 10px"><span style="font-family: ${MONO}; font-size: 44px; font-weight: 600; line-height: 1">46</span><span style="font-size: 15px; color: ${C.sub}">pcs · 0 ctn + 46 pcs</span></div>
    <div style="padding: 0 24px; display: flex; flex-direction: column">
      ${kv('ACCURATE baseline', '50', 'Imported · 09 Sep')}
      ${kv('Live change', '−4', 'Recorded · 1 tx')}
      ${kv('Current stock', '46', 'Calculated')}
      ${kv('Carton equivalent', '0.46', 'Derived · ISI 100')}
      ${kv('Reference price', 'Rp 32,500', 'Imported · HARGA')}
    </div>
    <div style="padding: 20px 24px 0; display: flex; flex-direction: column; gap: 10px">
      ${label('Barcodes')}
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid ${C.line}; border-radius: 10px"><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-family: ${MONO}; font-size: 15px; font-weight: 500">6914791234567</span><span style="font-size: 12px; color: ${C.sub}">Unit barcode · ×1 · linked by Alex, 10 Sep 10:02</span></div>${dot(OK.c)}</div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: ${C.sub}">${ic('plus', 16, C.sub, 2)}Link another barcode</div>
    </div>
    <div style="padding: 20px 24px 0; display: flex; flex-direction: column; gap: 10px">
      ${label('Recent activity')}
      <div style="display: flex; align-items: center; gap: 10px; font-size: 13px">${pill(ic('out', 12, M.SALE.c, 2.25) + 'SALE', M.SALE)}<span style="flex-grow: 1; color: ${C.sub}">15:36 · Alex #1024</span><span style="font-family: ${MONO}; font-weight: 600">−4</span><span style="font-family: ${MONO}; color: ${C.sub}">50 → 46</span></div>
    </div>
    <div style="flex-grow: 1"></div>
    <div style="padding: 16px 24px; border-top: 1px solid ${C.line}; display: flex; gap: 8px">${btn('Adjust stock', { icon: 'adj' })}${btn('Barcodes', { icon: 'link' })}${btn('History', { kind: 'ghost', fg: C.sub })}</div>
  </div>
</div>`));

// 6. History
const hisCols = '92px 140px minmax(0, 1fr) 132px 140px 84px 150px 64px 200px';
const actPill = (a) => pill(ic(a.icon, 12, a.c, 2.25) + a.en, a);
const his = [
  { t: '15:36:05', op: 'Alex', id: '1024', p: PR.EM296, a: M.SALE, q: '4 pcs', ch: -4, b: 50, s: '042' },
  { t: '15:33:47', op: 'Alex', id: '1024', p: PR.K805, a: M.SALE, q: '1 ctn × 450', ch: -450, b: 4992, s: '042' },
  { t: '15:31:20', op: 'Alex', id: '1024', p: PR.EM196, a: M.SALE, q: '12 pcs', ch: -12, b: 4697, s: '042' },
  { t: '14:13:22', op: 'Amy', id: '1031', p: PR.K837, a: REV, q: '—', ch: -300, b: 720, s: '041', note: `Undo of 14:13:05` },
  { t: '14:13:05', op: 'Amy', id: '1031', p: PR.K837, a: M.IN, q: '5 ctn × 60', ch: 300, b: 420, s: '041', note: 'Reversed at 14:13:22', dim: true },
  { t: '14:12:40', op: 'Amy', id: '1031', p: PR.K837, a: M.IN, q: '5 ctn × 60', ch: 300, b: 120, s: '041' },
  { t: '13:40:02', op: 'John', id: '1068', p: PR.K808, a: M.SALE, q: '5 pcs', ch: -5, b: 2, s: '040', warn: true },
];
const hisRow = (r) => `<div style="display: grid; grid-template-columns: ${hisCols}; gap: 12px; align-items: center; height: 56px; padding: 0 20px; border-top: 1px solid ${C.soft}; ${r.dim ? `color: ${C.sub}` : ''}">
  <div style="font-family: ${MONO}; font-size: 13px">${r.t}</div>
  <div style="font-size: 13px"><span style="font-weight: 600">${r.op}</span> <span style="font-family: ${MONO}; color: ${C.sub}">#${r.id}</span></div>
  <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 14px; font-weight: 600">${r.p.model}</span><span style="font-size: 12px; color: ${C.sub}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${r.p.name}</span></div>
  <div>${actPill(r.a)}</div>
  <div style="font-size: 13px; color: ${C.sub}">${r.q}</div>
  <div style="font-family: ${MONO}; font-size: 14px; font-weight: 600; text-align: right; ${r.dim ? 'text-decoration: line-through;' : ''}">${sn(r.ch)}</div>
  <div style="font-family: ${MONO}; font-size: 13px; color: ${C.sub}">${n(r.b)} → <span style="color: ${r.b + r.ch < 0 ? NEG : C.ink}; font-weight: 600">${n(r.b + r.ch)}</span></div>
  <div style="font-family: ${MONO}; font-size: 13px; color: ${C.sub}">#${r.s}</div>
  <div>${r.warn ? pill(ic('warn', 12, WARN.c, 2.25) + 'Negative · acknowledged', WARN) : r.note ? `<span style="font-size: 12px; color: ${C.sub}">${r.note}</span>` : ''}</div>
</div>`;
const filt = (k, v) => `<div style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.line}; background: ${C.surf}; display: flex; align-items: center; gap: 8px; font-size: 13px"><span style="color: ${C.sub}">${k}</span><span style="font-weight: 600">${v}</span>${ic('chev', 14, C.sub)}</div>`;
files['History.dc.html'] = doc(root(`${header({ active: 'History' })}
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; padding: 24px; min-height: 0">
  <div style="display: flex; align-items: flex-end; justify-content: space-between">
    <div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 24px; font-weight: 600; letter-spacing: -0.01em">History</span><span style="font-size: 13px; color: ${C.sub}">Every stock change is kept. Undo adds a reversal line; nothing is deleted.</span></div>
    ${btn('Export transactions', { icon: 'down' })}
  </div>
  <div style="display: flex; gap: 8px">${filt('Date', 'Today · 10 Sep 2026')}${filt('Operator', 'All')}${filt('Action', 'All')}${filt('Session', 'All')}<div style="flex-grow: 1; height: 38px; border-radius: 8px; border: 1px solid ${C.line}; background: ${C.surf}; display: flex; align-items: center; gap: 8px; padding: 0 12px; font-size: 13px; color: ${C.faint}">${ic('search', 16, C.sub)}Product, model or barcode</div></div>
  ${card(`<div style="display: grid; grid-template-columns: ${hisCols}; gap: 12px; align-items: center; height: 42px; padding: 0 20px">${th('Time')}${th('Operator')}${th('Product')}${th('Action')}${th('Quantity entered')}${th('Change', 1)}${th('Before → After')}${th('Session')}${th('Notes')}</div>
  ${his.map(hisRow).join('')}
  <div style="display: grid; grid-template-columns: ${hisCols}; gap: 12px; align-items: center; height: 56px; padding: 0 20px; border-top: 1px solid ${C.soft}; background: ${C.bg}">
    <div style="font-family: ${MONO}; font-size: 13px">08:05:31</div>
    <div style="font-size: 13px"><span style="font-weight: 600">Alex</span> <span style="font-family: ${MONO}; color: ${C.sub}">#1024</span></div>
    <div style="font-size: 14px; font-weight: 600">All products · 1,284</div>
    <div>${actPill(BASE)}</div>
    <div style="font-size: 13px; color: ${C.sub}">—</div><div></div><div></div><div></div>
    <div style="font-size: 12px; color: ${C.sub}">stock gs8 09.09.2026.xls</div>
  </div>
  <div style="padding: 12px 20px; border-top: 1px solid ${C.line}; font-size: 12px; color: ${C.sub}">8 records today · 3 operators</div>`, 'overflow: hidden')}
</div>`));

// ---------- Data pages
const dataItems = [
  ['import', 'Import stock report', '导入库存报表', 'file'],
  ['map', 'Import barcode mapping', '导入条码对应表', 'link'],
  ['rec', 'Reconcile new snapshot', '核对新库存报表', 'swap'],
  ['exs', 'Export current stock', '导出当前库存', 'down'],
  ['ext', 'Export transactions', '导出操作记录', 'down'],
];
const dataNav = (active) => `<div style="width: 280px; flex-shrink: 0; background: ${C.surf}; border-right: 1px solid ${C.line}; display: flex; flex-direction: column; padding: 20px 14px; gap: 4px">
  <div style="padding: 0 10px 10px">${label('Data · 数据')}</div>
  ${dataItems
    .map(([k, en, zh, i]) => {
      const on = k === active;
      return `<div style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; background: ${on ? C.soft : 'transparent'}">${ic(i, 18, on ? C.ink : C.sub)}<div style="display: flex; flex-direction: column"><span style="font-size: 14px; font-weight: ${on ? 600 : 500}">${en}</span><span style="font-size: 12px; color: ${C.sub}">${zh}</span></div></div>`;
    })
    .join('')}
  <div style="flex-grow: 1"></div>
  <div style="border-top: 1px solid ${C.line}; padding: 16px 10px 0; display: flex; flex-direction: column; gap: 10px">
    <div style="display: flex; align-items: center; gap: 10px">${ic('hdd', 18, C.sub)}<span style="font-size: 14px; font-weight: 600">Backup &amp; restore</span></div>
    <span style="font-size: 12px; color: ${C.sub}">Last backup today 08:02 · 14 daily copies kept</span>
    <div style="display: flex; gap: 8px">${btn('Back up now', { h: 34, fs: 13, px: 12 })}${btn('Restore', { h: 34, fs: 13, px: 12, kind: 'ghost', fg: C.sub })}</div>
  </div>
</div>`;
const stepper = (steps, cur) => `<div style="display: flex; align-items: center; gap: 12px">${steps
  .map((s, i) => {
    const done = i < cur, on = i === cur;
    return `${i ? `<div style="width: 36px; height: 1px; background: ${C.line}"></div>` : ''}<div style="display: flex; align-items: center; gap: 8px"><span style="width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; background: ${done ? OK.c : on ? C.ink : C.soft}; color: ${done || on ? '#FFFFFF' : C.sub}">${done ? ic('check', 13, '#FFFFFF', 2.5) : i + 1}</span><span style="font-size: 13px; font-weight: ${on ? 600 : 500}; color: ${on || done ? C.ink : C.sub}">${s}</span></div>`;
  })
  .join('')}</div>`;
const statusPill = (s) => (s === 'ok' ? pill(ic('check', 12, OK.c, 2.5) + 'Mapped', OK) : s === 'pending' ? pill('Needs confirmation', WARN) : pill('Optional', { c: C.sub, tint: C.soft, bd: C.line }));
const mapCols = '170px 44px minmax(0, 1fr) 230px 170px';
const mapRows = [
  ['Deskripsi Barang', 'Product name', 'EMERGENCY LAMP KISEKI CK-EM296', 'ok'],
  ['ISI', 'Pack size · pieces per carton', '100', 'pending'],
  ['GS 8A NO 21', 'Stock quantity · warehouse GS 8A NO 21', '50', 'ok'],
  ['KOLI', 'Not imported · used to check stock ÷ ISI', '0.50', 'pending'],
  ['HARGA', 'Reference price', 'Not in this file', 'opt'],
];
const checkLine = (ok, t) => `<div style="display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.45">${ok ? ic('check', 18, OK.c, 2.25) : ic('warn', 18, WARN.c, 2)}<span>${t}</span></div>`;
files['ImportReport.dc.html'] = doc(root(`${header({ active: 'Data' })}
<div style="flex-grow: 1; display: flex; min-height: 0">
  ${dataNav('import')}
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; padding: 24px 28px; min-width: 0">
    <div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 24px; font-weight: 600; letter-spacing: -0.01em">Import ACCURATE stock report</span>${stepper(['Choose file', 'Detect report', 'Review', 'Import'], 2)}</div>
    ${card(`<div style="display: flex; align-items: center; gap: 14px; padding: 16px 20px"><div style="width: 42px; height: 42px; border-radius: 10px; background: ${C.soft}; display: flex; align-items: center; justify-content: center">${ic('file', 22, C.ink)}</div><div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">stock gs8 09.09.2026.xls</span><span style="font-size: 13px; color: ${C.sub}">ACCURATE 5 report · Kuantitas Barang GS 8 No.21 · legacy .xls</span></div>${btn('Choose another file', { kind: 'ghost', fg: C.sub })}</div>`)}
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px">
      ${card(`<div style="padding: 16px 20px; display: flex; flex-direction: column">${label('Detected')}<div style="height: 6px"></div>
        ${kv('Company', 'PT. CHANG PING INDONESIA')}${kv('Warehouse column', 'GS 8A NO 21')}${kv('Report as of', '09 Sep 2026')}${kv('Printed at', '09 Sep 2026 · 15:53')}${kv('Products found', '1,284')}</div>`)}
      ${card(`<div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px">${label('Checks')}
        ${checkLine(true, 'Report date is not later than today.')}
        ${checkLine(true, 'KOLI matches stock ÷ ISI on the rows checked.')}
        ${checkLine(false, '<b>No barcode column found.</b> Products are linked to barcodes separately: import a barcode mapping file, or link them in Barcode Setup.')}
        ${checkLine(true, 'A backup is made automatically before importing.')}</div>`)}
    </div>
    ${card(`<div style="padding: 14px 20px 8px">${label('Column mapping')}</div>
      <div style="display: grid; grid-template-columns: ${mapCols}; gap: 12px; align-items: center; height: 36px; padding: 0 20px">${th('Report column')}<div></div>${th('StockScan field')}${th('First row')}${th('Status')}</div>
      ${mapRows
        .map(([a, b, v, s]) => `<div style="display: grid; grid-template-columns: ${mapCols}; gap: 12px; align-items: center; height: 46px; padding: 0 20px; border-top: 1px solid ${C.soft}"><span style="font-family: ${MONO}; font-size: 13px; font-weight: 500">${a}</span>${ic('arrowR', 16, C.faint)}<span style="font-size: 14px">${b}</span><span style="font-size: 13px; color: ${s === 'opt' ? C.faint : C.sub}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${v}</span><div>${statusPill(s)}</div></div>`)
        .join('')}`, 'overflow: hidden')}
    <div style="flex-grow: 1"></div>
    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px">${btn('Cancel')}${btn('Import baseline · 1,284 products', { kind: 'primary', k: 'Enter' })}</div>
  </div>
</div>`));

// 8. Barcode setup
const recentLinks = [
  ['6914791234567', 'CK-EM296', 'Unit ×1', 'Alex', '10:02'],
  ['6914791234574', 'CK-EM196', 'Unit ×1', 'Alex', '10:05'],
  ['6921234508056', 'SM-K805', 'Unit ×1', 'Alex', '10:07'],
  ['16921234508053', 'SM-K805', 'Carton ×450', 'Amy', '10:21'],
];
const stat = (v, l, col) => `<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 12px; color: ${C.sub}">${l}</span><span style="font-family: ${MONO}; font-size: 26px; font-weight: 600; color: ${col || C.ink}">${v}</span></div>`;
files['BarcodeSetup.dc.html'] = doc(root(`${header({ active: null })}
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; padding: 24px; min-height: 0">
  <div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; color: ${C.sub}">Settings / Barcode setup</span><span style="font-size: 24px; font-weight: 600; letter-spacing: -0.01em">Link barcodes to products</span></div>
  ${card(`<div style="display: flex; align-items: center; gap: 48px; padding: 18px 24px">
    ${stat('1,284', 'Products imported')}${stat('932', 'Barcode linked', OK.c)}${stat('352', 'Unlinked', WARN.c)}
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px"><div style="display: flex; justify-content: space-between; font-size: 13px"><span style="color: ${C.sub}">Coverage</span><span style="font-family: ${MONO}; font-weight: 600">72.6%</span></div><div style="height: 10px; border-radius: 999px; background: ${C.soft}; overflow: hidden"><div style="width: 72.6%; height: 100%; background: ${OK.c}; border-radius: 999px"></div></div><span style="font-size: 12px; color: ${C.sub}">Unlinked products cannot be found by scanning yet.</span></div>
  </div>`)}
  <div style="flex-grow: 1; display: flex; gap: 16px; min-height: 0">
    ${card(`<div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid ${C.line}">
        <div style="display: flex; flex-direction: column; gap: 4px">${label('Next unlinked product · 1 of 352')}<span style="font-size: 20px; font-weight: 600">EMERGENCY LAMP KISEKI CK-EM838</span><span style="font-size: 13px; color: ${C.sub}">Model CK-EM838 · ISI 80 pcs / carton · stock 280</span></div>
        <div style="display: flex; gap: 8px">${btn('Search product', { icon: 'search' })}${btn('Skip', { kind: 'ghost', fg: C.sub })}</div>
      </div>
      <div style="padding: 22px 24px; display: flex; flex-direction: column; gap: 18px; flex-grow: 1">
        <div style="display: flex; flex-direction: column; gap: 10px">${label('1 · Scan the barcode on the item or carton')}
          <div style="height: 120px; border: 2px dashed ${C.line}; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 20px; background: ${C.bg}">${ic('barcode', 34, C.ink, 1.75)}<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-family: ${MONO}; font-size: 30px; font-weight: 500; letter-spacing: 0.05em">8991234000838</span><span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: ${OK.c}; font-weight: 600">${ic('check', 15, OK.c, 2.5)}Not used by any other product</span></div></div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px">${label('2 · What does this barcode count as?')}
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
            <div style="padding: 14px 16px; border: 2px solid ${C.ink}; border-radius: 12px; display: flex; align-items: center; gap: 12px">${ic('barcode', 22, C.ink)}<div style="display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: 600">Single item</span><span style="font-size: 13px; color: ${C.sub}">One scan = 1 pcs</span></div></div>
            <div style="padding: 14px 16px; border: 1px solid ${C.line}; border-radius: 12px; display: flex; align-items: center; gap: 12px">${ic('box', 22, C.sub)}<div style="display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: 600">Whole carton</span><span style="font-size: 13px; color: ${C.sub}">One scan = 80 pcs (ISI)</span></div></div>
          </div>
        </div>
        <div style="flex-grow: 1"></div>
        <div style="display: flex; justify-content: flex-end">${btn('Link barcode', { kind: 'primary', icon: 'link', k: 'Enter', h: 46 })}</div>
      </div>`, 'flex-grow: 1; display: flex; flex-direction: column; min-width: 0')}
    ${card(`<div style="padding: 18px 20px 10px; font-size: 15px; font-weight: 600">Recently linked</div>
      ${recentLinks
        .map(([code, model, type, op, t]) => `<div style="display: flex; flex-direction: column; gap: 3px; padding: 12px 20px; border-top: 1px solid ${C.soft}"><div style="display: flex; align-items: center; gap: 8px"><span style="font-family: ${MONO}; font-size: 14px; font-weight: 500">${code}</span>${ic('arrowR', 14, C.faint)}<span style="font-size: 14px; font-weight: 600">${model}</span></div><span style="font-size: 12px; color: ${C.sub}">${type} · ${op} · today ${t}</span></div>`)
        .join('')}
      <div style="flex-grow: 1"></div>
      <div style="padding: 14px 20px; border-top: 1px solid ${C.line}; font-size: 12px; color: ${C.sub}">Changing or removing a link needs an admin and is kept in the log.</div>`, 'width: 400px; flex-shrink: 0; display: flex; flex-direction: column')}
  </div>
</div>`));

// 9. Reconcile
const recCols = 'minmax(0, 1fr) 104px 100px 100px 116px 100px 250px';
const rec = [
  { p: PR.EM196, prev: 4697, d: -12, neu: 4685 },
  { p: PR.EM296, prev: 50, d: -4, neu: 46 },
  { p: PR.EM838, prev: 280, d: 0, neu: 282, chosen: 'acc' },
  { p: PR.K837, prev: 120, d: 300, neu: 420 },
  { p: PR.K805, prev: 4992, d: -450, neu: 4092 },
  { p: PR.K808, prev: 2, d: -5, neu: 0 },
];
const choice = (t, on) => `<div style="height: 30px; padding: 0 10px; border-radius: 7px; display: flex; align-items: center; font-size: 12px; font-weight: 600; white-space: nowrap; border: 1px solid ${on ? C.ink : C.line}; background: ${on ? C.ink : C.surf}; color: ${on ? '#FFFFFF' : C.ink}">${t}</div>`;
const recRow = (r) => {
  const exp = r.prev + r.d, diff = r.neu - exp;
  const decision = diff === 0 ? pill(ic('check', 12, OK.c, 2.5) + 'Matched', OK) : `<div style="display: flex; gap: 6px">${choice('Use ACCURATE', r.chosen === 'acc')}${choice('Keep StockScan', r.chosen === 'ss')}</div>`;
  return `<div style="display: grid; grid-template-columns: ${recCols}; gap: 12px; align-items: center; height: 58px; padding: 0 20px; border-top: 1px solid ${C.soft}; background: ${diff !== 0 && !r.chosen ? WARN.tint : C.surf}">
  <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 14px; font-weight: 600">${r.p.model}</span><span style="font-size: 12px; color: ${C.sub}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${r.p.name}</span></div>
  <div style="font-family: ${MONO}; font-size: 13px; text-align: right; color: ${C.sub}">${n(r.prev)}</div>
  <div style="font-family: ${MONO}; font-size: 13px; text-align: right; color: ${r.d ? C.ink : C.faint}">${r.d ? sn(r.d) : '0'}</div>
  <div style="font-family: ${MONO}; font-size: 14px; text-align: right; font-weight: 600">${n(exp)}</div>
  <div style="font-family: ${MONO}; font-size: 14px; text-align: right; font-weight: 600">${n(r.neu)}</div>
  <div style="font-family: ${MONO}; font-size: 14px; text-align: right; font-weight: 700; color: ${diff === 0 ? C.faint : WARN.c}">${diff === 0 ? '0' : sn(diff)}</div>
  <div>${decision}</div>
</div>`;
};
const sumChip = (v, l, col, on) => `<div style="flex: 1; padding: 14px 16px; border-radius: 12px; background: ${C.surf}; border: ${on ? `2px solid ${C.ink}` : `1px solid ${C.line}`}; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 12px; color: ${C.sub}">${l}</span><span style="font-family: ${MONO}; font-size: 24px; font-weight: 600; color: ${col || C.ink}">${v}</span></div>`;
files['Reconcile.dc.html'] = doc(root(`${header({ active: 'Data' })}
<div style="flex-grow: 1; display: flex; min-height: 0">
  ${dataNav('rec')}
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; padding: 24px 28px; min-width: 0">
    <div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 24px; font-weight: 600; letter-spacing: -0.01em">Reconcile new ACCURATE snapshot</span><span style="font-size: 13px; color: ${C.sub}">New: <b style="color: ${C.ink}">stock gs8 10.09.2026.xls</b> (as of 10 Sep 2026) · compared with baseline stock gs8 09.09.2026.xls + StockScan changes already entered in ACCURATE</span></div>
    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; background: ${C.surf}; border: 1px solid ${C.line}; font-size: 13px">${ic('shield', 20, OK.c, 2)}<span>Nothing is overwritten until you apply. Differences wait for your decision, and a backup is made first.</span></div>
    <div style="display: flex; gap: 12px">${sumChip('1,270', 'Matched', OK.c)}${sumChip('12', 'Different', WARN.c, true)}${sumChip('1', 'Only in StockScan')}${sumChip('1', 'Only in ACCURATE')}</div>
    ${card(`<div style="display: grid; grid-template-columns: ${recCols}; gap: 12px; align-items: center; height: 42px; padding: 0 20px">${th('Product')}${th('Old baseline', 1)}${th('Synced Δ', 1)}${th('Expected', 1)}${th('New ACCURATE', 1)}${th('Difference', 1)}${th('Decision')}</div>
      ${rec.map(recRow).join('')}
      <div style="padding: 12px 20px; border-top: 1px solid ${C.line}; font-size: 12px; color: ${C.sub}">Synced Δ = StockScan changes already entered in ACCURATE · Expected = old baseline + synced Δ · Difference = new ACCURATE − expected</div>`, 'overflow: hidden')}
    <div style="flex-grow: 1"></div>
    <div style="display: flex; align-items: center; gap: 10px"><span style="flex-grow: 1; font-size: 13px; color: ${WARN.c}; font-weight: 600">2 differences on this page still need a decision</span>${btn('Export discrepancy report', { icon: 'down' })}${btn('Apply &amp; set new baseline', { kind: 'primary' })}</div>
  </div>
</div>`));

return files;
}

// ---------- text nodes (for translation)
const bodyOf = (html) => html.split('</helmet>')[1];
const texts = (html) => [...bodyOf(html).matchAll(/>([^<]+)</g)].map((m) => m[1].trim()).filter((t) => t && !/^[\s·]*$/.test(t));
if (process.argv.includes('--dump')) {
  const all = new Set();
  for (const s of Object.values(buildAll())) texts(s).forEach((t) => all.add(t));
  console.log(JSON.stringify([...all], null, 1));
  process.exit(0);
}

// ---------- canvas layout
const W = 1440, H = 900, GX = 1560, GY = 1080;
const canvas = {
  pages: [
    { id: 'page-1', name: 'Daily scanning' },
    { id: 'page-2', name: 'Inventory & history' },
    { id: 'page-3', name: 'Data & setup' },
  ],
  artboards: [
    { file: 'Operator.dc.html', title: '1 · Select operator', x: 0, y: 0, w: W, h: H, page: 'page-1' },
    { file: 'Main.dc.html', title: '2 · Scan — Sale with quantity', x: GX, y: 0, w: W, h: H, page: 'page-1' },
    { file: 'UnknownBarcode.dc.html', title: '3 · Unknown barcode', x: 0, y: GY, w: W, h: H, page: 'page-1' },
    { file: 'NegativeStock.dc.html', title: '4 · Not enough recorded stock', x: GX, y: GY, w: W, h: H, page: 'page-1' },
    { file: 'Inventory.dc.html', title: '5 · Inventory + product panel', x: 0, y: 0, w: W, h: H, page: 'page-2' },
    { file: 'History.dc.html', title: '6 · History (undo = reversal)', x: GX, y: 0, w: W, h: H, page: 'page-2' },
    { file: 'ImportReport.dc.html', title: '7 · Import ACCURATE report', x: 0, y: 0, w: W, h: H, page: 'page-3' },
    { file: 'BarcodeSetup.dc.html', title: '8 · Barcode setup', x: GX, y: 0, w: W, h: H, page: 'page-3' },
    { file: 'Reconcile.dc.html', title: '9 · Reconcile new snapshot', x: 0, y: GY, w: W, h: H, page: 'page-3' },
  ],
  annotations: [
    {
      id: 'review-scan', x: 0, y: -520, w: 1100, page: 'page-1',
      text: 'StockScan · client review 1/3 — daily scanning\n\nFlow: pick your name → choose the mode once (F1–F4) → scan → type pieces or cartons → Enter.\n\nPlease confirm:\n• Are STOCK IN / SALE / RETURN / ADJUST the four actions your staff need?\n• Do staff count in cartons (ISI)? If never, the CTN switch is hidden.\n• Selling more than the recorded stock is allowed with a warning and flagged for the admin. OK?\n• StockScan will ship in English, 中文 and Bahasa Indonesia. Please check the Bahasa Indonesia page and tell us if any wording feels unnatural.\n\nFigures for CK-EM296, CK-EM196 and SM-K805 come from the EMERGENCY report. Other products, barcodes, names and counts are sample data.',
    },
    {
      id: 'review-inventory', x: 0, y: -420, w: 1100, page: 'page-2',
      text: 'StockScan · client review 2/3 — inventory & history\n\n• Current stock = ACCURATE baseline + StockScan live change, so anyone can see why StockScan differs from ACCURATE.\n• Undo never deletes. It adds a reversal line (see Amy, 14:13 in History).\n\nPlease confirm: which columns do you need in the stock export and the transaction export?',
    },
    {
      id: 'review-data', x: 0, y: -520, w: 1100, page: 'page-3',
      text: 'StockScan · client review 3/3 — data & setup\n\nPlease confirm:\n• ISI = pieces per carton? KOLI = stock ÷ ISI? Which price is HARGA (selling, purchase, other)?\n• Can ACCURATE export a barcode ↔ product list? If not, staff link each barcode once in Barcode Setup.\n• Do cartons carry their own barcode (one scan = a full carton)?\n• When you export a new report from ACCURATE, does it already include the StockScan changes you entered?\n• Is there a fixed Excel/CSV template for entering StockScan data back into ACCURATE?\n• Should damaged returns go to Gudang Rusak instead of sellable stock?',
    },
  ],
  launch: { view: 'canvas', page: 'page-1' },
};

// ---------- Bahasa Indonesia version (text nodes translated; units use KOLI as in the client's ACCURATE reports)
const ID_DICT = {
  '扫码库存工作台': 'Pemindaian Stok', 'Warehouse': 'Gudang',
  'Who is scanning today?': 'Siapa yang bertugas hari ini?', '选择操作员工 · Pick your name to start': 'Pilih nama Anda untuk mulai',
  'Search name or employee ID': 'Cari nama atau ID karyawan', 'Last used': 'Terakhir dipakai', 'move': 'pindah',
  'start · no password needed': 'mulai · tanpa kata sandi',
  'Works offline · Data is stored on this computer · Last backup today 08:02': 'Bisa offline · Data tersimpan di komputer ini · Backup terakhir hari ini 08:02',
  'Inventory': 'Stok', 'History': 'Riwayat', 'Exceptions': 'Perlu dicek',
  'Current mode · 当前模式': 'Mode aktif',
  '进货 · + qty': 'Barang masuk · +', '售出 · − qty': 'Penjualan · −', '退货 · + qty': 'Retur · +', '调整 · set count': 'Stok aktual',
  'Scanner ready': 'Scanner siap', '扫描器就绪': '', 'Last scan': 'Scan terakhir', 'Type barcode manually': 'Ketik barcode manual',
  'Found': 'Ditemukan', 'Ref. price': 'Harga ref.', 'Pack size · ISI': 'Isi per koli · ISI',
  'Stock · 库存': 'Stok', 'ACCURATE baseline': 'Stok awal ACCURATE', 'Live change': 'Perubahan', 'Current': 'Sekarang',
  'Quantity · 数量': 'Jumlah', 'PCS 件': 'PCS', 'CTN 箱': 'KOLI', 'Type a number or press + / −': 'Ketik angka atau tekan + / −',
  '售出 · pcs': 'Penjualan · pcs', 'Confirm sale': 'Konfirmasi jual', 'Esc to cancel': 'Esc untuk batal',
  'Recent activity': 'Aktivitas terbaru', 'Switch mode': 'Ganti mode', 'Change quantity': 'Ubah jumlah', 'Pieces / cartons': 'PCS / KOLI',
  'Confirm': 'Konfirmasi', 'Cancel': 'Batal', 'Undo last': 'Batalkan terakhir',
  'transactions': 'transaksi', 'products': 'produk', 'net change': 'perubahan bersih', 'Finish session': 'Selesai sesi',
  'Not found': 'Tidak ditemukan', 'Barcode not found': 'Barcode tidak ditemukan', '未找到条码': '',
  'No inventory has been changed. · 库存没有发生变化。': 'Stok tidak berubah.',
  'Scan again': 'Scan ulang', 'Link in Barcode Setup': 'Hubungkan di Pengaturan Barcode',
  'Warning beep played · logged to Exceptions for the admin': 'Bunyi peringatan · dicatat untuk dicek admin',
  'Insufficient recorded stock · 库存不足': 'Stok tercatat tidak cukup', '· Sale': '· Jual', '· Result': '· Hasil',
  'The record may be behind the shelf. You can continue; this sale is flagged for admin review.': 'Catatan mungkin belum sesuai rak. Anda boleh lanjut; penjualan ini ditandai untuk dicek admin.',
  'Continue sale': 'Lanjut jual', 'No transactions in this session yet.': 'Belum ada transaksi di sesi ini.',
  'GS 8A NO 21 · 1,284 products · baseline from ACCURATE, 09 Sep 2026': 'GS 8A NO 21 · 1,284 produk · stok awal dari ACCURATE, 09 Sep 2026',
  'Export': 'Ekspor', 'Search product name, model or barcode': 'Cari nama produk, model atau barcode',
  'All': 'Semua', 'Barcode unlinked': 'Belum ada barcode', 'Negative stock': 'Stok minus', 'Zero stock': 'Stok nol', 'Changed today': 'Berubah hari ini',
  'Product': 'Produk', 'Baseline': 'Stok awal', 'Live Δ': 'Perubahan', 'Cartons': 'Koli', 'Updated': 'Diperbarui',
  'Linked': 'Terhubung', 'Unlinked': 'Belum ada',
  'Showing 6 of 1,284 · Current = Baseline + Live Δ · Cartons = Current ÷ ISI': 'Menampilkan 6 dari 1,284 · Sekarang = Stok awal + Perubahan · Koli = Sekarang ÷ ISI',
  'Model CK-EM296 · Warehouse GS 8A NO 21': 'Model CK-EM296 · Gudang GS 8A NO 21',
  'Imported · 09 Sep': 'Diimpor · 09 Sep', 'Recorded · 1 tx': 'Tercatat · 1 transaksi', 'Current stock': 'Stok sekarang', 'Calculated': 'Dihitung',
  'Carton equivalent': 'Setara koli', 'Derived · ISI 100': 'Turunan · ISI 100', 'Reference price': 'Harga referensi', 'Imported · HARGA': 'Diimpor · HARGA',
  'Barcodes': 'Barcode', 'Unit barcode · ×1 · linked by Alex, 10 Sep 10:02': 'Barcode satuan · ×1 · dihubungkan oleh Alex, 10 Sep 10:02',
  'Link another barcode': 'Tambah barcode lain', 'Adjust stock': 'Koreksi stok',
  'Every stock change is kept. Undo adds a reversal line; nothing is deleted.': 'Setiap perubahan stok disimpan. Batal menambah baris pembatalan; tidak ada yang dihapus.',
  'Export transactions': 'Ekspor transaksi', 'Date': 'Tanggal', 'Today · 10 Sep 2026': 'Hari ini · 10 Sep 2026', 'Action': 'Aksi', 'Session': 'Sesi',
  'Product, model or barcode': 'Produk, model atau barcode', 'Time': 'Waktu', 'Quantity entered': 'Jumlah diisi', 'Change': 'Perubahan',
  'Before → After': 'Sebelum → Sesudah', 'Notes': 'Catatan', 'REVERSAL': 'PEMBATALAN', 'Negative · acknowledged': 'Minus · disetujui',
  'All products · 1,284': 'Semua produk · 1,284', 'BASELINE': 'STOK AWAL', '8 records today · 3 operators': '8 catatan hari ini · 3 operator',
  'Data · 数据': 'Data', 'Import stock report': 'Impor laporan stok', '导入库存报表': '', 'Import barcode mapping': 'Impor daftar barcode', '导入条码对应表': '',
  'Reconcile new snapshot': 'Cocokkan laporan baru', '核对新库存报表': '', 'Export current stock': 'Ekspor stok sekarang', '导出当前库存': '', '导出操作记录': '',
  'Backup &amp; restore': 'Backup &amp; pemulihan', 'Last backup today 08:02 · 14 daily copies kept': 'Backup terakhir hari ini 08:02 · 14 salinan harian',
  'Back up now': 'Backup sekarang', 'Restore': 'Pulihkan',
  'Import ACCURATE stock report': 'Impor laporan stok ACCURATE', 'Choose file': 'Pilih file', 'Detect report': 'Deteksi laporan', 'Review': 'Periksa', 'Import': 'Impor',
  'ACCURATE 5 report · Kuantitas Barang GS 8 No.21 · legacy .xls': 'Laporan ACCURATE 5 · Kuantitas Barang GS 8 No.21 · format .xls lama',
  'Choose another file': 'Pilih file lain', 'Detected': 'Terdeteksi', 'Company': 'Perusahaan', 'Warehouse column': 'Kolom gudang',
  'Report as of': 'Laporan per tanggal', 'Printed at': 'Dicetak', 'Products found': 'Produk ditemukan', 'Checks': 'Pengecekan',
  'Report date is not later than today.': 'Tanggal laporan tidak melewati hari ini.',
  'KOLI matches stock ÷ ISI on the rows checked.': 'KOLI sesuai dengan stok ÷ ISI pada baris yang dicek.',
  'No barcode column found.': 'Kolom barcode tidak ditemukan.',
  'Products are linked to barcodes separately: import a barcode mapping file, or link them in Barcode Setup.': 'Produk dihubungkan ke barcode secara terpisah: impor file daftar barcode, atau hubungkan di Pengaturan Barcode.',
  'A backup is made automatically before importing.': 'Backup dibuat otomatis sebelum impor.',
  'Column mapping': 'Pemetaan kolom', 'Report column': 'Kolom laporan', 'StockScan field': 'Kolom StockScan', 'First row': 'Baris pertama',
  'Product name': 'Nama produk', 'Mapped': 'Sesuai', 'Pack size · pieces per carton': 'Isi · pcs per koli', 'Needs confirmation': 'Perlu konfirmasi',
  'Stock quantity · warehouse GS 8A NO 21': 'Jumlah stok · gudang GS 8A NO 21', 'Not imported · used to check stock ÷ ISI': 'Tidak diimpor · untuk cek stok ÷ ISI',
  'Not in this file': 'Tidak ada di file ini', 'Optional': 'Opsional', 'Import baseline · 1,284 products': 'Impor stok awal · 1,284 produk',
  'Settings / Barcode setup': 'Pengaturan / Barcode', 'Link barcodes to products': 'Hubungkan barcode ke produk', 'Products imported': 'Produk diimpor',
  'Barcode linked': 'Sudah ada barcode', 'Coverage': 'Cakupan', 'Unlinked products cannot be found by scanning yet.': 'Produk tanpa barcode belum bisa ditemukan lewat scan.',
  'Next unlinked product · 1 of 352': 'Produk berikutnya tanpa barcode · 1 dari 352',
  'Model CK-EM838 · ISI 80 pcs / carton · stock 280': 'Model CK-EM838 · ISI 80 pcs / koli · stok 280',
  'Search product': 'Cari produk', 'Skip': 'Lewati', '1 · Scan the barcode on the item or carton': '1 · Scan barcode di barang atau koli',
  'Not used by any other product': 'Belum dipakai produk lain', '2 · What does this barcode count as?': '2 · Barcode ini dihitung sebagai apa?',
  'Single item': 'Satuan', 'One scan = 1 pcs': 'Sekali scan = 1 pcs', 'Whole carton': 'Satu koli', 'One scan = 80 pcs (ISI)': 'Sekali scan = 80 pcs (ISI)',
  'Link barcode': 'Hubungkan barcode', 'Recently linked': 'Baru dihubungkan',
  'Changing or removing a link needs an admin and is kept in the log.': 'Mengubah atau menghapus barcode perlu admin dan tercatat di log.',
  'Reconcile new ACCURATE snapshot': 'Cocokkan laporan ACCURATE baru', 'New:': 'Baru:',
  '(as of 10 Sep 2026) · compared with baseline stock gs8 09.09.2026.xls + StockScan changes already entered in ACCURATE': '(per 10 Sep 2026) · dibandingkan dengan stok awal stock gs8 09.09.2026.xls + perubahan StockScan yang sudah diinput ke ACCURATE',
  'Nothing is overwritten until you apply. Differences wait for your decision, and a backup is made first.': 'Tidak ada yang ditimpa sebelum Anda menerapkan. Selisih menunggu keputusan Anda, dan backup dibuat lebih dulu.',
  'Matched': 'Cocok', 'Different': 'Selisih', 'Only in StockScan': 'Hanya di StockScan', 'Only in ACCURATE': 'Hanya di ACCURATE',
  'Old baseline': 'Stok awal lama', 'Synced Δ': 'Δ tersinkron', 'Expected': 'Seharusnya', 'New ACCURATE': 'ACCURATE baru', 'Difference': 'Selisih',
  'Decision': 'Keputusan', 'Use ACCURATE': 'Pakai ACCURATE', 'Keep StockScan': 'Tetap StockScan',
  'Synced Δ = StockScan changes already entered in ACCURATE · Expected = old baseline + synced Δ · Difference = new ACCURATE − expected': 'Δ tersinkron = perubahan StockScan yang sudah diinput ke ACCURATE · Seharusnya = stok awal lama + Δ tersinkron · Selisih = ACCURATE baru − seharusnya',
  '2 differences on this page still need a decision': '2 selisih di halaman ini masih perlu keputusan',
  'Export discrepancy report': 'Ekspor laporan selisih', 'Apply &amp; set new baseline': 'Terapkan &amp; jadikan stok awal',
};
const MODE_ID = { 'STOCK IN': 'MASUK', SALE: 'JUAL', RETURN: 'RETUR', ADJUST: 'KOREKSI' };
const ID_RULES = [
  [/^(STOCK IN|SALE|RETURN|ADJUST)\b(.*)$/, (m, a, b) => MODE_ID[a] + b],
  [/^Session #(\d+)$/, 'Sesi #$1'],
  [/^Scanned (.+)$/, 'Dipindai $1'],
  [/^(\w+) · started (.+)$/, '$1 · mulai $2'],
  [/^(\d+) pcs \/ carton$/, '$1 pcs / koli'],
  [/^Undo of (.+)$/, 'Membatalkan $1'],
  [/^Reversed at (.+)$/, 'Dibatalkan $1'],
  [/^Unit ×1 · (\w+) · today (.+)$/, 'Satuan ×1 · $1 · hari ini $2'],
  [/^Carton ×(\d+) · (\w+) · today (.+)$/, 'Koli ×$1 · $2 · hari ini $3'],
];
// Indonesian number format: 1.284 and 0,46 (file names left alone)
const idNum = (t) => (/xls/.test(t) ? t : t.replace(/\d[\d.,]*\d/g, (s) => s.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'))));
const untranslated = new Set();
const trText = (t) => {
  let out = t;
  if (Object.prototype.hasOwnProperty.call(ID_DICT, t)) out = ID_DICT[t];
  else {
    const rule = ID_RULES.find(([re]) => re.test(t));
    if (rule) out = t.replace(rule[0], rule[1]);
    else if (/[a-z]{3,}/.test(t)) untranslated.add(t);
  }
  return idNum(out.replace(/\bctn\b/g, 'koli'));
};
const toID = (html) => {
  const [head, body] = html.split('</helmet>');
  return head + '</helmet>' + body.replace(/>([^<]+)</g, (m, raw) => {
    const t = raw.trim();
    if (!t) return m;
    return '>' + raw.match(/^\s*/)[0] + trText(t) + raw.match(/\s*$/)[0] + '<';
  });
};

LANG = 'id';
const filesID = {};
for (const [f, s] of Object.entries(buildAll())) filesID[f.replace('.dc.html', 'ID.dc.html')] = toID(s);
LANG = 'en';

const ID_TITLES = {
  Operator: '1 · Pilih operator', Main: '2 · Scan — Jual dengan jumlah', UnknownBarcode: '3 · Barcode tidak ditemukan',
  NegativeStock: '4 · Stok tercatat tidak cukup', Inventory: '5 · Stok + panel produk', History: '6 · Riwayat (batal = pembatalan)',
  ImportReport: '7 · Impor laporan ACCURATE', BarcodeSetup: '8 · Pengaturan barcode', Reconcile: '9 · Cocokkan laporan baru',
};
canvas.pages.push({ id: 'page-4', name: 'Bahasa Indonesia' });
Object.keys(ID_TITLES).forEach((s, i) =>
  canvas.artboards.push({ file: `${s}ID.dc.html`, title: ID_TITLES[s], x: (i % 3) * GX, y: Math.floor(i / 3) * GY, w: W, h: H, page: 'page-4' }));
canvas.annotations.push({
  id: 'review-id', x: 0, y: -440, w: 1100, page: 'page-4',
  text: 'Versi Bahasa Indonesia · Indonesian version\n\nIstilah: MASUK / JUAL / RETUR / KOREKSI untuk mode, PCS / KOLI untuk satuan, format angka Indonesia (1.284 · 0,46).\nMohon satu staf gudang mengecek apakah istilahnya sudah wajar.\n\nTerms: MASUK / JUAL / RETUR / KOREKSI for the modes, PCS / KOLI for units, Indonesian number format. Please ask a warehouse staff member whether the wording feels natural.',
});
canvas.launch = { view: 'canvas', page: 'page-4' };

const all = { ...buildAll(), ...filesID };
for (const [f, s] of Object.entries(all)) writeFileSync(join(OUT, f), s);
writeFileSync(join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2));
console.log('wrote', Object.keys(all).length, 'artboards to', OUT);
if (untranslated.size) console.log('untranslated:', JSON.stringify([...untranslated]));
