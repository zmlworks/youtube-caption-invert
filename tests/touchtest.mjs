import { chromium, devices } from "playwright";
import fs from "fs";
const dir = process.argv[2];
const b = await chromium.launch();
async function setup(store) {
  const ctx = await b.newContext({ ...devices["Pixel 7"] });
  const p = await ctx.newPage(); p.on("pageerror", e => console.log("ERR", e.message));
  await p.addInitScript({ content: "window.__initialStore=" + JSON.stringify(store) + ";" + fs.readFileSync("stub.js","utf8") });
  await p.goto("./mobile.html");
  await p.addStyleTag({ content: fs.readFileSync(dir + "/invert.css","utf8") });
  await p.addScriptTag({ content: fs.readFileSync(dir + "/content.js","utf8") });
  await p.evaluate(() => ytShow("字幕のテスト caption test"));
  await p.waitForTimeout(400);
  return { p, ctx };
}
const cls = p => p.evaluate(() => ["ytic-on","ytic-invert","ytic-stroke","ytic-mode-edge"].filter(c => document.documentElement.classList.contains(c)).join(" ") || "(off)");
const cdp = async p => { const s = await p.context().newCDPSession(p); return s; };
async function touch(p, pts, holdMs = 50) {
  const s = await cdp(p);
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  for (const q of pts.slice(1)) { await p.waitForTimeout(16); await s.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: q[0], y: q[1] }] }); }
  await p.waitForTimeout(holdMs);
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(900);
}
const res = {};
// 1 defaults on fresh install
let { p, ctx } = await setup({});
res.defaults = await p.evaluate(() => { const s = window.__store; return { center: s.center, strokeWidth: s.strokeWidth, capPos: s.capPos, androidRev: s.androidRev, mode: s.mode, enabled: s.enabled }; });
res.upgrade243 = await (async () => { const x = await setup({ settingsRev: 1, enabled: true, mode: "edge", center: false, strokeWidth: 3, capPos: 5, fontPct: 200 }); const r = await x.p.evaluate(() => { const s = window.__store; return { center: s.center, strokeWidth: s.strokeWidth, capPos: s.capPos, mode: s.mode, fontPct: s.fontPct }; }); await x.ctx.close(); return r; })();
const box = await p.evaluate(() => { const r = document.querySelector(".ytp-caption-segment").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
res.top = await p.evaluate(([x, y]) => document.elementFromPoint(x, y).id, box);
res.start = await cls(p);
const seq = [];
for (let i = 0; i < 3; i++) { await p.evaluate(() => { __hits.player = 0; __hits.overlay = 0; }); await touch(p, [box]); seq.push({ cls: await cls(p), toast: await p.evaluate(() => { const t = document.querySelector(".ytic-toast"); return t ? t.textContent + "@" + t.parentElement.id : null; }), hits: await p.evaluate(() => ({ ...__hits })) }); await p.waitForTimeout(400); }
res.cycle = seq;
res.tapAfterOff = await (async () => { await p.evaluate(() => { __hits.overlay = 0; }); await touch(p, [box]); return { cls: await cls(p), overlay: await p.evaluate(() => __hits.overlay) }; })();
res.storeUnchanged = await p.evaluate(() => ({ mode: __store.mode, enabled: __store.enabled }));
await ctx.close();
// drag/scroll does not cycle
({ p, ctx } = await setup({ settingsRev: 1, androidRev: 1, enabled: true, mode: "invert" }));
const b2 = await p.evaluate(() => { const r = document.querySelector(".ytp-caption-segment").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await touch(p, [b2, [b2[0], b2[1] - 20], [b2[0], b2[1] - 60], [b2[0], b2[1] - 120]]);
res.afterDrag = await cls(p);
res.scrollYAfterDrag = await p.evaluate(() => scrollY);
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
await touch(p, [b2], 900);
res.afterLongPress = await cls(p);
// tap outside caption reaches overlay
await p.evaluate(() => { __hits.overlay = 0; });
await touch(p, [[30, 30]]);
res.outsideTapOverlayHits = await p.evaluate(() => __hits.overlay);
res.outsideCls = await cls(p);
// stroke -> edge -> off, popup change clears override
await p.evaluate(() => chrome.storage.local.set({ mode: "stroke" })); await p.waitForTimeout(200);
await touch(p, [b2]); res.strokeNext = await cls(p);
await p.evaluate(() => chrome.storage.local.set({ mode: "invert" })); await p.waitForTimeout(200);
res.afterPopupChange = await cls(p);
await ctx.close();
console.log(JSON.stringify(res, null, 1));
await b.close();
