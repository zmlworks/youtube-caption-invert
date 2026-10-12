import { firefox } from "playwright";
import fs from "fs";
const [dir, fsz, pct, center] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5] === "1"];
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
await page.addInitScript({ content: "window.__cfg=" + JSON.stringify({ fs: fsz }) + ";window.__initialStore=" + JSON.stringify({ settingsRev: 1, enabled: true, mode: "invert", fontPct: pct, center }) + ";" + fs.readFileSync("./stub.js", "utf8") });
await page.goto("./rollup.html");
await page.addStyleTag({ content: fs.readFileSync(dir + "/invert.css", "utf8") });
await page.addScriptTag({ content: fs.readFileSync(dir + "/content.js", "utf8") });
await page.waitForTimeout(300);
const frames = await page.evaluate(() => runRollup({ words: 14, long: true, keep: 99 }));
const t0 = frames[0].ts;
let last = "";
for (const f of frames) {
  const vis = f.lines.filter((l) => f.clip !== "hidden" || (l.bottom > f.win.top + 1 && l.top < f.win.bottom - 1));
  const s = `win[${f.win.top.toFixed(0)}-${f.win.bottom.toFixed(0)} ${f.clip}] ` + vis.map((l) => l.t + "@" + l.top.toFixed(0)).join(" ");
  if (s !== last) console.log(((f.ts - t0) | 0).toString().padStart(5), s);
  last = s;
}
await browser.close();
