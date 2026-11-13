import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";

// Prévisions de neige par ville (functions/src/meteo.js), mises à jour toutes
// les heures à partir d'Environnement Canada.
export function ecouterMeteo(villeGeoId, onChange) {
  return onSnapshot(
    doc(db, "meteo", villeGeoId),
    (snap) => onChange(snap.exists() ? snap.data() : null),
    () => onChange(null),
  );
}

// « Vendredi soir et nuit » → « Ven. soir » ; « Ce soir et cette nuit » → « Cette nuit ».
export function nomCourt(nom) {
  const n = nom.toLowerCase();
  if (n.startsWith("ce soir") || n.startsWith("cette nuit")) return "Cette nuit";
  if (n.startsWith("aujourd")) return "Aujourd'hui";
  const jour = nom.split(" ")[0];
  const abr = jour.length > 4 ? `${jour.slice(0, 3)}.` : jour;
  return n.includes("soir") || n.includes("nuit") ? `${abr} soir` : abr;
}

export const libelleCm = (cm) => (cm.min === cm.max ? `${cm.min} cm` : `${cm.min} à ${cm.max} cm`);

// Phrase principale, selon le rôle (pur, testable).
export function resumePrevision(periodes, { ville, role }) {
  const lieu = ville ? ` à ${ville}` : "";
  const bordee = periodes.find((p) => p.neige === "accumulation");
  if (bordee) {
    const quand = bordee.nom.toLowerCase();
    return role === "deneigeur"
      ? `Bordée prévue ${quand}${lieu} : ${libelleCm(bordee.cm)}. Les demandes risquent d'arriver tôt.`
      : `Neige prévue ${quand}${lieu} : ${libelleCm(bordee.cm)}.`;
  }
  const neige = periodes.find((p) => p.neige === "neige" || p.neige === "risque");
  if (neige) {
    const quand = neige.nom.toLowerCase();
    return neige.probabilite
      ? `Averses de neige possibles ${quand}${lieu} (${neige.probabilite} % de probabilité).`
      : `Neige prévue ${quand}${lieu}, sans accumulation annoncée.`;
  }
  const dernier = periodes.at(-1);
  return `Aucune neige prévue${lieu}${dernier ? ` d'ici ${dernier.nom.toLowerCase()}` : ""}.`;
}

// Ville sans prévision récente : le serveur la prépare tout de suite
// (functions/src/meteo.js, prevoirVille).
const fnPrevoir = httpsCallable(functions, "prevoirVille");
export const demanderPrevision = (villeGeoId) => fnPrevoir({ villeGeoId }).catch(() => null);
export const FRAICHEUR_MS = 75 * 60 * 1000;
