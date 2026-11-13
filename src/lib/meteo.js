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

export const libelleCm = (cm) => (cm.min === cm.max ? `${cm.min} cm` : `${cm.min} à ${cm.max} cm`);

// Ville sans prévision récente : le serveur la prépare tout de suite
// (functions/src/meteo.js, prevoirVille).
const fnPrevoir = httpsCallable(functions, "prevoirVille");
export const demanderPrevision = (villeGeoId) => fnPrevoir({ villeGeoId }).catch(() => null);
export const FRAICHEUR_MS = 75 * 60 * 1000;

// Texte de la pastille (pur, testable) : la première période avec une
// accumulation, sinon de la neige possible, sinon rien de prévu.
export function textePastille(periodes) {
  const bordee = periodes.find((p) => p.neige === "accumulation");
  if (bordee) return { ton: "bordee", texte: `Bordée prévue ${bordee.nom.toLowerCase()} : ${libelleCm(bordee.cm)}` };
  const neige = periodes.find((p) => p.neige === "neige" || p.neige === "risque");
  if (neige) {
    return {
      ton: "neige",
      texte: `Neige possible ${neige.nom.toLowerCase()}${neige.probabilite ? ` (${neige.probabilite} %)` : ""}, sans accumulation annoncée`,
    };
  }
  return { ton: "aucune", texte: "Pas de bordée prévue pour le moment" };
}
