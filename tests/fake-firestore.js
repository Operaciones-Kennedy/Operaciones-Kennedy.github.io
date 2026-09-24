// Firebase simulado en memoria para pruebas: Auth (usuario fijo), Firestore
// (colecciones, documentos, onSnapshot, transacciones, orderBy/limit) y Storage.
(function(){
  const params = window.__fakeParams || {};
  const user = { email: params.email || 'prueba@kennedy.cl' };
  const docs = {};        // 'coleccion/id' -> datos
  const listeners = {};   // 'coleccion/id' -> [callbacks]
  window.__uploads = [];
  window.__writes = [];
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o, (k, v) => (v && v.__ts) ? { __ts: true } : v));
  function snap(key){
    const d = docs[key];
    return { exists: !!d, id: key.split("/")[1], data: () => (d ? Object.assign({}, d) : undefined), metadata: { hasPendingWrites: false } };
  }
  function notify(key){ (listeners[key] || []).slice().forEach(cb => setTimeout(() => cb(snap(key)), 0)); }
  function write(key, data, opts){
    docs[key] = (opts && opts.merge && docs[key]) ? Object.assign({}, docs[key], clone(data)) : clone(data);
    window.__writes.push(key);
    notify(key);
  }
  function ref(coll, id){
    const key = coll + '/' + id;
    return {
      __key: key, id,
      get: async () => snap(key),
      set: async (data, opts) => { if(params.offline) throw Object.assign(new Error('offline'), { code: 'unavailable' }); write(key, data, opts); },
      onSnapshot(cb){ (listeners[key] = listeners[key] || []).push(cb); setTimeout(() => cb(snap(key)), 0); return () => { listeners[key] = listeners[key].filter(x => x !== cb); }; }
    };
  }
  function query(coll, field, dir, n){
    return {
      limit: m => query(coll, field, dir, m),
      get: async () => {
        let list = Object.keys(docs).filter(k => k.startsWith(coll + '/')).map(k => snap(k));
        if(field) list.sort((a, b) => { const x = a.data()[field], y = b.data()[field]; return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1); });
        if(n) list = list.slice(0, n);
        return { docs: list };
      },
      where: (f, op, v) => {
        const base = query(coll, field, dir, n);
        return Object.assign({}, base, { get: async () => {
          const r = await base.get();
          const ok = x => op === '>=' ? x >= v : op === '<=' ? x <= v : op === '==' ? x === v : true;
          return { docs: r.docs.filter(d => ok(d.data()[f])) };
        }, where: undefined });
      }
    };
  }
  const db = {
    collection: coll => Object.assign(query(coll), { doc: id => ref(coll, id), orderBy: (f, dir) => query(coll, f, dir) }),
    runTransaction: async fn => {
      if(params.offline) throw Object.assign(new Error('offline'), { code: 'unavailable' });
      const pend = [];
      const res = await fn({ get: r => r.get(), set: (r, d, o) => pend.push([r.__key, d, o]) });
      if(window.__beforeCommit){ const f = window.__beforeCommit; window.__beforeCommit = null; f(); }
      pend.forEach(([k, d, o]) => write(k, d, o));
      return res;
    },
    enablePersistence: async () => {}
  };
  window.__fs = {
    docs, write,
    json: (coll, id) => docs[coll + '/' + id] && docs[coll + '/' + id].json ? JSON.parse(docs[coll + '/' + id].json) : null,
    remoteWrite: (coll, id, data) => write(coll + '/' + id, data)
  };
  (params.seed || []).forEach(([k, d]) => { docs[k] = d; });
  window.firebase = {
    initializeApp(){},
    auth: Object.assign(() => ({ currentUser: user, onAuthStateChanged(cb){ setTimeout(() => cb(user), 30); }, signOut(){}, setPersistence(){}, signInWithEmailAndPassword(){}, sendPasswordResetEmail(){} }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    firestore: Object.assign(() => db, { FieldValue: { serverTimestamp(){ return { __ts: true }; } } }),
    storage(){ return { ref(path){ return {
      async put(blob, meta){ window.__uploads.push({ path, type: meta && meta.contentType, size: blob.size }); this._url = URL.createObjectURL(blob); },
      async getDownloadURL(){ return this._url; } }; } }; }
  };
})();
