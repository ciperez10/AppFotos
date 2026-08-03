const DB_NAME = 'jcf-registro-v1', STORE = 'records';

function openDatabase() {
  return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function transaction(mode, action) { const db = await openDatabase(); try { return await new Promise((resolve, reject) => { const tx = db.transaction(STORE, mode), store = tx.objectStore(STORE), request = action(store); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); tx.onerror = () => reject(tx.error); }); } finally { db.close(); } }
export const listRecords = () => transaction('readonly', store => store.getAll());
export const putRecord = record => transaction('readwrite', store => store.put(record));
export const deleteRecord = id => transaction('readwrite', store => store.delete(id));
export const clearRecords = () => transaction('readwrite', store => store.clear());
export const maskCedula = value => { const digits = String(value || '').replace(/\D/g, ''); return digits.length === 11 ? `***-*******-${digits.at(-1)}` : 'Sin cédula'; };
