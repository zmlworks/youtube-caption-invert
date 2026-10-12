(() => {
  const store = window.__initialStore || {};
  const listeners = [];
  window.__obsCalls = 0; window.__obsRecords = 0;
  const MO = window.MutationObserver;
  window.MutationObserver = class extends MO {
    constructor(cb) { super((recs, o) => { window.__obsCalls++; window.__obsRecords += recs.length; cb(recs, o); }); }
  };
  window.chrome = { runtime: { lastError: undefined, id: "x" }, storage: { local: {
    get(k, cb) { setTimeout(() => cb(JSON.parse(JSON.stringify(store))), 0); },
    set(obj, cb) { const changes = {}; for (const k in obj) { changes[k] = { newValue: obj[k] }; store[k] = obj[k]; }
      setTimeout(() => { listeners.forEach((l) => l(changes, "local")); cb && cb(); }, 0); } },
    onChanged: { addListener(f) { listeners.push(f); } } } };
  window.__store = store;
})();
