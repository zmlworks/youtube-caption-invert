import { firefox } from "playwright";
import fs from "fs";
const browser = await firefox.launch({ headless: true });
const res = {};
for (const [lang, file] of [["ja", "../docs/popup-2.4.3.png"], ["en", "./popup-2.4.3-en.png"]]) {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 }, deviceScaleFactor: 2 });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify({ settingsRev: 1, enabled: true, mode: "invert", fontPct: 100, capPos: 1, lang }) + ";" + fs.readFileSync("stub.js", "utf8") });
  await page.goto("../src/popup.html");
  await page.waitForTimeout(300);
  res[lang] = await page.evaluate(() => ({ label: document.querySelector('[data-i18n="capPos"]').textContent, value: document.getElementById("capPos").value, options: Array.from(document.getElementById("capPos").options).map((o) => o.textContent), order: Array.from(document.querySelectorAll("main > *")).map((e) => e.querySelector("[data-i18n]") ? e.querySelector("[data-i18n]").getAttribute("data-i18n") : e.tagName).slice(-5) }));
  if (lang === "ja") {
    await page.selectOption("#capPos", "7"); await page.waitForTimeout(100);
    res.savedAfterSelect7 = await page.evaluate(() => window.__store.capPos);
    await page.selectOption("#capPos", "1"); await page.waitForTimeout(100);
  }
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 320, height: h });
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}
console.log(JSON.stringify(res, null, 1));
await browser.close();
