import { firefox } from "playwright";
import fs from "fs";
const b = await firefox.launch(); const p = await b.newPage({ viewport:{width:412,height:800}});
p.on("pageerror", e => console.log("ERR", e.message));
await p.addInitScript({ content: "window.__initialStore={};" + fs.readFileSync("stub.js","utf8") });
await p.goto("./mobile.html");
await p.addStyleTag({ content: fs.readFileSync("../src/invert.css","utf8") });
await p.addScriptTag({ content: fs.readFileSync("../src/content.js","utf8") });
await p.evaluate(()=>ytShow("字幕のテスト")); await p.waitForTimeout(400);
const r = await p.evaluate(()=>{const c=document.querySelector(".ytp-caption-window-container"),w=document.querySelector(".caption-window"),pl=document.getElementById("movie_player").getBoundingClientRect(),wr=w.getBoundingClientRect();
return {blend:getComputedStyle(c).mixBlendMode, z:getComputedStyle(c).zIndex, bottom:w.style.bottom, cs:getComputedStyle(w).bottom, centered: Math.abs((wr.left+wr.right)/2-(pl.left+pl.right)/2)<2, cls:document.documentElement.className};});
// cycle via synthetic touch in firefox
await p.evaluate(()=>{const w=document.querySelector(".ytp-caption-segment").getBoundingClientRect();const x=w.left+5,y=w.top+5;
 const ev=(t)=>new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerType:"touch"});
 document.getElementById("player-control-overlay").dispatchEvent(ev("pointerdown"));document.getElementById("player-control-overlay").dispatchEvent(ev("pointerup"));});
await p.waitForTimeout(100);
r.toast = await p.evaluate(()=>{const t=document.querySelector(".ytic-toast");return t&&{text:t.textContent,pos:getComputedStyle(t).position,pe:getComputedStyle(t).pointerEvents,inPlayer:t.parentElement.id}});
r.clsAfter = await p.evaluate(()=>document.documentElement.className);
console.log(JSON.stringify(r)); await b.close();
