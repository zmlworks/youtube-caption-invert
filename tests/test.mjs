import { firefox } from "playwright";
import fs from "fs";
const dir = process.argv[2];
const css = fs.readFileSync(dir + "/invert.css", "utf8");
const js = fs.readFileSync(dir + "/content.js", "utf8");
const stub = fs.readFileSync("./stub.js", "utf8");
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify({ settingsRev: 1, enabled: true, mode: "invert", fontPct: 200, videoLayer: true }) + ";" + stub });
await page.goto("./page.html");
await page.addStyleTag({ content: css });
await page.addScriptTag({ content: js });
const wait = (ms) => page.waitForTimeout(ms);
await wait(400);
const seg = () => page.evaluate(() => { const s = document.querySelector(".ytp-caption-segment"); const w = document.querySelector(".caption-window");
  const r = w.getBoundingClientRect(), p = document.getElementById("movie_player").getBoundingClientRect();
  return { inline: s.style.fontSize, prio: s.style.getPropertyPriority("font-size"), computed: getComputedStyle(s).fontSize,
    winH: getComputedStyle(w).height, winOverflow: getComputedStyle(w).overflow, winW: Math.round(r.width), centerOffset: Math.round((r.left + r.width/2) - (p.left + p.width/2)),
    fitsInside: r.left >= p.left - 1 && r.right <= p.right + 1,
    live: document.getElementById("movie_player").classList.contains("ytic-cc-live"), willChange: getComputedStyle(document.querySelector("video")).willChange,
    blend: getComputedStyle(w).mixBlendMode }; });
const out = {};
await page.evaluate(() => ytShow("Hello captions", 20)); await wait(50);
out.t1_new_caption_200pct = await seg();
// YouTube resize: rewrites font-size via CSSOM on existing node
await page.evaluate(() => { document.querySelector(".ytp-caption-segment").style.fontSize = "30px"; }); await wait(50);
out.t2_youtube_rewrites_30px = await seg();
// setAttribute style rewrite
await page.evaluate(() => { const s = document.querySelector(".ytp-caption-segment"); s.setAttribute("style", s.getAttribute("style").replace(/font-size:[^;]+/, "font-size: 25px")); }); await wait(50);
out.t3_setAttribute_25px = await seg();
// long caption must wrap inside player
await page.evaluate(() => ytShow("This is a very long caption line that would overflow the player when doubled", 22)); await wait(50);
out.t4_long_caption = await seg();
// rapid updates: 120 updates at ~16ms
const before = await page.evaluate(() => ({ c: __obsCalls, r: __obsRecords }));
await page.evaluate(async () => { for (let i = 0; i < 120; i++) { if (i % 3 === 0) ytShow("rapid " + i, 20 + (i % 5)); else { const s = document.querySelector(".ytp-caption-segment"); s.textContent = "rapid " + i; s.style.fontSize = (20 + (i % 7)) + "px"; } await new Promise((r) => setTimeout(r, 16)); } });
await wait(300);
const after = await page.evaluate(() => ({ c: __obsCalls, r: __obsRecords }));
out.t5_rapid = { youtubeUpdates: 120, observerCallbacks: after.c - before.c, records: after.r - before.r, final: await seg() };
// idle: no callbacks without page changes
const b2 = await page.evaluate(() => __obsCalls); await wait(1000); out.t6_idle_callbacks_1s = (await page.evaluate(() => __obsCalls)) - b2;
// switch to 100% -> restore
await page.evaluate(() => chrome.storage.local.set({ fontPct: 100 })); await wait(100);
out.t7_back_to_100 = await seg();
await page.evaluate(() => chrome.storage.local.set({ fontPct: 50 })); await wait(100);
out.t8_50pct = await seg();
await page.evaluate(() => chrome.storage.local.set({ mode: "edge" })); await wait(100);
out.t9_edge_mode_live = await seg();
await page.evaluate(() => chrome.storage.local.set({ enabled: false })); await wait(100);
out.t10_disabled = await seg();
// SPA: player replaced
await page.evaluate(() => chrome.storage.local.set({ enabled: true, mode: "invert", fontPct: 150 })); await wait(100);
await page.evaluate(() => { const old = document.getElementById("movie_player"); const n = old.cloneNode(true); n.querySelector(".ytp-caption-window-container").textContent=""; n.classList.remove("ytic-cc-live"); old.replaceWith(n); document.dispatchEvent(new Event("yt-navigate-finish")); });
await wait(400);
await page.evaluate(() => ytShow("After navigation", 20)); await wait(50);
out.t11_after_spa_player_replaced_150 = await seg();
console.log(JSON.stringify(out, null, 1));
await browser.close();
