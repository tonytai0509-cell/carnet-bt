"use strict";
function AuthScreen() {
    const [mode, setMode] = useState("login"); // login | signup
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function submit() {
        setError(""); setNotice("");
        const mail = email.trim();
        if (!mail || !password) { setError("Renseigne ton e-mail et ton mot de passe"); return; }
        setBusy(true);
        try {
            if (mode === "signup") {
                const { data, error } = await window.supabaseClient.auth.signUp({ email: mail, password });
                if (error) throw error;
                if (!data.session) {
                    setNotice("Compte créé — vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
                    setMode("login");
                }
            } else {
                const { error } = await window.supabaseClient.auth.signInWithPassword({ email: mail, password });
                if (error) throw error;
            }
        } catch (e) {
            setError(traduireErreurAuth(e));
        } finally {
            setBusy(false);
        }
    }

    return (React.createElement("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4" },
        React.createElement("div", { className: "w-full max-w-md space-y-5" },
            React.createElement("div", { className: "flex flex-col items-center gap-2" },
                React.createElement("div", { className: "rounded-md bg-teal-500/15 border border-teal-500/30 flex items-center justify-center", style: { width: 56, height: 56 } },
                    React.createElement(Icon, { size: 26, className: "text-teal-400" }, "🎫")),
                React.createElement("p", { className: "text-sm font-semibold" }, "Carnet BT"),
                React.createElement("p", { className: "text-[11px] text-slate-500" }, "Suivi des bons de transport")),
            React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                React.createElement("button", { onClick: () => { setMode("login"); setError(""); setNotice(""); },
                    className: "rounded-md border px-3 py-2 text-sm transition-colors " +
                        (mode === "login" ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-slate-700 bg-slate-950 text-slate-400") }, "Se connecter"),
                React.createElement("button", { onClick: () => { setMode("signup"); setError(""); setNotice(""); },
                    className: "rounded-md border px-3 py-2 text-sm transition-colors " +
                        (mode === "signup" ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-slate-700 bg-slate-950 text-slate-400") }, "Créer un compte")),
            React.createElement("div", { className: "space-y-3" },
                React.createElement(Field, { label: "E-mail", type: "email", value: email, onChange: setEmail, placeholder: "toi@exemple.fr" }),
                React.createElement(Field, { label: "Mot de passe", type: "password", value: password, onChange: setPassword, placeholder: "6 caractères minimum" })),
            error && (React.createElement("div", { className: "flex items-start gap-2 rounded-md border px-3 py-2 text-sm bg-red-500/10 border-red-500/40 text-red-300" },
                React.createElement(Icon, { size: 16, className: "mt-0.5 shrink-0" }, "⚠️"), React.createElement("span", null, error))),
            notice && (React.createElement("div", { className: "flex items-start gap-2 rounded-md border px-3 py-2 text-sm bg-teal-500/10 border-teal-500/40 text-teal-300" },
                React.createElement(Icon, { size: 16, className: "mt-0.5 shrink-0" }, "✉️"), React.createElement("span", null, notice))),
            React.createElement("button", { onClick: submit, disabled: busy,
                className: "w-full flex items-center justify-center gap-2 rounded-md font-medium py-2.5 text-sm transition-colors " +
                    (busy ? "bg-slate-800 text-slate-600 cursor-not-allowed" : "bg-teal-500 text-slate-950 hover:bg-teal-400") },
                busy ? React.createElement(Spinner, { size: 15, className: "animate-spin" }) : React.createElement(Icon, { size: 16 }, "✓"),
                mode === "signup" ? " Créer mon compte" : " Se connecter"))));
}

function traduireErreurAuth(e) {
    const msg = (e && e.message) || "";
    if (/already registered|already exists/i.test(msg)) return "Un compte existe déjà avec cet e-mail.";
    if (/invalid login credentials/i.test(msg)) return "E-mail ou mot de passe incorrect.";
    if (/password should be at least/i.test(msg)) return "Le mot de passe doit faire au moins 6 caractères.";
    if (/rate limit/i.test(msg)) return "Trop de tentatives — réessaie dans quelques minutes.";
    return msg || "Une erreur est survenue.";
}
