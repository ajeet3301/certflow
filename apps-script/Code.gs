/**
 * CertFlow – Google Sheets bulk certificate mailer (Apps Script)
 *
 * Sheet layout: row 1 = headers. Needs an "email" column.
 * Script adds columns: certificate_id, status, sent_at, error.
 *
 * MODE 'FOLDER': certificates were made in the CertFlow web app.
 *   1) Import manifest.xlsx into Google Sheets (has "file" + "certificate_id" columns).
 *   2) Upload the certificates_*.zip files to the SAME Drive folder as this sheet (no unzipping).
 *   3) Menu Certificates > 1. Import certificate ZIPs (unzips, saves folder automatically).
 * MODE 'SLIDES': build each PDF from a Google Slides template using {{header}} placeholders.
 *
 * Use: menu "Certificates": 1 Import ZIPs, 2 Send test to me, 3 Send pending.
 * Re-running is safe: rows already marked SENT are skipped. Large lists auto-continue
 * via time triggers (script stops before the 6-min limit and resumes by itself).
 */
const CONFIG = {
  MODE: 'FOLDER',               // 'FOLDER' or 'SLIDES'
  FOLDER_ID: '',                // MODE FOLDER: leave blank – set automatically by "Import certificate ZIPs"
  ZIP_PREFIX: 'certificates',   // ZIPs from CertFlow: certificates_01.zip ... (put them next to this sheet in Drive)
  FILE_COLUMN: 'file',          // MODE FOLDER: column with the file name (e.g. CERT-2026-ABC123.pdf)
  SLIDES_TEMPLATE_ID: '',       // MODE SLIDES: Google Slides file ID
  EMAIL_COLUMN: 'email',
  SUBJECT: 'Your certificate for {{course}}',
  // Any {{column}} works. {{certificate.pdf}} = certificate file name (and attaches the file).
  BODY: 'Hi {{name}},\n\nCongratulations! Your certificate {{certificate.pdf}} is attached.\nCertificate ID: {{certificate_id}}\n\nRegards,\nCertificates Team',
  ALWAYS_ATTACH: true,          // false = attach only if BODY contains {{certificate.pdf}}
  HTML: false,                  // true: BODY is raw HTML (values escaped). false: styled email from BODY
  LOGO: '',                     // https image URL, or Google Drive file ID/link (shown on top)
  ACCENT: '#2748d8',            // accent color (top bar, links)
  FOOTER: '',                   // small text at bottom, placeholders allowed
  // A sheet named "Email" (key | value: SUBJECT, BODY, LOGO, ACCENT, FOOTER, SENDER_NAME, REPLY_TO,
  // MODE, SLIDES_TEMPLATE_ID, ALWAYS_ATTACH) overrides the values above.
  // The CertFlow website writes it into the Excel download, so you rarely edit this file.
  SENDER_NAME: 'Certificates Team',
  REPLY_TO: '',
  SHEET_NAME: '',               // blank = first sheet
  MAX_RUNTIME_MS: 5 * 60 * 1000,
  PAUSE_MS: 200,
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Certificates')
    .addItem('1. Import certificate ZIPs', 'importZips')
    .addItem('2. Send test to me (first row)', 'sendTest')
    .addItem('3. Send pending', 'sendPending')
    .addItem('Stop auto-continue', 'clearTriggers')
    .addItem('Reset status column', 'resetStatus')
    .addToUi();
}

function sendPending() { run_(false); }
function sendTest() { run_(true); }

function getSheet_() {
  const ss = SpreadsheetApp.getActive();
  return CONFIG.SHEET_NAME ? ss.getSheetByName(CONFIG.SHEET_NAME) : ss.getSheets()[0];
}

function ensureCols_(sh, names) {
  const headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (s) { return String(s).trim(); });
  names.forEach(function (n) {
    if (headers.indexOf(n) < 0) { sh.getRange(1, headers.length + 1).setValue(n); headers.push(n); }
  });
  return headers;
}

function run_(testOnly) {
  const start = Date.now();
  clearTriggers();
  loadSheetConfig_();
  const sh = getSheet_();
  const headers = ensureCols_(sh, ['certificate_id', 'status', 'sent_at', 'error']);
  const last = sh.getLastRow();
  if (last < 2) return;
  const data = sh.getRange(2, 1, last - 1, headers.length).getDisplayValues();
  let iEmail = headers.indexOf(CONFIG.EMAIL_COLUMN);
  if (iEmail < 0) iEmail = headers.findIndex(function (h) { return /e-?mail/i.test(h); });
  const iId = headers.indexOf('certificate_id');
  const iStatus = headers.indexOf('status');
  const iSent = headers.indexOf('sent_at');
  const iErr = headers.indexOf('error');
  if (iEmail < 0) throw new Error('No email column found');

  const files = CONFIG.MODE === 'FOLDER' ? indexFolder_() : null;
  const me = Session.getEffectiveUser().getEmail();
  let quota = MailApp.getRemainingDailyQuota();
  let sent = 0, failed = 0, more = false, quotaOut = false;
  const missing = [], errors = [];

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const st = String(row[iStatus]).toUpperCase();
    if (!testOnly && (st === 'SENT' || st === 'SKIP')) continue;
    if (Date.now() - start > CONFIG.MAX_RUNTIME_MS) { more = true; break; }
    if (quota <= 0) { quotaOut = true; more = true; break; }

    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    const rowNum = r + 2;
    try {
      if (!obj.certificate_id) {
        obj.certificate_id = 'CERT-' + new Date().getFullYear() + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
        if (!testOnly) sh.getRange(rowNum, iId + 1).setValue(obj.certificate_id);
      }
      const to = testOnly ? me : String(row[iEmail]).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Invalid email: ' + to);
      sendOne_(obj, files, to, testOnly);
      quota--; sent++;
      console.log('SENT | row ' + rowNum + ' | ' + to + ' | ' + obj.certificate_id + ' | ' + obj['certificate.pdf']);
      if (!testOnly) {
        sh.getRange(rowNum, iStatus + 1).setValue('SENT');
        sh.getRange(rowNum, iSent + 1).setValue(new Date());
        sh.getRange(rowNum, iErr + 1).setValue('');
      }
    } catch (e) {
      failed++;
      const em = String(e.message || e), who = String(row[iEmail]).trim();
      if (/Certificate file not found|No file name/.test(em)) { missing.push(who); console.warn('NO CERTIFICATE | row ' + rowNum + ' | ' + who + ' | ' + em); }
      else { errors.push(who); console.error('FAILED | row ' + rowNum + ' | ' + who + ' | ' + em); }
      if (!testOnly) {
        sh.getRange(rowNum, iStatus + 1).setValue('FAILED');
        sh.getRange(rowNum, iErr + 1).setValue(String(e.message || e).slice(0, 300));
      } else { throw e; }
    }
    if (testOnly) break;
    Utilities.sleep(CONFIG.PAUSE_MS);
  }

  console.log('SUMMARY | sent: ' + sent + ' | no certificate: ' + missing.length + ' | other errors: ' + errors.length);
  if (missing.length) console.warn('NO CERTIFICATE for: ' + missing.join(', '));
  if (errors.length) console.error('FAILED (other) for: ' + errors.join(', '));
  if (more) scheduleNext_(quotaOut ? 60 * 60 * 1000 : 30 * 1000);
  SpreadsheetApp.getActive().toast(
    'Sent: ' + sent + ', no certificate: ' + missing.length + ', other failed: ' + errors.length + (quotaOut ? '. Daily mail quota reached – will retry hourly.' : more ? '. Continuing automatically…' : '. Finished.'),
    'Certificates', 10);
}

function sendOne_(obj, files, to, test) {
  let blob;
  if (CONFIG.MODE === 'FOLDER') {
    const fn = findFile_(obj, files);
    blob = DriveApp.getFileById(files[fn.toLowerCase()]).getBlob();
    obj['certificate.pdf'] = obj['certificate.png'] = fn;
  } else {
    blob = slidesToPdf_(obj);
    obj['certificate.pdf'] = blob.getName();
  }
  const opts = { name: CONFIG.SENDER_NAME };
  if (CONFIG.ALWAYS_ATTACH || /\{\{\s*certificate\./.test(CONFIG.BODY)) opts.attachments = [blob];
  if (CONFIG.REPLY_TO) opts.replyTo = CONFIG.REPLY_TO;
  if (CONFIG.HTML) opts.htmlBody = fill_(CONFIG.BODY, obj, true);
  else opts.htmlBody = renderHtml_(obj, opts);
  MailApp.sendEmail(to, (test ? '[TEST] ' : '') + fill_(CONFIG.SUBJECT, obj, false), fill_(CONFIG.BODY, obj, false), opts);
}

// file column -> <certificate_id>.pdf/png -> <name>.pdf/png (case-insensitive)
function findFile_(obj, files) {
  const c = [obj[CONFIG.FILE_COLUMN], obj.certificate_id + '.pdf', obj.certificate_id + '.png', obj.name + '.pdf', obj.name + '.png'];
  for (let i = 0; i < c.length; i++) if (c[i] && files[String(c[i]).toLowerCase()]) return String(c[i]);
  throw new Error('Certificate file not found in Drive folder for: ' + (obj[CONFIG.FILE_COLUMN] || obj.name || obj.certificate_id));
}

function loadSheetConfig_() {
  const s = SpreadsheetApp.getActive().getSheetByName('Email');
  if (!s || s.getLastRow() < 1) return;
  const keys = ['SUBJECT', 'BODY', 'LOGO', 'ACCENT', 'FOOTER', 'SENDER_NAME', 'REPLY_TO', 'MODE', 'SLIDES_TEMPLATE_ID', 'ALWAYS_ATTACH'];
  s.getRange(1, 1, s.getLastRow(), 2).getValues().forEach(function (r) {
    const k = String(r[0]).trim().toUpperCase();
    if (keys.indexOf(k) < 0) return;
    const v = String(r[1]);
    if (k === 'ALWAYS_ATTACH') CONFIG[k] = !/^(false|no|0)$/i.test(v.trim());
    else if (v !== '') CONFIG[k] = (k === 'BODY' || k === 'FOOTER') ? v : v.trim();
  });
}

function esc_(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// text -> html: **bold**, [text](https://url), line breaks. Values are escaped.
function fmt_(t, obj) {
  const ac = /^#[0-9a-f]{3,8}$/i.test(CONFIG.ACCENT) ? CONFIG.ACCENT : '#2748d8';
  return esc_(fill_(t, obj, false))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" style="color:' + ac + '">$1</a>')
    .replace(/\n/g, '<br>');
}

function renderHtml_(obj, opts) {
  const ac = /^#[0-9a-f]{3,8}$/i.test(CONFIG.ACCENT) ? CONFIG.ACCENT : '#2748d8';
  let logo = '';
  const L = String(CONFIG.LOGO || '').trim();
  if (/^https:\/\//.test(L)) {
    logo = '<img src="' + esc_(L) + '" alt="" style="max-height:56px;margin-bottom:20px"><br>';
  } else if (L) {
    const m = L.match(/[-\w]{25,}/);
    if (m) {
      opts.inlineImages = { logo: DriveApp.getFileById(m[0]).getBlob() };
      logo = '<img src="cid:logo" alt="" style="max-height:56px;margin-bottom:20px"><br>';
    }
  }
  const foot = CONFIG.FOOTER ? '<div style="margin-top:24px;font-size:12px;color:#78716c">' + fmt_(CONFIG.FOOTER, obj) + '</div>' : '';
  return '<div style="background:#f5f5f4;padding:20px"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;border-top:4px solid ' + ac +
    ';padding:24px;font:15px/1.6 Arial,sans-serif;color:#1c1917">' + logo + fmt_(CONFIG.BODY, obj) + foot + '</div></div>';
}

function slidesToPdf_(obj) {
  const copy = DriveApp.getFileById(CONFIG.SLIDES_TEMPLATE_ID).makeCopy('tmp_' + obj.certificate_id);
  try {
    const pres = SlidesApp.openById(copy.getId());
    Object.keys(obj).forEach(function (k) { pres.replaceAllText('{{' + k + '}}', String(obj[k])); });
    pres.saveAndClose();
    return DriveApp.getFileById(copy.getId()).getAs(MimeType.PDF).setName(obj.certificate_id + '.pdf');
  } finally {
    copy.setTrashed(true);
  }
}

function folderId_() {
  return CONFIG.FOLDER_ID || PropertiesService.getDocumentProperties().getProperty('FOLDER_ID') || '';
}

// Finds certificates_*.zip in the same Drive folder as this sheet, unzips them into
// a "<sheet name> certificates" folder and remembers it. Safe to re-run (skips existing files).
function importZips() {
  const start = Date.now();
  const ss = SpreadsheetApp.getActive();
  const parents = DriveApp.getFileById(ss.getId()).getParents();
  const home = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const props = PropertiesService.getDocumentProperties();
  const name = ss.getName() + ' certificates';
  let out;
  const id = folderId_();
  if (id) { out = DriveApp.getFolderById(id); }
  else {
    const f = home.getFoldersByName(name);
    out = f.hasNext() ? f.next() : home.createFolder(name);
  }
  props.setProperty('FOLDER_ID', out.getId());
  const have = {};
  const ex = out.getFiles();
  while (ex.hasNext()) have[ex.next().getName().toLowerCase()] = true;

  let zips = 0, added = 0, partial = false;
  const it = home.getFiles();
  while (it.hasNext() && !partial) {
    const z = it.next();
    const n = z.getName();
    if (!/\.zip$/i.test(n) || n.toLowerCase().indexOf(CONFIG.ZIP_PREFIX) !== 0) continue;
    zips++;
    const blobs = Utilities.unzip(z.getBlob().setContentType('application/zip'));
    for (let i = 0; i < blobs.length; i++) {
      if (Date.now() - start > CONFIG.MAX_RUNTIME_MS) { partial = true; break; }
      const b = blobs[i], fn = b.getName().split('/').pop();
      if (!fn || have[fn.toLowerCase()]) continue;
      out.createFile(b.setName(fn)); have[fn.toLowerCase()] = true; added++;
    }
  }
  ss.toast(zips ? ('Imported ' + added + ' files from ' + zips + ' ZIP(s)' + (partial ? '. Time limit – run again to continue.' : '. Ready: send test, then send pending.')) :
    'No "' + CONFIG.ZIP_PREFIX + '*.zip" found. Upload the ZIPs to the same Drive folder as this sheet.', 'Certificates', 10);
}

function indexFolder_() {
  if (!folderId_()) throw new Error('No certificate folder yet. Run Certificates > Import certificate ZIPs first.');
  const map = {};
  const it = DriveApp.getFolderById(folderId_()).getFiles();
  while (it.hasNext()) { const f = it.next(); map[f.getName().toLowerCase()] = f.getId(); }
  return map;
}

function fill_(tpl, obj, html) {
  return String(tpl).replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (m, k) {
    const v = obj[k] !== undefined ? String(obj[k]) : '';
    return html ? v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : v;
  });
}

function scheduleNext_(ms) {
  ScriptApp.newTrigger('sendPending').timeBased().after(ms).create();
}

function clearTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendPending') ScriptApp.deleteTrigger(t);
  });
}

function resetStatus() {
  const sh = getSheet_();
  const headers = ensureCols_(sh, ['certificate_id', 'status', 'sent_at', 'error']);
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  [headers.indexOf('status'), headers.indexOf('sent_at'), headers.indexOf('error')].forEach(function (i) {
    sh.getRange(2, i + 1, n, 1).clearContent();
  });
}
