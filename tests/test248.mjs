// 2.4.8: 字幕が出ているときだけ E / D、キーリピートの保存まとめ、shadow DOM の入力欄、
// 移行で全設定を書かない、ポップアップは変えた項目だけ保存。`node test248.mjs`（SRC で場所を変更可）。
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
// set の呼び出しを記録する
const SPY = "window.__sets=[];{const s=chrome.storage.local.set.bind(chrome.storage.local);chrome.storage.local.set=(o,cb)=>{window.__sets.push(Object.keys(o).sort());return s(o,cb);};}";

async function open(store) {
  const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify(store) + ";" + fs.readFileSync("stub.js", "utf8") + SPY });
  await page.goto(url("./page.html"));
  await page.addStyleTag({ content: fs.readFileSync(dir + "/invert.css", "utf8") + ".caption-window{transition:none!important}" });
  await page.addScriptTag({ content: fs.readFileSync(dir + "/content.js", "utf8") });
  await page.waitForTimeout(250);
  return page;
}
const keyE = (page, extra) => page.evaluate((extra) => document.body.dispatchEvent(new KeyboardEvent("keydown", Object.assign({ key: "e", code: "KeyE", bubbles: true, cancelable: true }, extra))), extra || {});
const store = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
const sets = (page) => page.evaluate(() => window.__sets);

{ // A) 字幕オフ（ボタン off、字幕なし）→ E は素通り
  const page = await open({ settingsRev: 1, enabled: true, mode: "invert", capPos: 3 });
  await page.evaluate(() => document.querySelector(".ytp-subtitles-button").setAttribute("aria-pressed", "false"));
  const notPrevented = await keyE(page); await page.waitForTimeout(400);
  check("A1 captions off: E passes through", notPrevented === true && (await store(page)).capPos === 3, { notPrevented });
  await page.evaluate(() => ytShow("visible caption", 20));
  const np2 = await keyE(page); await page.waitForTimeout(400);
  check("A2 caption visible (button off): E works", np2 === false && (await store(page)).capPos === 4, { np2 });
  await page.close();
}
{ // B) キーリピート: まとめて 1 回だけ保存
  const page = await open({ settingsRev: 1, enabled: true, mode: "invert", capPos: 1 });
  await page.evaluate(() => { ytShow("caption", 20); window.__sets.length = 0; });
  for (let i = 0; i < 6; i++) await keyE(page, { repeat: i > 0 });
  const during = (await sets(page)).length;
  const shown = await page.evaluate(() => document.documentElement.dataset.yticPos || "");
  await page.waitForTimeout(450);
  const s = await sets(page);
  check("B1 repeat: no write during repeat, one write after", during === 0 && s.length === 1 && (await store(page)).capPos === 7, { during, s, shown });
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "e", code: "KeyE", bubbles: true, cancelable: true })));
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keyup", { key: "e", code: "KeyE", bubbles: true })));
  await page.waitForTimeout(50);
  check("B2 keyup flushes immediately", (await store(page)).capPos === 8, (await store(page)).capPos);
  await page.close();
}
{ // C) shadow DOM の入力欄では反応しない
  const page = await open({ settingsRev: 1, enabled: true, mode: "invert", capPos: 3 });
  const np = await page.evaluate(() => {
    ytShow("caption", 20);
    const host = document.createElement("div"); document.body.appendChild(host);
    const input = document.createElement("input"); host.attachShadow({ mode: "open" }).appendChild(input); input.focus();
    return input.dispatchEvent(new KeyboardEvent("keydown", { key: "e", code: "KeyE", bubbles: true, composed: true, cancelable: true }));
  });
  await page.waitForTimeout(400);
  check("C1 typing in shadow input: E ignored", np === true && (await store(page)).capPos === 3, { np });
  await page.close();
}
{ // D) 移行: 新規は settingsRev だけ、旧設定は変わる項目だけ
  let page = await open({});
  await page.waitForTimeout(150);
  check("D1 fresh install writes only settingsRev + enabled/mode", JSON.stringify(await store(page)) === JSON.stringify({ settingsRev: 1, enabled: true, mode: "invert" }), await store(page));
  await page.close();
  page = await open({ phase: "edge", strokeWidth: 5, fontPct: 150 });
  await page.waitForTimeout(150);
  const st = await store(page); const s = await sets(page);
  check("D2 legacy: only changed keys", JSON.stringify(s) === JSON.stringify([["enabled", "mode", "settingsRev", "strokeWidth"]]) && st.mode === "edge" && st.strokeWidth === 2 && st.fontPct === 150, { st, s });
  await page.close();
}
{ // E) ポップアップ: 変えた項目だけ。記録中に他で変わった高さを古い値で戻さない
  const page = await browser.newPage({ viewport: { width: 320, height: 1000 } });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify({ settingsRev: 1, enabled: true, mode: "invert", capPos: 3, lang: "ja" }) + ";" + fs.readFileSync("stub.js", "utf8") + SPY });
  await page.goto(url(dir + "/popup.html")); await page.waitForTimeout(300);
  await page.selectOption("#fontPct", "150"); await page.waitForTimeout(100);
  check("E1 change fontPct writes only fontPct", JSON.stringify(await sets(page)) === JSON.stringify([["fontPct"]]), await sets(page));
  await page.click("#posUpKey");
  await page.evaluate(() => chrome.storage.local.set({ capPos: 9 })); await page.waitForTimeout(100);
  await page.keyboard.press("Shift+E"); await page.waitForTimeout(100);
  const st = await store(page);
  check("E2 recording + external capPos: capPos kept", st.capPos === 9 && st.posUpKey && st.posUpKey.shift === true, { st, sets: await sets(page) });
  await page.waitForTimeout(100);
  check("E3 popup repainted after recording", (await page.evaluate(() => document.getElementById("capPos").value)) === "9");
  await page.close();
}
console.log(JSON.stringify(R, null, 1));
console.log(ok ? "ALL PASS" : "SOME FAILED");
await browser.close();
process.exit(ok ? 0 : 1);
