import { firefox } from "playwright";
import fs from "fs";
const b = await firefox.launch(); const r = {};
const stub = (store, lang = "ja") => "window.__initialStore=" + JSON.stringify(store) + ";" + fs.readFileSync("stub.js","utf8") + ";chrome.i18n={getUILanguage:()=>" + JSON.stringify(lang) + "};";
let p = await b.newPage({ viewport: { width: 360, height: 900 } }); p.on("pageerror", e => console.log("ERR", e.message));
await p.addInitScript({ content: stub({ settingsRev: 1, androidRev: 1, enabled: true, mode: "edge", fill: [1, 2, 3], mid: [250, 251, 252], shortcut: { key: "z" } }) });
await p.goto("../src/popup.html"); await p.waitForTimeout(300);
r.loaded = await p.evaluate(() => ["fillR","fillG","fillB","midR","midG","midB"].map(id => document.getElementById(id).value).join(","));
await p.fill("#fillR", "300"); await p.press("#fillR", "Tab");
await p.fill("#midG", "-5"); await p.press("#midG", "Tab");
await p.fill("#midB", "12.6"); await p.press("#midB", "Tab"); await p.waitForTimeout(150); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(300);
r.saved = await p.evaluate(() => ({ fill: __store.fill, mid: __store.mid, shortcutKept: !!__store.shortcut, inputs: fillR.value + "/" + midG.value + "/" + midB.value, swatch: fillSwatch.style.background }));
await p.close();
p = await b.newPage({ viewport: { width: 360, height: 900 } });
await p.addInitScript({ content: stub({}) }); await p.goto("../src/popup.html"); await p.waitForTimeout(300);
r.freshDefaults = await p.evaluate(() => ["fillR","fillG","fillB","midR","midG","midB"].map(id => document.getElementById(id).value).join(","));
await p.close();
// content applies colours (edgeCustom absent/false still uses them)
for (const [name, store] of [["custom", { mode: "edge", fill: [1, 2, 3], mid: [250, 251, 252], edgeCustom: false }], ["default", { mode: "edge" }]]) {
  p = await b.newPage();
  await p.addInitScript({ content: stub(Object.assign({ settingsRev: 1, androidRev: 1, enabled: true }, store)) });
  await p.goto("./mobile.html");
  await p.addStyleTag({ content: fs.readFileSync("../src/invert.css","utf8") });
  await p.addScriptTag({ content: fs.readFileSync("../src/content.js","utf8") });
  await p.evaluate(() => ytShow("テスト")); await p.waitForTimeout(300);
  r["content_" + name] = await p.evaluate(() => { const s = getComputedStyle(document.querySelector(".ytp-caption-segment")); return { color: s.color, shadowHas: s.textShadow.slice(0, 60) }; });
  await p.close();
}
console.log(JSON.stringify(r, null, 1)); await b.close();
