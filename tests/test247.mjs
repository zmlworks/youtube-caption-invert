// 2.4.7: ドラッグ後のポップアップ変更（保持）、E / D キー、ポップアップのキー記録の確認。
// YouTube のドラッグ（captions.js の m0 → U1）をまねる: ytp-dragging を付けて位置を書き直し、以後の字幕も同じ位置に出す。
import { firefox } from "playwright";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
const url = (f) => pathToFileURL(path.resolve(f)).href;
const dir = process.env.SRC || "../src";
const browser = await firefox.launch({ headless: true });
const R = {};
let ok = true;
const check = (name, cond, info) => { R[name] = { pass: !!cond, info }; if (!cond) ok = false; };

async function open(store) {
  const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify(Object.assign({ settingsRev: 1, enabled: true, mode: "invert" }, store)) + ";" + fs.readFileSync("stub.js", "utf8") });
  await page.goto(url("./page.html"));
  await page.addStyleTag({ content: fs.readFileSync(dir + "/invert.css", "utf8") + ".caption-window{transition:none!important}" });
  await page.addScriptTag({ content: fs.readFileSync(dir + "/content.js", "utf8") });
  await page.evaluate(() => {
    // 位置付きで字幕を出す（ドラッグ後の YouTube は、新しい字幕もドラッグした位置に置く）
    window.ytShowAt = (text, pos) => { const w = ytShow(text, 20); w.style.bottom = ""; Object.assign(w.style, pos); return w; };
    // ドラッグ: ytp-dragging を付け、計測（top:0, max-height:96%）→ 本来の位置、の順に書く。終わったらクラスを外す。
    window.ytDrag = (pos) => new Promise((done) => {
      const w = document.querySelector(".caption-window");
      w.classList.add("ytp-dragging");
      Object.assign(w.style, { top: "0px", left: "0px", bottom: "", marginLeft: "", maxHeight: "96%" });
      Object.assign(w.style, { top: "", left: "50%", maxHeight: "", marginLeft: -w.offsetWidth / 2 + "px" }, pos);
      setTimeout(() => { w.classList.remove("ytp-dragging"); done(); }, 30);
    });
    // keydown → keyup（2.4.8: 高さの保存はキーを離したとき／300ms 後にまとめて行う）
    window.key = (init, target) => { const r = (target || document.body).dispatchEvent(new KeyboardEvent("keydown", Object.assign({ bubbles: true, cancelable: true }, init))); (target || document.body).dispatchEvent(new KeyboardEvent("keyup", Object.assign({ bubbles: true, cancelable: true }, init))); return r; };
  });
  await page.waitForTimeout(250);
  return page;
}
const geo = (page, sel = ".caption-window") => page.evaluate((sel) => {
  const p = document.getElementById("movie_player").getBoundingClientRect();
  const w = document.querySelector(sel); const r = w.getBoundingClientRect();
  return { topPct: +((r.top - p.top) / p.height * 100).toFixed(1), bottomPct: +((p.bottom - r.bottom) / p.height * 100).toFixed(1) };
}, sel);
const wait = (page, ms = 80) => page.waitForTimeout(ms);
const store = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
// controls shown (page.html: margin-bottom 61px). 自動非表示にして純粋な割合で比べる。
const autohide = (page) => page.evaluate(() => document.getElementById("movie_player").classList.add("ytp-autohide"));
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

{ // A) ドラッグ → ポップアップ変更 → 保持 → 再ドラッグ
  const page = await open({ capPos: 3 });
  await autohide(page);
  await page.evaluate(() => ytShow("Caption before drag", 20)); await wait(page);
  check("A1 before drag: step 3 = bottom 22%", near((await geo(page)).bottomPct, 22), await geo(page));
  await page.evaluate(() => ytDrag({ bottom: "60%" })); await wait(page);
  check("A2 drag wins (bottom 60%)", near((await geo(page)).bottomPct, 60), await geo(page));
  await page.evaluate(() => ytShowAt("Next caption at dragged pos", { bottom: "60%", left: "50%" })); await wait(page);
  check("A3 next caption stays at dragged pos", near((await geo(page)).bottomPct, 60), await geo(page));
  await page.evaluate(() => chrome.storage.local.set({ capPos: 5 })); await wait(page, 150);
  check("A4 popup change after drag applies (step 5 = bottom 42%)", near((await geo(page)).bottomPct, 42), { g: await geo(page), hold: await page.evaluate(() => document.documentElement.dataset.yticHold) });
  await page.evaluate(() => ytShowAt("New caption after popup change", { bottom: "60%", left: "50%" })); await wait(page);
  check("A5 new caption also at step 5", near((await geo(page)).bottomPct, 42), await geo(page));
  await page.evaluate(() => chrome.storage.local.set({ capPos: 8 })); await wait(page, 150);
  check("A6 popup change again (step 8 = top 22%)", near((await geo(page)).topPct, 22), await geo(page));
  await page.evaluate(() => chrome.storage.local.set({ capPos: 1 })); await wait(page, 150);
  check("A7 step 1 snaps dragged caption to YouTube default bottom 2%", near((await geo(page)).bottomPct, 2), await geo(page));
  // 投稿者が位置を指定した字幕（別の位置）は動かさない
  await page.evaluate(() => chrome.storage.local.set({ capPos: 6 })); await wait(page, 150);
  await page.evaluate(() => ytShowAt("Uploader positioned", { bottom: "3.92%", left: "50%" })); await wait(page);
  check("A8 uploader-positioned caption not moved", near((await geo(page)).bottomPct, 3.92), await geo(page));
  // 計測中（max-height あり）は効かない
  const meas = await page.evaluate(() => { const w = ytShowAt("measure", { bottom: "60%", left: "50%" }); return new Promise((r) => setTimeout(() => { w.style.bottom = ""; w.style.top = "0px"; w.style.maxHeight = "96%"; const cs = getComputedStyle(w); r({ held: w.hasAttribute("data-ytic-held"), top: cs.top, bottom: cs.bottom }); }, 30)); });
  check("A9 measuring pass unaffected while held", meas.top === "0px", meas);
  // 再ドラッグ: 保持をやめ、ドラッグした位置が優先（跳ねない）
  await page.evaluate(() => ytShowAt("Drag again", { bottom: "60%", left: "50%" })); await wait(page);
  const beforeDrag = await geo(page);
  await page.evaluate(() => ytDrag({ bottom: "50%" })); await wait(page);
  const after = await geo(page);
  check("A10 drag again: held at step 6 before, drag position wins after", near(beforeDrag.topPct, 42) && near(after.bottomPct, 50), { beforeDrag, after, hold: await page.evaluate(() => document.documentElement.dataset.yticHold || "(none)") });
  await page.close();
}

{ // B) キー E / D
  const page = await open({ capPos: 3 });
  await autohide(page);
  await page.evaluate(() => ytShow("Key test", 20)); await wait(page);
  let notPrevented = await page.evaluate(() => key({ key: "e", code: "KeyE" }));
  await wait(page);
  check("B1 E: 3 -> 4 (bottom 32%), persisted, preventDefault", near((await geo(page)).bottomPct, 32) && (await store(page)).capPos === 4 && notPrevented === false, { g: await geo(page), capPos: (await store(page)).capPos, notPrevented });
  await page.keyboard.press("d"); await wait(page);
  check("B2 D (real key press): 4 -> 3", (await store(page)).capPos === 3 && near((await geo(page)).bottomPct, 22), await geo(page));
  const badge = await page.evaluate(() => { const b = document.querySelector(".ytic-badge"); return b && { text: b.textContent, on: b.classList.contains("ytic-badge-on"), opacity: getComputedStyle(b).opacity, parent: b.parentElement.id }; });
  check("B3 badge shown", badge && badge.text === "字幕の高さ 3/10" && badge.on, badge);
  await page.waitForTimeout(1400);
  check("B4 badge hides", await page.evaluate(() => !document.querySelector(".ytic-badge").classList.contains("ytic-badge-on")));
  notPrevented = await page.evaluate(() => key({ key: "E", code: "KeyE", shiftKey: true }));
  check("B5 Shift+E ignored (modifier mismatch, not prevented)", (await store(page)).capPos === 3 && notPrevented === true, { notPrevented });
  notPrevented = await page.evaluate(() => { const i = document.createElement("input"); document.body.appendChild(i); i.focus(); const r = key({ key: "e", code: "KeyE" }, i); i.remove(); return r; });
  check("B6 ignored while typing in input", (await store(page)).capPos === 3 && notPrevented === true);
  notPrevented = await page.evaluate(() => { const d = document.createElement("div"); d.contentEditable = "true"; document.body.appendChild(d); d.focus(); const r = key({ key: "e", code: "KeyE" }, d); d.remove(); return r; });
  check("B7 ignored in contenteditable", (await store(page)).capPos === 3 && notPrevented === true);
  notPrevented = await page.evaluate(() => key({ key: "k", code: "KeyK" }));
  check("B8 other keys pass through", notPrevented === true);
  for (let i = 0; i < 12; i++) await page.evaluate(() => key({ key: "d", code: "KeyD" }));
  await wait(page);
  check("B9 clamp at 1", (await store(page)).capPos === 1 && near((await geo(page)).bottomPct, 2), await geo(page));
  for (let i = 0; i < 12; i++) await page.evaluate(() => key({ key: "e", code: "KeyE", repeat: true }));
  await wait(page);
  check("B10 clamp at 10 (top 2%), repeat ok", (await store(page)).capPos === 10 && near((await geo(page)).topPct, 2), await geo(page));
  // ドラッグ後のキー: 今の位置に一番近い段階から 1 段
  await page.evaluate(() => chrome.storage.local.set({ capPos: 2 })); await wait(page, 150);
  await page.evaluate(() => ytDrag({ bottom: "55%" })); await wait(page);
  const dragged = await geo(page);
  await page.evaluate(() => key({ key: "e", code: "KeyE" })); await wait(page);
  const afterE = await geo(page);
  // bottom 55% → 上端 ≈ 45% - 枠の高さ → 一番近いのは段階 6（上端 42%）→ E で 7（上端 32%）
  check("B11 E after drag: from nearest step (6) to 7, persisted", (await store(page)).capPos === 7 && near(afterE.topPct, 32), { dragged, afterE, capPos: (await store(page)).capPos });
  await page.evaluate(() => ytShowAt("Next at dragged pos", { bottom: "55%", left: "50%" })); await wait(page);
  check("B12 later captions follow the key step", near((await geo(page)).topPct, 32), await geo(page));
  await page.evaluate(() => key({ key: "d", code: "KeyD" })); await wait(page);
  check("B13 D while held: 7 -> 6", (await store(page)).capPos === 6 && near((await geo(page)).topPct, 42), await geo(page));
  // ドラッグ後、字幕が消えているときのキー（覚えている位置から見積もる）
  await page.evaluate(() => ytShow("x", 20)); await wait(page);
  await page.evaluate(() => ytDrag({ bottom: "80%" })); await wait(page);
  await page.evaluate(() => ytClear()); await wait(page);
  await page.evaluate(() => key({ key: "d", code: "KeyD" })); await wait(page);
  const capNoWin = (await store(page)).capPos;
  await page.evaluate(() => ytShowAt("after", { bottom: "80%", left: "50%" })); await wait(page);
  check("B14 D after drag with no caption visible: estimated from drag (near 9/10 -> 8 or 9)", capNoWin === 8 || capNoWin === 9, { capNoWin, g: await geo(page) });
  await page.close();
}

{ // C) 中段（top + margin-top）にドラッグした字幕も移る
  const page = await open({ capPos: 1 });
  await autohide(page);
  await page.evaluate(() => ytShow("Middle row", 20)); await wait(page);
  await page.evaluate(() => ytDrag({ top: "50%", marginTop: "-13px" })); await wait(page);
  await page.evaluate(() => chrome.storage.local.set({ capPos: 4 })); await wait(page, 150);
  check("C1 middle-row dragged caption -> step 4 (bottom 32%)", near((await geo(page)).bottomPct, 32), await geo(page));
  await page.close();
}

{ // D) 未設定 / 変更したキー、オフのとき
  const page = await open({ capPos: 3, posUpKey: null, posDownKey: { alt: false, shift: true, ctrl: false, meta: false, key: "j", code: "KeyJ" } });
  await page.evaluate(() => ytShow("x", 20)); await wait(page);
  let np = await page.evaluate(() => key({ key: "e", code: "KeyE" }));
  check("D1 unset up key: E passes through", np === true && (await store(page)).capPos === 3);
  np = await page.evaluate(() => key({ key: "J", code: "KeyJ", shiftKey: true }));
  check("D2 custom Shift+J lowers", np === false && (await store(page)).capPos === 2);
  await page.evaluate(() => chrome.storage.local.set({ enabled: false })); await wait(page, 150);
  np = await page.evaluate(() => key({ key: "J", code: "KeyJ", shiftKey: true }));
  check("D3 add-on off: keys pass through", np === true && (await store(page)).capPos === 2);
  await page.close();
}

{ // E) ポップアップのキー記録とスクリーンショット
  const page = await browser.newPage({ viewport: { width: 320, height: 1000 }, deviceScaleFactor: 2 });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify({ settingsRev: 1, enabled: true, mode: "invert", fontPct: 100, capPos: 7, lang: "ja" }) + ";" + fs.readFileSync("stub.js", "utf8") });
  await page.goto(url(dir + "/popup.html")); await wait(page, 300);
  const txt = () => page.evaluate(() => ({ up: document.getElementById("posUpKey").textContent, down: document.getElementById("posDownKey").textContent, cap: document.getElementById("capPos").value, store: { up: window.__store.posUpKey, down: window.__store.posDownKey } }));
  check("E1 defaults shown E / D", (await txt()).up === "E" && (await txt()).down === "D", await txt());
  await page.click("#posUpKey"); const rec = (await txt()).up;
  await page.keyboard.press("Shift+E"); await wait(page);
  let t = await txt();
  check("E2 capture Shift+E", rec === "キー" && t.up === "Shift+E" && t.store.up.shift === true && t.store.up.key === "e", { rec, t });
  await page.click("#posDownKey"); await page.keyboard.press("Backspace"); await wait(page);
  t = await txt();
  check("E3 Backspace unsets", t.down === "なし" && t.store.down === null, t);
  await page.click("#posDownKey"); await page.keyboard.press("Escape"); await wait(page);
  check("E4 Esc cancels", (await txt()).down === "なし");
  await page.click("#posDownKey"); await page.keyboard.press("Shift+E"); await wait(page);
  t = await txt();
  check("E5 same key moves to the other field", t.down === "Shift+E" && t.up === "なし" && t.store.up === null, t);
  await page.click("#posUpKey"); await page.keyboard.press("e"); await wait(page);
  await page.click("#posDownKey"); await page.keyboard.press("Delete"); await page.waitForTimeout(450);
  await page.click("#posDownKey"); await page.keyboard.press("d"); await wait(page);
  t = await txt();
  check("E6 back to E / D", t.up === "E" && t.down === "D" && t.store.down.code === "KeyD", t);
  await page.evaluate(() => chrome.storage.local.set({ capPos: 4 })); await wait(page);
  check("E7 popup reflects capPos written by key handler (storage change)", (await txt()).cap === "4");
  await page.evaluate(() => chrome.storage.local.set({ capPos: 1 })); await wait(page);
  const out = process.env.SHOTS || ".";
  for (const lang of ["ja", "en"]) {
    if (lang === "en") { await page.click("#lang"); await wait(page); }
    if (lang === "en") check("E8 en strings", (await page.evaluate(() => document.querySelector('[data-i18n="posUp"]').textContent)) === "Key: caption up 1 step");
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: 320, height: h });
    await page.screenshot({ path: out + "/popup-2.4.7" + (lang === "en" ? "-en" : "") + ".png", fullPage: true });
  }
  await page.click("#lang"); await wait(page);
  await page.close();
}
console.log(JSON.stringify(R, null, 1));
console.log(ok ? "ALL PASS" : "SOME FAILED");
await browser.close();
process.exit(ok ? 0 : 1);
