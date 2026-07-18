"use strict";
const { useState, useEffect, useRef, useCallback, useMemo } = React;

try {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(CarnetBTApp, null));
} catch (err) {
  var bootEl = document.getElementById("boot-error");
  bootEl.style.display = "block";
  bootEl.textContent = "Erreur au démarrage : " + (err && err.message ? err.message : err);
}
