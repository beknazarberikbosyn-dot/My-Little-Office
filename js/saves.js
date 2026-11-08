'use strict';
/* Слоты сохранений: текущая карьера + архив прошлых. Всё хранится в браузере (localStorage). */
const Saves = (() => {
  const IDX = 'mlo_index_v3', CUR = 'mlo_current', LEGACY = 'mlo_save_v2';
  const SLOT = id => 'mlo_slot_' + id;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* нет хранилища */ } },
  };
  function index() { try { return JSON.parse(ls.get(IDX) || '[]') || []; } catch (e) { return []; } }
  const setIndex = a => ls.set(IDX, JSON.stringify(a));
  const current = () => ls.get(CUR);
  function setCurrent(id) { if (id) ls.set(CUR, id); else ls.del(CUR); }
  const find = id => index().find(s => s.id === id) || null;

  /* Новая карьера: старая остаётся в архиве */
  function create() {
    const a = index();
    const n = a.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    a.push({ id, n, name: `Карьера №${n}`, created: Date.now(), updated: Date.now(), status: 'active', day: 1, time: 540 });
    setIndex(a);
    setCurrent(id);
    return id;
  }
  function write(snap, meta) {
    let id = current();
    let a = index();
    let s = a.find(x => x.id === id);
    if (!s || s.status !== 'active') { id = create(); a = index(); s = a.find(x => x.id === id); }
    const ok = ls.set(SLOT(id), JSON.stringify(snap));
    Object.assign(s, meta || {}, { updated: Date.now() });
    if (!ok) s.broken = true; else delete s.broken;
    setIndex(a);
    return ok;
  }
  function read(id) {
    try { return JSON.parse(ls.get(SLOT(id || current())) || 'null'); } catch (e) { return null; }
  }
  /* Карьера, которую можно продолжить */
  function active() {
    const s = find(current());
    return s && s.status === 'active' && ls.get(SLOT(s.id)) ? s : null;
  }
  function remove(id) {
    ls.del(SLOT(id));
    setIndex(index().filter(s => s.id !== id));
    if (current() === id) setCurrent(null);
  }
  /* Уволен: карьера уходит в архив как завершённая, продолжить её нельзя */
  function finish(meta) {
    const id = current();
    const a = index();
    const s = a.find(x => x.id === id);
    if (s) { Object.assign(s, meta || {}, { status: 'fired', updated: Date.now() }); setIndex(a); }
    ls.del(SLOT(id));
    setCurrent(null);
  }
  /* Перенос старого сохранения (до слотов) */
  function migrate() {
    const old = ls.get(LEGACY);
    if (!old) return;
    try {
      const o = JSON.parse(old);
      const id = create();
      const a = index();
      Object.assign(a.find(x => x.id === id), { day: o.day, cash: Math.round(o.cash), rank: o.career ? ['Менеджер', 'Старший менеджер', 'Директор офиса', 'Вице-президент', 'Президент компании'][o.career.rank] : 'Менеджер' });
      setIndex(a);
      ls.set(SLOT(id), old);
    } catch (e) { /* битое сохранение — пропускаем */ }
    ls.del(LEGACY);
  }
  return { index, current, setCurrent, create, write, read, active, remove, finish, migrate, find };
})();
