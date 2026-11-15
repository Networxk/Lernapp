/* IndexedDB-Wrapper für Stapel und Karten */
'use strict';

const DB = (() => {
  const NAME = 'lernkarten';
  const VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('decks')) {
          db.createObjectStore('decks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cards')) {
          const cards = db.createObjectStore('cards', { keyPath: 'id' });
          cards.createIndex('deckId', 'deckId', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Falls eine neuere Version in einem anderen Tab geöffnet wird
        db.onversionchange = () => { db.close(); location.reload(); };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Datenbank blockiert – bitte andere Tabs schließen.'));
    });
    return dbPromise;
  }

  function promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(stores, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let result;
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transaktion abgebrochen'));
      Promise.resolve(fn(t)).then(r => { result = r; }, err => { try { t.abort(); } catch (_) {} reject(err); });
    });
  }

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  return {
    uid,

    getDecks: () => tx('decks', 'readonly', t => promisify(t.objectStore('decks').getAll())),
    getDeck: id => tx('decks', 'readonly', t => promisify(t.objectStore('decks').get(id))),
    putDeck: deck => tx('decks', 'readwrite', t => promisify(t.objectStore('decks').put(deck))),

    async deleteDeck(id) {
      return tx(['decks', 'cards'], 'readwrite', async t => {
        t.objectStore('decks').delete(id);
        const store = t.objectStore('cards');
        const keys = await promisify(store.index('deckId').getAllKeys(id));
        keys.forEach(k => store.delete(k));
      });
    },

    getAllCards: () => tx('cards', 'readonly', t => promisify(t.objectStore('cards').getAll())),
    getCards: deckId => tx('cards', 'readonly', t => promisify(t.objectStore('cards').index('deckId').getAll(deckId))),
    getCard: id => tx('cards', 'readonly', t => promisify(t.objectStore('cards').get(id))),
    putCard: card => tx('cards', 'readwrite', t => promisify(t.objectStore('cards').put(card))),
    deleteCard: id => tx('cards', 'readwrite', t => promisify(t.objectStore('cards').delete(id))),

    /** Importiert Daten. mode = 'merge' (gleiche IDs werden überschrieben) oder 'replace' (alles löschen). */
    importAll({ decks, cards }, mode) {
      return tx(['decks', 'cards'], 'readwrite', t => {
        const ds = t.objectStore('decks');
        const cs = t.objectStore('cards');
        if (mode === 'replace') { ds.clear(); cs.clear(); }
        decks.forEach(d => ds.put(d));
        cards.forEach(c => cs.put(c));
      });
    }
  };
})();
