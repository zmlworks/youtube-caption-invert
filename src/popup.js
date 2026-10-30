const MODES = ["invert", "stroke", "edge"];
const modeInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="mode"]'));
const enabled = document.getElementById("enabled");
const center = document.getElementById("center");
const shortcutOn = document.getElementById("shortcutOn");
const shortcutBtn = document.getElementById("shortcut");
const strokeWidth = document.getElementById("strokeWidth");
const weight = document.getElementById("weight");
const fontPct = document.getElementById("fontPct");
const capPos = document.getElementById("capPos");
const posUpBtn = document.getElementById("posUpKey");
const posDownBtn = document.getElementById("posDownKey");
const videoLayer = document.getElementById("videoLayer");
const edgeCustom = document.getElementById("edgeCustom");
const edgeColors = document.getElementById("edgeColors");
const fillInputs = ["fillR", "fillG", "fillB"].map((id) => document.getElementById(id));
const midInputs = ["midR", "midG", "midB"].map((id) => document.getElementById(id));

const langInput = document.getElementById("lang");
const TEXT = {
  ja: {
    title: "字幕の色を反転",
    enabled: "オン",
    center: "中央に寄せる",
    shortcut: "ショートカットキーで動作を切り替える",
    videoLayer: "映像を別レイヤーにする（ちらつき対策）",
    mode: "動作",
    invert: "反転",
    stroke: "反転 + 輪郭",
    edge: "二重フチ",
    outline: "輪郭の太さ（反転 + 輪郭のみ）",
    weight: "文字の太さ",
    fontScale: "字幕サイズ",
    fontOff: "100%（標準）",
    capPos: "字幕の高さ",
    capPosDefault: "1（YouTube標準）",
    capPosTop: "10（いちばん上）",
    posUp: "高さを 1 段上げるキー",
    posDown: "高さを 1 段下げるキー",
    posKeyHint: "クリックしてキーを押す（Backspace で解除）",
    keyNone: "なし",
    edgeColor: "二重フチの色を指定",
    recording: "キー",
  },
  en: {
    title: "Invert subtitle colors",
    enabled: "On",
    center: "Center",
    shortcut: "Cycle modes with shortcut key",
    videoLayer: "Separate video layer (anti-flicker)",
    mode: "Mode",
    invert: "Invert",
    stroke: "Invert + outline",
    edge: "Double outline",
    outline: "Outline width (Invert + outline only)",
    weight: "Font weight",
    fontScale: "Caption size",
    fontOff: "100% (default)",
    capPos: "Caption height",
    capPosDefault: "1 (YouTube default)",
    capPosTop: "10 (top)",
    posUp: "Key: caption up 1 step",
    posDown: "Key: caption down 1 step",
    posKeyHint: "Click, then press a key (Backspace clears)",
    keyNone: "None",
    edgeColor: "Set double-outline colors",
    recording: "Key",
  },
};
const MID = [205, 225, 255];

let shortcut = { alt: true, shift: true, ctrl: false, meta: false, key: "i", code: "KeyI" };
const DEFAULT_UP = { alt: false, shift: false, ctrl: false, meta: false, key: "e", code: "KeyE" };
const DEFAULT_DOWN = { alt: false, shift: false, ctrl: false, meta: false, key: "d", code: "KeyD" };
let posUpKey = Object.assign({}, DEFAULT_UP);
let posDownKey = Object.assign({}, DEFAULT_DOWN);
let lang = "ja";
let recording = false;
let posRecording = null; // 記録中の高さキーのボタン（posUpBtn / posDownBtn）
let posStoppedAt = 0;

function normWeight(value) {
  const n = Number(value);
  return n === 500 || n === 700 || n === 900 ? n : 700;
}

function normMode(value) {
  return MODES.indexOf(value) >= 0 ? value : "invert";
}

function normChannel(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function normRgb(value, fallback) {
  const src = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((i) => normChannel(src[i], fallback[i]));
}

function normPct(value) {
  const steps = [50, 75, 100, 150, 200, 300, 400];
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return steps.reduce((best, step) => (Math.abs(step - n) < Math.abs(best - n) ? step : best), 100);
}

function normPos(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1;
}

function normWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(16, Math.round(n)));
}

function normShortcut(value) {
  const fallback = { alt: true, shift: true, ctrl: false, meta: false, key: "i", code: "KeyI" };
  if (!value || typeof value !== "object" || !value.key) return fallback;
  return {
    alt: value.alt === true,
    shift: value.shift === true,
    ctrl: value.ctrl === true,
    meta: value.meta === true,
    key: String(value.key).toLowerCase(),
    code: typeof value.code === "string" ? value.code : "",
  };
}

// 高さを 1 段動かすキー。null = 未設定、未保存なら既定（E / D）。
function normPosKey(value, fallback) {
  if (value === null) return null;
  if (!value || typeof value !== "object" || !value.key) return Object.assign({}, fallback);
  return normShortcut(value);
}

function sameKey(a, b) {
  return !!a && !!b && a.alt === b.alt && a.shift === b.shift && a.ctrl === b.ctrl && a.meta === b.meta && (a.code && b.code ? a.code === b.code : a.key === b.key);
}

function formatShortcut(value) {
  const names = { " ": "Space", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→" };
  const parts = [];
  if (value.ctrl) parts.push("Ctrl");
  if (value.alt) parts.push("Alt");
  if (value.shift) parts.push("Shift");
  if (value.meta) parts.push("Meta");
  const key = names[value.key] || (value.key.length === 1 ? value.key.toUpperCase() : value.key);
  parts.push(key);
  return parts.join("+");
}

function migrate(data) {
  const fresh = data.settingsRev !== 1;
  const colors = {
    edgeCustom: data.edgeCustom === true,
    fill: normRgb(data.fill, [12, 39, 80]),
    mid: fresh ? MID.slice() : normRgb(data.mid, MID),
  };
  const common = {
    center: data.center === true,
    shortcutOn: data.shortcutOn !== false,
    shortcut: normShortcut(data.shortcut),
    strokeWidth: fresh ? 2 : normWidth(data.strokeWidth),
    weight: fresh ? 700 : normWeight(data.weight),
    fontPct: normPct(data.fontPct),
    capPos: normPos(data.capPos),
    posUpKey: normPosKey(data.posUpKey, DEFAULT_UP),
    posDownKey: normPosKey(data.posDownKey, DEFAULT_DOWN),
    videoLayer: data.videoLayer === true,
    settingsRev: 1,
    lang: data.lang === "en" ? "en" : "ja",
  };
  if (MODES.indexOf(data.mode) >= 0 && typeof data.enabled === "boolean") {
    return Object.assign({ enabled: data.enabled, mode: data.mode }, common, colors);
  }
  if (data.phase === "off") return Object.assign({ enabled: false, mode: "invert" }, common, colors);
  if (data.phase === "edge" || data.mode === "rim") return Object.assign({ enabled: true, mode: "edge" }, common, colors);
  if (data.phase === "invert") return Object.assign({ enabled: true, mode: "invert" }, common, colors);
  if (data.enabled === false) return Object.assign({ enabled: false, mode: "invert" }, common, colors);
  return Object.assign({ enabled: true, mode: "invert" }, common, colors);
}

function selectedMode() {
  const found = modeInputs.find((input) => input.checked);
  return normMode(found && found.value);
}

function readRgb(inputs, fallback) {
  return inputs.map((input, i) => normChannel(input.value, fallback[i]));
}

function syncModeLabels() {
  // :has() は Firefox 121 未満で使えないので、選択中の枠の色付けを JS でも行う。
  modeInputs.forEach((input) => {
    if (input.parentElement) input.parentElement.classList.toggle("is-checked", input.checked);
  });
}

function syncColors() {
  edgeColors.classList.toggle("is-off", !edgeCustom.checked);
}

function applyLang() {
  const text = TEXT[lang] || TEXT.ja;
  document.documentElement.lang = lang === "en" ? "en" : "ja";
  document.title = text.title;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (text[key]) node.textContent = text[key];
  });
  enabled.setAttribute("aria-label", text.enabled);
  langInput.checked = lang === "en";
  const fontOff = fontPct.querySelector('option[value="100"]');
  if (fontOff) fontOff.textContent = text.fontOff;
  if (recording) shortcutBtn.textContent = text.recording;
  paintPosKeys();
}

function paintPosKeys() {
  const text = TEXT[lang] || TEXT.ja;
  [
    [posUpBtn, posUpKey],
    [posDownBtn, posDownKey],
  ].forEach(([btn, key]) => {
    if (posRecording === btn) {
      btn.textContent = text.recording;
      btn.classList.remove("is-unset");
      return;
    }
    btn.textContent = key ? formatShortcut(key) : text.keyNone;
    btn.classList.toggle("is-unset", !key);
  });
}

// 2.4.8: 保存するのは、ポップアップで変えた項目（最後に表示した値との差分）と、未移行なら移行に必要な項目だけ。
// 全項目を書くと、ページ側のキーで変わった高さなどを、表示が古いままの値で上書きしてしまう。
let painted = null; // 最後に表示した値（migrate 済み）
let latestStored = {}; // 最新の保存内容

function migrationPatch(data) {
  const next = migrate(data);
  const base = migrate({ settingsRev: 1 });
  const patch = {};
  Object.keys(next).forEach((k) => {
    const v = JSON.stringify(next[k]);
    if (v === JSON.stringify(data[k])) return;
    if (data[k] === undefined && v === JSON.stringify(base[k])) return;
    patch[k] = next[k];
  });
  if (data.settingsRev !== 1) patch.settingsRev = 1;
  // 旧形式（phase など）から決まる動作は、enabled / mode として明示的に保存する
  if (!(MODES.indexOf(data.mode) >= 0 && typeof data.enabled === "boolean")) {
    patch.enabled = next.enabled;
    patch.mode = next.mode;
  }
  return patch;
}

function paint(data) {
  const next = migrate(data || {});
  painted = next;
  lang = next.lang;
  enabled.checked = next.enabled;
  center.checked = next.center;
  modeInputs.forEach((input) => {
    input.checked = input.value === next.mode;
  });
  shortcutOn.checked = next.shortcutOn;
  shortcut = next.shortcut;
  if (!recording) shortcutBtn.textContent = formatShortcut(shortcut);
  strokeWidth.value = String(next.strokeWidth);
  weight.value = String(next.weight);
  fontPct.value = String(next.fontPct);
  capPos.value = String(next.capPos);
  posUpKey = next.posUpKey;
  posDownKey = next.posDownKey;
  videoLayer.checked = next.videoLayer;
  edgeCustom.checked = next.edgeCustom;
  next.fill.forEach((channel, i) => {
    fillInputs[i].value = String(channel);
  });
  next.mid.forEach((channel, i) => {
    midInputs[i].value = String(channel);
  });
  syncModeLabels();
  syncColors();
  applyLang();
}

function save(extra) {
  const form = Object.assign(
      {
        enabled: enabled.checked,
        center: center.checked,
        mode: selectedMode(),
        shortcutOn: shortcutOn.checked,
        shortcut: shortcut,
        strokeWidth: normWidth(strokeWidth.value),
        weight: normWeight(weight.value),
        fontPct: normPct(fontPct.value),
        capPos: normPos(capPos.value),
        posUpKey: posUpKey,
        posDownKey: posDownKey,
        videoLayer: videoLayer.checked,
        edgeCustom: edgeCustom.checked,
        fill: readRgb(fillInputs, [12, 39, 80]),
        mid: readRgb(midInputs, MID),
        settingsRev: 1,
        lang: lang,
      },
      extra || {},
    );
  const patch = latestStored.settingsRev === 1 ? {} : migrationPatch(latestStored);
  Object.keys(form).forEach((k) => {
    if (!painted || JSON.stringify(form[k]) !== JSON.stringify(painted[k])) patch[k] = form[k];
  });
  if (painted) Object.assign(painted, patch);
  if (!Object.keys(patch).length) return;
  chrome.storage.local.set(
    patch,
    () => {
      if (chrome.runtime.lastError) console.error("字幕の色を反転: 保存に失敗しました", chrome.runtime.lastError);
    },
  );
}

function onRecord(event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") {
    recording = false;
    window.removeEventListener("keydown", onRecord, true);
    shortcutBtn.classList.remove("is-on");
    shortcutBtn.textContent = formatShortcut(shortcut);
    return;
  }
  if (event.key === "Alt" || event.key === "Shift" || event.key === "Control" || event.key === "Meta") return;
  shortcut = normShortcut({
    alt: event.altKey,
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    key: event.key,
    code: event.code,
  });
  recording = false;
  window.removeEventListener("keydown", onRecord, true);
  shortcutBtn.classList.remove("is-on");
  shortcutBtn.textContent = formatShortcut(shortcut);
  save();
}

function stopPosRecord() {
  if (!posRecording) return;
  posRecording.classList.remove("is-on");
  posRecording = null;
  posStoppedAt = Date.now();
  window.removeEventListener("keydown", onPosRecord, true);
  paintPosKeys();
}

// 高さキーの記録: クリック → キーを押す（例 E、Shift+E）。Backspace / Delete で解除、Esc で取り消し。
function onPosRecord(event) {
  event.preventDefault();
  event.stopPropagation();
  const btn = posRecording;
  if (!btn) return;
  if (event.key === "Escape") {
    stopPosRecord();
    return;
  }
  if (event.key === "Alt" || event.key === "Shift" || event.key === "Control" || event.key === "Meta" || event.key === "Process" || event.isComposing) return;
  let key = null;
  if (!((event.key === "Backspace" || event.key === "Delete") && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)) {
    key = normShortcut({
      alt: event.altKey,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      key: event.key,
      code: event.code,
    });
  }
  if (btn === posUpBtn) {
    posUpKey = key;
    if (sameKey(key, posDownKey)) posDownKey = null; // 同じキーを両方に割り当てない
  } else {
    posDownKey = key;
    if (sameKey(key, posUpKey)) posUpKey = null;
  }
  stopPosRecord();
  save();
}

function startPosRecord(btn, event) {
  // Space / Enter を記録した直後に、そのキーでボタンが押された扱い（detail 0 のクリック）になるのを無視する。
  if (recording || (event && event.detail === 0 && Date.now() - posStoppedAt < 400)) return;
  if (posRecording === btn) {
    stopPosRecord();
    return;
  }
  stopPosRecord();
  posRecording = btn;
  btn.classList.add("is-on");
  paintPosKeys();
  window.addEventListener("keydown", onPosRecord, true);
}

chrome.storage.local.get(null, (data) => {
  latestStored = data || {};
  paint(latestStored);
});

// ページ側のショートカットで動作が変わったときなど、開いているポップアップにも反映する。
// キーの記録中は表示を変えない（保存は変えた項目だけなので、その間の変更を古い値で戻すことはない）。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  chrome.storage.local.get(null, (data) => {
    latestStored = data || {};
    if (recording || posRecording) return;
    paint(latestStored);
  });
});

enabled.addEventListener("change", () => save());
center.addEventListener("change", () => save());
shortcutOn.addEventListener("change", () => save());
modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    syncModeLabels();
    if (input.checked) save();
  });
});
edgeCustom.addEventListener("change", () => {
  syncColors();
  save();
});
weight.addEventListener("change", () => save());
fontPct.addEventListener("change", () => save());
capPos.addEventListener("change", () => save());
videoLayer.addEventListener("change", () => save());
strokeWidth.addEventListener("change", () => {
  strokeWidth.value = String(normWidth(strokeWidth.value));
  save();
});
fillInputs.concat(midInputs).forEach((input) => {
  input.addEventListener("change", () => {
    const onFill = fillInputs.indexOf(input) >= 0;
    const fallback = onFill ? [12, 39, 80] : MID;
    const index = onFill ? fillInputs.indexOf(input) : midInputs.indexOf(input);
    input.value = String(normChannel(input.value, fallback[index]));
    save();
  });
});
langInput.addEventListener("change", () => {
  lang = langInput.checked ? "en" : "ja";
  applyLang();
  save();
});
posUpBtn.addEventListener("click", (event) => startPosRecord(posUpBtn, event));
posDownBtn.addEventListener("click", (event) => startPosRecord(posDownBtn, event));
shortcutBtn.addEventListener("click", () => {
  stopPosRecord();
  recording = true;
  shortcutBtn.classList.add("is-on");
  shortcutBtn.textContent = TEXT[lang].recording;
  window.addEventListener("keydown", onRecord, true);
});
