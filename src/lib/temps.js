// Formats de dates et de durées de l'app, à la québécoise (« 8 h », « 17 h 42 »).

const versDate = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);

export function heure(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

function jourRelatif(date, maintenant) {
  const debut = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ecartJours = Math.round((debut(date) - debut(maintenant)) / 86400000);
  if (ecartJours === 0) return "Aujourd'hui";
  if (ecartJours === 1) return "Demain";
  if (ecartJours === -1) return "Hier";
  if (ecartJours > 1 && ecartJours < 7) {
    const jour = date.toLocaleDateString("fr-CA", { weekday: "long" });
    return jour.charAt(0).toUpperCase() + jour.slice(1);
  }
  return date.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

// « Demain avant 8 h », « Aujourd'hui avant 17 h 30 »
export function echeance(valeur, maintenant = new Date()) {
  const date = versDate(valeur);
  return date ? `${jourRelatif(date, maintenant)} avant ${heure(date)}` : "";
}

// « il y a 12 min », « il y a 2 h », « il y a 3 jours »
export function ilYa(valeur, maintenant = new Date()) {
  const date = versDate(valeur);
  if (!date) return "à l'instant";
  const min = Math.max(0, Math.round((maintenant - date) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? "s" : ""}`;
}

// « 10 h », « 45 min »
export function dureeRestante(valeur, maintenant = new Date()) {
  const date = versDate(valeur);
  if (!date) return "";
  const min = Math.max(0, Math.round((date - maintenant) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.round(min / 60)} h`;
}

export function dateCourte(valeur) {
  const date = versDate(valeur);
  return date ? date.toLocaleDateString("fr-CA", { day: "numeric", month: "short" }) : "";
}

export function estAujourdhui(valeur, maintenant = new Date()) {
  const date = versDate(valeur);
  return Boolean(date) && date.toDateString() === maintenant.toDateString();
}

export function millis(valeur) {
  return versDate(valeur)?.getTime() ?? 0;
}

export function debutSemaine(maintenant = new Date()) {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const decalage = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - decalage);
  return d.getTime();
}
