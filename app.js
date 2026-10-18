const KEY_DB = 'archiviopersonal_os_v1';
let state = JSON.parse(localStorage.getItem(KEY_DB) || '{"boxes":[],"warranties":[]}');

function saveState() {
  localStorage.setItem(KEY_DB, JSON.stringify(state));
  renderAll();
}

function showTab(tab) {
  ['box', 'war', 'src'].forEach((t) => {
    document.getElementById('sec-' + t).hidden = (t !== tab);
    document.getElementById('t-' + t).classList.toggle('active', t === tab);
  });
}

function addBox() {
  const code = document.getElementById('box-code').value.trim() || ('ARC-' + (state.boxes.length + 1));
  const name = document.getElementById('box-name').value.trim();
  const loc = document.getElementById('box-loc').value.trim();
  const tag = document.getElementById('box-tag').value.trim();
  const items = document.getElementById('box-items').value.trim();
  if (!name) return alert('Inserisci un nome per il contenitore o faldone.');
  state.boxes.unshift({ id: Date.now(), code, name, loc, tag, items, createdAt: new Date().toLocaleDateString('it-IT') });
  ['box-code', 'box-name', 'box-loc', 'box-tag', 'box-items'].forEach((id) => document.getElementById(id).value = '');
  saveState();
}

function deleteBox(id) {
  state.boxes = state.boxes.filter((b) => b.id !== id);
  saveState();
}

function printLabel(id) {
  const b = state.boxes.find((x) => x.id === id);
  if (!b) return;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Etichetta ${b.code}</title>
    <style>body{font-family:sans-serif;padding:24px} .lbl{border:4px solid #000;padding:20px;max-width:420px;border-radius:10px} h1{margin:0;font-size:38px;border-bottom:2px solid #000;padding-bottom:8px}</style>
    </head><body onload="window.print()"><div class="lbl">
    <h1>[${b.code}]</h1><h2>${b.name}</h2>
    <p><strong>Posizione:</strong> ${b.loc || '-'}</p>
    <p><strong>Contenuto:</strong><br>${(b.items || '').replace(/\n/g, '<br>')}</p>
    <small>ArchivioPersonal OS — ${b.createdAt}</small></div></body></html>`);
  win.document.close();
}

function scanBinarizeImage(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const maxW = 700;
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        const v = gray > 138 ? 255 : Math.max(0, gray * 0.5);
        d[i] = d[i+1] = d[i+2] = v;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.src = URL.createObjectURL(file);
  });
}

async function addWarranty() {
  const name = document.getElementById('w-name').value.trim();
  const shop = document.getElementById('w-shop').value.trim();
  const dateStr = document.getElementById('w-date').value;
  const months = parseInt(document.getElementById('w-months').value || '24', 10);
  const file = document.getElementById('w-photo').files[0];
  if (!name || !dateStr) return alert('Inserisci prodotto e data di acquisto.');

  const exp = new Date(dateStr);
  exp.setMonth(exp.getMonth() + months);
  const photo = await scanBinarizeImage(file);

  state.warranties.unshift({
    id: Date.now(), name, shop, dateStr, months,
    expiresAt: exp.toISOString().slice(0, 10), photo
  });
  document.getElementById('w-name').value = '';
  document.getElementById('w-shop').value = '';
  document.getElementById('w-photo').value = '';
  saveState();
}

function deleteWarranty(id) {
  state.warranties = state.warranties.filter((w) => w.id !== id);
  saveState();
}

function downloadIcs(id) {
  const w = state.warranties.find((x) => x.id === id);
  if (!w) return;
  const dt = w.expiresAt.replace(/-/g, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:' + dt, 'DTEND;VALUE=DATE:' + dt,
    'SUMMARY:Scadenza Garanzia - ' + w.name,
    'DESCRIPTION:Acquistato presso ' + (w.shop || '-') + ' il ' + w.dateStr,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scadenza-' + w.name.replace(/\s+/g, '-') + '.ics';
  a.click();
}

function renderAll() {
  const boxList = document.getElementById('box-list');
  boxList.innerHTML = state.boxes.length === 0 ? '<p>Nessuna unità registrata.</p>' : state.boxes.map((b) => `
    <div class="item-card">
      <div>
        <span class="tag">${b.code}</span><span class="tag">${b.loc || 'Posizione N/D'}</span>
        <h3 style="margin:6px 0">${b.name}</h3>
        <p style="margin:4px 0;color:#cbd5e1;white-space:pre-line">${b.items}</p>
      </div>
      <div>
        <button class="btn secondary" onclick="printLabel(${b.id})">🖨️ Stampa Etichetta</button>
        <button class="btn danger" onclick="deleteBox(${b.id})">🗑️</button>
      </div>
    </div>`).join('');

  const today = new Date().toISOString().slice(0, 10);
  const wList = document.getElementById('w-list');
  wList.innerHTML = state.warranties.length === 0 ? '<p>Nessuno scontrino o scadenza registrata.</p>' : state.warranties.map((w) => {
    const expired = w.expiresAt < today;
    return `<div class="item-card">
      <div>
        <span class="tag" style="background:${expired ? '#ef4444' : '#10b981'};color:#000;font-weight:700">${expired ? 'SCADUTA' : 'ATTIVA fino al ' + w.expiresAt}</span>
        <h3 style="margin:6px 0">${w.name} (${w.shop || '-'})</h3>
        <small>Data acquisto: ${w.dateStr} • Durata: ${w.months} mesi</small>
        ${w.photo ? `<br><img src="${w.photo}" style="max-width:180px;margin-top:8px;border-radius:6px;border:1px solid #475569"/>` : ''}
      </div>
      <div>
        <button class="btn secondary" onclick="downloadIcs(${w.id})">📅 Promemoria .ICS</button>
        <button class="btn danger" onclick="deleteWarranty(${w.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function runSearch() {
  const q = document.getElementById('q-search').value.toLowerCase().trim();
  const out = document.getElementById('search-results');
  if (!q) { out.innerHTML = ''; return; }
  const bMatches = state.boxes.filter((b) => [b.code, b.name, b.loc, b.tag, b.items].join(' ').toLowerCase().includes(q));
  const wMatches = state.warranties.filter((w) => [w.name, w.shop].join(' ').toLowerCase().includes(q));
  out.innerHTML = [
    ...bMatches.map((b) => `<div class="item-card"><div><strong>📦 Trovato in [${b.code}] ${b.name}</strong> (${b.loc})<br><small>${b.items}</small></div></div>`),
    ...wMatches.map((w) => `<div class="item-card"><div><strong>🧾 Scontrino: ${w.name}</strong> — Scadenza: ${w.expiresAt}</div></div>`)
  ].join('') || '<p>Nessuna corrispondenza trovata.</p>';
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'archiviopersonal-os-backup.json';
  a.click();
}

function exportCsv() {
  const rows = [['Codice', 'Nome', 'Posizione', 'Tag', 'Contenuto']];
  state.boxes.forEach((b) => rows.push([b.code, b.name, b.loc, b.tag, (b.items || '').replace(/\n/g, ' | ')]));
  const csv = rows.map((r) => r.map((c) => '"' + String(c || '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'archiviopersonal-inventario.csv';
  a.click();
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try { state = JSON.parse(r.result); saveState(); alert('Backup ripristinato con successo!'); }
    catch { alert('File JSON non valido.'); }
  };
  r.readAsText(file);
}

document.getElementById('w-date').valueAsDate = new Date();
renderAll();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js');
