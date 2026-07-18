"use strict";
function CarnetBTApp() {
    var _a, _b;
    const [loading, setLoading] = useState(true);
    const [patients, setPatients] = useState([]);
    const [view, setView] = useState("liste"); // liste | ajout | detail | scanner
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [attachments, setAttachments] = useState([]);
    const [attLoading, setAttLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [search, setSearch] = useState("");
    // scanner state
    const [scanTargetId, setScanTargetId] = useState("");
    const [scanBtId, setScanBtId] = useState("");
    const [rawFile, setRawFile] = useState(null);
    const [enhancedUrl, setEnhancedUrl] = useState(null);
    const [pages, setPages] = useState([]); // pages déjà validées dans cette session de scan
    const [processing, setProcessing] = useState(false);
    const [scanLabel, setScanLabel] = useState("Bon de transport");
    useEffect(() => {
        (async () => {
            const p = await loadPatients();
            setPatients(p);
            setLoading(false);
        })();
    }, []);
    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    }
    async function openPatient(id) {
        setSelectedId(id);
        setView("detail");
        setAttLoading(true);
        const a = await loadAttachments(id);
        setAttachments(a);
        setAttLoading(false);
    }
    async function addPatient() {
        if (!form.nom.trim()) {
            showToast("Le nom du patient est requis");
            return;
        }
        const bts = form.bts
            .filter((b) => b.depart.trim() || b.destination.trim() || b.numero.trim())
            .map((b, i) => ({
            id: "bt_" + Date.now() + "_" + i,
            depart: b.depart.trim() || "Domicile",
            destination: b.destination.trim() || `Destination ${i + 1}`,
            label: `${b.depart.trim() || "Domicile"} > ${b.destination.trim() || `Destination ${i + 1}`}`,
            numero: b.numero.trim() || String(Math.floor(10000 + Math.random() * 89999)),
            total: Number(b.total) || 1,
            typeVisite: b.typeVisite || "consultation",
            utilises: 0,
            historique: [],
        }));
        const newPatient = {
            id: "p_" + Date.now(),
            nom: form.nom.trim(),
            hopital: form.hopital.trim(),
            medecin: form.medecin.trim(),
            adeli: form.adeli.trim(),
            signature: form.signature,
            prescriptionDate: form.prescriptionDate,
            aldExonerante: form.aldExonerante,
            bts,
        };
        const updated = [newPatient, ...patients];
        setPatients(updated);
        await savePatients(updated);
        setForm(emptyForm);
        showToast("Patient ajouté");
        setView("liste");
    }
    function updateBtRow(index, key, value) {
        setForm((f) => {
            const bts = f.bts.map((b, i) => (i === index ? { ...b, [key]: value } : b));
            return { ...f, bts };
        });
    }
    function addBtRow() {
        setForm((f) => ({ ...f, bts: [...f.bts, { ...emptyBtRow }] }));
    }
    function removeBtRow(index) {
        setForm((f) => ({ ...f, bts: f.bts.filter((_, i) => i !== index) }));
    }
    async function shareAttachment(a) {
        try {
            const res = await fetch(a.dataUrl);
            const blob = await res.blob();
            const file = new File([blob], (a.label || "document").replace(/\s+/g, "_") + ".jpg", { type: blob.type || "image/jpeg" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: a.label });
                return;
            }
        }
        catch (e) {
            // on tente le repli ci-dessous
        }
        window.open(a.dataUrl, "_blank");
    }
    async function shareBt(patient, bt) {
        const dates = (bt.historique || []).map((d) => new Date(d).toLocaleDateString("fr-FR"));
        const text = `Patient : ${patient.nom}\n` +
            `BT n°${bt.numero} — ${bt.label}\n` +
            `Type : ${bt.typeVisite === "hdj" ? "HDJ" : "Consultation"}\n` +
            `${bt.utilises}/${bt.total} séance${bt.total > 1 ? "s" : ""} utilisée${bt.utilises > 1 ? "s" : ""}\n` +
            `Dates : ${dates.length ? dates.join(", ") : "aucune pour le moment"}`;
        // Cherche les documents scannés rattachés spécifiquement à ce BT
        let files = [];
        try {
            const allAtt = await loadAttachments(patient.id);
            const matching = allAtt.filter((a) => a.btId === bt.id);
            const blobs = await Promise.all(matching.map(async (a, i) => {
                const res = await fetch(a.dataUrl);
                const blob = await res.blob();
                return new File([blob], `bt_${bt.numero}_${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
            }));
            files = blobs;
        }
        catch (e) {
            // pas grave, on partagera le texte seul
        }
        if (navigator.share) {
            try {
                const payload = { title: `BT ${bt.numero} — ${patient.nom}`, text };
                if (files.length && navigator.canShare && navigator.canShare({ files })) {
                    payload.files = files;
                }
                await navigator.share(payload);
            }
            catch (e) {
                if (e.name !== "AbortError")
                    showToast("Partage impossible sur cet appareil");
            }
        }
        else if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(text);
                showToast("Copié dans le presse-papiers");
            }
            catch (_a) {
                showToast("Impossible de copier");
            }
        }
        else {
            showToast("Partage non supporté sur ce navigateur");
        }
    }
    async function enregistrerTrajet(patientId, btId) {
        const today = new Date().toISOString().slice(0, 10);
        const updated = patients.map((p) => {
            if (p.id !== patientId)
                return p;
            return {
                ...p,
                bts: p.bts.map((b) => b.id === btId && b.utilises < b.total
                    ? { ...b, utilises: b.utilises + 1, historique: [...(b.historique || []), today] }
                    : b),
            };
        });
        setPatients(updated);
        await savePatients(updated);
    }
    async function retirerTrajet(patientId, btId) {
        const updated = patients.map((p) => {
            if (p.id !== patientId)
                return p;
            return {
                ...p,
                bts: p.bts.map((b) => {
                    if (b.id !== btId || b.utilises <= 0)
                        return b;
                    const historique = [...(b.historique || [])];
                    historique.pop();
                    return { ...b, utilises: b.utilises - 1, historique };
                }),
            };
        });
        setPatients(updated);
        await savePatients(updated);
    }
    async function deletePatient(id) {
        const updated = patients.filter((p) => p.id !== id);
        setPatients(updated);
        await savePatients(updated);
        try {
            await window.storage.delete(`attachments:${id}`, false);
        }
        catch (_a) { }
        setView("liste");
        showToast("Patient supprimé");
    }
    async function handleScanFile(e) {
        var _a;
        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        setRawFile(file);
        setProcessing(true);
        setEnhancedUrl(null);
        try {
            const url = await processFile(file);
            setEnhancedUrl(url);
        }
        catch (err) {
            console.error("Erreur traitement image", err);
            showToast("Échec du traitement — réessaie avec une autre photo");
        }
        finally {
            setProcessing(false);
            e.target.value = "";
        }
    }
    function addPageToSession() {
        if (!enhancedUrl)
            return;
        setPages((p) => [...p, enhancedUrl]);
        setEnhancedUrl(null);
        setRawFile(null);
        showToast("Page ajoutée — scanne la suivante ou termine");
    }
    async function saveScan() {
        const allPages = enhancedUrl ? [...pages, enhancedUrl] : pages;
        if (!scanTargetId || allPages.length === 0) {
            showToast("Choisis un patient et au moins une photo");
            return;
        }
        const current = await loadAttachments(scanTargetId);
        const stamp = Date.now();
        const newEntries = allPages.map((dataUrl, i) => ({
            id: `a_${stamp}_${i}`,
            label: allPages.length > 1 ? `${scanLabel} (${i + 1}/${allPages.length})` : scanLabel,
            dataUrl,
            btId: scanBtId || null,
        }));
        const updatedAtt = [...current, ...newEntries];
        await saveAttachments(scanTargetId, updatedAtt);
        showToast(allPages.length > 1 ? `${allPages.length} pages enregistrées` : "Document enregistré");
        setEnhancedUrl(null);
        setRawFile(null);
        setPages([]);
        setScanLabel("Bon de transport");
        if (selectedId === scanTargetId)
            setAttachments(updatedAtt);
        setView("liste");
    }
    const selected = patients.find((p) => p.id === selectedId);
    const filteredPatients = useMemo(() => {
        const q = search.trim().toLowerCase();
        return patients
            .filter((p) => {
            if (!q)
                return true;
            const inPatient = p.nom.toLowerCase().includes(q) ||
                (p.hopital || "").toLowerCase().includes(q) ||
                (p.medecin || "").toLowerCase().includes(q);
            const inBts = (p.bts || []).some((bt) => bt.numero.toLowerCase().includes(q) || (bt.label || "").toLowerCase().includes(q));
            return inPatient || inBts;
        })
            .map((p) => ({ ...p, alerts: alertsFor(p) }))
            .sort((a, b) => {
            const rank = (al) => (al.some((x) => x.level === "critical") ? 0 : al.some((x) => x.level === "warning") ? 1 : 2);
            return rank(a.alerts) - rank(b.alerts);
        });
    }, [patients, search]);
    if (loading) {
        return (React.createElement("div", { className: "min-h-screen bg-slate-950 flex items-center justify-center" },
            React.createElement(Spinner, { size: 28, className: "animate-spin text-teal-400" })));
    }
    return (React.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 font-sans pb-20" },
        React.createElement("header", { className: "border-b border-slate-800 bg-black px-4 py-3 sticky top-0 z-20 flex items-center gap-2" },
            view !== "liste" ? (React.createElement("button", { onClick: () => setView("liste"), className: "text-slate-400" },
                React.createElement(Icon, { size: 20 }, "←"))) : (React.createElement("div", { className: "h-8 w-8 rounded-md bg-teal-500/15 border border-teal-500/30 flex items-center justify-center" },
                React.createElement(Icon, { size: 16, className: "text-teal-400" }, "🎫"))),
            React.createElement("div", null,
                React.createElement("p", { className: "text-sm font-semibold leading-tight" },
                    view === "liste" && "Carnet BT",
                    view === "ajout" && "Nouveau patient",
                    view === "detail" && (selected === null || selected === void 0 ? void 0 : selected.nom),
                    view === "scanner" && "Scanner un document"),
                React.createElement("p", { className: "text-[11px] text-slate-500 leading-tight" }, view === "liste" && `${patients.length} patient${patients.length > 1 ? "s" : ""} suivi${patients.length > 1 ? "s" : ""}`))),
        React.createElement("main", { className: "max-w-md mx-auto w-full px-4 py-5" },
            view === "liste" && (React.createElement("div", { className: "space-y-2" },
                React.createElement("div", { className: "relative mb-1" },
                    React.createElement(Icon, { size: 15, className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" }, "🔎"),
                    React.createElement("input", { value: search, onChange: (e) => setSearch(e.target.value.toUpperCase()), placeholder: "Rechercher un patient ou un BT (nom, n\u00B0...)", className: "w-full rounded-md border border-slate-800 bg-slate-900 pl-9 pr-3 py-2.5 text-sm text-slate-100 uppercase placeholder:normal-case placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400" })),
                patients.length === 0 && (React.createElement("div", { className: "text-center py-16 text-slate-500 text-sm" },
                    "Aucun patient pour l'instant.",
                    React.createElement("br", null),
                    "Ajoute ton premier patient pour commencer.")),
                patients.length > 0 && filteredPatients.length === 0 && (React.createElement("div", { className: "text-center py-16 text-slate-500 text-sm" }, "Aucun r\u00E9sultat pour cette recherche.")),
                filteredPatients
                    .map((p) => {
                    var _a;
                    const worst = (_a = p.alerts[0]) === null || _a === void 0 ? void 0 : _a.level;
                    const border = worst === "critical" ? "border-l-red-500" : worst === "warning" ? "border-l-amber-500" : "border-l-teal-500";
                    return (React.createElement("button", { key: p.id, onClick: () => openPatient(p.id), className: `w-full text-left rounded-lg border border-slate-800 border-l-4 ${border} bg-slate-900 px-4 py-3` },
                        React.createElement("div", { className: "flex items-center justify-between" },
                            React.createElement("div", null,
                                React.createElement("p", { className: "text-sm font-semibold" }, p.nom),
                                React.createElement("p", { className: "text-xs text-slate-500" }, p.hopital || "—")),
                            React.createElement(Icon, { size: 16, className: "text-slate-600" }, "›")),
                        (p.bts || []).length === 0 ? (React.createElement("p", { className: "text-xs text-slate-600 mt-2" }, "Aucun BT enregistr\u00E9")) : (React.createElement("div", { className: "space-y-1.5 mt-2" }, p.bts.map((bt) => {
                            const remaining = bt.total - bt.utilises;
                            return (React.createElement("div", { key: bt.id, className: "flex items-center gap-2" },
                                React.createElement("span", { className: "text-xs font-mono text-slate-400 truncate max-w-[45%]" }, bt.label),
                                React.createElement("div", { className: "flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden" },
                                    React.createElement("div", { className: "h-full " + (remaining <= 0 ? "bg-red-500" : remaining === 1 ? "bg-amber-400" : "bg-teal-400"), style: { width: `${(bt.utilises / bt.total) * 100}%` } })),
                                React.createElement("span", { className: "text-[11px] text-slate-500 shrink-0" },
                                    remaining <= 0 ? 0 : remaining,
                                    " rest.")));
                        }))),
                        p.alerts.length > 0 && (React.createElement("div", { className: "flex flex-wrap gap-1.5 mt-2" }, p.alerts.map((a, i) => (React.createElement("span", { key: i, className: "flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 " +
                                (a.level === "critical"
                                    ? "bg-red-500/10 text-red-300"
                                    : a.level === "warning"
                                        ? "bg-amber-500/10 text-amber-300"
                                        : "bg-slate-500/10 text-slate-400") },
                            React.createElement(Icon, { size: 10 }, "⚠️"),
                            " ",
                            a.text)))))));
                }))),
            view === "ajout" && (React.createElement("div", { className: "space-y-4" },
                React.createElement(Field, { label: "Nom du patient *", value: form.nom, onChange: (v) => setForm((f) => ({ ...f, nom: v })) }),
                React.createElement(Field, { label: "H\u00F4pital / clinique", value: form.hopital, onChange: (v) => setForm((f) => ({ ...f, hopital: v })) }),
                React.createElement(Field, { label: "M\u00E9decin", value: form.medecin, onChange: (v) => setForm((f) => ({ ...f, medecin: v })) }),
                React.createElement(Field, { label: "Num\u00E9ro ADELI", value: form.adeli, onChange: (v) => setForm((f) => ({ ...f, adeli: v })) }),
                React.createElement(Field, { label: "Date de la prescription", type: "date", value: form.prescriptionDate, onChange: (v) => setForm((f) => ({ ...f, prescriptionDate: v })) }),
                React.createElement("div", { className: "space-y-3" },
                    React.createElement("div", { className: "flex items-center justify-between" },
                        React.createElement("p", { className: "text-xs uppercase tracking-wide text-slate-500" }, "Bons de transport en s\u00E9rie"),
                        React.createElement("button", { onClick: addBtRow, className: "text-xs text-teal-400 flex items-center gap-1" },
                            React.createElement(Icon, { size: 12 }, "+"),
                            " Ajouter un BT")),
                    form.bts.map((b, i) => (React.createElement("div", { key: i, className: "rounded-lg border border-slate-800 bg-slate-900 p-3 space-y-2" },
                        React.createElement("div", { className: "flex items-center justify-between" },
                            React.createElement("span", { className: "text-[11px] text-slate-500" },
                                "BT ",
                                i + 1),
                            form.bts.length > 1 && (React.createElement("button", { onClick: () => removeBtRow(i), className: "text-red-400" },
                                React.createElement(Icon, { size: 13 }, "🗑️")))),
                        React.createElement("div", { className: "grid grid-cols-2 gap-3" },
                            React.createElement(Field, { label: "D\u00E9part", placeholder: "Domicile", value: b.depart, onChange: (v) => updateBtRow(i, "depart", v) }),
                            React.createElement(Field, { label: "Destination", placeholder: "ex : H\u00F4pital 1", value: b.destination, onChange: (v) => updateBtRow(i, "destination", v) })),
                        React.createElement("div", { className: "grid grid-cols-2 gap-3" },
                            React.createElement(Field, { label: "N\u00B0 du BT", value: b.numero, onChange: (v) => updateBtRow(i, "numero", v), placeholder: "auto" }),
                            React.createElement(Field, { label: "Nombre de s\u00E9ances", type: "number", value: b.total, onChange: (v) => updateBtRow(i, "total", v) })),
                        React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                            React.createElement("button", { onClick: () => updateBtRow(i, "typeVisite", "consultation"), className: "rounded-md border px-3 py-2 text-sm transition-colors " +
                                    (b.typeVisite !== "hdj"
                                        ? "border-teal-500/50 bg-teal-500/10 text-teal-300"
                                        : "border-slate-700 bg-slate-950 text-slate-400") }, "Consultation"),
                            React.createElement("button", { onClick: () => updateBtRow(i, "typeVisite", "hdj"), className: "rounded-md border px-3 py-2 text-sm transition-colors " +
                                    (b.typeVisite === "hdj"
                                        ? "border-teal-500/50 bg-teal-500/10 text-teal-300"
                                        : "border-slate-700 bg-slate-950 text-slate-400") }, "HDJ")))))),
                React.createElement(ToggleField, { label: "Signature m\u00E9decin pr\u00E9sente", checked: form.signature, onChange: (v) => setForm((f) => ({ ...f, signature: v })) }),
                React.createElement(ToggleField, { label: "ALD exon\u00E9rante", checked: form.aldExonerante, onChange: (v) => setForm((f) => ({ ...f, aldExonerante: v })) }),
                React.createElement("button", { onClick: addPatient, className: "w-full flex items-center justify-center gap-2 rounded-md bg-teal-500 text-slate-950 font-medium py-2.5 text-sm hover:bg-teal-400 transition-colors" },
                    React.createElement(Icon, { size: 16 }, "✓"),
                    " Enregistrer le patient"))),
            view === "detail" && selected && (React.createElement("div", { className: "space-y-5" },
                React.createElement("div", { className: "grid grid-cols-2 gap-3" },
                    React.createElement("div", { className: "rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5" },
                        React.createElement("p", { className: "flex items-center gap-1.5 text-[11px] text-slate-500 mb-1" },
                            React.createElement(Icon, { size: 12 }, "🏥"),
                            " H\u00F4pital"),
                        React.createElement("p", { className: "text-sm" }, selected.hopital || "—")),
                    React.createElement("div", { className: "rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5" },
                        React.createElement("p", { className: "flex items-center gap-1.5 text-[11px] text-slate-500 mb-1" },
                            React.createElement(Icon, { size: 12 }, "🩺"),
                            " M\u00E9decin"),
                        React.createElement("p", { className: "text-sm" }, selected.medecin || "—"))),
                React.createElement("div", { className: "flex flex-wrap gap-2" },
                    selected.prescriptionDate && (React.createElement("span", { className: "text-xs rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300" },
                        "Prescription du ",
                        new Date(selected.prescriptionDate).toLocaleDateString("fr-FR"))),
                    React.createElement("span", { className: "text-xs rounded-full border px-3 py-1 " +
                            (selected.aldExonerante
                                ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
                                : "border-slate-700 bg-slate-900 text-slate-400") }, selected.aldExonerante ? "ALD exonérante" : "Non ALD")),
                React.createElement("div", { className: "space-y-3" },
                    React.createElement("p", { className: "text-xs uppercase tracking-wide text-slate-500" }, "Bons de transport en s\u00E9rie"),
                    (selected.bts || []).length === 0 && (React.createElement("p", { className: "text-sm text-slate-600" }, "Aucun BT enregistr\u00E9 pour ce patient.")),
                    (selected.bts || []).map((bt) => {
                        const r = bt.total - bt.utilises;
                        return (React.createElement("div", { key: bt.id, className: "rounded-xl border border-slate-800 bg-slate-900 overflow-hidden" },
                            React.createElement("div", { className: "px-4 py-3 flex items-center justify-between border-b border-dashed border-slate-700" },
                                React.createElement("div", null,
                                    React.createElement("p", { className: "text-sm font-semibold text-slate-200" }, bt.label),
                                    React.createElement("div", { className: "flex items-center gap-2 mt-0.5" },
                                        React.createElement("span", { className: "font-mono text-xs text-slate-500" },
                                            "BT n\u00B0",
                                            bt.numero),
                                        React.createElement("span", { className: "text-[10px] rounded-full border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-slate-400" }, bt.typeVisite === "hdj" ? "HDJ" : "Consultation"))),
                                React.createElement("span", { className: "text-xs font-medium px-2 py-0.5 rounded-full " +
                                        (r <= 0 ? "bg-red-500/15 text-red-300" : r === 1 ? "bg-amber-500/15 text-amber-300" : "bg-teal-500/15 text-teal-300") }, r <= 0 ? "Terminé" : `${r} restante${r > 1 ? "s" : ""}`)),
                            React.createElement("div", { className: "px-4 py-4 space-y-3" },
                                React.createElement(Segments, { total: bt.total, used: bt.utilises }),
                                React.createElement("p", { className: "font-mono text-sm text-slate-400" },
                                    bt.utilises,
                                    " / ",
                                    bt.total,
                                    " utilis\u00E9s"),
                                (bt.historique || []).length > 0 && (React.createElement("div", { className: "flex flex-wrap gap-1.5" }, bt.historique.map((d, i) => (React.createElement("span", { key: i, className: "text-[11px] rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-slate-400" }, new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })))))),
                                React.createElement("div", { className: "flex gap-2" },
                                    React.createElement("button", { onClick: () => retirerTrajet(selected.id, bt.id), disabled: bt.utilises <= 0, className: "flex items-center justify-center gap-1.5 rounded-md py-2 px-3 text-sm font-medium " +
                                            (bt.utilises <= 0
                                                ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                                                : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700") },
                                        React.createElement(Icon, { size: 15 }, "−")),
                                    React.createElement("button", { onClick: () => enregistrerTrajet(selected.id, bt.id), disabled: bt.utilises >= bt.total, className: "flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium " +
                                            (bt.utilises >= bt.total
                                                ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                                                : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700") },
                                        React.createElement(Icon, { size: 15 }, "+"),
                                        " Enregistrer un trajet")),
                                React.createElement("button", { onClick: () => shareBt(selected, bt), className: "w-full flex items-center justify-center gap-2 rounded-md border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors" },
                                    React.createElement(Icon, { size: 15 }, "📤"),
                                    " Partager ce BT"))));
                    })),
                alertsFor(selected).length > 0 && (React.createElement("div", { className: "space-y-2" },
                    React.createElement("p", { className: "text-xs uppercase tracking-wide text-slate-500" }, "Alertes"),
                    alertsFor(selected).map((a, i) => (React.createElement("div", { key: i, className: "flex items-start gap-2 rounded-md border px-3 py-2 text-sm " +
                            (a.level === "critical"
                                ? "bg-red-500/10 border-red-500/40 text-red-300"
                                : a.level === "warning"
                                    ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                                    : "bg-slate-500/10 border-slate-500/40 text-slate-300") },
                        React.createElement(Icon, { size: 16, className: "mt-0.5 shrink-0" }, "⚠️"),
                        React.createElement("span", null, a.text)))))),
                React.createElement("div", { className: "space-y-2" },
                    React.createElement("div", { className: "flex items-center justify-between" },
                        React.createElement("p", { className: "text-xs uppercase tracking-wide text-slate-500" }, "Pi\u00E8ces jointes"),
                        React.createElement("button", { onClick: () => {
                                setScanTargetId(selected.id);
                                setScanBtId("");
                                setEnhancedUrl(null);
                                setPages([]);
                                setView("scanner");
                            }, className: "text-xs text-teal-400 flex items-center gap-1" },
                            React.createElement(Icon, { size: 12 }, "🔍"),
                            " Ajouter")),
                    attLoading ? (React.createElement(Spinner, { size: 18, className: "animate-spin text-slate-500" })) : attachments.length === 0 ? (React.createElement("p", { className: "text-sm text-slate-600" }, "Aucun document rattach\u00E9.")) : (React.createElement("div", { className: "grid grid-cols-3 gap-2" }, attachments.map((a) => {
                        const linkedBt = a.btId && (selected.bts || []).find((bt) => bt.id === a.btId);
                        return (React.createElement("div", { key: a.id, className: "rounded-md overflow-hidden border border-slate-800" },
                            React.createElement("img", { src: a.dataUrl, alt: a.label, className: "w-full h-24 object-cover bg-white" }),
                            React.createElement("p", { className: "text-[10px] text-slate-500 px-1.5 py-1 truncate" }, a.label),
                            linkedBt && (React.createElement("p", { className: "text-[9px] text-teal-400 px-1.5 pb-1 truncate" },
                                "\u2192 ",
                                linkedBt.label)),
                            React.createElement("button", { onClick: () => shareAttachment(a), className: "w-full flex items-center justify-center gap-1 border-t border-slate-800 py-1 text-[10px] text-teal-400" },
                                React.createElement(Icon, { size: 10 }, "📤"),
                                " Partager")));
                    })))),
                React.createElement("button", { onClick: () => deletePatient(selected.id), className: "w-full flex items-center justify-center gap-2 rounded-md border border-red-900/50 text-red-400 py-2.5 text-sm" },
                    React.createElement(Icon, { size: 15 }, "🗑️"),
                    " Supprimer ce patient"))),
            view === "scanner" && (React.createElement("div", { className: "space-y-4" },
                React.createElement("div", { className: "space-y-1" },
                    React.createElement("label", { className: "text-[11px] uppercase tracking-wide text-slate-500" }, "Patient"),
                    React.createElement("select", { value: scanTargetId, onChange: (e) => setScanTargetId(e.target.value), className: "w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-slate-100" },
                        React.createElement("option", { value: "" }, "Choisir un patient"),
                        patients.map((p) => (React.createElement("option", { key: p.id, value: p.id }, p.nom))))),
                scanTargetId && (((_a = patients.find((p) => p.id === scanTargetId)) === null || _a === void 0 ? void 0 : _a.bts) || []).length > 0 && (React.createElement("div", { className: "space-y-1" },
                    React.createElement("label", { className: "text-[11px] uppercase tracking-wide text-slate-500" }, "Rattacher \u00E0 un BT (optionnel)"),
                    React.createElement("select", { value: scanBtId, onChange: (e) => setScanBtId(e.target.value), className: "w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-slate-100" },
                        React.createElement("option", { value: "" }, "Aucun BT en particulier"),
                        (((_b = patients.find((p) => p.id === scanTargetId)) === null || _b === void 0 ? void 0 : _b.bts) || []).map((bt) => (React.createElement("option", { key: bt.id, value: bt.id },
                            bt.label,
                            " \u2014 BT n\u00B0",
                            bt.numero)))))),
                React.createElement(Field, { label: "Type de document", value: scanLabel, onChange: setScanLabel }),
                pages.length > 0 && (React.createElement("div", { className: "space-y-1" },
                    React.createElement("p", { className: "text-[11px] uppercase tracking-wide text-slate-500" },
                        pages.length,
                        " page",
                        pages.length > 1 ? "s" : "",
                        " ajout\u00E9e",
                        pages.length > 1 ? "s" : ""),
                    React.createElement("div", { className: "flex gap-2 flex-wrap" }, pages.map((p, i) => (React.createElement("img", { key: i, src: p, alt: `page ${i + 1}`, className: "w-14 h-18 object-cover rounded border border-slate-700 bg-white" })))))),
                !enhancedUrl && !processing && (React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                    React.createElement("label", { className: "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900 py-10 cursor-pointer" },
                        React.createElement(Icon, { size: 26, className: "text-slate-600" }, "📷"),
                        React.createElement("span", { className: "text-xs text-slate-400 text-center px-2" }, "Prendre une photo"),
                        React.createElement("input", { type: "file", accept: "image/*", capture: "environment", className: "hidden", onChange: handleScanFile })),
                    React.createElement("label", { className: "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900 py-10 cursor-pointer" },
                        React.createElement(Icon, { size: 26, className: "text-slate-600" }, "🖼️"),
                        React.createElement("span", { className: "text-xs text-slate-400 text-center px-2" }, "Depuis la galerie"),
                        React.createElement("input", { type: "file", accept: "image/*", className: "hidden", onChange: handleScanFile })))),
                !enhancedUrl && !processing && pages.length > 0 && (React.createElement("button", { onClick: saveScan, className: "w-full flex items-center justify-center gap-2 rounded-md bg-teal-500 text-slate-950 font-medium py-2.5 text-sm hover:bg-teal-400 transition-colors" },
                    React.createElement(Icon, { size: 16 }, "✓"),
                    " Terminer et enregistrer (",
                    pages.length,
                    " page",
                    pages.length > 1 ? "s" : "",
                    ")")),
                processing && (React.createElement("div", { className: "flex flex-col items-center justify-center gap-2 py-14 text-slate-400" },
                    React.createElement(Spinner, { size: 26, className: "animate-spin text-teal-400" }),
                    React.createElement("span", { className: "text-sm" }, "Am\u00E9lioration en cours\u2026"))),
                enhancedUrl && !processing && (React.createElement("div", { className: "rounded-lg overflow-hidden border border-slate-800" },
                    React.createElement("img", { src: enhancedUrl, alt: "scan", className: "w-full object-contain bg-white" }))),
                enhancedUrl && (React.createElement("div", { className: "space-y-2" },
                    React.createElement("div", { className: "flex gap-2" },
                        React.createElement("label", { className: "flex items-center justify-center gap-1.5 rounded-md border border-slate-700 px-4 py-2.5 text-sm text-slate-300 cursor-pointer" },
                            React.createElement(Icon, { size: 15 }, "📷"),
                            " Reprendre",
                            React.createElement("input", { type: "file", accept: "image/*", capture: "environment", className: "hidden", onChange: (e) => {
                                    setEnhancedUrl(null);
                                    handleScanFile(e);
                                } })),
                        React.createElement("button", { onClick: addPageToSession, className: "flex-1 flex items-center justify-center gap-2 rounded-md border border-slate-700 text-slate-200 py-2.5 text-sm" },
                            React.createElement(Icon, { size: 15 }, "+"),
                            " Ajouter une page")),
                    React.createElement("button", { onClick: saveScan, className: "w-full flex items-center justify-center gap-2 rounded-md bg-teal-500 text-slate-950 font-medium py-2.5 text-sm hover:bg-teal-400 transition-colors" },
                        React.createElement(Icon, { size: 16 }, "✓"),
                        " Terminer et enregistrer")))))),
        React.createElement("nav", { className: "fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-black px-4 py-2 z-20" },
            React.createElement("div", { className: "max-w-md mx-auto grid grid-cols-3 gap-2" },
                React.createElement("button", { onClick: () => setView("liste"), className: "flex flex-col items-center gap-0.5 py-1.5 rounded-md text-xs " + (view === "liste" ? "text-teal-400" : "text-slate-500") },
                    React.createElement(Icon, { size: 18 }, "👥"),
                    "Patients"),
                React.createElement("button", { onClick: () => {
                        setScanTargetId("");
                        setScanBtId("");
                        setEnhancedUrl(null);
                        setPages([]);
                        setView("scanner");
                    }, className: "flex flex-col items-center gap-0.5 py-1.5 rounded-md text-xs " + (view === "scanner" ? "text-teal-400" : "text-slate-500") },
                    React.createElement(Icon, { size: 18 }, "📷"),
                    "Scanner"),
                React.createElement("button", { onClick: () => {
                        setForm(emptyForm);
                        setView("ajout");
                    }, className: "flex flex-col items-center gap-0.5 py-1.5 rounded-md text-xs " + (view === "ajout" ? "text-teal-400" : "text-slate-500") },
                    React.createElement(Icon, { size: 18 }, "+"),
                    "Ajouter"))),
        toast && (React.createElement("div", { className: "fixed top-3 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-md px-4 py-2 text-sm shadow-lg z-30" }, toast))));
}
