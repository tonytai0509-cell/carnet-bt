const TODAY = new Date();
function daysUntil(dateStr) {
  if (!dateStr) return 999;
  return Math.ceil((new Date(dateStr) - TODAY) / (1000 * 60 * 60 * 24));
}
function btAlerts(bt) {
  const alerts = [];
  const remaining = bt.total - bt.utilises;
  if (remaining <= 0) alerts.push({ level: "critical", text: `"${bt.label || bt.numero}" terminé` });
  else if (remaining === 1) alerts.push({ level: "warning", text: `"${bt.label || bt.numero}" — dernière séance` });
  return alerts;
}

function patientAlerts(p) {
  const alerts = [];
  if (!p.signature) alerts.push({ level: "warning", text: "Signature manquante" });
  if (!p.adeli) alerts.push({ level: "warning", text: "ADELI manquant" });
  return alerts;
}

function alertsFor(p) {
  const fromBts = (p.bts || []).flatMap(btAlerts);
  return [...fromBts, ...patientAlerts(p)];
}

function normalizePatient(p) {
  if (p.bts) return p;
  return {
    ...p,
    bts: p.btNumero
      ? [
          {
            id: "bt_legacy_" + p.id,
            label: "BT",
            numero: p.btNumero,
            total: p.btTotal || 1,
            utilises: p.btUtilises || 0,
            typeVisite: "consultation",
            historique: [],
          },
        ]
      : [],
  };
}
