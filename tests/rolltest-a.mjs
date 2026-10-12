import { firefox } from "playwright";
import fs from "fs";
const dir = process.argv[2];
const scenarios = JSON.parse(process.argv[3] || "null") || [
  { name: "addon100", fs: 21.33, pct: 100, center: false },
  { name: "addon200", fs: 21.33, pct: 200, center: false },
  { name: "addon300", fs: 21.33, pct: 300, center: false },
  { name: "addon100+center", fs: 21.33, pct: 100, center: true },
  { name: "addon300+center", fs: 21.33, pct: 300, center: true },
  { name: "yt300(1.75x)+center", fs: 21.33 * 1.75, pct: 100, center: true },
  { name: "yt300(1.75x)", fs: 21.33 * 1.75, pct: 100, center: false },
  { name: "pos3 addon300+center", fs: 21.33, pct: 300, center: true, capPos: 3 },
  { name: "pos5 addon200", fs: 21.33, pct: 200, center: false, capPos: 5 },
  { name: "pos6 addon200", fs: 21.33, pct: 200, center: false, capPos: 6 },
  { name: "pos8 addon300", fs: 21.33, pct: 300, center: false, capPos: 8 },
  { name: "pos10 yt300+center", fs: 21.33 * 1.75, pct: 100, center: true, capPos: 10 },
];
const browser = await firefox.launch({ headless: true });
const out = [];
for (const sc of scenarios) {
  const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
  await page.addInitScript({ content: "window.__cfg=" + JSON.stringify({ fs: sc.fs }) + ";window.__initialStore=" + JSON.stringify({ settingsRev: 1, androidRev: 1, enabled: true, mode: "invert", fontPct: sc.pct, center: sc.center, capPos: sc.capPos || 1 }) + ";" + fs.readFileSync("./stub.js", "utf8") });
  await page.goto("./rollup.html");
  await page.addStyleTag({ content: fs.readFileSync(dir + "/invert.css", "utf8") });
  await page.addScriptTag({ content: fs.readFileSync(dir + "/content.js", "utf8") });
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => runRollup({ long: true, keep: 99 }));
  // metrics: a persisting line should only ever move up, smoothly (YouTube: 433ms transition); no instant jumps, no moving down.
  let downMoves = 0, jumps = 0, maxJump = 0, maxVisible = 0, lineH = 0;
  const prev = new Map();
  for (const f of frames) for (const l of f.lines) lineH = Math.max(lineH, l.bottom - l.top);
  for (const f of frames) {
    const vis = f.lines.filter((l) => f.clip !== "hidden" || (l.bottom > f.win.top + 2 && l.top < f.win.bottom - 2));
    maxVisible = Math.max(maxVisible, vis.length);
    for (const l of vis) {
      if (prev.has(l.t)) { const d = l.top - prev.get(l.t); if (d > 1) downMoves++; if (Math.abs(d) > lineH * 0.3) { jumps++; maxJump = Math.max(maxJump, Math.abs(d)); } }
    }
    prev.clear(); vis.forEach((l) => prev.set(l.t, l.top));
  }
  const segFs = await page.evaluate(() => getComputedStyle(document.querySelector(".ytp-caption-segment")).fontSize);
  const lastF = frames[frames.length - 1];
  const vis = lastF.lines.filter((l) => lastF.clip !== "hidden" || (l.bottom > lastF.win.top + 2 && l.top < lastF.win.bottom - 2));
  const lastLine = lastF.lines[lastF.lines.length - 1];
  out.push({ scenario: sc.name, font: segFs, lineH: +lineH.toFixed(0), downMoves, jumps, maxJumpPx: +maxJump.toFixed(0), maxVisibleLines: maxVisible, endVisible: vis.map((l) => l.t.split(":")[0]).join(","), lastLineFullyShown: lastF.clip !== "hidden" || (lastLine.bottom <= lastF.win.bottom + 1 && lastLine.top >= lastF.win.top - 1), winW: +(lastF.win.right - lastF.win.left).toFixed(0), winTopPct: +(lastF.win.top / 4.8).toFixed(1), winBottomPct: +(100 - lastF.win.bottom / 4.8).toFixed(1), inPlayer: lastF.win.left >= -1 && lastF.win.right <= 855 && lastF.win.top >= -1 && lastF.win.bottom <= 481 });
  await page.close();
}
console.table(out);
await browser.close();
