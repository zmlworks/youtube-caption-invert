import { firefox } from "playwright";
import fs from "fs";
const dir = process.argv[2];
const b = await firefox.launch(); const out = [];
for (const sc of [{ start: 4, pct: 200 }, { start: 8, pct: 300 }, { start: 2, pct: 100 }]) {
  const p = await b.newPage({ viewport: { width: 854, height: 480 } });
  await p.addInitScript({ content: "window.__cfg={fs:21.33};window.__initialStore=" + JSON.stringify({ settingsRev: 1, androidRev: 1, enabled: true, mode: "stroke", fontPct: sc.pct, center: true, capPos: sc.start }) + ";" + fs.readFileSync("stub.js","utf8") });
  await p.goto("./rollup.html");
  await p.addStyleTag({ content: fs.readFileSync(dir + "/invert.css","utf8") });
  await p.addScriptTag({ content: fs.readFileSync(dir + "/content.js","utf8") });
  await p.waitForTimeout(300);
  // mid-rollup: same apply() path as the tap's height step (capPos -> 1)
  const frames = await p.evaluate(async () => { const pr = runRollup({ long: true, keep: 99 }); setTimeout(() => { window.__switchAt = performance.now(); chrome.storage.local.set({ capPos: 1 }); }, 1500); const f = await pr; return f.map(x => ({ ...x, sw: x.ts >= window.__switchAt })); });
  let downFrames = 0, downOther = 0, prev = new Map(), swSeen = false, lineH = 0;
  for (const f of frames) for (const l of f.lines) lineH = Math.max(lineH, l.bottom - l.top);
  for (const f of frames) {
    let down = false;
    for (const l of f.lines) if (prev.has(l.t) && l.top - prev.get(l.t) > 1) down = true;
    if (down) { if (f.sw && !swSeen) downFrames++; else downOther++; }
    if (f.sw) swSeen = true;
    prev.clear(); f.lines.forEach(l => prev.set(l.t, l.top));
  }
  const last = frames[frames.length - 1];
  out.push({ start: sc.start, pct: sc.pct, frames: frames.length, downAtSwitch: downFrames, downElsewhere: downOther, endBottomPct: +(100 - last.win.bottom / 4.8).toFixed(1) });
  await p.close();
}
console.table(out); await b.close();
