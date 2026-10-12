import { firefox } from "playwright";
import fs from "fs";
const cssFile = process.argv[2];
const browser = await firefox.launch({ headless: true });
const res = {};
for (const [label, store] of [["off", { enabled: false }], ["invert", { enabled: true, mode: "invert" }], ["stroke", { enabled: true, mode: "stroke" }], ["edge", { enabled: true, mode: "edge" }], ["invert_center", { enabled: true, mode: "invert", center: true }]]) {
  for (const n of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
    await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify(Object.assign({ settingsRev: 1 }, store)) + ";" + fs.readFileSync("stub.js", "utf8") });
    await page.goto("./styled.html");
    await page.addStyleTag({ content: fs.readFileSync(cssFile, "utf8") });
    await page.addScriptTag({ content: fs.readFileSync("../src/content.js", "utf8") });
    await page.waitForTimeout(200);
    await page.evaluate((n) => show(n), n);
    await page.waitForTimeout(150);
    const box = await page.evaluate(() => { const s = document.querySelectorAll(".ytp-caption-segment")[2]; const r = s.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const file = `./shot_${label}_${n}.png`;
    await page.screenshot({ path: file });
    res[label + "_windows" + n] = { file, box };
    await page.close();
  }
}
fs.writeFileSync("./shots.json", JSON.stringify(res));
await browser.close();
