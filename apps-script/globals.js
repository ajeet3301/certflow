:root{--bg:#fafaf9;--panel:#fff;--stage:#efeeec;--ink:#1c1917;--sub:#78716c;--line:#e7e5e4;--accent:#2748d8;--accent-ink:#fff;--warn:#b45309;--ok:#15803d;--bad:#b91c1c}
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 "DM Sans",system-ui,sans-serif;background:var(--bg);color:var(--ink)}
.app{display:grid;grid-template-columns:360px 1fr;height:100vh}
.side{overflow:auto;padding:20px;background:var(--panel);border-right:1px solid var(--line)}
.main{overflow:auto;padding:20px;display:flex;flex-direction:column;gap:12px;background:var(--stage)}
h1{font-size:20px;font-weight:700;letter-spacing:-.01em;margin:0}
h2{font-size:13px;font-weight:700;margin:24px 0 8px}
.card{border:1px solid var(--line);border-radius:6px;padding:12px;margin-bottom:8px}
label{display:block;font-size:12px;color:var(--sub);margin:8px 0 2px}
input,select,textarea,button{font:inherit;color:inherit}
input[type=text],input[type=number],select,textarea{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:6px 8px}
input[type=file]{width:100%;font-size:12px}
input[type=color]{width:100%;height:32px;background:none;border:1px solid var(--line);border-radius:6px;padding:2px}
textarea{resize:vertical;min-height:54px}
button{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:6px 12px;cursor:pointer}
button:hover:not(:disabled){border-color:var(--sub)}
button:disabled{opacity:.45;cursor:not-allowed}
button.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:600;padding:9px 12px}
button.primary:hover:not(:disabled){background:#1e3bb5;border-color:#1e3bb5}
button.danger{color:var(--bad)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.row{display:flex;gap:6px;align-items:flex-end}
.row>*{flex:1}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.chip{border:1px solid var(--line);border-radius:999px;padding:1px 9px;font-size:12px;cursor:pointer}
.chip:hover{border-color:var(--accent);color:var(--accent)}
.fieldlist button{width:100%;text-align:left;margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.fieldlist button.on{border-color:var(--accent);box-shadow:inset 3px 0 0 var(--accent)}
.stage{display:flex;justify-content:center}
canvas{max-width:100%;height:auto;touch-action:none;cursor:move;background:#fff;border:1px solid var(--line)}
.bar{height:6px;background:var(--line);border-radius:3px;overflow:hidden}
.bar>div{height:100%;background:var(--accent);transition:width .1s}
.muted{color:var(--sub);font-size:12px}
.warn{color:var(--warn)}
.ok{color:var(--ok)}
.nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nav span{min-width:130px;text-align:center}
@media(max-width:900px){.app{grid-template-columns:1fr;height:auto}.side{border-right:0;border-bottom:1px solid var(--line)}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
