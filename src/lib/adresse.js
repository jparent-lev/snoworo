import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const mettreAJourAdresseCallable = httpsCallable(functions, "mettreAJourAdresseUtilisateur");

// La ville est dérivée côté serveur (géocodage) — jamais fournie ici directement.
export function mettreAJourAdresseParPosition(geohash) {
  return mettreAJourAdresseCallable({ geohash });
}

export function mettreAJourAdresseParTexte(adresse) {
  return mettreAJourAdresseCallable({ adresse });
}
