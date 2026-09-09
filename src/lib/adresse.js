import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const mettreAJourAdresseCallable = httpsCallable(functions, "mettreAJourAdresseUtilisateur");

// `geohash` : position du déneigeur, obtenue via navigator.geolocation côté appelant.
// La ville est dérivée côté serveur (géocodage) — jamais fournie ici directement.
export function mettreAJourAdresse(geohash) {
  return mettreAJourAdresseCallable({ geohash });
}
