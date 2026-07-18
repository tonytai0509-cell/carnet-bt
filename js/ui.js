"use strict";
function Segments({ total, used }) {
    return (React.createElement("div", { className: "flex gap-1 flex-wrap" }, Array.from({ length: total }, (_, i) => (React.createElement("div", { key: i, className: "h-2.5 w-5 rounded-sm " + (i < used ? "bg-teal-400" : "bg-slate-700") })))));
}
function Field({ label, value, onChange, type = "text", placeholder }) {
    return (React.createElement("div", { className: "space-y-1" },
        React.createElement("label", { className: "text-[11px] uppercase tracking-wide text-slate-500" }, label),
        React.createElement("input", { type: type, value: value, placeholder: placeholder, onChange: (e) => onChange(type === "text" ? e.target.value.toUpperCase() : e.target.value), className: "w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-400 " +
                (type === "text" ? "uppercase placeholder:normal-case" : "") })));
}
function ToggleField({ label, checked, onChange }) {
    return (React.createElement("button", { onClick: () => onChange(!checked), className: "w-full flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5" },
        React.createElement("span", { className: "text-sm text-slate-200" }, label),
        React.createElement("span", { className: "relative h-5 w-9 rounded-full transition-colors " + (checked ? "bg-teal-500" : "bg-slate-700") },
            React.createElement("span", { className: "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform " +
                    (checked ? "translate-x-4" : "translate-x-0.5") }))));
}
const emptyBtRow = { depart: "Domicile", destination: "", numero: "", total: 4, typeVisite: "consultation" };
const emptyForm = {
    nom: "",
    hopital: "",
    medecin: "",
    adeli: "",
    signature: true,
    prescriptionDate: "",
    aldExonerante: false,
    bts: [{ ...emptyBtRow }],
};
