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
