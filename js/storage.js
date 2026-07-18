// Stockage distant (Supabase) — les données sont liées au compte connecté ;
// les règles RLS Postgres garantissent qu'un utilisateur ne voit jamais les
// BT/patients/photos d'un autre.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const { data, error } = await window.supabaseClient
        .from("kv_store")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data ? { value: data.value } : null;
    },
    async set(key, value) {
      const { error } = await window.supabaseClient
        .from("kv_store")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
      if (error) throw error;
    },
    async delete(key) {
      const { error } = await window.supabaseClient.from("kv_store").delete().eq("key", key);
      if (error) throw error;
      const m = /^attachments:(.+)$/.exec(key);
      if (m) await deleteAttachmentFiles(m[1]);
    },
  };
}

async function deleteAttachmentFiles(patientId) {
  try {
    const { data: sess } = await window.supabaseClient.auth.getSession();
    const uid = sess && sess.session && sess.session.user.id;
    if (!uid) return;
    const folder = `${uid}/${patientId}`;
    const { data: files } = await window.supabaseClient.storage.from("attachments").list(folder);
    if (files && files.length) {
      await window.supabaseClient.storage.from("attachments").remove(files.map((f) => `${folder}/${f.name}`));
    }
  } catch (e) {
    console.error("Erreur suppression pièces jointes (storage)", e);
  }
}

async function loadPatients() {
  try {
    const res = await window.storage.get("patients");
    const list = res ? JSON.parse(res.value) : [];
    return list.map(normalizePatient);
  } catch (e) {
    console.error("Erreur chargement patients", e);
    return [];
  }
}
async function savePatients(list) {
  try {
    await window.storage.set("patients", JSON.stringify(list));
  } catch (e) {
    console.error("Erreur sauvegarde patients", e);
  }
}
async function loadAttachments(patientId) {
  try {
    const res = await window.storage.get(`attachments:${patientId}`);
    const meta = res ? JSON.parse(res.value) : [];
    return await Promise.all(
      meta.map(async (a) => {
        if (!a.path) return a;
        const { data, error } = await window.supabaseClient.storage
          .from("attachments")
          .createSignedUrl(a.path, 3600);
        return error ? a : { ...a, dataUrl: data.signedUrl };
      })
    );
  } catch (e) {
    console.error("Erreur chargement pièces jointes", e);
    return [];
  }
}
async function saveAttachments(patientId, list) {
  try {
    const { data: sess } = await window.supabaseClient.auth.getSession();
    const uid = sess && sess.session && sess.session.user.id;
    const meta = await Promise.all(
      list.map(async (a) => {
        if (a.path || !uid || !a.dataUrl) {
          const { dataUrl, ...rest } = a;
          return rest;
        }
        const res = await fetch(a.dataUrl);
        const blob = await res.blob();
        const path = `${uid}/${patientId}/${a.id}.jpg`;
        const { error } = await window.supabaseClient.storage
          .from("attachments")
          .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
        if (error) throw error;
        const { dataUrl, ...rest } = a;
        return { ...rest, path };
      })
    );
    await window.storage.set(`attachments:${patientId}`, JSON.stringify(meta));
  } catch (e) {
    console.error("Erreur sauvegarde pièces jointes", e);
  }
}
