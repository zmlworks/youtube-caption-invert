import { chromium, devices } from "playwright";
import fs from "fs";
const dir = process.argv[2];
const b = await chromium.launch();
async function setup(store, lang = "ja") {
  const ctx = await b.newContext({ ...devices["Pixel 7"] });
  const p = await ctx.newPage(); p.on("pageerror", e => console.log("ERR", e.message));
  await p.addInitScript({ content: "window.__initialStore=" + JSON.stringify(store) + ";" + fs.readFileSync("stub.js","utf8") + ";chrome.i18n={getUILanguage:()=>" + JSON.stringify(lang) + "};" });
  await p.goto("./mobile.html");
  await p.addStyleTag({ content: fs.readFileSync(dir + "/invert.css","utf8") });
  await p.addScriptTag({ content: fs.readFileSync(dir + "/content.js","utf8") });
  await p.evaluate(() => ytShow("字幕のテスト caption test"));
  await p.waitForTimeout(400);
  return { p, ctx };
}
const st = p => p.evaluate(() => { const h = document.documentElement; return (["invert","stroke","mode-edge"].find(c => h.classList.contains("ytic-" + c)) || "off") + "/pos" + (h.dataset.yticPos || "1"); });
const center = p => p.evaluate(() => { const r = document.querySelector(".ytp-caption-segment").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
async function touch(p, pts, holdMs = 50) {
  const s = await p.context().newCDPSession(p);
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  for (const q of pts.slice(1)) { await p.waitForTimeout(16); await s.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: q[0], y: q[1] }] }); }
  await p.waitForTimeout(holdMs);
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(900);
}
async function cycle(store, n, lang) {
  const { p, ctx } = await setup(Object.assign({ settingsRev: 1, androidRev: 1, enabled: true, center: true }, store), lang);
  const out = [await st(p)];
  for (let i = 0; i < n; i++) {
    await p.evaluate(() => { __hits.player = 0; __hits.overlay = 0; });
    const pt = await center(p);
    await touch(p, [pt]);
    const r = await p.evaluate(() => { const t = document.querySelector(".ytic-toast"); return { toast: t && t.textContent, leak: __hits.player + __hits.overlay }; });
    out.push((await st(p)) + " [" + (r.toast || "-") + "] leak=" + r.leak);
    await p.waitForTimeout(300);
  }
  const saved = await p.evaluate(() => ({ mode: __store.mode, capPos: __store.capPos, enabled: __store.enabled }));
  await ctx.close();
  return { seq: out, savedAfter: saved };
}
const res = {};
res.invert_pos2 = await cycle({ mode: "invert", capPos: 2 }, 5);
res.invert_pos1 = await cycle({ mode: "invert", capPos: 1 }, 4);
res.stroke_pos3 = await cycle({ mode: "stroke", capPos: 3 }, 4);
res.stroke_pos1 = await cycle({ mode: "stroke", capPos: 1 }, 3);
res.en_invert_pos2 = await cycle({ mode: "invert", capPos: 2 }, 4, "en-US");
// scroll / long press / outside / popup clears override
let { p, ctx } = await setup({ settingsRev: 1, androidRev: 1, enabled: true, mode: "stroke", capPos: 4 });
let pt = await center(p);
await touch(p, [pt, [pt[0], pt[1] - 20], [pt[0], pt[1] - 60], [pt[0], pt[1] - 120]]);
res.afterDrag = await st(p); res.scrollY = await p.evaluate(() => scrollY);
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
pt = await center(p); await touch(p, [pt], 900); res.afterLongPress = await st(p);
await p.evaluate(() => { __hits.overlay = 0; }); await touch(p, [[30, 30]]); res.outsideOverlayHits = await p.evaluate(() => __hits.overlay);
pt = await center(p); await touch(p, [pt]); res.afterTapPos = await st(p);
await p.evaluate(() => chrome.storage.local.set({ capPos: 6 })); await p.waitForTimeout(200); res.afterPopupCapPos6 = await st(p);
await ctx.close();
console.log(JSON.stringify(res, null, 1));
await b.close();
