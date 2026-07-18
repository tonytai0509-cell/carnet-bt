"use strict";
// Icônes simplifiées (emoji) pour rester autonome, sans dépendance externe.
function Icon({ children, size = 16, className = "" }) {
  return React.createElement(
    "span",
    { className: "inline-flex items-center justify-center leading-none " + className, style: { fontSize: size } },
    children
  );
}
function Spinner({ size = 20, className = "" }) {
  return React.createElement("span", {
    className: "inline-block rounded-full border-2 border-slate-700 border-t-teal-400 animate-spin " + className,
    style: { width: size, height: size },
  });
}
