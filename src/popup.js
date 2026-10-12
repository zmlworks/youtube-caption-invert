const MODES = ["invert", "stroke", "edge"];
const modeInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="mode"]'));
const enabled = document.getElementById("enabled");
const center = document.getElementById("center");
const shortcutOn = document.getElementById("shortcutOn");
const shortcutBtn = document.getElementById("shortcut");
const strokeWidth = document.getElementById("strokeWidth");
const weight = document.getElementById("weight");
const fontPct = document.getElementById("fontPct");
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
    edgeColor: "Set double-outline colors",
    recording: "Key",
  },
};
const MID = [205, 225, 255];

let shortcut = { alt: true, shift: true, ctrl: false, meta: false, key: "i", code: "KeyI" };
let lang = "ja";
let recording = false;

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
}

function paint(data) {
  const next = migrate(data || {});
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
  chrome.storage.local.set(
    Object.assign(
      {
        enabled: enabled.checked,
        center: center.checked,
        mode: selectedMode(),
        shortcutOn: shortcutOn.checked,
        shortcut: shortcut,
        strokeWidth: normWidth(strokeWidth.value),
        weight: normWeight(weight.value),
        fontPct: normPct(fontPct.value),
        videoLayer: videoLayer.checked,
        edgeCustom: edgeCustom.checked,
        fill: readRgb(fillInputs, [12, 39, 80]),
        mid: readRgb(midInputs, MID),
        settingsRev: 1,
        lang: lang,
      },
      extra || {},
    ),
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

chrome.storage.local.get(null, (data) => {
  paint(data || {});
});

// ページ側のショートカットで動作が変わったときなど、開いているポップアップにも反映する。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || recording) return;
  chrome.storage.local.get(null, (data) => {
    paint(data || {});
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
shortcutBtn.addEventListener("click", () => {
  recording = true;
  shortcutBtn.classList.add("is-on");
  shortcutBtn.textContent = TEXT[lang].recording;
  window.addEventListener("keydown", onRecord, true);
});
