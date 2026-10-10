# CertFlow

Bulk certificate generator. Runs fully in the browser (no database, no env vars) + Google Apps Script mailer.

## Flow
1. Open the site → upload template image (or use built-in) → drag/customize text fields (`{{column}}` placeholders, fonts, size, auto-shrink, colors, custom font upload).
2. Upload Excel/CSV (`name,email,course,date` – any columns work).
3. **Generate** → ZIP(s) of PDF/PNG + `manifest.xlsx` (your rows + `certificate_id` + `file`).
4. Email at scale with Google Sheets (below).

## Deploy (GitHub → Vercel)
1. Create a new GitHub repo. Unzip this project, then on the repo page: **Add file → Upload files** → drag ALL contents (incl. `app/`, `apps-script/`) → Commit.
   (Or: `git init && git add . && git commit -m init && git remote add origin <url> && git push -u origin main`)
2. Vercel → **Add New → Project** → import the repo → Framework auto-detects **Next.js** → Deploy. No env vars needed.

Local: `npm install && npm run dev`

## Send emails from Google Sheets (Apps Script)
**Mode FOLDER (recommended – uses your customized certificates)**
1. Google Sheets → File → Import → upload `manifest.xlsx` → *Replace current sheet*.
2. Unzip the generated ZIPs; upload all files into one Drive folder; copy folder ID (URL after `/folders/`).
3. Sheet → Extensions → Apps Script → paste `apps-script/Code.gs`. Set `FOLDER_ID`, `SUBJECT`, `BODY`. Save.
4. Reload sheet → menu **Certificates → Send test to me** (authorize on first run) → then **Send pending**.

**Mode SLIDES**: set `MODE:'SLIDES'` + `SLIDES_TEMPLATE_ID`; put `{{name}}`, `{{course}}` … in the Slides template; no web app needed.

Notes
- Resumes automatically (time triggers) when the 6-min script limit or daily mail quota is hit; re-running skips SENT rows. Status/errors are written in the sheet.
- Daily quota: free Gmail ≈ 100 recipients/day, Workspace ≈ 1,500 (check Google's current limits). Use a Workspace account for large batches.
- Only send to people who expect the email.

## Browser limits
Generation runs on the user's device. For 10k+ rows keep "Certificates per ZIP" ≈ 200 and use 50–75% size to keep files small. Chrome/Edge recommended; allow multiple downloads.
