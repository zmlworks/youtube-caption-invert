import { firefox } from "playwright";
import fs from "fs";
const dir = "../docs/fixed";
const browser = await firefox.launch({ headless: true });
async function open(store, vw = 854, vh = 480) {
  const page = await browser.newPage({ viewport: { width: Math.max(vw, 854), height: Math.max(vh, 480) } });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify(Object.assign({ settingsRev: 1, enabled: true, mode: "invert" }, store)) + ";" + fs.readFileSync("stub.js", "utf8") });
  await page.goto("./page.html");
  await page.addStyleTag({ content: fs.readFileSync(dir + "/invert.css", "utf8") + ".caption-window{transition:none!important}" });
  await page.addScriptTag({ content: fs.readFileSync(dir + "/content.js", "utf8") });
  if (vw !== 854) await page.evaluate(([w, h]) => { const p = document.getElementById("movie_player"); p.style.width = w + "px"; p.style.height = h + "px"; }, [vw, vh]);
  await page.waitForTimeout(250);
  return page;
}
const geo = (page) => page.evaluate(() => {
  const p = document.getElementById("movie_player").getBoundingClientRect();
  return Array.from(document.querySelectorAll(".caption-window")).map((w) => { const r = w.getBoundingClientRect();
    return { topPct: +((r.top - p.top) / p.height * 100).toFixed(1), bottomPct: +((p.bottom - r.bottom) / p.height * 100).toFixed(1), centerOff: Math.round(r.left + r.width / 2 - (p.left + p.width / 2)), inside: r.top >= p.top - 1 && r.bottom <= p.bottom + 1 && r.left >= p.left - 1 && r.right <= p.right + 1, font: getComputedStyle(w.querySelector(".ytp-caption-segment")).fontSize }; });
});
const autohide = (page, on) => page.evaluate((on) => document.getElementById("movie_player").classList.toggle("ytp-autohide", on), on);
const R = {};
// 1) every step, controls shown / hidden
R.steps = [];
for (let pos = 1; pos <= 10; pos++) {
  const page = await open({ capPos: pos });
  await page.evaluate(() => ytShow("Caption height test", 20)); await page.waitForTimeout(50);
  const shown = (await geo(page))[0];
  await autohide(page, true); await page.waitForTimeout(50);
  const hidden = (await geo(page))[0];
  R.steps.push({ pos, controlsShown_bottomPct: shown.bottomPct, controlsShown_topPct: shown.topPct, controlsHidden_bottomPct: hidden.bottomPct, controlsHidden_topPct: hidden.topPct, inside: shown.inside && hidden.inside });
  await page.close();
}
// 2) combos: centering + 400% + small player; fullscreen-size player; edge mode; disabled
const combos = [
  ["pos10 center 400% small 480x270", { capPos: 10, center: true, fontPct: 400 }, 480, 270],
  ["pos5 center 400% small 480x270", { capPos: 5, center: true, fontPct: 400 }, 480, 270],
  ["pos2 1920x1080 (fullscreen)", { capPos: 2 }, 1920, 1080],
  ["pos9 1920x1080 (fullscreen)", { capPos: 9 }, 1920, 1080],
  ["pos7 edge mode", { capPos: 7, mode: "edge" }, 854, 480],
  ["pos7 add-on OFF", { capPos: 7, enabled: false }, 854, 480],
];
R.combos = [];
for (const [name, store, w, h] of combos) {
  const page = await open(store, w, h);
  await page.evaluate(() => ytShow("A longer caption line to test width", 20)); await page.waitForTimeout(50);
  R.combos.push(Object.assign({ name }, (await geo(page))[0]));
  await page.close();
}
// 3) windows that must NOT move: uploader-positioned (srv3 av=98 -> bottom 3.92%), top-anchored, dragged; measuring pass
{
  const page = await open({ capPos: 8 });
  await page.evaluate(() => { const w = ytShow("Uploader positioned", 20); w.style.bottom = "3.92%"; }); await page.waitForTimeout(30);
  R.uploaderPositioned_av98 = (await geo(page))[0];
  await page.evaluate(() => { const w = ytShow("Default then dragged", 20); }); await page.waitForTimeout(30);
  R.defaultBeforeDrag = (await geo(page))[0];
  await page.evaluate(() => { const w = document.querySelector(".caption-window"); w.style.bottom = "35.5%"; }); await page.waitForTimeout(30);
  R.afterDrag_bottom35_5 = (await geo(page))[0];
  // YouTube measuring pass: top:0, bottom:"" -> our rule must not apply
  R.measuringPass = await page.evaluate(() => { const w = ytShow("measure", 20); w.style.bottom = ""; w.style.top = "0px"; const cs = getComputedStyle(w); return { top: cs.top, bottom: cs.bottom, matchesRule: w.matches('[style*="bottom: 2%"]') }; });
  // live change via storage while caption is shown
  await page.evaluate(() => ytShow("Live change", 20)); await page.waitForTimeout(30);
  const before = (await geo(page))[0];
  await page.evaluate(() => chrome.storage.local.set({ capPos: 3 })); await page.waitForTimeout(100);
  const after = (await geo(page))[0];
  await page.evaluate(() => chrome.storage.local.set({ capPos: 1 })); await page.waitForTimeout(100);
  const back = (await geo(page))[0];
  R.liveChange = { pos8_topPct: before.topPct, pos3_bottomPct: after.bottomPct, pos1_bottomPct: back.bottomPct, htmlAttr: await page.evaluate(() => document.documentElement.dataset.yticPos || "(none)") };
  await page.close();
}
console.log(JSON.stringify(R, null, 1));
await browser.close();
