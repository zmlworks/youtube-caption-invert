import { firefox } from "playwright";
import fs from "fs";
const b = await firefox.launch(); const r = {};
for (const [lang, file] of [["ja", "../src/popup.png"], ["en-US", "../src/popup-en.png"]]) {
  const page = await b.newPage({ viewport: { width: 360, height: 900 }, deviceScaleFactor: 2 });
  page.on("pageerror", e => console.log("ERR", e.message));
  await page.addInitScript({ content: "window.__initialStore={settingsRev:1,androidRev:1,enabled:true,mode:'invert',fontPct:100,capPos:2,center:true,strokeWidth:1};" + fs.readFileSync("stub.js","utf8") + ";chrome.i18n={getUILanguage:()=>" + JSON.stringify(lang) + "};" });
  await page.goto("../src/popup.html"); await page.waitForTimeout(300);
  r[lang] = await page.evaluate(() => ({ lang: document.documentElement.lang, hint: document.querySelector(".hint").textContent, labels: [...document.querySelectorAll("[data-i18n]")].map(e => e.textContent).join(" | ") }));
  await page.setViewportSize({ width: 360, height: await page.evaluate(() => document.body.scrollHeight) });
  await page.screenshot({ path: file, fullPage: true }); await page.close();
}
console.log(JSON.stringify(r, null, 1)); await b.close();
