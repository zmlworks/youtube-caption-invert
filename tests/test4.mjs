import { firefox } from "playwright";
import fs from "fs";
const dir = "../docs/fixed";
const browser = await firefox.launch({ headless: true });
const res = {};
// (a) observer callbacks during rollup at 300% + center
{
  const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
  await page.addInitScript({ content: "window.__cfg={fs:21.33};window.__initialStore=" + JSON.stringify({ settingsRev: 1, enabled: true, mode: "invert", fontPct: 300, center: true }) + ";" + fs.readFileSync("stub.js", "utf8") });
  await page.goto("./rollup.html");
  await page.addStyleTag({ content: fs.readFileSync(dir + "/invert.css", "utf8") });
  await page.addScriptTag({ content: fs.readFileSync(dir + "/content.js", "utf8") });
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => __obsCalls);
  await page.evaluate(() => runRollup({ long: true, keep: 99, words: 30 }));
  const a = await page.evaluate(() => ({ calls: __obsCalls, rf: document.getElementById("ytp-caption-window-container").style.getPropertyValue("--ytic-rf"), inlineSeg: document.querySelector(".ytp-caption-segment").style.fontSize, prio: document.querySelector(".ytp-caption-segment").style.getPropertyPriority("font-size") }));
  res.rollup = { youtubeUpdates: "30 words (+ transitionend re-renders)", observerCallbacks: a.calls - b, containerVar: a.rf, segmentInlineUntouched: a.inlineSeg + (a.prio ? " !important" : "") };
  // switch back to 100 -> var removed
  await page.evaluate(() => chrome.storage.local.set({ fontPct: 100 })); await page.waitForTimeout(100);
  res.rollupBack100 = await page.evaluate(() => ({ cls: document.getElementById("ytp-caption-window-container").className, rf: document.getElementById("ytp-caption-window-container").style.getPropertyValue("--ytic-rf"), font: getComputedStyle(document.querySelector(".ytp-caption-segment")).fontSize }));
  await page.close();
}
// (b) center mode with pop-on windows (bottom-centred with width, and left-anchored positioned without width)
{
  const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify({ settingsRev: 1, enabled: true, mode: "invert", fontPct: 100, center: true }) + ";" + fs.readFileSync("stub.js", "utf8") });
  await page.goto("./page.html");
  await page.addStyleTag({ content: fs.readFileSync(dir + "/invert.css", "utf8") });
  await page.addScriptTag({ content: fs.readFileSync(dir + "/content.js", "utf8") });
  await page.waitForTimeout(300);
  const geo = () => page.evaluate(() => { const p = document.getElementById("movie_player").getBoundingClientRect(); return Array.from(document.querySelectorAll(".caption-window")).map((w) => { const r = w.getBoundingClientRect(); return { cls: w.className.replace("caption-window ", ""), w: Math.round(r.width), centerOff: Math.round(r.left + r.width / 2 - (p.left + p.width / 2)), inside: r.left >= p.left - 1 && r.right <= p.right + 1 }; }); });
  await page.evaluate(() => ytShow("Centred caption", 20)); await page.waitForTimeout(50);
  res.centerBottom = await geo();
  await page.evaluate(() => { const c = document.getElementById("ytp-caption-window-container"); c.textContent = ""; const w = document.createElement("div"); w.className = "caption-window ytp-caption-window-top"; w.setAttribute("style", "touch-action: none; text-align: left; top: 58%; left: 4.4%;"); w.innerHTML = '<span class="captions-text"><span class="caption-visual-line"><span class="ytp-caption-segment" style="display: inline-block; font-size: 18px;">LEFT ANCHORED</span></span></span>'; c.appendChild(w); });
  await page.waitForTimeout(50);
  res.centerLeftAnchoredNoWidth = await geo();
  await page.evaluate(() => { const w = document.querySelector(".caption-window"); w.style.transform = "translateX(-50%)"; w.style.left = "50%"; }); await page.waitForTimeout(50);
  res.centerYouTubeTranslate = await geo();
  await page.close();
}
console.log(JSON.stringify(res, null, 1));
await browser.close();
