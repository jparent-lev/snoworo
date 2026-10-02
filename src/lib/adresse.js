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

// Suggestions d'adresses (formulaire de demande), par le serveur : la clé
// Google n'est jamais dans le site.
const suggererCallable = httpsCallable(functions, "suggererAdresses");
export async function suggererAdresses(texte, session) {
  return (await suggererCallable({ texte, session })).data.suggestions;
}
