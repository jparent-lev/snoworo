import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// Valeurs de secours tant que config/frais n'existe pas encore en base (créé
// une fois la Cloud Function de paiement Stripe Connect construite — voir
// docs/architecture.md § Paiement). Mêmes valeurs par défaut que la maquette
// (design_handoff_snowro_site), donc rien ne change visuellement le jour où
// le document est créé pour de vrai.
const FRAIS_PAR_DEFAUT = { fraisFixe: 2, fraisPct: 8 };

export function ecouterConfigFrais(onChange) {
  return onSnapshot(
    doc(db, "config", "frais"),
    (snap) => onChange(snap.exists() ? snap.data() : FRAIS_PAR_DEFAUT),
    () => onChange(FRAIS_PAR_DEFAUT),
  );
}
