import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const mettreAJourAdresseCallable = httpsCallable(functions, "mettreAJourAdresseUtilisateur");

// La ville est dérivée côté serveur (géocodage) — jamais fournie ici directement.
export function mettreAJourAdresseParPosition(geohash) {
  return mettreAJourAdresseCallable({ geohash });
}

// Adresse de service du déneigeur : choisie dans les suggestions (placeId)
// ou écrite au complet (texte), comme l'adresse d'une demande.
export function mettreAJourAdresseParSaisie({ placeId, texte }) {
  return mettreAJourAdresseCallable(placeId ? { placeId } : { adresse: texte.trim() });
}

// Suggestions d'adresses (demande et adresse de service), par le serveur : la clé
// Google n'est jamais dans le site.
const suggererCallable = httpsCallable(functions, "suggererAdresses");
export async function suggererAdresses(texte, session) {
  return (await suggererCallable({ texte, session })).data.suggestions;
}
