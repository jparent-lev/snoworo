import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// Mot de passe oublié et lien de connexion (functions/src/liensCompte.js).
// La réponse est la même qu'un compte existe ou non.
const fn = httpsCallable(functions, "demanderLienCompte");
export const demanderLienCompte = async (courriel, type) => (await fn({ courriel, type })).data;

// Adresse retenue sur cet appareil pour terminer la connexion par lien sans
// la redemander (Firebase exige l'adresse avec le lien).
const CLE = "snowro-courriel-lien";
export function retenirCourrielLien(courriel) {
  try {
    localStorage.setItem(CLE, courriel);
  } catch {
    // Stockage bloqué : l'adresse sera redemandée.
  }
}
export function lireCourrielLien() {
  try {
    return localStorage.getItem(CLE) ?? "";
  } catch {
    return "";
  }
}
export function oublierCourrielLien() {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // rien
  }
}
