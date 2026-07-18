// Stockage local persistant (IndexedDB) — les données restent sur l'appareil,
// même après fermeture du navigateur.
if (!window.storage) {
  const dbReady = (() => {
    let promise;
    return () => {
      if (!promise) {
        promise = new Promise((resolve, reject) => {
          const req = indexedDB.open("carnet-bt", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("kv");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
      return promise;
    };
  })();

  window.storage = {
    async get(key) {
      const db = await dbReady();
      return new Promise((resolve, reject) => {
        const req = db.transaction("kv", "readonly").objectStore("kv").get(key);
        req.onsuccess = () => resolve(req.result != null ? { value: req.result } : null);
        req.onerror = () => reject(req.error);
      });
    },
    async set(key, value) {
      const db = await dbReady();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

async function loadPatients() {
  try {
    const res = await window.storage.get("patients", false);
    const list = res ? JSON.parse(res.value) : [];
    return list.map(normalizePatient);
  } catch {
    return [];
  }
}
async function savePatients(list) {
  try {
    await window.storage.set("patients", JSON.stringify(list), false);
  } catch (e) {
    console.error("Erreur sauvegarde patients", e);
  }
}
async function loadAttachments(patientId) {
  try {
    const res = await window.storage.get(`attachments:${patientId}`, false);
    return res ? JSON.parse(res.value) : [];
  } catch {
    return [];
  }
}
async function saveAttachments(patientId, list) {
  try {
    await window.storage.set(`attachments:${patientId}`, JSON.stringify(list), false);
  } catch (e) {
    console.error("Erreur sauvegarde pièces jointes", e);
  }
}
