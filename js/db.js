// Track it — db.js
// Minimal IndexedDB wrapper. Everything here stays on-device.
// Schema version 1: object stores "profile" (single record, id=1) and "periods".

const DB_NAME = 'trackit-db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('periods')) {
        const store = db.createObjectStore('periods', { keyPath: 'id', autoIncrement: true });
        store.createIndex('monthKey', 'monthKey', { unique: false });
        store.createIndex('start', 'start', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

const TrackitDB = {
  async getProfile() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = tx(db, 'profile', 'readonly').get(1);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async saveProfile(profile) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const record = { id: 1, ...profile };
      const req = tx(db, 'profile', 'readwrite').put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  },

  async getAllPeriods() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = tx(db, 'periods', 'readonly').getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.start < b.start ? -1 : 1));
      req.onerror = () => reject(req.error);
    });
  },

  async getPeriodByMonthKey(monthKey) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const idx = tx(db, 'periods', 'readonly').index('monthKey');
      const req = idx.get(monthKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async putPeriod(period) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const store = tx(db, 'periods', 'readwrite');
      const req = period.id ? store.put(period) : store.add(period);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async deletePeriod(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = tx(db, 'periods', 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getMeta(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      // reuse profile store for tiny bits of app meta (e.g. last reminder shown)
      const req = tx(db, 'profile', 'readonly').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  },

  async setMeta(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = tx(db, 'profile', 'readwrite').put({ id: key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};
