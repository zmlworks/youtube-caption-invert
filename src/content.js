/* 字幕の色を反転 2.4.7
 * - 字幕の高さ（2.4.7）: ドラッグした後でも、ポップアップ（またはキー）で高さを変えたら、ドラッグした位置の
 *   字幕を選んだ段階へ移す（「保持」）。もう一度ドラッグすると、またドラッグした位置が優先される。
 *   E / D（変更可）で 1 段ずつ上下でき、値はポップアップと同じ設定（capPos）に保存する。
 * - 反転 / 反転+輪郭 / 二重フチ は CSS（invert.css）で描く。ここではクラスと CSS 変数を切り替えるだけ。
 * - 字幕サイズ: YouTube は .ytp-caption-segment のインライン style に font-size を書き、
 *   プレーヤーのサイズが変わるたびに書き直す。その値を元に倍率をかけて !important で上書きする。
 *   ロールアップ字幕だけは CSS 変数（--ytic-rf）で、YouTube が行の高さを測る前から大きくしておく。
 *   倍率は YouTube の「フォント サイズ」と同じ（300% = 1.75 倍）。
 * - 監視は字幕コンテナ（.ytp-caption-window-container）だけ。ページ全体の監視は
 *   「コンテナが増えたか」を調べる予約だけで、重い処理はしない。
 */
(function () {
  "use strict";

  const root = document.documentElement;
  if (!root) return;

  // 埋め込み以外のサブフレーム（ライブチャット等）では何もしない。チャットは DOM 変化が非常に多く重くなる。
  let isTop = true;
  try {
    isTop = window.top === window;
  } catch (e) {
    isTop = false;
  }
  const path = location.pathname || "";
  if (isTop ? /^\/live_chat/.test(path) : !/^\/embed\//.test(path)) return;

  if (root.dataset.yticExt === "247") return;
  root.dataset.yticExt = "247";

  const MODES = ["invert", "stroke", "edge"];
  const FONT_STEPS = [50, 75, 100, 150, 200, 300, 400];
  const DEFAULT_SHORTCUT = { alt: true, shift: true, ctrl: false, meta: false, key: "i", code: "KeyI" };
  const DEFAULT_UP = { alt: false, shift: false, ctrl: false, meta: false, key: "e", code: "KeyE" };
  const DEFAULT_DOWN = { alt: false, shift: false, ctrl: false, meta: false, key: "d", code: "KeyD" };
  const POS_MAX = 10;
  const HELD = "data-ytic-held";
  const DEFAULT_FILL = [12, 39, 80];
  const DEFAULT_MID = [205, 225, 255];
  const LIVE_CLASS = "ytic-cc-live";
  const LIVE_IDLE_MS = 15000;

  const state = {
    enabled: true,
    center: false,
    mode: "invert",
    shortcutOn: true,
    shortcut: Object.assign({}, DEFAULT_SHORTCUT),
    strokeWidth: 2,
    weight: 700,
    fontPct: 100,
    capPos: 1,
    posUpKey: Object.assign({}, DEFAULT_UP),
    posDownKey: Object.assign({}, DEFAULT_DOWN),
    lang: "ja",
    videoLayer: false,
    edgeCustom: false,
    fill: DEFAULT_FILL.slice(),
    mid: DEFAULT_MID.slice(),
  };

  /* ---------- 設定の正規化（popup.js と同じ規則） ---------- */

  function normWeight(value) {
    const n = Number(value);
    return n === 500 || n === 700 || n === 900 ? n : 700;
  }

  function normMode(value) {
    return MODES.indexOf(value) >= 0 ? value : "invert";
  }

  function normChannel(value, fallback) {
    const n = Number(value);
    if (value === "" || value === null || !Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function normRgb(value, fallback) {
    const src = Array.isArray(value) ? value : [];
    return [0, 1, 2].map((i) => normChannel(src[i], fallback[i]));
  }

  function normWidth(value) {
    const n = Number(value);
    if (value === "" || value === null || !Number.isFinite(n)) return 2;
    return Math.max(0, Math.min(16, Math.round(n)));
  }

  function normPct(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 100;
    return FONT_STEPS.reduce((best, step) => (Math.abs(step - n) < Math.abs(best - n) ? step : best), 100);
  }

  // 字幕の高さ: 1 = YouTube 標準（何もしない）、2〜10 = 下から上へ。
  function normPos(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1;
  }

  function normShortcut(value) {
    if (!value || typeof value !== "object" || !value.key) return Object.assign({}, DEFAULT_SHORTCUT);
    return {
      alt: value.alt === true,
      shift: value.shift === true,
      ctrl: value.ctrl === true,
      meta: value.meta === true,
      key: String(value.key).toLowerCase(),
      code: typeof value.code === "string" ? value.code : "",
    };
  }

  // 高さを 1 段動かすキー。null = 未設定（使わない）、未保存なら既定（E / D）。
  function normPosKey(value, fallback) {
    if (value === null) return null;
    if (!value || typeof value !== "object" || !value.key) return Object.assign({}, fallback);
    return normShortcut(value);
  }

  function migrate(data) {
    const fresh = data.settingsRev !== 1;
    const colors = {
      edgeCustom: data.edgeCustom === true,
      fill: normRgb(data.fill, DEFAULT_FILL),
      mid: fresh ? DEFAULT_MID.slice() : normRgb(data.mid, DEFAULT_MID),
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

  function applyStored(data) {
    const next = migrate(data || {});
    state.enabled = next.enabled;
    state.center = next.center;
    state.mode = normMode(next.mode);
    state.shortcutOn = next.shortcutOn;
    state.shortcut = next.shortcut;
    state.strokeWidth = next.strokeWidth;
    state.weight = next.weight;
    state.fontPct = next.fontPct;
    state.capPos = next.capPos;
    state.posUpKey = next.posUpKey;
    state.posDownKey = next.posDownKey;
    state.lang = next.lang;
    state.videoLayer = next.videoLayer;
    state.edgeCustom = next.edgeCustom;
    state.fill = next.fill;
    state.mid = next.mid;
  }

  /* ---------- 見た目（クラスと CSS 変数） ---------- */

  function cssRgb(channels) {
    return "rgb(" + channels[0] + " " + channels[1] + " " + channels[2] + ")";
  }

  function ring(radius, color) {
    const pts = [
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius, radius],
      [radius, -radius],
      [-radius, radius],
      [-radius, -radius],
    ];
    if (radius >= 2) {
      pts.push([radius, 1], [radius, -1], [-radius, 1], [-radius, -1], [1, radius], [-1, radius], [1, -radius], [-1, -radius]);
    }
    if (radius >= 4) {
      pts.push([radius, 2], [radius, -2], [-radius, 2], [-radius, -2], [2, radius], [-2, radius], [2, -radius], [-2, -radius]);
    }
    return pts.map((point) => point[0] + "px " + point[1] + "px 0 " + color).join(", ");
  }

  function rim(inner, outer) {
    return [1, 2].map((radius) => ring(radius, inner)).concat([3, 4, 5].map((radius) => ring(radius, outer))).join(", ");
  }

  function setVar(name, value) {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  }

  // YouTube 自身の「フォント サイズ」と同じ意味にする。YouTube の倍率は 1 + 0.25 × 段階（-2〜4）で、
  // 表示名と実際の倍率が違う（「300%」は 1.75 倍、「400%」は 2 倍）。captions.js の Ug$ / 設定 qNy を参照。
  const YT_MULT = { 50: 0.5, 75: 0.75, 100: 1, 150: 1.25, 200: 1.5, 300: 1.75, 400: 2 };

  function currentScale() {
    return state.enabled === true && state.fontPct !== 100 ? YT_MULT[state.fontPct] || 1 : 1;
  }

  function videoLayerWanted() {
    return state.enabled === true && state.videoLayer === true && state.mode !== "edge";
  }

  function apply() {
    const on = state.enabled === true;
    const centerOn = on && state.center === true;
    const native = on && !centerOn && (state.mode === "invert" || state.mode === "stroke");
    const custom = state.mode === "edge" && state.edgeCustom;
    const fill = custom ? cssRgb(state.fill) : "#fff";
    const inner = custom ? cssRgb(state.mid) : "#000";
    const outer = custom ? cssRgb(state.fill) : "#fff";
    root.classList.toggle("ytic-on", on);
    root.classList.toggle("ytic-native", native);
    root.classList.toggle("ytic-own", on && !native);
    if (centerOn) root.dataset.yticCenter = "1";
    else delete root.dataset.yticCenter;
    // 字幕の高さ。位置は invert.css が YouTube 標準の位置（bottom: 2%）にある枠だけを動かす。
    const pos = on && state.capPos > 1 ? String(state.capPos) : "";
    if (pos) {
      if (root.dataset.yticPos !== pos) root.dataset.yticPos = pos;
    } else delete root.dataset.yticPos;
    // ドラッグ後にポップアップ／キーで高さを変えたとき（保持中）は、ドラッグした位置の字幕も動かす。1 も含む。
    const hold = on && drag.held ? String(state.capPos) : "";
    if (hold) {
      if (root.dataset.yticHold !== hold) root.dataset.yticHold = hold;
    } else delete root.dataset.yticHold;
    root.classList.toggle("ytic-invert", on && state.mode === "invert");
    root.classList.toggle("ytic-stroke", on && state.mode === "stroke");
    root.classList.toggle("ytic-mode-edge", on && state.mode === "edge");
    root.classList.toggle("ytic-scaled", currentScale() !== 1);
    setVar("--ytic-fill", fill);
    setVar("--ytic-rim", rim(inner, outer));
    setVar("--ytic-weight", String(state.weight));
    setVar("--ytic-stroke-width", state.strokeWidth + "px");
    watched.forEach((entry, container) => {
      processTree(container, true, entry);
      setRollupFont(entry);
      updateLive(entry);
      entry.obs.takeRecords(); // 自分で書いた style の変更は捨てる
    });
    syncHeld();
  }

  /* ---------- ドラッグと高さの保持（2.4.7） ----------
     YouTube は字幕をドラッグすると、その位置（段・上下左右の割合）をプレーヤーの既定の位置として覚え、
     以後の字幕もすべてその位置に置く（再読み込みまで）。invert.css の高さの規則は YouTube 標準の位置
     （bottom: 2%）の枠だけが対象なので、ドラッグ後はポップアップで高さを変えても効かなかった。
     そこで、ドラッグしたときの位置（インラインの bottom/top と left/right）を覚えておき、その後ポップアップや
     キーで高さを変えたら「保持」にして、同じ位置の枠に印（data-ytic-held）を付けて CSS で選んだ段階へ移す。
     投稿者が位置を指定した字幕は位置が違うので動かさない。もう一度ドラッグしたら保持をやめる。 */

  const drag = { sig: "", held: false, el: null };

  // 枠の位置の目印。YouTube が測っている途中（max-height を書いている）なら "" を返す。
  function winSig(el) {
    const st = el.style;
    if (st.maxHeight) return "";
    const v = st.bottom ? "b" + st.bottom : st.top ? "t" + st.top : "";
    if (!v) return "";
    return v + "|" + (st.left ? "l" + st.left : st.right ? "r" + st.right : "");
  }

  function setHeld(el, on) {
    if (on) {
      if (!el.hasAttribute(HELD)) el.setAttribute(HELD, "");
    } else if (el.hasAttribute(HELD)) el.removeAttribute(HELD);
  }

  function eachWindow(fn) {
    watched.forEach((entry, container) => {
      const list = container.getElementsByClassName("caption-window");
      for (let i = list.length - 1; i >= 0; i--) fn(list[i]);
    });
  }

  function syncHeld() {
    if (drag.held && drag.sig) {
      eachWindow((el) => {
        if (el.classList.contains("ytp-dragging")) setHeld(el, false);
        else {
          const sig = winSig(el);
          if (sig) setHeld(el, sig === drag.sig);
        }
      });
    } else eachWindow((el) => setHeld(el, false));
  }

  // style が変わった枠 / 追加された枠ごとに呼ぶ。
  function checkWindow(el) {
    if (el.classList.contains("ytp-dragging")) {
      // ユーザーがドラッグ中。YouTube がこの位置を書いたあとなので、ここで保持をやめても跳ねない。
      const sig = winSig(el);
      if (sig) drag.sig = sig;
      drag.el = el;
      setHeld(el, false);
      if (drag.held) {
        drag.held = false;
        delete root.dataset.yticHold;
        syncHeld();
      }
      return;
    }
    if (!drag.held || !drag.sig) return;
    const sig = winSig(el);
    if (sig) setHeld(el, sig === drag.sig);
  }

  function trackWindows(records) {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (record.type === "attributes") {
        const target = record.target;
        if (target.classList && target.classList.contains("caption-window")) checkWindow(target);
      } else if (drag.held) {
        const added = record.addedNodes;
        for (let j = 0; j < added.length; j++) {
          const node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.classList.contains("caption-window")) checkWindow(node);
          else if (node.firstElementChild) {
            const list = node.getElementsByClassName("caption-window");
            for (let k = 0; k < list.length; k++) checkWindow(list[k]);
          }
        }
      }
    }
  }

  // 段階ごとの「枠の上端」（プレーヤーの高さに対する割合）。invert.css の値と同じ。h = 枠の高さの割合。
  const POS_BOTTOM = { 1: 0.02, 2: 0.12, 3: 0.22, 4: 0.32, 5: 0.42 };
  const POS_TOP = { 6: 0.42, 7: 0.32, 8: 0.22, 9: 0.12, 10: 0.02 };

  function stepTop(step, h) {
    return step <= 5 ? 1 - POS_BOTTOM[step] - h : POS_TOP[step];
  }

  function nearestStep(top, h) {
    let best = 1;
    for (let s = 2; s <= POS_MAX; s++) {
      if (Math.abs(stepTop(s, h) - top) < Math.abs(stepTop(best, h) - top)) best = s;
    }
    return best;
  }

  // ドラッグした字幕が今どの段階に一番近いか。見えている枠を測る。無ければ覚えている位置から見積もる。
  function draggedStep() {
    let el = drag.el && drag.el.isConnected && drag.el.offsetHeight ? drag.el : null;
    if (!el) {
      eachWindow((w) => {
        if (!el && w.offsetHeight && winSig(w) === drag.sig) el = w;
      });
    }
    if (el) {
      const box = el.parentElement && el.parentElement.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (box && box.height > 0) return nearestStep((r.top - box.top) / box.height, r.height / box.height);
    }
    const m = /^([bt])(-?[\d.]+)%/.exec(drag.sig);
    if (!m) return state.capPos;
    const h = 0.1; // 字幕 1〜2 行ぶんのおおよその高さ
    const v = parseFloat(m[2]) / 100;
    return nearestStep(m[1] === "b" ? 1 - v - h : v, h);
  }

  /* ---------- 字幕サイズ ---------- */

  // 要素ごとに「YouTube が書いた元の値」と「こちらが書いた値」を覚える。DOM には印を書かない。
  const marks = new WeakMap();

  function scaleProp(el, prop, scale) {
    const st = el.style;
    const cur = st.getPropertyValue(prop);
    let per = marks.get(el);
    if (!cur) {
      if (per) delete per[prop];
      return;
    }
    if (!per) {
      if (scale === 1) return;
      per = {};
      marks.set(el, per);
    }
    let m = per[prop];
    if (!m || cur !== m.applied || (m.applied && st.getPropertyPriority(prop) !== "important")) {
      // 値が違う、または !important が外れている = YouTube が書き直した（たまたま同じ値でも区別できる）。
      // YouTube が新しい値を書いた（初回・リサイズ・字幕更新）。これを基準にする。
      m = per[prop] = { base: cur, applied: "" };
    }
    if (scale === 1) {
      if (m.applied && cur === m.applied) st.setProperty(prop, m.base);
      delete per[prop];
      return;
    }
    if (!/px$/.test(m.base)) return;
    const px = parseFloat(m.base);
    if (!(px > 0)) return;
    const want = Math.round(px * scale * 100) / 100 + "px";
    if (cur !== want || st.getPropertyPriority(prop) !== "important") st.setProperty(prop, want, "important");
    m.applied = st.getPropertyValue(prop);
  }

  /* ロールアップ字幕（自動生成字幕など、行が下から上へ流れる字幕）は、YouTube が行の高さを測って
     流す量と枠の高さを決める。後から文字を大きくすると測った値と合わなくなり、行が跳ねたり戻ったりする。
     そこでロールアップ字幕だけは、YouTube が測る前から効いている CSS（--ytic-rf）で大きくする。
     値は「YouTube が書いた文字サイズ × 倍率」で、入れ物ごとに 1 つ。YouTube が文字サイズを書き直したら更新する。 */
  function setRollupFont(entry) {
    const container = entry.container;
    const scale = currentScale();
    const base = entry.rfBase;
    if (scale === 1) entry.rfBase = "";
    if (scale === 1 || !base || !/px$/.test(base) || !(parseFloat(base) > 0)) {
      if (container.classList.contains("ytic-rf")) {
        container.classList.remove("ytic-rf");
        container.style.removeProperty("--ytic-rf");
      }
      return;
    }
    const want = Math.round(parseFloat(base) * scale * 100) / 100 + "px";
    if (container.style.getPropertyValue("--ytic-rf") !== want) container.style.setProperty("--ytic-rf", want);
    if (!container.classList.contains("ytic-rf")) container.classList.add("ytic-rf");
  }

  function noteRollupFont(entry, seg) {
    const base = seg.style.getPropertyValue("font-size");
    if (!base || base === entry.rfBase) return;
    entry.rfBase = base;
    setRollupFont(entry);
  }

  function inRollup(el) {
    const win = el.classList.contains("caption-window") ? el : el.closest(".caption-window");
    return !!win && win.classList.contains("ytp-caption-window-rollup");
  }

  function handleEl(el, scale, entry) {
    const cl = el.classList;
    if (!cl) return;
    const seg = cl.contains("ytp-caption-segment");
    if (!seg && !cl.contains("caption-window")) return;
    if (inRollup(el)) {
      // ロールアップは CSS 側で拡大する。以前の版がインラインに書いた値が残っていれば戻す。
      if (marks.has(el)) scaleProp(el, seg ? "font-size" : "width", 1);
      if (seg && entry && scale !== 1) noteRollupFont(entry, el);
      return;
    }
    scaleProp(el, seg ? "font-size" : "width", scale);
  }

  function processTree(node, full, entry) {
    const scale = currentScale();
    if (scale === 1 && !full) return;
    if (node.nodeType !== 1) return;
    if (node.classList.contains("ytp-caption-segment") || node.classList.contains("caption-window")) handleEl(node, scale, entry);
    if (node.firstElementChild) {
      const list = node.querySelectorAll(".caption-window, .ytp-caption-segment");
      for (let i = 0; i < list.length; i++) handleEl(list[i], scale, entry);
    }
  }

  /* ---------- 映像を別レイヤー（字幕が出ている間だけ） ---------- */

  function setLive(entry, live) {
    if (entry.live === live) return;
    entry.live = live;
    if (entry.player) entry.player.classList.toggle(LIVE_CLASS, live);
  }

  function updateLive(entry) {
    if (!videoLayerWanted()) {
      if (entry.idle) clearTimeout(entry.idle);
      entry.idle = 0;
      setLive(entry, false);
      return;
    }
    if (entry.windows.length) {
      if (entry.idle) clearTimeout(entry.idle);
      entry.idle = 0;
      setLive(entry, true);
    } else if (entry.live && !entry.idle) {
      // 字幕と字幕の間で毎回付け外しするとちらつきが戻るので、しばらく字幕が無いときだけ外す。
      entry.idle = setTimeout(() => {
        entry.idle = 0;
        if (!entry.windows.length) setLive(entry, false);
      }, LIVE_IDLE_MS);
    }
  }

  /* ---------- 字幕コンテナの監視 ---------- */

  const watched = new Map(); // container -> entry

  function onCaptionMutations(entry, records) {
    trackWindows(records);
    if (currentScale() !== 1) {
      const scale = currentScale();
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        if (record.type === "attributes") {
          handleEl(record.target, scale, entry);
        } else {
          const added = record.addedNodes;
          for (let j = 0; j < added.length; j++) {
            if (added[j].nodeType === 1) processTree(added[j], false, entry);
          }
        }
      }
    }
    if (entry.live || videoLayerWanted()) updateLive(entry);
    entry.obs.takeRecords(); // 自分の書き込みで生じた記録を捨てる（ループ防止）
  }

  function attach(container) {
    if (watched.has(container)) return;
    const entry = {
      container: container,
      rfBase: "",
      player: container.closest(".html5-video-player") || container.parentElement,
      windows: container.getElementsByClassName("caption-window"), // ライブコレクション（安い）
      live: false,
      idle: 0,
      obs: null,
    };
    entry.obs = new MutationObserver((records) => onCaptionMutations(entry, records));
    entry.obs.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    watched.set(container, entry);
    processTree(container, false, entry);
    updateLive(entry);
    entry.obs.takeRecords();
  }

  function detach(container, entry) {
    entry.obs.disconnect();
    if (entry.idle) clearTimeout(entry.idle);
    if (entry.player) entry.player.classList.remove(LIVE_CLASS);
    container.classList.remove("ytic-rf");
    container.style.removeProperty("--ytic-rf");
    watched.delete(container);
  }

  let scanTimer = 0;

  function scan() {
    scanTimer = 0;
    watched.forEach((entry, container) => {
      if (!container.isConnected) detach(container, entry);
    });
    const list = document.getElementsByClassName("ytp-caption-window-container");
    for (let i = 0; i < list.length; i++) attach(list[i]);
  }

  function queueScan() {
    if (!scanTimer) scanTimer = setTimeout(scan, 250);
  }

  function startWatching() {
    scan();
    // ページ全体の監視は「探し直しを予約する」だけ（O(1)）。字幕の細かな変化はコンテナ側の監視で扱う。
    new MutationObserver(queueScan).observe(document.body || root, { childList: true, subtree: true });
    document.addEventListener("yt-navigate-finish", queueScan);
    document.addEventListener("fullscreenchange", queueScan);
  }

  if (document.body) startWatching();
  else document.addEventListener("DOMContentLoaded", startWatching, { once: true });

  /* ---------- ショートカット ---------- */

  function matchShortcut(event) {
    const shortcut = state.shortcut;
    if (!state.shortcutOn || !shortcut || event.repeat) return false;
    if (!!event.altKey !== !!shortcut.alt) return false;
    if (!!event.shiftKey !== !!shortcut.shift) return false;
    if (!!event.ctrlKey !== !!shortcut.ctrl) return false;
    if (!!event.metaKey !== !!shortcut.meta) return false;
    if (shortcut.code && event.code === shortcut.code) return true;
    return (event.key || "").toLowerCase() === shortcut.key;
  }

  // 高さのキー（2.4.7）。押しっぱなしでも続けて動く。修飾キーは記録どおりに一致したときだけ。
  function matchKey(event, key) {
    if (!key) return false;
    if (!!event.altKey !== !!key.alt) return false;
    if (!!event.shiftKey !== !!key.shift) return false;
    if (!!event.ctrlKey !== !!key.ctrl) return false;
    if (!!event.metaKey !== !!key.meta) return false;
    if (key.code && event.code === key.code) return true;
    return (event.key || "").toLowerCase() === key.key;
  }

  function isTyping(target) {
    const tag = target && target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!(target && target.isContentEditable);
  }

  // 表示中のプレーヤー（フォーカスのあるもの、なければ一番大きいもの）。
  function activePlayer() {
    let best = null;
    let area = 0;
    const active = document.activeElement;
    watched.forEach((entry) => {
      const player = entry.player;
      if (!player || !player.isConnected) return;
      const a = player.offsetWidth * player.offsetHeight;
      if (!a) return;
      const focused = active && player.contains(active);
      if (focused && !(best && best.contains(active))) {
        best = player;
        area = Infinity;
      } else if (a > area) {
        best = player;
        area = a;
      }
    });
    return best;
  }

  let badge = null;
  let badgeTimer = 0;

  function showBadge(pos) {
    const player = activePlayer();
    if (!player) return;
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "ytic-badge";
      badge.setAttribute("aria-live", "polite");
    }
    if (badge.parentNode !== player) player.appendChild(badge);
    badge.textContent = (state.lang === "en" ? "Caption height " : "字幕の高さ ") + pos + "/" + POS_MAX;
    badge.classList.add("ytic-badge-on");
    if (badgeTimer) clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => {
      badgeTimer = 0;
      if (badge) badge.classList.remove("ytic-badge-on");
    }, 1000);
  }

  function stepHeight(dir) {
    // ドラッグした位置が優先されているときは、今の字幕の位置に一番近い段階から動かす。
    const from = drag.sig && !drag.held ? draggedStep() : state.capPos;
    const next = Math.max(1, Math.min(POS_MAX, from + dir));
    state.capPos = next;
    if (drag.sig) drag.held = true;
    apply();
    showBadge(next);
    try {
      chrome.storage.local.set({ capPos: next });
    } catch (e) {
      /* 拡張機能の更新直後など。表示は変わっているので無視する。 */
    }
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (state.enabled === true && watched.size && !event.isComposing) {
        const dir = matchKey(event, state.posUpKey) ? 1 : matchKey(event, state.posDownKey) ? -1 : 0;
        if (dir && !isTyping(event.target)) {
          event.preventDefault();
          event.stopPropagation();
          stepHeight(dir);
          return;
        }
      }
      if (!matchShortcut(event)) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      const index = MODES.indexOf(state.mode);
      state.mode = MODES[(index + 1) % MODES.length];
      state.enabled = true;
      apply();
      try {
        chrome.storage.local.set({ mode: state.mode, enabled: true });
      } catch (e) {
        /* 拡張機能の更新直後など。表示は切り替わっているので無視する。 */
      }
    },
    true,
  );

  /* ---------- 設定の読み込みと同期 ---------- */

  function load(first) {
    try {
      chrome.storage.local.get(null, (data) => {
        if (chrome.runtime.lastError) return;
        const stored = data || {};
        applyStored(stored);
        apply();
        if (first && stored.settingsRev !== 1) chrome.storage.local.set(migrate(stored));
      });
    } catch (e) {
      /* ignore */
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    // ポップアップ（または別のタブのキー）で高さが変わった。ドラッグした位置より優先する。
    if (changes.capPos && drag.sig && normPos(changes.capPos.newValue) !== state.capPos) drag.held = true;
    load(false);
  });

  load(true);
})();
