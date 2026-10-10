'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const BASE_FONTS = ['Playfair Display', 'Great Vibes', 'Cinzel', 'Montserrat', 'Poppins', 'Noto Sans Devanagari', 'Georgia', 'Arial', 'Times New Roman'];

const SAMPLE_ROWS = [
  { name: 'Aarav Sharma', email: 'aarav@example.test', course: 'Web Development Bootcamp', date: '09 Oct 2026' },
  { name: 'Priya Verma', email: 'priya@example.test', course: 'Data Science Workshop', date: '09 Oct 2026' },
  { name: 'Mohammed Al-Farsi', email: 'farsi@example.test', course: 'Cloud Computing Training', date: '09 Oct 2026' },
  { name: 'राहुल कुमार', email: 'rahul@example.test', course: 'Digital Marketing Course', date: '09 Oct 2026' },
];

const DEFAULT_FIELD = {
  text: '', x: 1000, y: 700, w: 1400, size: 60, minSize: 24, font: 'Montserrat', weight: 400,
  italic: false, color: '#111111', align: 'center', transform: 'none', spacing: 0, maxLines: 1,
};
const DEFAULT_MAIL = {
  subject: 'Your certificate for {{course}}',
  body: 'Hi {{name}},\n\nCongratulations! Your certificate **{{certificate.pdf}}** is attached.\nCertificate ID: {{certificate_id}}\n\nRegards,\nCertificates Team',
  logo: '', accent: '#2748d8', footer: 'Sent to {{email}}', sender: 'Certificates Team',
};
const escH = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fillMail = (t, row) => String(t).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, k) => (k === 'certificate.pdf' || k === 'certificate.png' ? (row && row.file) || 'CERT-2026-XXXXXX.pdf' : k === 'certificate_id' ? (row && row.certificate_id) || 'CERT-2026-XXXXXX' : row && row[k] != null ? String(row[k]) : ''));
const mailHtml = (m, row) => {
  const ac = /^#[0-9a-f]{3,8}$/i.test(m.accent) ? m.accent : '#2748d8';
  const f = (t) => escH(fillMail(t, row)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, `<a href="$2" style="color:${ac}">$1</a>`).replace(/\n/g, '<br>');
  const logo = /^https:\/\//.test(m.logo) ? `<img src="${escH(m.logo)}" alt="" style="max-height:56px;margin-bottom:20px"><br>` : '';
  return `<div style="background:#f5f5f4;padding:20px"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;border-top:4px solid ${ac};padding:24px;font:15px/1.6 Arial,sans-serif;color:#1c1917">${logo}${f(m.body)}${m.footer ? `<div style="margin-top:24px;font-size:12px;color:#78716c">${f(m.footer)}</div>` : ''}</div></div>`;
};
const emailAoa = (m) => [['SUBJECT', m.subject], ['BODY', m.body], ['LOGO', m.logo], ['ACCENT', m.accent], ['FOOTER', m.footer], ['SENDER_NAME', m.sender]];
let _id = 0;
const mk = (o) => ({ ...DEFAULT_FIELD, id: 'f' + ++_id, ...o });

const defaultFields = () => [
  mk({ text: 'CERTIFICATE OF COMPLETION', x: 1000, y: 300, w: 1600, size: 110, minSize: 40, font: 'Cinzel', weight: 700, color: '#7a5a14' }),
  mk({ text: 'This is proudly presented to', x: 1000, y: 470, w: 1400, size: 48, color: '#555555' }),
  mk({ text: '{{name}}', x: 1000, y: 650, w: 1500, size: 160, minSize: 60, font: 'Great Vibes' }),
  mk({ text: 'for successfully completing {{course}}', x: 1000, y: 850, w: 1500, size: 52, minSize: 30, color: '#333333', maxLines: 2 }),
  mk({ text: 'Date: {{date}}', x: 230, y: 1180, w: 600, size: 40, align: 'left', color: '#333333' }),
  mk({ text: 'ID: {{certificate_id}}', x: 1770, y: 1180, w: 700, size: 36, align: 'right', color: '#333333' }),
];

function makeDefaultTemplate() {
  const c = document.createElement('canvas');
  c.width = 2000; c.height = 1414;
  const g = c.getContext('2d');
  g.fillStyle = '#fffdf7'; g.fillRect(0, 0, 2000, 1414);
  g.strokeStyle = '#b8902f'; g.lineWidth = 14; g.strokeRect(50, 50, 1900, 1314);
  g.lineWidth = 3; g.strokeRect(85, 85, 1830, 1244);
  return c.toDataURL('image/png');
}

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function newCertId() {
  const a = new Uint32Array(2); crypto.getRandomValues(a);
  return 'CERT-' + new Date().getFullYear() + '-' + (a[0].toString(36) + a[1].toString(36)).toUpperCase().slice(0, 6).padEnd(6, '0');
}

function genIds(n) {
  const seen = new Set(), out = [];
  while (out.length < n) { const id = newCertId(); if (!seen.has(id)) { seen.add(id); out.push(id); } }
  return out;
}

// one entry per row: stable certificate id + output file name
function buildItems(rows, ids, pattern, ext) {
  const used = new Set();
  return rows.map((r, i) => {
    const id = ids[i];
    let name = fillText({ text: pattern || '{{certificate_id}}', transform: 'none' }, { ...r, certificate_id: id }, id).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || id;
    if (used.has(name.toLowerCase())) name = `${name}_${i + 1}`;
    used.add(name.toLowerCase());
    return { r, id, name, file: `${name}.${ext}` };
  });
}

function fillText(f, row, id) {
  let t = f.text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, k) => (k === 'certificate_id' ? id : row && row[k] != null ? String(row[k]) : ''));
  if (f.transform === 'upper') t = t.toUpperCase();
  else if (f.transform === 'lower') t = t.toLowerCase();
  else if (f.transform === 'title') t = t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return t.trim();
}

function wrapLines(ctx, text, maxW, maxLines, clamp) {
  if (maxLines <= 1 || ctx.measureText(text).width <= maxW) return [text];
  const out = []; let cur = '';
  for (const w of text.split(/\s+/)) {
    const t = cur ? cur + ' ' + w : w;
    if (!cur || ctx.measureText(t).width <= maxW) cur = t; else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (clamp && out.length > maxLines) {
    const keep = out.slice(0, maxLines);
    let last = out.slice(maxLines - 1).join(' ');
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    keep[maxLines - 1] = last + '…';
    return keep;
  }
  return out;
}

// Single renderer used by preview AND export (k = output scale relative to template pixels)
function drawCert(ctx, img, T, k, fields, row, id, selId) {
  const W = T.w * k, H = T.h * k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  if (img) ctx.drawImage(img, 0, 0, W, H);
  const boxes = [];
  for (const f of fields) {
    const text = fillText(f, row, id);
    ctx.save();
    ctx.textBaseline = 'middle'; ctx.textAlign = f.align; ctx.fillStyle = f.color;
    if ('letterSpacing' in ctx) ctx.letterSpacing = f.spacing * k + 'px';
    const setF = (s) => { ctx.font = `${f.italic ? 'italic ' : ''}${f.weight} ${Math.max(1, s * k)}px "${f.font}", sans-serif`; };
    let size = f.size; setF(size);
    const maxW = f.w * k;
    let ls = wrapLines(ctx, text, maxW, f.maxLines, false);
    while (size > f.minSize && (ls.length > f.maxLines || ls.some((l) => ctx.measureText(l).width > maxW))) {
      size -= 1; setF(size); ls = wrapLines(ctx, text, maxW, f.maxLines, false);
    }
    ls = wrapLines(ctx, text, maxW, f.maxLines, true);
    const lh = size * 1.2 * k, total = lh * ls.length;
    const y0 = f.y * k - total / 2 + lh / 2;
    ls.forEach((l, i) => ctx.fillText(l, f.x * k, y0 + i * lh));
    const left = f.align === 'center' ? f.x - f.w / 2 : f.align === 'left' ? f.x : f.x - f.w;
    const h = Math.max(total / k, size * 1.2);
    const box = { id: f.id, left, top: f.y - h / 2, w: f.w, h };
    boxes.push(box);
    if (selId && selId === f.id) {
      ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = '#3b6cf6';
      ctx.strokeRect(box.left * k, box.top * k, box.w * k, box.h * k);
    }
    ctx.restore();
  }
  return boxes;
}

async function ensureFonts(fields, txt) {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    fields.map((f) => document.fonts.load(`${f.italic ? 'italic ' : ''}${f.weight} 32px "${f.font}"`, txt + f.text).catch(() => {}))
  );
}

function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export default function Page() {
  const [T, setT] = useState({ w: 2000, h: 1414 });
  const [img, setImg] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [sheet, setSheet] = useState('');
  const [fields, setFields] = useState([]);
  const [sel, setSel] = useState(null);
  const [idx, setIdx] = useState(0);
  const [fonts, setFonts] = useState(BASE_FONTS);
  const [tick, setTick] = useState(0);
  const [opt, setOpt] = useState({ pdf: true, png: false, scale: 1, batch: 200, pattern: '{{certificate_id}}' });
  const [mail, setMail] = useState(DEFAULT_MAIL);
  const [prog, setProg] = useState(null);
  const [msg, setMsg] = useState('');
  const ids = useMemo(() => genIds(rows.length), [rows]);
  const ext = opt.pdf ? 'pdf' : 'png';
  const items = useMemo(() => buildItems(rows, ids, opt.pattern, ext), [rows, ids, opt.pattern, ext]);
  const mailRow = rows[idx] && items[idx] ? { ...rows[idx], certificate_id: items[idx].id, file: items[idx].file } : rows[idx];
  const canvasRef = useRef(null);
  const boxesRef = useRef([]);
  const drag = useRef(null);
  const wbRef = useRef(null);
  const PK = useMemo(() => Math.min(1, 1400 / T.w), [T]);

  useEffect(() => {
    loadImage(makeDefaultTemplate()).then((i) => { setImg(i); setT({ w: 2000, h: 1414 }); });
    setRows(SAMPLE_ROWS); setHeaders(Object.keys(SAMPLE_ROWS[0]));
    const fs = defaultFields(); setFields(fs); setSel(fs[2].id);
  }, []);

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    let dead = false;
    const row = rows[idx] || {};
    const id = ids[idx] || 'CERT-XXXXXX';
    (async () => {
      await ensureFonts(fields, Object.values(row).join(''));
      if (dead || !canvasRef.current) return;
      const c = canvasRef.current;
      const w = Math.round(T.w * PK), h = Math.round(T.h * PK);
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      boxesRef.current = drawCert(c.getContext('2d'), img, T, PK, fields, row, id, sel);
    })();
    return () => { dead = true; };
  }, [img, T, PK, fields, rows, ids, idx, sel, tick]);

  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (!sel || ['input', 'textarea', 'select'].includes(tag)) return;
      const d = e.shiftKey ? 10 : 1;
      const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
      if (!m) return;
      e.preventDefault();
      setFields((fs) => fs.map((f) => (f.id === sel ? { ...f, x: f.x + m[0], y: f.y + m[1] } : f)));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sel]);

  const cur = fields.find((f) => f.id === sel);
  const upd = (patch, id = sel) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const num = (k) => (e) => upd({ [k]: Number(e.target.value) || 0 });

  const emailCol = headers.find((h) => /e-?mail/i.test(h));
  const stats = useMemo(() => {
    if (!emailCol) return null;
    const seen = new Set(); let bad = 0, dup = 0;
    for (const r of rows) {
      const e = String(r[emailCol] || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) bad++;
      else if (seen.has(e)) dup++;
      else seen.add(e);
    }
    return { bad, dup };
  }, [rows, emailCol]);

  async function onTemplate(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.type === 'application/pdf') { setMsg('PDF templates are not supported – export the page as PNG/JPG first.'); return; }
    const i = await loadImage(URL.createObjectURL(file));
    const r = i.naturalWidth / T.w;
    setFields((fs) => fs.map((f) => ({ ...f, x: Math.round(f.x * r), y: Math.round(f.y * r), w: Math.round(f.w * r), size: Math.round(f.size * r), minSize: Math.round(f.minSize * r), spacing: f.spacing * r })));
    setT({ w: i.naturalWidth, h: i.naturalHeight }); setImg(i); setMsg('');
  }

  function loadSheet(name) {
    const { XLSX, wb } = wbRef.current;
    const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false });
    const clean = data.map((r) => { const o = {}; for (const k in r) o[String(k).trim()] = typeof r[k] === 'string' ? r[k].trim() : r[k]; return o; });
    setRows(clean); setHeaders(clean[0] ? Object.keys(clean[0]) : []); setIdx(0); setSheet(name);
  }

  async function onData(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      wbRef.current = { XLSX, wb }; setSheets(wb.SheetNames); loadSheet(wb.SheetNames[0]); setMsg('');
    } catch (err) { setMsg('Could not read file: ' + err.message); }
  }

  async function onFont(e) {
    const file = e.target.files[0]; if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '');
    const ff = new FontFace(name, await file.arrayBuffer());
    await ff.load(); document.fonts.add(ff);
    setFonts((f) => (f.includes(name) ? f : [name, ...f]));
    if (cur) upd({ font: name });
    setTick((t) => t + 1);
  }

  const addField = (o = {}) => { const f = mk({ text: headers[0] ? `{{${headers[0]}}}` : 'Text', x: Math.round(T.w / 2), y: Math.round(T.h / 2), w: Math.round(T.w * 0.7), size: Math.round(T.w * 0.03), minSize: 12, ...o }); setFields((fs) => [...fs, f]); setSel(f.id); };
  const dupField = () => cur && addField({ ...cur, id: undefined, x: cur.x + 20, y: cur.y + 20 });
  const delField = () => { setFields((fs) => fs.filter((f) => f.id !== sel)); setSel(null); };

  const toT = (e) => { const r = canvasRef.current.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * T.w, y: ((e.clientY - r.top) / r.height) * T.h }; };
  const onDown = (e) => {
    const p = toT(e);
    const b = [...boxesRef.current].reverse().find((b) => p.x >= b.left && p.x <= b.left + b.w && p.y >= b.top && p.y <= b.top + b.h);
    if (b) { const f = fields.find((f) => f.id === b.id); setSel(b.id); drag.current = { id: b.id, dx: p.x - f.x, dy: p.y - f.y }; e.currentTarget.setPointerCapture(e.pointerId); }
    else setSel(null);
  };
  const onMove = (e) => { if (!drag.current) return; const p = toT(e); upd({ x: Math.round(p.x - drag.current.dx), y: Math.round(p.y - drag.current.dy) }, drag.current.id); };
  const onUp = () => { drag.current = null; };

  async function dl(kind, sample) {
    const XLSX = await import('xlsx');
    const src = sample || rows;
    if (!src.length) { setMsg('No data to download'); return; }
    const data = buildItems(src, sample ? genIds(src.length) : ids, opt.pattern, ext).map((it) => ({ ...it.r, certificate_id: it.id, file: it.file }));
    const ws = XLSX.utils.json_to_sheet(data);
    if (kind === 'csv') { save(new Blob(['\ufeff' + XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8' }), sample ? 'sample.csv' : 'data.csv'); return; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data'); if (!sample) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(emailAoa(mail)), 'Email');
    save(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), sample ? 'sample.xlsx' : 'data.xlsx');
  }

  function exportConfig() { save(new Blob([JSON.stringify({ T, fields }, null, 2)], { type: 'application/json' }), 'certflow-config.json'); }
  async function importConfig(e) {
    const file = e.target.files[0]; if (!file) return;
    try { const j = JSON.parse(await file.text()); if (j.fields) { setFields(j.fields.map((f) => ({ ...DEFAULT_FIELD, ...f }))); setSel(null); setMsg('Config loaded (use the same template size).'); } } catch { setMsg('Invalid config file'); }
  }

  async function downloadOne() {
    if (!img) return;
    const c = document.createElement('canvas'); c.width = T.w; c.height = T.h;
    const row = rows[idx] || {};
    await ensureFonts(fields, Object.values(row).join(''));
    drawCert(c.getContext('2d'), img, T, 1, fields, row, ids[idx], null);
    c.toBlob((b) => save(b, `certificate_${idx + 1}.png`), 'image/png');
  }

  async function generate() {
    if (!rows.length || !img || prog) return;
    if (!opt.pdf && !opt.png) { setMsg('Select PDF and/or PNG'); return; }
    setMsg('');
    try {
      const [{ default: JSZip }, { jsPDF }, XLSX] = await Promise.all([import('jszip'), import('jspdf'), import('xlsx')]);
      const k = opt.scale, W = Math.round(T.w * k), H = Math.round(T.h * k);
      await ensureFonts(fields, rows.map((r) => Object.values(r).join('')).join(''));
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const batch = Math.max(1, opt.batch | 0);
      for (let s = 0; s < items.length; s += batch) {
        const zip = new JSZip();
        for (let i = s; i < Math.min(s + batch, items.length); i++) {
          const it = items[i];
          drawCert(ctx, img, T, k, fields, it.r, it.id, null);
          if (opt.png) zip.file(it.name + '.png', await new Promise((res) => c.toBlob(res, 'image/png')));
          if (opt.pdf) {
            const pdf = new jsPDF({ orientation: W >= H ? 'l' : 'p', unit: 'px', format: [W, H], compress: true, hotfixes: ['px_scaling'] });
            pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
            zip.file(it.name + '.pdf', pdf.output('arraybuffer'));
          }
          setProg({ done: i + 1, total: items.length });
          if (i % 3 === 0) await sleep(0);
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        save(blob, `certificates_${String(s / batch + 1).padStart(2, '0')}.zip`);
        await sleep(500);
      }
      const list = items.map((it) => ({ ...it.r, certificate_id: it.id, file: it.file }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(list), 'Recipients');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(emailAoa(mail)), 'Email');
      save(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), 'manifest.xlsx');
      setMsg(`Done: ${items.length} certificates. Import manifest.xlsx into Google Sheets.`);
    } catch (err) { console.error(err); setMsg('Error: ' + err.message); }
    setProg(null);
  }

  const pct = prog ? Math.round((prog.done / prog.total) * 100) : 0;

  return (
    <div className="app">
      <aside className="side">
        <h1>CertFlow</h1>
        <div className="muted">Design, import data, export ZIP, email from Google Sheets</div>

        <h2>1 · Template</h2>
        <div className="card">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onTemplate} />
          <div className="muted">PNG/JPG. Default template is built-in. {T.w}×{T.h}px</div>
        </div>

        <h2>2 · Data (Excel / CSV)</h2>
        <div className="card">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onData} />
          {sheets.length > 1 && (
            <select value={sheet} onChange={(e) => loadSheet(e.target.value)}>{sheets.map((s) => <option key={s}>{s}</option>)}</select>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => dl('xlsx', SAMPLE_ROWS)}>Sample Excel</button>
            <button onClick={() => dl('csv', SAMPLE_ROWS)}>Sample CSV</button>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <button onClick={() => dl('xlsx')} disabled={!rows.length}>Download data .xlsx</button>
            <button onClick={() => dl('csv')} disabled={!rows.length}>Download data .csv</button>
          </div>
          <div className="muted">{rows.length} rows · columns: {headers.join(', ') || '—'}</div>
          {stats && (
            <div className={stats.bad || stats.dup ? 'warn' : 'ok'}>
              Emails ({emailCol}): {stats.bad} invalid, {stats.dup} duplicate
            </div>
          )}
        </div>

        <h2>3 · Fields</h2>
        <div className="card fieldlist">
          {fields.map((f) => (
            <button key={f.id} className={f.id === sel ? 'on' : ''} onClick={() => setSel(f.id)}>{f.text || '(empty)'}</button>
          ))}
          <div className="row">
            <button onClick={() => addField()}>+ Add</button>
            <button onClick={dupField} disabled={!cur}>Duplicate</button>
            <button className="danger" onClick={delField} disabled={!cur}>Delete</button>
          </div>
        </div>

        {cur && (
          <div className="card">
            <label>Text (use {'{{column}}'} and {'{{certificate_id}}'})</label>
            <textarea value={cur.text} onChange={(e) => upd({ text: e.target.value })} />
            <div className="chips">
              {[...headers, 'certificate_id'].map((h) => (
                <span key={h} className="chip" onClick={() => upd({ text: cur.text + `{{${h}}}` })}>{h}</span>
              ))}
            </div>
            <div className="grid2">
              <div><label>Font</label>
                <select value={cur.font} onChange={(e) => upd({ font: e.target.value })}>{fonts.map((f) => <option key={f}>{f}</option>)}</select></div>
              <div><label>Upload font (TTF/OTF/WOFF)</label><input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={onFont} /></div>
            </div>
            <div className="grid3">
              <div><label>Size</label><input type="number" value={cur.size} onChange={num('size')} /></div>
              <div><label>Min size</label><input type="number" value={cur.minSize} onChange={num('minSize')} /></div>
              <div><label>Max lines</label><input type="number" min="1" value={cur.maxLines} onChange={num('maxLines')} /></div>
            </div>
            <div className="grid3">
              <div><label>X</label><input type="number" value={cur.x} onChange={num('x')} /></div>
              <div><label>Y</label><input type="number" value={cur.y} onChange={num('y')} /></div>
              <div><label>Max width</label><input type="number" value={cur.w} onChange={num('w')} /></div>
            </div>
            <div className="grid3">
              <div><label>Color</label><input type="color" value={cur.color} onChange={(e) => upd({ color: e.target.value })} /></div>
              <div><label>Align (anchor)</label>
                <select value={cur.align} onChange={(e) => upd({ align: e.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
              <div><label>Spacing</label><input type="number" value={cur.spacing} onChange={num('spacing')} /></div>
            </div>
            <div className="grid3">
              <div><label>Weight</label>
                <select value={cur.weight} onChange={(e) => upd({ weight: Number(e.target.value) })}><option value="400">Normal</option><option value="700">Bold</option></select></div>
              <div><label>Transform</label>
                <select value={cur.transform} onChange={(e) => upd({ transform: e.target.value })}><option value="none">None</option><option value="upper">UPPER</option><option value="lower">lower</option><option value="title">Title</option></select></div>
              <div><label>Italic</label><input type="checkbox" checked={cur.italic} onChange={(e) => upd({ italic: e.target.checked })} /></div>
            </div>
          </div>
        )}
        <div className="row">
          <button onClick={exportConfig}>Save layout</button>
          <label style={{ margin: 0 }}><span className="muted">Load layout</span><input type="file" accept=".json" onChange={importConfig} /></label>
        </div>

        <h2>4 · Email</h2>
        <div className="card">
          <label>Subject</label>
          <input type="text" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
          <label>Message ({'{{name}}'}, {'{{email}}'}, {'{{certificate.pdf}}'}, any column · **bold** · [text](https://link))</label>
          <textarea style={{ minHeight: 120 }} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
          <div className="chips">
            {[...headers, 'certificate_id', 'certificate.pdf'].map((h) => (
              <span key={h} className="chip" onClick={() => setMail({ ...mail, body: mail.body + `{{${h}}}` })}>{h}</span>
            ))}
          </div>
          <div className="grid2">
            <div><label>Logo (https image URL or Drive file ID)</label><input type="text" value={mail.logo} onChange={(e) => setMail({ ...mail, logo: e.target.value })} /></div>
            <div><label>Accent color</label><input type="color" value={mail.accent} onChange={(e) => setMail({ ...mail, accent: e.target.value })} /></div>
          </div>
          <div className="grid2">
            <div><label>Footer</label><input type="text" value={mail.footer} onChange={(e) => setMail({ ...mail, footer: e.target.value })} /></div>
            <div><label>Sender name</label><input type="text" value={mail.sender} onChange={(e) => setMail({ ...mail, sender: e.target.value })} /></div>
          </div>
          <label>Preview (row {rows.length ? idx + 1 : 0}): {fillMail(mail.subject, mailRow)}</label>
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: mailHtml(mail, mailRow) }} />
          <div className="muted" style={{ marginTop: 6 }}>Saved into the "Email" sheet of the downloaded Excel. Apps Script reads it automatically.</div>
        </div>

        <h2>5 · Export</h2>
        <div className="card">
          <div className="row">
            <label><input type="checkbox" checked={opt.pdf} onChange={(e) => setOpt({ ...opt, pdf: e.target.checked })} /> PDF</label>
            <label><input type="checkbox" checked={opt.png} onChange={(e) => setOpt({ ...opt, png: e.target.checked })} /> PNG</label>
          </div>
          <div className="grid2">
            <div><label>Quality / size</label>
              <select value={opt.scale} onChange={(e) => setOpt({ ...opt, scale: Number(e.target.value) })}><option value="1">Full</option><option value="0.75">75%</option><option value="0.5">50%</option><option value="0.35">35% (small files)</option></select></div>
            <div><label>Certificates per ZIP</label><input type="number" min="1" value={opt.batch} onChange={(e) => setOpt({ ...opt, batch: Number(e.target.value) || 1 })} /></div>
          </div>
          <label>File name pattern</label>
          <input type="text" value={opt.pattern} onChange={(e) => setOpt({ ...opt, pattern: e.target.value })} />
          <div style={{ height: 8 }} />
          <button className="primary" style={{ width: '100%' }} disabled={!!prog || !rows.length} onClick={generate}>
            {prog ? `Generating ${prog.done}/${prog.total}…` : `Generate ${rows.length} certificates (ZIP)`}
          </button>
          {prog && <div className="bar" style={{ marginTop: 8 }}><div style={{ width: pct + '%' }} /></div>}
          {msg && <div className={msg.startsWith('Error') ? 'warn' : 'muted'} style={{ marginTop: 6 }}>{msg}</div>}
          <div className="muted" style={{ marginTop: 6 }}>Also downloads manifest.xlsx (data + certificate_id + file). Allow multiple downloads in your browser.</div>
        </div>
      </aside>

      <main className="main">
        <div className="nav">
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))}>◀</button>
          <span>Preview row {rows.length ? idx + 1 : 0} / {rows.length}</span>
          <button onClick={() => setIdx((i) => Math.min(rows.length - 1, i + 1))}>▶</button>
          <button onClick={downloadOne}>Download this PNG</button>
          <span className="muted" style={{ textAlign: 'left' }}>Drag text on the canvas · arrows nudge (Shift = 10px)</span>
        </div>
        <div className="stage">
          <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
        </div>
      </main>
    </div>
  );
}
