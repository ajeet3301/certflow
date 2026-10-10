/**
 * CertFlow – Google Sheets bulk certificate mailer (Apps Script)
 *
 * Sheet layout: row 1 = headers. Needs an "email" column.
 * Script adds columns: certificate_id, status, sent_at, error.
 *
 * MODE 'FOLDER': certificates were made in the CertFlow web app.
 *   1) Import manifest.xlsx into Google Sheets (has "file" + "certificate_id" columns).
 *   2) Unzip the ZIPs, upload all files into ONE Google Drive folder, put its ID below.
 * MODE 'SLIDES': build each PDF from a Google Slides template using {{header}} placeholders.
 *
 * Use: menu "Certificates" > "Send test to me" first, then "Send pending".
 * Re-running is safe: rows already marked SENT are skipped. Large lists auto-continue
 * via time triggers (script stops before the 6-min limit and resumes by itself).
 */
const CONFIG = {
  MODE: 'FOLDER',               // 'FOLDER' or 'SLIDES'
  FOLDER_ID: '',                // MODE FOLDER: Drive folder ID holding the certificate files
  FILE_COLUMN: 'file',          // MODE FOLDER: column with the file name (e.g. CERT-2026-ABC123.pdf)
  SLIDES_TEMPLATE_ID: '',       // MODE SLIDES: Google Slides file ID
  EMAIL_COLUMN: 'email',
  SUBJECT: 'Your certificate for {{course}}',
  // Any {{column}} works. {{certificate.pdf}} = certificate file name (and attaches the file).
  BODY: 'Hi {{name}},\n\nCongratulations! Your certificate {{certificate.pdf}} is attached.\nCertificate ID: {{certificate_id}}\n\nRegards,\nCertificates Team',
  ALWAYS_ATTACH: true,          // false = attach only if BODY contains {{certificate.pdf}}
  HTML: false,                  // true: BODY is HTML (values are escaped)
  SENDER_NAME: 'Certificates Team',
  REPLY_TO: '',
  SHEET_NAME: '',               // blank = first sheet
  MAX_RUNTIME_MS: 5 * 60 * 1000,
  PAUSE_MS: 200,
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Certificates')
    .addItem('Send pending', 'sendPending')
    .addItem('Send test to me (first row)', 'sendTest')
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
      if (!testOnly) {
        sh.getRange(rowNum, iStatus + 1).setValue('SENT');
        sh.getRange(rowNum, iSent + 1).setValue(new Date());
        sh.getRange(rowNum, iErr + 1).setValue('');
      }
    } catch (e) {
      failed++;
      if (!testOnly) {
        sh.getRange(rowNum, iStatus + 1).setValue('FAILED');
        sh.getRange(rowNum, iErr + 1).setValue(String(e.message || e).slice(0, 300));
      } else { throw e; }
    }
    if (testOnly) break;
    Utilities.sleep(CONFIG.PAUSE_MS);
  }

  if (more) scheduleNext_(quotaOut ? 60 * 60 * 1000 : 30 * 1000);
  SpreadsheetApp.getActive().toast(
    'Sent: ' + sent + ', failed: ' + failed + (quotaOut ? '. Daily mail quota reached – will retry hourly.' : more ? '. Continuing automatically…' : '. Finished.'),
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
  MailApp.sendEmail(to, (test ? '[TEST] ' : '') + fill_(CONFIG.SUBJECT, obj, false), fill_(CONFIG.BODY, obj, false), opts);
}

// file column -> <certificate_id>.pdf/png -> <name>.pdf/png (case-insensitive)
function findFile_(obj, files) {
  const c = [obj[CONFIG.FILE_COLUMN], obj.certificate_id + '.pdf', obj.certificate_id + '.png', obj.name + '.pdf', obj.name + '.png'];
  for (let i = 0; i < c.length; i++) if (c[i] && files[String(c[i]).toLowerCase()]) return String(c[i]);
  throw new Error('Certificate file not found in Drive folder for: ' + (obj[CONFIG.FILE_COLUMN] || obj.name || obj.certificate_id));
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

function indexFolder_() {
  const map = {};
  const it = DriveApp.getFolderById(CONFIG.FOLDER_ID).getFiles();
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
